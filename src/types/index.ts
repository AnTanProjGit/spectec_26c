export interface BranchDocumentFlowConfig {
  isolatedStreams: boolean;
  isolateCrmAndErp: boolean;
  orderPrefix: string;
  waybillPrefix: string;
  shiftPrefix: string;
  actPrefix: string;
  oneCDepartmentCode: string;
  default1CSubject: AccountingSubjectId;
}

export type BranchOverheadCategory =
  | 'office_itr_salary'
  | 'aho'
  | 'leasing'
  | 'taxes'
  | 'other';

export interface BranchOverheadDetailRow {
  id: string;
  title: string;
  basis?: string;
  amountRub: number;
}

export interface BranchFixedOverheadItem {
  id: string;
  category: BranchOverheadCategory;
  name: string;
  monthlyAmountRub: number;
  note?: string;
  hidden?: boolean;
  details?: BranchOverheadDetailRow[];
}

export interface FleetBranch {
  id: string;
  code: string;
  name: string;
  city: string;
  isHeadquarters: boolean;
  fleetManagerName: string;
  fleetManagerPhone?: string;
  chiefMechanicName?: string;
  chiefMechanicPhone?: string;
  baseAddress: string;
  regularClients: string[];
  documentFlow: BranchDocumentFlowConfig;
  fixedOverheads?: BranchFixedOverheadItem[];
}

export type EquipmentType = 
  | 'excavator' 
  | 'crane' 
  | 'dump_truck' 
  | 'loader' 
  | 'bulldozer' 
  | 'cherry_picker';

export type EquipmentStatus = 
  | 'rented' 
  | 'available' 
  | 'maintenance' 
  | 'reserve';

export interface Equipment {
  id: string;
  branchId: string;
  inventoryNumber: string;
  name: string;
  type: EquipmentType;
  brand: string;
  plateNumber: string;
  vin: string;
  year: number;
  owner: string;
  purchasePrice: number;
  currentValue: number;
  status: EquipmentStatus;
  assignedSite?: string;
  assignedOperator?: string;
  currentHours: number;
  monthHours: number;
  mileageKmMonth?: number;
  tripsMonth?: number;
  hourlyRate: number;
  fuelRateHour: number; // liters/hour
  fuelCostMonth: number;
  driverSalaryMonth: number;
  repairCostMonth: number;
  transportCostMonth: number;
  subcontractCostMonth?: number;
  overheadsAllocated: number;
  revenueMonth: number;
  downtimeHoursMonth: number;
  nextMaintenanceInHours: number;
  specs: {
    capacity?: string; // e.g. "21 т", "50 т", "20 м³"
    boomLength?: string;
    bucketVolume?: string;
    weight: string;
  };
  notes?: string;
}

export type CRMStage = 
  | 'lead' 
  | 'calculation' 
  | 'contract' 
  | 'active' 
  | 'completed';

export type ClientType = 'legal_entity' | 'individual';

export type AccountingSubjectId = 'ip_specialtechnica' | 'ooo_specialtech';

export interface OneCSubjectConfig {
  id: AccountingSubjectId;
  entityName: string;
  shortName: string;
  taxSystem: string;
  inn: string;
  odataUrl: string;
  apiLogin: string;
  apiSecret: string;
  exchangeFormat: 'odata_v3' | 'rest_http_service';
  autoSyncDocs: boolean;
  enabled: boolean;
  connectionStatus: 'connected' | 'disconnected' | 'error';
  lastCheckedAt?: string;
}

export interface OneCRoutingRules {
  legalEntityTarget: AccountingSubjectId;
  individualWithContractTarget: AccountingSubjectId;
  individualWithoutContractTarget: AccountingSubjectId;
  allowIndividualWithoutContract: boolean;
  requireContractForLegalEntity: boolean;
}

export interface OneCIntegrationConfig {
  subjects: Record<AccountingSubjectId, OneCSubjectConfig>;
  routing: OneCRoutingRules;
}

export interface ChatAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  category: 'requisites' | 'site_photo' | 'other';
  previewUrl?: string;
}

export interface ChatConfirmation {
  type: 'hours' | 'shift_close' | 'volume_trips';
  label: string;
  value: string;
  equipmentName?: string;
  shiftNumber?: string;
  approvedByAdmin: boolean;
}

export interface ChatMessage {
  id: string;
  branchId: string;
  dealId?: string;
  senderName: string;
  senderRole: 'admin' | 'fleet_manager' | 'driver' | 'client';
  text: string;
  timestamp: string;
  attachment?: ChatAttachment;
  confirmation?: ChatConfirmation;
}

export type InvoiceStatus = 'not_issued' | 'issued' | 'partially_paid' | 'paid' | 'overdue';

export type ClosingDocKind = 'act_services' | 'ks2' | 'ks3' | 'invoice';

export interface ClosingDocumentRecord {
  id: string;
  kind: ClosingDocKind;
  number: string;
  date: string;
  periodStart: string;
  periodEnd: string;
  branchId: string;
  sourceType: 'order' | 'deal';
  sourceId: string;
  orderOrDealNumber: string;
  clientName: string;
  clientInn?: string;
  clientAddress?: string;
  siteAddress: string;
  equipmentName: string;
  operatorName: string;
  workDescription: string;
  unitLabel: string;
  quantity: number;
  rateRub: number;
  totalAmountRub: number;
  vatAmountRub: number;
  accountingSubject: AccountingSubjectId;
  savedToBase: boolean;
  savedAt?: string;
  invoiceStatus?: InvoiceStatus;
  paidAmountRub?: number;
  printedCount?: number;
  contentText: string;
}

export type StatusNotificationCategory = 'act_ks2' | 'invoice' | 'payment_status' | 'shift_close';

export interface StatusNotificationItem {
  id: string;
  timestamp: string;
  branchId: string;
  title: string;
  message: string;
  category: StatusNotificationCategory;
  entityLabel: string;
  channels: string[];
  read: boolean;
}

export interface StatusNotificationSettings {
  enabled: boolean;
  onVolumeCloseActKs2: boolean;
  onActSignedChange: boolean;
  onInvoiceIssued: boolean;
  onInvoiceStatusChange: boolean;
  sendToBranchChat: boolean;
  sendToMaxClientBot: boolean;
  remindDebtOverdueDays: number;
}

export interface DealShiftLog {
  id: string;
  date: string;
  shiftSlot: 1 | 2;
  hours: number;
  closedAt: string;
}

export interface CRMDeal {
  id: string;
  branchId: string;
  clientName: string;
  contactPerson: string;
  phone: string;
  clientType?: ClientType;
  hasContract?: boolean;
  accountingSubject?: AccountingSubjectId;
  equipmentType: EquipmentType;
  equipmentAssignedId?: string;
  assignedDriverId?: string;
  assignedDriverName?: string;
  assignedDriverPhone?: string;
  driverAssignmentMode?: 'default_single' | 'timesheet_shift' | 'manager_replacement';
  hoursRequested: number;
  shiftsRequested?: number;
  hourlyRateAgreed: number;
  estimatedAmount: number;
  stage: CRMStage;
  debtAmount: number;
  siteAddress: string;
  dateCreated: string;
  manager: string;
  attachments?: ChatAttachment[];
  shiftLogs?: DealShiftLog[];
  closedShiftHoursTotal?: number;
  closedVolumeHours?: number;
  actSigned?: boolean;
  actNumber?: string;
  ks2Number?: string;
  ks3Number?: string;
  actSavedToBase?: boolean;
  ks2SavedToBase?: boolean;
  ks3SavedToBase?: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceStatus?: InvoiceStatus;
  invoiceSavedToBase?: boolean;
  paidAmount?: number;
  stageUpdatedAt?: string;
  completedAt?: string;
  archivedAt?: string;
}

export type OrderStatus = 'active' | 'scheduled' | 'completed' | 'suspended';

export interface RentalOrder {
  id: string;
  branchId: string;
  orderNumber: string;
  clientName: string;
  clientType?: ClientType;
  hasContract?: boolean;
  accountingSubject?: AccountingSubjectId;
  equipmentId: string;
  operatorName: string;
  siteAddress: string;
  startDate: string;
  endDate: string;
  plannedHours: number;
  actualHours: number;
  hourlyRate: number;
  status: OrderStatus;
  actSigned: boolean;
  paidAmount: number;
  totalAmount: number;
  closedVolumeHours?: number;
  actNumber?: string;
  ks2Number?: string;
  ks3Number?: string;
  actSavedToBase?: boolean;
  ks2SavedToBase?: boolean;
  ks3SavedToBase?: boolean;
  invoiceNumber?: string;
  invoiceDate?: string;
  invoiceStatus?: InvoiceStatus;
  invoiceSavedToBase?: boolean;
}

export type PaymentCategory =
  | 'fuel_own_tank'
  | 'fuel_for_equipment'
  | 'parts'
  | 'other';

export type DriverShiftRoster = 'shift_1' | 'shift_2';

export interface DriverProfile {
  id: string;
  branchId: string;
  name: string;
  phone: string;
  maxLinked: boolean;
  cardLast4?: string;
  cardLimitRub?: number;
  assignedEquipmentIds: string[];
  shiftRoster: DriverShiftRoster;
  needsReplacement?: boolean;
  replacementReason?: string;
  timesheetDays?: Record<string, TimesheetDayCode>;
}

export interface DriverReplacementRecord {
  equipmentId: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  setByRole: 'fleet_manager' | 'director_admin';
  reason?: string;
  updatedAt: string;
}

export interface ShiftReport {
  id: string;
  branchId: string;
  shiftNumber: string;
  date: string;
  equipmentId: string;
  driverId?: string;
  operatorName: string;
  driverPhone?: string;
  cardLast4?: string;
  clientName?: string;
  orderId?: string;
  dealId?: string;
  siteName: string;
  shiftStartTime?: string;
  workStartTime?: string;
  workEndTime?: string;
  relocationHours?: number;
  startHours: number;
  endHours: number;
  workHours: number;
  downtimeHours: number;
  mileageKm?: number;
  tripsCount?: number;
  downtimeReason?: string;
  fuelLitersAdded: number;
  fuelHourlyCalculated: number;
  paymentCategory?: PaymentCategory;
  paymentTargetEquipmentId?: string;
  paymentAmountRub?: number;
  subcontractCostRub?: number;
  paymentComment?: string;
  chatNote?: string;
  waybillGenerated?: boolean;
  waybillNumber?: string;
  photoVerified: boolean;
  status: 'approved' | 'pending' | 'anomaly';
  anomalyMessage?: string;
  calculatedSalary: number;
}

export interface AnomalyAlert {
  id: string;
  branchId: string;
  severity: 'critical' | 'warning' | 'info';
  category: 'shift' | 'fuel' | 'downtime' | 'finance' | 'maintenance';
  title: string;
  description: string;
  equipmentId?: string;
  equipmentName?: string;
  date: string;
  impactRubles?: number;
  resolved: boolean;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  category: 'regulations' | 'contracts' | 'templates' | 'disputes' | 'fuel_norms' | 'maintenance' | 'payroll';
  code: string;
  dateUpdated: string;
  excerpt: string;
  fullText: string;
  tags: string[];
}

export interface MaxCustomerBotConfig {
  enabled: boolean;
  allowNewRentalRequests: boolean;
  allowShiftHourConfirmation: boolean;
  allowSiteChatAndPhotos: boolean;
  autoRouteTo1C: boolean;
  requireManagerModeration: boolean;
}

export type LegalRole = 'admin' | 'top_manager' | 'lawyer' | 'accountant';

export type LegalDocKind = 'contract' | 'addendum' | 'dispute' | 'claim' | 'template';

export type LegalDocStatus = 'draft' | 'review' | 'active' | 'dispute' | 'resolved' | 'archived';

export interface LegalDocument {
  id: string;
  number: string;
  title: string;
  kind: LegalDocKind;
  branchId: string;
  counterparty: string;
  accountingSubject: AccountingSubjectId;
  status: LegalDocStatus;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  amountRub: number;
  disputeAmountRub?: number;
  disputeReason?: string;
  linkedOrderNumber?: string;
  inKnowledgeBase: boolean;
  content: string;
}

export interface LegalHistoryEntry {
  id: string;
  documentId: string;
  documentNumber: string;
  documentTitle: string;
  action: 'created' | 'updated' | 'imported' | 'exported' | 'saved_to_base' | 'status_changed' | 'dispute_opened';
  actorRole: LegalRole;
  actorName: string;
  timestamp: string;
  details: string;
}

export type TimesheetDayCode = 'Я' | 'Н' | 'В' | 'Б' | 'О';

export type TableViewId = 'fleet' | 'rentals' | 'timesheets' | 'contracts' | 'crm';

export interface TableViewSettings {
  label: string;
  density: 'compact' | 'normal' | 'comfortable';
  pageSize: number;
  allowExcelExport: boolean;
  showBranchCode: boolean;
  availableColumns: string[];
  visibleColumns: string[];
}

export interface LlmAdminSettings {
  provider: 'gemini_proxy' | 'openai_compatible' | 'local_vllm';
  model: string;
  proxyEndpoint: string;
  serverTokenEnvVar: string;
  maxOutputTokens: number;
  contextWindowTokens: number;
  thinkingTokenBudget: number;
  temperature: number;
  topP: number;
  timeoutSec: number;
  responseFormat: 'json' | 'text';
  systemInstructionSuffix: string;
}

export interface RagBaseAdminSettings {
  storageMode: 'local_hybrid' | 'postgres_pgvector' | 'onec_sync';
  vectorEngine: 'faiss_flat' | 'faiss_hnsw' | 'pgvector';
  embeddingModel: string;
  chunkSizeTokens: number;
  chunkOverlapTokens: number;
  topK: number;
  minSimilarity: number;
  autoReindexOnSave: boolean;
  indexedCategories: KnowledgeDoc['category'][];
  lastIndexedAt: string;
}

export type SystemRoleId =
  | 'admin'
  | 'top_manager'
  | 'fleet_manager'
  | 'lawyer'
  | 'accountant'
  | 'driver';

export type PageAccessLevel = 'edit' | 'view' | 'hidden';

export interface RoleAccessPolicy {
  role: SystemRoleId;
  label: string;
  description: string;
  pages: Record<string, PageAccessLevel>;
  fields: {
    canViewFinancialMargin: boolean;
    canEditPayroll: boolean;
    canApproveShifts: boolean;
    canViewDriverMaxPhones: boolean;
    canEditKnowledgeBase: boolean;
    canAccessFixedCostsTable: boolean;
    canAccessVariableCostsTable: boolean;
  };
}

export interface TelemetryEquipmentBinding {
  trackerImei: string;
  dutEnabled: boolean;
  canEnabled: boolean;
  status: 'online' | 'offline';
}

export interface TelemetrySensorsAdminSettings {
  enabled: boolean;
  provider: 'wialon_ips' | 'omnicomm' | 'galileosky' | 'scout_api' | 'egts_ru';
  protocol: 'wialon_ips_v2' | 'egts' | 'rest_json' | 'mqtt_telemetry';
  endpointUrl: string;
  serverPort: number;
  pollIntervalSec: number;
  serverTokenEnvVar: string;
  lastSyncAt?: string;
  sensors: {
    gnssPosition: boolean;
    fuelLevelDut: boolean;
    canBusHourMeter: boolean;
    ignitionAndPto: boolean;
    axleLoadWeight: boolean;
    boomTiltAndSafety: boolean;
    hydraulicAndEngineTemp: boolean;
  };
  fuelDrainThresholdLiters: number;
  fuelRefuelThresholdLiters: number;
  hourMeterTolerancePercent: number;
  geofenceRadiusMeters: number;
  idleEngineAlertMinutes: number;
  autoMatchShiftHoursWithCan: boolean;
  autoFlagFuelAnomaly: boolean;
  sendAlertsToOperationalChat: boolean;
  equipmentBindings: Record<string, TelemetryEquipmentBinding>;
}

export interface SystemAdminConfig {
  tables: Record<TableViewId, TableViewSettings>;
  llm: LlmAdminSettings;
  knowledgeRag: RagBaseAdminSettings;
  telemetrySensors: TelemetrySensorsAdminSettings;
  accessPolicies: Record<SystemRoleId, RoleAccessPolicy>;
}



