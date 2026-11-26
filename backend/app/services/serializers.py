from datetime import timezone
from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.admin import RoleAccessPolicy, SystemAdminConfigModel
from app.models.crm import ClientCommunication
from app.models.driver import Driver, DriverCard, DriverEquipmentBinding, DriverTimesheetDay
from app.models.enums import AccountingSubjectEnum, SystemRoleEnum
from app.models.erp import (
    AccountingSubject,
    Contract,
    LegalHistory,
    RentalOrder,
    StatusNotification,
    StatusNotificationSettings,
)
from app.models.rag import KnowledgeDocument
from app.schemas.admin_legal import (
    KnowledgeDocResponse,
    LegalDocumentResponse,
    LegalHistoryEntryResponse,
    LlmAdminSettings,
    OneCIntegrationConfig,
    OneCRoutingRules,
    OneCSubjectConfig,
    RagBaseAdminSettings,
    RoleAccessFieldsPolicy,
    RoleAccessPolicySchema,
    SystemAdminConfigSchema,
    TableViewSettings,
    TelemetrySensorsAdminSettings,
)
from app.schemas.base import AccountingSubjectId, LegalRole, SystemRoleId, TableViewId
from app.schemas.crm_erp import (
    ChatMessageResponse,
    RentalOrderResponse,
    StatusNotificationItem,
    StatusNotificationSettingsSchema,
)
from app.schemas.drivers import DriverProfileResponse, DriverReplacementRecord


def serialize_order(order: RentalOrder, equipment_name: Optional[str] = None) -> RentalOrderResponse:
    total = order.total_amount or Decimal("0.00")
    paid = order.paid_amount or Decimal("0.00")
    debt = max(Decimal("0.00"), total - paid)
    return RentalOrderResponse(
        id=order.id,
        branch_id=order.branch_id,
        order_number=order.order_number,
        client_name=order.client_name,
        client_type=order.client_type.value,
        has_contract=order.has_contract,
        accounting_subject=order.accounting_subject.value,
        equipment_id=order.equipment_id,
        equipment_name=equipment_name,
        operator_name=order.operator_name,
        site_address=order.site_address,
        start_date=order.doc_date,
        end_date=order.end_date,
        planned_hours=order.planned_hours,
        actual_hours=order.actual_hours,
        closed_volume_hours=order.closed_volume_hours,
        hourly_rate=order.hourly_rate,
        total_amount=total,
        paid_amount=paid,
        debt_amount=debt,
        act_signed=order.act_signed,
        act_number=order.act_number,
        ks2_number=order.ks2_number,
        ks3_number=order.ks3_number,
        act_saved_to_base=order.act_saved_to_base,
        ks2_saved_to_base=order.ks2_saved_to_base,
        ks3_saved_to_base=order.ks3_saved_to_base,
        invoice_number=order.invoice_number,
        invoice_date=order.invoice_date,
        invoice_status=order.invoice_status.value,
        invoice_saved_to_base=order.invoice_saved_to_base,
        status=order.status.value,
    )


def serialize_chat_message(msg: ClientCommunication) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=msg.id,
        branch_id=msg.branch_id,
        deal_id=msg.deal_id,
        sender_name=msg.sender_name,
        sender_role=msg.sender_role,  # type: ignore[arg-type]
        text=msg.message_text,
        attachment=msg.attachment,
        confirmation=msg.confirmation,
        timestamp=msg.created_at.strftime("%Y-%m-%d %H:%M") if msg.created_at else "",
    )


def serialize_legal_doc(doc: Contract) -> LegalDocumentResponse:
    return LegalDocumentResponse(
        id=doc.id,
        number=doc.number,
        title=doc.title,
        kind=doc.kind.value,
        branch_id=doc.branch_id,
        counterparty=doc.counterparty,
        accounting_subject=doc.accounting_subject.value,
        status=doc.status.value,
        amount_rub=doc.amount_rub,
        dispute_amount_rub=doc.dispute_amount_rub,
        dispute_reason=doc.dispute_reason,
        linked_order_number=doc.linked_order_number,
        in_knowledge_base=doc.in_knowledge_base,
        content=doc.content,
        created_at=doc.created_at.date() if doc.created_at else doc.doc_date,
        updated_at=doc.updated_at.date() if doc.updated_at else doc.doc_date,
        author_name=doc.author_name,
    )


def serialize_legal_history(entry: LegalHistory) -> LegalHistoryEntryResponse:
    role_val = entry.actor_role.value
    legal_role = role_val if role_val in {r.value for r in LegalRole} else LegalRole.ADMIN.value
    return LegalHistoryEntryResponse(
        id=entry.id,
        document_id=entry.document_id,
        document_number=entry.document_number,
        document_title=entry.document_title,
        action=entry.action,  # type: ignore[arg-type]
        actor_role=legal_role,  # type: ignore[arg-type]
        actor_name=entry.actor_name,
        timestamp=entry.created_at.strftime("%Y-%m-%d %H:%M") if entry.created_at else "",
        details=entry.details,
    )


def serialize_knowledge_doc(doc: KnowledgeDocument) -> KnowledgeDocResponse:
    return KnowledgeDocResponse(
        id=doc.id,
        title=doc.title,
        category=doc.category.value,
        code=doc.code,
        excerpt=doc.excerpt,
        tags=list(doc.tags or []),
        full_text=doc.full_text,
        date_updated=doc.date_updated,
    )


def serialize_notification(row: StatusNotification) -> StatusNotificationItem:
    return StatusNotificationItem(
        id=row.id,
        timestamp=row.created_at,
        branch_id=row.branch_id,
        title=row.title,
        message=row.message,
        category=row.category.value,
        entity_label=row.entity_label,
        channels=list(row.channels or ["erp"]),
        read=row.is_read,
    )


def serialize_notification_settings(row: Optional[StatusNotificationSettings]) -> StatusNotificationSettingsSchema:
    if not row:
        return StatusNotificationSettingsSchema()
    return StatusNotificationSettingsSchema(
        enabled=row.enabled,
        on_volume_close_act_ks2=row.on_volume_close_act_ks2,
        on_act_signed_change=row.on_act_signed_change,
        on_invoice_issued=row.on_invoice_issued,
        on_invoice_status_change=row.on_invoice_status_change,
        send_to_branch_chat=row.send_to_branch_chat,
        send_to_max_client_bot=row.send_to_max_client_bot,
        remind_debt_overdue_days=row.remind_debt_overdue_days,
    )


async def build_driver_profiles(
    db: AsyncSession, branch_id: Optional[str] = None
) -> tuple[List[DriverProfileResponse], Dict[str, DriverReplacementRecord]]:
    drv_stmt = select(Driver)
    if branch_id and branch_id != "all":
        drv_stmt = drv_stmt.where(Driver.branch_id == branch_id)
    drivers = (await db.execute(drv_stmt)).scalars().all()
    if not drivers:
        return [], {}

    driver_ids = [d.id for d in drivers]
    cards = (
        await db.execute(select(DriverCard).where(DriverCard.driver_id.in_(driver_ids), DriverCard.is_active.is_(True)))
    ).scalars().all()
    bindings = (
        await db.execute(select(DriverEquipmentBinding).where(DriverEquipmentBinding.driver_id.in_(driver_ids)))
    ).scalars().all()
    days = (
        await db.execute(select(DriverTimesheetDay).where(DriverTimesheetDay.driver_id.in_(driver_ids)))
    ).scalars().all()

    card_by_driver: Dict[str, DriverCard] = {c.driver_id: c for c in cards}
    eq_by_driver: Dict[str, List[str]] = {}
    replacements: Dict[str, DriverReplacementRecord] = {}
    drv_map = {d.id: d for d in drivers}

    for b in bindings:
        if b.is_temporary_replacement:
            d = drv_map.get(b.driver_id)
            if d:
                replacements[b.equipment_id] = DriverReplacementRecord(
                    equipment_id=b.equipment_id,
                    driver_id=d.id,
                    driver_name=d.name,
                    driver_phone=d.phone,
                    set_by_role="fleet_manager" if b.set_by_role != "director_admin" else "director_admin",
                    reason=b.reason,
                    updated_at=b.updated_at,
                )
        else:
            eq_by_driver.setdefault(b.driver_id, []).append(b.equipment_id)

    days_by_driver: Dict[str, Dict[str, str]] = {}
    for day in days:
        days_by_driver.setdefault(day.driver_id, {})[day.doc_date.isoformat()] = day.day_code.value

    profiles: List[DriverProfileResponse] = []
    for d in drivers:
        card = card_by_driver.get(d.id)
        profiles.append(
            DriverProfileResponse(
                id=d.id,
                branch_id=d.branch_id,
                name=d.name,
                phone=d.phone,
                max_linked=d.max_linked,
                card_last4=card.card_last4 if card else None,
                card_limit_rub=card.monthly_limit_rub if card else Decimal("150000.00"),
                assigned_equipment_ids=eq_by_driver.get(d.id, []),
                shift_roster=d.shift_roster.value,
                needs_replacement=d.needs_replacement,
                replacement_reason=d.replacement_reason,
                timesheet_days=days_by_driver.get(d.id, {}),  # type: ignore[arg-type]
            )
        )
    return profiles, replacements


async def load_one_c_config(db: AsyncSession) -> OneCIntegrationConfig:
    rows = (await db.execute(select(AccountingSubject))).scalars().all()
    subjects: Dict[AccountingSubjectId, OneCSubjectConfig] = {}
    routing = OneCRoutingRules(
        legal_entity_target=AccountingSubjectId.OOO_SPECIALTECH,
        individual_with_contract_target=AccountingSubjectId.IP_SPECIALTECHNICA,
        individual_without_contract_target=AccountingSubjectId.IP_SPECIALTECHNICA,
        allow_individual_without_contract=True,
        require_contract_for_legal_entity=True,
    )
    for row in rows:
        sid = AccountingSubjectId(row.id.value)
        subjects[sid] = OneCSubjectConfig(
            id=sid,
            entity_name=row.entity_name,
            short_name=row.short_name,
            tax_system=row.tax_system,
            inn=row.inn,
            odata_url=row.odata_url,
            api_login=row.api_login,
            api_secret="",
            exchange_format=row.exchange_format,  # type: ignore[arg-type]
            auto_sync_docs=row.auto_sync_docs,
            enabled=row.enabled,
            connection_status=row.connection_status,  # type: ignore[arg-type]
            last_checked_at=row.last_checked_at.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M")
            if row.last_checked_at
            else None,
        )
        if row.routing_rules:
            try:
                routing = OneCRoutingRules.model_validate(row.routing_rules)
            except Exception:
                pass
    return OneCIntegrationConfig(subjects=subjects, routing=routing)


async def load_admin_config(db: AsyncSession) -> SystemAdminConfigSchema:
    cfg = (await db.execute(select(SystemAdminConfigModel).where(SystemAdminConfigModel.id == 1))).scalar_one_or_none()
    policies = (await db.execute(select(RoleAccessPolicy))).scalars().all()

    tables: Dict[TableViewId, TableViewSettings] = {}
    if cfg and cfg.tables_config:
        for k, v in cfg.tables_config.items():
            try:
                tables[TableViewId(k)] = TableViewSettings.model_validate(v)
            except Exception:
                pass

    llm = LlmAdminSettings.model_validate(cfg.llm_config) if (cfg and cfg.llm_config) else LlmAdminSettings()
    rag = RagBaseAdminSettings.model_validate(cfg.rag_config) if (cfg and cfg.rag_config) else RagBaseAdminSettings()
    tel = (
        TelemetrySensorsAdminSettings.model_validate(cfg.telemetry_sensors_config)
        if (cfg and cfg.telemetry_sensors_config)
        else TelemetrySensorsAdminSettings()
    )

    access_policies: Dict[SystemRoleId, RoleAccessPolicySchema] = {}
    for p in policies:
        rid = SystemRoleId(p.role_code.value)
        access_policies[rid] = RoleAccessPolicySchema(
            role=rid,
            label=p.label,
            description=p.description,
            pages=p.pages or {},
            fields=RoleAccessFieldsPolicy.model_validate(p.fields or {}),
        )

    return SystemAdminConfigSchema(
        tables=tables,
        llm=llm,
        knowledge_rag=rag,
        telemetry_sensors=tel,
        access_policies=access_policies,
        admin_confirmation_allowed=bool(cfg.admin_confirmation_allowed) if cfg else False,
    )
