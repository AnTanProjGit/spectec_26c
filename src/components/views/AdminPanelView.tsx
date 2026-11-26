import React, { useState } from 'react';
import {
  ShieldCheck,
  Table2,
  Cpu,
  Database,
  CheckCircle2,
  RotateCcw,
  Save,
  Sparkles,
  RefreshCw,
  Wallet,
  Satellite,
  Gauge
} from 'lucide-react';
import {
  Equipment,
  FleetBranch,
  KnowledgeDoc,
  PageAccessLevel,
  SystemAdminConfig,
  SystemRoleId,
  TableViewId,
  TelemetryEquipmentBinding
} from '../../types';
import {
  defaultSystemAdminConfig,
  ROLE_ORDER,
  SYSTEM_PAGE_LIST
} from '../../utils/adminConfig';
import { AdminCostTablesSection } from './AdminCostTablesSection';

interface AdminPanelViewProps {
  config: SystemAdminConfig;
  knowledgeDocsCount: number;
  branches: FleetBranch[];
  equipmentList: Equipment[];
  onSaveConfig: (next: SystemAdminConfig) => void;
  onSaveBranch: (branch: FleetBranch) => void;
  onUpdateEquipmentList: (nextList: Equipment[]) => void;
  onOpenKnowledgeBase: () => void;
}

type AdminBlockTab = 'tables' | 'cost_tables' | 'llm' | 'knowledge_rag' | 'telemetry_sensors' | 'roles';

const CATEGORY_LABELS: Record<KnowledgeDoc['category'], string> = {
  fuel_norms: 'Нормы ГСМ',
  regulations: 'Регламенты аренды',
  payroll: 'Оплата труда',
  maintenance: 'Техобслуживание',
  contracts: 'Договора',
  templates: 'Шаблоны договоров',
  disputes: 'Споры'
};

export const AdminPanelView: React.FC<AdminPanelViewProps> = ({
  config,
  knowledgeDocsCount,
  branches,
  equipmentList,
  onSaveConfig,
  onSaveBranch,
  onUpdateEquipmentList,
  onOpenKnowledgeBase
}) => {
  const [activeBlock, setActiveBlock] = useState<AdminBlockTab>('tables');
  const [selectedTableId, setSelectedTableId] = useState<TableViewId>('fleet');
  const [selectedRoleId, setSelectedRoleId] = useState<SystemRoleId>('fleet_manager');
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const [llmTestStatus, setLlmTestStatus] = useState<{
    loading: boolean;
    message?: string;
    ok?: boolean;
  }>({ loading: false });
  const [telemetryTestStatus, setTelemetryTestStatus] = useState<{
    loading: boolean;
    message?: string;
    ok?: boolean;
  }>({ loading: false });

  const notify = (msg: string) => {
    setSavedNotice(msg);
    setTimeout(() => setSavedNotice(null), 3000);
  };

  const activeTable = config.tables[selectedTableId];
  const activeRolePolicy = config.accessPolicies[selectedRoleId];

  const handleToggleTableColumn = (col: string) => {
    const exists = activeTable.visibleColumns.includes(col);
    const nextCols = exists
      ? activeTable.visibleColumns.filter(c => c !== col)
      : [...activeTable.visibleColumns, col];

    onSaveConfig({
      ...config,
      tables: {
        ...config.tables,
        [selectedTableId]: {
          ...activeTable,
          visibleColumns: nextCols.length > 0 ? nextCols : [col]
        }
      }
    });
  };

  const handleUpdateTableSettings = (
    patch: Partial<SystemAdminConfig['tables'][TableViewId]>
  ) => {
    onSaveConfig({
      ...config,
      tables: {
        ...config.tables,
        [selectedTableId]: {
          ...activeTable,
          ...patch
        }
      }
    });
  };

  const handleUpdateLlm = (patch: Partial<SystemAdminConfig['llm']>) => {
    onSaveConfig({
      ...config,
      llm: {
        ...config.llm,
        ...patch
      }
    });
  };

  const handleUpdateRag = (patch: Partial<SystemAdminConfig['knowledgeRag']>) => {
    onSaveConfig({
      ...config,
      knowledgeRag: {
        ...config.knowledgeRag,
        ...patch
      }
    });
  };

  const handleToggleRagCategory = (cat: KnowledgeDoc['category']) => {
    const exists = config.knowledgeRag.indexedCategories.includes(cat);
    const nextCats = exists
      ? config.knowledgeRag.indexedCategories.filter(c => c !== cat)
      : [...config.knowledgeRag.indexedCategories, cat];
    handleUpdateRag({ indexedCategories: nextCats });
  };

  const handleReindexRag = () => {
    const now = new Date();
    const stamp = `${now.toISOString().split('T')[0]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    handleUpdateRag({ lastIndexedAt: stamp });
    notify(`Векторный индекс (${knowledgeDocsCount} док.) пересобран.`);
  };

  const handleSetRolePageAccess = (pageId: string, level: PageAccessLevel) => {
    onSaveConfig({
      ...config,
      accessPolicies: {
        ...config.accessPolicies,
        [selectedRoleId]: {
          ...activeRolePolicy,
          pages: {
            ...activeRolePolicy.pages,
            [pageId]: level
          }
        }
      }
    });
  };

  const handleToggleRoleFieldAccess = (
    fieldKey: keyof SystemAdminConfig['accessPolicies'][SystemRoleId]['fields']
  ) => {
    onSaveConfig({
      ...config,
      accessPolicies: {
        ...config.accessPolicies,
        [selectedRoleId]: {
          ...activeRolePolicy,
          fields: {
            ...activeRolePolicy.fields,
            [fieldKey]: !activeRolePolicy.fields[fieldKey]
          }
        }
      }
    });
  };

  const handleUpdateTelemetry = (
    patch: Partial<SystemAdminConfig['telemetrySensors']>
  ) => {
    onSaveConfig({
      ...config,
      telemetrySensors: {
        ...config.telemetrySensors,
        ...patch
      }
    });
  };

  const handleToggleTelemetrySensor = (
    sensorKey: keyof SystemAdminConfig['telemetrySensors']['sensors']
  ) => {
    handleUpdateTelemetry({
      sensors: {
        ...config.telemetrySensors.sensors,
        [sensorKey]: !config.telemetrySensors.sensors[sensorKey]
      }
    });
  };

  const handleUpdateEquipmentBinding = (
    eqId: string,
    patch: Partial<TelemetryEquipmentBinding>
  ) => {
    const existing = config.telemetrySensors.equipmentBindings[eqId] || {
      trackerImei: '',
      dutEnabled: true,
      canEnabled: true,
      status: 'online' as const
    };
    handleUpdateTelemetry({
      equipmentBindings: {
        ...config.telemetrySensors.equipmentBindings,
        [eqId]: {
          ...existing,
          ...patch
        }
      }
    });
  };

  const handleTestTelemetryConnection = async () => {
    setTelemetryTestStatus({ loading: true });
    try {
      const res = await fetch('/api/telemetry/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: config.telemetrySensors.provider,
          protocol: config.telemetrySensors.protocol,
          endpointUrl: config.telemetrySensors.endpointUrl,
          serverPort: config.telemetrySensors.serverPort,
          pollIntervalSec: config.telemetrySensors.pollIntervalSec
        })
      });
      const json = await res.json();
      if (res.ok && json.connected) {
        handleUpdateTelemetry({ lastSyncAt: json.checkedAt });
        setTelemetryTestStatus({
          loading: false,
          ok: true,
          message: json.message
        });
      } else {
        setTelemetryTestStatus({
          loading: false,
          ok: false,
          message: json.message || 'Ошибка проверки шлюза ГЛОНАСС.'
        });
      }
    } catch {
      setTelemetryTestStatus({
        loading: false,
        ok: false,
        message: 'Не удалось связаться с эндпоинтом проверки телематики ГЛОНАСС.'
      });
    }
  };

  const handleTestLlmConnection = async () => {
    setLlmTestStatus({ loading: true });
    try {
      const res = await fetch(config.llm.proxyEndpoint || '/api/ai-analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: 'Проверка соединения из панели администратора',
          agentType: 'executive',
          llmConfig: {
            model: config.llm.model,
            maxOutputTokens: config.llm.maxOutputTokens,
            temperature: config.llm.temperature,
            topP: config.llm.topP,
            systemInstructionSuffix: config.llm.systemInstructionSuffix
          }
        })
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setLlmTestStatus({
          loading: false,
          ok: true,
          message: `Шлюз ответил (${json.source || config.llm.model}). Лимит вывода: ${config.llm.maxOutputTokens} ток.`
        });
      } else {
        setLlmTestStatus({
          loading: false,
          ok: false,
          message: 'Серверный шлюз вернул ошибку конфигурации.'
        });
      }
    } catch {
      setLlmTestStatus({
        loading: false,
        ok: false,
        message: 'Не удалось связаться с прокси-эндпоинтом LLM.'
      });
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-[1440px] mx-auto">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400 mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Администрирование платформы</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Панель администратора: настройки системных блоков
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Таблицы для просмотра, подключения LLM и токены, база данных / База знаний (RAG), ГЛОНАСС и датчики техники, права страниц и полей по ролям
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveBlock('cost_tables')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border text-xs font-bold transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeBlock === 'cost_tables'
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>Доступ к таблицам постоянных и переменных затрат</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSaveConfig(defaultSystemAdminConfig);
                notify('Настройки блоков сброшены к базовым.');
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Сбросить</span>
            </button>

            <button
              type="button"
              onClick={() => notify('Конфигурация блоков сохранена.')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Сохранить настройки</span>
            </button>
          </div>
        </div>

        {savedNotice && (
          <div className="px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-medium inline-flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedNotice}</span>
          </div>
        )}
      </div>

      {/* Block Selector Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
        {[
          { id: 'tables' as const, label: 'Таблицы для просмотра', icon: Table2 },
          {
            id: 'cost_tables' as const,
            label: 'Таблицы затрат (Офис и ИТР, АХЧ, лизинг, налоги, переменные)',
            icon: Wallet
          },
          { id: 'llm' as const, label: 'Подключения LLM, модели и токены', icon: Cpu },
          { id: 'knowledge_rag' as const, label: 'База данных, База знаний и RAG', icon: Database },
          { id: 'telemetry_sensors' as const, label: 'ГЛОНАСС и датчики техники', icon: Satellite },
          { id: 'roles' as const, label: 'Страницы и поля: Роли и доступы', icon: ShieldCheck }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeBlock === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveBlock(tab.id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* BLOCK 1B: Fixed & Variable Cost Tables + Role Access */}
      {activeBlock === 'cost_tables' && (
        <AdminCostTablesSection
          branches={branches}
          equipmentList={equipmentList}
          config={config}
          onSaveBranch={onSaveBranch}
          onUpdateEquipmentList={onUpdateEquipmentList}
          onSaveConfig={onSaveConfig}
          onNotify={notify}
        />
      )}

      {/* BLOCK 1: Tables View Configuration */}
      {activeBlock === 'tables' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-white pb-2 border-b border-slate-800">
              Таблицы системы
            </h2>
            <div className="space-y-1.5">
              {(Object.keys(config.tables) as TableViewId[]).map(tableId => {
                const t = config.tables[tableId];
                const isSelected = selectedTableId === tableId;
                return (
                  <button
                    key={tableId}
                    type="button"
                    onClick={() => setSelectedTableId(tableId)}
                    className={`w-full text-left p-3 rounded-lg border transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{t.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-mono tabular-nums">
                      Столбцов: {t.visibleColumns.length} / {t.availableColumns.length} · По {t.pageSize} строк
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Параметры таблицы: {activeTable.label}
                </h2>
                <p className="text-slate-400 mt-0.5">
                  Настройка видимых столбцов, плотности строк и параметров выгрузки
                </p>
              </div>
              <span className="font-mono text-amber-300 tabular-nums">
                {activeTable.visibleColumns.length} из {activeTable.availableColumns.length} столбцов
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Плотность строк</label>
                <select
                  value={activeTable.density}
                  onChange={(e) =>
                    handleUpdateTableSettings({
                      density: e.target.value as SystemAdminConfig['tables'][TableViewId]['density']
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="compact">Компактная (макс. плотность)</option>
                  <option value="normal">Стандартная</option>
                  <option value="comfortable">Свободная</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Строк на странице</label>
                <select
                  value={activeTable.pageSize}
                  onChange={(e) =>
                    handleUpdateTableSettings({ pageSize: parseInt(e.target.value, 10) || 20 })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                >
                  <option value={15}>15 строк</option>
                  <option value={20}>20 строк</option>
                  <option value={25}>25 строк</option>
                  <option value={50}>50 строк</option>
                  <option value={100}>100 строк</option>
                </select>
              </div>

              <div className="flex flex-col justify-end gap-2">
                <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeTable.allowExcelExport}
                    onChange={(e) =>
                      handleUpdateTableSettings({ allowExcelExport: e.target.checked })
                    }
                    className="rounded border-slate-600 bg-slate-800 text-amber-500"
                  />
                  <span>Разрешить экспорт в .xlsx</span>
                </label>

                <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeTable.showBranchCode}
                    onChange={(e) =>
                      handleUpdateTableSettings({ showBranchCode: e.target.checked })
                    }
                    className="rounded border-slate-600 bg-slate-800 text-amber-500"
                  />
                  <span>Показывать код участка</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <div className="font-semibold text-slate-200">Видимые столбцы таблицы</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeTable.availableColumns.map(col => {
                  const checked = activeTable.visibleColumns.includes(col);
                  return (
                    <label
                      key={col}
                      className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer transition ${
                        checked
                          ? 'bg-slate-950 border-amber-500/40 text-white'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400'
                      }`}
                    >
                      <span>{col}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleTableColumn(col)}
                        className="rounded border-slate-600 bg-slate-800 text-amber-500"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK 2: LLM Connections, Model Selection, Token Limits & Generation Settings */}
      {activeBlock === 'llm' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start text-xs">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Подключение к LLM и выбор модели
                </h2>
                <p className="text-slate-400 mt-0.5">
                  Серверная маршрутизация запросов через защищённый backend-прокси без хранения секретов в браузере
                </p>
              </div>

              <button
                type="button"
                disabled={llmTestStatus.loading}
                onClick={handleTestLlmConnection}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-semibold transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{llmTestStatus.loading ? 'Проверка...' : 'Проверить LLM-шлюз'}</span>
              </button>
            </div>

            {llmTestStatus.message && (
              <div
                className={`p-2.5 rounded-lg border ${
                  llmTestStatus.ok
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                }`}
              >
                {llmTestStatus.message}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Провайдер / Шлюз LLM</label>
                <select
                  value={config.llm.provider}
                  onChange={(e) =>
                    handleUpdateLlm({
                      provider: e.target.value as SystemAdminConfig['llm']['provider']
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="gemini_proxy">Google Gemini (Server Proxy)</option>
                  <option value="openai_compatible">OpenAI-совместимый корпоративный шлюз</option>
                  <option value="local_vllm">Локальный контур (vLLM / Ollama)</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Активная модель</label>
                <select
                  value={config.llm.model}
                  onChange={(e) => handleUpdateLlm({ model: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value="gemini-4-hydrogen">gemini-4-hydrogen (Основная ERP/Юрист)</option>
                  <option value="gemini-2.5-pro">gemini-2.5-pro (Сложный аудит)</option>
                  <option value="gemini-2.5-flash">gemini-2.5-flash (Быстрый отклик)</option>
                  <option value="llama-3.3-70b-instruct">llama-3.3-70b-instruct (On-Premise)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Серверный прокси-маршрут</label>
                <input
                  type="text"
                  value={config.llm.proxyEndpoint}
                  onChange={(e) => handleUpdateLlm({ proxyEndpoint: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Имя env-переменной ключа на сервере (.env)
                </label>
                <input
                  type="text"
                  value={config.llm.serverTokenEnvVar}
                  onChange={(e) => handleUpdateLlm({ serverTokenEnvVar: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Системная инструкция для агентов (добавляется к промпту)
              </label>
              <textarea
                rows={3}
                value={config.llm.systemInstructionSuffix}
                onChange={(e) => handleUpdateLlm({ systemInstructionSuffix: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-slate-100 leading-relaxed focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h2 className="text-sm font-bold text-white pb-2 border-b border-slate-800">
              Лимиты токенов и параметры генерации
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Токены ответа (max)</label>
                <input
                  type="number"
                  min={256}
                  max={65536}
                  step={256}
                  value={config.llm.maxOutputTokens}
                  onChange={(e) =>
                    handleUpdateLlm({
                      maxOutputTokens: Math.max(256, parseInt(e.target.value, 10) || 2048)
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Контекст (токенов)</label>
                <input
                  type="number"
                  min={4096}
                  max={1048576}
                  step={4096}
                  value={config.llm.contextWindowTokens}
                  onChange={(e) =>
                    handleUpdateLlm({
                      contextWindowTokens: Math.max(4096, parseInt(e.target.value, 10) || 32768)
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Бюджет рассуждений</label>
                <input
                  type="number"
                  min={0}
                  max={32768}
                  step={256}
                  value={config.llm.thinkingTokenBudget}
                  onChange={(e) =>
                    handleUpdateLlm({
                      thinkingTokenBudget: Math.max(0, parseInt(e.target.value, 10) || 0)
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Temperature ({config.llm.temperature.toFixed(2)})
                </label>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={config.llm.temperature}
                  onChange={(e) => handleUpdateLlm({ temperature: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">
                  Top-P ({config.llm.topP.toFixed(2)})
                </label>
                <input
                  type="range"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={config.llm.topP}
                  onChange={(e) => handleUpdateLlm({ topP: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Формат вывода</label>
                <select
                  value={config.llm.responseFormat}
                  onChange={(e) =>
                    handleUpdateLlm({
                      responseFormat: e.target.value as SystemAdminConfig['llm']['responseFormat']
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="json">Строгий JSON</option>
                  <option value="text">Текст / Markdown</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Таймаут запроса (сек)</label>
                <input
                  type="number"
                  min={5}
                  max={180}
                  value={config.llm.timeoutSec}
                  onChange={(e) =>
                    handleUpdateLlm({
                      timeoutSec: Math.max(5, parseInt(e.target.value, 10) || 30)
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK 3: Database, Knowledge Base & RAG Settings */}
      {activeBlock === 'knowledge_rag' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start text-xs">
          <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Настройки базы данных и векторного индекса RAG
                </h2>
                <p className="text-slate-400 mt-0.5">
                  Хранилище документов, параметры разбиения на фрагменты (chunks) и семантический поиск
                </p>
              </div>

              <button
                type="button"
                onClick={handleReindexRag}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Переиндексировать ({knowledgeDocsCount} док.)</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Контур хранения базы</label>
                <select
                  value={config.knowledgeRag.storageMode}
                  onChange={(e) =>
                    handleUpdateRag({
                      storageMode: e.target.value as SystemAdminConfig['knowledgeRag']['storageMode']
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="local_hybrid">Локальная БД + API Proxy</option>
                  <option value="postgres_pgvector">PostgreSQL + pgvector</option>
                  <option value="onec_sync">1С Предприятие OData</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Векторный движок RAG</label>
                <select
                  value={config.knowledgeRag.vectorEngine}
                  onChange={(e) =>
                    handleUpdateRag({
                      vectorEngine: e.target.value as SystemAdminConfig['knowledgeRag']['vectorEngine']
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value="faiss_hnsw">FAISS IndexHNSW</option>
                  <option value="faiss_flat">FAISS IndexFlatIP</option>
                  <option value="pgvector">PostgreSQL pgvector</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Модель эмбеддингов</label>
                <select
                  value={config.knowledgeRag.embeddingModel}
                  onChange={(e) => handleUpdateRag({ embeddingModel: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value="text-embedding-004">text-embedding-004</option>
                  <option value="bge-m3-ru">bge-m3-ru (Мультиязычная)</option>
                  <option value="multilingual-e5-large">multilingual-e5-large</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Размер чанка (ток.)</label>
                <input
                  type="number"
                  min={128}
                  max={2048}
                  step={64}
                  value={config.knowledgeRag.chunkSizeTokens}
                  onChange={(e) =>
                    handleUpdateRag({
                      chunkSizeTokens: Math.max(128, parseInt(e.target.value, 10) || 512)
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Перекрытие (overlap)</label>
                <input
                  type="number"
                  min={0}
                  max={512}
                  step={16}
                  value={config.knowledgeRag.chunkOverlapTokens}
                  onChange={(e) =>
                    handleUpdateRag({
                      chunkOverlapTokens: Math.max(0, parseInt(e.target.value, 10) || 0)
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Top-K фрагментов</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={config.knowledgeRag.topK}
                  onChange={(e) =>
                    handleUpdateRag({ topK: Math.max(1, parseInt(e.target.value, 10) || 5) })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Порог сходства</label>
                <input
                  type="number"
                  min={0.1}
                  max={0.99}
                  step={0.02}
                  value={config.knowledgeRag.minSimilarity}
                  onChange={(e) =>
                    handleUpdateRag({
                      minSimilarity: Math.min(0.99, Math.max(0.1, parseFloat(e.target.value) || 0.7))
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.knowledgeRag.autoReindexOnSave}
                  onChange={(e) => handleUpdateRag({ autoReindexOnSave: e.target.checked })}
                  className="rounded border-slate-600 bg-slate-800 text-amber-500"
                />
                <span>Автоматически обновлять векторный индекс при сохранении договора / регламента</span>
              </label>

              <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                Последняя индексация: {config.knowledgeRag.lastIndexedAt}
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">
                Разделы «Базы знаний» в RAG-индексе
              </h2>
              <button
                type="button"
                onClick={onOpenKnowledgeBase}
                className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
              >
                Открыть базу документов →
              </button>
            </div>

            <div className="space-y-2">
              {(Object.keys(CATEGORY_LABELS) as KnowledgeDoc['category'][]).map(cat => {
                const checked = config.knowledgeRag.indexedCategories.includes(cat);
                return (
                  <label
                    key={cat}
                    className={`flex items-center justify-between p-2.5 rounded-lg border cursor-pointer ${
                      checked
                        ? 'bg-slate-950 border-emerald-500/40 text-white'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400'
                    }`}
                  >
                    <span>{CATEGORY_LABELS[cat]}</span>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleRagCategory(cat)}
                      className="rounded border-slate-600 bg-slate-800 text-amber-500"
                    />
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* BLOCK 3B: GLONASS & Telemetry Sensors Settings */}
      {activeBlock === 'telemetry_sensors' && (
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left column: GLONASS gateway + thresholds */}
            <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Satellite className="w-4 h-4 text-amber-400" />
                    <span>Шлюз ГЛОНАСС / GPS и протокол телематики</span>
                  </h2>
                  <p className="text-slate-400 mt-0.5">
                    Интеграция бортовых терминалов ГЛОНАСС, датчиков уровня топлива (ДУТ), CAN-шины и контроля геозон
                  </p>
                </div>

                <button
                  type="button"
                  disabled={telemetryTestStatus.loading}
                  onClick={handleTestTelemetryConnection}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-semibold transition cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${telemetryTestStatus.loading ? 'animate-spin' : ''}`} />
                  <span>{telemetryTestStatus.loading ? 'Проверка...' : 'Проверить сервер ГЛОНАСС'}</span>
                </button>
              </div>

              {telemetryTestStatus.message && (
                <div
                  className={`p-2.5 rounded-lg border ${
                    telemetryTestStatus.ok
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-rose-500/15 border-rose-500/40 text-rose-300'
                  }`}
                >
                  {telemetryTestStatus.message}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                <label className="inline-flex items-center gap-2 text-slate-100 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.telemetrySensors.enabled}
                    onChange={(e) => handleUpdateTelemetry({ enabled: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500"
                  />
                  <span>Включить приём данных ГЛОНАСС и бортовых датчиков</span>
                </label>
                <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                  Синхронизация: {config.telemetrySensors.lastSyncAt || '—'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Платформа / Сервер ГЛОНАСС</label>
                  <select
                    value={config.telemetrySensors.provider}
                    onChange={(e) =>
                      handleUpdateTelemetry({
                        provider: e.target.value as SystemAdminConfig['telemetrySensors']['provider']
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="wialon_ips">Wialon Hosting / Wialon IPS</option>
                    <option value="omnicomm">Omnicomm Online (ДУТ + ГЛОНАСС)</option>
                    <option value="galileosky">Galileosky / Навтелеком</option>
                    <option value="scout_api">СКАУТ-Платформа (API)</option>
                    <option value="egts_ru">ЕГТС (ЭРА-ГЛОНАСС / РНИС)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Протокол обмена</label>
                  <select
                    value={config.telemetrySensors.protocol}
                    onChange={(e) =>
                      handleUpdateTelemetry({
                        protocol: e.target.value as SystemAdminConfig['telemetrySensors']['protocol']
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  >
                    <option value="wialon_ips_v2">Wialon IPS v2.0 (TCP/REST)</option>
                    <option value="egts">ЕГТС (Приказ Минтранса № 285)</option>
                    <option value="rest_json">REST JSON Webhook / Polling</option>
                    <option value="mqtt_telemetry">MQTT Telemetry Broker</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-300 mb-1">URL сервера / API телематики</label>
                  <input
                    type="text"
                    value={config.telemetrySensors.endpointUrl}
                    onChange={(e) => handleUpdateTelemetry({ endpointUrl: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">TCP/UDP порт</label>
                  <input
                    type="number"
                    min={1}
                    max={65535}
                    value={config.telemetrySensors.serverPort}
                    onChange={(e) =>
                      handleUpdateTelemetry({
                        serverPort: Math.max(1, parseInt(e.target.value, 10) || 20332)
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Интервал опроса телематики (сек)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={600}
                    step={5}
                    value={config.telemetrySensors.pollIntervalSec}
                    onChange={(e) =>
                      handleUpdateTelemetry({
                        pollIntervalSec: Math.max(5, parseInt(e.target.value, 10) || 30)
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    Env-переменная токена ГЛОНАСС на сервере
                  </label>
                  <input
                    type="text"
                    value={config.telemetrySensors.serverTokenEnvVar}
                    onChange={(e) => handleUpdateTelemetry({ serverTokenEnvVar: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Thresholds */}
              <div className="pt-2 border-t border-slate-800 space-y-2.5">
                <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                  <Gauge className="w-3.5 h-3.5 text-amber-400" />
                  <span>Пороги контроля ГСМ, наработки и геозон</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Слив ГСМ (л)</label>
                    <input
                      type="number"
                      min={1}
                      max={500}
                      value={config.telemetrySensors.fuelDrainThresholdLiters}
                      onChange={(e) =>
                        handleUpdateTelemetry({
                          fuelDrainThresholdLiters: Math.max(1, parseInt(e.target.value, 10) || 15)
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Заправка ДУТ (л)</label>
                    <input
                      type="number"
                      min={1}
                      max={1000}
                      value={config.telemetrySensors.fuelRefuelThresholdLiters}
                      onChange={(e) =>
                        handleUpdateTelemetry({
                          fuelRefuelThresholdLiters: Math.max(1, parseInt(e.target.value, 10) || 20)
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Допуск м/ч (%)</label>
                    <input
                      type="number"
                      min={1}
                      max={50}
                      value={config.telemetrySensors.hourMeterTolerancePercent}
                      onChange={(e) =>
                        handleUpdateTelemetry({
                          hourMeterTolerancePercent: Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 8))
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Геозона (м)</label>
                    <input
                      type="number"
                      min={50}
                      max={5000}
                      step={50}
                      value={config.telemetrySensors.geofenceRadiusMeters}
                      onChange={(e) =>
                        handleUpdateTelemetry({
                          geofenceRadiusMeters: Math.max(50, parseInt(e.target.value, 10) || 250)
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Холостой ход (мин)</label>
                    <input
                      type="number"
                      min={5}
                      max={240}
                      step={5}
                      value={config.telemetrySensors.idleEngineAlertMinutes}
                      onChange={(e) =>
                        handleUpdateTelemetry({
                          idleEngineAlertMinutes: Math.max(5, parseInt(e.target.value, 10) || 30)
                        })
                      }
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="space-y-1.5 pt-1">
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.telemetrySensors.autoMatchShiftHoursWithCan}
                      onChange={(e) =>
                        handleUpdateTelemetry({ autoMatchShiftHoursWithCan: e.target.checked })
                      }
                      className="rounded border-slate-600 bg-slate-800 text-amber-500"
                    />
                    <span>Сверять часы смен (ЭСМ-7) с данными CAN-шины и датчика зажигания</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.telemetrySensors.autoFlagFuelAnomaly}
                      onChange={(e) =>
                        handleUpdateTelemetry({ autoFlagFuelAnomaly: e.target.checked })
                      }
                      className="rounded border-slate-600 bg-slate-800 text-amber-500"
                    />
                    <span>Фиксировать аномалии ГСМ (ДУТ) в аудите смен для разбора с водителем</span>
                  </label>
                  <label className="flex items-center gap-2 text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.telemetrySensors.sendAlertsToOperationalChat}
                      onChange={(e) =>
                        handleUpdateTelemetry({ sendAlertsToOperationalChat: e.target.checked })
                      }
                      className="rounded border-slate-600 bg-slate-800 text-amber-500"
                    />
                    <span>Отправлять уведомления датчиков и геозон в «Операционный чат»</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Right column: Connected Sensor Channels */}
            <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="pb-2 border-b border-slate-800">
                <h2 className="text-sm font-bold text-white">
                  Активные каналы и датчики техники
                </h2>
                <p className="text-slate-400 mt-0.5">
                  Выбор телеметрических параметров, принимаемых с бортового оборудования
                </p>
              </div>

              <div className="space-y-2">
                {[
                  {
                    key: 'gnssPosition' as const,
                    title: 'ГЛОНАСС / GPS позиционирование',
                    desc: 'Координаты, треки, скорость, контроль границ стройплощадки'
                  },
                  {
                    key: 'fuelLevelDut' as const,
                    title: 'ДУТ (RS-485 / Omnicomm LLS)',
                    desc: 'Уровень топлива в баке, заправки и резкие сливы'
                  },
                  {
                    key: 'canBusHourMeter' as const,
                    title: 'CAN-шина (SAE J1939 / FMS)',
                    desc: 'Моточасы ДВС, обороты, мгновенный расход и нагрузка'
                  },
                  {
                    key: 'ignitionAndPto' as const,
                    title: 'Датчик зажигания и КОМ / навесного',
                    desc: 'Разделение чистого времени работы под нагрузкой и холостого хода'
                  },
                  {
                    key: 'axleLoadWeight' as const,
                    title: 'Датчики нагрузки на ось / веса груза',
                    desc: 'Контроль загрузки и учёт ходок для самосвалов'
                  },
                  {
                    key: 'boomTiltAndSafety' as const,
                    title: 'ОНК / ОГМ (крен, вылет стрелы, перегруз)',
                    desc: 'Телеметрия безопасности автокранов и автовышек'
                  },
                  {
                    key: 'hydraulicAndEngineTemp' as const,
                    title: 'Температура ДВС и давление гидросистемы',
                    desc: 'Предупреждение перегрева, потери давления и внепланового ремонта'
                  }
                ].map(item => {
                  const active = config.telemetrySensors.sensors[item.key];
                  return (
                    <label
                      key={item.key}
                      className={`flex items-start justify-between gap-3 p-2.5 rounded-lg border cursor-pointer transition ${
                        active
                          ? 'bg-slate-950 border-emerald-500/40 text-white'
                          : 'bg-slate-950/50 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-[12px]">{item.title}</div>
                        <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
                          {item.desc}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => handleToggleTelemetrySensor(item.key)}
                        className="mt-0.5 rounded border-slate-600 bg-slate-800 text-amber-500 shrink-0"
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Per-unit Tracker / Sensor Bindings Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Привязка трекеров ГЛОНАСС и датчиков к парку техники
                </h2>
                <p className="text-slate-400 mt-0.5">
                  IMEI терминалов, статус связи и активность датчиков ДУТ / CAN для каждой единицы
                </p>
              </div>
              <span className="font-mono text-amber-300 tabular-nums">
                Единиц в парке: {equipmentList.length}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 px-3 font-medium">Техника / Гос. №</th>
                    <th className="py-2 px-3 font-medium">IMEI / ID терминала ГЛОНАСС</th>
                    <th className="py-2 px-3 font-medium text-center">ДУТ (RS-485)</th>
                    <th className="py-2 px-3 font-medium text-center">CAN (J1939)</th>
                    <th className="py-2 px-3 font-medium text-right">Статус канала</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
                  {equipmentList.map(eq => {
                    const binding = config.telemetrySensors.equipmentBindings[eq.id] || {
                      trackerImei: '',
                      dutEnabled: true,
                      canEnabled: true,
                      status: 'online' as const
                    };
                    return (
                      <tr key={eq.id} className="hover:bg-slate-900/50">
                        <td className="py-2 px-3">
                          <div className="font-semibold text-white">
                            [{eq.inventoryNumber}] {eq.name}
                          </div>
                          <div className="text-[11px] font-mono text-slate-400">
                            {eq.plateNumber}
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={binding.trackerImei}
                            placeholder="Напр.: 864290041120900"
                            onChange={(e) =>
                              handleUpdateEquipmentBinding(eq.id, { trackerImei: e.target.value })
                            }
                            className="w-48 bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-100 font-mono text-[11px] focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={binding.dutEnabled}
                            onChange={(e) =>
                              handleUpdateEquipmentBinding(eq.id, { dutEnabled: e.target.checked })
                            }
                            className="rounded border-slate-600 bg-slate-800 text-amber-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={binding.canEnabled}
                            onChange={(e) =>
                              handleUpdateEquipmentBinding(eq.id, { canEnabled: e.target.checked })
                            }
                            className="rounded border-slate-600 bg-slate-800 text-amber-500 cursor-pointer"
                          />
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateEquipmentBinding(eq.id, {
                                status: binding.status === 'online' ? 'offline' : 'online'
                              })
                            }
                            className={`px-2 py-0.5 rounded border font-mono text-[10px] font-bold cursor-pointer transition ${
                              binding.status === 'online'
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                                : 'bg-slate-800 text-slate-400 border-slate-700'
                            }`}
                          >
                            {binding.status === 'online' ? 'Онлайн' : 'Отключён'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* BLOCK 4: Pages & Fields - Roles & Permissions */}
      {activeBlock === 'roles' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start text-xs">
          {/* Role selector */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
            <h2 className="text-sm font-bold text-white pb-2 border-b border-slate-800">
              Роли пользователей
            </h2>
            <div className="space-y-1.5">
              {ROLE_ORDER.map(roleId => {
                const role = config.accessPolicies[roleId];
                const isSelected = selectedRoleId === roleId;
                return (
                  <button
                    key={roleId}
                    type="button"
                    onClick={() => setSelectedRoleId(roleId)}
                    className={`w-full text-left p-3 rounded-lg border transition cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/15 border-amber-500/50 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="font-bold">{role.label}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {role.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pages & Sensitive Fields for selected Role */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Права доступа к страницам и полям: {activeRolePolicy.label}
                </h2>
                <p className="text-slate-400 mt-0.5">{activeRolePolicy.description}</p>
              </div>
            </div>

            {/* Field-level access toggles */}
            <div className="space-y-2">
              <div className="font-semibold text-slate-200">Доступ к полям и операциям</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  {
                    key: 'canViewFinancialMargin' as const,
                    label: 'Финансовая маржа, P&L и экономика парка'
                  },
                  {
                    key: 'canEditPayroll' as const,
                    label: 'Редактирование расчёта сдельщины и табеля'
                  },
                  {
                    key: 'canApproveShifts' as const,
                    label: 'Закрытие смен и утверждение путевых листов'
                  },
                  {
                    key: 'canViewDriverMaxPhones' as const,
                    label: 'Просмотр бот-номеров телефонов (MAX)'
                  },
                  {
                    key: 'canEditKnowledgeBase' as const,
                    label: 'Изменение и публикация в Базу знаний'
                  },
                  {
                    key: 'canAccessFixedCostsTable' as const,
                    label: 'Доступ к таблице постоянных затрат (Офис и ИТР, АХЧ, лизинг, налоги, прочие)'
                  },
                  {
                    key: 'canAccessVariableCostsTable' as const,
                    label: 'Доступ к таблице переменных затрат (ГСМ, ФОТ, ТО, трал)'
                  }
                ].map(item => (
                  <label
                    key={item.key}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer hover:border-slate-700"
                  >
                    <span className="text-slate-200">{item.label}</span>
                    <input
                      type="checkbox"
                      checked={activeRolePolicy.fields[item.key]}
                      onChange={() => handleToggleRoleFieldAccess(item.key)}
                      className="rounded border-slate-600 bg-slate-800 text-amber-500"
                    />
                  </label>
                ))}
              </div>
            </div>

            {/* Page-by-page access level */}
            <div className="space-y-2">
              <div className="font-semibold text-slate-200">Доступ к страницам (разделам)</div>
              <div className="overflow-x-auto rounded-lg border border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3 font-medium">Страница / Раздел</th>
                      <th className="py-2 px-3 font-medium text-right">Уровень доступа</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
                    {SYSTEM_PAGE_LIST.map(page => {
                      const level = activeRolePolicy.pages[page.id] || 'view';
                      return (
                        <tr key={page.id} className="hover:bg-slate-900/50">
                          <td className="py-2 px-3 text-slate-200 font-medium">{page.label}</td>
                          <td className="py-2 px-3 text-right">
                            <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5 gap-0.5">
                              {[
                                { id: 'edit' as const, label: 'Изменение' },
                                { id: 'view' as const, label: 'Просмотр' },
                                { id: 'hidden' as const, label: 'Скрыто' }
                              ].map(opt => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => handleSetRolePageAccess(page.id, opt.id)}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer whitespace-nowrap ${
                                    level === opt.id
                                      ? opt.id === 'edit'
                                        ? 'bg-emerald-500/25 text-emerald-300'
                                        : opt.id === 'view'
                                        ? 'bg-sky-500/25 text-sky-300'
                                        : 'bg-rose-500/25 text-rose-300'
                                      : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  {opt.label}
                                </button>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
