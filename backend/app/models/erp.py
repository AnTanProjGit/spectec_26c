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
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base
from app.models.enums import (
    AccountingSubjectEnum,
    ClientTypeEnum,
    InvoiceStatusEnum,
    LegalDocKindEnum,
    LegalDocStatusEnum,
    NotificationCategoryEnum,
    OrderStatusEnum,
    SystemRoleEnum,
)


class AccountingSubject(Base):
    __tablename__ = "accounting_subjects"
    __table_args__ = {"schema": "erp"}

    id: Mapped[AccountingSubjectEnum] = mapped_column(
        PgEnum(AccountingSubjectEnum, name="accounting_subject_enum", create_type=False),
        primary_key=True,
    )
    entity_name: Mapped[str] = mapped_column(String(200), nullable=False)
    short_name: Mapped[str] = mapped_column(String(100), nullable=False)
    tax_system: Mapped[str] = mapped_column(String(100), nullable=False)
    inn: Mapped[str] = mapped_column(String(12), nullable=False)
    odata_url: Mapped[str] = mapped_column(Text, nullable=False)
    api_login: Mapped[str] = mapped_column(String(100), nullable=False)
    api_secret_encrypted: Mapped[Optional[str]] = mapped_column(Text)
    exchange_format: Mapped[str] = mapped_column(String(32), default="odata_v3", nullable=False)
    auto_sync_docs: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    connection_status: Mapped[str] = mapped_column(String(24), default="disconnected", nullable=False)
    routing_rules: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict, nullable=False)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))


class Contract(Base):
    __tablename__ = "contracts"
    __table_args__ = {"schema": "erp"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("branch.branches.id"))
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("customer.clients.id"))
    number: Mapped[str] = mapped_column(String(64), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    kind: Mapped[LegalDocKindEnum] = mapped_column(
        PgEnum(LegalDocKindEnum, name="legal_doc_kind_enum", create_type=False),
        default=LegalDocKindEnum.contract,
        nullable=False,
    )
    counterparty: Mapped[str] = mapped_column(String(255), nullable=False)
    accounting_subject: Mapped[AccountingSubjectEnum] = mapped_column(
        PgEnum(AccountingSubjectEnum, name="accounting_subject_enum", create_type=False),
        default=AccountingSubjectEnum.ooo_specialtech,
        nullable=False,
    )
    status: Mapped[LegalDocStatusEnum] = mapped_column(
        PgEnum(LegalDocStatusEnum, name="legal_doc_status_enum", create_type=False),
        default=LegalDocStatusEnum.active,
        nullable=False,
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
    author_name: Mapped[str] = mapped_column(String(150), nullable=False)
    amount_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    dispute_amount_rub: Mapped[Optional[Decimal]] = mapped_column(Numeric(14, 2))
    dispute_reason: Mapped[Optional[str]] = mapped_column(Text)
    linked_order_number: Mapped[Optional[str]] = mapped_column(String(64))
    in_knowledge_base: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class LegalDispute(Base):
    __tablename__ = "legal_disputes"
    __table_args__ = {"schema": "erp"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("branch.branches.id"))
    contract_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("erp.contracts.id", ondelete="SET NULL"))
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("customer.clients.id"))
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
    claim_amount_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[LegalDocStatusEnum] = mapped_column(
        PgEnum(LegalDocStatusEnum, name="legal_doc_status_enum", create_type=False),
        default=LegalDocStatusEnum.dispute,
        nullable=False,
    )


class LegalHistory(Base):
    __tablename__ = "legal_history"
    __table_args__ = {"schema": "erp"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    document_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("erp.contracts.id", ondelete="CASCADE"), nullable=False
    )
    document_number: Mapped[str] = mapped_column(String(64), nullable=False)
    document_title: Mapped[str] = mapped_column(String(300), nullable=False)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    actor_role: Mapped[SystemRoleEnum] = mapped_column(
        PgEnum(SystemRoleEnum, name="system_role_enum", create_type=False), nullable=False
    )
    actor_name: Mapped[str] = mapped_column(String(150), nullable=False)
    details: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RentalOrder(Base):
    __tablename__ = "rental_orders"
    __table_args__ = (
        UniqueConstraint("branch_id", "id"),
        UniqueConstraint("branch_id", "order_number"),
        {"schema": "erp"},
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    deal_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("crm.deals.id", ondelete="SET NULL"))
    contract_id: Mapped[Optional[str]] = mapped_column(String(64), ForeignKey("erp.contracts.id", ondelete="SET NULL"))
    client_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("customer.clients.id"))
    site_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("customer.construction_sites.id")
    )
    equipment_id: Mapped[str] = mapped_column(String(64), nullable=False)
    driver_id: Mapped[Optional[str]] = mapped_column(String(64))
    order_number: Mapped[str] = mapped_column(String(64), nullable=False)
    client_name: Mapped[str] = mapped_column(String(255), nullable=False)
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
    operator_name: Mapped[str] = mapped_column(String(150), nullable=False)
    site_address: Mapped[str] = mapped_column(Text, nullable=False)
    doc_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    period_day: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(DAY FROM doc_date)::SMALLINT", persisted=True)
    )
    period_month: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(MONTH FROM doc_date)::SMALLINT", persisted=True)
    )
    period_year: Mapped[int] = mapped_column(
        SmallInteger, Computed("EXTRACT(YEAR FROM doc_date)::SMALLINT", persisted=True)
    )
    planned_hours: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    actual_hours: Mapped[Decimal] = mapped_column(Numeric(10, 1), default=Decimal("0.0"), nullable=False)
    closed_volume_hours: Mapped[Optional[Decimal]] = mapped_column(Numeric(10, 1))
    hourly_rate: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0.00"), nullable=False)
    status: Mapped[OrderStatusEnum] = mapped_column(
        PgEnum(OrderStatusEnum, name="order_status_enum", create_type=False),
        default=OrderStatusEnum.active,
        nullable=False,
    )
    act_signed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    paid_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
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
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CostAllocationMonthly(Base):
    __tablename__ = "cost_allocations_monthly"
    __table_args__ = (
        UniqueConstraint("branch_id", "equipment_id", "period_year", "period_month"),
        {"schema": "erp"},
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    equipment_id: Mapped[str] = mapped_column(
        String(64), ForeignKey("fleet.equipment.id", ondelete="CASCADE"), nullable=False
    )
    period_month: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    period_year: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    revenue_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    fuel_cost_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    driver_salary_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    repair_cost_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    transport_cost_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    subcontract_cost_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    overheads_allocated_rub: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    operating_profit_rub: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed(
            "revenue_rub - (fuel_cost_rub + driver_salary_rub + repair_cost_rub + transport_cost_rub + subcontract_cost_rub) - overheads_allocated_rub",
            persisted=True,
        ),
    )


class OneCSyncLog(Base):
    __tablename__ = "onec_sync_logs"
    __table_args__ = {"schema": "erp"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
    accounting_subject: Mapped[AccountingSubjectEnum] = mapped_column(
        PgEnum(AccountingSubjectEnum, name="accounting_subject_enum", create_type=False), nullable=False
    )
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
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[str] = mapped_column(String(64), nullable=False)
    onec_department_code: Mapped[str] = mapped_column(String(32), nullable=False)
    sync_status: Mapped[str] = mapped_column(String(24), default="queued", nullable=False)
    response_payload: Mapped[Dict[str, Any]] = mapped_column(JSONB, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StatusNotificationSettings(Base):
    __tablename__ = "status_notification_settings"
    __table_args__ = {"schema": "erp"}

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    on_volume_close_act_ks2: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    on_act_signed_change: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    on_invoice_issued: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    on_invoice_status_change: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    send_to_branch_chat: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    send_to_max_client_bot: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    remind_debt_overdue_days: Mapped[int] = mapped_column(Integer, default=5, nullable=False)


class StatusNotification(Base):
    __tablename__ = "status_notifications"
    __table_args__ = {"schema": "erp"}

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    branch_id: Mapped[str] = mapped_column(String(64), ForeignKey("branch.branches.id"), nullable=False)
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
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[NotificationCategoryEnum] = mapped_column(
        PgEnum(NotificationCategoryEnum, name="notification_category_enum", create_type=False),
        nullable=False,
    )
    entity_label: Mapped[str] = mapped_column(String(150), nullable=False)
    channels: Mapped[List[str]] = mapped_column(ARRAY(Text), default=lambda: ["erp"], nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
