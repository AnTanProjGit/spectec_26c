import { SystemAdminConfig, SystemRoleId } from '../types';

export const SYSTEM_PAGE_LIST: { id: string; label: string }[] = [
  { id: 'dashboard', label: 'Главный Дашборд (BI)' },
  { id: 'fleet_manager', label: 'Поле Fleet Manager' },
  { id: 'fleet', label: 'Парк спецтехники' },
  { id: 'rentals', label: 'Аренда и Объекты' },
  { id: 'crm', label: 'CRM и Воронка продаж' },
  { id: 'timesheets', label: 'Табели и Смены (З/П)' },
  { id: 'chat', label: 'Операционный чат' },
  { id: 'ai_analyst', label: 'AI-Аналитик и Юрист' },
  { id: 'contracts', label: 'Договора (Юрист)' },
  { id: 'knowledge', label: 'База знаний' },
  { id: 'branches', label: 'Участки и Филиалы' },
  { id: 'admin_panel', label: 'Администрирование' },
  { id: 'integrations_1c', label: '1С Бухгалтерия API' }
];

export const ROLE_ORDER: SystemRoleId[] = [
  'admin',
  'top_manager',
  'fleet_manager',
  'lawyer',
  'accountant',
  'driver'
];

export const defaultSystemAdminConfig: SystemAdminConfig = {
  tables: {
    fleet: {
      label: 'Парк спецтехники',
      density: 'normal',
      pageSize: 20,
      allowExcelExport: true,
      showBranchCode: true,
      availableColumns: [
        'Инв. № и модель',
        'Гос. номер / VIN',
        'Участок',
        'Статус',
        'Текущий объект',
        'Моточасы',
        'Выручка / Маржа',
        'До ТО'
      ],
      visibleColumns: [
        'Инв. № и модель',
        'Гос. номер / VIN',
        'Участок',
        'Статус',
        'Текущий объект',
        'Моточасы',
        'Выручка / Маржа',
        'До ТО'
      ]
    },
    rentals: {
      label: 'Аренда и Объекты (КС-2)',
      density: 'normal',
      pageSize: 20,
      allowExcelExport: true,
      showBranchCode: true,
      availableColumns: [
        'Договор / Заказчик',
        'Техника / Машинист',
        'Объект',
        'План / Факт часов',
        'Сумма заказа',
        'Оплата / Долг',
        'Акт КС-2'
      ],
      visibleColumns: [
        'Договор / Заказчик',
        'Техника / Машинист',
        'Объект',
        'План / Факт часов',
        'Сумма заказа',
        'Оплата / Долг',
        'Акт КС-2'
      ]
    },
    timesheets: {
      label: 'Табели выходов и Смены (ЭСМ-7)',
      density: 'compact',
      pageSize: 25,
      allowExcelExport: true,
      showBranchCode: true,
      availableColumns: [
        'Рапорт / Путевой лист',
        'Машинист (ФИО)',
        'Телефон (MAX)',
        'Привязанная техника',
        'Часы / Перегон / Простой',
        'ГСМ и Корп. карта',
        'З/П машиниста',
        'Статус'
      ],
      visibleColumns: [
        'Рапорт / Путевой лист',
        'Машинист (ФИО)',
        'Телефон (MAX)',
        'Привязанная техника',
        'Часы / Перегон / Простой',
        'ГСМ и Корп. карта',
        'З/П машиниста',
        'Статус'
      ]
    },
    contracts: {
      label: 'Договора и Споры (Юрист)',
      density: 'normal',
      pageSize: 20,
      allowExcelExport: true,
      showBranchCode: true,
      availableColumns: [
        'Номер документа',
        'Вид / Категория',
        'Контрагент',
        'Субъект 1С',
        'Сумма договора / спора',
        'Статус',
        'База знаний'
      ],
      visibleColumns: [
        'Номер документа',
        'Вид / Категория',
        'Контрагент',
        'Субъект 1С',
        'Сумма договора / спора',
        'Статус',
        'База знаний'
      ]
    },
    crm: {
      label: 'CRM и Воронка продаж',
      density: 'normal',
      pageSize: 15,
      allowExcelExport: true,
      showBranchCode: true,
      availableColumns: [
        'Контрагент',
        'Участок / 1С',
        'Техника и Машинист',
        'Объём и Ставка',
        'Сумма сделки',
        'Задолженность'
      ],
      visibleColumns: [
        'Контрагент',
        'Участок / 1С',
        'Техника и Машинист',
        'Объём и Ставка',
        'Сумма сделки',
        'Задолженность'
      ]
    }
  },
  llm: {
    provider: 'gemini_proxy',
    model: 'gemini-4-hydrogen',
    proxyEndpoint: '/api/ai-analyst',
    serverTokenEnvVar: 'GEMINI_API_KEY',
    maxOutputTokens: 4096,
    contextWindowTokens: 128000,
    thinkingTokenBudget: 1024,
    temperature: 0.2,
    topP: 0.9,
    timeoutSec: 30,
    responseFormat: 'json',
    systemInstructionSuffix:
      'Учитывай изоляцию участков, разделение субъектов 1С (ООО «SpecialTech» и ИП «SpecialTechnica») и актуальные нормы ГСМ.'
  },
  knowledgeRag: {
    storageMode: 'local_hybrid',
    vectorEngine: 'faiss_hnsw',
    embeddingModel: 'text-embedding-004',
    chunkSizeTokens: 512,
    chunkOverlapTokens: 64,
    topK: 5,
    minSimilarity: 0.72,
    autoReindexOnSave: true,
    indexedCategories: [
      'regulations',
      'fuel_norms',
      'payroll',
      'maintenance',
      'contracts',
      'templates',
      'disputes'
    ],
    lastIndexedAt: '2026-11-19 09:00'
  },
  telemetrySensors: {
    enabled: true,
    provider: 'wialon_ips',
    protocol: 'wialon_ips_v2',
    endpointUrl: 'https://telematics.specialtech.local/api/v2',
    serverPort: 20332,
    pollIntervalSec: 30,
    serverTokenEnvVar: 'GLONASS_API_TOKEN',
    lastSyncAt: '2026-11-22 08:50',
    sensors: {
      gnssPosition: true,
      fuelLevelDut: true,
      canBusHourMeter: true,
      ignitionAndPto: true,
      axleLoadWeight: true,
      boomTiltAndSafety: true,
      hydraulicAndEngineTemp: true
    },
    fuelDrainThresholdLiters: 15,
    fuelRefuelThresholdLiters: 20,
    hourMeterTolerancePercent: 8,
    geofenceRadiusMeters: 250,
    idleEngineAlertMinutes: 30,
    autoMatchShiftHoursWithCan: true,
    autoFlagFuelAnomaly: true,
    sendAlertsToOperationalChat: true,
    equipmentBindings: {
      'eq-1': {
        trackerImei: '864290041120911',
        dutEnabled: true,
        canEnabled: true,
        status: 'online'
      },
      'eq-2': {
        trackerImei: '864290041120922',
        dutEnabled: true,
        canEnabled: true,
        status: 'online'
      },
      'eq-3': {
        trackerImei: '864290041120933',
        dutEnabled: true,
        canEnabled: false,
        status: 'online'
      },
      'eq-5': {
        trackerImei: '864290041120955',
        dutEnabled: true,
        canEnabled: true,
        status: 'online'
      }
    }
  },
  accessPolicies: {
    admin: {
      role: 'admin',
      label: 'Администратор (Admin)',
      description: 'Полный доступ ко всем блокам, настройкам LLM, базам, ролям и подтверждению смен',
      pages: Object.fromEntries(SYSTEM_PAGE_LIST.map(p => [p.id, 'edit'])),
      fields: {
        canViewFinancialMargin: true,
        canEditPayroll: true,
        canApproveShifts: true,
        canViewDriverMaxPhones: true,
        canEditKnowledgeBase: true,
        canAccessFixedCostsTable: true,
        canAccessVariableCostsTable: true
      }
    },
    top_manager: {
      role: 'top_manager',
      label: 'Топ-менеджер / Директор',
      description: 'Управленческая аналитика по всем участкам, изменение CRM, договоров и утверждение',
      pages: {
        dashboard: 'edit',
        fleet_manager: 'edit',
        fleet: 'edit',
        rentals: 'edit',
        crm: 'edit',
        timesheets: 'edit',
        chat: 'edit',
        ai_analyst: 'edit',
        contracts: 'edit',
        knowledge: 'view',
        branches: 'edit',
        admin_panel: 'view',
        integrations_1c: 'view'
      },
      fields: {
        canViewFinancialMargin: true,
        canEditPayroll: true,
        canApproveShifts: true,
        canViewDriverMaxPhones: true,
        canEditKnowledgeBase: true,
        canAccessFixedCostsTable: true,
        canAccessVariableCostsTable: true
      }
    },
    fleet_manager: {
      role: 'fleet_manager',
      label: 'Fleet Manager (Нач. участка)',
      description: 'Операционное управление участком, CRM, путевые листы, табель и Бот MAX',
      pages: {
        dashboard: 'view',
        fleet_manager: 'edit',
        fleet: 'edit',
        rentals: 'edit',
        crm: 'edit',
        timesheets: 'edit',
        chat: 'edit',
        ai_analyst: 'view',
        contracts: 'view',
        knowledge: 'view',
        branches: 'edit',
        admin_panel: 'hidden',
        integrations_1c: 'hidden'
      },
      fields: {
        canViewFinancialMargin: false,
        canEditPayroll: true,
        canApproveShifts: true,
        canViewDriverMaxPhones: true,
        canEditKnowledgeBase: false,
        canAccessFixedCostsTable: false,
        canAccessVariableCostsTable: true
      }
    },
    lawyer: {
      role: 'lawyer',
      label: 'Юрист (Lawyer)',
      description: 'Реестр договоров, история, шаблоны, споры и публикация в базу знаний',
      pages: {
        dashboard: 'view',
        fleet_manager: 'hidden',
        fleet: 'view',
        rentals: 'view',
        crm: 'view',
        timesheets: 'view',
        chat: 'view',
        ai_analyst: 'edit',
        contracts: 'edit',
        knowledge: 'edit',
        branches: 'view',
        admin_panel: 'hidden',
        integrations_1c: 'hidden'
      },
      fields: {
        canViewFinancialMargin: false,
        canEditPayroll: false,
        canApproveShifts: false,
        canViewDriverMaxPhones: false,
        canEditKnowledgeBase: true,
        canAccessFixedCostsTable: false,
        canAccessVariableCostsTable: false
      }
    },
    accountant: {
      role: 'accountant',
      label: 'Бухгалтер (Accountant)',
      description: 'Просмотр договоров и счетов, закрытие актов, 1С интеграция и экспорт табелей',
      pages: {
        dashboard: 'view',
        fleet_manager: 'hidden',
        fleet: 'view',
        rentals: 'edit',
        crm: 'view',
        timesheets: 'view',
        chat: 'view',
        ai_analyst: 'view',
        contracts: 'view',
        knowledge: 'view',
        branches: 'view',
        admin_panel: 'hidden',
        integrations_1c: 'edit'
      },
      fields: {
        canViewFinancialMargin: true,
        canEditPayroll: false,
        canApproveShifts: false,
        canViewDriverMaxPhones: false,
        canEditKnowledgeBase: false,
        canAccessFixedCostsTable: true,
        canAccessVariableCostsTable: true
      }
    },
    driver: {
      role: 'driver',
      label: 'Машинист / Водитель',
      description: 'Регистрация смены (ЭСМ-7), корпоративный чат и просмотр своего табеля',
      pages: {
        dashboard: 'hidden',
        fleet_manager: 'hidden',
        fleet: 'hidden',
        rentals: 'hidden',
        crm: 'hidden',
        timesheets: 'view',
        chat: 'edit',
        ai_analyst: 'hidden',
        contracts: 'hidden',
        knowledge: 'view',
        branches: 'hidden',
        admin_panel: 'hidden',
        integrations_1c: 'hidden'
      },
      fields: {
        canViewFinancialMargin: false,
        canEditPayroll: false,
        canApproveShifts: false,
        canViewDriverMaxPhones: true,
        canEditKnowledgeBase: false,
        canAccessFixedCostsTable: false,
        canAccessVariableCostsTable: false
      }
    }
  }
};

export function mergeAdminConfig(
  raw: Partial<SystemAdminConfig> | null | undefined
): SystemAdminConfig {
  if (!raw) return defaultSystemAdminConfig;

  const mergedAccessPolicies = { ...defaultSystemAdminConfig.accessPolicies };
  ROLE_ORDER.forEach(roleId => {
    const defRole = defaultSystemAdminConfig.accessPolicies[roleId];
    const rawRole = raw.accessPolicies?.[roleId];
    mergedAccessPolicies[roleId] = {
      ...defRole,
      ...(rawRole || {}),
      pages: {
        ...defRole.pages,
        ...(rawRole?.pages || {})
      },
      fields: {
        ...defRole.fields,
        ...(rawRole?.fields || {})
      }
    };
  });

  return {
    tables: {
      ...defaultSystemAdminConfig.tables,
      ...(raw.tables || {})
    },
    llm: {
      ...defaultSystemAdminConfig.llm,
      ...(raw.llm || {})
    },
    knowledgeRag: {
      ...defaultSystemAdminConfig.knowledgeRag,
      ...(raw.knowledgeRag || {})
    },
    telemetrySensors: {
      ...defaultSystemAdminConfig.telemetrySensors,
      ...(raw.telemetrySensors || {}),
      sensors: {
        ...defaultSystemAdminConfig.telemetrySensors.sensors,
        ...(raw.telemetrySensors?.sensors || {})
      },
      equipmentBindings: {
        ...defaultSystemAdminConfig.telemetrySensors.equipmentBindings,
        ...(raw.telemetrySensors?.equipmentBindings || {})
      }
    },
    accessPolicies: mergedAccessPolicies
  };
}
