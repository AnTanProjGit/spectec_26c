import React, { useState, useMemo, useEffect } from 'react';
import {
  Briefcase,
  MapPin,
  GitBranch,
  Truck,
  Users,
  FileText,
  Sliders,
  Bot,
  Building2,
  CheckCircle2,
  Clock,
  ShieldCheck,
  ArrowRightLeft,
  Wallet,
  Lock,
  Unlock,
  AlertCircle,
  ExternalLink,
  Calendar,
  MessageSquare
} from 'lucide-react';
import {
  AccountingSubjectId,
  ChatAttachment,
  ChatConfirmation,
  CRMDeal,
  CRMStage,
  DriverProfile,
  DriverReplacementRecord,
  Equipment,
  EquipmentStatus,
  FleetBranch,
  LegalDocument,
  MaxCustomerBotConfig,
  OneCIntegrationConfig,
  RentalOrder,
  ShiftReport
} from '../../types';
import { NewDealModal } from '../NewDealModal';
import { QuickShiftModal } from '../QuickShiftModal';
import { DriverBindingPanel } from '../DriverBindingPanel';
import { MaxCustomerBotPanel } from '../MaxCustomerBotPanel';
import { CustomerCardModal } from '../CustomerCardModal';
import {
  BRANCH_OVERHEAD_CATEGORY_MAP,
  getBranchFixedOverheads,
  getBranchFixedOverheadsTotal
} from '../../utils/branchOverheads';
import {
  BranchCustomerRow,
  buildBranchCustomerRows,
  CustomerPeriodFilter,
  CustomerPeriodMode
} from '../../utils/clientDirectory';

interface FleetManagerViewProps {
  branches: FleetBranch[];
  activeBranch: FleetBranch | null;
  equipmentList: Equipment[];
  deals: CRMDeal[];
  orders: RentalOrder[];
  shiftReports: ShiftReport[];
  drivers: DriverProfile[];
  replacements: Record<string, DriverReplacementRecord>;
  oneCConfig: OneCIntegrationConfig;
  legalDocuments?: LegalDocument[];
  maxBotConfigs: Record<string, MaxCustomerBotConfig>;
  onUpdateMaxBotConfig: (branchId: string, config: MaxCustomerBotConfig) => void;
  onSaveBranch: (branch: FleetBranch) => void;
  onSelectBranchWorkspace: (branchId: string | 'all') => void;
  onSubmitDeal: (deal: CRMDeal) => void;
  onUpdateDeal: (deal: CRMDeal) => void;
  onSubmitShift: (shift: ShiftReport) => void;
  onModerateShift: (shiftId: string, patch: Partial<ShiftReport>) => void;
  onEditEquipmentStatus: (eqId: string, status: EquipmentStatus) => void;
  onUpdateEquipmentSite: (eqId: string, site: string) => void;
  onUpdateDriver: (driver: DriverProfile) => void;
  onAddDriver: (driver: DriverProfile) => void;
  onSetReplacement: (equipmentId: string, record: DriverReplacementRecord | null) => void;
  onSendChatMessage: (payload: {
    branchId: string;
    senderName: string;
    senderRole: 'admin' | 'fleet_manager' | 'driver' | 'client';
    text: string;
  }) => void;
  onSendAttachmentToChat: (payload: {
    branchId: string;
    attachment: ChatAttachment;
    text: string;
    senderName: string;
  }) => void;
  onOpenAdminPanel: () => void;
  adminConfirmationAllowed: boolean;
  onToggleAdminPermission: () => void;
  onConfirmWork: (payload: {
    type: ChatConfirmation['type'];
    value: string;
    shiftId?: string;
    equipmentId?: string;
    requestLabel?: string;
    comment?: string;
  }) => void;
  confirmRequest?: {
    dealId?: string;
    confirmType?: ChatConfirmation['type'];
    nonce: number;
  } | null;
  onOpenCrm?: () => void;
  onOpenContract?: (payload: {
    docId?: string;
    docNumber?: string;
    clientName: string;
    branchId: string;
    orderNumber?: string;
    subjectId: AccountingSubjectId;
    hasContract: boolean;
  }) => void;
  onOpenCustomerChat?: (payload: {
    branchId: string;
    clientName: string;
    contactPerson: string;
    phone: string;
    dealId?: string;
  }) => void;
}

type FleetManagerTab = 'forms' | 'moderation' | 'max_bot' | 'structure';

const DEFAULT_MAX_BOT_CONFIG: MaxCustomerBotConfig = {
  enabled: true,
  allowNewRentalRequests: true,
  allowShiftHourConfirmation: true,
  allowSiteChatAndPhotos: true,
  autoRouteTo1C: true,
  requireManagerModeration: true
};

const STAGE_LABELS: Record<CRMStage, string> = {
  lead: '1. Новая заявка',
  calculation: '2. Расчёт сметы',
  contract: '3. Согласование договора',
  active: '4. Техника на объекте',
  completed: '5. Завершено / Актировано'
};

const STATUS_LABELS: Record<EquipmentStatus, string> = {
  available: 'Свободна',
  rented: 'В аренде',
  maintenance: 'На ТО / ремонте',
  reserve: 'В резерве'
};

const CUSTOMER_MONTH_NAMES: { value: string; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: '01', label: 'Январь' },
  { value: '02', label: 'Февраль' },
  { value: '03', label: 'Март' },
  { value: '04', label: 'Апрель' },
  { value: '05', label: 'Май' },
  { value: '06', label: 'Июнь' },
  { value: '07', label: 'Июль' },
  { value: '08', label: 'Август' },
  { value: '09', label: 'Сентябрь' },
  { value: '10', label: 'Октябрь' },
  { value: '11', label: 'Ноябрь' },
  { value: '12', label: 'Декабрь' }
];

export const FleetManagerView: React.FC<FleetManagerViewProps> = ({
  branches,
  activeBranch,
  equipmentList,
  deals,
  orders,
  shiftReports,
  drivers,
  replacements,
  oneCConfig,
  legalDocuments = [],
  maxBotConfigs,
  onUpdateMaxBotConfig,
  onSaveBranch,
  onSelectBranchWorkspace,
  onSubmitDeal,
  onUpdateDeal,
  onSubmitShift,
  onModerateShift,
  onEditEquipmentStatus,
  onUpdateEquipmentSite,
  onUpdateDriver,
  onAddDriver,
  onSetReplacement,
  onSendChatMessage,
  onSendAttachmentToChat,
  onOpenAdminPanel,
  adminConfirmationAllowed,
  onToggleAdminPermission,
  onConfirmWork,
  confirmRequest,
  onOpenCrm,
  onOpenContract,
  onOpenCustomerChat
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    activeBranch?.id || branches[0]?.id || 'branch-hq'
  );
  const [subTab, setSubTab] = useState<FleetManagerTab>('forms');
  const [routingSavedNotice, setRoutingSavedNotice] = useState(false);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string | null>(null);
  const [customerPeriodType, setCustomerPeriodType] = useState<'date' | 'month'>('month');
  const [customerPeriodDate, setCustomerPeriodDate] = useState<string>('2026-11-02');
  const [customerPeriodMonthNum, setCustomerPeriodMonthNum] = useState<string>('all');
  const [customerPeriodYear, setCustomerPeriodYear] = useState<string>('2026');

  // Shift & volume confirmation state (exclusively in Fleet Manager)
  const [confirmType, setConfirmType] = useState<ChatConfirmation['type']>('shift_close');
  const [selectedRequestKey, setSelectedRequestKey] = useState<string>('');
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string>('');
  const [confirmValue, setConfirmValue] = useState<string>('Смена закрыта (10 м/ч)');
  const [confirmComment, setConfirmComment] = useState<string>('');
  const [confirmSuccessNotice, setConfirmSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (activeBranch) {
      setSelectedBranchId(activeBranch.id);
    }
  }, [activeBranch]);

  useEffect(() => {
    if (!confirmRequest) return;
    setSubTab('moderation');
    if (confirmRequest.confirmType) {
      setConfirmType(confirmRequest.confirmType);
    }
    if (confirmRequest.dealId) {
      const targetDeal = deals.find(d => d.id === confirmRequest.dealId);
      if (targetDeal?.branchId) {
        setSelectedBranchId(targetDeal.branchId);
      }
      setSelectedRequestKey(`deal:${confirmRequest.dealId}`);
    }
  }, [confirmRequest, deals]);

  const currentBranch = useMemo(
    () =>
      branches.find(b => b.id === selectedBranchId) ||
      activeBranch ||
      branches[0],
    [branches, selectedBranchId, activeBranch]
  );

  if (!currentBranch) {
    return (
      <div className="p-6 text-center text-slate-400">
        Нет настроенных участков или филиалов.
      </div>
    );
  }

  const branchEquipment = equipmentList.filter(e => e.branchId === currentBranch.id);
  const branchDeals = deals.filter(d => d.branchId === currentBranch.id);
  const branchOrders = orders.filter(o => o.branchId === currentBranch.id);
  const branchShifts = shiftReports.filter(s => s.branchId === currentBranch.id);
  const branchDrivers = drivers.filter(d => d.branchId === currentBranch.id);

  const rentedCount = branchEquipment.filter(e => e.status === 'rented').length;
  const availableCount = branchEquipment.filter(e => e.status === 'available').length;
  const maintReserveCount = branchEquipment.filter(
    e => e.status === 'maintenance' || e.status === 'reserve'
  ).length;
  const pendingShiftsCount = branchShifts.filter(s => s.status !== 'approved').length;

  const currentMaxConfig: MaxCustomerBotConfig =
    maxBotConfigs[currentBranch.id] || DEFAULT_MAX_BOT_CONFIG;

  useEffect(() => {
    const existsInDeals =
      selectedRequestKey.startsWith('deal:') &&
      branchDeals.some(d => `deal:${d.id}` === selectedRequestKey);
    const existsInOrders =
      selectedRequestKey.startsWith('order:') &&
      branchOrders.some(o => `order:${o.id}` === selectedRequestKey);

    if (!existsInDeals && !existsInOrders) {
      const firstActiveDeal = branchDeals.find(d => d.stage === 'active');
      if (firstActiveDeal) {
        setSelectedRequestKey(`deal:${firstActiveDeal.id}`);
      } else {
        const firstActiveOrder = branchOrders.find(o => o.status === 'active');
        if (firstActiveOrder) {
          setSelectedRequestKey(`order:${firstActiveOrder.id}`);
        } else if (branchDeals[0]) {
          setSelectedRequestKey(`deal:${branchDeals[0].id}`);
        } else if (branchOrders[0]) {
          setSelectedRequestKey(`order:${branchOrders[0].id}`);
        } else {
          setSelectedRequestKey('');
        }
      }
    }
  }, [branchDeals, branchOrders, selectedRequestKey]);

  useEffect(() => {
    if (branchShifts.length > 0 && !branchShifts.some(s => s.id === selectedShiftId)) {
      setSelectedShiftId(branchShifts[0].id);
    } else if (branchShifts.length === 0 && selectedShiftId !== '') {
      setSelectedShiftId('');
    }
  }, [branchShifts, selectedShiftId]);

  useEffect(() => {
    if (branchEquipment.length > 0 && !branchEquipment.some(e => e.id === selectedEquipmentId)) {
      setSelectedEquipmentId(branchEquipment[0].id);
    } else if (branchEquipment.length === 0 && selectedEquipmentId !== '') {
      setSelectedEquipmentId('');
    }
  }, [branchEquipment, selectedEquipmentId]);

  useEffect(() => {
    if (confirmType === 'hours') setConfirmValue('10 ч');
    else if (confirmType === 'shift_close') setConfirmValue('Смена закрыта (10 м/ч)');
    else setConfirmValue('14 рейсов / 280 м³');
  }, [confirmType]);

  const selectedDealForConfirm = selectedRequestKey.startsWith('deal:')
    ? branchDeals.find(d => `deal:${d.id}` === selectedRequestKey)
    : undefined;
  const selectedOrderForConfirm = selectedRequestKey.startsWith('order:')
    ? branchOrders.find(o => `order:${o.id}` === selectedRequestKey)
    : undefined;

  const isRequestCreatedAndActive = Boolean(
    (selectedDealForConfirm && selectedDealForConfirm.stage === 'active') ||
      (selectedOrderForConfirm && selectedOrderForConfirm.status === 'active')
  );

  const selectedRequestLabel = selectedDealForConfirm
    ? `${selectedDealForConfirm.clientName} (${STAGE_LABELS[selectedDealForConfirm.stage]})`
    : selectedOrderForConfirm
    ? `${selectedOrderForConfirm.orderNumber} · ${selectedOrderForConfirm.clientName}`
    : 'Не выбрана';

  const canCloseShift = adminConfirmationAllowed && isRequestCreatedAndActive;

  const confirmModeLabel =
    confirmType === 'hours'
      ? 'Подтверждение часов работы'
      : confirmType === 'shift_close'
      ? 'Закрытие смены (ЭСМ-7)'
      : 'Подтверждение объёма (рейсов)';

  const handleRunConfirm = () => {
    if (!canCloseShift) return;
    onConfirmWork({
      type: confirmType,
      value: confirmValue.trim() || 'Подтверждено',
      shiftId: selectedShiftId || undefined,
      equipmentId: selectedEquipmentId || undefined,
      requestLabel: selectedRequestLabel,
      comment: confirmComment.trim() || undefined
    });
    setConfirmComment('');
    setConfirmSuccessNotice(`Подтверждено (${confirmModeLabel}): смена отмечена и запись отправлена в чат.`);
    setTimeout(() => setConfirmSuccessNotice(null), 4000);
  };

  const handleBranchFlowToggle = (
    field: 'isolatedStreams' | 'isolateCrmAndErp',
    value: boolean
  ) => {
    onSaveBranch({
      ...currentBranch,
      documentFlow: {
        ...currentBranch.documentFlow,
        [field]: value
      }
    });
    setRoutingSavedNotice(true);
    setTimeout(() => setRoutingSavedNotice(false), 2500);
  };

  return (
    <div className="p-4 space-y-4 max-w-[1440px] mx-auto">
      {/* Page Header & Branch Membership Banner (Req 3: exact document routing info) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-amber-400 mb-1">
              <Briefcase className="w-4 h-4" />
              <span>Рабочее место Fleet Manager · Общая организационная структура участка</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Поле для Fleet Manager: {currentBranch.name}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              Регистрация заявок CRM, оформление и утверждение смен машинистов, модерация состояний и Бот заказчика «MAX»
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentBranch.id}
              onChange={(e) => {
                setSelectedBranchId(e.target.value);
                if (activeBranch) {
                  onSelectBranchWorkspace(e.target.value);
                }
              }}
              aria-label="Выбор участка для маршрутизации документов"
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 font-medium focus:outline-none focus:border-amber-500"
            >
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  [{b.code}] {b.name} — {b.fleetManagerName}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => onSelectBranchWorkspace(currentBranch.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                activeBranch?.id === currentBranch.id
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>
                {activeBranch?.id === currentBranch.id
                  ? 'Контур участка активен'
                  : 'Изолировать интерфейс на участок'}
              </span>
            </button>
          </div>
        </div>

        {/* Req 3: Prominent Branch Membership & Document Routing Strip */}
        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2 text-slate-300">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-slate-400">Принадлежность к участку (маршрутизация документов):</span>
            <strong className="text-white">
              [{currentBranch.code}] {currentBranch.name}
            </strong>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>{currentBranch.city}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span>Fleet Manager: <strong className="text-amber-300">{currentBranch.fleetManagerName}</strong></span>
            {currentBranch.fleetManagerPhone && (
              <>
                <span aria-hidden="true" className="text-slate-600">·</span>
                <span className="font-mono text-slate-400 tabular-nums">{currentBranch.fleetManagerPhone}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono text-[12px] text-emerald-400 tabular-nums">
            <GitBranch className="w-3.5 h-3.5 shrink-0" />
            <span>1С: {currentBranch.documentFlow.oneCDepartmentCode}</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span>CRM: {currentBranch.documentFlow.orderPrefix}</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span>ПЛ: {currentBranch.documentFlow.waybillPrefix}</span>
            <span aria-hidden="true" className="text-slate-600">/</span>
            <span>Акты: {currentBranch.documentFlow.actPrefix}</span>
          </div>
        </div>

        {/* Compact Organizational Structure Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-[11px] text-slate-400">Руководство участка</div>
            <div className="text-sm font-bold text-white mt-0.5">{currentBranch.fleetManagerName}</div>
            <div className="text-xs text-slate-400 mt-0.5 truncate">{currentBranch.baseAddress}</div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-[11px] text-slate-400">Парк техники участка</div>
            <div className="text-sm font-bold text-white mt-0.5 num-mono">
              {branchEquipment.length} ед. техники
            </div>
            <div className="text-xs text-slate-400 mt-0.5 num-mono">
              В аренде: {rentedCount} · Свободна: {availableCount} · ТО/резерв: {maintReserveCount}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-[11px] text-slate-400">Штат машинистов (MAX ID)</div>
            <div className="text-sm font-bold text-white mt-0.5 num-mono">
              {branchDrivers.length} чел.
            </div>
            <div className="text-xs text-slate-400 mt-0.5 num-mono">
              Смен в работе: {branchShifts.length} · На модерации: {pendingShiftsCount}
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950/70 border border-slate-800">
            <div className="text-[11px] text-slate-400">CRM и заказчики участка</div>
            <div className="text-sm font-bold text-white mt-0.5 num-mono">
              {branchDeals.length} сделок · {branchOrders.length} заказов
            </div>
            <div className="text-xs text-slate-400 mt-0.5 num-mono">
              Регулярных заказчиков: {currentBranch.regularClients.length}
            </div>
          </div>
        </div>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1.5">
        <div className="flex flex-wrap items-center gap-1">
          {[
            { id: 'forms' as const, label: 'Основные формы (CRM + Смена)', icon: FileText },
            { id: 'moderation' as const, label: 'Модерация и состояние участка', icon: Sliders },
            { id: 'max_bot' as const, label: 'Бот заказчика «MAX»', icon: Bot },
            { id: 'structure' as const, label: 'Оргструктура и маршрутизация', icon: Building2 }
          ].map(tab => {
            const Icon = tab.icon;
            const active = subTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
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

        <div className="px-2 text-xs text-slate-400 font-mono hidden md:block">
          {currentBranch.documentFlow.isolatedStreams
            ? 'Потоки документов изолированы по участку'
            : 'Общий поток документов'}
        </div>
      </div>

      {/* TAB 1: Two Core Forms Side-by-Side (Req 1 foundation) */}
      {subTab === 'forms' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 items-start">
          <NewDealModal
            isOpen={true}
            embedded={true}
            onClose={() => {}}
            equipmentList={branchEquipment}
            drivers={branchDrivers}
            replacements={replacements}
            deals={branchDeals}
            orders={branchOrders}
            branches={branches}
            activeBranch={currentBranch}
            oneCConfig={oneCConfig}
            onSubmitDeal={onSubmitDeal}
            onSendAttachmentToChat={onSendAttachmentToChat}
            onSendChatMessage={onSendChatMessage}
          />

          <QuickShiftModal
            isOpen={true}
            embedded={true}
            onClose={() => {}}
            equipmentList={branchEquipment}
            drivers={branchDrivers}
            deals={branchDeals}
            orders={branchOrders}
            replacements={replacements}
            activeBranch={currentBranch}
            branches={branches}
            onSubmitShift={onSubmitShift}
            onSendChatNote={(payload) =>
              onSendChatMessage({
                branchId: payload.branchId,
                senderName: payload.senderName,
                senderRole: 'driver',
                text: payload.text
              })
            }
            onOpenFleetManagerPanel={() => setSubTab('moderation')}
            onOpenAdminPanel={onOpenAdminPanel}
          />
        </div>
      )}

      {/* TAB 2: Moderation & State Settings (Req 1 settings to edit and moderate state) */}
      {subTab === 'moderation' && (
        <div className="space-y-4">
          {/* Branch routing quick moderation controls */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">
                  Настройки режима участка и маршрутизации документов
                </h2>
              </div>
              {routingSavedNotice && (
                <span className="text-xs text-emerald-400 font-medium">
                  Настройки участка обновлены
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <label className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-slate-200">Изолировать потоки документов участка (1С / ЭСМ-7 / КС-2)</span>
                <input
                  type="checkbox"
                  checked={currentBranch.documentFlow.isolatedStreams}
                  onChange={(e) => handleBranchFlowToggle('isolatedStreams', e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-amber-500"
                />
              </label>

              <label className="flex items-center justify-between gap-2 p-3 rounded-lg bg-slate-950 border border-slate-800 cursor-pointer">
                <span className="text-slate-200">Раздельный контур CRM / ERP для Fleet Manager</span>
                <input
                  type="checkbox"
                  checked={currentBranch.documentFlow.isolateCrmAndErp}
                  onChange={(e) => handleBranchFlowToggle('isolateCrmAndErp', e.target.checked)}
                  className="rounded border-slate-600 bg-slate-800 text-amber-500"
                />
              </label>

              <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                <span className="text-slate-300">Базовый субъект 1С:</span>
                <select
                  value={currentBranch.documentFlow.default1CSubject}
                  onChange={(e) => {
                    onSaveBranch({
                      ...currentBranch,
                      documentFlow: {
                        ...currentBranch.documentFlow,
                        default1CSubject: e.target.value as AccountingSubjectId
                      }
                    });
                    setRoutingSavedNotice(true);
                    setTimeout(() => setRoutingSavedNotice(false), 2500);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="ooo_specialtech">ООО «SpecialTech»</option>
                  <option value="ip_specialtechnica">ИП «SpecialTechnica»</option>
                </select>
              </div>
            </div>
          </div>

          {/* 0. Work Confirmation & Shift Closing (Exclusively in Fleet Manager) */}
          <div className="bg-slate-900 border border-amber-500/30 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">
                  Подтверждение смен и объёмов (Fleet Manager)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                {confirmSuccessNotice && (
                  <span className="text-xs text-emerald-300 font-medium">
                    {confirmSuccessNotice}
                  </span>
                )}
                <button
                  type="button"
                  onClick={onToggleAdminPermission}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-mono font-semibold border transition cursor-pointer ${
                    adminConfirmationAllowed
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                      : 'bg-rose-500/15 text-rose-300 border-rose-500/40 hover:bg-rose-500/25'
                  }`}
                >
                  {adminConfirmationAllowed ? (
                    <Unlock className="w-3.5 h-3.5" />
                  ) : (
                    <Lock className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {adminConfirmationAllowed
                      ? 'Разрешение админа: Разрешено'
                      : 'Разрешение админа: Заблокировано'}
                  </span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
              <div className="lg:col-span-4 space-y-1.5">
                <label className="block font-medium text-slate-300">Тип подтверждения</label>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfirmType('hours')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition cursor-pointer ${
                      confirmType === 'hours'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-semibold'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>Подтверждение часов работы</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmType('shift_close')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition cursor-pointer ${
                      confirmType === 'shift_close'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-semibold'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Закрытие смены (ЭСМ-7)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmType('volume_trips')}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition cursor-pointer ${
                      confirmType === 'volume_trips'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 font-semibold'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>Подтверждение объёма (рейсов)</span>
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-300 mb-1">
                    Заявка / Заказ участка (должна быть активна)
                  </label>
                  <select
                    value={selectedRequestKey}
                    onChange={(e) => setSelectedRequestKey(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {branchDeals.length === 0 && branchOrders.length === 0 && (
                      <option value="">Заявки ещё не созданы</option>
                    )}
                    {branchDeals.length > 0 && (
                      <optgroup label="Заявки CRM">
                        {branchDeals.map(d => (
                          <option key={d.id} value={`deal:${d.id}`}>
                            [{STAGE_LABELS[d.stage]}] {d.clientName} — {d.siteAddress}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {branchOrders.length > 0 && (
                      <optgroup label="Активные договоры / заказы">
                        {branchOrders.map(o => (
                          <option key={o.id} value={`order:${o.id}`}>
                            [{o.status === 'active' ? 'Активна' : o.status}] {o.orderNumber} · {o.clientName}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Смена / рапорт</label>
                  <select
                    value={selectedShiftId}
                    onChange={(e) => setSelectedShiftId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {branchShifts.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.shiftNumber} · {s.operatorName} ({s.workHours} ч)
                      </option>
                    ))}
                    {branchShifts.length === 0 && <option value="">Нет открытых смен</option>}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Спецтехника</label>
                  <select
                    value={selectedEquipmentId}
                    onChange={(e) => setSelectedEquipmentId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {branchEquipment.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        [{eq.inventoryNumber}] {eq.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">
                    {confirmType === 'hours'
                      ? 'Отработано часов'
                      : confirmType === 'shift_close'
                      ? 'Итог закрытия смены'
                      : 'Объём / кол-во рейсов'}
                  </label>
                  <input
                    type="text"
                    value={confirmValue}
                    onChange={(e) => setConfirmValue(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-medium text-slate-300 mb-1">Примечание</label>
                  <input
                    type="text"
                    placeholder="Подписано прорабом..."
                    value={confirmComment}
                    onChange={(e) => setConfirmComment(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="lg:col-span-3 flex flex-col justify-between gap-2.5 p-3 rounded-lg bg-slate-950 border border-slate-800">
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      {adminConfirmationAllowed ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span>Разрешение админа</span>
                    </span>
                    {adminConfirmationAllowed ? (
                      <span className="text-emerald-400 font-semibold">Выдано</span>
                    ) : (
                      <button
                        type="button"
                        onClick={onToggleAdminPermission}
                        className="px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 font-semibold text-[11px] cursor-pointer"
                      >
                        Разрешить
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      {isRequestCreatedAndActive ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      )}
                      <span>Заявка активна</span>
                    </span>
                    {isRequestCreatedAndActive ? (
                      <span className="text-emerald-400 font-semibold">Активна</span>
                    ) : onOpenCrm ? (
                      <button
                        type="button"
                        onClick={onOpenCrm}
                        className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-semibold text-[11px] cursor-pointer"
                      >
                        В CRM
                      </button>
                    ) : (
                      <span className="text-rose-400 font-semibold">Не активна</span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!canCloseShift}
                  onClick={handleRunConfirm}
                  title={
                    canCloseShift
                      ? `Закрыть смену (${confirmModeLabel})`
                      : 'Кнопка «Закрыть смену» активна с разрешения админа при наличии активной заявки'
                  }
                  className={`w-full py-2.5 px-3 rounded-lg font-bold text-[13px] flex flex-col items-center justify-center gap-0.5 transition ${
                    canCloseShift
                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-md shadow-emerald-500/20 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {canCloseShift ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4 text-rose-400" />
                    )}
                    <span>Закрыть смену</span>
                  </span>
                  <span className={`text-[11px] font-medium ${canCloseShift ? 'text-slate-900' : 'text-slate-400'}`}>
                    {confirmModeLabel}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* 1. Moderation of Shift Reports / Waybills (ЭСМ-7) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">
                  Модерация смен машинистов и путевых листов ({branchShifts.length})
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Fleet Manager утверждает путевой лист, корректирует часы или фиксирует отклонение
              </span>
            </div>

            {branchShifts.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                На участке [{currentBranch.code}] пока нет сменных рапортов.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Дата / Путевой</th>
                      <th className="py-2 pr-3 font-medium">Техника / Машинист</th>
                      <th className="py-2 pr-3 font-medium">Объект</th>
                      <th className="py-2 pr-3 font-medium">Часы работы</th>
                      <th className="py-2 pr-3 font-medium">Простой</th>
                      <th className="py-2 font-medium text-right">Состояние (модерация)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {branchShifts.map(shift => {
                      const eq = equipmentList.find(e => e.id === shift.equipmentId);
                      return (
                        <tr key={shift.id} className="hover:bg-slate-800/30">
                          <td className="py-2.5 pr-3 font-mono text-slate-200 tabular-nums">
                            <div>{shift.date}</div>
                            <div className="text-[11px] text-amber-300">
                              {shift.waybillNumber || shift.shiftNumber}
                            </div>
                          </td>
                          <td className="py-2.5 pr-3">
                            <div className="font-semibold text-white">
                              {eq ? `[${eq.inventoryNumber}] ${eq.name}` : shift.equipmentId}
                            </div>
                            <div className="text-slate-400">{shift.operatorName}</div>
                          </td>
                          <td className="py-2.5 pr-3 text-slate-300 max-w-[200px] truncate">
                            {shift.siteName}
                          </td>
                          <td className="py-2.5 pr-3">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={shift.workHours}
                              onChange={(e) =>
                                onModerateShift(shift.id, {
                                  workHours: Math.max(0, parseFloat(e.target.value) || 0)
                                })
                              }
                              className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td className="py-2.5 pr-3">
                            <input
                              type="number"
                              min={0}
                              step={0.5}
                              value={shift.downtimeHours}
                              onChange={(e) =>
                                onModerateShift(shift.id, {
                                  downtimeHours: Math.max(0, parseFloat(e.target.value) || 0)
                                })
                              }
                              className="w-16 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td className="py-2.5 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => onModerateShift(shift.id, { status: 'approved' })}
                                className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                                  shift.status === 'approved'
                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                }`}
                              >
                                Утвердить
                              </button>
                              <button
                                type="button"
                                onClick={() => onModerateShift(shift.id, { status: 'pending' })}
                                className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                                  shift.status === 'pending'
                                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                }`}
                              >
                                Проверка
                              </button>
                              <button
                                type="button"
                                onClick={() => onModerateShift(shift.id, { status: 'anomaly' })}
                                className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer whitespace-nowrap ${
                                  shift.status === 'anomaly'
                                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                                }`}
                              >
                                Отклонение
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 2. Moderation of CRM Deals */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-sky-400" />
                <h2 className="text-sm font-bold text-white">
                  Модерация заявок на аренду (CRM) участка ({branchDeals.length})
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Изменение этапа воронки, назначенной единицы техники, часов и маршрута 1С
              </span>
            </div>

            {branchDeals.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                На участке [{currentBranch.code}] нет активных CRM-заявок.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Заказчик / Объект</th>
                      <th className="py-2 pr-3 font-medium">Этап воронки</th>
                      <th className="py-2 pr-3 font-medium">Назначенная техника</th>
                      <th className="py-2 pr-3 font-medium">Субъект 1С</th>
                      <th className="py-2 pr-3 font-medium text-right">Объём (ч)</th>
                      <th className="py-2 font-medium text-right">Сумма (₽)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {branchDeals.map(deal => (
                      <tr key={deal.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 pr-3">
                          <div className="font-semibold text-white">{deal.clientName}</div>
                          <div className="text-slate-400 truncate max-w-[240px]">
                            {deal.siteAddress} · {deal.contactPerson}
                          </div>
                        </td>
                        <td className="py-2.5 pr-3">
                          <select
                            value={deal.stage}
                            onChange={(e) =>
                              onUpdateDeal({ ...deal, stage: e.target.value as CRMStage })
                            }
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-amber-500"
                          >
                            {Object.entries(STAGE_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 pr-3">
                          <select
                            value={deal.equipmentAssignedId || ''}
                            onChange={(e) =>
                              onUpdateDeal({
                                ...deal,
                                equipmentAssignedId: e.target.value || undefined
                              })
                            }
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono focus:outline-none focus:border-amber-500 max-w-[200px]"
                          >
                            <option value="">Не назначена</option>
                            {branchEquipment.map(eq => (
                              <option key={eq.id} value={eq.id}>
                                [{eq.inventoryNumber}] {eq.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2.5 pr-3">
                          <select
                            value={deal.accountingSubject || currentBranch.documentFlow.default1CSubject}
                            onChange={(e) =>
                              onUpdateDeal({
                                ...deal,
                                accountingSubject: e.target.value as AccountingSubjectId
                              })
                            }
                            className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 focus:outline-none focus:border-amber-500"
                          >
                            <option value="ooo_specialtech">ООО «SpecialTech»</option>
                            <option value="ip_specialtechnica">ИП «SpecialTechnica»</option>
                          </select>
                        </td>
                        <td className="py-2.5 pr-3 text-right">
                          <input
                            type="number"
                            min={1}
                            value={deal.hoursRequested}
                            onChange={(e) => {
                              const nextHours = Math.max(0, parseInt(e.target.value, 10) || 0);
                              onUpdateDeal({
                                ...deal,
                                hoursRequested: nextHours,
                                estimatedAmount: nextHours * deal.hourlyRateAgreed
                              });
                            }}
                            className="w-20 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-right text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2.5 text-right font-mono font-bold text-amber-400 tabular-nums">
                          {deal.estimatedAmount.toLocaleString()} ₽
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 3. Equipment Status Moderation */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-emerald-400" />
                <h2 className="text-sm font-bold text-white">
                  Состояние парка техники участка ({branchEquipment.length} ед.)
                </h2>
              </div>
              <span className="text-xs text-slate-400">
                Быстрое изменение статуса готовности и текущего строительного объекта
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Инв. № / Техника</th>
                    <th className="py-2 pr-3 font-medium">Гос. номер</th>
                    <th className="py-2 pr-3 font-medium">Текущий объект</th>
                    <th className="py-2 pr-3 font-medium">Наработка</th>
                    <th className="py-2 font-medium text-right">Статус единицы</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {branchEquipment.map(eq => (
                    <tr key={eq.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 pr-3">
                        <span className="font-mono text-amber-300 font-bold mr-1.5">
                          [{eq.inventoryNumber}]
                        </span>
                        <span className="text-white font-medium">{eq.name}</span>
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-slate-300">{eq.plateNumber}</td>
                      <td className="py-2.5 pr-3">
                        <input
                          type="text"
                          value={eq.assignedSite || ''}
                          placeholder="База участка / объект..."
                          onChange={(e) => onUpdateEquipmentSite(eq.id, e.target.value)}
                          className="w-full min-w-[200px] bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="py-2.5 pr-3 font-mono text-slate-300 tabular-nums">
                        {eq.currentHours} м/ч
                      </td>
                      <td className="py-2.5 text-right">
                        <select
                          value={eq.status}
                          onChange={(e) =>
                            onEditEquipmentStatus(eq.id, e.target.value as EquipmentStatus)
                          }
                          className="bg-slate-800 border border-slate-700 rounded px-2.5 py-1 text-slate-100 focus:outline-none focus:border-amber-500"
                        >
                          {Object.entries(STATUS_LABELS).map(([k, label]) => (
                            <option key={k} value={k}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 4. Fleet Manager Crew Binding & Sick/Replacement Control */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
            <DriverBindingPanel
              roleMode="fleet_manager"
              drivers={branchDrivers}
              equipmentList={branchEquipment}
              branches={branches}
              activeBranch={currentBranch}
              replacements={replacements}
              onUpdateDriver={onUpdateDriver}
              onAddDriver={onAddDriver}
              onSetReplacement={onSetReplacement}
            />
          </div>
        </div>
      )}

      {/* TAB 3: Customer MAX Bot built on Fleet Manager Form (Req 2) */}
      {subTab === 'max_bot' && (
        <MaxCustomerBotPanel
          branch={currentBranch}
          botConfig={currentMaxConfig}
          onUpdateBotConfig={(nextConfig) =>
            onUpdateMaxBotConfig(currentBranch.id, nextConfig)
          }
          equipmentList={branchEquipment}
          deals={branchDeals}
          shiftReports={branchShifts}
          oneCConfig={oneCConfig}
          onSubmitDealFromBot={onSubmitDeal}
          onSendChatMessage={(payload) => onSendChatMessage(payload)}
        />
      )}

      {/* TAB 4: Organizational Structure & Routing Matrix */}
      {subTab === 'structure' && (() => {
        const effectivePeriodMode: CustomerPeriodMode =
          customerPeriodType === 'date'
            ? 'date'
            : customerPeriodMonthNum === 'all'
              ? 'year'
              : 'month';

        const customerPeriodFilter: CustomerPeriodFilter = {
          mode: effectivePeriodMode,
          date: customerPeriodDate,
          month: `${customerPeriodYear}-${customerPeriodMonthNum}`,
          year: customerPeriodYear
        };

        const branchLegalDocs = legalDocuments.filter(doc => doc.branchId === currentBranch.id);

        const customerRows: BranchCustomerRow[] = buildBranchCustomerRows({
          branch: currentBranch,
          deals: branchDeals,
          orders: branchOrders,
          legalDocuments: branchLegalDocs,
          oneCConfig,
          periodFilter: customerPeriodFilter
        });

        const availableYears = Array.from(
          new Set([
            '2026',
            '2025',
            ...branchDeals.map(d => d.dateCreated.slice(0, 4)).filter(Boolean),
            ...branchOrders.map(o => o.startDate.slice(0, 4)).filter(Boolean),
            ...branchLegalDocs.map(doc => doc.createdAt.slice(0, 4)).filter(Boolean)
          ])
        ).sort((a, b) => b.localeCompare(a));

        const monthLabel =
          CUSTOMER_MONTH_NAMES.find(m => m.value === customerPeriodMonthNum)?.label ||
          customerPeriodMonthNum;

        const activePeriodLabel =
          customerPeriodType === 'date'
            ? `за сутки (${customerPeriodDate})`
            : customerPeriodMonthNum === 'all'
              ? `за ${customerPeriodYear} г. (все месяцы)`
              : `${monthLabel} ${customerPeriodYear} г.`;

        const selectedCustomer = selectedCustomerName
          ? customerRows.find(r => r.clientName === selectedCustomerName) || null
          : null;

        const routeGroups: {
          subjectId: AccountingSubjectId;
          entityName: string;
          taxSystem: string;
          inn: string;
          routeScope: string;
          rows: BranchCustomerRow[];
        }[] = [
          {
            subjectId: 'ooo_specialtech',
            entityName: oneCConfig.subjects.ooo_specialtech.entityName,
            taxSystem: oneCConfig.subjects.ooo_specialtech.taxSystem,
            inn: oneCConfig.subjects.ooo_specialtech.inn,
            routeScope: 'Маршрут: Юр. лица (договор, счёт, УПД / КС-2 / ЭСМ-7, ЭДО)',
            rows: customerRows.filter(r => r.subjectId === 'ooo_specialtech')
          },
          {
            subjectId: 'ip_specialtechnica',
            entityName: oneCConfig.subjects.ip_specialtechnica.entityName,
            taxSystem: oneCConfig.subjects.ip_specialtechnica.taxSystem,
            inn: oneCConfig.subjects.ip_specialtechnica.inn,
            routeScope: 'Маршрут: ИП и физ. лица без НДС (счёт-оферта / ККТ 54-ФЗ / СБП)',
            rows: customerRows.filter(r => r.subjectId === 'ip_specialtechnica')
          }
        ];

        const handleContractLinkClick = (row: BranchCustomerRow) => {
          onOpenContract?.({
            docId: row.primaryContractDoc?.id,
            docNumber: row.primaryContractDoc?.number,
            clientName: row.clientName,
            branchId: currentBranch.id,
            orderNumber: row.latestOrderNumber,
            subjectId: row.subjectId,
            hasContract: row.hasContract
          });
        };

        return (
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Building2 className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-white">
                  Организационная иерархия участка [{currentBranch.code}]
                </h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">1. Уровень управления филиалом</div>
                  <div className="text-sm font-bold text-white mt-0.5">
                    {currentBranch.name} ({currentBranch.isHeadquarters ? 'Головной парк' : 'Удалённый участок'})
                  </div>
                  <div className="text-slate-300 mt-1">
                    Руководитель (Fleet Manager): <strong>{currentBranch.fleetManagerName}</strong>
                    {currentBranch.fleetManagerPhone ? ` · ${currentBranch.fleetManagerPhone}` : ''}
                  </div>
                  <div className="text-slate-300 mt-0.5">
                    Главный механик участка:{' '}
                    <strong>{currentBranch.chiefMechanicName || 'Не назначен'}</strong>
                    {currentBranch.chiefMechanicPhone ? ` · ${currentBranch.chiefMechanicPhone}` : ''}
                  </div>
                  <div className="text-slate-400 mt-0.5">База: {currentBranch.baseAddress}</div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">2. Маршрутизация документов и 1С</div>
                  <div className="grid grid-cols-2 gap-2 mt-1.5 font-mono">
                    <div className="text-slate-300">Подразделение 1С: <span className="text-amber-300">{currentBranch.documentFlow.oneCDepartmentCode}</span></div>
                    <div className="text-slate-300">Заявки CRM: <span className="text-emerald-400">{currentBranch.documentFlow.orderPrefix}</span></div>
                    <div className="text-slate-300">Путевые листы: <span className="text-emerald-400">{currentBranch.documentFlow.waybillPrefix}</span></div>
                    <div className="text-slate-300">Сменные рапорты: <span className="text-emerald-400">{currentBranch.documentFlow.shiftPrefix}</span></div>
                    <div className="text-slate-300">Акты КС-2: <span className="text-emerald-400">{currentBranch.documentFlow.actPrefix}</span></div>
                    <div className="text-slate-300">
                      Субъект 1С:{' '}
                      <span className="text-sky-300">
                        {currentBranch.documentFlow.default1CSubject === 'ip_specialtechnica'
                          ? 'ИП SpecialTechnica'
                          : 'ООО SpecialTech'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[11px] text-slate-400">3. Основные формы операционного учёта участка</div>
                  <div className="mt-1.5 space-y-1 text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>«Регистрация заявки на аренду (CRM)» — входящий поток клиентов и Бот заказчика MAX</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>«Регистрация смены машиниста» — путевые листы, моточасы, перегон и утверждение Fleet Manager</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5 text-amber-400" />
                      <span>4. Условно-постоянные расходы участка (ОХР)</span>
                    </div>
                    <span className="font-mono font-bold text-amber-300">
                      {getBranchFixedOverheadsTotal(currentBranch).toLocaleString('ru-RU')} ₽/мес
                    </span>
                  </div>
                  <div className="divide-y divide-slate-800/80">
                    {getBranchFixedOverheads(currentBranch).map(item => (
                      <div key={item.id} className="py-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${(BRANCH_OVERHEAD_CATEGORY_MAP[item.category] ?? BRANCH_OVERHEAD_CATEGORY_MAP.other).badgeClass}`}
                          >
                            {(BRANCH_OVERHEAD_CATEGORY_MAP[item.category] ?? BRANCH_OVERHEAD_CATEGORY_MAP.other).shortLabel}
                          </span>
                          <span className="text-slate-200 truncate">{item.name}</span>
                        </div>
                        <span className="font-mono text-slate-300 shrink-0 tabular-nums">
                          {item.monthlyAmountRub.toLocaleString('ru-RU')} ₽
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-sky-400" />
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Заказчики участка [{currentBranch.code}]
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      Группировка по форме хозяйствования (маршруту 1С) · Выборка по периоду · Нажмите на организацию, договор или контакт (для перехода в чат)
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Выбор типа периода: Дата (за сутки) или Месяц */}
                  <div className="inline-flex items-center rounded-lg bg-slate-950 border border-slate-800 p-0.5 text-[11px]">
                    <span className="px-2 text-slate-400 inline-flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-amber-400" />
                      Выборка:
                    </span>
                    <button
                      type="button"
                      onClick={() => setCustomerPeriodType('date')}
                      title="Выборка за день (сутки)"
                      className={`px-2.5 py-1 rounded transition cursor-pointer ${
                        customerPeriodType === 'date'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Дата
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomerPeriodType('month')}
                      title="Выборка за месяц или за год (при выборе «Все»)"
                      className={`px-2.5 py-1 rounded transition cursor-pointer ${
                        customerPeriodType === 'month'
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      Месяц
                    </button>
                  </div>

                  {customerPeriodType === 'date' ? (
                    <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>Дата (сутки):</span>
                      <input
                        type="date"
                        value={customerPeriodDate}
                        onChange={e => setCustomerPeriodDate(e.target.value)}
                        aria-label="Выбор даты (за сутки)"
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                      />
                    </label>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>Месяц:</span>
                        <select
                          value={customerPeriodMonthNum}
                          onChange={e => setCustomerPeriodMonthNum(e.target.value)}
                          aria-label="Выбор месяца (при выборе Все — за год)"
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-amber-500"
                        >
                          {CUSTOMER_MONTH_NAMES.map(m => (
                            <option key={m.value} value={m.value}>
                              {m.value === 'all' ? 'Все (за год)' : m.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                        <span>Год:</span>
                        <select
                          value={customerPeriodYear}
                          onChange={e => setCustomerPeriodYear(e.target.value)}
                          aria-label="Выбор года"
                          className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                        >
                          {availableYears.map(yr => (
                            <option key={yr} value={yr}>
                              {yr}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  <div className="font-mono text-[11px] text-slate-300 tabular-nums pl-1">
                    Организаций:{' '}
                    <span className="text-white font-semibold">{customerRows.length}</span>{' '}
                    <span className="text-amber-300">({activePeriodLabel})</span>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {routeGroups.map(group => {
                  const groupTurnover = group.rows.reduce((sum, r) => sum + r.turnoverRub, 0);
                  const groupDebt = group.rows.reduce((sum, r) => sum + r.debtRub, 0);
                  const isOsn = group.subjectId === 'ooo_specialtech';

                  return (
                    <div
                      key={group.subjectId}
                      className="rounded-lg bg-slate-950 border border-slate-800 overflow-hidden"
                    >
                      <div className="px-3.5 py-2.5 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-xs font-bold ${
                                isOsn ? 'text-sky-300' : 'text-amber-300'
                              }`}
                            >
                              {group.entityName}
                            </span>
                            <span className="text-[11px] text-slate-300 font-mono">
                              {group.taxSystem}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono tabular-nums">
                              ИНН {group.inn}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400">{group.routeScope}</div>
                        </div>

                        <div className="flex flex-wrap items-center gap-4 font-mono text-[11px] tabular-nums">
                          <span className="text-slate-300">
                            Заказчиков: <strong className="text-white">{group.rows.length}</strong>
                          </span>
                          <span className="text-slate-300">
                            Оборот:{' '}
                            <strong className="text-emerald-400">
                              {groupTurnover.toLocaleString('ru-RU')} ₽
                            </strong>
                          </span>
                          {groupDebt > 0 && (
                            <span className="text-rose-400">
                              ДЗ: <strong>{groupDebt.toLocaleString('ru-RU')} ₽</strong>
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800 text-[11px] text-slate-400 bg-slate-950">
                              <th className="py-2 px-3 font-semibold">Организация / Форма</th>
                              <th className="py-2 px-3 font-semibold">ИНН / КПП / Основание</th>
                              <th className="py-2 px-3 font-semibold">Контакт и телефон</th>
                              <th className="py-2 px-3 font-semibold">Юр. адрес и объект</th>
                              <th className="py-2 px-3 font-semibold">Заказы (№ последнего договора)</th>
                              <th className="py-2 px-3 font-semibold">Статус</th>
                              <th className="py-2 px-3 font-semibold text-right">Оборот</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/70">
                            {group.rows.length === 0 ? (
                              <tr>
                                <td colSpan={7} className="py-4 px-3 text-center text-slate-500">
                                  За период «{activePeriodLabel}» по маршруту «{group.entityName}» заказчиков на участке [{currentBranch.code}] не найдено.
                                </td>
                              </tr>
                            ) : (
                              group.rows.map(row => (
                                <tr
                                  key={row.clientName}
                                  className="hover:bg-slate-900/50 transition align-top"
                                >
                                  <td className="py-2.5 px-3">
                                    <button
                                      type="button"
                                      onClick={() => setSelectedCustomerName(row.clientName)}
                                      title="Открыть полную карточку фирмы заказчика"
                                      className="font-semibold text-sky-300 hover:text-sky-200 underline decoration-sky-500/40 underline-offset-2 text-left inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>{row.clientName}</span>
                                      <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                                    </button>
                                    <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                                      <span>ОПФ: {row.opf}</span>
                                      <span className={row.isRegularMax ? 'text-emerald-400' : 'text-slate-500'}>
                                        · {row.isRegularMax ? 'Регулярный · Бот MAX' : 'Разовый / CRM'}
                                      </span>
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 font-mono text-[11px] tabular-nums">
                                    <div className="text-slate-200">
                                      ИНН {row.inn}
                                      {row.kpp !== '—' ? ` / КПП ${row.kpp}` : ''}
                                    </div>
                                    <div className="text-slate-400 font-sans mt-0.5">
                                      {row.hasContract ? 'По договору (ЭДО)' : 'Без договора (оферта / ККТ)'}
                                      {row.ogrn !== '—' ? ` · ОГРН ${row.ogrn}` : ''}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenCustomerChat?.({
                                          branchId: currentBranch.id,
                                          clientName: row.clientName,
                                          contactPerson: row.contactPerson,
                                          phone: row.phone,
                                          dealId: row.latestDealId
                                        })
                                      }
                                      title="Перейти к сообщению с этим контактом в чате"
                                      className="group text-left w-full rounded-md -m-1 p-1 hover:bg-sky-500/10 transition cursor-pointer"
                                    >
                                      <div className="text-slate-200 group-hover:text-white inline-flex items-center gap-1.5">
                                        <span>{row.contactPerson}</span>
                                        <MessageSquare className="w-3 h-3 text-sky-400 opacity-75 group-hover:opacity-100 shrink-0" />
                                      </div>
                                      <div className="font-mono text-[11px] text-sky-300 group-hover:text-sky-200 underline decoration-sky-500/35 underline-offset-2 mt-0.5 tabular-nums">
                                        {row.phone}
                                      </div>
                                    </button>
                                  </td>

                                  <td className="py-2.5 px-3 max-w-[230px]">
                                    <div className="text-slate-300 truncate" title={row.legalAddress}>
                                      {row.legalAddress}
                                    </div>
                                    <div
                                      className="text-[11px] text-slate-400 mt-0.5 truncate"
                                      title={row.siteAddress}
                                    >
                                      Объект: {row.siteAddress}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <button
                                      type="button"
                                      onClick={() => handleContractLinkClick(row)}
                                      title="Перейти к договору заказчика"
                                      className="font-mono text-amber-300 hover:text-amber-200 underline decoration-amber-500/40 underline-offset-2 font-semibold inline-flex items-center gap-1 cursor-pointer"
                                    >
                                      <span>{row.lastContractNumber}</span>
                                      <ExternalLink className="w-3 h-3 shrink-0 opacity-75" />
                                    </button>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      {row.lastContractCaption}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 whitespace-nowrap">
                                    <div
                                      className={`font-semibold ${
                                        row.isActive ? 'text-emerald-400' : 'text-slate-400'
                                      }`}
                                    >
                                      {row.isActive ? 'Активен' : 'Закрыт'}
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      {row.statusDetail}
                                    </div>
                                  </td>

                                  <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                                    <div className="text-white font-semibold">
                                      {row.turnoverRub > 0
                                        ? `${row.turnoverRub.toLocaleString('ru-RU')} ₽`
                                        : '0 ₽'}
                                    </div>
                                    {row.debtRub > 0 && (
                                      <div className="text-[11px] text-rose-400 mt-0.5">
                                        Долг: {row.debtRub.toLocaleString('ru-RU')} ₽
                                      </div>
                                    )}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <CustomerCardModal
              customer={selectedCustomer}
              branch={currentBranch}
              equipmentList={branchEquipment}
              oneCConfig={oneCConfig}
              onClose={() => setSelectedCustomerName(null)}
              onOpenContract={(payload) => {
                setSelectedCustomerName(null);
                onOpenContract?.(payload);
              }}
              onOpenChat={(payload) => {
                setSelectedCustomerName(null);
                onOpenCustomerChat?.(payload);
              }}
            />
          </div>
        );
      })()}
    </div>
  );
};
