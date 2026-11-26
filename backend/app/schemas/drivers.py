from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Literal, Optional

from pydantic import EmailStr, Field

from app.schemas.base import (
    CamelModel,
    ClientType,
    DriverShiftRoster,
    PaymentCategory,
    TimesheetDayCode,
)


class DriverProfileBase(CamelModel):
    branch_id: str
    name: str
    phone: str
    max_linked: bool = True
    card_last4: Optional[str] = Field(default=None, max_length=4)
    card_limit_rub: Optional[Decimal] = Field(default=Decimal("150000.00"), ge=0)
    assigned_equipment_ids: List[str] = Field(default_factory=list)
    shift_roster: DriverShiftRoster = DriverShiftRoster.SHIFT_1
    needs_replacement: bool = False
    replacement_reason: Optional[str] = None
    timesheet_days: Dict[str, TimesheetDayCode] = Field(default_factory=dict)


class DriverProfileCreate(DriverProfileBase):
    pass


class DriverProfileUpdate(CamelModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    max_linked: Optional[bool] = None
    card_last4: Optional[str] = Field(default=None, max_length=4)
    card_limit_rub: Optional[Decimal] = Field(default=None, ge=0)
    assigned_equipment_ids: Optional[List[str]] = None
    shift_roster: Optional[DriverShiftRoster] = None
    needs_replacement: Optional[bool] = None
    replacement_reason: Optional[str] = None
    timesheet_days: Optional[Dict[str, TimesheetDayCode]] = None


class DriverProfileResponse(DriverProfileBase):
    id: str


class DriverTimesheetUpdateRequest(CamelModel):
    days: Dict[str, TimesheetDayCode]


class DriverReplacementRecord(CamelModel):
    equipment_id: str
    driver_id: str
    driver_name: str
    driver_phone: str
    set_by_role: Literal["fleet_manager", "director_admin"]
    reason: Optional[str] = None
    updated_at: Optional[datetime] = None


class DriverCardExpenseCreate(CamelModel):
    branch_id: str
    driver_id: str
    card_last4: str = Field(..., max_length=4)
    source_equipment_id: str
    shift_report_id: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    order_id: Optional[str] = None
    deal_id: Optional[str] = None
    payment_category: PaymentCategory
    target_equipment_id: Optional[str] = None
    target_driver_id: Optional[str] = None
    liters: Optional[Decimal] = Field(default=None, ge=0)
    amount_rub: Decimal = Field(..., gt=0)
    site_name: str = Field(..., max_length=255)
    receipt_photo_url: Optional[str] = None
    comment: Optional[str] = None


class DriverCardExpenseResponse(DriverCardExpenseCreate):
    id: str
    reallocated_to_target: bool
    source_driver_balance_rub: Decimal
    target_driver_balance_rub: Optional[Decimal] = None
    erp_crm_notified: bool
    created_at: datetime


class CustomerCreate(CamelModel):
    primary_branch_id: str
    client_type: ClientType = ClientType.LEGAL_ENTITY
    name: str
    full_name: Optional[str] = None
    opf: Optional[str] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    legal_address: Optional[str] = None
    director: Optional[str] = None
    bank_name: Optional[str] = None
    bik: Optional[str] = None
    checking_account: Optional[str] = None
    corr_account: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    is_regular_max: bool = False


class CustomerUpdate(CamelModel):
    name: Optional[str] = None
    full_name: Optional[str] = None
    opf: Optional[str] = None
    inn: Optional[str] = None
    kpp: Optional[str] = None
    ogrn: Optional[str] = None
    legal_address: Optional[str] = None
    director: Optional[str] = None
    bank_name: Optional[str] = None
    bik: Optional[str] = None
    checking_account: Optional[str] = None
    corr_account: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    is_regular_max: Optional[bool] = None
    notes: Optional[str] = None


class CustomerResponse(CustomerCreate):
    id: str
    credit_limit: Decimal
    current_debt: Decimal
    reliability_score: int
