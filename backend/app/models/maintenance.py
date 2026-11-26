import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import Computed, Date, DateTime, ForeignKey, Numeric, SmallInteger, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ServiceSchedule(Base):
    __tablename__ = "service_schedules"
    __table_args__ = {"schema": "maintenance"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    equipment_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("fleet.equipment.id", ondelete="CASCADE"), nullable=False
    )
    interval_hours: Mapped[Decimal] = mapped_column(Numeric(8, 1), default=Decimal("250.0"), nullable=False)
    last_service_hours: Mapped[Decimal] = mapped_column(Numeric(10, 1), default=Decimal("0.0"), nullable=False)
    next_service_hours: Mapped[Decimal] = mapped_column(Numeric(10, 1), default=Decimal("250.0"), nullable=False)
    warning_threshold_hours: Mapped[Decimal] = mapped_column(Numeric(8, 1), default=Decimal("25.0"), nullable=False)


class MaintenanceLog(Base):
    __tablename__ = "maintenance_logs"
    __table_args__ = {"schema": "maintenance"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    equipment_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("fleet.equipment.id", ondelete="CASCADE"), nullable=False
    )
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
    maintenance_type: Mapped[str] = mapped_column(String(40), nullable=False)
    engine_hours_at_service: Mapped[Decimal] = mapped_column(Numeric(10, 1), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    parts_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    labor_cost: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    service_contractor: Mapped[Optional[str]] = mapped_column(String(200))
    downtime_hours: Mapped[Decimal] = mapped_column(Numeric(8, 1), default=Decimal("0.0"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class SparePartUsage(Base):
    __tablename__ = "spare_parts_usage"
    __table_args__ = {"schema": "maintenance"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    maintenance_log_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("maintenance.maintenance_logs.id", ondelete="CASCADE"), nullable=False
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
    part_name: Mapped[str] = mapped_column(String(255), nullable=False)
    part_sku: Mapped[Optional[str]] = mapped_column(String(80))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("1"), nullable=False)
    total_cost_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
