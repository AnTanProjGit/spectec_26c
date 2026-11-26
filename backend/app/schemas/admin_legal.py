from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional

from pydantic import Field

from app.schemas.base import (
    AccountingSubjectId,
    CamelModel,
    KnowledgeCategory,
    LegalDocKind,
    LegalDocStatus,
    LegalRole,
    PageAccessLevel,
    SystemRoleId,
    TableViewId,
    TelemetryProtocol,
    TelemetryProvider,
)
from app.schemas.branches import FleetBranchResponse
from app.schemas.crm_erp import (
    CRMDealResponse,
    ChatMessageResponse,
    ClosingDocumentRecord,
    RentalOrderResponse,
    StatusNotificationItem,
    StatusNotificationSettingsSchema,
)
from app.schemas.drivers import DriverProfileResponse, DriverReplacementRecord
from app.schemas.fleet import EquipmentResponse
from app.schemas.timesheets import ShiftReportResponse


class LegalDocumentCreate(CamelModel):
    number: str
    title: str
    kind: LegalDocKind
    branch_id: Optional[str] = None
    counterparty: str
    accounting_subject: AccountingSubjectId
    status: LegalDocStatus = LegalDocStatus.DRAFT
    amount_rub: Decimal = Decimal("0.0")
    dispute_amount_rub: Optional[Decimal] = None
    dispute_reason: Optional[str] = None
    linked_order_number: Optional[str] = None
    in_knowledge_base: bool = False
    content: str


class LegalDocumentUpdate(CamelModel):
    title: Optional[str] = None
    status: Optional[LegalDocStatus] = None
    amount_rub: Optional[Decimal] = None
    dispute_amount_rub: Optional[Decimal] = None
    dispute_reason: Optional[str] = None
    content: Optional[str] = None
    action_details: Optional[str] = None


class LegalDocumentResponse(LegalDocumentCreate):
    id: str
    created_at: date
    updated_at: date
    author_name: str


class LegalHistoryEntryResponse(CamelModel):
    id: str
    document_id: str
    document_number: str
    document_title: str
    action: Literal[
        "created",
        "updated",
        "imported",
        "exported",
        "saved_to_base",
        "status_changed",
        "dispute_opened",
    ]
    actor_role: LegalRole
    actor_name: str
    timestamp: str
    details: str


class LegalPublishToKbRequest(CamelModel):
    mode: Literal["anonymized", "full"] = "anonymized"
    target_category: KnowledgeCategory


class LegalExportLogRequest(CamelModel):
    document_id: Optional[str] = None
    details: str


class AutoCustomerContractRequest(CamelModel):
    branch_id: str
    client_name: str
    subject_id: AccountingSubjectId
    has_contract: bool = True
    order_number: Optional[str] = None


class KnowledgeDocCreate(CamelModel):
    title: str
    category: KnowledgeCategory
    code: str
    excerpt: str
    tags: List[str] = Field(default_factory=list)
    full_text: str


class KnowledgeDocResponse(KnowledgeDocCreate):
    id: str
    date_updated: date


class OneCSubjectConfig(CamelModel):
    id: AccountingSubjectId
    entity_name: str
    short_name: str
    tax_system: str
    inn: str
    odata_url: str
    api_login: str
    api_secret: str = ""
    exchange_format: Literal["odata_v3", "rest_http_service"]
    auto_sync_docs: bool
    enabled: bool
    connection_status: Literal["connected", "disconnected", "error"]
    last_checked_at: Optional[str] = None


class OneCRoutingRules(CamelModel):
    legal_entity_target: AccountingSubjectId
    individual_with_contract_target: AccountingSubjectId
    individual_without_contract_target: AccountingSubjectId
    allow_individual_without_contract: bool
    require_contract_for_legal_entity: bool


class OneCIntegrationConfig(CamelModel):
    subjects: Dict[AccountingSubjectId, OneCSubjectConfig]
    routing: OneCRoutingRules


class MaxCustomerBotConfigSchema(CamelModel):
    enabled: bool = True
    allow_new_rental_requests: bool = True
    allow_shift_hour_confirmation: bool = True
    allow_site_chat_and_photos: bool = True
    auto_route_to_1c: bool = Field(default=True, alias="autoRouteTo1C")
    require_manager_moderation: bool = False


class TableViewSettings(CamelModel):
    label: str
    density: Literal["compact", "normal", "comfortable"] = "normal"
    page_size: int = Field(default=25, ge=5, le=200)
    allow_excel_export: bool = True
    show_branch_code: bool = True
    available_columns: List[str] = Field(default_factory=list)
    visible_columns: List[str] = Field(default_factory=list)


class LlmAdminSettings(CamelModel):
    provider: Literal["gemini_proxy", "openai_compatible", "local_vllm"] = "gemini_proxy"
    model: str = "gemini-4-hydrogen"
    proxy_endpoint: str = "/api/ai-analyst"
    server_token_env_var: str = "GEMINI_API_KEY"
    max_output_tokens: int = Field(default=4096, ge=256, le=32768)
    context_window_tokens: int = Field(default=128000, ge=4096)
    thinking_token_budget: int = Field(default=1024, ge=0, le=16384)
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    top_p: float = Field(default=0.9, ge=0.0, le=1.0)
    timeout_sec: int = Field(default=30, ge=5, le=180)
    response_format: Literal["json", "text"] = "json"
    system_instruction_suffix: str = ""


class RagBaseAdminSettings(CamelModel):
    storage_mode: Literal["local_hybrid", "postgres_pgvector", "onec_sync"] = "local_hybrid"
    vector_engine: Literal["faiss_flat", "faiss_hnsw", "pgvector"] = "faiss_hnsw"
    embedding_model: str = "text-embedding-004"
    chunk_size_tokens: int = Field(default=512, ge=128, le=4096)
    chunk_overlap_tokens: int = Field(default=64, ge=0, le=512)
    top_k: int = Field(default=5, ge=1, le=25)
    min_similarity: float = Field(default=0.72, ge=0.0, le=1.0)
    auto_reindex_on_save: bool = True
    indexed_categories: List[KnowledgeCategory] = Field(default_factory=list)
    last_indexed_at: str = ""


class RoleAccessFieldsPolicy(CamelModel):
    can_view_financial_margin: bool = False
    can_edit_payroll: bool = False
    can_approve_shifts: bool = False
    can_view_driver_max_phones: bool = False
    can_edit_knowledge_base: bool = False
    can_access_fixed_costs_table: bool = False
    can_access_variable_costs_table: bool = False


class RoleAccessPolicySchema(CamelModel):
    role: SystemRoleId
    label: str
    description: str
    pages: Dict[str, PageAccessLevel]
    fields: RoleAccessFieldsPolicy


class TelemetryEquipmentBinding(CamelModel):
    tracker_imei: str = Field(..., min_length=8, max_length=32)
    dut_enabled: bool = True
    can_enabled: bool = True
    status: Literal["online", "offline"] = "online"


class TelemetrySensorsFlags(CamelModel):
    gnss_position: bool = True
    fuel_level_dut: bool = True
    can_bus_hour_meter: bool = True
    ignition_and_pto: bool = True
    axle_load_weight: bool = True
    boom_tilt_and_safety: bool = True
    hydraulic_and_engine_temp: bool = True


class TelemetrySensorsAdminSettings(CamelModel):
    enabled: bool = True
    provider: TelemetryProvider = TelemetryProvider.WIALON_IPS
    protocol: TelemetryProtocol = TelemetryProtocol.WIALON_IPS_V2
    endpoint_url: str = "https://telematics.specialtech.local/api/v2"
    server_port: int = Field(default=20332, ge=1, le=65535)
    poll_interval_sec: int = Field(default=30, ge=5, le=3600)
    server_token_env_var: str = "GLONASS_API_TOKEN"
    last_sync_at: Optional[str] = None
    sensors: TelemetrySensorsFlags = Field(default_factory=TelemetrySensorsFlags)
    fuel_drain_threshold_liters: float = Field(default=15.0, ge=1.0)
    fuel_refuel_threshold_liters: float = Field(default=20.0, ge=1.0)
    hour_meter_tolerance_percent: float = Field(default=8.0, ge=0.0, le=100.0)
    geofence_radius_meters: int = Field(default=250, ge=10)
    idle_engine_alert_minutes: int = Field(default=30, ge=1)
    auto_match_shift_hours_with_can: bool = True
    auto_flag_fuel_anomaly: bool = True
    send_alerts_to_operational_chat: bool = True
    equipment_bindings: Dict[str, TelemetryEquipmentBinding] = Field(default_factory=dict)


class TelemetryConnectionTestRequest(CamelModel):
    provider: TelemetryProvider
    protocol: TelemetryProtocol
    endpoint_url: str
    server_port: int
    poll_interval_sec: int


class TelemetryConnectionTestResponse(CamelModel):
    connected: bool
    checked_at: str
    message: str


class SystemAdminConfigSchema(CamelModel):
    tables: Dict[TableViewId, TableViewSettings] = Field(default_factory=dict)
    llm: LlmAdminSettings = Field(default_factory=LlmAdminSettings)
    knowledge_rag: RagBaseAdminSettings = Field(default_factory=RagBaseAdminSettings)
    telemetry_sensors: TelemetrySensorsAdminSettings = Field(default_factory=TelemetrySensorsAdminSettings)
    access_policies: Dict[SystemRoleId, RoleAccessPolicySchema] = Field(default_factory=dict)
    admin_confirmation_allowed: bool = False


class ConfirmationGatePatch(CamelModel):
    admin_confirmation_allowed: bool


class FileUploadResponse(CamelModel):
    id: str
    name: str
    size: int
    mime_type: str
    category: Literal["requisites", "site_photo", "other"]
    preview_url: str


class ChatAgentHistoryTurn(CamelModel):
    role: Literal["user", "assistant"]
    text: str


class ChatAgentSourceMatch(CamelModel):
    source_type: Literal[
        "chat", "knowledge", "crm", "order", "fleet", "driver", "legal", "closing_doc"
    ]
    title: str
    detail: str


class ChatAgentQueryRequest(CamelModel):
    query: str = Field(..., min_length=1)
    history: List[ChatAgentHistoryTurn] = Field(default_factory=list)
    branch_id: Optional[str] = None
    branch_name: str = "Все участки"
    chat_messages: List[Dict[str, Any]] = Field(default_factory=list)
    knowledge_base: List[Dict[str, Any]] = Field(default_factory=list)
    crm_deals: List[Dict[str, Any]] = Field(default_factory=list)
    rental_orders: List[Dict[str, Any]] = Field(default_factory=list)
    fleet_units: List[Dict[str, Any]] = Field(default_factory=list)
    drivers: List[Dict[str, Any]] = Field(default_factory=list)
    legal_documents: List[Dict[str, Any]] = Field(default_factory=list)
    closing_docs: List[Dict[str, Any]] = Field(default_factory=list)
    shift_reports: List[Dict[str, Any]] = Field(default_factory=list)
    llm_config: Optional[Dict[str, Any]] = None


class ChatAgentQueryData(CamelModel):
    answer: str
    chat_summary: str = ""
    suggested_reply: str = ""
    matched_sources: List[ChatAgentSourceMatch] = Field(default_factory=list)


class ChatAgentQueryResponse(CamelModel):
    success: bool
    model: str
    data: ChatAgentQueryData


class WorkspaceBootstrapResponse(CamelModel):
    active_branch_id: str = "branch-hq"
    branches: List[FleetBranchResponse]
    equipment_list: List[EquipmentResponse]
    deals: List[CRMDealResponse]
    orders: List[RentalOrderResponse]
    closing_docs: List[ClosingDocumentRecord]
    shift_reports: List[ShiftReportResponse]
    drivers: List[DriverProfileResponse]
    driver_replacements: Dict[str, DriverReplacementRecord]
    anomalies: List[Dict[str, Any]]
    chat_messages: List[ChatMessageResponse]
    legal_documents: List[LegalDocumentResponse]
    legal_history: List[LegalHistoryEntryResponse]
    knowledge_docs: List[KnowledgeDocResponse]
    max_bot_configs: Dict[str, MaxCustomerBotConfigSchema]
    one_c_config: OneCIntegrationConfig = Field(..., alias="oneCConfig")
    admin_config: SystemAdminConfigSchema
    notification_settings: StatusNotificationSettingsSchema
    status_notifications: List[StatusNotificationItem]
