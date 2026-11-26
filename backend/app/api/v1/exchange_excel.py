import io
import uuid
from datetime import date
from decimal import Decimal
from typing import Literal, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from openpyxl import Workbook, load_workbook
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import User
from app.models.crm import CRMDeal
from app.models.enums import (
    AccountingSubjectEnum,
    ClientTypeEnum,
    EquipmentStatusEnum,
    EquipmentTypeEnum,
    OrderStatusEnum,
)
from app.models.erp import RentalOrder
from app.models.fleet import Equipment
from app.models.forms import ShiftReport
from app.services.analytics_service import build_consolidated_summary, serialize_equipment
from app.services.serializers import build_driver_profiles

router = APIRouter(prefix="/exchange/excel", tags=["Excel (.xlsx) Exchange"])


@router.get("/export")
async def export_excel(
    scope: Literal["all", "fleet", "shifts", "orders", "branches_summary", "timesheet_t13"] = Query(default="all"),
    branch_id: Optional[str] = Query(default=None),
    period_label: str = Query(default="Текущий месяц"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    wb = Workbook()
    default_ws = wb.active

    if scope == "branches_summary":
        summary = await build_consolidated_summary(db, period_label=period_label)
        ws1 = default_ws
        ws1.title = "Прибыли по участкам"
        ws1.append(["Код", "Участок", "Техники", "В аренде", "Часы", "Выручка, ₽", "Валовая прибыль, ₽", "Опер. прибыль, ₽", "Маржа %"])
        for row in summary.branch_rows:
            ws1.append([
                row.branch_code,
                row.branch_name,
                row.equipment_count,
                row.rented_count,
                float(row.hours),
                float(row.revenue),
                float(row.gross_profit),
                float(row.operating_profit),
                row.operating_margin_pct,
            ])

        ws2 = wb.create_sheet("Расходы по филиалам")
        ws2.append(["Код", "Участок", "ГСМ, ₽", "ФОТ машинистов, ₽", "Ремонт, ₽", "Трал, ₽", "Субподряд, ₽", "Постоянные, ₽", "Накладные, ₽", "Всего расходов, ₽"])
        for row in summary.branch_rows:
            ws2.append([
                row.branch_code,
                row.branch_name,
                float(row.fuel_cost),
                float(row.salary_cost),
                float(row.repair_cost),
                float(row.transport_cost),
                float(row.subcontract_cost),
                float(row.fixed_overheads_total),
                float(row.equipment_overheads),
                float(row.total_expenses),
            ])

        ws3 = wb.create_sheet("Сводный расчёт")
        ws3.append(["Показатель", "Значение"])
        ws3.append(["Период", summary.period_label])
        ws3.append(["Единиц техники", summary.totals.equipment_count])
        ws3.append(["Отработано часов", float(summary.totals.hours)])
        ws3.append(["Общая выручка, ₽", float(summary.totals.revenue)])
        ws3.append(["Прямые расходы, ₽", float(summary.totals.direct_costs)])
        ws3.append(["Постоянные расходы, ₽", float(summary.totals.fixed_overheads_total)])
        ws3.append(["Операционная прибыль, ₽", float(summary.totals.operating_profit)])

        buf = io.BytesIO()
        wb.save(buf)
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": 'attachment; filename="branches_summary.xlsx"'},
        )

    if not branch_id or branch_id == "all":
        raise HTTPException(
            status_code=400,
            detail="Операционная выгрузка Excel разрешена строго по одному конкретному branch_id (режим 'all' запрещён)",
        )
    scoped = enforce_branch_scope(current_user, branch_id)

    first_sheet_used = False

    def next_sheet(title: str):
        nonlocal first_sheet_used
        if not first_sheet_used:
            first_sheet_used = True
            default_ws.title = title
            return default_ws
        return wb.create_sheet(title)

    if scope in ("all", "fleet"):
        ws = next_sheet("Парк техники")
        ws.append(["Инв. №", "Наименование", "Тип", "Гос. номер", "Статус", "Объект", "Часы мес.", "Выручка, ₽", "Прибыль, ₽"])
        eqs = (await db.execute(select(Equipment).where(Equipment.branch_id == scoped))).scalars().all()
        for eq in eqs:
            dto = serialize_equipment(eq)
            ws.append([
                eq.inventory_number,
                eq.name,
                eq.equipment_type.value,
                eq.plate_number,
                eq.status.value,
                eq.assigned_site or "",
                float(eq.month_hours),
                float(eq.revenue_month),
                float(dto.operating_profit_month),
            ])

    if scope in ("all", "shifts"):
        ws = next_sheet("Смены ЭСМ-7")
        ws.append(["№ смены", "Дата", "Техника ID", "Машинист", "Объект", "Нач. м/ч", "Кон. м/ч", "Часы", "ГСМ, л", "ЗП, ₽", "Статус"])
        shifts = (await db.execute(select(ShiftReport).where(ShiftReport.branch_id == scoped))).scalars().all()
        for s in shifts:
            ws.append([
                s.shift_number,
                s.doc_date.isoformat(),
                s.equipment_id,
                s.operator_name,
                s.site_name,
                float(s.start_hours),
                float(s.end_hours),
                float(s.work_hours),
                float(s.fuel_liters_added),
                float(s.calculated_salary),
                s.status.value,
            ])

    if scope in ("all", "orders"):
        ws = next_sheet("Заказы-наряды")
        ws.append(["№ заказа", "Заказчик", "Техника ID", "Объект", "Начало", "Окончание", "План ч", "Факт ч", "Сумма, ₽", "Акт подписан", "Статус"])
        orders = (await db.execute(select(RentalOrder).where(RentalOrder.branch_id == scoped))).scalars().all()
        for o in orders:
            ws.append([
                o.order_number,
                o.client_name,
                o.equipment_id,
                o.site_address,
                o.doc_date.isoformat(),
                o.end_date.isoformat(),
                o.planned_hours,
                float(o.actual_hours),
                float(o.total_amount),
                "Да" if o.act_signed else "Нет",
                o.status.value,
            ])

    if scope == "timesheet_t13":
        ws = next_sheet("Табель Т-13")
        ws.append(["ID", "ФИО машиниста", "Телефон", "Карта *", "Смена", "Нужна замена", "Коды дней"])
        drivers, _ = await build_driver_profiles(db, scoped)
        for d in drivers:
            days_str = ", ".join(f"{k}:{v.value}" for k, v in sorted(d.timesheet_days.items()))
            ws.append([
                d.id,
                d.name,
                d.phone,
                d.card_last4 or "",
                d.shift_roster.value,
                "Да" if d.needs_replacement else "Нет",
                days_str,
            ])

    buf = io.BytesIO()
    wb.save(buf)
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="exchange_{scoped}_{scope}.xlsx"'},
    )


@router.post("/import")
async def import_excel(
    file: UploadFile = File(...),
    mode: Literal["merge", "replace"] = Form("merge"),
    branch_id: str = Form(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not branch_id or branch_id == "all":
        raise HTTPException(
            status_code=400,
            detail="Импорт Excel разрешён строго в конкретный участок branch_id (значение 'all' запрещено)",
        )
    enforce_branch_scope(current_user, branch_id)

    raw = await file.read()
    try:
        wb = load_workbook(filename=io.BytesIO(raw), data_only=True)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Некорректный формат файла .xlsx") from exc

    if mode == "replace":
        # Strictly scoped to target branch_id
        await db.execute(delete(ShiftReport).where(ShiftReport.branch_id == branch_id))
        await db.execute(delete(RentalOrder).where(RentalOrder.branch_id == branch_id))
        await db.execute(delete(CRMDeal).where(CRMDeal.branch_id == branch_id))
        await db.execute(delete(Equipment).where(Equipment.branch_id == branch_id))
        await db.flush()

    imported_units = 0
    imported_shifts = 0
    imported_orders = 0

    if "Парк техники" in wb.sheetnames:
        ws = wb["Парк техники"]
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not row[0]:
                continue
            inv = str(row[0]).strip()
            name = str(row[1] or inv)
            eq_type_raw = str(row[2] or "excavator")
            eq_type = (
                EquipmentTypeEnum(eq_type_raw)
                if eq_type_raw in {e.value for e in EquipmentTypeEnum}
                else EquipmentTypeEnum.excavator
            )
            plate = str(row[3] or "Б/Н")
            st_raw = str(row[4] or "available")
            st = EquipmentStatusEnum(st_raw) if st_raw in {s.value for s in EquipmentStatusEnum} else EquipmentStatusEnum.available
            site = str(row[5]) if len(row) > 5 and row[5] else None
            hours = Decimal(str(row[6] or 0)) if len(row) > 6 else Decimal("0.0")

            existing_eq = (
                await db.execute(
                    select(Equipment).where(Equipment.branch_id == branch_id, Equipment.inventory_number == inv)
                )
            ).scalar_one_or_none()
            if existing_eq:
                existing_eq.name = name
                existing_eq.status = st
                existing_eq.assigned_site = site
                existing_eq.month_hours = hours
            else:
                db.add(
                    Equipment(
                        id=f"eq-{uuid.uuid4().hex[:10]}",
                        branch_id=branch_id,
                        inventory_number=inv,
                        name=name,
                        equipment_type=eq_type,
                        brand=name.split()[0],
                        plate_number=plate,
                        vin=f"VIN-{uuid.uuid4().hex[:12].upper()}",
                        year=2023,
                        owner="ООО «SpecialTech»",
                        status=st,
                        assigned_site=site,
                        month_hours=hours,
                    )
                )
            imported_units += 1

    if "Заказы-наряды" in wb.sheetnames:
        ws = wb["Заказы-наряды"]
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or not row[0]:
                continue
            order_num = str(row[0]).strip()
            client_name = str(row[1] or "Контрагент")
            eq_id = str(row[2] or "")
            site = str(row[3] or "Объект")
            existing_order = (
                await db.execute(
                    select(RentalOrder).where(
                        RentalOrder.branch_id == branch_id, RentalOrder.order_number == order_num
                    )
                )
            ).scalar_one_or_none()
            if existing_order:
                existing_order.client_name = client_name
                existing_order.site_address = site
            else:
                db.add(
                    RentalOrder(
                        id=f"ro-{uuid.uuid4().hex[:10]}",
                        branch_id=branch_id,
                        equipment_id=eq_id or f"eq-{uuid.uuid4().hex[:6]}",
                        order_number=order_num,
                        client_name=client_name,
                        client_type=ClientTypeEnum.legal_entity,
                        accounting_subject=AccountingSubjectEnum.ooo_specialtech,
                        operator_name="Машинист",
                        site_address=site,
                        doc_date=date.today(),
                        end_date=date.today(),
                        planned_hours=int(row[6] or 8) if len(row) > 6 and row[6] else 8,
                        status=OrderStatusEnum.active,
                    )
                )
            imported_orders += 1

    await db.commit()
    return {
        "success": True,
        "branchId": branch_id,
        "importedUnits": imported_units,
        "importedShifts": imported_shifts,
        "importedOrders": imported_orders,
        "mode": mode,
    }
