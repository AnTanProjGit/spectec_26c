import enum


class SystemRoleEnum(str, enum.Enum):
    admin = "admin"
    top_manager = "top_manager"
    fleet_manager = "fleet_manager"
    lawyer = "lawyer"
    accountant = "accountant"
    driver = "driver"


class PageAccessLevelEnum(str, enum.Enum):
    edit = "edit"
    view = "view"
    hidden = "hidden"


class EquipmentTypeEnum(str, enum.Enum):
    excavator = "excavator"
    crane = "crane"
    dump_truck = "dump_truck"
    loader = "loader"
    bulldozer = "bulldozer"
    cherry_picker = "cherry_picker"


class EquipmentStatusEnum(str, enum.Enum):
    rented = "rented"
    available = "available"
    maintenance = "maintenance"
    reserve = "reserve"


class EquipmentOwnershipEnum(str, enum.Enum):
    own = "own"
    leasing = "leasing"
    subrent = "subrent"


class CRMStageEnum(str, enum.Enum):
    lead = "lead"
    calculation = "calculation"
    contract = "contract"
    active = "active"
    completed = "completed"


class OrderStatusEnum(str, enum.Enum):
    active = "active"
    scheduled = "scheduled"
    completed = "completed"
    suspended = "suspended"


class ShiftStatusEnum(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    anomaly = "anomaly"


class PaymentCategoryEnum(str, enum.Enum):
    fuel_own_tank = "fuel_own_tank"
    fuel_for_equipment = "fuel_for_equipment"
    parts = "parts"
    other = "other"


class ClientTypeEnum(str, enum.Enum):
    legal_entity = "legal_entity"
    individual = "individual"


class AccountingSubjectEnum(str, enum.Enum):
    ip_specialtechnica = "ip_specialtechnica"
    ooo_specialtech = "ooo_specialtech"


class OverheadCategoryEnum(str, enum.Enum):
    office_itr_salary = "office_itr_salary"
    aho = "aho"
    leasing = "leasing"
    taxes = "taxes"
    other = "other"


class ClosingDocKindEnum(str, enum.Enum):
    act_services = "act_services"
    ks2 = "ks2"
    ks3 = "ks3"
    invoice = "invoice"


class InvoiceStatusEnum(str, enum.Enum):
    not_issued = "not_issued"
    issued = "issued"
    partially_paid = "partially_paid"
    paid = "paid"
    overdue = "overdue"


class NotificationCategoryEnum(str, enum.Enum):
    act_ks2 = "act_ks2"
    invoice = "invoice"
    payment_status = "payment_status"
    shift_close = "shift_close"


class TimesheetDayCodeEnum(str, enum.Enum):
    Я = "Я"
    Н = "Н"
    В = "В"
    Б = "Б"
    О = "О"


class DriverShiftRosterEnum(str, enum.Enum):
    shift_1 = "shift_1"
    shift_2 = "shift_2"


class LegalDocKindEnum(str, enum.Enum):
    contract = "contract"
    addendum = "addendum"
    dispute = "dispute"
    claim = "claim"
    template = "template"


class LegalDocStatusEnum(str, enum.Enum):
    draft = "draft"
    review = "review"
    active = "active"
    dispute = "dispute"
    resolved = "resolved"
    archived = "archived"


class KnowledgeCategoryEnum(str, enum.Enum):
    regulations = "regulations"
    contracts = "contracts"
    templates = "templates"
    disputes = "disputes"
    fuel_norms = "fuel_norms"
    maintenance = "maintenance"
    payroll = "payroll"


class AnomalySeverityEnum(str, enum.Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


class AnomalyCategoryEnum(str, enum.Enum):
    shift = "shift"
    fuel = "fuel"
    downtime = "downtime"
    finance = "finance"
    maintenance = "maintenance"
