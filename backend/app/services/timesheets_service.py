import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import SystemAdminConfigModel
from app.models.audit import AnomalyAlert, FuelAuditLog
from app.models.branch import BranchDocumentFlow
from app.models.crm import CRMDeal
from app.models.customer import Client
from app.models.driver import Driver, DriverCard, DriverCardTransaction
from app.models.enums import (
    AnomalyCategoryEnum,
    AnomalySeverityEnum,
    CRMStageEnum,
    EquipmentTypeEnum,
    OrderStatusEnum,
    PaymentCategoryEnum,
    ShiftStatusEnum,
)
from app.models.erp import RentalOrder
from app.models.fleet import Equipment
from app.models.forms import ShiftReport, Waybill
from app.schemas.timesheets import ShiftModerateRequest, ShiftReportCreate, ShiftReportResponse


def _parse_time_diff_hours(shift_start: Optional[str], work_start: Optional[str]) -> Decimal:
    if not shift_start or not work_start:
        return Decimal("0.00")
    try:
        sh_h, sh_m = map(int, shift_start.split(":"))
        wk_h, wk_m = map(int, work_start.split(":"))
        diff_min = (wk_h * 60 + wk_m) - (sh_h * 60 + sh_m)
        if diff_min > 0:
            return (Decimal(diff_min) / Decimal(60)).quantize(Decimal("0.01"))
    except (ValueError, TypeError):
        pass
    return Decimal("0.00")


def serialize_shift(shift: ShiftReport, equipment_name: str = "") -> ShiftReportResponse:
    return ShiftReportResponse(
        id=shift.id,
        branch_id=shift.branch_id,
        shift_number=shift.shift_number,
        date=shift.doc_date,
        equipment_id=shift.equipment_id,
        equipment_name=equipment_name,
        driver_id=shift.driver_id,
        operator_name=shift.operator_name,
        driver_phone=shift.driver_phone,
        card_last4=shift.card_last4,
        client_id=str(shift.client_id) if shift.client_id else None,
        client_name=shift.client_name,
        order_id=shift.order_id,
        deal_id=shift.deal_id,
        site_name=shift.site_name,
        shift_start_time=shift.shift_start_time,
        work_start_time=shift.work_start_time,
        work_end_time=shift.work_end_time,
        relocation_hours=shift.relocation_hours,
        start_hours=shift.start_hours,
        end_hours=shift.end_hours,
        work_hours=shift.work_hours,
        downtime_hours=shift.downtime_hours,
        downtime_reason=shift.downtime_reason,
        mileage_km=shift.mileage_km,
        trips_count=shift.trips_count,
        fuel_liters_added=shift.fuel_liters_added,
        fuel_hourly_calculated=shift.fuel_hourly_calculated,
        payment_category=shift.payment_category.value if shift.payment_category else None,
        payment_target_equipment_id=shift.payment_target_equipment_id,
        payment_amount_rub=shift.payment_amount_rub,
        subcontract_cost_rub=shift.subcontract_cost_rub,
        payment_comment=shift.payment_comment,
        chat_note=shift.chat_note,
        waybill_generated=shift.waybill_generated,
        waybill_number=shift.waybill_number,
        photo_verified=shift.photo_verified,
        status=shift.status.value,
        anomaly_message=shift.anomaly_message,
        calculated_salary=shift.calculated_salary,
        created_at=shift.created_at,
    )


async def submit_shift_report(db: AsyncSession, payload: ShiftReportCreate) -> ShiftReportResponse:
    # 1. Verify Equipment belongs to branch_id
    eq = (
        await db.execute(
            select(Equipment).where(
                Equipment.id == payload.equipment_id,
                Equipment.branch_id == payload.branch_id,
            )
        )
    ).scalar_one_or_none()
    if not eq:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Техника не найдена или не принадлежит указанному участку",
        )

    # 2. Enforce 5-link driver / card / client / order / deal branch isolation
    resolved_driver_id = payload.driver_id
    resolved_card: Optional[DriverCard] = None
    if resolved_driver_id:
        drv = (
            await db.execute(
                select(Driver).where(Driver.id == resolved_driver_id, Driver.branch_id == payload.branch_id)
            )
        ).scalar_one_or_none()
        if not drv:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Водитель не принадлежит указанному участку",
            )
        if payload.card_last4:
            resolved_card = (
                await db.execute(
                    select(DriverCard).where(
                        DriverCard.branch_id == payload.branch_id,
                        DriverCard.driver_id == resolved_driver_id,
                        DriverCard.card_last4 == payload.card_last4,
                    )
                )
            ).scalar_one_or_none()

    resolved_client_uuid: Optional[uuid.UUID] = None
    if payload.client_id:
        try:
            resolved_client_uuid = uuid.UUID(payload.client_id)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail="Некорректный UUID заказчика") from exc
        client_row = (
            await db.execute(
                select(Client).where(Client.id == resolved_client_uuid, Client.primary_branch_id == payload.branch_id)
            )
        ).scalar_one_or_none()
        if not client_row:
            raise HTTPException(status_code=422, detail="Заказчик не принадлежит указанному участку")

    if payload.order_id:
        order_row = (
            await db.execute(
                select(RentalOrder).where(RentalOrder.id == payload.order_id, RentalOrder.branch_id == payload.branch_id)
            )
        ).scalar_one_or_none()
        if not order_row:
            raise HTTPException(status_code=422, detail="Заказ-наряд не принадлежит указанному участку")

    if payload.deal_id:
        deal_row = (
            await db.execute(
                select(CRMDeal).where(CRMDeal.id == payload.deal_id, CRMDeal.branch_id == payload.branch_id)
            )
        ).scalar_one_or_none()
        if not deal_row:
            raise HTTPException(status_code=422, detail="Сделка CRM не принадлежит указанному участку")

    # 3. Block cross-branch fuel transfer
    target_eq: Optional[Equipment] = None
    if payload.payment_category == PaymentCategoryEnum.fuel_for_equipment and payload.payment_target_equipment_id:
        target_eq = (
            await db.execute(
                select(Equipment).where(
                    Equipment.id == payload.payment_target_equipment_id,
                    Equipment.branch_id == payload.branch_id,
                )
            )
        ).scalar_one_or_none()
        if not target_eq:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Межфилиальный перелив ГСМ невозможен: принимающая техника должна принадлежать тому же участку",
            )

    # 4. Calculate shift hours, relocation, salary, fuel rate
    work_hours = max(Decimal("0.00"), payload.end_hours - payload.start_hours)
    reloc = (
        payload.relocation_hours
        if payload.relocation_hours is not None and payload.relocation_hours > 0
        else _parse_time_diff_hours(payload.shift_start_time, payload.work_start_time)
    )
    hourly_wage = Decimal("700.00") if eq.equipment_type == EquipmentTypeEnum.crane else Decimal("550.00")
    calculated_salary = ((work_hours + reloc) * hourly_wage).quantize(Decimal("0.01"))
    fuel_hourly = (
        (payload.fuel_liters_added / work_hours).quantize(Decimal("0.01"))
        if work_hours > 0
        else Decimal("0.00")
    )

    # 5. Evaluate 5 non-blocking anomaly rules
    anomalies_found = []
    if payload.end_hours < payload.start_hours:
        anomalies_found.append("Конечные моточасы меньше начальных")
    if work_hours > Decimal("24"):
        anomalies_found.append(f"Аномальная продолжительность смены: {work_hours} ч (> 24 ч)")
    if (
        payload.payment_category != PaymentCategoryEnum.fuel_for_equipment
        and work_hours > 0
        and fuel_hourly > eq.fuel_rate_hour * Decimal("1.2")
    ):
        anomalies_found.append(
            f"Перерасход ГСМ (+20%): {fuel_hourly} л/ч при норме {eq.fuel_rate_hour} л/ч"
        )
    if payload.downtime_hours > Decimal("2") and not (payload.downtime_reason or "").strip():
        anomalies_found.append("Простой более 2 ч без указания причины")
    if payload.payment_category == PaymentCategoryEnum.fuel_for_equipment and not payload.payment_target_equipment_id:
        anomalies_found.append("Выбран перелив ГСМ для техники парка, но не указана принимающая машина")

    shift_status = ShiftStatusEnum.anomaly if anomalies_found else ShiftStatusEnum.pending
    anomaly_message = "; ".join(anomalies_found) if anomalies_found else None

    # 6. Resolve prefixes for shift_number & waybill_number
    df = (
        await db.execute(select(BranchDocumentFlow).where(BranchDocumentFlow.branch_id == payload.branch_id))
    ).scalar_one_or_none()
    shift_prefix = df.shift_prefix if df else "SH-"
    waybill_prefix = df.waybill_prefix if df else "ПЛ-"

    existing_count = (
        await db.execute(select(func.count()).select_from(ShiftReport).where(ShiftReport.branch_id == payload.branch_id))
    ).scalar_one()
    seq = existing_count + 1
    shift_id = f"sh-{uuid.uuid4().hex[:10]}"
    shift_number = f"{shift_prefix}{seq:03d}"
    waybill_number = payload.waybill_number or (f"{waybill_prefix}{seq:03d}" if payload.waybill_generated else None)

    shift_row = ShiftReport(
        id=shift_id,
        branch_id=payload.branch_id,
        order_id=payload.order_id,
        deal_id=payload.deal_id,
        client_id=resolved_client_uuid,
        client_name=payload.client_name,
        equipment_id=payload.equipment_id,
        driver_id=resolved_driver_id,
        card_id=resolved_card.id if resolved_card else None,
        card_last4=payload.card_last4,
        shift_number=shift_number,
        doc_date=payload.date,
        operator_name=payload.operator_name,
        driver_phone=payload.driver_phone,
        site_name=payload.site_name,
        shift_start_time=payload.shift_start_time,
        work_start_time=payload.work_start_time,
        work_end_time=payload.work_end_time,
        relocation_hours=reloc,
        start_hours=payload.start_hours,
        end_hours=payload.end_hours,
        work_hours=work_hours,
        downtime_hours=payload.downtime_hours,
        downtime_reason=payload.downtime_reason,
        mileage_km=payload.mileage_km,
        trips_count=payload.trips_count,
        fuel_liters_added=payload.fuel_liters_added,
        fuel_hourly_calculated=fuel_hourly,
        payment_category=PaymentCategoryEnum(payload.payment_category.value) if payload.payment_category else None,
        payment_target_equipment_id=payload.payment_target_equipment_id,
        payment_amount_rub=payload.payment_amount_rub,
        subcontract_cost_rub=payload.subcontract_cost_rub,
        payment_comment=payload.payment_comment,
        chat_note=payload.chat_note,
        waybill_generated=payload.waybill_generated,
        waybill_number=waybill_number,
        photo_verified=payload.photo_verified,
        status=shift_status,
        anomaly_message=anomaly_message,
        calculated_salary=calculated_salary,
    )
    db.add(shift_row)
    await db.flush()

    # 7. Update equipment economics (1:1 with App.tsx:handleCreateShift)
    expense_rub = (
        payload.payment_amount_rub
        if payload.payment_amount_rub is not None
        else (payload.fuel_liters_added * Decimal("65.00")).quantize(Decimal("0.01"))
    )
    eq.current_hours += work_hours
    eq.month_hours += work_hours
    eq.revenue_month += (work_hours * eq.hourly_rate).quantize(Decimal("0.01"))
    eq.mileage_km_month = (eq.mileage_km_month or Decimal("0.0")) + (payload.mileage_km or Decimal("0.0"))
    eq.next_maintenance_in_hours = max(Decimal("0.0"), eq.next_maintenance_in_hours - work_hours)
    eq.driver_salary_month += calculated_salary
    eq.subcontract_cost_month += payload.subcontract_cost_rub or Decimal("0.00")
    if eq.equipment_type == EquipmentTypeEnum.dump_truck:
        eq.trips_month = (eq.trips_month or 0) + (payload.trips_count or 0)

    is_transferred = target_eq is not None
    if is_transferred and target_eq is not None:
        target_eq.fuel_cost_month += expense_rub
    elif payload.payment_category is None or payload.payment_category.value == "fuel_own_tank":
        eq.fuel_cost_month += expense_rub
    elif payload.payment_category.value == "parts":
        eq.repair_cost_month += expense_rub
    elif payload.payment_category.value == "other":
        eq.overheads_allocated += expense_rub

    # 8. Create driver card transaction if driver + card expense exists
    if resolved_driver_id and (expense_rub > 0 or payload.card_last4):
        db.add(
            DriverCardTransaction(
                branch_id=payload.branch_id,
                card_id=resolved_card.id if resolved_card else None,
                driver_id=resolved_driver_id,
                source_equipment_id=payload.equipment_id,
                target_equipment_id=target_eq.id if target_eq else None,
                shift_report_id=shift_row.id,
                client_id=resolved_client_uuid,
                order_id=payload.order_id,
                deal_id=payload.deal_id,
                doc_date=payload.date,
                payment_category=PaymentCategoryEnum(
                    payload.payment_category.value if payload.payment_category else "fuel_own_tank"
                ),
                liters=payload.fuel_liters_added,
                amount_rub=expense_rub,
                reallocated_to_target=is_transferred,
                site_name=payload.site_name,
                comment=payload.payment_comment or f"Смена {shift_number}",
            )
        )

    # 9. Create waybill if requested
    if payload.waybill_generated and waybill_number:
        db.add(
            Waybill(
                branch_id=payload.branch_id,
                shift_report_id=shift_row.id,
                equipment_id=payload.equipment_id,
                driver_id=resolved_driver_id,
                waybill_number=waybill_number,
                doc_date=payload.date,
                fuel_refueled_l=payload.fuel_liters_added,
            )
        )

    # 10. Non-blocking anomaly alert + fuel audit log
    if anomalies_found:
        db.add(
            AnomalyAlert(
                id=f"ano-{uuid.uuid4().hex[:10]}",
                branch_id=payload.branch_id,
                equipment_id=payload.equipment_id,
                shift_report_id=shift_row.id,
                severity=AnomalySeverityEnum.critical,
                category=AnomalyCategoryEnum.shift,
                title=f"Отклонение в смене {shift_number}",
                description=anomaly_message or "Отклонение в сменном рапорте",
                equipment_name=f"[{eq.inventory_number}] {eq.name}",
                doc_date=payload.date,
                impact_rubles=Decimal("15000.00"),
                resolved=False,
            )
        )
        norm_liters = (work_hours * eq.fuel_rate_hour).quantize(Decimal("0.01"))
        db.add(
            FuelAuditLog(
                branch_id=payload.branch_id,
                equipment_id=payload.equipment_id,
                shift_report_id=shift_row.id,
                driver_id=resolved_driver_id,
                doc_date=payload.date,
                norm_liters=norm_liters,
                fact_liters=payload.fuel_liters_added,
                deviation_rub=max(Decimal("0.00"), (payload.fuel_liters_added - norm_liters) * Decimal("65.00")),
                driver_notified=True,
                driver_reported=False,
            )
        )

    await db.commit()
    await db.refresh(shift_row)
    return serialize_shift(shift_row, equipment_name=eq.name)


async def approve_shift_report(db: AsyncSession, shift_id: str) -> ShiftReportResponse:
    shift = (await db.execute(select(ShiftReport).where(ShiftReport.id == shift_id))).scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Сменный рапорт не найден")

    admin_cfg = (
        await db.execute(select(SystemAdminConfigModel).where(SystemAdminConfigModel.id == 1))
    ).scalar_one_or_none()
    if not admin_cfg or not admin_cfg.admin_confirmation_allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Подтверждение смен заблокировано: включите флаг 'Админ: Разрешение подтверждений'",
        )

    active_deals_cnt = (
        await db.execute(
            select(func.count()).select_from(CRMDeal).where(
                CRMDeal.branch_id == shift.branch_id,
                CRMDeal.stage == CRMStageEnum.active,
            )
        )
    ).scalar_one()
    active_orders_cnt = (
        await db.execute(
            select(func.count()).select_from(RentalOrder).where(
                RentalOrder.branch_id == shift.branch_id,
                RentalOrder.status == OrderStatusEnum.active,
            )
        )
    ).scalar_one()
    if (active_deals_cnt + active_orders_cnt) == 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="На участке нет активной заявки CRM или активного заказа-наряда",
        )

    shift.status = ShiftStatusEnum.approved
    eq = (await db.execute(select(Equipment).where(Equipment.id == shift.equipment_id))).scalar_one_or_none()
    await db.commit()
    await db.refresh(shift)
    return serialize_shift(shift, equipment_name=eq.name if eq else "")


async def moderate_shift_report(
    db: AsyncSession, shift_id: str, payload: ShiftModerateRequest
) -> ShiftReportResponse:
    shift = (await db.execute(select(ShiftReport).where(ShiftReport.id == shift_id))).scalar_one_or_none()
    if not shift:
        raise HTTPException(status_code=404, detail="Сменный рапорт не найден")

    eq = (await db.execute(select(Equipment).where(Equipment.id == shift.equipment_id))).scalar_one_or_none()
    if payload.work_hours is not None and eq:
        delta_h = payload.work_hours - shift.work_hours
        shift.work_hours = payload.work_hours
        eq.current_hours += delta_h
        eq.month_hours += delta_h
        eq.revenue_month += (delta_h * eq.hourly_rate).quantize(Decimal("0.01"))
        eq.next_maintenance_in_hours = max(Decimal("0.0"), eq.next_maintenance_in_hours - delta_h)
        if shift.work_hours > 0:
            shift.fuel_hourly_calculated = (shift.fuel_liters_added / shift.work_hours).quantize(Decimal("0.01"))

    if payload.operator_name is not None:
        shift.operator_name = payload.operator_name
    if payload.downtime_hours is not None:
        shift.downtime_hours = payload.downtime_hours
    if payload.fuel_liters_added is not None:
        shift.fuel_liters_added = payload.fuel_liters_added
        if shift.work_hours > 0:
            shift.fuel_hourly_calculated = (shift.fuel_liters_added / shift.work_hours).quantize(Decimal("0.01"))
    if payload.calculated_salary is not None:
        if eq:
            eq.driver_salary_month += payload.calculated_salary - shift.calculated_salary
        shift.calculated_salary = payload.calculated_salary
    if payload.status is not None:
        shift.status = ShiftStatusEnum(payload.status.value)
    if payload.anomaly_message is not None:
        shift.anomaly_message = payload.anomaly_message
    if payload.chat_note is not None:
        shift.chat_note = payload.chat_note

    await db.commit()
    await db.refresh(shift)
    return serialize_shift(shift, equipment_name=eq.name if eq else "")
