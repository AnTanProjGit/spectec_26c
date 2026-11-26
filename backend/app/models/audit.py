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
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import AnomalyCategoryEnum, AnomalySeverityEnum


class AnomalyAlert(Base):
    __tablename__ = "anomaly_alerts"
    __table_args__ = {"schema": "audit"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    equipment_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("fleet.equipment.id", ondelete="SET NULL")
    )
    shift_report_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("forms.shift_reports.id", ondelete="SET NULL")
    )
    severity: Mapped[AnomalySeverityEnum] = mapped_column(
        PgEnum(AnomalySeverityEnum, name="anomaly_severity_enum", create_type=False), nullable=False
    )
    category: Mapped[AnomalyCategoryEnum] = mapped_column(
        PgEnum(AnomalyCategoryEnum, name="anomaly_category_enum", create_type=False), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    equipment_name: Mapped[Optional[str]] = mapped_column(String(255))
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
    impact_rubles: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2), default=Decimal("0.00"))
    resolved: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FuelAuditLog(Base):
    __tablename__ = "fuel_audit_logs"
    __table_args__ = {"schema": "audit"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    equipment_id: Mapped[str] = mapped_column(String(64), ForeignKey("fleet.equipment.id"), nullable=False)
    shift_report_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("forms.shift_reports.id", ondelete="SET NULL")
    )
    driver_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("driver.drivers.id"))
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
    norm_liters: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    fact_liters: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    deviation_liters: Mapped[Decimal] = mapped_column(
        Numeric(10, 2), Computed("fact_liters - norm_liters", persisted=True)
    )
    deviation_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    driver_notified: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    driver_reported: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
