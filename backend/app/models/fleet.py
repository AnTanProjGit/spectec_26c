import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from sqlalchemy import (
    Boolean,
    Computed,
    Date,
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
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import (
    EquipmentOwnershipEnum,
    EquipmentStatusEnum,
    EquipmentTypeEnum,
)


class EquipmentCategory(Base):
    __tablename__ = "equipment_categories"
    __table_args__ = {"schema": "fleet"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[EquipmentTypeEnum] = mapped_column(
        PgEnum(EquipmentTypeEnum, name="equipment_type_enum", create_type=False),
        unique=True,
        nullable=False,
    )
    name_ru: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)


class Equipment(Base):
    __tablename__ = "equipment"
    __table_args__ = (
        UniqueConstraint("branch_id", "id"),
        UniqueConstraint("branch_id", "inventory_number"),
        {"schema": "fleet"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    category_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("fleet.equipment_categories.id")
    )
    equipment_type: Mapped[EquipmentTypeEnum] = mapped_column(
        PgEnum(EquipmentTypeEnum, name="equipment_type_enum", create_type=False),
        nullable=False,
    )
    inventory_number: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    brand: Mapped[str] = mapped_column(String(100), nullable=False)
    plate_number: Mapped[str] = mapped_column(String(50), nullable=False)
    vin: Mapped[str] = mapped_column(String(32), nullable=False)
    year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    owner: Mapped[str] = mapped_column(String(255), nullable=False)
    ownership_type: Mapped[EquipmentOwnershipEnum] = mapped_column(
        PgEnum(EquipmentOwnershipEnum, name="equipment_ownership_enum", create_type=False),
        default=EquipmentOwnershipEnum.own,
        nullable=False,
    )
    purchase_price: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    current_value: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    status: Mapped[EquipmentStatusEnum] = mapped_column(
        PgEnum(EquipmentStatusEnum, name="equipment_status_enum", create_type=False),
        default=EquipmentStatusEnum.available,
        nullable=False,
    )
    current_site_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer.construction_sites.id", ondelete="SET NULL")
    )
    assigned_site: Mapped[Optional[str]] = mapped_column(String(255))
    assigned_operator: Mapped[Optional[str]] = mapped_column(String(150))
    current_hours: Mapped[Decimal] = mapped_column(Numeric(10, 1), default=Decimal("0.0"), nullable=False)
    month_hours: Mapped[Decimal] = mapped_column(Numeric(10, 1), default=Decimal("0.0"), nullable=False)
    mileage_km_month: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 1), default=Decimal("0.0"))
    trips_month: Mapped[Optional[int]] = mapped_column(Integer)
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    fuel_rate_hour: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("15.00"), nullable=False)
    fuel_cost_month: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    driver_salary_month: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    repair_cost_month: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    transport_cost_month: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    subcontract_cost_month: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    overheads_allocated: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    revenue_month: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    downtime_hours_month: Mapped[Decimal] = mapped_column(Numeric(10, 1), default=Decimal("0.0"), nullable=False)
    next_maintenance_in_hours: Mapped[Decimal] = mapped_column(Numeric(10, 1), default=Decimal("250.0"), nullable=False)
    specs: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EquipmentTariff(Base):
    __tablename__ = "equipment_tariffs"
    __table_args__ = {"schema": "fleet"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    equipment_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("fleet.equipment.id", ondelete="CASCADE"), nullable=False
    )
    valid_from: Mapped[date] = mapped_column(Date, nullable=False)
    hourly_rate_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    shift_rate_rub: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    fuel_norm_l_hour: Mapped[Decimal] = mapped_column(Numeric(8, 2), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class EquipmentTelemetryDaily(Base):
    __tablename__ = "equipment_telemetry_daily"
    __table_args__ = (
        UniqueConstraint("equipment_id", "doc_date"),
        {"schema": "fleet"},
    )

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
    can_engine_hours: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("0.00"), nullable=False)
    gps_mileage_km: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    dut_fuel_consumed_l: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    dut_fuel_drained_l: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    idle_engine_minutes: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    geofence_violations: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    raw_payload: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict)


class EquipmentTelemetryBinding(Base):
    __tablename__ = "equipment_telemetry_bindings"
    __table_args__ = {"schema": "fleet"}

    equipment_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("fleet.equipment.id", ondelete="CASCADE"), primary_key=True
    )
    tracker_imei: Mapped[str] = mapped_column(String(32), unique=True, nullable=False)
    dut_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    can_enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="online", nullable=False)
    last_packet_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
