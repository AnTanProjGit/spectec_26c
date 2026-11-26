from decimal import Decimal
from typing import List, Optional

from pydantic import Field

from app.schemas.base import (
    AccountingSubjectId,
    BranchOverheadCategory,
    CamelModel,
)


class BranchDocumentFlowConfig(CamelModel):
    isolated_streams: bool = True
    isolate_crm_and_erp: bool = True
    order_prefix: str = "RO-2026-"
    waybill_prefix: str = "ПЛ-"
    shift_prefix: str = "SH-"
    act_prefix: str = "КС2-"
    onec_department_code: str = Field(default="00-000001", alias="oneCDepartmentCode")
    default_1c_subject: AccountingSubjectId = Field(
        default=AccountingSubjectId.OOO_SPECIALTECH,
        alias="default1CSubject",
    )


class BranchOverheadDetailRow(CamelModel):
    id: str
    title: str
    basis: Optional[str] = None
    amount_rub: Decimal = Field(..., ge=0)


class BranchFixedOverheadItem(CamelModel):
    id: str
    category: BranchOverheadCategory
    name: str
    monthly_amount_rub: Decimal = Field(..., ge=0)
    note: Optional[str] = None
    hidden: bool = False
    details: Optional[List[BranchOverheadDetailRow]] = None


class FleetBranchCreate(CamelModel):
    code: str = Field(..., max_length=16)
    name: str = Field(..., max_length=200)
    city: str = Field(..., max_length=100)
    is_headquarters: bool = False
    fleet_manager_name: str
    fleet_manager_phone: Optional[str] = None
    chief_mechanic_name: Optional[str] = None
    chief_mechanic_phone: Optional[str] = None
    base_address: str
    regular_clients: List[str] = Field(default_factory=list)
    document_flow: BranchDocumentFlowConfig
    fixed_overheads: List[BranchFixedOverheadItem] = Field(default_factory=list)


class FleetBranchUpdate(CamelModel):
    code: Optional[str] = Field(default=None, max_length=16)
    name: Optional[str] = Field(default=None, max_length=200)
    city: Optional[str] = Field(default=None, max_length=100)
    is_headquarters: Optional[bool] = None
    fleet_manager_name: Optional[str] = None
    fleet_manager_phone: Optional[str] = None
    chief_mechanic_name: Optional[str] = None
    chief_mechanic_phone: Optional[str] = None
    base_address: Optional[str] = None
    regular_clients: Optional[List[str]] = None
    document_flow: Optional[BranchDocumentFlowConfig] = None
    fixed_overheads: Optional[List[BranchFixedOverheadItem]] = None


class FleetBranchResponse(FleetBranchCreate):
    id: str
    fixed_overheads_total_rub: Decimal = Decimal("0.00")
