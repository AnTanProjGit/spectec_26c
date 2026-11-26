import html
import io
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional

from docx import Document as DocxDocument
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import User
from app.models.crm import CRMDeal, ClientCommunication, MaxCustomerBotConfig
from app.models.enums import (
    AccountingSubjectEnum,
    CRMStageEnum,
    InvoiceStatusEnum,
    NotificationCategoryEnum,
)
from app.models.erp import RentalOrder, StatusNotification, StatusNotificationSettings
from app.models.fleet import Equipment
from app.models.forms import ClosingDocument
from app.schemas.crm_erp import (
    CloseVolumeRequest,
    ClosingDocumentRecord,
    IssueInvoiceRequest,
    StatusNotificationItem,
    UpdateInvoiceStatusRequest,
)
from app.services.closing_docs_service import (
    calculate_vat,
    serialize_closing_doc,
    sync_closing_doc_to_source_and_legal,
)

router = APIRouter(prefix="/closing-docs", tags=["Closing Documents (Act, KS-2, KS-3, Invoice)"])


async def _load_source_meta(db: AsyncSession, source_type: str, source_id: str) -> dict:
    if source_type == "order":
        order = (await db.execute(select(RentalOrder).where(RentalOrder.id == source_id))).scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Заказ-наряд не найден")
        eq = (await db.execute(select(Equipment).where(Equipment.id == order.equipment_id))).scalar_one_or_none()
        return {
            "branch_id": order.branch_id,
            "number": order.order_number,
            "client_name": order.client_name,
            "site_address": order.site_address,
            "equipment_name": eq.name if eq else order.equipment_id,
            "operator_name": order.operator_name,
        }
    deal = (await db.execute(select(CRMDeal).where(CRMDeal.id == source_id))).scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=404, detail="Сделка CRM не найдена")
    eq_name = deal.equipment_type.value
    if deal.equipment_assigned_id:
        eq = (await db.execute(select(Equipment).where(Equipment.id == deal.equipment_assigned_id))).scalar_one_or_none()
        if eq:
            eq_name = eq.name
    return {
        "branch_id": deal.branch_id,
        "number": f"CRM-{deal.id[-6:].upper()}",
        "client_name": deal.client_name,
        "site_address": deal.site_address,
        "equipment_name": eq_name,
        "operator_name": deal.assigned_driver_name or deal.manager,
    }


@router.get("", response_model=List[ClosingDocumentRecord])
async def list_closing_docs(
    branch_id: Optional[str] = Query(default="all"),
    source_type: Optional[str] = Query(default=None),
    source_id: Optional[str] = Query(default=None),
    kind: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[ClosingDocumentRecord]:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(ClosingDocument).order_by(ClosingDocument.doc_date.desc())
    if scoped and scoped != "all":
        stmt = stmt.where(ClosingDocument.branch_id == scoped)
    if source_type:
        stmt = stmt.where(ClosingDocument.source_type == source_type)
    if source_id:
        stmt = stmt.where(ClosingDocument.source_id == source_id)
    if kind:
        stmt = stmt.where(ClosingDocument.kind == kind)
    rows = (await db.execute(stmt)).scalars().all()
    return [serialize_closing_doc(r) for r in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def save_closing_doc(
    payload: ClosingDocumentRecord,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    enforce_branch_scope(current_user, payload.branch_id)
    doc_out, notif_out = await sync_closing_doc_to_source_and_legal(
        db, payload, current_user.full_name, current_user.role, NotificationCategoryEnum.act_ks2
    )
    await db.commit()
    return {
        "document": doc_out.model_dump(by_alias=True),
        "notification": notif_out.model_dump(by_alias=True) if notif_out else None,
    }


@router.post("/close-volume", status_code=status.HTTP_201_CREATED)
async def close_volume_endpoint(
    payload: CloseVolumeRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    meta = await _load_source_meta(db, payload.source_type, payload.source_id)
    enforce_branch_scope(current_user, meta["branch_id"])

    total_rub = (payload.quantity * payload.rate_rub).quantize(Decimal("0.01"))
    subj_enum = AccountingSubjectEnum(payload.accounting_subject.value)
    vat_rub = calculate_vat(total_rub, subj_enum)

    common = dict(
        date=payload.doc_date,
        period_start=payload.period_start,
        period_end=payload.period_end,
        branch_id=meta["branch_id"],
        source_type=payload.source_type,
        source_id=payload.source_id,
        order_or_deal_number=meta["number"],
        client_name=meta["client_name"],
        site_address=meta["site_address"],
        equipment_name=meta["equipment_name"],
        operator_name=meta["operator_name"],
        work_description=payload.work_description,
        unit_label=payload.unit_label,
        quantity=payload.quantity,
        rate_rub=payload.rate_rub,
        total_amount_rub=total_rub,
        vat_amount_rub=vat_rub,
        accounting_subject=payload.accounting_subject,
    )

    act_rec = ClosingDocumentRecord(
        id=f"cdoc-act-{uuid.uuid4().hex[:8]}",
        kind="act_services",
        number=payload.act_number,
        content_text=f"Акт оказанных услуг № {payload.act_number} от {payload.doc_date}: {payload.work_description}, {payload.quantity} {payload.unit_label}, сумма {total_rub} ₽ (в т.ч. НДС {vat_rub} ₽).",
        **common,
    )
    ks2_rec = ClosingDocumentRecord(
        id=f"cdoc-ks2-{uuid.uuid4().hex[:8]}",
        kind="ks2",
        number=payload.ks2_number,
        content_text=f"Унифицированная форма № КС-2 (ОКУД 0322005) № {payload.ks2_number} от {payload.doc_date}: {payload.work_description}, сумма {total_rub} ₽.",
        **common,
    )
    act_out, _ = await sync_closing_doc_to_source_and_legal(
        db, act_rec, current_user.full_name, current_user.role, NotificationCategoryEnum.act_ks2
    )
    ks2_out, notif = await sync_closing_doc_to_source_and_legal(
        db, ks2_rec, current_user.full_name, current_user.role, NotificationCategoryEnum.act_ks2
    )
    ks3_out = None
    if payload.ks3_number:
        ks3_rec = ClosingDocumentRecord(
            id=f"cdoc-ks3-{uuid.uuid4().hex[:8]}",
            kind="ks3",
            number=payload.ks3_number,
            content_text=f"Справка о стоимости выполненных работ № КС-3 (ОКУД 0322001) № {payload.ks3_number} от {payload.doc_date}: сумма {total_rub} ₽.",
            **common,
        )
        ks3_out, notif = await sync_closing_doc_to_source_and_legal(
            db, ks3_rec, current_user.full_name, current_user.role, NotificationCategoryEnum.act_ks2
        )

    await db.commit()
    return {
        "act": act_out.model_dump(by_alias=True),
        "ks2": ks2_out.model_dump(by_alias=True),
        "ks3": ks3_out.model_dump(by_alias=True) if ks3_out else None,
        "notification": notif.model_dump(by_alias=True) if notif else None,
    }


@router.get("/{doc_id}/render")
async def render_closing_document(
    doc_id: str,
    fmt: str = Query(default="html_a4", alias="format"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    doc = (await db.execute(select(ClosingDocument).where(ClosingDocument.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Закрывающий документ не найден")
    enforce_branch_scope(current_user, doc.branch_id)
    doc.printed_count += 1
    await db.commit()

    if fmt == "txt":
        return Response(content=doc.content_text.encode("utf-8"), media_type="text/plain; charset=utf-8")

    if fmt == "docx":
        word = DocxDocument()
        word.add_heading(f"{doc.kind.value.upper()} № {doc.doc_number} от {doc.doc_date.isoformat()}", level=1)
        word.add_paragraph(f"Заказчик: {doc.client_name} (ИНН: {doc.client_inn or '—'})")
        word.add_paragraph(f"Объект: {doc.site_address}")
        word.add_paragraph(f"Техника: {doc.equipment_name} · Оператор: {doc.operator_name}")
        word.add_paragraph(
            f"Объём: {doc.quantity} {doc.unit_label} × {doc.rate_rub} ₽ = {doc.total_amount_rub} ₽ (НДС: {doc.vat_amount_rub} ₽)"
        )
        word.add_paragraph(doc.content_text)
        buf = io.BytesIO()
        word.save(buf)
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{doc.doc_number}.docx"'},
        )

    esc = html.escape
    html_body = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>{esc(doc.doc_number)}</title>
<style>body{{font-family:Arial,sans-serif;max-width:794px;margin:24px auto;color:#111}}table{{width:100%;border-collapse:collapse;margin-top:16px}}td,th{{border:1px solid #333;padding:6px 8px;font-size:13px}}</style>
</head><body>
<h2>{esc(doc.kind.value.upper())} № {esc(doc.doc_number)} от {esc(doc.doc_date.isoformat())}</h2>
<p><strong>Заказчик:</strong> {esc(doc.client_name)} · <strong>Объект:</strong> {esc(doc.site_address)}</p>
<p><strong>Основание:</strong> {esc(doc.order_or_deal_number)} · <strong>Период:</strong> {esc(doc.period_start.isoformat())} — {esc(doc.period_end.isoformat())}</p>
<table><thead><tr><th>Наименование работ / услуг</th><th>Ед.</th><th>Кол-во</th><th>Цена, ₽</th><th>Сумма, ₽</th><th>НДС, ₽</th></tr></thead>
<tbody><tr><td>{esc(doc.work_description)} ({esc(doc.equipment_name)})</td><td>{esc(doc.unit_label)}</td><td>{doc.quantity}</td><td>{doc.rate_rub}</td><td>{doc.total_amount_rub}</td><td>{doc.vat_amount_rub}</td></tr></tbody></table>
<p style="margin-top:16px">{esc(doc.content_text)}</p>
</body></html>"""
    return Response(content=html_body.encode("utf-8"), media_type="text/html; charset=utf-8")


@router.post("/invoices/issue", status_code=status.HTTP_201_CREATED)
async def issue_invoice(
    payload: IssueInvoiceRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    meta = await _load_source_meta(db, payload.source_type, payload.source_id)
    enforce_branch_scope(current_user, meta["branch_id"])

    total_rub = (payload.quantity * payload.rate_rub).quantize(Decimal("0.01"))
    vat_rub = calculate_vat(total_rub, AccountingSubjectEnum(payload.accounting_subject.value))

    inv_rec = ClosingDocumentRecord(
        id=f"cdoc-inv-{uuid.uuid4().hex[:8]}",
        kind="invoice",
        number=payload.invoice_number,
        date=payload.invoice_date,
        period_start=payload.period_start,
        period_end=payload.period_end,
        branch_id=meta["branch_id"],
        source_type=payload.source_type,
        source_id=payload.source_id,
        order_or_deal_number=meta["number"],
        client_name=meta["client_name"],
        site_address=meta["site_address"],
        equipment_name=meta["equipment_name"],
        operator_name=meta["operator_name"],
        work_description=payload.work_description,
        unit_label=payload.unit_label,
        quantity=payload.quantity,
        rate_rub=payload.rate_rub,
        total_amount_rub=total_rub,
        vat_amount_rub=vat_rub,
        accounting_subject=payload.accounting_subject,
        invoice_status=payload.invoice_status,
        paid_amount_rub=payload.paid_amount_rub,
        content_text=f"Счёт на оплату № {payload.invoice_number} от {payload.invoice_date}: {payload.work_description}, к оплате {total_rub} ₽ (в т.ч. НДС {vat_rub} ₽).",
    )
    inv_out, notif = await sync_closing_doc_to_source_and_legal(
        db, inv_rec, current_user.full_name, current_user.role, NotificationCategoryEnum.invoice
    )
    await db.commit()
    return {
        "invoice": inv_out.model_dump(by_alias=True),
        "notification": notif.model_dump(by_alias=True) if notif else None,
    }


@router.patch("/invoices/{source_type}/{source_id}/status")
async def update_invoice_status(
    source_type: str,
    source_id: str,
    payload: UpdateInvoiceStatusRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    inv_enum = InvoiceStatusEnum(payload.invoice_status.value)
    now = datetime.now(timezone.utc)

    if source_type == "order":
        order = (await db.execute(select(RentalOrder).where(RentalOrder.id == source_id))).scalar_one_or_none()
        if not order:
            raise HTTPException(status_code=404, detail="Заказ-наряд не найден")
        enforce_branch_scope(current_user, order.branch_id)
        order.invoice_status = inv_enum
        order.paid_amount = payload.paid_amount_rub
        total = order.total_amount
        debt = max(Decimal("0.00"), total - order.paid_amount)
        branch_id = order.branch_id
        entity_label = order.order_number
        client_name = order.client_name
        deal_id = order.deal_id
    elif source_type == "deal":
        deal = (await db.execute(select(CRMDeal).where(CRMDeal.id == source_id))).scalar_one_or_none()
        if not deal:
            raise HTTPException(status_code=404, detail="Сделка CRM не найдена")
        enforce_branch_scope(current_user, deal.branch_id)
        deal.invoice_status = inv_enum
        deal.paid_amount = payload.paid_amount_rub
        total = deal.estimated_amount
        debt = max(Decimal("0.00"), total - deal.paid_amount)
        deal.debt_amount = debt
        if deal.stage == CRMStageEnum.completed and debt > 0:
            deal.stage = CRMStageEnum.active
            deal.completed_at = None
            deal.archived_at = None
            deal.stage_updated_at = now
        branch_id = deal.branch_id
        entity_label = f"CRM-{deal.id[-6:].upper()}"
        client_name = deal.client_name
        deal_id = deal.id
    else:
        raise HTTPException(status_code=400, detail="source_type должен быть 'order' или 'deal'")

    settings_row = (
        await db.execute(select(StatusNotificationSettings).where(StatusNotificationSettings.id == 1))
    ).scalar_one_or_none()
    notif_out: Optional[StatusNotificationItem] = None
    if not settings_row or (settings_row.enabled and settings_row.on_invoice_status_change):
        channels = ["erp"]
        if not settings_row or settings_row.send_to_branch_chat:
            channels.append("chat")
        max_cfg = (
            await db.execute(select(MaxCustomerBotConfig).where(MaxCustomerBotConfig.branch_id == branch_id))
        ).scalar_one_or_none()
        if settings_row and settings_row.send_to_max_client_bot and (not max_cfg or max_cfg.enabled):
            channels.append("max_bot")

        notif_id = f"notif-{uuid.uuid4().hex[:10]}"
        title = f"Статус оплаты {entity_label}: {inv_enum.value}"
        message = f"{client_name}: оплачено {payload.paid_amount_rub:,.2f} ₽, остаток долга {debt:,.2f} ₽."
        db.add(
            StatusNotification(
                id=notif_id,
                branch_id=branch_id,
                title=title,
                message=message,
                category=NotificationCategoryEnum.payment_status,
                entity_label=entity_label,
                channels=channels,
                is_read=False,
            )
        )
        if "chat" in channels:
            db.add(
                ClientCommunication(
                    id=f"msg-{uuid.uuid4().hex[:10]}",
                    branch_id=branch_id,
                    deal_id=deal_id,
                    sender_name=current_user.full_name,
                    sender_role="admin",
                    message_text=f"[ERP] {message}",
                )
            )
        notif_out = StatusNotificationItem(
            id=notif_id,
            timestamp=now,
            branch_id=branch_id,
            title=title,
            message=message,
            category="payment_status",
            entity_label=entity_label,
            channels=channels,
            read=False,
        )

    await db.commit()
    return {
        "sourceType": source_type,
        "sourceId": source_id,
        "invoiceStatus": inv_enum.value,
        "paidAmount": float(payload.paid_amount_rub),
        "debtAmount": float(debt),
        "notification": notif_out.model_dump(by_alias=True) if notif_out else None,
    }
