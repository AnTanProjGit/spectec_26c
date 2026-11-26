import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user, require_permission, require_roles
from app.models.admin import User
from app.models.enums import EquipmentStatusEnum, EquipmentTypeEnum, SystemRoleEnum
from app.models.fleet import Equipment
from app.schemas.fleet import (
    EquipmentCreate,
    EquipmentResponse,
    EquipmentStatusPatch,
    EquipmentUpdate,
    EquipmentVariableCostsPatch,
)
from app.services.analytics_service import serialize_equipment

router = APIRouter(prefix="/fleet", tags=["Fleet Equipment"])


@router.get("/equipment")
async def list_equipment(
    branch_id: Optional[str] = Query(default=None),
    eq_type: Optional[EquipmentTypeEnum] = Query(default=None, alias="type"),
    eq_status: Optional[EquipmentStatusEnum] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    sort_by: str = Query(default="profit"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=50, ge=1, le=500),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(Equipment)
    if scoped and scoped != "all":
        stmt = stmt.where(Equipment.branch_id == scoped)
    if eq_type:
        stmt = stmt.where(Equipment.equipment_type == eq_type)
    if eq_status:
        stmt = stmt.where(Equipment.status == eq_status)
    if search and search.strip():
        pat = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Equipment.name.ilike(pat),
                Equipment.inventory_number.ilike(pat),
                Equipment.plate_number.ilike(pat),
                Equipment.assigned_site.ilike(pat),
            )
        )

    rows = (await db.execute(stmt)).scalars().all()
    items = [serialize_equipment(r) for r in rows]

    if sort_by == "revenue":
        items.sort(key=lambda x: x.revenue_month, reverse=True)
    elif sort_by == "hours":
        items.sort(key=lambda x: x.month_hours, reverse=True)
    elif sort_by == "margin":
        items.sort(key=lambda x: x.margin_percent, reverse=True)
    else:
        items.sort(key=lambda x: x.operating_profit_month, reverse=True)

    total = len(items)
    start = (page - 1) * limit
    paged = items[start: start + limit]
    return {
        "total": total,
        "page": page,
        "limit": limit,
        "items": [i.model_dump(by_alias=True) for i in paged],
    }


@router.get("/equipment/{equipment_id}", response_model=EquipmentResponse)
async def get_equipment(
    equipment_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> EquipmentResponse:
    eq = (await db.execute(select(Equipment).where(Equipment.id == equipment_id))).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=404, detail="Единица техники не найдена")
    enforce_branch_scope(current_user, eq.branch_id)
    return serialize_equipment(eq)


@router.post("/equipment", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def create_equipment(
    payload: EquipmentCreate,
    current_user: User = Depends(
        require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)
    ),
    db: AsyncSession = Depends(get_db),
) -> EquipmentResponse:
    enforce_branch_scope(current_user, payload.branch_id)
    dup = (
        await db.execute(
            select(Equipment).where(
                Equipment.branch_id == payload.branch_id,
                Equipment.inventory_number == payload.inventory_number,
            )
        )
    ).scalar_one_or_none()
    if dup:
        raise HTTPException(status_code=409, detail="Техника с таким инвентарным номером на участке уже существует")

    eq = Equipment(
        id=f"eq-{uuid.uuid4().hex[:10]}",
        branch_id=payload.branch_id,
        inventory_number=payload.inventory_number,
        name=payload.name,
        equipment_type=EquipmentTypeEnum(payload.equipment_type.value),
        brand=payload.brand,
        plate_number=payload.plate_number,
        vin=payload.vin,
        year=payload.year,
        owner=payload.owner,
        purchase_price=payload.purchase_price,
        current_value=payload.current_value,
        hourly_rate=payload.hourly_rate,
        fuel_rate_hour=payload.fuel_rate_hour,
        specs=payload.specs,
        notes=payload.notes,
        status=EquipmentStatusEnum(payload.status.value),
        assigned_site=payload.assigned_site,
        assigned_operator=payload.assigned_operator,
        current_hours=payload.current_hours,
        next_maintenance_in_hours=payload.next_maintenance_in_hours,
    )
    db.add(eq)
    await db.commit()
    await db.refresh(eq)
    return serialize_equipment(eq)


@router.put("/equipment/bulk-costs")
async def bulk_update_equipment_costs(
    patches: List[EquipmentVariableCostsPatch],
    _user: User = Depends(require_permission(field="canAccessVariableCostsTable")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    updated = 0
    for patch in patches:
        eq = (await db.execute(select(Equipment).where(Equipment.id == patch.equipment_id))).scalar_one_or_none()
        if not eq:
            continue
        eq.fuel_cost_month = patch.fuel_cost_month
        eq.driver_salary_month = patch.driver_salary_month
        eq.repair_cost_month = patch.repair_cost_month
        eq.transport_cost_month = patch.transport_cost_month
        if patch.hourly_rate is not None:
            eq.hourly_rate = patch.hourly_rate
        if patch.fuel_rate_hour is not None:
            eq.fuel_rate_hour = patch.fuel_rate_hour
        if patch.subcontract_cost_month is not None:
            eq.subcontract_cost_month = patch.subcontract_cost_month
        if patch.overheads_allocated is not None:
            eq.overheads_allocated = patch.overheads_allocated
        updated += 1
    await db.commit()
    return {"updated": updated}


@router.patch("/equipment/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: str,
    payload: EquipmentUpdate,
    current_user: User = Depends(
        require_roles(
            SystemRoleEnum.admin,
            SystemRoleEnum.top_manager,
            SystemRoleEnum.fleet_manager,
            SystemRoleEnum.accountant,
        )
    ),
    db: AsyncSession = Depends(get_db),
) -> EquipmentResponse:
    eq = (await db.execute(select(Equipment).where(Equipment.id == equipment_id))).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=404, detail="Единица техники не найдена")
    enforce_branch_scope(current_user, eq.branch_id)

    data = payload.model_dump(exclude_unset=True)
    data.pop("assigned_operator_id", None)
    if "status" in data and data["status"] is not None:
        data["status"] = EquipmentStatusEnum(data["status"].value if hasattr(data["status"], "value") else data["status"])
    for k, v in data.items():
        if hasattr(eq, k):
            setattr(eq, k, v)
    await db.commit()
    await db.refresh(eq)
    return serialize_equipment(eq)


@router.patch("/equipment/{equipment_id}/status", response_model=EquipmentResponse)
async def update_equipment_status(
    equipment_id: str,
    payload: EquipmentStatusPatch,
    current_user: User = Depends(
        require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)
    ),
    db: AsyncSession = Depends(get_db),
) -> EquipmentResponse:
    eq = (await db.execute(select(Equipment).where(Equipment.id == equipment_id))).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=404, detail="Единица техники не найдена")
    enforce_branch_scope(current_user, eq.branch_id)
    eq.status = EquipmentStatusEnum(payload.status.value)
    if payload.assigned_site is not None:
        eq.assigned_site = payload.assigned_site
    if payload.reason:
        eq.notes = payload.reason
    await db.commit()
    await db.refresh(eq)
    return serialize_equipment(eq)
