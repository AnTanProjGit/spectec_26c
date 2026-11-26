import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    Computed,
    Date,
    DateTime,
    Enum as PgEnum,
    ForeignKey,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import (
    DriverShiftRosterEnum,
    PaymentCategoryEnum,
    TimesheetDayCodeEnum,
)


class Driver(Base):
    __tablename__ = "drivers"
    __table_args__ = (
        UniqueConstraint("branch_id", "id"),
        {"schema": "driver"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    max_linked: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    shift_roster: Mapped[DriverShiftRosterEnum] = mapped_column(
        PgEnum(DriverShiftRosterEnum, name="driver_shift_roster_enum", create_type=False),
        default=DriverShiftRosterEnum.shift_1,
        nullable=False,
    )
    needs_replacement: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    replacement_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DriverEquipmentBinding(Base):
    __tablename__ = "driver_equipment_bindings"
    __table_args__ = (
        UniqueConstraint("driver_id", "equipment_id", "is_temporary_replacement"),
        {"schema": "driver"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    driver_id: Mapped[str] = mapped_column(String(64), nullable=False)
    equipment_id: Mapped[str] = mapped_column(String(64), nullable=False)
    is_temporary_replacement: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    set_by_role: Mapped[Optional[str]] = mapped_column(String(32))
    reason: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DriverTimesheetDay(Base):
    __tablename__ = "driver_timesheet_days"
    __table_args__ = (
        UniqueConstraint("driver_id", "doc_date"),
        {"schema": "driver"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    driver_id: Mapped[str] = mapped_column(String(64), nullable=False)
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
    day_code: Mapped[TimesheetDayCodeEnum] = mapped_column(
        PgEnum(TimesheetDayCodeEnum, name="timesheet_day_code_enum", create_type=False),
        default=TimesheetDayCodeEnum.Я,
        nullable=False,
    )
    worked_hours: Mapped[Decimal] = mapped_column(Numeric(5, 2), default=Decimal("8.00"), nullable=False)


class DriverCard(Base):
    __tablename__ = "driver_cards"
    __table_args__ = (
        UniqueConstraint("branch_id", "id"),
        UniqueConstraint("branch_id", "driver_id", "card_last4"),
        {"schema": "driver"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    driver_id: Mapped[str] = mapped_column(String(64), nullable=False)
    card_last4: Mapped[str] = mapped_column(String(4), nullable=False)
    monthly_limit_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("150000.00"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class DriverCardTransaction(Base):
    __tablename__ = "driver_card_transactions"
    __table_args__ = {"schema": "driver"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    card_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("driver.driver_cards.id"))
    driver_id: Mapped[str] = mapped_column(String(64), nullable=False)
    source_equipment_id: Mapped[str] = mapped_column(String(64), nullable=False)
    target_equipment_id: Mapped[Optional[str]] = mapped_column(String(64))
    target_driver_id: Mapped[Optional[str]] = mapped_column(String(64))
    shift_report_id: Mapped[Optional[str]] = mapped_column(String(64))
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    order_id: Mapped[Optional[str]] = mapped_column(String(64))
    deal_id: Mapped[Optional[str]] = mapped_column(String(64))
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
    payment_category: Mapped[PaymentCategoryEnum] = mapped_column(
        PgEnum(PaymentCategoryEnum, name="payment_category_enum", create_type=False),
        nullable=False,
    )
    liters: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    amount_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reallocated_to_target: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    site_name: Mapped[Optional[str]] = mapped_column(String(255))
    comment: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DriverPayrollMonthly(Base):
    __tablename__ = "driver_payroll_monthly"
    __table_args__ = (
        UniqueConstraint("branch_id", "driver_id", "period_year", "period_month"),
        {"schema": "driver"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    driver_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("driver.drivers.id", ondelete="CASCADE"), nullable=False
    )
    period_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    period_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    total_hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("0.00"), nullable=False)
    accrued_salary_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    card_balance_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    fuel_discrepancy_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    reconciled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
