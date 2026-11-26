import uuid
from datetime import date
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user, require_roles
from app.models.admin import User
from app.models.driver import Driver, DriverCard, DriverEquipmentBinding, DriverTimesheetDay
from app.models.enums import DriverShiftRosterEnum, SystemRoleEnum, TimesheetDayCodeEnum
from app.models.fleet import Equipment
from app.schemas.drivers import (
    DriverProfileCreate,
    DriverProfileResponse,
    DriverProfileUpdate,
    DriverReplacementRecord,
    DriverTimesheetUpdateRequest,
)
from app.services.serializers import build_driver_profiles

router = APIRouter(prefix="/drivers", tags=["Drivers, Timesheet T-13 & Replacements"])


@router.get("", response_model=List[DriverProfileResponse])
async def list_drivers(
    branch_id: str = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[DriverProfileResponse]:
    scoped = enforce_branch_scope(current_user, branch_id)
    profiles, _ = await build_driver_profiles(db, scoped)
    return profiles


@router.post("", response_model=DriverProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_driver(
    payload: DriverProfileCreate,
    current_user: User = Depends(
        require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)
    ),
    db: AsyncSession = Depends(get_db),
) -> DriverProfileResponse:
    enforce_branch_scope(current_user, payload.branch_id)
    if payload.assigned_equipment_ids:
        eqs = (
            await db.execute(select(Equipment).where(Equipment.id.in_(payload.assigned_equipment_ids)))
        ).scalars().all()
        for eq in eqs:
            if eq.branch_id != payload.branch_id:
                raise HTTPException(
                    status_code=422,
                    detail="Нельзя закрепить технику другого участка за водителем",
                )

    driver_id = f"drv-{uuid.uuid4().hex[:8]}"
    drv = Driver(
        id=driver_id,
        branch_id=payload.branch_id,
        name=payload.name,
        phone=payload.phone,
        max_linked=payload.max_linked,
        shift_roster=DriverShiftRosterEnum(payload.shift_roster.value),
        needs_replacement=payload.needs_replacement,
        replacement_reason=payload.replacement_reason,
    )
    db.add(drv)
    await db.flush()

    if payload.card_last4:
        db.add(
            DriverCard(
                branch_id=payload.branch_id,
                driver_id=driver_id,
                card_last4=payload.card_last4,
                monthly_limit_rub=payload.card_limit_rub or Decimal("150000.00"),
                is_active=True,
            )
        )

    for eq_id in payload.assigned_equipment_ids:
        db.add(
            DriverEquipmentBinding(
                branch_id=payload.branch_id,
                driver_id=driver_id,
                equipment_id=eq_id,
                is_temporary_replacement=False,
                set_by_role="fleet_manager",
            )
        )

    for iso_day, code in payload.timesheet_days.items():
        d_val = date.fromisoformat(iso_day)
        hours = Decimal("10.00") if code.value in ("Я", "Н") else Decimal("0.00")
        db.add(
            DriverTimesheetDay(
                branch_id=payload.branch_id,
                driver_id=driver_id,
                doc_date=d_val,
                day_code=TimesheetDayCodeEnum(code.value),
                worked_hours=hours,
            )
        )

    await db.commit()
    profiles, _ = await build_driver_profiles(db, payload.branch_id)
    return next(p for p in profiles if p.id == driver_id)


@router.patch("/{driver_id}", response_model=DriverProfileResponse)
async def update_driver(
    driver_id: str,
    payload: DriverProfileUpdate,
    current_user: User = Depends(
        require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)
    ),
    db: AsyncSession = Depends(get_db),
) -> DriverProfileResponse:
    drv = (await db.execute(select(Driver).where(Driver.id == driver_id))).scalar_one_or_none()
    if not drv:
        raise HTTPException(status_code=404, detail="Водитель не найден")
    enforce_branch_scope(current_user, drv.branch_id)

    if payload.name is not None:
        drv.name = payload.name
    if payload.phone is not None:
        drv.phone = payload.phone
    if payload.max_linked is not None:
        drv.max_linked = payload.max_linked
    if payload.shift_roster is not None:
        drv.shift_roster = DriverShiftRosterEnum(payload.shift_roster.value)
    if payload.needs_replacement is not None:
        drv.needs_replacement = payload.needs_replacement
    if payload.replacement_reason is not None:
        drv.replacement_reason = payload.replacement_reason

    if payload.card_last4 is not None or payload.card_limit_rub is not None:
        card = (
            await db.execute(
                select(DriverCard).where(DriverCard.driver_id == driver_id, DriverCard.is_active.is_(True))
            )
        ).scalar_one_or_none()
        if card:
            if payload.card_last4 is not None:
                card.card_last4 = payload.card_last4
            if payload.card_limit_rub is not None:
                card.monthly_limit_rub = payload.card_limit_rub
        elif payload.card_last4:
            db.add(
                DriverCard(
                    branch_id=drv.branch_id,
                    driver_id=driver_id,
                    card_last4=payload.card_last4,
                    monthly_limit_rub=payload.card_limit_rub or Decimal("150000.00"),
                    is_active=True,
                )
            )

    if payload.assigned_equipment_ids is not None:
        if payload.assigned_equipment_ids:
            eqs = (
                await db.execute(select(Equipment).where(Equipment.id.in_(payload.assigned_equipment_ids)))
            ).scalars().all()
            if len(eqs) != len(set(payload.assigned_equipment_ids)) or any(e.branch_id != drv.branch_id for e in eqs):
                raise HTTPException(
                    status_code=422,
                    detail="Вся закрепляемая техника должна принадлежать тому же участку, что и водитель",
                )
        await db.execute(
            delete(DriverEquipmentBinding).where(
                DriverEquipmentBinding.driver_id == driver_id,
                DriverEquipmentBinding.is_temporary_replacement.is_(False),
            )
        )
        for eq_id in payload.assigned_equipment_ids:
            db.add(
                DriverEquipmentBinding(
                    branch_id=drv.branch_id,
                    driver_id=driver_id,
                    equipment_id=eq_id,
                    is_temporary_replacement=False,
                    set_by_role="fleet_manager",
                )
            )

    if payload.timesheet_days is not None:
        for iso_day, code in payload.timesheet_days.items():
            d_val = date.fromisoformat(iso_day)
            hours = Decimal("10.00") if code.value in ("Я", "Н") else Decimal("0.00")
            day_row = (
                await db.execute(
                    select(DriverTimesheetDay).where(
                        DriverTimesheetDay.driver_id == driver_id,
                        DriverTimesheetDay.doc_date == d_val,
                    )
                )
            ).scalar_one_or_none()
            if day_row:
                day_row.day_code = TimesheetDayCodeEnum(code.value)
                day_row.worked_hours = hours
            else:
                db.add(
                    DriverTimesheetDay(
                        branch_id=drv.branch_id,
                        driver_id=driver_id,
                        doc_date=d_val,
                        day_code=TimesheetDayCodeEnum(code.value),
                        worked_hours=hours,
                    )
                )
            if code.value == "Б" and payload.needs_replacement is None:
                drv.needs_replacement = True

    await db.commit()
    profiles, _ = await build_driver_profiles(db, drv.branch_id)
    return next(p for p in profiles if p.id == driver_id)


@router.put("/replacements/{equipment_id}", response_model=DriverReplacementRecord)
async def set_equipment_replacement(
    equipment_id: str,
    payload: DriverReplacementRecord,
    current_user: User = Depends(
        require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)
    ),
    db: AsyncSession = Depends(get_db),
) -> DriverReplacementRecord:
    eq = (await db.execute(select(Equipment).where(Equipment.id == equipment_id))).scalar_one_or_none()
    if not eq:
        raise HTTPException(status_code=404, detail="Единица техники не найдена")
    enforce_branch_scope(current_user, eq.branch_id)

    drv = (await db.execute(select(Driver).where(Driver.id == payload.driver_id))).scalar_one_or_none()
    if not drv or drv.branch_id != eq.branch_id:
        raise HTTPException(
            status_code=422,
            detail="Заменяющий водитель должен принадлежать тому же участку, что и техника",
        )

    await db.execute(
        delete(DriverEquipmentBinding).where(
            DriverEquipmentBinding.equipment_id == equipment_id,
            DriverEquipmentBinding.is_temporary_replacement.is_(True),
        )
    )
    binding = DriverEquipmentBinding(
        branch_id=eq.branch_id,
        driver_id=drv.id,
        equipment_id=equipment_id,
        is_temporary_replacement=True,
        set_by_role=payload.set_by_role,
        reason=payload.reason,
    )
    db.add(binding)
    await db.commit()
    await db.refresh(binding)
    return DriverReplacementRecord(
        equipment_id=equipment_id,
        driver_id=drv.id,
        driver_name=drv.name,
        driver_phone=drv.phone,
        set_by_role=payload.set_by_role,
        reason=binding.reason,
        updated_at=binding.updated_at,
    )


@router.put("/{driver_id}/timesheet", response_model=DriverProfileResponse)
async def update_driver_timesheet(
    driver_id: str,
    payload: DriverTimesheetUpdateRequest,
    current_user: User = Depends(
        require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)
    ),
    db: AsyncSession = Depends(get_db),
) -> DriverProfileResponse:
    drv = (await db.execute(select(Driver).where(Driver.id == driver_id))).scalar_one_or_none()
    if not drv:
        raise HTTPException(status_code=404, detail="Водитель не найден")
    enforce_branch_scope(current_user, drv.branch_id)

    has_sick = False
    for iso_day, code in payload.days.items():
        d_val = date.fromisoformat(iso_day)
        hours = Decimal("10.00") if code.value in ("Я", "Н") else Decimal("0.00")
        if code.value == "Б":
            has_sick = True
        row = (
            await db.execute(
                select(DriverTimesheetDay).where(
                    DriverTimesheetDay.driver_id == driver_id,
                    DriverTimesheetDay.doc_date == d_val,
                )
            )
        ).scalar_one_or_none()
        if row:
            row.day_code = TimesheetDayCodeEnum(code.value)
            row.worked_hours = hours
        else:
            db.add(
                DriverTimesheetDay(
                    branch_id=drv.branch_id,
                    driver_id=driver_id,
                    doc_date=d_val,
                    day_code=TimesheetDayCodeEnum(code.value),
                    worked_hours=hours,
                )
            )
    if has_sick:
        drv.needs_replacement = True

    await db.commit()
    profiles, _ = await build_driver_profiles(db, drv.branch_id)
    return next(p for p in profiles if p.id == driver_id)


@router.delete("/replacements/{equipment_id}")
async def clear_equipment_replacement(
    equipment_id: str,
    current_user: User = Depends(
        require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)
    ),
    db: AsyncSession = Depends(get_db),
) -> dict:
    eq = (await db.execute(select(Equipment).where(Equipment.id == equipment_id))).scalar_one_or_none()
    if eq:
        enforce_branch_scope(current_user, eq.branch_id)
    await db.execute(
        delete(DriverEquipmentBinding).where(
            DriverEquipmentBinding.equipment_id == equipment_id,
            DriverEquipmentBinding.is_temporary_replacement.is_(True),
        )
    )
    await db.commit()
    return {"deleted": True, "equipmentId": equipment_id}
