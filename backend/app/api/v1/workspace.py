from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import User
from app.models.audit import AnomalyAlert
from app.models.branch import Branch
from app.models.crm import CRMDeal, ClientCommunication, MaxCustomerBotConfig
from app.models.erp import Contract, LegalHistory, RentalOrder, StatusNotification, StatusNotificationSettings
from app.models.fleet import Equipment
from app.models.forms import ClosingDocument, ShiftReport
from app.models.rag import KnowledgeDocument
from app.schemas.admin_legal import MaxCustomerBotConfigSchema, WorkspaceBootstrapResponse
from app.schemas.base import CamelModel
from app.services.analytics_service import serialize_equipment
from app.services.branch_cascade import serialize_branch
from app.services.closing_docs_service import serialize_closing_doc
from app.services.crm_service import apply_deal_retention_48h, serialize_deal
from app.services.serializers import (
    build_driver_profiles,
    load_admin_config,
    load_one_c_config,
    serialize_chat_message,
    serialize_knowledge_doc,
    serialize_legal_doc,
    serialize_legal_history,
    serialize_notification,
    serialize_notification_settings,
    serialize_order,
)
from app.services.timesheets_service import serialize_shift

router = APIRouter(prefix="/workspace", tags=["Workspace Hydration"])


class ActiveBranchPatch(CamelModel):
    branch_id: str


@router.get("/bootstrap", response_model=WorkspaceBootstrapResponse)
async def get_workspace_bootstrap(
    branch_id: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkspaceBootstrapResponse:
    # Enforce 48h retention on completed deals before serving snapshot
    await apply_deal_retention_48h(db)

    branches = (await db.execute(select(Branch).order_by(Branch.is_headquarters.desc(), Branch.code))).scalars().all()
    requested_branch = branch_id or current_user.branch_id or "all"
    scoped_branch = enforce_branch_scope(current_user, requested_branch) or "all"

    active_branch_obj = next((b for b in branches if b.id == scoped_branch), None)
    isolate_contour_a = (
        scoped_branch != "all"
        and active_branch_obj is not None
        and (active_branch_obj.document_flow.isolate_crm_and_erp if active_branch_obj.document_flow else True)
    )

    eq_stmt = select(Equipment)
    deal_stmt = select(CRMDeal)
    order_stmt = select(RentalOrder)
    cdoc_stmt = select(ClosingDocument)
    shift_stmt = select(ShiftReport)
    ano_stmt = select(AnomalyAlert)
    chat_stmt = select(ClientCommunication).order_by(ClientCommunication.created_at.asc())
    notif_stmt = select(StatusNotification).order_by(StatusNotification.created_at.desc())

    if isolate_contour_a:
        eq_stmt = eq_stmt.where(Equipment.branch_id == scoped_branch)
        deal_stmt = deal_stmt.where(CRMDeal.branch_id == scoped_branch)
        order_stmt = order_stmt.where(RentalOrder.branch_id == scoped_branch)
        cdoc_stmt = cdoc_stmt.where(ClosingDocument.branch_id == scoped_branch)
        shift_stmt = shift_stmt.where(ShiftReport.branch_id == scoped_branch)
        ano_stmt = ano_stmt.where(AnomalyAlert.branch_id == scoped_branch)
        chat_stmt = chat_stmt.where(ClientCommunication.branch_id == scoped_branch)
        notif_stmt = notif_stmt.where(StatusNotification.branch_id == scoped_branch)

    eq_rows = (await db.execute(eq_stmt)).scalars().all()
    eq_name_map = {e.id: e.name for e in eq_rows}

    deal_rows = (await db.execute(deal_stmt)).scalars().all()
    order_rows = (await db.execute(order_stmt)).scalars().all()
    cdoc_rows = (await db.execute(cdoc_stmt)).scalars().all()
    shift_rows = (await db.execute(shift_stmt)).scalars().all()
    ano_rows = (await db.execute(ano_stmt)).scalars().all()
    chat_rows = (await db.execute(chat_stmt)).scalars().all()
    notif_rows = (await db.execute(notif_stmt)).scalars().all()

    drivers, replacements = await build_driver_profiles(db, scoped_branch if isolate_contour_a else None)

    # Contour B (Centralized unified registries across company)
    legal_rows = (await db.execute(select(Contract).order_by(Contract.updated_at.desc()))).scalars().all()
    history_rows = (await db.execute(select(LegalHistory).order_by(LegalHistory.created_at.desc()))).scalars().all()
    kb_rows = (await db.execute(select(KnowledgeDocument))).scalars().all()
    max_cfg_rows = (await db.execute(select(MaxCustomerBotConfig))).scalars().all()
    notif_settings_row = (
        await db.execute(select(StatusNotificationSettings).where(StatusNotificationSettings.id == 1))
    ).scalar_one_or_none()

    max_configs = {
        m.branch_id: MaxCustomerBotConfigSchema(
            enabled=m.enabled,
            allow_new_rental_requests=m.allow_new_rental_requests,
            allow_shift_hour_confirmation=m.allow_shift_hour_confirmation,
            allow_site_chat_and_photos=m.allow_site_chat_and_photos,
            autoRouteTo1C=m.auto_route_to_1c,
            require_manager_moderation=m.require_manager_moderation,
        )
        for m in max_cfg_rows
    }

    anomalies_out = [
        {
            "id": a.id,
            "branchId": a.branch_id,
            "severity": a.severity.value,
            "category": a.category.value,
            "title": a.title,
            "description": a.description,
            "equipmentName": a.equipment_name or "",
            "date": a.doc_date.isoformat(),
            "impactRubles": float(a.impact_rubles or 0),
            "resolved": a.resolved,
        }
        for a in ano_rows
    ]

    return WorkspaceBootstrapResponse(
        active_branch_id=scoped_branch,
        branches=[serialize_branch(b) for b in branches],
        equipment_list=[serialize_equipment(e) for e in eq_rows],
        deals=[serialize_deal(d) for d in deal_rows if d.archived_at is None],
        orders=[serialize_order(o, eq_name_map.get(o.equipment_id)) for o in order_rows],
        closing_docs=[serialize_closing_doc(c) for c in cdoc_rows],
        shift_reports=[serialize_shift(s, eq_name_map.get(s.equipment_id, "")) for s in shift_rows],
        drivers=drivers,
        driver_replacements=replacements,
        anomalies=anomalies_out,
        chat_messages=[serialize_chat_message(m) for m in chat_rows],
        legal_documents=[serialize_legal_doc(c) for c in legal_rows],
        legal_history=[serialize_legal_history(h) for h in history_rows],
        knowledge_docs=[serialize_knowledge_doc(k) for k in kb_rows],
        max_bot_configs=max_configs,
        oneCConfig=await load_one_c_config(db),
        admin_config=await load_admin_config(db),
        notification_settings=serialize_notification_settings(notif_settings_row),
        status_notifications=[serialize_notification(n) for n in notif_rows],
    )


@router.put("/active-branch")
async def set_active_branch(
    payload: ActiveBranchPatch,
    current_user: User = Depends(get_current_user),
) -> dict:
    scoped = enforce_branch_scope(current_user, payload.branch_id)
    return {"activeBranchId": scoped or payload.branch_id}
