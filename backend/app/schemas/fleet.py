from datetime import datetime
from decimal import Decimal
from typing import Any, Dict, Optional

from pydantic import Field

from app.schemas.base import CamelModel, EquipmentStatus, EquipmentType


class EquipmentBase(CamelModel):
    branch_id: str
    inventory_number: str = Field(..., max_length=50)
    name: str = Field(..., max_length=255)
    equipment_type: EquipmentType = Field(..., alias="type")
    brand: str = Field(..., max_length=100)
    plate_number: str = Field(..., max_length=50)
    vin: str = Field(..., max_length=32)
    year: int = Field(..., ge=1990, le=2035)
    owner: str = Field(..., max_length=255)
    purchase_price: Decimal = Field(..., ge=0)
    current_value: Decimal = Field(..., ge=0)
    hourly_rate: Decimal = Field(..., ge=0)
    fuel_rate_hour: Decimal = Field(..., ge=0)
    specs: Dict[str, Any] = Field(default_factory=dict)
    notes: Optional[str] = None


class EquipmentCreate(EquipmentBase):
    status: EquipmentStatus = EquipmentStatus.AVAILABLE
    assigned_site: Optional[str] = None
    assigned_operator: Optional[str] = None
    current_hours: Decimal = Field(default=Decimal("0.0"), ge=0)
    next_maintenance_in_hours: Decimal = Field(default=Decimal("250.0"), ge=0)


class EquipmentUpdate(CamelModel):
    branch_id: Optional[str] = None
    name: Optional[str] = None
    status: Optional[EquipmentStatus] = None
    assigned_site: Optional[str] = None
    assigned_operator: Optional[str] = None
    assigned_operator_id: Optional[str] = None
    hourly_rate: Optional[Decimal] = None
    fuel_rate_hour: Optional[Decimal] = None
    current_hours: Optional[Decimal] = None
    month_hours: Optional[Decimal] = None
    mileage_km_month: Optional[Decimal] = None
    trips_month: Optional[int] = None
    fuel_cost_month: Optional[Decimal] = None
    driver_salary_month: Optional[Decimal] = None
    repair_cost_month: Optional[Decimal] = None
    transport_cost_month: Optional[Decimal] = None
    subcontract_cost_month: Optional[Decimal] = None
    overheads_allocated: Optional[Decimal] = None
    downtime_hours_month: Optional[Decimal] = None
    next_maintenance_in_hours: Optional[Decimal] = None
    notes: Optional[str] = None


class EquipmentStatusPatch(CamelModel):
    status: EquipmentStatus
    reason: Optional[str] = None
    assigned_site: Optional[str] = None


class EquipmentVariableCostsPatch(CamelModel):
    equipment_id: str
    fuel_cost_month: Decimal = Field(..., ge=0)
    driver_salary_month: Decimal = Field(..., ge=0)
    repair_cost_month: Decimal = Field(..., ge=0)
    transport_cost_month: Decimal = Field(..., ge=0)
    hourly_rate: Optional[Decimal] = Field(default=None, ge=0)
    fuel_rate_hour: Optional[Decimal] = Field(default=None, ge=0)
    subcontract_cost_month: Optional[Decimal] = Field(default=None, ge=0)
    overheads_allocated: Optional[Decimal] = Field(default=None, ge=0)


class EquipmentResponse(EquipmentBase):
    id: str
    status: EquipmentStatus
    assigned_site: Optional[str] = None
    assigned_operator: Optional[str] = None
    current_hours: Decimal
    month_hours: Decimal
    mileage_km_month: Optional[Decimal] = Decimal("0.0")
    trips_month: Optional[int] = None
    revenue_month: Decimal
    fuel_cost_month: Decimal
    driver_salary_month: Decimal
    repair_cost_month: Decimal
    transport_cost_month: Decimal
    subcontract_cost_month: Decimal = Decimal("0.0")
    overheads_allocated: Decimal
    direct_costs_month: Decimal
    operating_profit_month: Decimal
    margin_percent: float
    downtime_hours_month: Decimal
    next_maintenance_in_hours: Decimal
    created_at: Optional[datetime] = None
