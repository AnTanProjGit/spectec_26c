import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.crm import CRMDeal, ClientCommunication, MaxCustomerBotConfig
from app.models.enums import (
    AccountingSubjectEnum,
    CRMStageEnum,
    ClosingDocKindEnum,
    InvoiceStatusEnum,
    LegalDocKindEnum,
    LegalDocStatusEnum,
    NotificationCategoryEnum,
    SystemRoleEnum,
)
from app.models.erp import (
    Contract,
    LegalHistory,
    RentalOrder,
    StatusNotification,
    StatusNotificationSettings,
)
from app.models.forms import ClosingDocument
from app.schemas.crm_erp import ClosingDocumentRecord, StatusNotificationItem


def calculate_vat(total_amount: Decimal, subject: AccountingSubjectEnum) -> Decimal:
    if subject == AccountingSubjectEnum.ooo_specialtech:
        return (total_amount * Decimal("20") / Decimal("120")).quantize(Decimal("0.01"))
    return Decimal("0.00")


def serialize_closing_doc(doc: ClosingDocument) -> ClosingDocumentRecord:
    return ClosingDocumentRecord(
        id=doc.id,
        kind=doc.kind.value,
        number=doc.doc_number,
        date=doc.doc_date,
        period_start=doc.period_start,
        period_end=doc.period_end,
        branch_id=doc.branch_id,
        source_type=doc.source_type,  # type: ignore[arg-type]
        source_id=doc.source_id,
        order_or_deal_number=doc.order_or_deal_number,
        client_name=doc.client_name,
        client_inn=doc.client_inn,
        client_address=doc.client_address,
        site_address=doc.site_address,
        equipment_name=doc.equipment_name,
        operator_name=doc.operator_name,
        work_description=doc.work_description,
        unit_label=doc.unit_label,
        quantity=doc.quantity,
        rate_rub=doc.rate_rub,
        total_amount_rub=doc.total_amount_rub,
        vat_amount_rub=doc.vat_amount_rub,
        accounting_subject=doc.accounting_subject.value,
        saved_to_base=doc.saved_to_base,
        saved_at=doc.saved_at,
        invoice_status=doc.invoice_status.value if doc.invoice_status else None,
        paid_amount_rub=doc.paid_amount_rub,
        printed_count=doc.printed_count,
        content_text=doc.content_text,
    )


async def sync_closing_doc_to_source_and_legal(
    db: AsyncSession,
    record: ClosingDocumentRecord,
    actor_name: str,
    actor_role: SystemRoleEnum = SystemRoleEnum.admin,
    notif_category: NotificationCategoryEnum = NotificationCategoryEnum.act_ks2,
) -> tuple[ClosingDocumentRecord, Optional[StatusNotificationItem]]:
    """4-step transactional cascade matching App.tsx:syncClosingDocToSourceAndLegal."""
    kind_enum = ClosingDocKindEnum(record.kind.value)
    subj_enum = AccountingSubjectEnum(record.accounting_subject.value)
    inv_status_enum = InvoiceStatusEnum(record.invoice_status.value) if record.invoice_status else None

    # 1. Upsert forms.closing_documents
    existing = (await db.execute(select(ClosingDocument).where(ClosingDocument.id == record.id))).scalar_one_or_none()
    if existing:
        existing.doc_number = record.number
        existing.doc_date = record.date
        existing.period_start = record.period_start
        existing.period_end = record.period_end
        existing.quantity = record.quantity
        existing.rate_rub = record.rate_rub
        existing.total_amount_rub = record.total_amount_rub
        existing.vat_amount_rub = record.vat_amount_rub
        existing.accounting_subject = subj_enum
        existing.saved_to_base = True
        existing.invoice_status = inv_status_enum
        existing.paid_amount_rub = record.paid_amount_rub
        existing.content_text = record.content_text
        doc_row = existing
    else:
        doc_row = ClosingDocument(
            id=record.id,
            branch_id=record.branch_id,
            kind=kind_enum,
            doc_number=record.number,
            doc_date=record.date,
            period_start=record.period_start,
            period_end=record.period_end,
            source_type=record.source_type,
            source_id=record.source_id,
            order_or_deal_number=record.order_or_deal_number,
            client_name=record.client_name,
            client_inn=record.client_inn,
            client_address=record.client_address,
            site_address=record.site_address,
            equipment_name=record.equipment_name,
            operator_name=record.operator_name,
            work_description=record.work_description,
            unit_label=record.unit_label,
            quantity=record.quantity,
            rate_rub=record.rate_rub,
            total_amount_rub=record.total_amount_rub,
            vat_amount_rub=record.vat_amount_rub,
            accounting_subject=subj_enum,
            saved_to_base=True,
            invoice_status=inv_status_enum,
            paid_amount_rub=record.paid_amount_rub,
            printed_count=record.printed_count,
            content_text=record.content_text,
        )
        db.add(doc_row)

    # 2. Upsert into unified erp.contracts (`leg-*`) + erp.legal_history
    leg_id = f"leg-{record.id}"
    kind_labels = {
        ClosingDocKindEnum.act_services: "Акт оказанных услуг",
        ClosingDocKindEnum.ks2: "Акт КС-2 (ОКУД 0322005)",
        ClosingDocKindEnum.ks3: "Справка КС-3 (ОКУД 0322001)",
        ClosingDocKindEnum.invoice: "Счёт на оплату",
    }
    leg_title = f"{kind_labels[kind_enum]} № {record.number} ({record.order_or_deal_number})"
    leg_row = (await db.execute(select(Contract).where(Contract.id == leg_id))).scalar_one_or_none()
    if leg_row:
        leg_row.number = record.number
        leg_row.title = leg_title
        leg_row.amount_rub = record.total_amount_rub
        leg_row.content = record.content_text
        leg_row.in_knowledge_base = True
    else:
        db.add(
            Contract(
                id=leg_id,
                branch_id=record.branch_id,
                number=record.number,
                title=leg_title,
                kind=LegalDocKindEnum.addendum,
                counterparty=record.client_name,
                accounting_subject=subj_enum,
                status=LegalDocStatusEnum.active,
                doc_date=record.date,
                author_name=actor_name,
                amount_rub=record.total_amount_rub,
                linked_order_number=record.order_or_deal_number,
                in_knowledge_base=True,
                content=record.content_text,
            )
        )
    db.add(
        LegalHistory(
            id=f"lh-{uuid.uuid4().hex[:10]}",
            document_id=leg_id,
            document_number=record.number,
            document_title=leg_title,
            action="saved_to_base",
            actor_role=actor_role,
            actor_name=actor_name,
            details=f"Сохранено из модуля закрывающих документов ({record.order_or_deal_number})",
        )
    )

    # 3. Sync source RentalOrder or CRMDeal
    if record.source_type == "order":
        order = (await db.execute(select(RentalOrder).where(RentalOrder.id == record.source_id))).scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Заказ-наряд не найден")
        if kind_enum == ClosingDocKindEnum.act_services:
            order.act_number = record.number
            order.act_saved_to_base = True
            order.act_signed = True
            order.closed_volume_hours = record.quantity
        elif kind_enum == ClosingDocKindEnum.ks2:
            order.ks2_number = record.number
            order.ks2_saved_to_base = True
            order.act_signed = True
            order.closed_volume_hours = record.quantity
        elif kind_enum == ClosingDocKindEnum.ks3:
            order.ks3_number = record.number
            order.ks3_saved_to_base = True
        elif kind_enum == ClosingDocKindEnum.invoice:
            order.invoice_number = record.number
            order.invoice_date = record.date
            order.invoice_saved_to_base = True
            if inv_status_enum:
                order.invoice_status = inv_status_enum
            if record.paid_amount_rub is not None:
                order.paid_amount = record.paid_amount_rub
        if record.total_amount_rub > 0:
            order.total_amount = record.total_amount_rub
    else:
        deal = (await db.execute(select(CRMDeal).where(CRMDeal.id == record.source_id))).scalar_one_or_none()
        if not deal:
            raise HTTPException(status_code=404, detail="Сделка CRM не найдена")
        if kind_enum == ClosingDocKindEnum.act_services:
            deal.act_number = record.number
            deal.act_saved_to_base = True
            deal.act_signed = True
            deal.closed_volume_hours = record.quantity
        elif kind_enum == ClosingDocKindEnum.ks2:
            deal.ks2_number = record.number
            deal.ks2_saved_to_base = True
            deal.act_signed = True
            deal.closed_volume_hours = record.quantity
        elif kind_enum == ClosingDocKindEnum.ks3:
            deal.ks3_number = record.number
            deal.ks3_saved_to_base = True
        elif kind_enum == ClosingDocKindEnum.invoice:
            deal.invoice_number = record.number
            deal.invoice_date = record.date
            deal.invoice_saved_to_base = True
            if inv_status_enum:
                deal.invoice_status = inv_status_enum
            if record.paid_amount_rub is not None:
                deal.paid_amount = record.paid_amount_rub
        if record.total_amount_rub > 0:
            deal.estimated_amount = record.total_amount_rub
            paid = deal.paid_amount or Decimal("0.00")
            deal.debt_amount = max(Decimal("0.00"), deal.estimated_amount - paid)
            if deal.stage == CRMStageEnum.completed and deal.debt_amount > 0:
                deal.stage = CRMStageEnum.active
                deal.completed_at = None
                deal.archived_at = None
                deal.stage_updated_at = datetime.now(timezone.utc)

    # 4. Generate notification & push to branch chat / MAX config
    settings_row = (
        await db.execute(select(StatusNotificationSettings).where(StatusNotificationSettings.id == 1))
    ).scalar_one_or_none()
    notif_out: Optional[StatusNotificationItem] = None
    if not settings_row or settings_row.enabled:
        channels = ["erp"]
        if not settings_row or settings_row.send_to_branch_chat:
            channels.append("chat")
        max_cfg = (
            await db.execute(
                select(MaxCustomerBotConfig).where(MaxCustomerBotConfig.branch_id == record.branch_id)
            )
        ).scalar_one_or_none()
        if settings_row and settings_row.send_to_max_client_bot and (not max_cfg or max_cfg.enabled):
            channels.append("max_bot")

        notif_id = f"notif-{uuid.uuid4().hex[:10]}"
        msg_text = f"{kind_labels[kind_enum]} № {record.number} ({record.client_name}) — {record.total_amount_rub:,.2f} ₽"
        notif_row = StatusNotification(
            id=notif_id,
            branch_id=record.branch_id,
            title=leg_title,
            message=msg_text,
            category=notif_category,
            entity_label=record.order_or_deal_number,
            channels=channels,
            is_read=False,
        )
        db.add(notif_row)
        if "chat" in channels:
            db.add(
                ClientCommunication(
                    id=f"msg-{uuid.uuid4().hex[:10]}",
                    branch_id=record.branch_id,
                    deal_id=record.source_id if record.source_type == "deal" else None,
                    sender_name=actor_name,
                    sender_role="admin",
                    message_text=f"[ERP] {msg_text}",
                )
            )
        notif_out = StatusNotificationItem(
            id=notif_id,
            timestamp=datetime.now(timezone.utc),
            branch_id=record.branch_id,
            title=leg_title,
            message=msg_text,
            category=notif_category.value,
            entity_label=record.order_or_deal_number,
            channels=channels,
            read=False,
        )

    await db.flush()
    return serialize_closing_doc(doc_row), notif_out
