import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import User
from app.models.branch import BranchDocumentFlow
from app.models.crm import ClientCommunication, MaxCustomerBotConfig
from app.models.enums import (
    AccountingSubjectEnum,
    ClientTypeEnum,
    NotificationCategoryEnum,
    OrderStatusEnum,
)
from app.models.erp import RentalOrder, StatusNotification, StatusNotificationSettings
from app.models.fleet import Equipment
from app.schemas.crm_erp import RentalOrderCreate, RentalOrderResponse, StatusNotificationItem
from app.services.serializers import serialize_order

router = APIRouter(prefix="/rentals", tags=["Rental Orders"])


@router.get("/orders", response_model=List[RentalOrderResponse])
async def list_orders(
    branch_id: Optional[str] = Query(default="all"),
    order_status: Optional[OrderStatusEnum] = Query(default=None, alias="status"),
    act_pending: Optional[bool] = Query(default=None),
    has_debt: Optional[bool] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[RentalOrderResponse]:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(RentalOrder).order_by(RentalOrder.doc_date.desc())
    if scoped and scoped != "all":
        stmt = stmt.where(RentalOrder.branch_id == scoped)
    if order_status:
        stmt = stmt.where(RentalOrder.status == order_status)
    if act_pending is True:
        stmt = stmt.where(RentalOrder.act_signed.is_(False))
    orders = (await db.execute(stmt)).scalars().all()
    eq_rows = (await db.execute(select(Equipment))).scalars().all()
    eq_map = {e.id: e.name for e in eq_rows}

    res = [serialize_order(o, eq_map.get(o.equipment_id)) for o in orders]
    if has_debt is True:
        res = [r for r in res if r.debt_amount > 0]
    return res


@router.post("/orders", response_model=RentalOrderResponse, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: RentalOrderCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RentalOrderResponse:
    enforce_branch_scope(current_user, payload.branch_id)
    eq = (
        await db.execute(
            select(Equipment).where(Equipment.id == payload.equipment_id, Equipment.branch_id == payload.branch_id)
        )
    ).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=422, detail="Техника не найдена на указанном участке")

    df = (
        await db.execute(select(BranchDocumentFlow).where(BranchDocumentFlow.branch_id == payload.branch_id))
    ).scalar_one_or_none()
    prefix = df.order_prefix if df else "RO-2026-"
    order_num = payload.order_number or f"{prefix}{uuid.uuid4().hex[:4].upper()}"

    order = RentalOrder(
        id=f"ro-{uuid.uuid4().hex[:10]}",
        branch_id=payload.branch_id,
        deal_id=payload.deal_id,
        equipment_id=payload.equipment_id,
        order_number=order_num,
        client_name=payload.client_name,
        client_type=ClientTypeEnum(payload.client_type.value),
        has_contract=payload.has_contract,
        accounting_subject=AccountingSubjectEnum(payload.accounting_subject.value),
        operator_name=payload.operator_name,
        site_address=payload.site_address,
        doc_date=payload.start_date,
        end_date=payload.end_date,
        planned_hours=payload.planned_hours,
        actual_hours=Decimal("0.0"),
        hourly_rate=payload.hourly_rate,
        total_amount=(Decimal(payload.planned_hours) * payload.hourly_rate).quantize(Decimal("0.01")),
        paid_amount=Decimal("0.00"),
        status=OrderStatusEnum.active,
        act_signed=False,
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return serialize_order(order, eq.name)


@router.patch("/orders/{order_id}/toggle-act")
async def toggle_order_act_signed(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    order = (await db.execute(select(RentalOrder).where(RentalOrder.id == order_id))).scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="Заказ-наряд не найден")
    enforce_branch_scope(current_user, order.branch_id)

    order.act_signed = not order.act_signed
    now = datetime.now(timezone.utc)
    settings_row = (
        await db.execute(select(StatusNotificationSettings).where(StatusNotificationSettings.id == 1))
    ).scalar_one_or_none()

    notif_item: Optional[StatusNotificationItem] = None
    if not settings_row or (settings_row.enabled and settings_row.on_act_signed_change):
        channels = ["erp"]
        if not settings_row or settings_row.send_to_branch_chat:
            channels.append("chat")
        max_cfg = (
            await db.execute(select(MaxCustomerBotConfig).where(MaxCustomerBotConfig.branch_id == order.branch_id))
        ).scalar_one_or_none()
        if settings_row and settings_row.send_to_max_client_bot and (not max_cfg or max_cfg.enabled):
            channels.append("max_bot")

        status_label = "подписан" if order.act_signed else "отозван"
        notif_id = f"notif-{uuid.uuid4().hex[:10]}"
        title = f"Акт по заказу {order.order_number} {status_label}"
        message = f"Заказ-наряд {order.order_number} ({order.client_name}): статус акта — {status_label}."
        db.add(
            StatusNotification(
                id=notif_id,
                branch_id=order.branch_id,
                title=title,
                message=message,
                category=NotificationCategoryEnum.act_ks2,
                entity_label=order.order_number,
                channels=channels,
                is_read=False,
            )
        )
        if "chat" in channels:
            db.add(
                ClientCommunication(
                    id=f"msg-{uuid.uuid4().hex[:10]}",
                    branch_id=order.branch_id,
                    deal_id=order.deal_id,
                    sender_name=current_user.full_name,
                    sender_role="admin",
                    message_text=f"[ERP] {message}",
                )
            )
        notif_item = StatusNotificationItem(
            id=notif_id,
            timestamp=now,
            branch_id=order.branch_id,
            title=title,
            message=message,
            category="act_ks2",
            entity_label=order.order_number,
            channels=channels,
            read=False,
        )

    await db.commit()
    return {
        "id": order.id,
        "actSigned": order.act_signed,
        "signedAt": now.isoformat() if order.act_signed else None,
        "notification": notif_item.model_dump(by_alias=True) if notif_item else None,
    }
