from datetime import date as dt_date
from decimal import Decimal
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import User
from app.models.branch import Branch
from app.models.crm import CRMDeal
from app.models.customer import Client
from app.models.enums import EquipmentTypeEnum
from app.models.erp import Contract, RentalOrder
from app.models.fleet import Equipment
from app.models.forms import ShiftReport
from app.schemas.base import AccountingSubjectId, BranchOverheadCategory
from app.schemas.crm_erp import BranchCustomerRowResponse, ConsolidatedBranchSummary
from app.services.analytics_service import build_consolidated_summary, serialize_equipment

router = APIRouter(prefix="/analytics", tags=["Analytics & Executive Dashboards"])


def _period_multiplier(mode: str, selected_month: Optional[str]) -> int:
    if mode == "month" and selected_month == "all":
        return 12
    return 1


@router.get("/equipment-ranking")
async def get_equipment_ranking(
    branch_id: Optional[str] = Query(default="all"),
    mode: str = Query(default="month"),
    selected_date: Optional[dt_date] = Query(default=None),
    selected_year: Optional[int] = Query(default=None),
    selected_month: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(Equipment)
    if scoped and scoped != "all":
        stmt = stmt.where(Equipment.branch_id == scoped)
    equipments = (await db.execute(stmt)).scalars().all()

    shift_by_eq: Dict[str, List[ShiftReport]] = {}
    if mode == "date" and selected_date:
        sh_stmt = select(ShiftReport).where(ShiftReport.doc_date == selected_date)
        if scoped and scoped != "all":
            sh_stmt = sh_stmt.where(ShiftReport.branch_id == scoped)
        for sh in (await db.execute(sh_stmt)).scalars().all():
            shift_by_eq.setdefault(sh.equipment_id, []).append(sh)

    mult = Decimal(_period_multiplier(mode, selected_month))
    main_equipment = []
    dump_trucks = []

    for eq in equipments:
        dto = serialize_equipment(eq)
        if mode == "date" and selected_date:
            day_shifts = shift_by_eq.get(eq.id, [])
            hours = sum((s.work_hours for s in day_shifts), Decimal("0.0"))
            mileage_km = sum((s.mileage_km or Decimal("0.0") for s in day_shifts), Decimal("0.0"))
            trips_count = sum((s.trips_count or 0 for s in day_shifts))
            revenue = (hours * eq.hourly_rate).quantize(Decimal("0.01"))
            expenses = (
                sum((s.calculated_salary + (s.payment_amount_rub or s.fuel_liters_added * Decimal("65")) for s in day_shifts), Decimal("0.00"))
                + (eq.overheads_allocated / Decimal("30")).quantize(Decimal("0.01"))
            )
            profit = revenue - expenses
        else:
            hours = (eq.month_hours * mult).quantize(Decimal("0.1"))
            mileage_km = ((eq.mileage_km_month or Decimal("0.0")) * mult).quantize(Decimal("0.1"))
            trips_count = (eq.trips_month or 0) * int(mult)
            revenue = (eq.revenue_month * mult).quantize(Decimal("0.01"))
            expenses = ((dto.direct_costs_month + eq.overheads_allocated) * mult).quantize(Decimal("0.01"))
            profit = revenue - expenses

        margin = float((profit / revenue * Decimal("100")).quantize(Decimal("0.1"))) if revenue > 0 else 0.0
        row = {
            "equipment": dto.model_dump(by_alias=True),
            "hours": float(hours),
            "mileage_km": float(mileage_km),
            "trips_count": trips_count,
            "revenue": float(revenue),
            "expenses": float(expenses),
            "profit": float(profit),
            "margin": margin,
        }
        if eq.equipment_type == EquipmentTypeEnum.dump_truck:
            dump_trucks.append(row)
        else:
            main_equipment.append(row)

    main_equipment.sort(key=lambda r: r["profit"], reverse=True)
    dump_trucks.sort(key=lambda r: r["profit"], reverse=True)
    return {"main_equipment": main_equipment, "dump_trucks": dump_trucks}


@router.get("/direct-costs")
async def get_direct_costs(
    branch_id: Optional[str] = Query(default="all"),
    mode: str = Query(default="month"),
    selected_date: Optional[dt_date] = Query(default=None),
    selected_year: Optional[int] = Query(default=None),
    selected_month: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(Equipment)
    if scoped and scoped != "all":
        stmt = stmt.where(Equipment.branch_id == scoped)
    equipments = (await db.execute(stmt)).scalars().all()
    mult = Decimal("0.0333") if mode == "date" else Decimal(_period_multiplier(mode, selected_month))

    fuel = sum((e.fuel_cost_month for e in equipments), Decimal("0.00")) * mult
    salary = sum((e.driver_salary_month for e in equipments), Decimal("0.00")) * mult
    repair = sum((e.repair_cost_month for e in equipments), Decimal("0.00")) * mult
    transport = sum((e.transport_cost_month for e in equipments), Decimal("0.00")) * mult
    subcontract = sum((e.subcontract_cost_month for e in equipments), Decimal("0.00")) * mult
    total = fuel + salary + repair + transport + subcontract
    total_hours = sum((e.month_hours for e in equipments), Decimal("0.0")) * mult
    avg_cost = (total / total_hours).quantize(Decimal("0.01")) if total_hours > 0 else Decimal("0.00")
    return {
        "fuel_cost": float(fuel.quantize(Decimal("0.01"))),
        "salary_cost": float(salary.quantize(Decimal("0.01"))),
        "repair_cost": float(repair.quantize(Decimal("0.01"))),
        "transport_cost": float(transport.quantize(Decimal("0.01"))),
        "subcontract_cost": float(subcontract.quantize(Decimal("0.01"))),
        "total_direct_costs": float(total.quantize(Decimal("0.01"))),
        "total_hours": float(total_hours.quantize(Decimal("0.1"))),
        "avg_cost_per_hour": float(avg_cost),
    }


@router.get("/fixed-overheads")
async def get_fixed_overheads(
    branch_id: Optional[str] = Query(default="all"),
    mode: str = Query(default="month"),
    selected_year: Optional[int] = Query(default=None),
    selected_month: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(Branch)
    if scoped and scoped != "all":
        stmt = stmt.where(Branch.id == scoped)
    branches = (await db.execute(stmt)).scalars().all()
    mult = Decimal(_period_multiplier(mode, selected_month))
    by_category: Dict[str, float] = {c.value: 0.0 for c in BranchOverheadCategory}
    items = []
    total = Decimal("0.00")

    for b in branches:
        for ovh in b.fixed_overheads or []:
            if ovh.hidden:
                continue
            amt = (ovh.monthly_amount_rub * mult).quantize(Decimal("0.01"))
            by_category[ovh.category.value] = round(by_category[ovh.category.value] + float(amt), 2)
            total += amt
            items.append(
                {
                    "id": ovh.id,
                    "branchId": b.id,
                    "category": ovh.category.value,
                    "name": ovh.name,
                    "amountRub": float(amt),
                }
            )
    return {"total": float(total), "by_category": by_category, "items": items}


@router.get("/branches-consolidated", response_model=ConsolidatedBranchSummary)
async def get_branches_consolidated(
    mode: str = Query(default="month"),
    selected_date: Optional[dt_date] = Query(default=None),
    selected_year: Optional[int] = Query(default=None),
    selected_month: Optional[str] = Query(default=None),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConsolidatedBranchSummary:
    mult = _period_multiplier(mode, selected_month)
    label = f"Год {selected_year or 2026}" if mult == 12 else f"{selected_year or 2026}-{selected_month or '11'}"
    return await build_consolidated_summary(db, period_label=label, months_multiplier=mult)


@router.get("/customers", response_model=List[BranchCustomerRowResponse])
async def get_branch_customers_catalog(
    branch_id: str = Query(...),
    period_mode: str = Query(default="all"),
    date: Optional[dt_date] = Query(default=None),
    month: Optional[str] = Query(default=None),
    year: Optional[int] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[BranchCustomerRowResponse]:
    if not branch_id or branch_id == "all":
        raise HTTPException(status_code=400, detail="Для каталога заказчиков необходимо указать конкретный branch_id")
    enforce_branch_scope(current_user, branch_id)

    clients = (await db.execute(select(Client).where(Client.primary_branch_id == branch_id))).scalars().all()
    deals = (await db.execute(select(CRMDeal).where(CRMDeal.branch_id == branch_id))).scalars().all()
    orders = (await db.execute(select(RentalOrder).where(RentalOrder.branch_id == branch_id))).scalars().all()
    contracts = (await db.execute(select(Contract).where(Contract.branch_id == branch_id))).scalars().all()

    if period_mode == "date" and date:
        deals = [d for d in deals if d.doc_date == date]
        orders = [o for o in orders if o.doc_date <= date <= o.end_date]
    elif period_mode == "month" and month and year:
        m_int = int(month)
        deals = [d for d in deals if d.period_year == year and d.period_month == m_int]
        orders = [o for o in orders if o.period_year == year and o.period_month == m_int]
    elif period_mode == "year" and year:
        deals = [d for d in deals if d.period_year == year]
        orders = [o for o in orders if o.period_year == year]

    client_map: Dict[str, Client] = {c.name: c for c in clients}
    all_names = sorted(
        set(client_map.keys()) | {d.client_name for d in deals} | {o.client_name for o in orders}
    )

    rows: List[BranchCustomerRowResponse] = []
    for name in all_names:
        c = client_map.get(name)
        c_deals = [d for d in deals if d.client_name == name]
        c_orders = [o for o in orders if o.client_name == name]
        c_contracts = [ct for ct in contracts if ct.counterparty == name]
        sites = sorted({d.site_address for d in c_deals if d.site_address} | {o.site_address for o in c_orders if o.site_address})
        hours_total = sum((d.closed_shift_hours_total or Decimal("0.0") for d in c_deals), Decimal("0.0")) + sum(
            (o.actual_hours or Decimal("0.0") for o in c_orders), Decimal("0.0")
        )
        turnover = sum((d.estimated_amount for d in c_deals), Decimal("0.00")) + sum(
            (o.total_amount for o in c_orders), Decimal("0.00")
        )
        paid = sum((d.paid_amount for d in c_deals), Decimal("0.00")) + sum(
            (o.paid_amount for o in c_orders), Decimal("0.00")
        )
        debt = max(Decimal("0.00"), turnover - paid)
        last_ct = c_contracts[-1] if c_contracts else None
        is_active = any(d.stage.value == "active" for d in c_deals) or any(o.status.value == "active" for o in c_orders)

        rows.append(
            BranchCustomerRowResponse(
                client_name=name,
                full_name=(c.full_name if c and c.full_name else name),
                is_regular_max=bool(c.is_regular_max) if c else False,
                opf=(c.opf if c and c.opf else "ООО"),
                inn=(c.inn if c and c.inn else ""),
                kpp=(c.kpp if c and c.kpp else ""),
                ogrn=(c.ogrn if c and c.ogrn else ""),
                legal_address=(c.legal_address if c and c.legal_address else ""),
                director=(c.director if c and c.director else ""),
                bank_name=(c.bank_name if c and c.bank_name else ""),
                bik=(c.bik if c and c.bik else ""),
                checking_account=(c.checking_account if c and c.checking_account else ""),
                corr_account=(c.corr_account if c and c.corr_account else ""),
                email=(c.email if c and c.email else ""),
                site_address=sites[0] if sites else "",
                all_sites=sites,
                contact_person=(c_deals[-1].contact_person if c_deals else (c.director if c and c.director else "")),
                phone=(c_deals[-1].phone if c_deals else (c.phone if c and c.phone else "")),
                has_contract=bool(c_contracts) or any(d.has_contract for d in c_deals),
                deals_count=len(c_deals),
                orders_count=len(c_orders),
                total_hours_worked=hours_total,
                last_contract_number=last_ct.number if last_ct else "",
                last_contract_caption=last_ct.title if last_ct else "Без договора / оферта",
                latest_order_number=c_orders[-1].order_number if c_orders else None,
                latest_deal_id=c_deals[-1].id if c_deals else None,
                is_active=is_active,
                status_detail="В работе" if is_active else ("Задолженность" if debt > 0 else "Расчёты закрыты"),
                turnover_rub=turnover,
                paid_rub=paid,
                debt_rub=debt,
                subject_id=(
                    AccountingSubjectId(c_deals[-1].accounting_subject.value)
                    if c_deals
                    else AccountingSubjectId.OOO_SPECIALTECH
                ),
                manager_name=c_deals[-1].manager if c_deals else "Орлов П. С.",
            )
        )
    return rows
