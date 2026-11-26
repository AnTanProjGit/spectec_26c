import uuid
from datetime import date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Computed,
    Date,
    Enum as PgEnum,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import AccountingSubjectEnum


class PrivateContractor(Base):
    __tablename__ = "private_contractors"
    __table_args__ = {"schema": "subrent"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    legal_form: Mapped[str] = mapped_column(String(32), nullable=False)
    inn: Mapped[Optional[str]] = mapped_column(String(12))
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    bank_requisites: Mapped[Optional[str]] = mapped_column(Text)


class SubrentContract(Base):
    __tablename__ = "subrent_contracts"
    __table_args__ = {"schema": "subrent"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    contractor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subrent.private_contractors.id"), nullable=False
    )
    accounting_subject: Mapped[AccountingSubjectEnum] = mapped_column(
        PgEnum(AccountingSubjectEnum, name="accounting_subject_enum", create_type=False),
        default=AccountingSubjectEnum.ooo_specialtech,
        nullable=False,
    )
    contract_number: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    doc_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_day: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(DAY FROM doc_date)::SMALLINT", persisted=True)
    )
    period_month: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(MONTH FROM doc_date)::SMALLINT", persisted=True)
    )
    period_year: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(YEAR FROM doc_date)::SMALLINT", persisted=True)
    )
    hourly_cost_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_terms: Mapped[Optional[str]] = mapped_column(Text)


class SubrentEquipment(Base):
    __tablename__ = "subrent_equipment"
    __table_args__ = {"schema": "subrent"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    contractor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subrent.private_contractors.id", ondelete="CASCADE"), nullable=False
    )
    equipment_id: Mapped[str] = mapped_column(String(64), nullable=False)
    purchase_hourly_rate_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    target_margin_delta_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("500.00"), nullable=False)


class SubrentShift(Base):
    __tablename__ = "subrent_shifts"
    __table_args__ = {"schema": "subrent"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    subrent_contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subrent.subrent_contracts.id"), nullable=False
    )
    equipment_id: Mapped[str] = mapped_column(String(64), ForeignKey("fleet.equipment.id"), nullable=False)
    doc_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_day: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(DAY FROM doc_date)::SMALLINT", persisted=True)
    )
    period_month: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(MONTH FROM doc_date)::SMALLINT", persisted=True)
    )
    period_year: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(YEAR FROM doc_date)::SMALLINT", persisted=True)
    )
    worked_hours: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    subcontract_cost_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)


class SubrentSettlement(Base):
    __tablename__ = "subrent_settlements"
    __table_args__ = (
        UniqueConstraint("contractor_id", "subrent_contract_id", "period_year", "period_month"),
        {"schema": "subrent"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    contractor_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subrent.private_contractors.id"), nullable=False
    )
    subrent_contract_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subrent.subrent_contracts.id"), nullable=False
    )
    period_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    period_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    accrued_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    paid_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
