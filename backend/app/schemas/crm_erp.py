from datetime import date, datetime
from decimal import Decimal
from typing import Dict, List, Literal, Optional

from pydantic import Field

from app.schemas.base import (
    AccountingSubjectId,
    BranchOverheadCategory,
    CRMStage,
    CamelModel,
    ClientType,
    ClosingDocKind,
    EquipmentType,
    InvoiceStatus,
    OrderStatus,
    StatusNotificationCategory,
)


class ChatAttachment(CamelModel):
    id: str
    name: str
    size: int
    mime_type: str
    category: Literal["requisites", "site_photo", "other"]
    preview_url: Optional[str] = None


class ChatConfirmation(CamelModel):
    type: Literal["hours", "shift_close", "volume_trips"]
    label: str
    value: str
    equipment_name: Optional[str] = None
    shift_number: Optional[str] = None
    approved_by_admin: bool


class ChatMessageCreate(CamelModel):
    branch_id: str
    deal_id: Optional[str] = None
    sender_name: str
    sender_role: Literal["admin", "fleet_manager", "driver", "client"]
    text: str
    attachment: Optional[ChatAttachment] = None
    confirmation: Optional[ChatConfirmation] = None


class ChatMessageResponse(ChatMessageCreate):
    id: str
    timestamp: str


class DealShiftLog(CamelModel):
    id: str
    date: date
    shift_slot: Literal[1, 2]
    hours: Decimal = Field(..., ge=1, le=12)
    closed_at: datetime


class CloseDealShiftRequest(CamelModel):
    date: date
    shift_slot: Literal[1, 2]
    hours: Decimal = Field(..., ge=1, le=12)


class CRMDealCreate(CamelModel):
    branch_id: str
    client_name: str = Field(..., max_length=255)
    contact_person: str = Field(..., max_length=150)
    phone: str = Field(..., max_length=50)
    client_type: Optional[ClientType] = ClientType.LEGAL_ENTITY
    has_contract: Optional[bool] = True
    accounting_subject: Optional[AccountingSubjectId] = AccountingSubjectId.OOO_SPECIALTECH
    equipment_type: EquipmentType
    equipment_assigned_id: Optional[str] = None
    assigned_driver_id: Optional[str] = None
    assigned_driver_name: Optional[str] = None
    assigned_driver_phone: Optional[str] = None
    driver_assignment_mode: Optional[
        Literal["default_single", "timesheet_shift", "manager_replacement"]
    ] = "default_single"
    hours_requested: int = Field(..., gt=0)
    shifts_requested: Optional[int] = Field(default=None, ge=1)
    hourly_rate_agreed: Decimal = Field(..., gt=0)
    site_address: str
    manager: str
    attachments: List[ChatAttachment] = Field(default_factory=list)


class CRMDealUpdate(CamelModel):
    client_name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    client_type: Optional[ClientType] = None
    has_contract: Optional[bool] = None
    accounting_subject: Optional[AccountingSubjectId] = None
    equipment_type: Optional[EquipmentType] = None
    equipment_assigned_id: Optional[str] = None
    assigned_driver_id: Optional[str] = None
    assigned_driver_name: Optional[str] = None
    assigned_driver_phone: Optional[str] = None
    driver_assignment_mode: Optional[
        Literal["default_single", "timesheet_shift", "manager_replacement"]
    ] = None
    hours_requested: Optional[int] = Field(default=None, gt=0)
    shifts_requested: Optional[int] = Field(default=None, ge=1)
    hourly_rate_agreed: Optional[Decimal] = Field(default=None, gt=0)
    estimated_amount: Optional[Decimal] = Field(default=None, ge=0)
    debt_amount: Optional[Decimal] = Field(default=None, ge=0)
    paid_amount: Optional[Decimal] = Field(default=None, ge=0)
    site_address: Optional[str] = None
    manager: Optional[str] = None
    attachments: Optional[List[ChatAttachment]] = None


class CRMDealStagePatch(CamelModel):
    stage: CRMStage


class CRMDealResponse(CRMDealCreate):
    id: str
    estimated_amount: Decimal
    stage: CRMStage
    debt_amount: Decimal
    paid_amount: Decimal = Decimal("0.0")
    date_created: date
    shift_logs: List[DealShiftLog] = Field(default_factory=list)
    closed_shift_hours_total: Optional[Decimal] = Decimal("0.0")
    closed_volume_hours: Optional[Decimal] = None
    act_signed: bool = False
    act_number: Optional[str] = None
    ks2_number: Optional[str] = None
    ks3_number: Optional[str] = None
    act_saved_to_base: bool = False
    ks2_saved_to_base: bool = False
    ks3_saved_to_base: bool = False
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    invoice_status: InvoiceStatus = InvoiceStatus.NOT_ISSUED
    invoice_saved_to_base: bool = False
    stage_updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    archived_at: Optional[datetime] = None


class RentalOrderCreate(CamelModel):
    branch_id: str
    deal_id: Optional[str] = None
    order_number: Optional[str] = None
    client_name: str
    client_type: ClientType = ClientType.LEGAL_ENTITY
    has_contract: bool = True
    accounting_subject: AccountingSubjectId = AccountingSubjectId.OOO_SPECIALTECH
    equipment_id: str
    operator_name: str
    site_address: str
    start_date: date
    end_date: date
    planned_hours: int = Field(..., ge=0)
    hourly_rate: Decimal = Field(..., ge=0)


class RentalOrderResponse(CamelModel):
    id: str
    branch_id: str
    order_number: str
    client_name: str
    client_type: Optional[ClientType] = ClientType.LEGAL_ENTITY
    has_contract: Optional[bool] = True
    accounting_subject: Optional[AccountingSubjectId] = AccountingSubjectId.OOO_SPECIALTECH
    equipment_id: str
    equipment_name: Optional[str] = None
    operator_name: str
    site_address: str
    start_date: date
    end_date: date
    planned_hours: int
    actual_hours: Decimal
    closed_volume_hours: Optional[Decimal] = None
    hourly_rate: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    debt_amount: Decimal
    act_signed: bool
    act_number: Optional[str] = None
    ks2_number: Optional[str] = None
    ks3_number: Optional[str] = None
    act_saved_to_base: bool = False
    ks2_saved_to_base: bool = False
    ks3_saved_to_base: bool = False
    invoice_number: Optional[str] = None
    invoice_date: Optional[date] = None
    invoice_status: InvoiceStatus = InvoiceStatus.NOT_ISSUED
    invoice_saved_to_base: bool = False
    status: OrderStatus


class ClosingDocumentRecord(CamelModel):
    id: str
    kind: ClosingDocKind
    number: str
    date: date
    period_start: date
    period_end: date
    branch_id: str
    source_type: Literal["order", "deal"]
    source_id: str
    order_or_deal_number: str
    client_name: str
    client_inn: Optional[str] = None
    client_address: Optional[str] = None
    site_address: str
    equipment_name: str
    operator_name: str
    work_description: str
    unit_label: str = "маш.-час"
    quantity: Decimal = Field(..., ge=0)
    rate_rub: Decimal = Field(..., ge=0)
    total_amount_rub: Decimal = Field(..., ge=0)
    vat_amount_rub: Decimal = Field(..., ge=0)
    accounting_subject: AccountingSubjectId
    saved_to_base: bool = True
    saved_at: Optional[datetime] = None
    invoice_status: Optional[InvoiceStatus] = None
    paid_amount_rub: Optional[Decimal] = None
    printed_count: int = 0
    content_text: str


class CloseVolumeRequest(CamelModel):
    source_type: Literal["order", "deal"]
    source_id: str
    act_number: str
    ks2_number: str
    ks3_number: Optional[str] = None
    doc_date: date
    period_start: date
    period_end: date
    quantity: Decimal = Field(..., gt=0)
    unit_label: str = "маш.-час"
    rate_rub: Decimal = Field(..., ge=0)
    work_description: str
    accounting_subject: AccountingSubjectId


class IssueInvoiceRequest(CamelModel):
    source_type: Literal["order", "deal"]
    source_id: str
    invoice_number: str
    invoice_date: date
    period_start: date
    period_end: date
    quantity: Decimal = Field(..., gt=0)
    unit_label: str = "маш.-час"
    rate_rub: Decimal = Field(..., ge=0)
    work_description: str
    accounting_subject: AccountingSubjectId
    invoice_status: InvoiceStatus = InvoiceStatus.ISSUED
    paid_amount_rub: Decimal = Field(default=Decimal("0.0"), ge=0)


class UpdateInvoiceStatusRequest(CamelModel):
    invoice_status: InvoiceStatus
    paid_amount_rub: Decimal = Field(..., ge=0)


class StatusNotificationSettingsSchema(CamelModel):
    enabled: bool = True
    on_volume_close_act_ks2: bool = True
    on_act_signed_change: bool = True
    on_invoice_issued: bool = True
    on_invoice_status_change: bool = True
    send_to_branch_chat: bool = True
    send_to_max_client_bot: bool = False
    remind_debt_overdue_days: int = Field(default=5, ge=1, le=90)


class StatusNotificationItem(CamelModel):
    id: str
    timestamp: datetime
    branch_id: str
    title: str
    message: str
    category: StatusNotificationCategory
    entity_label: str
    channels: List[str]
    read: bool = False


class BranchPeriodFinancials(CamelModel):
    branch_id: str
    branch_code: str
    branch_name: str
    equipment_count: int
    rented_count: int
    hours: Decimal
    downtime_hours: Decimal = Decimal("0.0")
    utilization_pct: float
    mileage_km: Decimal = Decimal("0.0")
    trips_count: int = 0
    revenue: Decimal
    fuel_cost: Decimal
    salary_cost: Decimal
    repair_cost: Decimal
    transport_cost: Decimal
    subcontract_cost: Decimal
    direct_costs: Decimal
    fixed_overheads_total: Decimal
    fixed_by_category: Dict[BranchOverheadCategory, Decimal]
    equipment_overheads: Decimal
    total_overheads: Decimal
    total_expenses: Decimal
    gross_profit: Decimal
    gross_margin_pct: float
    operating_profit: Decimal
    operating_margin_pct: float
    revenue_share_pct: float
    profit_share_pct: float
    profit_per_unit: Decimal
    revenue_per_hour: Decimal
    total_cost_per_hour: Decimal
    direct_cost_per_hour: Decimal = Decimal("0.0")


class ConsolidatedBranchSummary(CamelModel):
    period_label: str
    active_months_count: int
    branch_rows: List[BranchPeriodFinancials]
    totals: BranchPeriodFinancials


class BranchCustomerRowResponse(CamelModel):
    client_name: str
    full_name: str
    is_regular_max: bool
    opf: str
    inn: str
    kpp: str
    ogrn: str
    legal_address: str
    director: str
    bank_name: str
    bik: str
    checking_account: str
    corr_account: str
    email: str
    site_address: str
    all_sites: List[str]
    contact_person: str
    phone: str
    has_contract: bool
    deals_count: int
    orders_count: int
    total_hours_worked: Decimal
    last_contract_number: str
    last_contract_caption: str
    latest_order_number: Optional[str] = None
    latest_deal_id: Optional[str] = None
    is_active: bool
    status_detail: str
    turnover_rub: Decimal
    paid_rub: Decimal
    debt_rub: Decimal
    subject_id: AccountingSubjectId
    manager_name: str
