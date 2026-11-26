from decimal import Decimal
from typing import Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.branch import Branch
from app.models.enums import EquipmentStatusEnum, EquipmentTypeEnum
from app.models.fleet import Equipment
from app.schemas.base import BranchOverheadCategory
from app.schemas.crm_erp import BranchPeriodFinancials, ConsolidatedBranchSummary
from app.schemas.fleet import EquipmentResponse


def serialize_equipment(eq: Equipment) -> EquipmentResponse:
    direct = (
        eq.fuel_cost_month
        + eq.driver_salary_month
        + eq.repair_cost_month
        + eq.transport_cost_month
        + eq.subcontract_cost_month
    )
    profit = eq.revenue_month - direct - eq.overheads_allocated
    margin = float((profit / eq.revenue_month * Decimal("100")).quantize(Decimal("0.1"))) if eq.revenue_month > 0 else 0.0
    return EquipmentResponse(
        id=eq.id,
        branch_id=eq.branch_id,
        inventory_number=eq.inventory_number,
        name=eq.name,
        type=eq.equipment_type.value,
        brand=eq.brand,
        plate_number=eq.plate_number,
        vin=eq.vin,
        year=eq.year,
        owner=eq.owner,
        purchase_price=eq.purchase_price,
        current_value=eq.current_value,
        hourly_rate=eq.hourly_rate,
        fuel_rate_hour=eq.fuel_rate_hour,
        specs=eq.specs or {},
        notes=eq.notes,
        status=eq.status.value,
        assigned_site=eq.assigned_site,
        assigned_operator=eq.assigned_operator,
        current_hours=eq.current_hours,
        month_hours=eq.month_hours,
        mileage_km_month=eq.mileage_km_month,
        trips_month=eq.trips_month,
        revenue_month=eq.revenue_month,
        fuel_cost_month=eq.fuel_cost_month,
        driver_salary_month=eq.driver_salary_month,
        repair_cost_month=eq.repair_cost_month,
        transport_cost_month=eq.transport_cost_month,
        subcontract_cost_month=eq.subcontract_cost_month,
        overheads_allocated=eq.overheads_allocated,
        direct_costs_month=direct,
        operating_profit_month=profit,
        margin_percent=margin,
        downtime_hours_month=eq.downtime_hours_month,
        next_maintenance_in_hours=eq.next_maintenance_in_hours,
        created_at=eq.created_at,
    )


async def build_consolidated_summary(
    db: AsyncSession,
    period_label: str = "Текущий месяц",
    months_multiplier: int = 1,
) -> ConsolidatedBranchSummary:
    branches = (await db.execute(select(Branch))).scalars().all()
    equipments = (await db.execute(select(Equipment))).scalars().all()

    eq_by_branch: Dict[str, List[Equipment]] = {}
    for eq in equipments:
        eq_by_branch.setdefault(eq.branch_id, []).append(eq)

    mult = Decimal(max(1, months_multiplier))
    rows: List[BranchPeriodFinancials] = []
    total_revenue_all = Decimal("0.00")
    total_op_profit_all = Decimal("0.00")

    for br in branches:
        br_eq = eq_by_branch.get(br.id, [])
        eq_cnt = len(br_eq)
        rented_cnt = sum(1 for e in br_eq if e.status == EquipmentStatusEnum.rented)
        hours = sum((e.month_hours for e in br_eq), Decimal("0.0")) * mult
        downtime = sum((e.downtime_hours_month for e in br_eq), Decimal("0.0")) * mult
        mileage = sum((e.mileage_km_month or Decimal("0.0") for e in br_eq), Decimal("0.0")) * mult
        trips = sum((e.trips_month or 0 for e in br_eq)) * months_multiplier
        revenue = sum((e.revenue_month for e in br_eq), Decimal("0.00")) * mult
        fuel = sum((e.fuel_cost_month for e in br_eq), Decimal("0.00")) * mult
        salary = sum((e.driver_salary_month for e in br_eq), Decimal("0.00")) * mult
        repair = sum((e.repair_cost_month for e in br_eq), Decimal("0.00")) * mult
        transport = sum((e.transport_cost_month for e in br_eq), Decimal("0.00")) * mult
        subcontract = sum((e.subcontract_cost_month for e in br_eq), Decimal("0.00")) * mult
        direct = fuel + salary + repair + transport + subcontract
        eq_ovh = sum((e.overheads_allocated for e in br_eq), Decimal("0.00")) * mult

        fixed_by_cat: Dict[BranchOverheadCategory, Decimal] = {
            cat: Decimal("0.00") for cat in BranchOverheadCategory
        }
        for fo in br.fixed_overheads or []:
            if not fo.hidden:
                cat = BranchOverheadCategory(fo.category.value)
                fixed_by_cat[cat] += fo.monthly_amount_rub * mult

        fixed_total = sum(fixed_by_cat.values(), Decimal("0.00"))
        total_ovh = fixed_total + eq_ovh
        total_exp = direct + total_ovh
        gross_profit = revenue - direct
        op_profit = revenue - direct - total_ovh
        util_pct = round((rented_cnt / eq_cnt * 100.0), 1) if eq_cnt else 0.0
        gross_margin = float((gross_profit / revenue * 100).quantize(Decimal("0.1"))) if revenue > 0 else 0.0
        op_margin = float((op_profit / revenue * 100).quantize(Decimal("0.1"))) if revenue > 0 else 0.0

        total_revenue_all += revenue
        total_op_profit_all += op_profit

        rows.append(
            BranchPeriodFinancials(
                branch_id=br.id,
                branch_code=br.code,
                branch_name=br.name,
                equipment_count=eq_cnt,
                rented_count=rented_cnt,
                hours=hours,
                downtime_hours=downtime,
                utilization_pct=util_pct,
                mileage_km=mileage,
                trips_count=trips,
                revenue=revenue,
                fuel_cost=fuel,
                salary_cost=salary,
                repair_cost=repair,
                transport_cost=transport,
                subcontract_cost=subcontract,
                direct_costs=direct,
                fixed_overheads_total=fixed_total,
                fixed_by_category=fixed_by_cat,
                equipment_overheads=eq_ovh,
                total_overheads=total_ovh,
                total_expenses=total_exp,
                gross_profit=gross_profit,
                gross_margin_pct=gross_margin,
                operating_profit=op_profit,
                operating_margin_pct=op_margin,
                revenue_share_pct=0.0,
                profit_share_pct=0.0,
                profit_per_unit=(op_profit / eq_cnt).quantize(Decimal("0.01")) if eq_cnt else Decimal("0.00"),
                revenue_per_hour=(revenue / hours).quantize(Decimal("0.01")) if hours > 0 else Decimal("0.00"),
                total_cost_per_hour=(total_exp / hours).quantize(Decimal("0.01")) if hours > 0 else Decimal("0.00"),
                direct_cost_per_hour=(direct / hours).quantize(Decimal("0.01")) if hours > 0 else Decimal("0.00"),
            )
        )

    for row in rows:
        row.revenue_share_pct = (
            float((row.revenue / total_revenue_all * 100).quantize(Decimal("0.1")))
            if total_revenue_all > 0
            else 0.0
        )
        row.profit_share_pct = (
            float((row.operating_profit / total_op_profit_all * 100).quantize(Decimal("0.1")))
            if total_op_profit_all != 0
            else 0.0
        )

    tot_eq = sum(r.equipment_count for r in rows)
    tot_rented = sum(r.rented_count for r in rows)
    tot_hours = sum((r.hours for r in rows), Decimal("0.0"))
    tot_rev = sum((r.revenue for r in rows), Decimal("0.00"))
    tot_direct = sum((r.direct_costs for r in rows), Decimal("0.00"))
    tot_fixed = sum((r.fixed_overheads_total for r in rows), Decimal("0.00"))
    tot_eq_ovh = sum((r.equipment_overheads for r in rows), Decimal("0.00"))
    tot_ovh = tot_fixed + tot_eq_ovh
    tot_exp = tot_direct + tot_ovh
    tot_gross = tot_rev - tot_direct
    tot_op = tot_rev - tot_exp
    tot_fixed_cat = {
        cat: sum((r.fixed_by_category[cat] for r in rows), Decimal("0.00"))
        for cat in BranchOverheadCategory
    }

    totals = BranchPeriodFinancials(
        branch_id="all",
        branch_code="ALL",
        branch_name="Все участки",
        equipment_count=tot_eq,
        rented_count=tot_rented,
        hours=tot_hours,
        downtime_hours=sum((r.downtime_hours for r in rows), Decimal("0.0")),
        utilization_pct=round((tot_rented / tot_eq * 100.0), 1) if tot_eq else 0.0,
        mileage_km=sum((r.mileage_km for r in rows), Decimal("0.0")),
        trips_count=sum(r.trips_count for r in rows),
        revenue=tot_rev,
        fuel_cost=sum((r.fuel_cost for r in rows), Decimal("0.00")),
        salary_cost=sum((r.salary_cost for r in rows), Decimal("0.00")),
        repair_cost=sum((r.repair_cost for r in rows), Decimal("0.00")),
        transport_cost=sum((r.transport_cost for r in rows), Decimal("0.00")),
        subcontract_cost=sum((r.subcontract_cost for r in rows), Decimal("0.00")),
        direct_costs=tot_direct,
        fixed_overheads_total=tot_fixed,
        fixed_by_category=tot_fixed_cat,
        equipment_overheads=tot_eq_ovh,
        total_overheads=tot_ovh,
        total_expenses=tot_exp,
        gross_profit=tot_gross,
        gross_margin_pct=float((tot_gross / tot_rev * 100).quantize(Decimal("0.1"))) if tot_rev > 0 else 0.0,
        operating_profit=tot_op,
        operating_margin_pct=float((tot_op / tot_rev * 100).quantize(Decimal("0.1"))) if tot_rev > 0 else 0.0,
        revenue_share_pct=100.0 if tot_rev > 0 else 0.0,
        profit_share_pct=100.0 if tot_op != 0 else 0.0,
        profit_per_unit=(tot_op / tot_eq).quantize(Decimal("0.01")) if tot_eq else Decimal("0.00"),
        revenue_per_hour=(tot_rev / tot_hours).quantize(Decimal("0.01")) if tot_hours > 0 else Decimal("0.00"),
        total_cost_per_hour=(tot_exp / tot_hours).quantize(Decimal("0.01")) if tot_hours > 0 else Decimal("0.00"),
        direct_cost_per_hour=(tot_direct / tot_hours).quantize(Decimal("0.01")) if tot_hours > 0 else Decimal("0.00"),
    )
    return ConsolidatedBranchSummary(
        period_label=period_label,
        active_months_count=months_multiplier,
        branch_rows=rows,
        totals=totals,
    )
