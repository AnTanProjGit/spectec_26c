import uuid
from datetime import datetime
from typing import Any, Dict, Optional

from sqlalchemy import Boolean, DateTime, Enum as PgEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import CITEXT, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import SystemRoleEnum


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"schema": "meta"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("branch.branches.id"))
    email: Mapped[str] = mapped_column(CITEXT, unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[SystemRoleEnum] = mapped_column(
        PgEnum(SystemRoleEnum, name="system_role_enum", create_type=False),
        default=SystemRoleEnum.fleet_manager,
        nullable=False,
    )
    phone: Mapped[Optional[str]] = mapped_column(String(40))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RoleAccessPolicy(Base):
    __tablename__ = "role_access_policies"
    __table_args__ = {"schema": "meta"}

    role_code: Mapped[SystemRoleEnum] = mapped_column(
        PgEnum(SystemRoleEnum, name="system_role_enum", create_type=False), primary_key=True
    )
    label: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    pages: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    fields: Mapped[Dict[str, Any]] = mapped_column(JSONB, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SystemAdminConfigModel(Base):
    __tablename__ = "system_admin_config"
    __table_args__ = {"schema": "meta"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    tables_config: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    llm_config: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    rag_config: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    telemetry_sensors_config: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    admin_confirmation_allowed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TableRegistry(Base):
    __tablename__ = "table_registry"
    __table_args__ = {"schema": "meta"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    schema_name: Mapped[str] = mapped_column(String(32), nullable=False)
    table_name: Mapped[str] = mapped_column(String(100), nullable=False)
    full_table_name: Mapped[str] = mapped_column(String(140), unique=True, nullable=False)
    contour: Mapped[str] = mapped_column(String(64), nullable=False)
    hierarchy_slice: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
