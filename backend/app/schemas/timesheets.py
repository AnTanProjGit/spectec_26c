from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from pydantic import Field

from app.schemas.base import CamelModel, PaymentCategory, ShiftStatus


class ShiftReportCreate(CamelModel):
    branch_id: str
    equipment_id: str
    driver_id: Optional[str] = None
    operator_name: str = Field(..., max_length=150)
    driver_phone: Optional[str] = None
    card_last4: Optional[str] = Field(default=None, max_length=4)
    client_id: Optional[str] = None
    client_name: Optional[str] = Field(default=None, max_length=255)
    order_id: Optional[str] = None
    deal_id: Optional[str] = None
    site_name: str = Field(..., max_length=255)
    date: date
    shift_start_time: Optional[str] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    relocation_hours: Optional[Decimal] = Decimal("0.0")
    start_hours: Decimal = Field(..., ge=0)
    end_hours: Decimal = Field(..., ge=0)
    downtime_hours: Decimal = Field(default=Decimal("0.0"), ge=0)
    downtime_reason: Optional[str] = None
    mileage_km: Optional[Decimal] = Field(default=None, ge=0)
    trips_count: Optional[int] = Field(default=None, ge=0)
    fuel_liters_added: Decimal = Field(..., ge=0)
    payment_category: Optional[PaymentCategory] = PaymentCategory.FUEL_OWN_TANK
    payment_target_equipment_id: Optional[str] = None
    payment_amount_rub: Optional[Decimal] = Field(default=None, ge=0)
    subcontract_cost_rub: Optional[Decimal] = Field(default=Decimal("0.0"), ge=0)
    payment_comment: Optional[str] = None
    chat_note: Optional[str] = None
    waybill_generated: bool = False
    waybill_number: Optional[str] = None
    photo_verified: bool = False


class ShiftModerateRequest(CamelModel):
    operator_name: Optional[str] = None
    work_hours: Optional[Decimal] = Field(default=None, ge=0, le=24)
    downtime_hours: Optional[Decimal] = Field(default=None, ge=0, le=24)
    fuel_liters_added: Optional[Decimal] = Field(default=None, ge=0)
    calculated_salary: Optional[Decimal] = Field(default=None, ge=0)
    status: Optional[ShiftStatus] = None
    anomaly_message: Optional[str] = None
    chat_note: Optional[str] = None


class ShiftReportResponse(CamelModel):
    id: str
    branch_id: str
    shift_number: str
    date: date
    equipment_id: str
    equipment_name: str
    driver_id: Optional[str] = None
    operator_name: str
    driver_phone: Optional[str] = None
    card_last4: Optional[str] = None
    client_id: Optional[str] = None
    client_name: Optional[str] = None
    order_id: Optional[str] = None
    deal_id: Optional[str] = None
    site_name: str
    shift_start_time: Optional[str] = None
    work_start_time: Optional[str] = None
    work_end_time: Optional[str] = None
    relocation_hours: Optional[Decimal] = None
    start_hours: Decimal
    end_hours: Decimal
    work_hours: Decimal
    downtime_hours: Decimal
    downtime_reason: Optional[str] = None
    mileage_km: Optional[Decimal] = None
    trips_count: Optional[int] = None
    fuel_liters_added: Decimal
    fuel_hourly_calculated: Decimal
    payment_category: Optional[PaymentCategory] = None
    payment_target_equipment_id: Optional[str] = None
    payment_amount_rub: Optional[Decimal] = None
    subcontract_cost_rub: Optional[Decimal] = None
    payment_comment: Optional[str] = None
    chat_note: Optional[str] = None
    waybill_generated: Optional[bool] = None
    waybill_number: Optional[str] = None
    photo_verified: bool
    status: ShiftStatus
    anomaly_message: Optional[str] = None
    calculated_salary: Decimal
    created_at: Optional[datetime] = None
