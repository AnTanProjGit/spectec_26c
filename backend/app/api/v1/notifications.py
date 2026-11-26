from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import User
from app.models.erp import StatusNotification, StatusNotificationSettings
from app.schemas.base import CamelModel
from app.schemas.crm_erp import StatusNotificationItem, StatusNotificationSettingsSchema
from app.services.serializers import serialize_notification, serialize_notification_settings

router = APIRouter(prefix="/notifications", tags=["Notifications & Alerts"])


class MarkReadRequest(CamelModel):
    branch_id: Optional[str] = None


@router.get("/settings", response_model=StatusNotificationSettingsSchema)
async def get_notification_settings(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StatusNotificationSettingsSchema:
    row = (
        await db.execute(select(StatusNotificationSettings).where(StatusNotificationSettings.id == 1))
    ).scalar_one_or_none()
    return serialize_notification_settings(row)


@router.put("/settings", response_model=StatusNotificationSettingsSchema)
async def update_notification_settings(
    payload: StatusNotificationSettingsSchema,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> StatusNotificationSettingsSchema:
    row = (
        await db.execute(select(StatusNotificationSettings).where(StatusNotificationSettings.id == 1))
    ).scalar_one_or_none()
    if not row:
        row = StatusNotificationSettings(id=1)
        db.add(row)
    row.enabled = payload.enabled
    row.on_volume_close_act_ks2 = payload.on_volume_close_act_ks2
    row.on_act_signed_change = payload.on_act_signed_change
    row.on_invoice_issued = payload.on_invoice_issued
    row.on_invoice_status_change = payload.on_invoice_status_change
    row.send_to_branch_chat = payload.send_to_branch_chat
    row.send_to_max_client_bot = payload.send_to_max_client_bot
    row.remind_debt_overdue_days = payload.remind_debt_overdue_days
    await db.commit()
    await db.refresh(row)
    return serialize_notification_settings(row)


@router.get("", response_model=List[StatusNotificationItem])
async def list_notifications(
    branch_id: Optional[str] = Query(default="all"),
    unread_only: bool = Query(default=False),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[StatusNotificationItem]:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(StatusNotification).order_by(StatusNotification.created_at.desc())
    if scoped and scoped != "all":
        stmt = stmt.where(StatusNotification.branch_id == scoped)
    if unread_only:
        stmt = stmt.where(StatusNotification.is_read.is_(False))
    rows = (await db.execute(stmt)).scalars().all()
    return [serialize_notification(r) for r in rows]


@router.post("/mark-read")
async def mark_notifications_read(
    payload: Optional[MarkReadRequest] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    target_branch = payload.branch_id if payload else None
    scoped = enforce_branch_scope(current_user, target_branch)
    stmt = update(StatusNotification).values(is_read=True)
    if scoped and scoped != "all":
        stmt = stmt.where(StatusNotification.branch_id == scoped)
    await db.execute(stmt)
    await db.commit()
    return {"success": True}
