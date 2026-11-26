import uuid
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Dict, List, Optional

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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import (
    AccountingSubjectEnum,
    CRMStageEnum,
    ClientTypeEnum,
    EquipmentTypeEnum,
    InvoiceStatusEnum,
)


class CRMDeal(Base):
    __tablename__ = "deals"
    __table_args__ = (
        UniqueConstraint("branch_id", "id"),
        {"schema": "crm"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("customer.clients.id"))
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_person: Mapped[str] = mapped_column(String(150), nullable=False)
    phone: Mapped[str] = mapped_column(String(40), nullable=False)
    client_type: Mapped[ClientTypeEnum] = mapped_column(
        PgEnum(ClientTypeEnum, name="client_type_enum", create_type=False),
        default=ClientTypeEnum.legal_entity,
        nullable=False,
    )
    has_contract: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    accounting_subject: Mapped[AccountingSubjectEnum] = mapped_column(
        PgEnum(AccountingSubjectEnum, name="accounting_subject_enum", create_type=False),
        default=AccountingSubjectEnum.ooo_specialtech,
        nullable=False,
    )
    equipment_type: Mapped[EquipmentTypeEnum] = mapped_column(
        PgEnum(EquipmentTypeEnum, name="equipment_type_enum", create_type=False),
        nullable=False,
    )
    equipment_assigned_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("fleet.equipment.id", ondelete="SET NULL")
    )
    assigned_driver_id: Mapped[Optional[str]] = mapped_column(
        String(64), ForeignKey("driver.drivers.id", ondelete="SET NULL")
    )
    assigned_driver_name: Mapped[Optional[str]] = mapped_column(String(150))
    assigned_driver_phone: Mapped[Optional[str]] = mapped_column(String(40))
    driver_assignment_mode: Mapped[Optional[str]] = mapped_column(String(32))
    hours_requested: Mapped[int] = mapped_column(Integer, nullable=False)
    shifts_requested: Mapped[Optional[int]] = mapped_column(Integer)
    hourly_rate_agreed: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    estimated_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    stage: Mapped[CRMStageEnum] = mapped_column(
        PgEnum(CRMStageEnum, name="crm_stage_enum", create_type=False),
        default=CRMStageEnum.lead,
        nullable=False,
    )
    debt_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    site_address: Mapped[str] = mapped_column(Text, nullable=False)
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
    manager: Mapped[str] = mapped_column(String(150), nullable=False)
    closed_shift_hours_total: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2), default=Decimal("0.00"))
    closed_volume_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 2))
    act_signed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    act_number: Mapped[Optional[str]] = mapped_column(String(64))
    ks2_number: Mapped[Optional[str]] = mapped_column(String(64))
    ks3_number: Mapped[Optional[str]] = mapped_column(String(64))
    act_saved_to_base: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ks2_saved_to_base: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ks3_saved_to_base: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    invoice_number: Mapped[Optional[str]] = mapped_column(String(64))
    invoice_date: Mapped[Optional[date]] = mapped_column(Date)
    invoice_status: Mapped[InvoiceStatusEnum] = mapped_column(
        PgEnum(InvoiceStatusEnum, name="invoice_status_enum", create_type=False),
        default=InvoiceStatusEnum.not_issued,
        nullable=False,
    )
    invoice_saved_to_base: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    attachments: Mapped[List[Dict[str, Any]]] = mapped_column(JSONB, default=list, nullable=False)
    stage_updated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    shift_logs: Mapped[List["DealShiftLog"]] = relationship(
        back_populates="deal", cascade="all, delete-orphan", lazy="selectin"
    )


class DealShiftLog(Base):
    __tablename__ = "deal_shift_logs"
    __table_args__ = (
        UniqueConstraint("deal_id", "doc_date", "shift_slot"),
        {"schema": "crm"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    deal_id: Mapped[str] = mapped_column(String(64), ForeignKey("crm.deals.id", ondelete="CASCADE"), nullable=False)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
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
    shift_slot: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    hours: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    closed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    deal: Mapped["CRMDeal"] = relationship(back_populates="shift_logs")


class DealStageHistory(Base):
    __tablename__ = "deal_stage_history"
    __table_args__ = {"schema": "crm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    deal_id: Mapped[str] = mapped_column(String(64), ForeignKey("crm.deals.id", ondelete="CASCADE"), nullable=False)
    from_stage: Mapped[Optional[CRMStageEnum]] = mapped_column(
        PgEnum(CRMStageEnum, name="crm_stage_enum", create_type=False)
    )
    to_stage: Mapped[CRMStageEnum] = mapped_column(
        PgEnum(CRMStageEnum, name="crm_stage_enum", create_type=False), nullable=False
    )
    changed_by: Mapped[str] = mapped_column(String(150), nullable=False)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ClientCommunication(Base):
    __tablename__ = "client_communications"
    __table_args__ = {"schema": "crm"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    deal_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("crm.deals.id", ondelete="SET NULL"))
    doc_date: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False)
    period_day: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(DAY FROM doc_date)::SMALLINT", persisted=True)
    )
    period_month: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(MONTH FROM doc_date)::SMALLINT", persisted=True)
    )
    period_year: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(YEAR FROM doc_date)::SMALLINT", persisted=True)
    )
    sender_name: Mapped[str] = mapped_column(String(150), nullable=False)
    sender_role: Mapped[str] = mapped_column(String(32), nullable=False)
    message_text: Mapped[str] = mapped_column(Text, nullable=False)
    attachment: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    confirmation: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class DealConfirmation(Base):
    __tablename__ = "deal_confirmations"
    __table_args__ = {"schema": "crm"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    deal_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("crm.deals.id", ondelete="CASCADE"))
    doc_date: Mapped[date] = mapped_column(Date, server_default=func.current_date(), nullable=False)
    period_day: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(DAY FROM doc_date)::SMALLINT", persisted=True)
    )
    period_month: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(MONTH FROM doc_date)::SMALLINT", persisted=True)
    )
    period_year: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(YEAR FROM doc_date)::SMALLINT", persisted=True)
    )
    confirmation_type: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(200), nullable=False)
    value_text: Mapped[str] = mapped_column(String(100), nullable=False)
    approved_by_admin: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MaxCustomerBotConfig(Base):
    __tablename__ = "max_customer_bot_configs"
    __table_args__ = {"schema": "crm"}

    branch_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("branch.branches.id", ondelete="CASCADE"), primary_key=True
    )
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_new_rental_requests: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_shift_hour_confirmation: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_site_chat_and_photos: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    auto_route_to_1c: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    require_manager_moderation: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
