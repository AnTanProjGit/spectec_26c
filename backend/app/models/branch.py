import uuid
from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from sqlalchemy import (
    Boolean,
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
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import AccountingSubjectEnum, OverheadCategoryEnum


class Branch(Base):
    __tablename__ = "branches"
    __table_args__ = {"schema": "branch"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    code: Mapped[str] = mapped_column(String(16), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    is_headquarters: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    fleet_manager_name: Mapped[str] = mapped_column(String(150), nullable=False)
    fleet_manager_phone: Mapped[Optional[str]] = mapped_column(String(40))
    chief_mechanic_name: Mapped[Optional[str]] = mapped_column(String(150))
    chief_mechanic_phone: Mapped[Optional[str]] = mapped_column(String(40))
    base_address: Mapped[str] = mapped_column(Text, nullable=False)
    regular_clients: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    document_flow: Mapped[Optional["BranchDocumentFlow"]] = relationship(
        back_populates="branch", uselist=False, cascade="all, delete-orphan", lazy="selectin"
    )
    fixed_overheads: Mapped[List["BranchFixedOverhead"]] = relationship(
        back_populates="branch", cascade="all, delete-orphan", lazy="selectin"
    )


class BranchDocumentFlow(Base):
    __tablename__ = "branch_document_flows"
    __table_args__ = {"schema": "branch"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("branch.branches.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    isolated_streams: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    isolate_crm_and_erp: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    order_prefix: Mapped[str] = mapped_column(String(32), default="RO-2026-", nullable=False)
    waybill_prefix: Mapped[str] = mapped_column(String(32), default="ПЛ-", nullable=False)
    shift_prefix: Mapped[str] = mapped_column(String(32), default="SH-", nullable=False)
    act_prefix: Mapped[str] = mapped_column(String(32), default="КС2-", nullable=False)
    onec_department_code: Mapped[str] = mapped_column(String(32), default="00-000001", nullable=False)
    default_1c_subject: Mapped[AccountingSubjectEnum] = mapped_column(
        PgEnum(AccountingSubjectEnum, name="accounting_subject_enum", create_type=False),
        default=AccountingSubjectEnum.ooo_specialtech,
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    branch: Mapped["Branch"] = relationship(back_populates="document_flow")


class BranchFixedOverhead(Base):
    __tablename__ = "branch_fixed_overheads"
    __table_args__ = {"schema": "branch"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("branch.branches.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[OverheadCategoryEnum] = mapped_column(
        PgEnum(OverheadCategoryEnum, name="overhead_category_enum", create_type=False),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    monthly_amount_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    note: Mapped[Optional[str]] = mapped_column(Text)
    hidden: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    branch: Mapped["Branch"] = relationship(back_populates="fixed_overheads")
    details: Mapped[List["BranchOverheadDetail"]] = relationship(
        back_populates="overhead_item", cascade="all, delete-orphan", lazy="selectin"
    )


class BranchOverheadDetail(Base):
    __tablename__ = "branch_overhead_details"
    __table_args__ = {"schema": "branch"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    overhead_item_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("branch.branch_fixed_overheads.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    basis: Mapped[Optional[str]] = mapped_column(Text)
    amount_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)

    overhead_item: Mapped["BranchFixedOverhead"] = relationship(back_populates="details")


class BranchPeriodLedger(Base):
    __tablename__ = "branch_period_ledgers"
    __table_args__ = (
        UniqueConstraint("branch_id", "period_year", "period_month"),
        {"schema": "branch"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("branch.branches.id", ondelete="CASCADE"), nullable=False
    )
    period_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    period_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="open", nullable=False)
    planned_revenue_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    closed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
