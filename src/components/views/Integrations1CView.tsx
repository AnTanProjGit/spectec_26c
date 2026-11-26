import React, { useState } from 'react';
import {
  Building2,
  UserCheck,
  GitBranch,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Save,
  Eye,
  EyeOff,
  FileText,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import {
  AccountingSubjectId,
  ClientType,
  FleetBranch,
  OneCIntegrationConfig,
  OneCSubjectConfig
} from '../../types';
import { resolveAccountingSubject } from '../../utils/accounting1c';

interface Integrations1CViewProps {
  config: OneCIntegrationConfig;
  onSaveConfig: (nextConfig: OneCIntegrationConfig) => void;
  branches?: FleetBranch[];
  onOpenBranches?: () => void;
}

export const Integrations1CView: React.FC<Integrations1CViewProps> = ({
  config,
  onSaveConfig,
  branches = [],
  onOpenBranches
}) => {
  const [draft, setDraft] = useState<OneCIntegrationConfig>(config);
  const [showSecrets, setShowSecrets] = useState<Record<AccountingSubjectId, boolean>>({
    ip_specialtechnica: false,
    ooo_specialtech: false
  });
  const [testingId, setTestingId] = useState<AccountingSubjectId | null>(null);
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});
  const [savedNotice, setSavedNotice] = useState(false);

  // Interactive routing simulator state
  const [simClientType, setSimClientType] = useState<ClientType>('individual');
  const [simHasContract, setSimHasContract] = useState<boolean>(false);

  const updateSubject = (id: AccountingSubjectId, patch: Partial<OneCSubjectConfig>) => {
    setDraft(prev => ({
      ...prev,
      subjects: {
        ...prev.subjects,
        [id]: {
          ...prev.subjects[id],
          ...patch
        }
      }
    }));
  };

  const handleTestConnection = async (id: AccountingSubjectId) => {
    const subject = draft.subjects[id];
    setTestingId(id);
    setTestMessages(prev => ({ ...prev, [id]: '' }));

    try {
      const res = await fetch('/api/1c/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: id,
          entityName: subject.entityName,
          odataUrl: subject.odataUrl,
          apiLogin: subject.apiLogin,
          exchangeFormat: subject.exchangeFormat
        })
      });
      const data = await res.json();

      updateSubject(id, {
        connectionStatus: data.connected ? 'connected' : 'error',
        lastCheckedAt: data.checkedAt
      });
      setTestMessages(prev => ({ ...prev, [id]: data.message || 'Проверка завершена' }));
    } catch {
      updateSubject(id, { connectionStatus: 'error' });
      setTestMessages(prev => ({
        ...prev,
        [id]: 'Ошибка обращения к локальному прокси-серверу проверки 1С.'
      }));
    } finally {
      setTestingId(null);
    }
  };

  const handleSave = () => {
    onSaveConfig(draft);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const simResult = resolveAccountingSubject(
    simClientType,
    simClientType === 'legal_entity' && draft.routing.requireContractForLegalEntity
      ? true
      : simHasContract,
    draft.routing
  );
  const simSubject = draft.subjects[simResult.subjectId];

  const subjectOrder: AccountingSubjectId[] = ['ip_specialtechnica', 'ooo_specialtech'];

  return (
    <div className="p-2.5 space-y-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-[14px] uppercase font-mono text-emerald-400 font-semibold tracking-wider">
              1С:Предприятие 8.3 · OData / HTTP-сервис · Двухконтурный учёт
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Настройка подключения к API 1С и маршрутизация субъектов
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            Раздельный бухгалтерский контур для ИП «SpecialTechnica» (физлица с договором / без договора) и ООО «SpecialTech» (юрлица по договорам)
          </p>
        </div>

        <div className="flex items-center gap-3">
          {savedNotice && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[14px] font-medium">
              <CheckCircle2 className="w-4 h-4" />
              Настройки 1С сохранены
            </span>
          )}
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[14px] transition cursor-pointer shadow-md shadow-amber-500/20"
          >
            <Save className="w-4 h-4" />
            <span>Сохранить настройки 1С</span>
          </button>
        </div>
      </div>

      {/* Two Accounting Subjects Connection Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
        {subjectOrder.map((id) => {
          const subject = draft.subjects[id];
          const isIP = id === 'ip_specialtechnica';
          const isConnected = subject.connectionStatus === 'connected';
          const isTesting = testingId === id;

          return (
            <div
              key={id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2 shadow-sm"
            >
              <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-lg border flex items-center justify-center shrink-0 ${
                      isIP
                        ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                    }`}
                  >
                    {isIP ? <UserCheck className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white">{subject.entityName}</h2>
                    <span className="text-[13px] text-slate-400 block">
                      {subject.taxSystem} · ИНН <span className="font-mono text-slate-300">{subject.inn}</span>
                    </span>
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={subject.enabled}
                    onChange={(e) => updateSubject(id, { enabled: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span className={subject.enabled ? 'text-emerald-400 font-medium' : 'text-slate-500'}>
                    {subject.enabled ? 'Активен' : 'Отключён'}
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Наименование субъекта</label>
                  <input
                    type="text"
                    value={subject.entityName}
                    onChange={(e) => updateSubject(id, { entityName: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">ИНН</label>
                  <input
                    type="text"
                    value={subject.inn}
                    onChange={(e) => updateSubject(id, { inn: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Система налогообложения</label>
                  <input
                    type="text"
                    value={subject.taxSystem}
                    onChange={(e) => updateSubject(id, { taxSystem: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Формат API обмена</label>
                  <select
                    value={subject.exchangeFormat}
                    onChange={(e) =>
                      updateSubject(id, {
                        exchangeFormat: e.target.value as 'odata_v3' | 'rest_http_service'
                      })
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    <option value="odata_v3">Стандартный OData v3 (/odata/standard.odata)</option>
                    <option value="rest_http_service">HTTP-сервис 1С (/hs/specialtech/v1)</option>
                  </select>
                </div>
              </div>

              <div className="text-xs">
                <label className="block font-medium text-slate-300 mb-1">
                  Endpoint URL базы 1С (публикация IIS / Apache)
                </label>
                <input
                  type="url"
                  value={subject.odataUrl}
                  onChange={(e) => updateSubject(id, { odataUrl: e.target.value })}
                  placeholder="https://1c.company.ru/base/odata/standard.odata"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Логин API 1С</label>
                  <input
                    type="text"
                    value={subject.apiLogin}
                    onChange={(e) => updateSubject(id, { apiLogin: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-300 mb-1">Пароль / Bearer Token</label>
                  <div className="relative">
                    <input
                      type={showSecrets[id] ? 'text' : 'password'}
                      value={subject.apiSecret}
                      onChange={(e) => updateSubject(id, { apiSecret: e.target.value })}
                      placeholder="Введите пароль или токен 1С"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-3 pr-9 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowSecrets(prev => ({ ...prev, [id]: !prev[id] }))
                      }
                      className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-200 cursor-pointer"
                    >
                      {showSecrets[id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-slate-800 text-xs">
                <label className="inline-flex items-center gap-2 text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={subject.autoSyncDocs}
                    onChange={(e) => updateSubject(id, { autoSyncDocs: e.target.checked })}
                    className="rounded border-slate-600 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Автовыгрузка актов, ЭСМ-7 и выписок банка</span>
                </label>

                <button
                  type="button"
                  onClick={() => handleTestConnection(id)}
                  disabled={isTesting || !subject.enabled}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[14px] font-medium transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-amber-400' : ''}`} />
                  <span>{isTesting ? 'Проверка...' : 'Проверить API 1С'}</span>
                </button>
              </div>

              <div className="flex items-center justify-between text-[13px] px-3 py-2 rounded-lg bg-slate-950 border border-slate-800">
                <div className="flex items-center gap-2">
                  {isConnected ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  )}
                  <span className={isConnected ? 'text-emerald-300 font-medium' : 'text-rose-300 font-medium'}>
                    {isConnected ? 'Подключение готово к обмену' : 'Нет связи / Проверьте URL'}
                  </span>
                </div>
                {subject.lastCheckedAt && (
                  <span className="text-slate-500 font-mono">проверка: {subject.lastCheckedAt}</span>
                )}
              </div>

              {testMessages[id] && (
                <p className="text-[13px] text-slate-300 bg-slate-800/60 px-3 py-2 rounded-lg border border-slate-700">
                  {testMessages[id]}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Routing Rules Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
          <GitBranch className="w-5 h-5 text-amber-400" />
          <div>
            <h2 className="text-base font-bold text-white">
              Логика маршрутизации сделок (на основании договора или без договора для физлиц)
            </h2>
            <p className="text-[14px] text-slate-400">
              Определяет, в какую бухгалтерскую базу 1С автоматически направляются контрагент, заказ, счёт и закрывающие документы
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          {/* Rule 1: Legal Entities */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">1. Юридические лица (ЮЛ)</span>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 font-mono text-xs">
                По договору
              </span>
            </div>
            <p className="text-[13px] text-slate-400 leading-relaxed">
              Компании (ООО, АО) — работа ведётся на основании договора аренды спецтехники с выставлением счёта, УПД/КС-2 и ЭСМ-7.
            </p>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Направлять в субъект 1С:</label>
              <select
                value={draft.routing.legalEntityTarget}
                onChange={(e) =>
                  setDraft(prev => ({
                    ...prev,
                    routing: { ...prev.routing, legalEntityTarget: e.target.value as AccountingSubjectId }
                  }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="ooo_specialtech">ООО «SpecialTech»</option>
                <option value="ip_specialtechnica">ИП «SpecialTechnica»</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={draft.routing.requireContractForLegalEntity}
                onChange={(e) =>
                  setDraft(prev => ({
                    ...prev,
                    routing: { ...prev.routing, requireContractForLegalEntity: e.target.checked }
                  }))
                }
                className="rounded border-slate-600 bg-slate-800 text-amber-500"
              />
              <span>Обязателен письменный договор для ЮЛ</span>
            </label>
          </div>

          {/* Rule 2: Individuals WITH contract */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">2. Физические лица (ФЛ)</span>
              <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-mono text-xs">
                С договором
              </span>
            </div>
            <p className="text-[13px] text-slate-400 leading-relaxed">
              Частные заказчики при заключении письменного договора аренды (длительные объекты, подряды на частное строительство).
            </p>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Направлять в субъект 1С:</label>
              <select
                value={draft.routing.individualWithContractTarget}
                onChange={(e) =>
                  setDraft(prev => ({
                    ...prev,
                    routing: {
                      ...prev.routing,
                      individualWithContractTarget: e.target.value as AccountingSubjectId
                    }
                  }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="ip_specialtechnica">ИП «SpecialTechnica»</option>
                <option value="ooo_specialtech">ООО «SpecialTech»</option>
              </select>
            </div>
          </div>

          {/* Rule 3: Individuals WITHOUT contract */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white">3. Физические лица (ФЛ)</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 font-mono text-xs">
                Без договора
              </span>
            </div>
            <p className="text-[13px] text-slate-400 leading-relaxed">
              Разовые смены и частные выезды без подписания бумажного договора: оплата по счёту-оферте / СБП / карте с фискальным чеком.
            </p>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Направлять в субъект 1С:</label>
              <select
                value={draft.routing.individualWithoutContractTarget}
                onChange={(e) =>
                  setDraft(prev => ({
                    ...prev,
                    routing: {
                      ...prev.routing,
                      individualWithoutContractTarget: e.target.value as AccountingSubjectId
                    }
                  }))
                }
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="ip_specialtechnica">ИП «SpecialTechnica»</option>
                <option value="ooo_specialtech">ООО «SpecialTech»</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={draft.routing.allowIndividualWithoutContract}
                onChange={(e) =>
                  setDraft(prev => ({
                    ...prev,
                    routing: { ...prev.routing, allowIndividualWithoutContract: e.target.checked }
                  }))
                }
                className="rounded border-slate-600 bg-slate-800 text-amber-500"
              />
              <span>Разрешить работу с ФЛ без договора (по оферте/чеку)</span>
            </label>
          </div>
        </div>

        {/* Live Routing Simulator */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
            <ShieldCheck className="w-4 h-4" />
            <span>Проверка правила маршрутизации в реальном времени</span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-slate-400">Контрагент:</span>
              <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setSimClientType('legal_entity');
                    if (draft.routing.requireContractForLegalEntity) setSimHasContract(true);
                  }}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    simClientType === 'legal_entity'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Юридическое лицо
                </button>
                <button
                  type="button"
                  onClick={() => setSimClientType('individual')}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    simClientType === 'individual'
                      ? 'bg-sky-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Физическое лицо
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-slate-400">Основание:</span>
              <div className="inline-flex rounded-lg bg-slate-900 border border-slate-800 p-0.5">
                <button
                  type="button"
                  onClick={() => setSimHasContract(true)}
                  className={`px-3 py-1 rounded-md transition cursor-pointer ${
                    simHasContract || (simClientType === 'legal_entity' && draft.routing.requireContractForLegalEntity)
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  На основании договора
                </button>
                <button
                  type="button"
                  disabled={simClientType === 'legal_entity' && draft.routing.requireContractForLegalEntity}
                  onClick={() => setSimHasContract(false)}
                  className={`px-3 py-1 rounded-md transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                    !simHasContract && !(simClientType === 'legal_entity' && draft.routing.requireContractForLegalEntity)
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  Без договора (для ФЛ)
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <ArrowRight className="w-4 h-4 text-amber-400" />
              <span className="px-3 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-bold">
                {simSubject.entityName} ({simSubject.taxSystem})
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-slate-300 pt-2 border-t border-slate-800/80">
            <span>{simResult.reason}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              {simResult.documentPackage.map((doc, i) => (
                <span
                  key={i}
                  className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700 font-mono text-xs"
                >
                  {doc}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Multi-branch document stream separation in 1C */}
      {branches.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
            <div>
              <h2 className="text-sm font-bold text-white">
                Разделение потоков документов по участкам и подразделениям 1С
              </h2>
              <p className="text-[13px] text-slate-400">
                Каждый участок и филиал выгружается в 1С с собственным кодом подразделения и префиксами документов
              </p>
            </div>
            {onOpenBranches && (
              <button
                type="button"
                onClick={onOpenBranches}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-[13px] font-medium transition cursor-pointer"
              >
                Настроить участки и префиксы →
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <thead className="text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-2.5">Участок / Город</th>
                  <th className="py-2 px-2.5">Fleet Manager</th>
                  <th className="py-2 px-2.5">Подразделение 1С</th>
                  <th className="py-2 px-2.5">Префиксы (Заказ / ПЛ / Смена / КС-2)</th>
                  <th className="py-2 px-2.5">Базовый субъект</th>
                  <th className="py-2 px-2.5 text-center">Потоки</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {branches.map(branch => (
                  <tr key={branch.id} className="hover:bg-slate-800/30">
                    <td className="py-2 px-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 font-mono text-xs font-bold">
                          {branch.code}
                        </span>
                        <span className="text-white font-medium">{branch.name}</span>
                      </div>
                    </td>
                    <td className="py-2 px-2.5 text-slate-300">{branch.fleetManagerName}</td>
                    <td className="py-2 px-2.5 font-mono text-sky-300">{branch.documentFlow.oneCDepartmentCode}</td>
                    <td className="py-2 px-2.5 font-mono text-[13px] text-slate-300">
                      {branch.documentFlow.orderPrefix} · {branch.documentFlow.waybillPrefix} · {branch.documentFlow.shiftPrefix} · {branch.documentFlow.actPrefix}
                    </td>
                    <td className="py-2 px-2.5 text-slate-300">
                      {branch.documentFlow.default1CSubject === 'ip_specialtechnica'
                        ? 'ИП «SpecialTechnica»'
                        : 'ООО «SpecialTech»'}
                    </td>
                    <td className="py-2 px-2.5 text-center">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-mono ${
                          branch.documentFlow.isolatedStreams
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {branch.documentFlow.isolatedStreams ? 'Изолированы' : 'Общие'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
