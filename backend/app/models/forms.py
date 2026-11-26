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
    Integer,
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
    AccountingSubjectEnum,
    ClosingDocKindEnum,
    InvoiceStatusEnum,
    PaymentCategoryEnum,
    ShiftStatusEnum,
)


class ShiftReport(Base):
    __tablename__ = "shift_reports"
    __table_args__ = (
        UniqueConstraint("branch_id", "id"),
        UniqueConstraint("branch_id", "shift_number"),
        {"schema": "forms"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    order_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("erp.rental_orders.id", ondelete="SET NULL")
    )
    deal_id: Mapped[Optional[str]] = mapped_column(String(64))
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    client_name: Mapped[Optional[str]] = mapped_column(String(255))
    equipment_id: Mapped[str] = mapped_column(String(64), nullable=False)
    driver_id: Mapped[Optional[str]] = mapped_column(String(64))
    card_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    card_last4: Mapped[Optional[str]] = mapped_column(String(4))
    site_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True))
    shift_number: Mapped[str] = mapped_column(String(64), nullable=False)
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
    operator_name: Mapped[str] = mapped_column(String(150), nullable=False)
    driver_phone: Mapped[Optional[str]] = mapped_column(String(40))
    site_name: Mapped[str] = mapped_column(String(255), nullable=False)
    shift_start_time: Mapped[Optional[str]] = mapped_column(String(16))
    work_start_time: Mapped[Optional[str]] = mapped_column(String(16))
    work_end_time: Mapped[Optional[str]] = mapped_column(String(16))
    relocation_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(6, 2), default=Decimal("0.00"))
    start_hours: Mapped[Decimal] = mapped_column(Numeric(10, 1), nullable=False)
    end_hours: Mapped[Decimal] = mapped_column(Numeric(10, 1), nullable=False)
    work_hours: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False)
    downtime_hours: Mapped[Decimal] = mapped_column(Numeric(6, 2), default=Decimal("0.00"), nullable=False)
    downtime_reason: Mapped[Optional[str]] = mapped_column(Text)
    mileage_km: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 1))
    trips_count: Mapped[Optional[int]] = mapped_column(Integer)
    fuel_liters_added: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("0.00"), nullable=False)
    fuel_hourly_calculated: Mapped[Decimal] = mapped_column(Numeric(8, 2), default=Decimal("0.00"), nullable=False)
    payment_category: Mapped[Optional[PaymentCategoryEnum]] = mapped_column(
        PgEnum(PaymentCategoryEnum, name="payment_category_enum", create_type=False)
    )
    payment_target_equipment_id: Mapped[Optional[str]] = mapped_column(String(64))
    payment_amount_rub: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    subcontract_cost_rub: Mapped[Optional[Decimal]] = mapped_column(Numeric(12, 2))
    payment_comment: Mapped[Optional[str]] = mapped_column(Text)
    chat_note: Mapped[Optional[str]] = mapped_column(Text)
    waybill_generated: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    waybill_number: Mapped[Optional[str]] = mapped_column(String(64))
    photo_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[ShiftStatusEnum] = mapped_column(
        PgEnum(ShiftStatusEnum, name="shift_status_enum", create_type=False),
        default=ShiftStatusEnum.pending,
        nullable=False,
    )
    anomaly_message: Mapped[Optional[str]] = mapped_column(Text)
    calculated_salary: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Waybill(Base):
    __tablename__ = "waybills"
    __table_args__ = (
        UniqueConstraint("branch_id", "id"),
        UniqueConstraint("branch_id", "waybill_number"),
        {"schema": "forms"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    shift_report_id: Mapped[Optional[str]] = mapped_column(String(64))
    equipment_id: Mapped[str] = mapped_column(String(64), nullable=False)
    driver_id: Mapped[Optional[str]] = mapped_column(String(64))
    waybill_number: Mapped[str] = mapped_column(String(64), nullable=False)
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
    departure_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    return_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    odometer_start_km: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 1), default=Decimal("0"))
    odometer_end_km: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 1), default=Decimal("0"))
    fuel_start_l: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), default=Decimal("0"))
    fuel_refueled_l: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), default=Decimal("0"))
    fuel_end_l: Mapped[Optional[Decimal]] = mapped_column(Numeric(8, 2), default=Decimal("0"))
    medical_check_passed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    mechanic_release_passed: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)


class ClosingDocument(Base):
    __tablename__ = "closing_documents"
    __table_args__ = (
        UniqueConstraint("branch_id", "id"),
        UniqueConstraint("branch_id", "kind", "doc_number"),
        {"schema": "forms"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    kind: Mapped[ClosingDocKindEnum] = mapped_column(
        PgEnum(ClosingDocKindEnum, name="closing_doc_kind_enum", create_type=False), nullable=False
    )
    doc_number: Mapped[str] = mapped_column(String(64), nullable=False)
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
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    source_type: Mapped[str] = mapped_column(String(16), nullable=False)
    source_id: Mapped[str] = mapped_column(String(64), nullable=False)
    order_or_deal_number: Mapped[str] = mapped_column(String(64), nullable=False)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    client_inn: Mapped[Optional[str]] = mapped_column(String(12))
    client_address: Mapped[Optional[str]] = mapped_column(Text)
    site_address: Mapped[str] = mapped_column(Text, nullable=False)
    equipment_name: Mapped[str] = mapped_column(String(255), nullable=False)
    operator_name: Mapped[str] = mapped_column(String(150), nullable=False)
    work_description: Mapped[str] = mapped_column(Text, nullable=False)
    unit_label: Mapped[str] = mapped_column(String(32), default="маш.-час", nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    rate_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    total_amount_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    vat_amount_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    accounting_subject: Mapped[AccountingSubjectEnum] = mapped_column(
        PgEnum(AccountingSubjectEnum, name="accounting_subject_enum", create_type=False),
        default=AccountingSubjectEnum.ooo_specialtech,
        nullable=False,
    )
    saved_to_base: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    saved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    invoice_status: Mapped[Optional[InvoiceStatusEnum]] = mapped_column(
        PgEnum(InvoiceStatusEnum, name="invoice_status_enum", create_type=False)
    )
    paid_amount_rub: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    printed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_text: Mapped[str] = mapped_column(Text, nullable=False)


class WorkActItem(Base):
    __tablename__ = "work_act_items"
    __table_args__ = {"schema": "forms"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    closing_document_id: Mapped[str] = mapped_column(String(64), nullable=False)
    shift_report_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("forms.shift_reports.id", ondelete="SET NULL")
    )
    waybill_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("forms.waybills.id", ondelete="SET NULL")
    )
    equipment_id: Mapped[Optional[str]] = mapped_column(String(64))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    rate_rub: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    line_amount_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
