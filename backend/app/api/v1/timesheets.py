from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user, require_roles
from app.models.admin import User
from app.models.enums import ShiftStatusEnum, SystemRoleEnum
from app.models.fleet import Equipment
from app.models.forms import ShiftReport
from app.schemas.base import CamelModel
from app.schemas.timesheets import ShiftModerateRequest, ShiftReportCreate, ShiftReportResponse
from app.services.ai_service import run_ocr_meter_estimate
from app.services.timesheets_service import (
    approve_shift_report,
    moderate_shift_report,
    serialize_shift,
    submit_shift_report,
)

router = APIRouter(prefix="/timesheets", tags=["Timesheets & ESM-7 Shift Reports"])


class OcrMeterRequest(CamelModel):
    image_base64: Optional[str] = None
    equipment_type: str = "excavator"


@router.post("/shifts/submit", response_model=ShiftReportResponse, status_code=status.HTTP_201_CREATED)
async def submit_shift(
    payload: ShiftReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShiftReportResponse:
    enforce_branch_scope(current_user, payload.branch_id)
    return await submit_shift_report(db, payload)


@router.get("/shifts", response_model=List[ShiftReportResponse])
async def list_shifts(
    branch_id: Optional[str] = Query(default="all"),
    date_from: Optional[date] = Query(default=None),
    date_to: Optional[date] = Query(default=None),
    equipment_id: Optional[str] = Query(default=None),
    shift_status: Optional[ShiftStatusEnum] = Query(default=None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ShiftReportResponse]:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(ShiftReport).order_by(ShiftReport.doc_date.desc(), ShiftReport.created_at.desc())
    if scoped and scoped != "all":
        stmt = stmt.where(ShiftReport.branch_id == scoped)
    if date_from:
        stmt = stmt.where(ShiftReport.doc_date >= date_from)
    if date_to:
        stmt = stmt.where(ShiftReport.doc_date <= date_to)
    if equipment_id:
        stmt = stmt.where(ShiftReport.equipment_id == equipment_id)
    if shift_status:
        stmt = stmt.where(ShiftReport.status == shift_status)

    rows = (await db.execute(stmt)).scalars().all()
    eq_rows = (await db.execute(select(Equipment))).scalars().all()
    eq_map = {e.id: e.name for e in eq_rows}
    return [serialize_shift(s, eq_map.get(s.equipment_id, "")) for s in rows]


@router.post("/shifts/{shift_id}/approve", response_model=ShiftReportResponse)
async def approve_shift(
    shift_id: str,
    current_user: User = Depends(
        require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)
    ),
    db: AsyncSession = Depends(get_db),
) -> ShiftReportResponse:
    row = (await db.execute(select(ShiftReport).where(ShiftReport.id == shift_id))).scalar_one_or_none()
    if row:
        enforce_branch_scope(current_user, row.branch_id)
    return await approve_shift_report(db, shift_id)


@router.patch("/shifts/{shift_id}/moderate", response_model=ShiftReportResponse)
@router.post("/shifts/{shift_id}/moderate", response_model=ShiftReportResponse)
async def moderate_shift(
    shift_id: str,
    payload: ShiftModerateRequest,
    current_user: User = Depends(
        require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)
    ),
    db: AsyncSession = Depends(get_db),
) -> ShiftReportResponse:
    row = (await db.execute(select(ShiftReport).where(ShiftReport.id == shift_id))).scalar_one_or_none()
    if row:
        enforce_branch_scope(current_user, row.branch_id)
    return await moderate_shift_report(db, shift_id, payload)


@router.post("/ocr-meter")
async def ocr_hour_meter(
    payload: OcrMeterRequest,
    _user: User = Depends(get_current_user),
) -> dict:
    return {"success": True, "extractedData": run_ocr_meter_estimate(payload.equipment_type)}
