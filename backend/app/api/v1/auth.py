import hmac
import os
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import (
    create_token,
    decode_token,
    get_current_user,
    hash_password,
    require_roles,
    verify_password,
)
from app.models.admin import RoleAccessPolicy, User
from app.models.enums import SystemRoleEnum
from app.schemas.admin_legal import RoleAccessFieldsPolicy, RoleAccessPolicySchema
from app.schemas.base import CamelModel, SystemRoleId

router = APIRouter(prefix="/auth", tags=["Auth & RBAC"])


class LoginRequest(CamelModel):
    username: str = Field(..., min_length=3)
    password: str = Field(..., min_length=1)


class RefreshRequest(CamelModel):
    refresh_token: str = Field(..., min_length=10)


class RegisterUserRequest(CamelModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=2, max_length=150)
    role: SystemRoleId = SystemRoleId.FLEET_MANAGER
    branch_id: Optional[str] = "branch-hq"
    phone: Optional[str] = None


class BootstrapPasswordRequest(CamelModel):
    email: EmailStr
    new_password: str = Field(..., min_length=8)
    setup_token: str = Field(..., min_length=8)


class UserBrief(CamelModel):
    id: str
    email: str
    full_name: str
    role: SystemRoleId
    branch_id: Optional[str] = None


class AuthTokensResponse(CamelModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserBrief


@router.post("/login", response_model=AuthTokensResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)) -> AuthTokensResponse:
    user = (await db.execute(select(User).where(User.email == payload.username.strip()))).scalar_one_or_none()
    if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный логин или пароль",
        )
    settings = get_settings()
    role_val = user.role.value
    access_token = create_token(str(user.id), role_val, user.branch_id, "access")
    refresh_token = create_token(str(user.id), role_val, user.branch_id, "refresh")
    return AuthTokensResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserBrief(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            role=SystemRoleId(role_val),
            branch_id=user.branch_id,
        ),
    )


@router.post("/refresh")
async def refresh_tokens(payload: RefreshRequest, db: AsyncSession = Depends(get_db)) -> dict:
    decoded = decode_token(payload.refresh_token)
    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Ожидается refresh-токен")
    sub = str(decoded.get("sub") or "")
    role = str(decoded.get("role") or "fleet_manager")
    branch_id = decoded.get("branch_id")
    return {
        "accessToken": create_token(sub, role, branch_id, "access"),
        "refreshToken": create_token(sub, role, branch_id, "refresh", timedelta(days=7)),
    }


@router.get("/me")
async def get_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    policy_row = (
        await db.execute(select(RoleAccessPolicy).where(RoleAccessPolicy.role_code == current_user.role))
    ).scalar_one_or_none()
    policy_dto = None
    if policy_row:
        policy_dto = RoleAccessPolicySchema(
            role=SystemRoleId(policy_row.role_code.value),
            label=policy_row.label,
            description=policy_row.description,
            pages=policy_row.pages or {},
            fields=RoleAccessFieldsPolicy.model_validate(policy_row.fields or {}),
        ).model_dump(by_alias=True)
    return {
        "user": UserBrief(
            id=str(current_user.id),
            email=current_user.email,
            full_name=current_user.full_name,
            role=SystemRoleId(current_user.role.value),
            branch_id=current_user.branch_id,
        ).model_dump(by_alias=True),
        "policy": policy_dto,
    }


@router.post("/register", response_model=UserBrief, status_code=status.HTTP_201_CREATED)
async def register_user(
    payload: RegisterUserRequest,
    _admin: User = Depends(require_roles(SystemRoleEnum.admin)),
    db: AsyncSession = Depends(get_db),
) -> UserBrief:
    existing = (await db.execute(select(User).where(User.email == str(payload.email)))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Пользователь с таким email уже существует")
    user = User(
        email=str(payload.email),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=SystemRoleEnum(payload.role.value),
        branch_id=payload.branch_id,
        phone=payload.phone,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return UserBrief(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        role=SystemRoleId(user.role.value),
        branch_id=user.branch_id,
    )


@router.post("/bootstrap-password")
async def bootstrap_initial_password(
    payload: BootstrapPasswordRequest, db: AsyncSession = Depends(get_db)
) -> dict:
    """Allows initial local deployment password setup only when BOOTSTRAP_SETUP_TOKEN env var is set."""
    expected_token = (os.getenv("BOOTSTRAP_SETUP_TOKEN") or "").strip()
    if not expected_token or not hmac.compare_digest(payload.setup_token, expected_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Недействительный токен первичной настройки",
        )
    user = (await db.execute(select(User).where(User.email == str(payload.email)))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return {"success": True, "email": user.email}
