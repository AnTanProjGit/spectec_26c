import uuid
from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Computed,
    DateTime,
    Enum as PgEnum,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import ClientTypeEnum


class Client(Base):
    __tablename__ = "clients"
    __table_args__ = (
        UniqueConstraint("primary_branch_id", "id"),
        UniqueConstraint("primary_branch_id", "inn"),
        {"schema": "customer"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    primary_branch_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("branch.branches.id"), nullable=False
    )
    client_type: Mapped[ClientTypeEnum] = mapped_column(
        PgEnum(ClientTypeEnum, name="client_type_enum", create_type=False),
        default=ClientTypeEnum.legal_entity,
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[Optional[str]] = mapped_column(String(350))
    opf: Mapped[Optional[str]] = mapped_column(String(32))
    inn: Mapped[Optional[str]] = mapped_column(String(12))
    kpp: Mapped[Optional[str]] = mapped_column(String(9))
    ogrn: Mapped[Optional[str]] = mapped_column(String(15))
    legal_address: Mapped[Optional[str]] = mapped_column(Text)
    director: Mapped[Optional[str]] = mapped_column(String(150))
    bank_name: Mapped[Optional[str]] = mapped_column(String(255))
    bik: Mapped[Optional[str]] = mapped_column(String(9))
    checking_account: Mapped[Optional[str]] = mapped_column(String(32))
    corr_account: Mapped[Optional[str]] = mapped_column(String(32))
    email: Mapped[Optional[str]] = mapped_column(CITEXT)
    phone: Mapped[Optional[str]] = mapped_column(String(40))
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("2000000.00"), nullable=False)
    current_debt: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    reliability_score: Mapped[int] = mapped_column(SmallInteger, default=85, nullable=False)
    is_regular_max: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClientContact(Base):
    __tablename__ = "client_contacts"
    __table_args__ = {"schema": "customer"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer.clients.id", ondelete="CASCADE"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role_title: Mapped[Optional[str]] = mapped_column(String(100))
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    max_user_id: Mapped[Optional[str]] = mapped_column(String(100))
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ConstructionSite(Base):
    __tablename__ = "construction_sites"
    __table_args__ = (
        UniqueConstraint("branch_id", "id"),
        {"schema": "customer"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    address: Mapped[str] = mapped_column(Text, nullable=False)
    geo_lat: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 6))
    geo_lng: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 6))
    geofence_radius_m: Mapped[int] = mapped_column(Integer, default=250, nullable=False)
    site_manager_name: Mapped[Optional[str]] = mapped_column(String(150))
    site_manager_phone: Mapped[Optional[str]] = mapped_column(String(40))
    requires_pass_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)


class ClientBalanceMonthly(Base):
    __tablename__ = "client_balances_monthly"
    __table_args__ = (
        UniqueConstraint("branch_id", "client_id", "period_year", "period_month"),
        {"schema": "customer"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    client_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    period_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    period_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    opening_debt_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    accrued_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    paid_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    closing_debt_rub: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("opening_debt_rub + accrued_rub - paid_rub", persisted=True),
    )
