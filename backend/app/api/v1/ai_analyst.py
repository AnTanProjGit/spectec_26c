from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import enforce_branch_scope, get_current_user
from app.models.admin import User
from app.models.audit import AnomalyAlert
from app.schemas.base import CamelModel
from app.services.ai_service import run_gemini_analyst

router = APIRouter(prefix="/ai", tags=["AI Business Analyst & Audit"])


class AiAnalystQueryRequest(CamelModel):
    query: str = ""
    agent_type: str = "executive"
    context_data: Optional[Dict[str, Any]] = None
    llm_config: Optional[Dict[str, Any]] = None


@router.post("/query")
async def query_ai_analyst(
    payload: AiAnalystQueryRequest,
    _user: User = Depends(get_current_user),
) -> dict:
    if not payload.query and not payload.agent_type:
        raise HTTPException(status_code=400, detail="Параметр query или agentType обязателен")
    source, data = run_gemini_analyst(
        agent_type=payload.agent_type,
        query=payload.query,
        context_data=payload.context_data,
        llm_config=payload.llm_config,
    )
    return {"success": True, "source": source, "data": data}


@router.get("/anomalies/active")
async def list_active_anomalies(
    branch_id: Optional[str] = Query(default="all"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> List[dict]:
    scoped = enforce_branch_scope(current_user, branch_id)
    stmt = select(AnomalyAlert).where(AnomalyAlert.resolved.is_(False)).order_by(AnomalyAlert.doc_date.desc())
    if scoped and scoped != "all":
        stmt = stmt.where(AnomalyAlert.branch_id == scoped)
    rows = (await db.execute(stmt)).scalars().all()
    return [
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
        for a in rows
    ]


@router.patch("/anomalies/{anomaly_id}/resolve")
async def resolve_anomaly(
    anomaly_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    row = (await db.execute(select(AnomalyAlert).where(AnomalyAlert.id == anomaly_id))).scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Инцидент аномалии не найден")
    enforce_branch_scope(current_user, row.branch_id)
    row.resolved = True
    row.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"id": row.id, "resolved": True}
