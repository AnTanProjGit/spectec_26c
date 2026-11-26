import hmac
import os
import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import SystemAdminConfigModel, User
from app.models.crm import CRMDeal, ClientCommunication, DealConfirmation, MaxCustomerBotConfig
from app.models.enums import (
    AccountingSubjectEnum,
    CRMStageEnum,
    ClientTypeEnum,
    EquipmentTypeEnum,
    OrderStatusEnum,
    ShiftStatusEnum,
)
from app.models.erp import Contract, RentalOrder
from app.models.fleet import Equipment
from app.models.forms import ClosingDocument, ShiftReport
from app.models.rag import KnowledgeDocument
from app.schemas.admin_legal import (
    ChatAgentQueryRequest,
    ChatAgentQueryResponse,
    FileUploadResponse,
    MaxCustomerBotConfigSchema,
)
from app.schemas.base import CamelModel
from app.schemas.crm_erp import ChatMessageCreate, ChatMessageResponse
from app.services.ai_service import run_chat_agent_search
from app.services.analytics_service import serialize_equipment
from app.services.closing_docs_service import serialize_closing_doc
from app.services.crm_service import serialize_deal
from app.services.serializers import (
    build_driver_profiles,
    serialize_chat_message,
    serialize_knowledge_doc,
    serialize_legal_doc,
    serialize_order,
)
from app.services.timesheets_service import serialize_shift

router = APIRouter(tags=["Operational Chat, Files & MAX Bot"])

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_UPLOAD_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp", ".pdf", ".docx", ".xlsx", ".txt"}


class ConfirmWorkRequest(CamelModel):
    branch_id: str = "branch-hq"
    type: Literal["hours", "shift_close", "volume_trips"]
    value: str
    shift_id: Optional[str] = None
    equipment_id: Optional[str] = None
    deal_id: Optional[str] = None
    request_label: Optional[str] = None
    comment: Optional[str] = None


class MaxWebhookRequest(CamelModel):
    branch_id: str
    event_type: Literal["new_request", "confirm_hours", "message"]
    client_name: str
    contact_person: Optional[str] = None
    phone: str
    client_type: Optional[ClientTypeEnum] = ClientTypeEnum.legal_entity
    has_contract: bool = True
    equipment_type: Optional[EquipmentTypeEnum] = EquipmentTypeEnum.excavator
    hours_requested: int = 24
    hourly_rate: Decimal = Decimal("3400.00")
    site_address: str = "Объект заказчика"
    text: str = ""
    deal_id: Optional[str] = None


class MaxDispatchRequest(CamelModel):
    branch_id: str
    recipient_phone: str
    message: str


@router.get("/chat/messages", response_model=List[ChatMessageResponse])
async def list_chat_messages(
    branch_id: Optional[str] = Query(default="all"),
    deal_id: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ChatMessageResponse]:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(ClientCommunication).order_by(ClientCommunication.created_at.asc())
    if scoped and scoped != "all":
        stmt = stmt.where(ClientCommunication.branch_id == scoped)
    if deal_id:
        stmt = stmt.where(ClientCommunication.deal_id == deal_id)
    rows = (await db.execute(stmt)).scalars().all()
    return [serialize_chat_message(r) for r in rows]


@router.post("/chat/messages", response_model=ChatMessageResponse, status_code=status.HTTP_201_CREATED)
async def post_chat_message(
    payload: ChatMessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatMessageResponse:
    enforce_branch_scope(current_user, payload.branch_id)
    msg = ClientCommunication(
        id=f"msg-{uuid.uuid4().hex[:10]}",
        branch_id=payload.branch_id,
        deal_id=payload.deal_id,
        sender_name=payload.sender_name,
        sender_role=payload.sender_role,
        message_text=payload.text,
        attachment=payload.attachment.model_dump(by_alias=True) if payload.attachment else None,
        confirmation=payload.confirmation.model_dump(by_alias=True) if payload.confirmation else None,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return serialize_chat_message(msg)


@router.post("/files/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    category: Literal["requisites", "site_photo", "other"] = Form("other"),
    _user: User = Depends(get_current_user),
) -> FileUploadResponse:
    settings = get_settings()
    orig_name = Path(file.filename or "file.bin").name
    ext = Path(orig_name).suffix.lower()
    if ext not in ALLOWED_UPLOAD_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Неподдерживаемый формат файла: {ext}")

    raw = await file.read()
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Размер файла превышает 10 МБ")

    file_id = f"file-{uuid.uuid4().hex[:10]}"
    safe_filename = f"{file_id}{ext}"
    base_dir = settings.upload_path
    dest = (base_dir / safe_filename).resolve()
    if not dest.is_relative_to(base_dir):
        raise HTTPException(status_code=400, detail="Недопустимый путь сохранения файла")
    dest.write_bytes(raw)

    return FileUploadResponse(
        id=file_id,
        name=orig_name,
        size=len(raw),
        mime_type=file.content_type or "application/octet-stream",
        category=category,
        preview_url=f"/uploads/{safe_filename}",
    )


@router.post("/chat/confirm-work")
async def confirm_work_in_chat(
    payload: ConfirmWorkRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    enforce_branch_scope(current_user, payload.branch_id)
    admin_cfg = (
        await db.execute(select(SystemAdminConfigModel).where(SystemAdminConfigModel.id == 1))
    ).scalar_one_or_none()
    if not admin_cfg or not admin_cfg.admin_confirmation_allowed:
        raise HTTPException(
            status_code=403,
            detail="Подтверждение работ заблокировано администратором (adminConfirmationAllowed = false)",
        )

    active_deals_cnt = (
        await db.execute(
            select(func.count()).select_from(CRMDeal).where(
                CRMDeal.branch_id == payload.branch_id,
                CRMDeal.stage == CRMStageEnum.active,
            )
        )
    ).scalar_one()
    active_orders_cnt = (
        await db.execute(
            select(func.count()).select_from(RentalOrder).where(
                RentalOrder.branch_id == payload.branch_id,
                RentalOrder.status == OrderStatusEnum.active,
            )
        )
    ).scalar_one()
    if (active_deals_cnt + active_orders_cnt) == 0:
        raise HTTPException(
            status_code=409,
            detail="На участке нет ни одной активной заявки CRM или заказа-наряда",
        )

    if payload.shift_id:
        shift = (
            await db.execute(
                select(ShiftReport).where(
                    ShiftReport.id == payload.shift_id, ShiftReport.branch_id == payload.branch_id
                )
            )
        ).scalar_one_or_none()
        if shift:
            shift.status = ShiftStatusEnum.approved

    conf = DealConfirmation(
        branch_id=payload.branch_id,
        deal_id=payload.deal_id,
        confirmation_type=payload.type,
        label=payload.request_label or payload.type,
        value_text=payload.value,
        approved_by_admin=True,
    )
    db.add(conf)

    comm = ClientCommunication(
        id=f"msg-{uuid.uuid4().hex[:10]}",
        branch_id=payload.branch_id,
        deal_id=payload.deal_id,
        sender_name=current_user.full_name,
        sender_role="admin",
        message_text=payload.comment or f"Подтверждение работ ({payload.request_label or payload.type}): {payload.value}",
        confirmation={
            "type": payload.type,
            "label": payload.request_label or payload.type,
            "value": payload.value,
            "approvedByAdmin": True,
        },
    )
    db.add(comm)
    await db.commit()
    await db.refresh(comm)
    return {"success": True, "chatMessage": serialize_chat_message(comm).model_dump(by_alias=True)}


@router.post("/chat/agent", response_model=ChatAgentQueryResponse)
async def query_chat_agent(
    payload: ChatAgentQueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ChatAgentQueryResponse:
    scoped = enforce_branch_scope(current_user, payload.branch_id) if payload.branch_id else None
    if scoped and scoped != "all":
        chats = (
            await db.execute(select(ClientCommunication).where(ClientCommunication.branch_id == scoped))
        ).scalars().all()
        deals = (await db.execute(select(CRMDeal).where(CRMDeal.branch_id == scoped))).scalars().all()
        orders = (await db.execute(select(RentalOrder).where(RentalOrder.branch_id == scoped))).scalars().all()
        eqs = (await db.execute(select(Equipment).where(Equipment.branch_id == scoped))).scalars().all()
        drivers, _ = await build_driver_profiles(db, scoped)
        cdocs = (await db.execute(select(ClosingDocument).where(ClosingDocument.branch_id == scoped))).scalars().all()
        shifts = (await db.execute(select(ShiftReport).where(ShiftReport.branch_id == scoped))).scalars().all()
        legals = (await db.execute(select(Contract))).scalars().all()
        kbs = (await db.execute(select(KnowledgeDocument))).scalars().all()
        eq_map = {e.id: e.name for e in eqs}
        context_payload = {
            "activeScope": payload.branch_name,
            "chatMessages": [serialize_chat_message(c).model_dump(by_alias=True) for c in chats[-40:]],
            "knowledgeBase": [serialize_knowledge_doc(k).model_dump(by_alias=True) for k in kbs[:25]],
            "crmDeals": [serialize_deal(d).model_dump(by_alias=True) for d in deals[:35]],
            "rentalOrders": [serialize_order(o, eq_map.get(o.equipment_id)).model_dump(by_alias=True) for o in orders[:35]],
            "fleetUnits": [serialize_equipment(e).model_dump(by_alias=True) for e in eqs[:40]],
            "drivers": [dr.model_dump(by_alias=True) for dr in drivers[:40]],
            "legalDocuments": [serialize_legal_doc(l).model_dump(by_alias=True) for l in legals[:25]],
            "closingDocs": [serialize_closing_doc(cd).model_dump(by_alias=True) for cd in cdocs[:30]],
            "shiftReports": [serialize_shift(sh, eq_map.get(sh.equipment_id, "")).model_dump(by_alias=True) for sh in shifts[:25]],
        }
    else:
        context_payload = {
            "activeScope": payload.branch_name,
            "chatMessages": payload.chat_messages[-40:],
            "knowledgeBase": payload.knowledge_base[:25],
            "crmDeals": payload.crm_deals[:35],
            "rentalOrders": payload.rental_orders[:35],
            "fleetUnits": payload.fleet_units[:40],
            "drivers": payload.drivers[:40],
            "legalDocuments": payload.legal_documents[:25],
            "closingDocs": payload.closing_docs[:30],
            "shiftReports": payload.shift_reports[:25],
        }

    model, data = run_chat_agent_search(
        query=payload.query,
        history=[h.model_dump() for h in payload.history],
        branch_name=payload.branch_name,
        context_payload=context_payload,
        llm_config=payload.llm_config,
    )
    return ChatAgentQueryResponse(success=True, model=model, data=data)


@router.get("/max-bot/config/{branch_id}", response_model=MaxCustomerBotConfigSchema)
async def get_max_bot_config(
    branch_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MaxCustomerBotConfigSchema:
    enforce_branch_scope(current_user, branch_id)
    row = (
        await db.execute(select(MaxCustomerBotConfig).where(MaxCustomerBotConfig.branch_id == branch_id))
    ).scalar_one_or_none()
    if not row:
        return MaxCustomerBotConfigSchema()
    return MaxCustomerBotConfigSchema(
        enabled=row.enabled,
        allow_new_rental_requests=row.allow_new_rental_requests,
        allow_shift_hour_confirmation=row.allow_shift_hour_confirmation,
        allow_site_chat_and_photos=row.allow_site_chat_and_photos,
        autoRouteTo1C=row.auto_route_to_1c,
        require_manager_moderation=row.require_manager_moderation,
    )


@router.put("/max-bot/config/{branch_id}", response_model=MaxCustomerBotConfigSchema)
async def update_max_bot_config(
    branch_id: str,
    payload: MaxCustomerBotConfigSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MaxCustomerBotConfigSchema:
    enforce_branch_scope(current_user, branch_id)
    row = (
        await db.execute(select(MaxCustomerBotConfig).where(MaxCustomerBotConfig.branch_id == branch_id))
    ).scalar_one_or_none()
    if not row:
        row = MaxCustomerBotConfig(branch_id=branch_id)
        db.add(row)
    row.enabled = payload.enabled
    row.allow_new_rental_requests = payload.allow_new_rental_requests
    row.allow_shift_hour_confirmation = payload.allow_shift_hour_confirmation
    row.allow_site_chat_and_photos = payload.allow_site_chat_and_photos
    row.auto_route_to_1c = payload.auto_route_to_1c
    row.require_manager_moderation = payload.require_manager_moderation
    await db.commit()
    return payload


@router.post("/max-bot/webhook", status_code=status.HTTP_201_CREATED)
async def handle_max_webhook(
    payload: MaxWebhookRequest,
    x_max_webhook_secret: Optional[str] = Header(default=None, alias="X-MAX-Webhook-Secret"),
    authorization: Optional[str] = Header(default=None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    expected_secret = (os.getenv("MAX_WEBHOOK_SECRET") or "").strip()
    if expected_secret:
        if not x_max_webhook_secret or not hmac.compare_digest(x_max_webhook_secret, expected_secret):
            raise HTTPException(status_code=401, detail="Неверный секретный заголовок X-MAX-Webhook-Secret")
    else:
        if not authorization or not authorization.lower().startswith("bearer "):
            raise HTTPException(
                status_code=401,
                detail="Требуется X-MAX-Webhook-Secret (при заданном MAX_WEBHOOK_SECRET) или Bearer-авторизация",
            )
        from app.core.security import decode_token
        decode_token(authorization.split(" ", 1)[1].strip())

    cfg = (
        await db.execute(select(MaxCustomerBotConfig).where(MaxCustomerBotConfig.branch_id == payload.branch_id))
    ).scalar_one_or_none()
    if cfg and not cfg.enabled:
        raise HTTPException(status_code=403, detail="Клиентский бот MAX на данном участке отключён")

    if payload.event_type == "new_request":
        if cfg and not cfg.allow_new_rental_requests:
            raise HTTPException(status_code=403, detail="Приём заявок через бот MAX отключён")
        ctype = payload.client_type or ClientTypeEnum.legal_entity
        subj = (
            AccountingSubjectEnum.ooo_specialtech
            if (not cfg or cfg.auto_route_to_1c) and ctype == ClientTypeEnum.legal_entity
            else AccountingSubjectEnum.ip_specialtechnica
        )
        deal = CRMDeal(
            id=f"deal-{uuid.uuid4().hex[:8]}",
            branch_id=payload.branch_id,
            client_name=payload.client_name,
            contact_person=payload.contact_person or payload.client_name,
            phone=payload.phone,
            client_type=ctype,
            has_contract=payload.has_contract,
            accounting_subject=subj,
            equipment_type=payload.equipment_type or EquipmentTypeEnum.excavator,
            hours_requested=payload.hours_requested,
            hourly_rate_agreed=payload.hourly_rate,
            estimated_amount=(Decimal(payload.hours_requested) * payload.hourly_rate).quantize(Decimal("0.01")),
            stage=CRMStageEnum.lead,
            debt_amount=Decimal("0.00"),
            paid_amount=Decimal("0.00"),
            site_address=payload.site_address,
            doc_date=date.today(),
            manager="Бот MAX (автоприём)",
            stage_updated_at=datetime.now(timezone.utc),
        )
        db.add(deal)
        await db.commit()
        return {"accepted": True, "dealId": deal.id, "accountingSubject": subj.value}

    comm = ClientCommunication(
        id=f"msg-{uuid.uuid4().hex[:10]}",
        branch_id=payload.branch_id,
        deal_id=payload.deal_id,
        sender_name=payload.contact_person or payload.client_name,
        sender_role="client",
        message_text=payload.text or f"[MAX Бот] Событие: {payload.event_type}",
    )
    db.add(comm)
    await db.commit()
    return {"accepted": True, "messageId": comm.id}


@router.post("/max-bot/dispatch")
async def dispatch_max_message(
    payload: MaxDispatchRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    enforce_branch_scope(current_user, payload.branch_id)
    return {
        "dispatched": True,
        "branchId": payload.branch_id,
        "recipientPhone": payload.recipient_phone,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
