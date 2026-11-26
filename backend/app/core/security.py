import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Dict, Iterable, Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.models.admin import RoleAccessPolicy, User
from app.models.enums import SystemRoleEnum

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer(auto_error=False)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_token(
    subject: str,
    role: str,
    branch_id: Optional[str],
    token_type: str = "access",
    expires_delta: Optional[timedelta] = None,
) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    if expires_delta is None:
        expires_delta = (
            timedelta(minutes=settings.access_token_expire_minutes)
            if token_type == "access"
            else timedelta(days=settings.refresh_token_expire_days)
        )
    payload: Dict[str, Any] = {
        "sub": subject,
        "role": role,
        "branch_id": branch_id,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(
            token,
            settings.jwt_secret_key,
            algorithms=[settings.jwt_algorithm],
        )
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Недействительный или истёкший токен авторизации",
        ) from exc


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Требуется авторизация (Authorization: Bearer)",
        )
    payload = decode_token(credentials.credentials)
    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Ожидается access-токен",
        )
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Токен не содержит идентификатор пользователя",
        )
    try:
        user_uuid = uuid.UUID(str(user_id))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Некорректный формат идентификатора пользователя в токене",
        ) from exc
    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Пользователь не найден или деактивирован",
        )
    return user


def require_roles(*allowed_roles: SystemRoleEnum) -> Callable:
    allowed_values = {r.value if isinstance(r, SystemRoleEnum) else r for r in allowed_roles}

    async def _guard(user: User = Depends(get_current_user)) -> User:
        role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
        if role_val not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Недостаточно прав роли для выполнения операции",
            )
        return user

    return _guard


def require_permission(
    page: Optional[str] = None,
    min_level: str = "view",
    field: Optional[str] = None,
) -> Callable:
    level_rank = {"hidden": 0, "view": 1, "edit": 2}

    async def _permission_guard(
        user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db),
    ) -> User:
        res = await db.execute(
            select(RoleAccessPolicy).where(RoleAccessPolicy.role_code == user.role)
        )
        policy = res.scalar_one_or_none()
        if not policy:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Политика доступа роли не настроена",
            )
        if page:
            actual = (policy.pages or {}).get(page, "hidden")
            if level_rank.get(actual, 0) < level_rank.get(min_level, 1):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Доступ к разделу '{page}' запрещён вашей ролью",
                )
        if field:
            if not bool((policy.fields or {}).get(field, False)):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail=f"Нет разрешения '{field}' для данной операции",
                )
        return user

    return _permission_guard


def enforce_branch_scope(user: User, target_branch_id: Optional[str]) -> Optional[str]:
    """Enforces branch isolation for non-executive roles tied to a specific branch."""
    role_val = user.role.value if hasattr(user.role, "value") else str(user.role)
    if role_val in {SystemRoleEnum.ADMIN.value, SystemRoleEnum.TOP_MANAGER.value, SystemRoleEnum.ACCOUNTANT.value, SystemRoleEnum.LAWYER.value}:
        return target_branch_id
    if user.branch_id and target_branch_id and target_branch_id != "all" and target_branch_id != user.branch_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Доступ к данным другого участка запрещён политикой изоляции",
        )
    return user.branch_id or target_branch_id
