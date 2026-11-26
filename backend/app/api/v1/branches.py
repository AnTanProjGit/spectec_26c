import uuid
from decimal import Decimal
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user, require_roles
from app.models.admin import User
from app.models.branch import Branch, BranchDocumentFlow, BranchFixedOverhead, BranchOverheadDetail
from app.models.enums import AccountingSubjectEnum, OverheadCategoryEnum, SystemRoleEnum
from app.schemas.base import CamelModel
from app.schemas.branches import (
    BranchFixedOverheadItem,
    BranchOverheadDetailRow,
    FleetBranchCreate,
    FleetBranchResponse,
    FleetBranchUpdate,
)
from app.services.branch_cascade import cascade_branch_prefixes, serialize_branch

router = APIRouter(prefix="/branches", tags=["Branches & Fixed Overheads"])


class OverheadVisibilityPatch(CamelModel):
    hidden: bool


@router.get("", response_model=List[FleetBranchResponse])
async def list_branches(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[FleetBranchResponse]:
    branches = (await db.execute(select(Branch).order_by(Branch.is_headquarters.desc(), Branch.code))).scalars().all()
    return [serialize_branch(b) for b in branches]


@router.post("", response_model=FleetBranchResponse, status_code=status.HTTP_201_CREATED)
async def create_branch(
    payload: FleetBranchCreate,
    _user: User = Depends(require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager)),
    db: AsyncSession = Depends(get_db),
) -> FleetBranchResponse:
    code_up = payload.code.strip().upper()
    branch_id = f"branch-{code_up.lower()}-{uuid.uuid4().hex[:4]}"
    existing = (await db.execute(select(Branch).where(Branch.code == code_up))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail=f"Участок с кодом '{code_up}' уже существует")

    branch = Branch(
        id=branch_id,
        code=code_up,
        name=payload.name,
        city=payload.city,
        is_headquarters=payload.is_headquarters,
        fleet_manager_name=payload.fleet_manager_name,
        fleet_manager_phone=payload.fleet_manager_phone,
        chief_mechanic_name=payload.chief_mechanic_name,
        chief_mechanic_phone=payload.chief_mechanic_phone,
        base_address=payload.base_address,
        regular_clients=payload.regular_clients,
    )
    db.add(branch)
    await db.flush()

    df = payload.document_flow
    db.add(
        BranchDocumentFlow(
            branch_id=branch_id,
            isolated_streams=df.isolated_streams,
            isolate_crm_and_erp=df.isolate_crm_and_erp,
            order_prefix=df.order_prefix or f"RO-{code_up}-",
            waybill_prefix=df.waybill_prefix or f"ПЛ-{code_up}-",
            shift_prefix=df.shift_prefix or f"SH-{code_up}-",
            act_prefix=df.act_prefix or f"КС2-{code_up}-",
            onec_department_code=df.onec_department_code or f"ПОДР-{code_up}-01",
            default_1c_subject=AccountingSubjectEnum(df.default_1c_subject.value),
        )
    )
    for item in payload.fixed_overheads:
        amt = (
            sum((d.amount_rub for d in item.details), Decimal("0.00"))
            if item.details
            else item.monthly_amount_rub
        )
        ovh = BranchFixedOverhead(
            id=item.id or f"ovh-{uuid.uuid4().hex[:8]}",
            branch_id=branch_id,
            category=OverheadCategoryEnum(item.category.value),
            name=item.name,
            monthly_amount_rub=amt,
            note=item.note,
            hidden=item.hidden,
        )
        db.add(ovh)
        await db.flush()
        for det in item.details or []:
            db.add(
                BranchOverheadDetail(
                    id=det.id or f"ovd-{uuid.uuid4().hex[:8]}",
                    overhead_item_id=ovh.id,
                    title=det.title,
                    basis=det.basis,
                    amount_rub=det.amount_rub,
                )
            )
    await db.commit()
    refreshed = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one()
    return serialize_branch(refreshed)


@router.patch("/{branch_id}", response_model=FleetBranchResponse)
async def update_branch(
    branch_id: str,
    payload: FleetBranchUpdate,
    current_user: User = Depends(require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.fleet_manager)),
    db: AsyncSession = Depends(get_db),
) -> FleetBranchResponse:
    enforce_branch_scope(current_user, branch_id)
    branch = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Участок не найден")

    for field in (
        "code",
        "name",
        "city",
        "is_headquarters",
        "fleet_manager_name",
        "fleet_manager_phone",
        "chief_mechanic_name",
        "chief_mechanic_phone",
        "base_address",
        "regular_clients",
    ):
        val = getattr(payload, field)
        if val is not None:
            setattr(branch, field, val)

    if payload.document_flow is not None:
        df = branch.document_flow
        if df:
            await cascade_branch_prefixes(db, branch_id, df, payload.document_flow)
            df.isolated_streams = payload.document_flow.isolated_streams
            df.isolate_crm_and_erp = payload.document_flow.isolate_crm_and_erp
            df.order_prefix = payload.document_flow.order_prefix
            df.waybill_prefix = payload.document_flow.waybill_prefix
            df.shift_prefix = payload.document_flow.shift_prefix
            df.act_prefix = payload.document_flow.act_prefix
            df.onec_department_code = payload.document_flow.onec_department_code
            df.default_1c_subject = AccountingSubjectEnum(payload.document_flow.default_1c_subject.value)
        else:
            db.add(
                BranchDocumentFlow(
                    branch_id=branch_id,
                    isolated_streams=payload.document_flow.isolated_streams,
                    isolate_crm_and_erp=payload.document_flow.isolate_crm_and_erp,
                    order_prefix=payload.document_flow.order_prefix,
                    waybill_prefix=payload.document_flow.waybill_prefix,
                    shift_prefix=payload.document_flow.shift_prefix,
                    act_prefix=payload.document_flow.act_prefix,
                    onec_department_code=payload.document_flow.onec_department_code,
                    default_1c_subject=AccountingSubjectEnum(payload.document_flow.default_1c_subject.value),
                )
            )

    if payload.fixed_overheads is not None:
        await db.execute(delete(BranchFixedOverhead).where(BranchFixedOverhead.branch_id == branch_id))
        for item in payload.fixed_overheads:
            amt = (
                sum((d.amount_rub for d in item.details), Decimal("0.00"))
                if item.details
                else item.monthly_amount_rub
            )
            ovh = BranchFixedOverhead(
                id=item.id or f"ovh-{uuid.uuid4().hex[:8]}",
                branch_id=branch_id,
                category=OverheadCategoryEnum(item.category.value),
                name=item.name,
                monthly_amount_rub=amt,
                note=item.note,
                hidden=item.hidden,
            )
            db.add(ovh)
            await db.flush()
            for det in item.details or []:
                db.add(
                    BranchOverheadDetail(
                        id=det.id or f"ovd-{uuid.uuid4().hex[:8]}",
                        overhead_item_id=ovh.id,
                        title=det.title,
                        basis=det.basis,
                        amount_rub=det.amount_rub,
                    )
                )

    await db.commit()
    refreshed = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one()
    return serialize_branch(refreshed)


@router.put("/{branch_id}/overheads", response_model=FleetBranchResponse)
async def replace_branch_overheads(
    branch_id: str,
    items: List[BranchFixedOverheadItem],
    current_user: User = Depends(require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.accountant)),
    db: AsyncSession = Depends(get_db),
) -> FleetBranchResponse:
    enforce_branch_scope(current_user, branch_id)
    branch = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one_or_none()
    if not branch:
        raise HTTPException(status_code=404, detail="Участок не найден")

    await db.execute(delete(BranchFixedOverhead).where(BranchFixedOverhead.branch_id == branch_id))
    for item in items:
        amt = sum((d.amount_rub for d in item.details), Decimal("0.00")) if item.details else item.monthly_amount_rub
        ovh = BranchFixedOverhead(
            id=item.id or f"ovh-{uuid.uuid4().hex[:8]}",
            branch_id=branch_id,
            category=OverheadCategoryEnum(item.category.value),
            name=item.name,
            monthly_amount_rub=amt,
            note=item.note,
            hidden=item.hidden,
        )
        db.add(ovh)
        await db.flush()
        for det in item.details or []:
            db.add(
                BranchOverheadDetail(
                    id=det.id or f"ovd-{uuid.uuid4().hex[:8]}",
                    overhead_item_id=ovh.id,
                    title=det.title,
                    basis=det.basis,
                    amount_rub=det.amount_rub,
                )
            )
    await db.commit()
    refreshed = (await db.execute(select(Branch).where(Branch.id == branch_id))).scalar_one()
    return serialize_branch(refreshed)


@router.patch("/{branch_id}/overheads/{item_id}/visibility", response_model=BranchFixedOverheadItem)
async def toggle_overhead_visibility(
    branch_id: str,
    item_id: str,
    payload: OverheadVisibilityPatch,
    current_user: User = Depends(require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.accountant)),
    db: AsyncSession = Depends(get_db),
) -> BranchFixedOverheadItem:
    enforce_branch_scope(current_user, branch_id)
    item = (
        await db.execute(
            select(BranchFixedOverhead).where(
                BranchFixedOverhead.branch_id == branch_id,
                BranchFixedOverhead.id == item_id,
            )
        )
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Статья расхода не найдена")
    item.hidden = payload.hidden
    await db.commit()
    await db.refresh(item)
    return BranchFixedOverheadItem(
        id=item.id,
        category=item.category.value,
        name=item.name,
        monthly_amount_rub=item.monthly_amount_rub,
        note=item.note,
        hidden=item.hidden,
        details=[
            BranchOverheadDetailRow(id=d.id, title=d.title, basis=d.basis, amount_rub=d.amount_rub)
            for d in (item.details or [])
        ]
        or None,
    )


@router.get("/{branch_id}/overheads/{item_id}/details")
async def get_overhead_details(
    branch_id: str,
    item_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    enforce_branch_scope(current_user, branch_id)
    item = (
        await db.execute(
            select(BranchFixedOverhead).where(
                BranchFixedOverhead.branch_id == branch_id,
                BranchFixedOverhead.id == item_id,
            )
        )
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Статья расхода не найдена")
    details = [
        BranchOverheadDetailRow(id=d.id, title=d.title, basis=d.basis, amount_rub=d.amount_rub)
        for d in (item.details or [])
    ]
    dto = BranchFixedOverheadItem(
        id=item.id,
        category=item.category.value,
        name=item.name,
        monthly_amount_rub=item.monthly_amount_rub,
        note=item.note,
        hidden=item.hidden,
        details=details or None,
    )
    return {"item": dto.model_dump(by_alias=True), "details": [d.model_dump(by_alias=True) for d in details]}


@router.put("/{branch_id}/overheads/{item_id}/details")
async def save_overhead_details(
    branch_id: str,
    item_id: str,
    rows: List[BranchOverheadDetailRow],
    current_user: User = Depends(require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager, SystemRoleEnum.accountant)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    enforce_branch_scope(current_user, branch_id)
    item = (
        await db.execute(
            select(BranchFixedOverhead).where(
                BranchFixedOverhead.branch_id == branch_id,
                BranchFixedOverhead.id == item_id,
            )
        )
    ).scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Статья расхода не найдена")

    await db.execute(delete(BranchOverheadDetail).where(BranchOverheadDetail.overhead_item_id == item_id))
    for r in rows:
        db.add(
            BranchOverheadDetail(
                id=r.id or f"ovd-{uuid.uuid4().hex[:8]}",
                overhead_item_id=item_id,
                title=r.title,
                basis=r.basis,
                amount_rub=r.amount_rub,
            )
        )
    if rows:
        item.monthly_amount_rub = sum((r.amount_rub for r in rows), Decimal("0.00"))
    await db.commit()
    await db.refresh(item)
    details = [
        BranchOverheadDetailRow(id=d.id, title=d.title, basis=d.basis, amount_rub=d.amount_rub)
        for d in (item.details or [])
    ]
    dto = BranchFixedOverheadItem(
        id=item.id,
        category=item.category.value,
        name=item.name,
        monthly_amount_rub=item.monthly_amount_rub,
        note=item.note,
        hidden=item.hidden,
        details=details or None,
    )
    return {"item": dto.model_dump(by_alias=True), "details": [d.model_dump(by_alias=True) for d in details]}
