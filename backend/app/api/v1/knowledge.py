import uuid
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_permission
from app.models.admin import SystemAdminConfigModel, User
from app.models.enums import KnowledgeCategoryEnum
from app.models.rag import DocumentChunk, KnowledgeDocument, RetrievalLog
from app.schemas.admin_legal import KnowledgeDocCreate, KnowledgeDocResponse
from app.schemas.base import CamelModel, KnowledgeCategory
from app.services.legal_rag_service import chunk_text
from app.services.serializers import serialize_knowledge_doc

router = APIRouter(prefix="/knowledge", tags=["Knowledge Base & RAG (Contour B)"])


class KnowledgeSearchRequest(CamelModel):
    query: str
    top_k: int = 5
    category: Optional[KnowledgeCategory] = None
    branch_id: Optional[str] = None


class KnowledgeReindexRequest(CamelModel):
    indexed_categories: Optional[List[KnowledgeCategory]] = None


@router.get("/docs", response_model=List[KnowledgeDocResponse])
async def list_knowledge_docs(
    category: Optional[KnowledgeCategoryEnum] = None,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[KnowledgeDocResponse]:
    stmt = select(KnowledgeDocument).order_by(KnowledgeDocument.date_updated.desc())
    if category:
        stmt = stmt.where(KnowledgeDocument.category == category)
    rows = (await db.execute(stmt)).scalars().all()
    return [serialize_knowledge_doc(r) for r in rows]


@router.post("/docs", response_model=KnowledgeDocResponse, status_code=status.HTTP_201_CREATED)
async def create_knowledge_doc(
    payload: KnowledgeDocCreate,
    _user: User = Depends(require_permission(field="canEditKnowledgeBase")),
    db: AsyncSession = Depends(get_db),
) -> KnowledgeDocResponse:
    doc = KnowledgeDocument(
        id=f"kb-{uuid.uuid4().hex[:8]}",
        code=payload.code,
        title=payload.title,
        category=KnowledgeCategoryEnum(payload.category.value),
        date_updated=date.today(),
        excerpt=payload.excerpt,
        full_text=payload.full_text,
        tags=payload.tags,
    )
    db.add(doc)
    await db.flush()
    for idx, ch in enumerate(chunk_text(payload.full_text)):
        db.add(
            DocumentChunk(
                document_id=doc.id,
                chunk_index=idx,
                content=ch,
                token_count=len(ch.split()),
                metadata_json={"category": doc.category.value},
            )
        )
    await db.commit()
    await db.refresh(doc)
    return serialize_knowledge_doc(doc)


@router.post("/search")
async def search_knowledge_base(
    payload: KnowledgeSearchRequest,
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    stmt = select(KnowledgeDocument)
    if payload.category:
        stmt = stmt.where(KnowledgeDocument.category == KnowledgeCategoryEnum(payload.category.value))
    docs = (await db.execute(stmt)).scalars().all()

    tokens = [t.lower() for t in payload.query.split() if len(t) >= 2]
    scored = []
    for d in docs:
        haystack = f"{d.title} {d.excerpt} {d.full_text} {' '.join(d.tags or [])}".lower()
        hits = sum(1 for tok in tokens if tok in haystack)
        score = round(min(0.99, 0.5 + 0.1 * hits), 2) if hits > 0 else 0.0
        if not tokens or hits > 0:
            scored.append({"score": score, "document": serialize_knowledge_doc(d).model_dump(by_alias=True)})
    scored.sort(key=lambda x: x["score"], reverse=True)
    top_results = scored[: payload.top_k]

    db.add(
        RetrievalLog(
            branch_id=payload.branch_id if payload.branch_id != "all" else None,
            agent_type="knowledge_search",
            query_text=payload.query,
            top_k=payload.top_k,
            matched_chunk_ids=[],
        )
    )
    await db.commit()
    return {"results": top_results, "totalMatched": len(scored)}


@router.post("/reindex")
async def reindex_knowledge_base(
    payload: Optional[KnowledgeReindexRequest] = None,
    _user: User = Depends(require_permission(field="canEditKnowledgeBase")),
    db: AsyncSession = Depends(get_db),
) -> dict:
    cfg = (
        await db.execute(select(SystemAdminConfigModel).where(SystemAdminConfigModel.id == 1))
    ).scalar_one_or_none()
    rag_cfg = dict(cfg.rag_config) if cfg and cfg.rag_config else {}
    chunk_sz = int(rag_cfg.get("chunkSizeTokens", 512))
    overlap = int(rag_cfg.get("chunkOverlapTokens", 64))

    stmt = select(KnowledgeDocument)
    if payload and payload.indexed_categories:
        cats = [KnowledgeCategoryEnum(c.value) for c in payload.indexed_categories]
        stmt = stmt.where(KnowledgeDocument.category.in_(cats))
        rag_cfg["indexedCategories"] = [c.value for c in payload.indexed_categories]
    docs = (await db.execute(stmt)).scalars().all()

    doc_ids = [d.id for d in docs]
    if doc_ids:
        await db.execute(delete(DocumentChunk).where(DocumentChunk.document_id.in_(doc_ids)))
    chunks_count = 0
    for d in docs:
        for idx, ch in enumerate(chunk_text(d.full_text, chunk_sz, overlap)):
            db.add(
                DocumentChunk(
                    document_id=d.id,
                    chunk_index=idx,
                    content=ch,
                    token_count=len(ch.split()),
                    metadata_json={"category": d.category.value, "code": d.code},
                )
            )
            chunks_count += 1

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
    if cfg:
        rag_cfg["lastIndexedAt"] = now_str
        cfg.rag_config = rag_cfg
    await db.commit()
    return {"reindexedDocs": len(docs), "chunksCount": chunks_count, "lastIndexedAt": now_str}
