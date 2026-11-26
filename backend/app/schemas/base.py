from enum import Enum
from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        from_attributes=True,
    )


class SystemRoleId(str, Enum):
    ADMIN = "admin"
    TOP_MANAGER = "top_manager"
    FLEET_MANAGER = "fleet_manager"
    LAWYER = "lawyer"
    ACCOUNTANT = "accountant"
    DRIVER = "driver"


class LegalRole(str, Enum):
    ADMIN = "admin"
    TOP_MANAGER = "top_manager"
    LAWYER = "lawyer"
    ACCOUNTANT = "accountant"


class PageAccessLevel(str, Enum):
    EDIT = "edit"
    VIEW = "view"
    HIDDEN = "hidden"


class EquipmentType(str, Enum):
    EXCAVATOR = "excavator"
    CRANE = "crane"
    DUMP_TRUCK = "dump_truck"
    LOADER = "loader"
    BULLDOZER = "bulldozer"
    CHERRY_PICKER = "cherry_picker"


class EquipmentStatus(str, Enum):
    RENTED = "rented"
    AVAILABLE = "available"
    MAINTENANCE = "maintenance"
    RESERVE = "reserve"


class CRMStage(str, Enum):
    LEAD = "lead"
    CALCULATION = "calculation"
    CONTRACT = "contract"
    ACTIVE = "active"
    COMPLETED = "completed"


class OrderStatus(str, Enum):
    ACTIVE = "active"
    SCHEDULED = "scheduled"
    COMPLETED = "completed"
    SUSPENDED = "suspended"


class ShiftStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    ANOMALY = "anomaly"


class PaymentCategory(str, Enum):
    FUEL_OWN_TANK = "fuel_own_tank"
    FUEL_FOR_EQUIPMENT = "fuel_for_equipment"
    PARTS = "parts"
    OTHER = "other"


class ClientType(str, Enum):
    LEGAL_ENTITY = "legal_entity"
    INDIVIDUAL = "individual"


class AccountingSubjectId(str, Enum):
    IP_SPECIALTECHNICA = "ip_specialtechnica"
    OOO_SPECIALTECH = "ooo_specialtech"


class BranchOverheadCategory(str, Enum):
    OFFICE_ITR_SALARY = "office_itr_salary"
    AHO = "aho"
    LEASING = "leasing"
    TAXES = "taxes"
    OTHER = "other"


class ClosingDocKind(str, Enum):
    ACT_SERVICES = "act_services"
    KS2 = "ks2"
    KS3 = "ks3"
    INVOICE = "invoice"


class InvoiceStatus(str, Enum):
    NOT_ISSUED = "not_issued"
    ISSUED = "issued"
    PARTIALLY_PAID = "partially_paid"
    PAID = "paid"
    OVERDUE = "overdue"


class StatusNotificationCategory(str, Enum):
    ACT_KS2 = "act_ks2"
    INVOICE = "invoice"
    PAYMENT_STATUS = "payment_status"
    SHIFT_CLOSE = "shift_close"


class TimesheetDayCode(str, Enum):
    WORK_DAY = "Я"
    NIGHT = "Н"
    DAY_OFF = "В"
    SICK = "Б"
    VACATION = "О"


class DriverShiftRoster(str, Enum):
    SHIFT_1 = "shift_1"
    SHIFT_2 = "shift_2"


class LegalDocKind(str, Enum):
    CONTRACT = "contract"
    ADDENDUM = "addendum"
    DISPUTE = "dispute"
    CLAIM = "claim"
    TEMPLATE = "template"


class LegalDocStatus(str, Enum):
    DRAFT = "draft"
    REVIEW = "review"
    ACTIVE = "active"
    DISPUTE = "dispute"
    RESOLVED = "resolved"
    ARCHIVED = "archived"


class KnowledgeCategory(str, Enum):
    REGULATIONS = "regulations"
    CONTRACTS = "contracts"
    TEMPLATES = "templates"
    DISPUTES = "disputes"
    FUEL_NORMS = "fuel_norms"
    MAINTENANCE = "maintenance"
    PAYROLL = "payroll"


class TableViewId(str, Enum):
    FLEET = "fleet"
    RENTALS = "rentals"
    TIMESHEETS = "timesheets"
    CONTRACTS = "contracts"
    CRM = "crm"


class TelemetryProvider(str, Enum):
    WIALON_IPS = "wialon_ips"
    OMNICOMM = "omnicomm"
    GALILEOSKY = "galileosky"
    SCOUT_API = "scout_api"
    EGTS_RU = "egts_ru"


class TelemetryProtocol(str, Enum):
    WIALON_IPS_V2 = "wialon_ips_v2"
    EGTS = "egts"
    REST_JSON = "rest_json"
    MQTT_TELEMETRY = "mqtt_telemetry"
