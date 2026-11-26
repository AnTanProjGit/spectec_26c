import csv
import html
import io
import json
import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from docx import Document as DocxDocument
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from openpyxl import Workbook
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.admin import SystemAdminConfigModel, User
from app.models.branch import Branch, BranchDocumentFlow
from app.models.customer import Client
from app.models.enums import (
    AccountingSubjectEnum,
    KnowledgeCategoryEnum,
    LegalDocKindEnum,
    LegalDocStatusEnum,
    SystemRoleEnum,
)
from app.models.erp import Contract, LegalHistory
from app.models.rag import DocumentChunk, KnowledgeDocument
from app.schemas.admin_legal import (
    AutoCustomerContractRequest,
    KnowledgeDocResponse,
    LegalDocumentCreate,
    LegalDocumentResponse,
    LegalDocumentUpdate,
    LegalExportLogRequest,
    LegalHistoryEntryResponse,
    LegalPublishToKbRequest,
)
from app.services.legal_rag_service import anonymize_legal_text, chunk_text
from app.services.serializers import (
    serialize_knowledge_doc,
    serialize_legal_doc,
    serialize_legal_history,
)

router = APIRouter(prefix="/legal", tags=["Legal Registry & Contracts (Contour B)"])


def _forbid_accountant_mutation(user: User) -> None:
    if user.role == SystemRoleEnum.accountant:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Роль Бухгалтер имеет только чтение в юридическом реестре (изменение запрещено)",
        )


def _record_history(
    db: AsyncSession,
    doc: Contract,
    action: str,
    user: User,
    details: str,
) -> None:
    db.add(
        LegalHistory(
            id=f"lh-{uuid.uuid4().hex[:10]}",
            document_id=doc.id,
            document_number=doc.number,
            document_title=doc.title,
            action=action,
            actor_role=user.role,
            actor_name=user.full_name,
            details=details,
        )
    )


@router.get("/documents", response_model=List[LegalDocumentResponse])
async def list_legal_documents(
    branch_id: Optional[str] = Query(default=None),
    kind: Optional[LegalDocKindEnum] = Query(default=None),
    doc_status: Optional[LegalDocStatusEnum] = Query(default=None, alias="status"),
    search: Optional[str] = Query(default=None),
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[LegalDocumentResponse]:
    stmt = select(Contract).order_by(Contract.updated_at.desc())
    if branch_id and branch_id != "all":
        stmt = stmt.where(Contract.branch_id == branch_id)
    if kind:
        stmt = stmt.where(Contract.kind == kind)
    if doc_status:
        stmt = stmt.where(Contract.status == doc_status)
    if search and search.strip():
        pat = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                Contract.number.ilike(pat),
                Contract.title.ilike(pat),
                Contract.counterparty.ilike(pat),
                Contract.linked_order_number.ilike(pat),
            )
        )
    rows = (await db.execute(stmt)).scalars().all()
    return [serialize_legal_doc(r) for r in rows]


@router.post("/documents", response_model=LegalDocumentResponse, status_code=status.HTTP_201_CREATED)
async def create_legal_document(
    payload: LegalDocumentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LegalDocumentResponse:
    _forbid_accountant_mutation(current_user)
    doc = Contract(
        id=f"leg-{uuid.uuid4().hex[:8]}",
        branch_id=payload.branch_id,
        number=payload.number,
        title=payload.title,
        kind=LegalDocKindEnum(payload.kind.value),
        counterparty=payload.counterparty,
        accounting_subject=AccountingSubjectEnum(payload.accounting_subject.value),
        status=LegalDocStatusEnum(payload.status.value),
        doc_date=date.today(),
        author_name=current_user.full_name,
        amount_rub=payload.amount_rub,
        dispute_amount_rub=payload.dispute_amount_rub,
        dispute_reason=payload.dispute_reason,
        linked_order_number=payload.linked_order_number,
        in_knowledge_base=payload.in_knowledge_base,
        content=payload.content,
    )
    db.add(doc)
    await db.flush()
    action = "dispute_opened" if payload.kind.value in ("dispute", "claim") else "created"
    _record_history(db, doc, action, current_user, f"Создан документ {doc.number} ({doc.counterparty})")
    await db.commit()
    await db.refresh(doc)
    return serialize_legal_doc(doc)


@router.patch("/documents/{doc_id}", response_model=LegalDocumentResponse)
async def update_legal_document(
    doc_id: str,
    payload: LegalDocumentUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LegalDocumentResponse:
    _forbid_accountant_mutation(current_user)
    doc = (await db.execute(select(Contract).where(Contract.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Юридический документ не найден")

    prev_status = doc.status
    if payload.title is not None:
        doc.title = payload.title
    if payload.status is not None:
        doc.status = LegalDocStatusEnum(payload.status.value)
    if payload.amount_rub is not None:
        doc.amount_rub = payload.amount_rub
    if payload.dispute_amount_rub is not None:
        doc.dispute_amount_rub = payload.dispute_amount_rub
    if payload.dispute_reason is not None:
        doc.dispute_reason = payload.dispute_reason
    if payload.content is not None:
        doc.content = payload.content
    doc.updated_at = datetime.now(timezone.utc)

    action = "status_changed" if (payload.status is not None and doc.status != prev_status) else "updated"
    details = payload.action_details or (
        f"Статус изменён: {prev_status.value} -> {doc.status.value}" if action == "status_changed" else "Обновлено содержание"
    )
    _record_history(db, doc, action, current_user, details)
    await db.commit()
    await db.refresh(doc)
    return serialize_legal_doc(doc)


@router.post("/documents/import", response_model=List[LegalDocumentResponse], status_code=status.HTTP_201_CREATED)
async def import_legal_documents(
    items: List[LegalDocumentCreate],
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[LegalDocumentResponse]:
    _forbid_accountant_mutation(current_user)
    created: List[Contract] = []
    for item in items:
        doc = Contract(
            id=f"leg-{uuid.uuid4().hex[:8]}",
            branch_id=item.branch_id,
            number=item.number,
            title=item.title,
            kind=LegalDocKindEnum(item.kind.value),
            counterparty=item.counterparty,
            accounting_subject=AccountingSubjectEnum(item.accounting_subject.value),
            status=LegalDocStatusEnum(item.status.value),
            doc_date=date.today(),
            author_name=current_user.full_name,
            amount_rub=item.amount_rub,
            dispute_amount_rub=item.dispute_amount_rub,
            dispute_reason=item.dispute_reason,
            linked_order_number=item.linked_order_number,
            in_knowledge_base=item.in_knowledge_base,
            content=item.content,
        )
        db.add(doc)
        await db.flush()
        _record_history(db, doc, "imported", current_user, f"Пакетный импорт документа {doc.number}")
        created.append(doc)
    await db.commit()
    return [serialize_legal_doc(d) for d in created]


@router.post("/documents/auto-from-customer", response_model=LegalDocumentResponse)
async def auto_contract_from_customer(
    payload: AutoCustomerContractRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> LegalDocumentResponse:
    _forbid_accountant_mutation(current_user)
    existing = (
        await db.execute(
            select(Contract)
            .where(Contract.counterparty == payload.client_name, Contract.kind == LegalDocKindEnum.contract)
            .order_by(Contract.updated_at.desc())
        )
    ).scalars().first()
    if existing:
        return serialize_legal_doc(existing)

    branch = (await db.execute(select(Branch).where(Branch.id == payload.branch_id))).scalar_one_or_none()
    df = (
        await db.execute(select(BranchDocumentFlow).where(BranchDocumentFlow.branch_id == payload.branch_id))
    ).scalar_one_or_none()
    client = (
        await db.execute(
            select(Client).where(Client.primary_branch_id == payload.branch_id, Client.name == payload.client_name)
        )
    ).scalar_one_or_none()

    code = branch.code if branch else "MSK"
    prefix = df.order_prefix if (df and payload.has_contract) else f"ОФР-{code}-"
    doc_num = f"{prefix}{uuid.uuid4().hex[:4].upper()}"
    subject_label = (
        "ООО «SpecialTech» (ОСНО с НДС 20%)"
        if payload.subject_id.value == "ooo_specialtech"
        else "ИП «SpecialTechnica» (УСН 6% без НДС)"
    )
    inn_str = client.inn if (client and client.inn) else "не указан"
    bank_str = f"{client.bank_name}, БИК {client.bik}, р/с {client.checking_account}" if (client and client.bank_name) else "реквизиты уточняются"
    content = (
        f"{'ДОГОВОР АРЕНДЫ СПЕЦТЕХНИКИ' if payload.has_contract else 'СЧЁТ-ОФЕРТА'} № {doc_num}\n"
        f"Исполнитель: {subject_label}\n"
        f"Заказчик: {client.full_name if (client and client.full_name) else payload.client_name} (ИНН {inn_str})\n"
        f"Банковские реквизиты: {bank_str}\n"
        f"Участок: {branch.name if branch else payload.branch_id}."
    )
    doc = Contract(
        id=f"leg-{uuid.uuid4().hex[:8]}",
        branch_id=payload.branch_id,
        client_id=client.id if client else None,
        number=doc_num,
        title=f"{'Договор аренды' if payload.has_contract else 'Оферта'} — {payload.client_name}",
        kind=LegalDocKindEnum.contract if payload.has_contract else LegalDocKindEnum.template,
        counterparty=payload.client_name,
        accounting_subject=AccountingSubjectEnum(payload.subject_id.value),
        status=LegalDocStatusEnum.active,
        doc_date=date.today(),
        author_name=current_user.full_name,
        linked_order_number=payload.order_number,
        content=content,
    )
    db.add(doc)
    await db.flush()
    _record_history(db, doc, "created", current_user, f"Автоформирование из карточки клиента ({payload.client_name})")
    await db.commit()
    await db.refresh(doc)
    return serialize_legal_doc(doc)


@router.post("/documents/{doc_id}/publish-to-kb", response_model=KnowledgeDocResponse, status_code=status.HTTP_201_CREATED)
async def publish_legal_to_kb(
    doc_id: str,
    payload: LegalPublishToKbRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeDocResponse:
    _forbid_accountant_mutation(current_user)
    doc = (await db.execute(select(Contract).where(Contract.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Юридический документ не найден")

    body_text = (
        anonymize_legal_text(doc.content, doc.counterparty)
        if payload.mode == "anonymized"
        else doc.content
    )
    kb_id = f"kb-{uuid.uuid4().hex[:8]}"
    kb_code = f"LEG-{doc.number[:24]}-{uuid.uuid4().hex[:4].upper()}"
    kb = KnowledgeDocument(
        id=kb_id,
        code=kb_code,
        title=f"{doc.title} ({'обезличенный шаблон' if payload.mode == 'anonymized' else 'оригинал'})",
        category=KnowledgeCategoryEnum(payload.target_category.value),
        date_updated=date.today(),
        excerpt=body_text[:260],
        full_text=body_text,
        tags=[doc.kind.value, payload.mode, doc.accounting_subject.value],
    )
    db.add(kb)
    doc.in_knowledge_base = True
    await db.flush()

    admin_cfg = (
        await db.execute(select(SystemAdminConfigModel).where(SystemAdminConfigModel.id == 1))
    ).scalar_one_or_none()
    rag_cfg = (admin_cfg.rag_config if admin_cfg else {}) or {}
    if rag_cfg.get("autoReindexOnSave", True):
        chunk_sz = int(rag_cfg.get("chunkSizeTokens", 512))
        overlap = int(rag_cfg.get("chunkOverlapTokens", 64))
        for idx, ch in enumerate(chunk_text(body_text, chunk_sz, overlap)):
            db.add(
                DocumentChunk(
                    document_id=kb.id,
                    chunk_index=idx,
                    content=ch,
                    token_count=len(ch.split()),
                    metadata_json={"category": kb.category.value, "source": doc.id},
                )
            )

    _record_history(
        db,
        doc,
        "saved_to_base",
        current_user,
        f"Опубликовано в Базу знаний ({payload.mode}, категория {payload.target_category.value})",
    )
    await db.commit()
    await db.refresh(kb)
    return serialize_knowledge_doc(kb)


@router.get("/documents/{doc_id}/export")
async def export_single_legal_document(
    doc_id: str,
    fmt: str = Query(default="docx", alias="format"),
    anonymize: bool = Query(default=False),
    include_metadata: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    doc = (await db.execute(select(Contract).where(Contract.id == doc_id))).scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Юридический документ не найден")

    text_body = anonymize_legal_text(doc.content, doc.counterparty) if anonymize else doc.content
    counterparty_label = "[КОНТРАГЕНТ]" if anonymize else doc.counterparty
    _record_history(db, doc, "exported", current_user, f"Экспорт 1 документа в формат {fmt} (anonymize={anonymize})")
    await db.commit()

    if fmt == "json":
        payload = {
            "id": doc.id,
            "number": doc.number,
            "title": doc.title,
            "kind": doc.kind.value,
            "counterparty": counterparty_label,
            "status": doc.status.value,
            "amountRub": float(doc.amount_rub),
            "content": text_body,
        }
        return Response(content=json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"), media_type="application/json")

    if fmt == "txt":
        header = f"{doc.title} ({doc.number})\nКонтрагент: {counterparty_label}\n\n" if include_metadata else ""
        return Response(content=(header + text_body).encode("utf-8"), media_type="text/plain; charset=utf-8")

    if fmt == "html" or fmt == "pdf":
        esc = html.escape
        body = f"<html><body style='font-family:Arial'><h2>{esc(doc.title)} ({esc(doc.number)})</h2><p>Контрагент: {esc(counterparty_label)}</p><pre style='white-space:pre-wrap'>{esc(text_body)}</pre></body></html>"
        return Response(content=body.encode("utf-8"), media_type="text/html; charset=utf-8")

    if fmt == "csv":
        sio = io.StringIO()
        writer = csv.writer(sio, delimiter=";")
        writer.writerow(["Номер", "Название", "Контрагент", "Статус", "Сумма", "Текст"])
        writer.writerow([doc.number, doc.title, counterparty_label, doc.status.value, str(doc.amount_rub), text_body])
        return Response(content=sio.getvalue().encode("utf-8-sig"), media_type="text/csv; charset=utf-8")

    if fmt == "xlsx":
        wb = Workbook()
        ws = wb.active
        ws.title = "Документ"
        ws.append(["Номер", "Название", "Контрагент", "Статус", "Сумма, ₽", "Текст"])
        ws.append([doc.number, doc.title, counterparty_label, doc.status.value, float(doc.amount_rub), text_body])
        buf = io.BytesIO()
        wb.save(buf)
        return Response(
            content=buf.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{doc.number}.xlsx"'},
        )

    word = DocxDocument()
    word.add_heading(f"{doc.title} ({doc.number})", level=1)
    if include_metadata:
        word.add_paragraph(f"Контрагент: {counterparty_label} · Статус: {doc.status.value} · Сумма: {doc.amount_rub} ₽")
    word.add_paragraph(text_body)
    buf = io.BytesIO()
    word.save(buf)
    return Response(
        content=buf.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{doc.number}.docx"'},
    )


@router.post("/export-log")
async def log_legal_export(
    payload: LegalExportLogRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    if not payload.document_id:
        return {"logged": True}
    doc = (await db.execute(select(Contract).where(Contract.id == payload.document_id))).scalar_one_or_none()
    if doc:
        _record_history(db, doc, "exported", current_user, payload.details)
        await db.commit()
    return {"logged": True}


@router.get("/history", response_model=List[LegalHistoryEntryResponse])
async def list_legal_history(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[LegalHistoryEntryResponse]:
    rows = (await db.execute(select(LegalHistory).order_by(LegalHistory.created_at.desc()))).scalars().all()
    return [serialize_legal_history(r) for r in rows]
