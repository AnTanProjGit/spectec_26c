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
from app.models.audit import FuelAuditLog
from app.models.crm import CRMDeal
from app.models.customer import Client
from app.models.driver import Driver, DriverCard, DriverCardTransaction
from app.models.enums import PaymentCategoryEnum
from app.models.erp import RentalOrder
from app.models.fleet import Equipment
from app.models.forms import ShiftReport
from app.schemas.drivers import DriverCardExpenseCreate, DriverCardExpenseResponse

router = APIRouter(prefix="/driver-bot", tags=["Driver MAX Bot & Corporate Cards (5-Link Flow)"])


@router.post("/card-expenses", response_model=DriverCardExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_card_expense(
    payload: DriverCardExpenseCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DriverCardExpenseResponse:
    enforce_branch_scope(current_user, payload.branch_id)

    # 1. Verify driver belongs to branch_id
    drv = (
        await db.execute(
            select(Driver).where(Driver.id == payload.driver_id, Driver.branch_id == payload.branch_id)
        )
    ).scalar_one_or_none()
    if not drv:
        raise HTTPException(status_code=422, detail="Водитель не найден или не принадлежит участку")

    # 2. Verify corporate card belongs to driver + branch_id
    card = (
        await db.execute(
            select(DriverCard).where(
                DriverCard.branch_id == payload.branch_id,
                DriverCard.driver_id == payload.driver_id,
                DriverCard.card_last4 == payload.card_last4,
            )
        )
    ).scalar_one_or_none()
    if not card:
        raise HTTPException(status_code=422, detail="Корпоративная карта не привязана к водителю на этом участке")

    # 3. Verify source equipment belongs to branch_id
    src_eq = (
        await db.execute(
            select(Equipment).where(
                Equipment.id == payload.source_equipment_id, Equipment.branch_id == payload.branch_id
            )
        )
    ).scalar_one_or_none()
    if not src_eq:
        raise HTTPException(status_code=422, detail="Исходная единица техники не принадлежит участку")

    # 4. Verify optional client/order/deal/shift belong to same branch_id
    client_uuid: Optional[uuid.UUID] = None
    if payload.client_id:
        try:
            client_uuid = uuid.UUID(payload.client_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Некорректный UUID заказчика") from exc
        c_row = (
            await db.execute(
                select(Client).where(Client.id == client_uuid, Client.primary_branch_id == payload.branch_id)
            )
        ).scalar_one_or_none()
        if not c_row:
            raise HTTPException(status_code=422, detail="Заказчик не принадлежит указанному участку")

    if payload.order_id:
        o_row = (
            await db.execute(
                select(RentalOrder).where(
                    RentalOrder.id == payload.order_id, RentalOrder.branch_id == payload.branch_id
                )
            )
        ).scalar_one_or_none()
        if not o_row:
            raise HTTPException(status_code=422, detail="Заказ-наряд не принадлежит участку")

    if payload.deal_id:
        d_row = (
            await db.execute(
                select(CRMDeal).where(CRMDeal.id == payload.deal_id, CRMDeal.branch_id == payload.branch_id)
            )
        ).scalar_one_or_none()
        if not d_row:
            raise HTTPException(status_code=422, detail="Сделка CRM не принадлежит участку")

    if payload.shift_report_id:
        sh_row = (
            await db.execute(
                select(ShiftReport).where(
                    ShiftReport.id == payload.shift_report_id, ShiftReport.branch_id == payload.branch_id
                )
            )
        ).scalar_one_or_none()
        if not sh_row:
            raise HTTPException(status_code=422, detail="Сменный рапорт не принадлежит участку")

    # 5. Intra-branch fuel_for_equipment validation
    target_eq: Optional[Equipment] = None
    if payload.payment_category.value == "fuel_for_equipment":
        if not payload.target_equipment_id:
            raise HTTPException(status_code=422, detail="Укажите принимающую технику для перелива ГСМ")
        target_eq = (
            await db.execute(
                select(Equipment).where(
                    Equipment.id == payload.target_equipment_id, Equipment.branch_id == payload.branch_id
                )
            )
        ).scalar_one_or_none()
        if not target_eq:
            raise HTTPException(
                status_code=422,
                detail="Межфилиальный перелив ГСМ запрещён: принимающая техника должна принадлежать тому же участку",
            )

    if payload.target_driver_id:
        td = (
            await db.execute(
                select(Driver).where(Driver.id == payload.target_driver_id, Driver.branch_id == payload.branch_id)
            )
        ).scalar_one_or_none()
        if not td:
            raise HTTPException(status_code=422, detail="Целевой водитель не принадлежит указанному участку")

    reallocated = target_eq is not None
    if reallocated and target_eq is not None:
        target_eq.fuel_cost_month += payload.amount_rub
    elif payload.payment_category.value == "fuel_own_tank":
        src_eq.fuel_cost_month += payload.amount_rub
    elif payload.payment_category.value == "parts":
        src_eq.repair_cost_month += payload.amount_rub
    else:
        src_eq.overheads_allocated += payload.amount_rub

    tx = DriverCardTransaction(
        branch_id=payload.branch_id,
        card_id=card.id,
        driver_id=payload.driver_id,
        source_equipment_id=payload.source_equipment_id,
        target_equipment_id=payload.target_equipment_id,
        target_driver_id=payload.target_driver_id,
        shift_report_id=payload.shift_report_id,
        client_id=client_uuid,
        order_id=payload.order_id,
        deal_id=payload.deal_id,
        doc_date=date.today(),
        payment_category=PaymentCategoryEnum(payload.payment_category.value),
        liters=payload.liters,
        amount_rub=payload.amount_rub,
        reallocated_to_target=reallocated,
        site_name=payload.site_name,
        comment=payload.comment,
    )
    db.add(tx)
    await db.commit()
    await db.refresh(tx)

    month_txs = (
        await db.execute(
            select(DriverCardTransaction).where(
                DriverCardTransaction.branch_id == payload.branch_id,
                DriverCardTransaction.driver_id == payload.driver_id,
                DriverCardTransaction.period_year == tx.period_year,
                DriverCardTransaction.period_month == tx.period_month,
            )
        )
    ).scalars().all()
    spent = sum((t.amount_rub for t in month_txs), Decimal("0.00"))
    src_balance = card.monthly_limit_rub - spent

    return DriverCardExpenseResponse(
        id=str(tx.id),
        branch_id=payload.branch_id,
        driver_id=payload.driver_id,
        card_last4=payload.card_last4,
        source_equipment_id=payload.source_equipment_id,
        shift_report_id=payload.shift_report_id,
        client_id=payload.client_id,
        client_name=payload.client_name,
        order_id=payload.order_id,
        deal_id=payload.deal_id,
        payment_category=payload.payment_category,
        target_equipment_id=payload.target_equipment_id,
        target_driver_id=payload.target_driver_id,
        liters=payload.liters,
        amount_rub=payload.amount_rub,
        site_name=payload.site_name,
        receipt_photo_url=payload.receipt_photo_url,
        comment=payload.comment,
        reallocated_to_target=reallocated,
        source_driver_balance_rub=src_balance,
        target_driver_balance_rub=None,
        erp_crm_notified=True,
        created_at=tx.created_at or datetime.now(timezone.utc),
    )


@router.get("/monthly-reconciliation/{driver_id}")
async def get_driver_monthly_reconciliation(
    driver_id: str,
    month: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    drv = (await db.execute(select(Driver).where(Driver.id == driver_id))).scalar_one_or_none()
    if not drv:
        raise HTTPException(status_code=404, detail="Водитель не найден")
    enforce_branch_scope(current_user, drv.branch_id)

    now = date.today()
    if month and "-" in month:
        y_str, m_str = month.split("-")[:2]
        year, mon = int(y_str), int(m_str)
    else:
        year, mon = now.year, now.month

    card = (
        await db.execute(select(DriverCard).where(DriverCard.driver_id == driver_id, DriverCard.is_active.is_(True)))
    ).scalar_one_or_none()
    txs = (
        await db.execute(
            select(DriverCardTransaction).where(
                DriverCardTransaction.driver_id == driver_id,
                DriverCardTransaction.period_year == year,
                DriverCardTransaction.period_month == mon,
            )
        )
    ).scalars().all()
    logs = (
        await db.execute(
            select(FuelAuditLog).where(
                FuelAuditLog.driver_id == driver_id,
                FuelAuditLog.period_year == year,
                FuelAuditLog.period_month == mon,
            )
        )
    ).scalars().all()

    total_spent = sum((t.amount_rub for t in txs), Decimal("0.00"))
    reallocated_rub = sum((t.amount_rub for t in txs if t.reallocated_to_target), Decimal("0.00"))
    fuel_dev_rub = sum((l.deviation_rub for l in logs), Decimal("0.00"))
    limit_rub = card.monthly_limit_rub if card else Decimal("0.00")

    return {
        "driverId": drv.id,
        "branchId": drv.branch_id,
        "driverName": drv.name,
        "month": f"{year:04d}-{mon:02d}",
        "cardLast4": card.card_last4 if card else None,
        "monthlyLimitRub": float(limit_rub),
        "spentRub": float(total_spent),
        "remainingBalanceRub": float(limit_rub - total_spent),
        "reallocatedFuelRub": float(reallocated_rub),
        "fuelDeviationRub": float(fuel_dev_rub),
        "transactionsCount": len(txs),
        "auditAlertsCount": len(logs),
        "transactions": [
            {
                "id": str(t.id),
                "date": t.doc_date.isoformat(),
                "category": t.payment_category.value,
                "sourceEquipmentId": t.source_equipment_id,
                "targetEquipmentId": t.target_equipment_id,
                "liters": float(t.liters or 0),
                "amountRub": float(t.amount_rub),
                "reallocatedToTarget": t.reallocated_to_target,
                "siteName": t.site_name or "",
                "comment": t.comment or "",
            }
            for t in txs
        ],
    }
