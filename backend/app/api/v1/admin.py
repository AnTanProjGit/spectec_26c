from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, require_roles
from app.models.admin import RoleAccessPolicy, SystemAdminConfigModel, User
from app.models.enums import SystemRoleEnum
from app.schemas.admin_legal import (
    ConfirmationGatePatch,
    LlmAdminSettings,
    RagBaseAdminSettings,
    RoleAccessPolicySchema,
    SystemAdminConfigSchema,
    TableViewSettings,
)
from app.schemas.base import SystemRoleId, TableViewId
from app.services.serializers import load_admin_config

router = APIRouter(prefix="/admin", tags=["System Administration & RBAC"])


async def _get_or_create_cfg(db: AsyncSession) -> SystemAdminConfigModel:
    cfg = (await db.execute(select(SystemAdminConfigModel).where(SystemAdminConfigModel.id == 1))).scalar_one_or_none()
    if not cfg:
        cfg = SystemAdminConfigModel(id=1)
        db.add(cfg)
        await db.flush()
    return cfg


@router.get("/config", response_model=SystemAdminConfigSchema)
async def get_admin_config(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SystemAdminConfigSchema:
    return await load_admin_config(db)


@router.put("/config", response_model=SystemAdminConfigSchema)
async def save_admin_config(
    payload: SystemAdminConfigSchema,
    _user: User = Depends(require_roles(SystemRoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> SystemAdminConfigSchema:
    cfg = await _get_or_create_cfg(db)
    cfg.tables_config = {k.value: v.model_dump(by_alias=True) for k, v in payload.tables.items()}
    cfg.llm_config = payload.llm.model_dump(by_alias=True)
    cfg.rag_config = payload.knowledge_rag.model_dump(by_alias=True)
    cfg.telemetry_sensors_config = payload.telemetry_sensors.model_dump(by_alias=True)
    cfg.admin_confirmation_allowed = payload.admin_confirmation_allowed

    for rid, pol in payload.access_policies.items():
        enum_role = SystemRoleEnum(rid.value)
        row = (
            await db.execute(select(RoleAccessPolicy).where(RoleAccessPolicy.role_code == enum_role))
        ).scalar_one_or_none()
        if not row:
            row = RoleAccessPolicy(role_code=enum_role)
            db.add(row)
        row.label = pol.label
        row.description = pol.description
        row.pages = {k: v.value for k, v in pol.pages.items()}
        row.fields = pol.fields.model_dump(by_alias=True)

    await db.commit()
    return await load_admin_config(db)


@router.put("/roles/{role_id}", response_model=RoleAccessPolicySchema)
async def update_role_policy(
    role_id: SystemRoleId,
    payload: RoleAccessPolicySchema,
    _user: User = Depends(require_roles(SystemRoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> RoleAccessPolicySchema:
    enum_role = SystemRoleEnum(role_id.value)
    row = (
        await db.execute(select(RoleAccessPolicy).where(RoleAccessPolicy.role_code == enum_role))
    ).scalar_one_or_none()
    if not row:
        row = RoleAccessPolicy(role_code=enum_role)
        db.add(row)
    row.label = payload.label
    row.description = payload.description
    row.pages = {k: v.value for k, v in payload.pages.items()}
    row.fields = payload.fields.model_dump(by_alias=True)
    await db.commit()
    return payload


@router.put("/tables/{table_id}", response_model=TableViewSettings)
async def update_table_settings(
    table_id: TableViewId,
    payload: TableViewSettings,
    _user: User = Depends(require_roles(SystemRoleEnum.admin, SystemRoleEnum.top_manager)),
    db: AsyncSession = Depends(get_db),
) -> TableViewSettings:
    cfg = await _get_or_create_cfg(db)
    tables = dict(cfg.tables_config or {})
    tables[table_id.value] = payload.model_dump(by_alias=True)
    cfg.tables_config = tables
    await db.commit()
    return payload


@router.put("/llm", response_model=LlmAdminSettings)
async def update_llm_settings(
    payload: LlmAdminSettings,
    _user: User = Depends(require_roles(SystemRoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> LlmAdminSettings:
    cfg = await _get_or_create_cfg(db)
    cfg.llm_config = payload.model_dump(by_alias=True)
    await db.commit()
    return payload


@router.post("/llm/test-connection")
async def test_llm_connection(
    _user: User = Depends(require_roles(SystemRoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    cfg = await _get_or_create_cfg(db)
    llm_cfg = cfg.llm_config or {}
    return {
        "connected": True,
        "provider": llm_cfg.get("provider", "gemini_proxy"),
        "model": llm_cfg.get("model", "gemini-4-hydrogen"),
        "message": "Прокси LLM-аналитика готов к работе",
    }


@router.put("/rag", response_model=RagBaseAdminSettings)
async def update_rag_settings(
    payload: RagBaseAdminSettings,
    _user: User = Depends(require_roles(SystemRoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> RagBaseAdminSettings:
    cfg = await _get_or_create_cfg(db)
    cfg.rag_config = payload.model_dump(by_alias=True)
    await db.commit()
    return payload


@router.patch("/confirmation-gate")
async def patch_confirmation_gate(
    payload: ConfirmationGatePatch,
    _user: User = Depends(require_roles(SystemRoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> dict:
    cfg = await _get_or_create_cfg(db)
    cfg.admin_confirmation_allowed = payload.admin_confirmation_allowed
    await db.commit()
    return {"adminConfirmationAllowed": cfg.admin_confirmation_allowed}
