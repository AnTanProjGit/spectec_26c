import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import User
from app.models.branch import Branch, BranchDocumentFlow
from app.models.crm import CRMDeal
from app.models.customer import Client
from app.models.driver import Driver
from app.models.enums import (
    AccountingSubjectEnum,
    CRMStageEnum,
    ClientTypeEnum,
    ClosingDocKindEnum,
    EquipmentTypeEnum,
    NotificationCategoryEnum,
)
from app.models.fleet import Equipment
from app.schemas.base import AccountingSubjectId, CamelModel
from app.schemas.crm_erp import (
    CRMDealCreate,
    CRMDealResponse,
    CRMDealStagePatch,
    CRMDealUpdate,
    CloseDealShiftRequest,
    ClosingDocumentRecord,
)
from app.services.branch_cascade import derive_act_services_prefix
from app.services.closing_docs_service import calculate_vat, sync_closing_doc_to_source_and_legal
from app.services.crm_service import (
    apply_deal_retention_48h,
    close_deal_shift,
    serialize_deal,
    transition_deal_stage,
)

router = APIRouter(prefix="/crm", tags=["CRM Deals & Kanban"])


class CloseDealVolumeRequest(CamelModel):
    volume_hours: Decimal


@router.get("/deals/kanban")
async def get_kanban_deals(
    branch_id: Optional[str] = Query(default="all"),
    include_archived: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await apply_deal_retention_48h(db)
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(CRMDeal).order_by(CRMDeal.updated_at.desc())
    if scoped and scoped != "all":
        stmt = stmt.where(CRMDeal.branch_id == scoped)
    if not include_archived:
        stmt = stmt.where(CRMDeal.archived_at.is_(None))
    deals = (await db.execute(stmt)).scalars().all()
    dtos = [serialize_deal(d).model_dump(by_alias=True) for d in deals]
    active_count = sum(1 for d in deals if d.stage == CRMStageEnum.active)
    return {"deals": dtos, "activeCount": active_count}


@router.post("/deals", response_model=CRMDealResponse, status_code=status.HTTP_201_CREATED)
async def create_deal(
    payload: CRMDealCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CRMDealResponse:
    enforce_branch_scope(current_user, payload.branch_id)
    if payload.equipment_assigned_id:
        eq = (
            await db.execute(
                select(Equipment).where(
                    Equipment.id == payload.equipment_assigned_id,
                    Equipment.branch_id == payload.branch_id,
                )
            )
        ).scalar_one_or_none()
        if not eq:
            raise HTTPException(status_code=422, detail="Выбранная техника не принадлежит данному участку")

    if payload.assigned_driver_id:
        drv = (
            await db.execute(
                select(Driver).where(Driver.id == payload.assigned_driver_id, Driver.branch_id == payload.branch_id)
            )
        ).scalar_one_or_none()
        if not drv:
            raise HTTPException(status_code=422, detail="Назначенный водитель не принадлежит данному участку")

    client_row = (
        await db.execute(
            select(Client).where(Client.primary_branch_id == payload.branch_id, Client.name == payload.client_name)
        )
    ).scalar_one_or_none()

    client_type = ClientTypeEnum((payload.client_type.value if payload.client_type else "legal_entity"))
    subj = (
        AccountingSubjectEnum(payload.accounting_subject.value)
        if payload.accounting_subject
        else (
            AccountingSubjectEnum.ooo_specialtech
            if client_type == ClientTypeEnum.legal_entity
            else AccountingSubjectEnum.ip_specialtechnica
        )
    )
    est = (Decimal(payload.hours_requested) * payload.hourly_rate_agreed).quantize(Decimal("0.01"))

    deal = CRMDeal(
        id=f"deal-{uuid.uuid4().hex[:8]}",
        branch_id=payload.branch_id,
        client_id=client_row.id if client_row else None,
        client_name=payload.client_name,
        contact_person=payload.contact_person,
        phone=payload.phone,
        client_type=client_type,
        has_contract=True if payload.has_contract is None else payload.has_contract,
        accounting_subject=subj,
        equipment_type=EquipmentTypeEnum(payload.equipment_type.value),
        equipment_assigned_id=payload.equipment_assigned_id,
        assigned_driver_id=payload.assigned_driver_id,
        assigned_driver_name=payload.assigned_driver_name,
        assigned_driver_phone=payload.assigned_driver_phone,
        driver_assignment_mode=payload.driver_assignment_mode or "default_single",
        hours_requested=payload.hours_requested,
        shifts_requested=payload.shifts_requested,
        hourly_rate_agreed=payload.hourly_rate_agreed,
        estimated_amount=est,
        stage=CRMStageEnum.lead,
        debt_amount=Decimal("0.00"),
        paid_amount=Decimal("0.00"),
        site_address=payload.site_address,
        doc_date=date.today(),
        manager=payload.manager,
        attachments=[a.model_dump(by_alias=True) for a in payload.attachments],
        stage_updated_at=datetime.now(timezone.utc),
    )
    db.add(deal)
    await db.commit()
    await db.refresh(deal)
    return serialize_deal(deal)


@router.patch("/deals/{deal_id}", response_model=CRMDealResponse)
async def update_deal(
    deal_id: str,
    payload: CRMDealUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CRMDealResponse:
    deal = (await db.execute(select(CRMDeal).where(CRMDeal.id == deal_id))).scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Сделка CRM не найдена")
    enforce_branch_scope(current_user, deal.branch_id)

    data = payload.model_dump(exclude_unset=True)
    if "client_type" in data and data["client_type"] is not None:
        data["client_type"] = ClientTypeEnum(data["client_type"].value)
    if "accounting_subject" in data and data["accounting_subject"] is not None:
        data["accounting_subject"] = AccountingSubjectEnum(data["accounting_subject"].value)
    if "equipment_type" in data and data["equipment_type"] is not None:
        data["equipment_type"] = EquipmentTypeEnum(data["equipment_type"].value)
    if "attachments" in data and payload.attachments is not None:
        data["attachments"] = [a.model_dump(by_alias=True) for a in payload.attachments]

    if "assigned_driver_id" in data and data["assigned_driver_id"]:
        drv = (
            await db.execute(
                select(Driver).where(Driver.id == data["assigned_driver_id"], Driver.branch_id == deal.branch_id)
            )
        ).scalar_one_or_none()
        if not drv:
            raise HTTPException(status_code=422, detail="Назначенный водитель должен принадлежать тому же участку")

    for k, v in data.items():
        if hasattr(deal, k):
            setattr(deal, k, v)
    if deal.stage == CRMStageEnum.completed and deal.debt_amount > 0:
        deal.stage = CRMStageEnum.active
        deal.completed_at = None
        deal.archived_at = None
        deal.stage_updated_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(deal)
    return serialize_deal(deal)


@router.patch("/deals/{deal_id}/stage", response_model=CRMDealResponse)
async def move_deal_stage(
    deal_id: str,
    payload: CRMDealStagePatch,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> CRMDealResponse:
    deal = (await db.execute(select(CRMDeal).where(CRMDeal.id == deal_id))).scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Сделка CRM не найдена")
    enforce_branch_scope(current_user, deal.branch_id)
    updated = await transition_deal_stage(db, deal, CRMStageEnum(payload.stage.value), current_user.full_name)
    return serialize_deal(updated)


@router.post("/deals/{deal_id}/close-shift")
async def close_deal_shift_endpoint(
    deal_id: str,
    payload: CloseDealShiftRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    deal = (await db.execute(select(CRMDeal).where(CRMDeal.id == deal_id))).scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Сделка CRM не найдена")
    enforce_branch_scope(current_user, deal.branch_id)
    deal_dto, shift_log_dto, chat_dto = await close_deal_shift(db, deal_id, payload, current_user.full_name)
    return {
        "deal": deal_dto.model_dump(by_alias=True),
        "shiftLog": shift_log_dto.model_dump(by_alias=True),
        "chatMessage": chat_dto.model_dump(by_alias=True),
    }


@router.post("/deals/{deal_id}/close-volume", status_code=status.HTTP_201_CREATED)
async def close_deal_volume_endpoint(
    deal_id: str,
    payload: CloseDealVolumeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    deal = (await db.execute(select(CRMDeal).where(CRMDeal.id == deal_id))).scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Сделка CRM не найдена")
    enforce_branch_scope(current_user, deal.branch_id)
    if payload.volume_hours <= 0:
        raise HTTPException(status_code=422, detail="Объём часов должен быть больше 0")

    branch = (await db.execute(select(Branch).where(Branch.id == deal.branch_id))).scalar_one_or_none()
    df = (
        await db.execute(select(BranchDocumentFlow).where(BranchDocumentFlow.branch_id == deal.branch_id))
    ).scalar_one_or_none()
    code = branch.code if branch else "MSK"
    ks2_prefix = df.act_prefix if df else f"КС2-{code}-"
    act_prefix = derive_act_services_prefix(ks2_prefix)
    suffix = deal.id[-4:].upper()
    today = date.today()
    total_rub = (payload.volume_hours * deal.hourly_rate_agreed).quantize(Decimal("0.01"))
    vat_rub = calculate_vat(total_rub, deal.accounting_subject)
    subj_id = AccountingSubjectId(deal.accounting_subject.value)
    eq_name = deal.equipment_type.value
    if deal.equipment_assigned_id:
        eq_row = (await db.execute(select(Equipment).where(Equipment.id == deal.equipment_assigned_id))).scalar_one_or_none()
        if eq_row:
            eq_name = eq_row.name

    base_kw = dict(
        date=today,
        period_start=deal.doc_date,
        period_end=today,
        branch_id=deal.branch_id,
        source_type="deal",
        source_id=deal.id,
        order_or_deal_number=f"CRM-{deal.id[-6:].upper()}",
        client_name=deal.client_name,
        site_address=deal.site_address,
        equipment_name=eq_name,
        operator_name=deal.assigned_driver_name or deal.manager,
        work_description=f"Услуги спецтехники ({eq_name}) на объекте {deal.site_address}",
        unit_label="маш.-час",
        quantity=payload.volume_hours,
        rate_rub=deal.hourly_rate_agreed,
        total_amount_rub=total_rub,
        vat_amount_rub=vat_rub,
        accounting_subject=subj_id,
    )

    act_rec = ClosingDocumentRecord(
        id=f"cdoc-act-{uuid.uuid4().hex[:8]}",
        kind="act_services",
        number=f"{act_prefix}{suffix}",
        content_text=f"Акт оказанных услуг для {deal.client_name}, объём {payload.volume_hours} ч, сумма {total_rub} ₽",
        **base_kw,
    )
    ks2_rec = ClosingDocumentRecord(
        id=f"cdoc-ks2-{uuid.uuid4().hex[:8]}",
        kind="ks2",
        number=f"{ks2_prefix}{suffix}",
        content_text=f"Унифицированная форма КС-2 (ОКУД 0322005) для {deal.client_name}, сумма {total_rub} ₽",
        **base_kw,
    )
    ks3_rec = ClosingDocumentRecord(
        id=f"cdoc-ks3-{uuid.uuid4().hex[:8]}",
        kind="ks3",
        number=f"КС3-{code}-CRM-{suffix}",
        content_text=f"Справка КС-3 (ОКУД 0322001) для {deal.client_name}, сумма {total_rub} ₽",
        **base_kw,
    )

    saved_act, _ = await sync_closing_doc_to_source_and_legal(
        db, act_rec, current_user.full_name, current_user.role, NotificationCategoryEnum.act_ks2
    )
    saved_ks2, _ = await sync_closing_doc_to_source_and_legal(
        db, ks2_rec, current_user.full_name, current_user.role, NotificationCategoryEnum.act_ks2
    )
    saved_ks3, notif = await sync_closing_doc_to_source_and_legal(
        db, ks3_rec, current_user.full_name, current_user.role, NotificationCategoryEnum.act_ks2
    )
    await db.commit()
    await db.refresh(deal)
    return {
        "deal": serialize_deal(deal).model_dump(by_alias=True),
        "act": saved_act.model_dump(by_alias=True),
        "ks2": saved_ks2.model_dump(by_alias=True),
        "ks3": saved_ks3.model_dump(by_alias=True),
        "notification": notif.model_dump(by_alias=True) if notif else None,
    }


@router.post("/deals/archive-expired")
async def archive_expired_deals(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    archived_count, reverted_count = await apply_deal_retention_48h(db)
    return {"archivedCount": archived_count, "revertedToActiveCount": reverted_count}
