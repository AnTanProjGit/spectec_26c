import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from typing import Tuple

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import CRMDeal, ClientCommunication, DealShiftLog, DealStageHistory
from app.models.enums import CRMStageEnum
from app.schemas.crm_erp import (
    CRMDealResponse,
    ChatMessageResponse,
    CloseDealShiftRequest,
    DealShiftLog as DealShiftLogSchema,
)


def serialize_deal(deal: CRMDeal) -> CRMDealResponse:
    return CRMDealResponse(
        id=deal.id,
        branch_id=deal.branch_id,
        client_name=deal.client_name,
        contact_person=deal.contact_person,
        phone=deal.phone,
        client_type=deal.client_type.value,
        has_contract=deal.has_contract,
        accounting_subject=deal.accounting_subject.value,
        equipment_type=deal.equipment_type.value,
        equipment_assigned_id=deal.equipment_assigned_id,
        assigned_driver_id=deal.assigned_driver_id,
        assigned_driver_name=deal.assigned_driver_name,
        assigned_driver_phone=deal.assigned_driver_phone,
        driver_assignment_mode=deal.driver_assignment_mode or "default_single",
        hours_requested=deal.hours_requested,
        shifts_requested=deal.shifts_requested,
        hourly_rate_agreed=deal.hourly_rate_agreed,
        estimated_amount=deal.estimated_amount,
        stage=deal.stage.value,
        debt_amount=deal.debt_amount,
        paid_amount=deal.paid_amount,
        site_address=deal.site_address,
        date_created=deal.doc_date,
        manager=deal.manager,
        attachments=deal.attachments or [],
        shift_logs=[
            DealShiftLogSchema(
                id=s.id,
                date=s.doc_date,
                shift_slot=s.shift_slot,  # type: ignore[arg-type]
                hours=s.hours,
                closed_at=s.closed_at,
            )
            for s in (deal.shift_logs or [])
        ],
        closed_shift_hours_total=deal.closed_shift_hours_total,
        closed_volume_hours=deal.closed_volume_hours,
        act_signed=deal.act_signed,
        act_number=deal.act_number,
        ks2_number=deal.ks2_number,
        ks3_number=deal.ks3_number,
        act_saved_to_base=deal.act_saved_to_base,
        ks2_saved_to_base=deal.ks2_saved_to_base,
        ks3_saved_to_base=deal.ks3_saved_to_base,
        invoice_number=deal.invoice_number,
        invoice_date=deal.invoice_date,
        invoice_status=deal.invoice_status.value,
        invoice_saved_to_base=deal.invoice_saved_to_base,
        stage_updated_at=deal.stage_updated_at,
        completed_at=deal.completed_at,
        archived_at=deal.archived_at,
    )


async def apply_deal_retention_48h(db: AsyncSession) -> Tuple[int, int]:
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=48)
    deals = (await db.execute(select(CRMDeal))).scalars().all()
    archived_count = 0
    reverted_count = 0
    for deal in deals:
        if deal.stage == CRMStageEnum.completed and deal.debt_amount > 0:
            deal.stage = CRMStageEnum.active
            deal.completed_at = None
            deal.archived_at = None
            deal.stage_updated_at = now
            reverted_count += 1
        elif (
            deal.stage == CRMStageEnum.completed
            and deal.debt_amount <= 0
            and deal.completed_at is not None
            and deal.archived_at is None
            and deal.completed_at <= cutoff
        ):
            deal.archived_at = now
            archived_count += 1
    if archived_count or reverted_count:
        await db.commit()
    return archived_count, reverted_count


async def transition_deal_stage(
    db: AsyncSession, deal: CRMDeal, target_stage: CRMStageEnum, changed_by: str
) -> CRMDeal:
    now = datetime.now(timezone.utc)
    if target_stage == CRMStageEnum.completed:
        has_closing_doc = (
            deal.act_signed or deal.act_saved_to_base or deal.ks2_saved_to_base or deal.ks3_saved_to_base
        )
        if not has_closing_doc or deal.debt_amount > 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Завершение сделки запрещено: требуются закрывающие документы (Акт/КС-2/КС-3) и нулевая задолженность",
            )
        deal.completed_at = now
        deal.archived_at = None
    else:
        deal.completed_at = None
        deal.archived_at = None

    prev_stage = deal.stage
    deal.stage = target_stage
    deal.stage_updated_at = now
    db.add(
        DealStageHistory(
            deal_id=deal.id,
            from_stage=prev_stage,
            to_stage=target_stage,
            changed_by=changed_by,
        )
    )
    await db.commit()
    await db.refresh(deal)
    return deal


async def close_deal_shift(
    db: AsyncSession, deal_id: str, payload: CloseDealShiftRequest, actor_name: str
) -> tuple[CRMDealResponse, DealShiftLogSchema, ChatMessageResponse]:
    deal = (await db.execute(select(CRMDeal).where(CRMDeal.id == deal_id))).scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Сделка CRM не найдена")

    same_date_count = (
        await db.execute(
            select(func.count()).select_from(DealShiftLog).where(
                DealShiftLog.deal_id == deal_id,
                DealShiftLog.doc_date == payload.date,
            )
        )
    ).scalar_one()
    if same_date_count >= 2:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="На одну календарную дату допускается не более 2 закрытых смен по заявке",
        )

    dup_slot = (
        await db.execute(
            select(DealShiftLog).where(
                DealShiftLog.deal_id == deal_id,
                DealShiftLog.doc_date == payload.date,
                DealShiftLog.shift_slot == payload.shift_slot,
            )
        )
    ).scalar_one_or_none()
    if dup_slot:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Смена {payload.shift_slot} на дату {payload.date.isoformat()} уже закрыта",
        )

    shift_log = DealShiftLog(
        id=f"dsl-{uuid.uuid4().hex[:10]}",
        deal_id=deal.id,
        branch_id=deal.branch_id,
        doc_date=payload.date,
        shift_slot=payload.shift_slot,
        hours=payload.hours,
    )
    db.add(shift_log)
    deal.closed_shift_hours_total = (deal.closed_shift_hours_total or Decimal("0.00")) + payload.hours

    msg_id = f"msg-{uuid.uuid4().hex[:10]}"
    msg_text = (
        f"Закрыта смена #{payload.shift_slot} по заявке {deal.client_name} ({deal.site_address}) "
        f"за {payload.date.isoformat()}: {payload.hours} ч."
    )
    comm = ClientCommunication(
        id=msg_id,
        branch_id=deal.branch_id,
        deal_id=deal.id,
        doc_date=payload.date,
        sender_name=actor_name,
        sender_role="fleet_manager",
        message_text=msg_text,
        confirmation={
            "type": "shift_close",
            "label": f"Смена #{payload.shift_slot} ({deal.client_name})",
            "value": f"{payload.hours} ч",
            "approvedByAdmin": True,
        },
    )
    db.add(comm)
    await db.commit()
    await db.refresh(deal)
    await db.refresh(shift_log)

    return (
        serialize_deal(deal),
        DealShiftLogSchema(
            id=shift_log.id,
            date=shift_log.doc_date,
            shift_slot=shift_log.shift_slot,  # type: ignore[arg-type]
            hours=shift_log.hours,
            closed_at=shift_log.closed_at,
        ),
        ChatMessageResponse(
            id=comm.id,
            branch_id=comm.branch_id,
            deal_id=comm.deal_id,
            sender_name=comm.sender_name,
            sender_role="fleet_manager",
            text=comm.message_text,
            confirmation=comm.confirmation,
            timestamp=comm.created_at.strftime("%Y-%m-%d %H:%M"),
        ),
    )
