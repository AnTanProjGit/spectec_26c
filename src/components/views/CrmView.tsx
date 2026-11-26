import React, { useState, useEffect } from 'react';
import {
  Plus,
  Phone,
  MapPin,
  CheckCircle,
  ArrowRight,
  Lock,
  UserCheck,
  Printer,
  Database,
  Receipt,
  Bell,
  FileSpreadsheet,
  Clock,
  Calculator,
  AlertTriangle,
  Archive,
  X
} from 'lucide-react';
import {
  CRMDeal,
  CRMStage,
  ClosingDocKind,
  ClosingDocumentRecord,
  DriverProfile,
  DriverReplacementRecord,
  Equipment,
  FleetBranch,
  InvoiceStatus,
  OneCIntegrationConfig
} from '../../types';
import { resolveDriverForEquipment } from '../../utils/driverAssignment';
import {
  INVOICE_STATUS_META,
  calculateVatRub,
  generateClosingDocHtml,
  generateClosingDocPlainText,
  getActServicesPrefix,
  getKs2Prefix,
  printClosingDocumentHtml,
  resolveAccountingSubjectForDeal,
  resolveDealInvoiceStatus
} from '../../utils/closingDocuments';
import { ClosingModalTarget } from '../ClosingDocsModal';

interface CrmViewProps {
  deals: CRMDeal[];
  activeBranch?: FleetBranch | null;
  branches?: FleetBranch[];
  drivers?: DriverProfile[];
  equipmentList?: Equipment[];
  replacements?: Record<string, DriverReplacementRecord>;
  oneCConfig: OneCIntegrationConfig;
  savedClosingDocs: ClosingDocumentRecord[];
  unreadNotificationsCount: number;
  adminConfirmationAllowed?: boolean;
  onMoveDealStage: (dealId: string, nextStage: CRMStage) => void;
  onOpenDealModal: () => void;
  onCloseDealShift?: (
    dealId: string,
    payload: { date: string; shiftSlot: 1 | 2; hours: number }
  ) => void;
  onCloseDealVolume?: (dealId: string, volumeHours: number) => void;
  onCloseShiftForDeal?: (dealId: string) => void;
  onOpenClosingModal: (target: ClosingModalTarget) => void;
  onQuickSaveClosingDoc: (doc: ClosingDocumentRecord) => void;
  onUpdateInvoiceStatus: (
    sourceType: 'order' | 'deal',
    sourceId: string,
    invoiceStatus: InvoiceStatus,
    paidAmountRub: number
  ) => void;
  onOpenNotificationSettings: () => void;
}

function getTodayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const CRM_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;

function formatRetentionCountdown(completedAtIso: string | undefined, nowMs: number): {
  remainingLabel: string;
  archiveAtLabel: string;
} {
  const startMs = completedAtIso ? Date.parse(completedAtIso) : nowMs;
  const safeStartMs = Number.isFinite(startMs) ? startMs : nowMs;
  const archiveAtMs = safeStartMs + CRM_RETENTION_MS;
  const remainingMs = Math.max(0, archiveAtMs - nowMs);
  const totalMinutes = Math.floor(remainingMs / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const mins = totalMinutes % 60;

  const remainingLabel =
    days > 0
      ? `${days} сут. ${hours} ч`
      : hours > 0
      ? `${hours} ч ${mins} мин`
      : `${mins} мин`;

  const archiveDate = new Date(archiveAtMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  const archiveAtLabel = `${pad(archiveDate.getDate())}.${pad(
    archiveDate.getMonth() + 1
  )}.${archiveDate.getFullYear()} ${pad(archiveDate.getHours())}:${pad(
    archiveDate.getMinutes()
  )}`;

  return { remainingLabel, archiveAtLabel };
}

function formatDateTimeShort(iso: string | undefined): string {
  if (!iso) return '—';
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export const CrmView: React.FC<CrmViewProps> = ({
  deals,
  activeBranch,
  branches = [],
  drivers = [],
  equipmentList = [],
  replacements = {},
  oneCConfig,
  savedClosingDocs,
  unreadNotificationsCount,
  onMoveDealStage,
  onOpenDealModal,
  onCloseDealShift,
  onCloseDealVolume,
  onCloseShiftForDeal,
  onOpenClosingModal,
  onQuickSaveClosingDoc,
  onUpdateInvoiceStatus,
  onOpenNotificationSettings
}) => {
  const [shiftDrafts, setShiftDrafts] = useState<
    Record<string, { date: string; shiftSlot: 1 | 2; hours: number }>
  >({});
  const [volumeDrafts, setVolumeDrafts] = useState<Record<string, number>>({});
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  type PipelineColumnId =
    | 'lead'
    | 'order_approval'
    | 'active'
    | 'close_shift'
    | 'close_volume'
    | 'act_invoice'
    | 'completed';

  const columns: {
    id: PipelineColumnId;
    title: string;
    subtitle?: string;
    color: string;
  }[] = [
    {
      id: 'lead',
      title: '1. Новая заявка',
      color: 'border-blue-500/50 text-blue-400'
    },
    {
      id: 'order_approval',
      title: '2. Согласование заказа',
      subtitle: 'Смета / договор',
      color: 'border-amber-500/50 text-amber-400'
    },
    {
      id: 'active',
      title: '3. Техника на объекте',
      color: 'border-emerald-500/50 text-emerald-400'
    },
    {
      id: 'close_shift',
      title: '4. Закрытие смены',
      subtitle: 'Сутки: 1–12 ч (до 2 смен)',
      color: 'border-teal-500/50 text-teal-400'
    },
    {
      id: 'close_volume',
      title: '5. Закрытие объёма',
      subtitle: 'План → факт · Акт / КС-2 / КС-3',
      color: 'border-indigo-500/50 text-indigo-400'
    },
    {
      id: 'act_invoice',
      title: '6. Акт, Счёт',
      subtitle: 'Оплата и передача в «Завершено»',
      color: 'border-sky-500/50 text-sky-400'
    },
    {
      id: 'completed',
      title: '7. Завершено',
      subtitle: 'Без долга (2 сут.) · Задолженность',
      color: 'border-emerald-500/60 text-emerald-300'
    }
  ];

  const isDealArchived = (d: CRMDeal): boolean => {
    if (d.archivedAt) return true;
    if (d.stage === 'completed' && d.debtAmount <= 0 && d.completedAt) {
      const completedMs = Date.parse(d.completedAt);
      if (Number.isFinite(completedMs) && nowMs - completedMs >= CRM_RETENTION_MS) {
        return true;
      }
    }
    return false;
  };

  const activeCrmDeals = deals.filter(d => !isDealArchived(d));
  const archivedCrmDeals = [...deals.filter(isDealArchived)].sort((a, b) => {
    const aMs = Date.parse(a.archivedAt || a.completedAt || a.dateCreated || '') || 0;
    const bMs = Date.parse(b.archivedAt || b.completedAt || b.dateCreated || '') || 0;
    return bMs - aMs;
  });

  const getDealColumnSortTime = (d: CRMDeal, colId: PipelineColumnId): number => {
    if (colId === 'completed' && d.stage === 'completed' && d.debtAmount <= 0 && d.completedAt) {
      const ms = Date.parse(d.completedAt);
      if (Number.isFinite(ms)) return ms;
    }
    if (d.stageUpdatedAt) {
      const ms = Date.parse(d.stageUpdatedAt);
      if (Number.isFinite(ms)) return ms;
    }
    if (d.dateCreated) {
      const ms = Date.parse(d.dateCreated);
      if (Number.isFinite(ms)) return ms;
    }
    return 0;
  };

  const getColumnDeals = (colId: PipelineColumnId): CRMDeal[] => {
    let filtered: CRMDeal[];
    switch (colId) {
      case 'lead':
        filtered = activeCrmDeals.filter(d => d.stage === 'lead');
        break;
      case 'order_approval':
        filtered = activeCrmDeals.filter(
          d => d.stage === 'calculation' || d.stage === 'contract'
        );
        break;
      case 'active':
        filtered = activeCrmDeals.filter(d => d.stage === 'active');
        break;
      case 'close_shift':
        filtered = activeCrmDeals.filter(d => d.stage === 'active');
        break;
      case 'close_volume':
        filtered = activeCrmDeals.filter(d => d.stage === 'active');
        break;
      case 'act_invoice':
        filtered = activeCrmDeals.filter(
          d => d.stage === 'contract' || d.stage === 'active'
        );
        break;
      case 'completed':
        filtered = activeCrmDeals.filter(
          d =>
            (d.stage === 'completed' && d.debtAmount <= 0) ||
            (d.debtAmount > 0 &&
              (d.stage === 'active' ||
                d.stage === 'contract' ||
                d.stage === 'completed'))
        );
        break;
    }

    // Каждая новая карточка в колонке ставится вверх списка колонки
    return [...filtered].sort(
      (a, b) => getDealColumnSortTime(b, colId) - getDealColumnSortTime(a, colId)
    );
  };

  const totalPipelineAmount = activeCrmDeals.reduce(
    (sum, d) => sum + d.estimatedAmount,
    0
  );
  const totalDebtorAmount = activeCrmDeals.reduce((sum, d) => sum + d.debtAmount, 0);

  const buildDealQuickDoc = (deal: CRMDeal, kind: ClosingDocKind) => {
    const branch =
      branches.find(b => b.id === deal.branchId) || activeBranch || null;
    const eq = deal.equipmentAssignedId
      ? equipmentList.find(e => e.id === deal.equipmentAssignedId)
      : equipmentList.find(
          e => e.branchId === deal.branchId && e.type === deal.equipmentType
        );
    const branchCode = branch?.code || 'МСК';
    const actPrefix = getActServicesPrefix(branch);
    const ks2Prefix = getKs2Prefix(branch);
    const tail = deal.id.replace(/\D/g, '') || '201';
    const subject = resolveAccountingSubjectForDeal(deal);
    const qty = deal.closedVolumeHours ?? deal.hoursRequested;
    const total = Math.round(qty * deal.hourlyRateAgreed);
    const paid =
      deal.paidAmount ?? Math.max(0, (deal.estimatedAmount || 0) - (deal.debtAmount || 0));

    const number =
      kind === 'ks2'
        ? deal.ks2Number || `${ks2Prefix}CRM-${tail}`
        : kind === 'ks3'
        ? deal.ks3Number || `КС3-${branchCode}-CRM-${tail}`
        : kind === 'invoice'
        ? deal.invoiceNumber || `СЧ-${branchCode}-CRM-${tail}`
        : deal.actNumber || `${actPrefix}CRM-${tail}`;

    const operatorName =
      deal.assignedDriverName || eq?.assignedOperator || 'Дежурный экипаж';
    const eqTitle = eq
      ? `[${eq.inventoryNumber}] ${eq.name} (${eq.plateNumber})`
      : `Спецтехника (${deal.equipmentType})`;

    const base: ClosingDocumentRecord = {
      id: `cdoc-deal-${deal.id}-${kind}`,
      kind,
      number,
      date: getTodayIso(),
      periodStart: deal.dateCreated || getTodayIso(),
      periodEnd: getTodayIso(),
      branchId: deal.branchId,
      sourceType: 'deal',
      sourceId: deal.id,
      orderOrDealNumber: `CRM-${deal.id.toUpperCase()}`,
      clientName: deal.clientName,
      siteAddress: deal.siteAddress,
      equipmentName: eqTitle,
      operatorName,
      workDescription: `Аренда и выполнение работ спецтехникой (${eqTitle})`,
      unitLabel: 'маш.-час',
      quantity: qty,
      rateRub: deal.hourlyRateAgreed,
      totalAmountRub: total,
      vatAmountRub: calculateVatRub(total, subject),
      accountingSubject: subject,
      savedToBase: true,
      savedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      invoiceStatus: kind === 'invoice' ? resolveDealInvoiceStatus(deal) : undefined,
      paidAmountRub: kind === 'invoice' ? paid : undefined,
      contentText: ''
    };
    base.contentText = generateClosingDocPlainText(base, branch, oneCConfig);
    return { doc: base, branch };
  };

  const handleQuickPrintDeal = (deal: CRMDeal, kind: ClosingDocKind) => {
    const { doc, branch } = buildDealQuickDoc(deal, kind);
    const html = generateClosingDocHtml(doc, branch, oneCConfig);
    printClosingDocumentHtml(html);
  };

  const handleQuickSaveDealClosingPack = (deal: CRMDeal) => {
    const { doc: actDoc } = buildDealQuickDoc(deal, 'act_services');
    const { doc: ks2Doc } = buildDealQuickDoc(deal, 'ks2');
    const { doc: ks3Doc } = buildDealQuickDoc(deal, 'ks3');
    onQuickSaveClosingDoc(actDoc);
    onQuickSaveClosingDoc(ks2Doc);
    onQuickSaveClosingDoc(ks3Doc);
  };

  const renderDriverLine = (deal: CRMDeal) => {
    const eq = deal.equipmentAssignedId
      ? equipmentList.find(e => e.id === deal.equipmentAssignedId)
      : undefined;
    const res = eq ? resolveDriverForEquipment(eq, drivers, replacements) : null;
    const driverText =
      res?.replacementRecord?.driverName ||
      res?.resolvedDriver?.name ||
      deal.assignedDriverName ||
      eq?.assignedOperator;
    const phoneText =
      res?.replacementRecord?.driverPhone ||
      res?.resolvedDriver?.phone ||
      deal.assignedDriverPhone;
    if (!driverText && !res?.requiresManagerSelection) return null;
    return (
      <div
        className={`flex items-center gap-1.5 text-xs ${
          res?.requiresManagerSelection
            ? 'text-rose-300 font-semibold'
            : 'text-sky-300'
        }`}
      >
        <UserCheck className="w-3 h-3 shrink-0" />
        <span className="truncate">
          {res?.requiresManagerSelection
            ? 'Требуется замена водителя (Fleet Manager / Админ)'
            : `${driverText}${phoneText ? ` · ${phoneText}` : ''}`}
        </span>
      </div>
    );
  };

  return (
    <div className="p-3 space-y-3 w-full max-w-[1720px] mx-auto">
      {/* Header and Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {activeBranch
              ? `CRM участка: ${activeBranch.name}`
              : 'CRM: Воронка продаж и контрагенты (Все участки)'}
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            {activeBranch
              ? `Ответственный Fleet Manager: ${activeBranch.fleetManagerName} · Поток ${activeBranch.documentFlow.orderPrefix} · ${activeBranch.city}`
              : 'Контроль заявок, согласование договоров, учёт смен (1–12 ч), закрытие объёмов (Акт / КС-2 / КС-3), оплата и завершение'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsArchiveOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <Archive className="w-4 h-4 text-emerald-400" />
            <span>Архив CRM</span>
            <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px] font-bold">
              {archivedCrmDeals.length}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenNotificationSettings}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
          >
            <Bell className="w-4 h-4 text-amber-400" />
            <span>Уведомления о статусе</span>
            {unreadNotificationsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded bg-rose-500 text-white font-mono text-[10px] font-bold">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            onClick={onOpenDealModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Новая заявка контрагента</span>
          </button>
        </div>
      </div>

      {/* Top CRM Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">
            Потенциал сделок в воронке
          </span>
          <span className="text-xl font-bold text-white num-mono">
            {(totalPipelineAmount / 1_000_000).toFixed(2)} млн ₽
          </span>
          <span className="text-xs text-slate-500 block mt-0.5">
            {activeCrmDeals.length} активных сделок · в архиве: {archivedCrmDeals.length}
          </span>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">
            Общая дебиторская задолженность
          </span>
          <span className="text-xl font-bold text-rose-400 num-mono">
            {(totalDebtorAmount / 1_000_000).toFixed(2)} млн ₽
          </span>
          <span className="text-xs text-rose-500 block mt-0.5">
            Статус «Завершено» блокируется при наличии долга
          </span>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">
            Конверсия воронки (Lead to Contract)
          </span>
          <span className="text-xl font-bold text-emerald-400 num-mono">
            42.8%
          </span>
          <span className="text-xs text-emerald-500 block mt-0.5">
            «Завершено» хранится 2 суток · на 3-и сутки в архив
          </span>
        </div>
      </div>

      {/* Kanban & Operational Closing Board (7 columns) */}
      <div className="overflow-x-auto pb-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(7,minmax(235px,1fr))] gap-2.5">
          {columns.map(col => {
            const colDeals = getColumnDeals(col.id);
            const colTotal = colDeals.reduce(
              (sum, d) => sum + d.estimatedAmount,
              0
            );

            return (
              <div
                key={col.id}
                className="bg-slate-900/90 rounded-xl border border-slate-800 flex flex-col max-h-[820px] shadow-sm min-w-0"
              >
                {/* Column Header */}
                <div
                  className={`p-2.5 border-b border-slate-800 ${col.color} border-t-2 rounded-t-xl bg-slate-950/40`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <h3 className="font-bold text-xs tracking-tight text-white">
                      {col.title}
                    </h3>
                    <span className="px-1.5 py-0.5 rounded font-mono text-xs bg-slate-800 text-slate-300 font-bold shrink-0 tabular-nums">
                      {colDeals.length}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-0.5">
                    <span className="text-xs font-mono text-slate-400 tabular-nums">
                      {(colTotal / 1_000_000).toFixed(2)} млн ₽
                    </span>
                    {col.subtitle && (
                      <span className="text-[11px] font-medium text-slate-300 truncate">
                        {col.subtitle}
                      </span>
                    )}
                  </div>
                </div>

                {/* Cards list */}
                <div className="p-1.5 space-y-1.5 overflow-y-auto flex-1">
                  {colDeals.length === 0 ? (
                    <div className="p-3 text-center text-[13px] text-slate-500 italic">
                      Нет заявок на этапе
                    </div>
                  ) : (
                    colDeals.map(deal => {
                      const invStatus = resolveDealInvoiceStatus(deal);
                      const invMeta = INVOICE_STATUS_META[invStatus];
                      const actSaved =
                        Boolean(deal.actSavedToBase) ||
                        savedClosingDocs.some(
                          d =>
                            d.sourceType === 'deal' &&
                            d.sourceId === deal.id &&
                            d.kind === 'act_services' &&
                            d.savedToBase
                        );
                      const ks2Saved =
                        Boolean(deal.ks2SavedToBase) ||
                        savedClosingDocs.some(
                          d =>
                            d.sourceType === 'deal' &&
                            d.sourceId === deal.id &&
                            d.kind === 'ks2' &&
                            d.savedToBase
                        );
                      const ks3Saved =
                        Boolean(deal.ks3SavedToBase) ||
                        savedClosingDocs.some(
                          d =>
                            d.sourceType === 'deal' &&
                            d.sourceId === deal.id &&
                            d.kind === 'ks3' &&
                            d.savedToBase
                        );
                      const eq = deal.equipmentAssignedId
                        ? equipmentList.find(
                            e => e.id === deal.equipmentAssignedId
                          )
                        : undefined;

                      // Column 4: Закрытие смены (сутки: 1–12 ч, до 2 смен в сутки)
                      if (col.id === 'close_shift') {
                        const logs = deal.shiftLogs || [];
                        const shiftTotalHours =
                          deal.closedShiftHoursTotal ??
                          logs.reduce((acc, s) => acc + s.hours, 0);
                        const draft = shiftDrafts[deal.id] || {
                          date: '2026-11-02',
                          shiftSlot: 1 as const,
                          hours: 8
                        };
                        const dayLogs = logs.filter(s => s.date === draft.date);
                        const slot1Closed = dayLogs.some(s => s.shiftSlot === 1);
                        const slot2Closed = dayLogs.some(s => s.shiftSlot === 2);
                        const selectedSlotTaken =
                          (draft.shiftSlot === 1 && slot1Closed) ||
                          (draft.shiftSlot === 2 && slot2Closed);
                        const bothDaySlotsTaken = slot1Closed && slot2Closed;

                        return (
                          <div
                            key={deal.id}
                            className="p-2.5 bg-slate-950/90 rounded-lg border border-slate-800 hover:border-slate-700 transition space-y-2 text-xs"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <h4 className="font-bold text-white text-[13px] truncate">
                                  {deal.clientName}
                                </h4>
                                <span className="text-[11px] text-slate-400">
                                  {deal.stage === 'completed'
                                    ? 'Завершено'
                                    : 'Техника на объекте'}
                                </span>
                              </div>
                              {!activeBranch && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[10px] font-bold shrink-0">
                                  {branches.find(b => b.id === deal.branchId)
                                    ?.code || deal.branchId}
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-300 space-y-1">
                              <div className="flex items-center gap-1.5 text-slate-400">
                                <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                                <span className="truncate">{deal.siteAddress}</span>
                              </div>
                              {eq && (
                                <div className="font-mono text-slate-200 truncate">
                                  [{eq.inventoryNumber}] {eq.name}
                                </div>
                              )}
                              {renderDriverLine(deal)}
                            </div>

                            {/* Смена: 1–12 часов в рамках одних суток (до 2 смен) */}
                            <div className="p-2 rounded bg-slate-900 border border-slate-800/90 space-y-1.5 text-[11px]">
                              <div className="flex items-center justify-between font-mono tabular-nums">
                                <span className="text-slate-400 flex items-center gap-1">
                                  <Clock className="w-3 h-3 text-teal-400" />
                                  Закрыто смен:
                                </span>
                                <span className="text-teal-300 font-bold">
                                  {logs.length} см. · {shiftTotalHours} ч
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-1.5">
                                <div>
                                  <label className="text-[10px] text-slate-400 block mb-0.5">
                                    Сутки (дата)
                                  </label>
                                  <input
                                    type="date"
                                    value={draft.date}
                                    onChange={e =>
                                      setShiftDrafts(prev => ({
                                        ...prev,
                                        [deal.id]: {
                                          ...draft,
                                          date: e.target.value
                                        }
                                      }))
                                    }
                                    className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-[10px]"
                                  />
                                </div>

                                <div>
                                  <label className="text-[10px] text-slate-400 block mb-0.5">
                                    Часы (1–12 ч)
                                  </label>
                                  <input
                                    type="number"
                                    min={1}
                                    max={12}
                                    step={0.5}
                                    value={draft.hours}
                                    onChange={e => {
                                      const raw = parseFloat(e.target.value);
                                      const clamped = Number.isFinite(raw)
                                        ? Math.min(12, Math.max(1, raw))
                                        : 1;
                                      setShiftDrafts(prev => ({
                                        ...prev,
                                        [deal.id]: {
                                          ...draft,
                                          hours: clamped
                                        }
                                      }));
                                    }}
                                    className="w-full px-1.5 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-[11px] tabular-nums"
                                  />
                                </div>
                              </div>

                              <div>
                                <div className="text-[10px] text-slate-400 mb-0.5">
                                  Смена в сутках (до 2 смен/сут):
                                </div>
                                <div className="grid grid-cols-2 gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShiftDrafts(prev => ({
                                        ...prev,
                                        [deal.id]: { ...draft, shiftSlot: 1 }
                                      }))
                                    }
                                    className={`py-1 px-1.5 rounded border text-[10px] font-semibold cursor-pointer transition ${
                                      draft.shiftSlot === 1
                                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                    }`}
                                  >
                                    1-я смена {slot1Closed ? '✓' : ''}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShiftDrafts(prev => ({
                                        ...prev,
                                        [deal.id]: { ...draft, shiftSlot: 2 }
                                      }))
                                    }
                                    className={`py-1 px-1.5 rounded border text-[10px] font-semibold cursor-pointer transition ${
                                      draft.shiftSlot === 2
                                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/50'
                                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                                    }`}
                                  >
                                    2-я смена {slot2Closed ? '✓' : ''}
                                  </button>
                                </div>
                              </div>

                              {logs.length > 0 && (
                                <div className="pt-1 border-t border-slate-800 space-y-0.5 font-mono text-[10px] text-slate-300">
                                  {logs.slice(-2).map(log => (
                                    <div
                                      key={log.id}
                                      className="flex items-center justify-between"
                                    >
                                      <span>
                                        {log.date} · Смена {log.shiftSlot}
                                      </span>
                                      <span className="text-emerald-400 font-semibold">
                                        {log.hours} ч
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {bothDaySlotsTaken && (
                              <div className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded px-2 py-1">
                                За {draft.date} уже закрыты 2 смены (максимум в сутки).
                              </div>
                            )}

                            <div className="flex flex-col gap-1">
                              {onCloseDealShift && (
                                <button
                                  type="button"
                                  disabled={selectedSlotTaken || deal.stage === 'completed'}
                                  onClick={() =>
                                    onCloseDealShift(deal.id, {
                                      date: draft.date,
                                      shiftSlot: draft.shiftSlot,
                                      hours: draft.hours
                                    })
                                  }
                                  className={`w-full py-1.5 px-2 rounded text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                                    selectedSlotTaken || deal.stage === 'completed'
                                      ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                                      : 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border-teal-500/40 cursor-pointer'
                                  }`}
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>
                                    {selectedSlotTaken
                                      ? `${draft.shiftSlot}-я смена за дату закрыта`
                                      : `Закрыть ${draft.shiftSlot}-ю смену (${draft.hours} ч)`}
                                  </span>
                                </button>
                              )}

                              {onCloseShiftForDeal && (
                                <button
                                  type="button"
                                  onClick={() => onCloseShiftForDeal(deal.id)}
                                  className="w-full py-1 px-2 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-[10px] font-medium cursor-pointer transition"
                                >
                                  Открыть модерацию ЭСМ-7 в Fleet Manager
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      }

                      // Column 5: Закрытие объёма (предварительный расчёт -> факт -> Акт / КС-2 / КС-3)
                      if (col.id === 'close_volume') {
                        const shiftTotalHours =
                          deal.closedShiftHoursTotal ??
                          (deal.shiftLogs || []).reduce((acc, s) => acc + s.hours, 0);
                        const plannedHours = deal.hoursRequested;
                        const plannedAmount = Math.round(
                          plannedHours * deal.hourlyRateAgreed
                        );
                        const defaultFactHours =
                          deal.closedVolumeHours ??
                          (shiftTotalHours > 0 ? shiftTotalHours : plannedHours);
                        const factHours =
                          volumeDrafts[deal.id] !== undefined
                            ? volumeDrafts[deal.id]
                            : defaultFactHours;
                        const factAmount = Math.round(
                          factHours * deal.hourlyRateAgreed
                        );
                        const deltaHours = Number(
                          (factHours - plannedHours).toFixed(1)
                        );
                        const isVolumeFixed = Boolean(
                          deal.actSigned || actSaved || ks2Saved || ks3Saved
                        );

                        return (
                          <div
                            key={deal.id}
                            className="p-2.5 bg-slate-950/90 rounded-lg border border-slate-800 hover:border-slate-700 transition space-y-2 text-xs"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <h4 className="font-bold text-white text-[13px] truncate">
                                  {deal.clientName}
                                </h4>
                                <span
                                  className={`text-[11px] font-medium ${
                                    isVolumeFixed
                                      ? 'text-emerald-400'
                                      : 'text-amber-300'
                                  }`}
                                >
                                  {isVolumeFixed
                                    ? 'Объём зафиксирован документально'
                                    : 'Ожидает фиксации факта'}
                                </span>
                              </div>
                            </div>

                            {/* Расчёт объёма: Предварительный vs Фактический */}
                            <div className="p-2 rounded bg-slate-900 border border-slate-800/90 space-y-1.5 font-mono tabular-nums text-[11px]">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-slate-400 font-sans">
                                  Предварит. расчёт:
                                </span>
                                <span className="text-slate-200">
                                  {plannedHours} м/ч ·{' '}
                                  {plannedAmount.toLocaleString('ru-RU')} ₽
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
                                <label className="text-slate-300 font-sans flex items-center gap-1 shrink-0">
                                  <Calculator className="w-3 h-3 text-indigo-400" />
                                  <span>Факт (м/ч):</span>
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={factHours}
                                  onChange={e =>
                                    setVolumeDrafts(prev => ({
                                      ...prev,
                                      [deal.id]: Math.max(
                                        0,
                                        parseFloat(e.target.value) || 0
                                      )
                                    }))
                                  }
                                  className="w-20 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-white text-right font-mono"
                                />
                              </div>

                              {shiftTotalHours > 0 && factHours !== shiftTotalHours && (
                                <div className="flex justify-end">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setVolumeDrafts(prev => ({
                                        ...prev,
                                        [deal.id]: shiftTotalHours
                                      }))
                                    }
                                    className="text-[10px] font-sans text-teal-300 hover:text-teal-200 underline cursor-pointer"
                                  >
                                    Подставить из смен ({shiftTotalHours} ч)
                                  </button>
                                </div>
                              )}

                              <div className="flex items-center justify-between gap-1">
                                <span className="text-slate-400 font-sans">
                                  Факт сумма:
                                </span>
                                <span className="text-amber-300 font-bold">
                                  {factAmount.toLocaleString('ru-RU')} ₽
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-1 text-[10px]">
                                <span className="text-slate-500 font-sans">
                                  Отклонение от расчёта:
                                </span>
                                <span
                                  className={
                                    deltaHours === 0
                                      ? 'text-slate-400'
                                      : deltaHours > 0
                                      ? 'text-emerald-400'
                                      : 'text-amber-300'
                                  }
                                >
                                  {deltaHours > 0 ? `+${deltaHours}` : deltaHours} м/ч
                                </span>
                              </div>
                            </div>

                            {/* Документальная фиксация Акт / КС-2 / КС-3 */}
                            <div className="p-2 rounded bg-slate-900 border border-slate-800/80 space-y-1.5 text-[10px]">
                              <div className="flex items-center justify-between font-mono">
                                <span className="text-slate-400 font-sans text-[11px]">
                                  Документы объёма:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={
                                      actSaved ? 'text-emerald-400' : 'text-slate-500'
                                    }
                                  >
                                    Акт {actSaved ? '✓' : '—'}
                                  </span>
                                  <span
                                    className={
                                      ks2Saved ? 'text-emerald-400' : 'text-slate-500'
                                    }
                                  >
                                    КС-2 {ks2Saved ? '✓' : '—'}
                                  </span>
                                  <span
                                    className={
                                      ks3Saved ? 'text-emerald-400' : 'text-slate-500'
                                    }
                                  >
                                    КС-3 {ks3Saved ? '✓' : '—'}
                                  </span>
                                </div>
                              </div>

                              <div className="grid grid-cols-3 gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenClosingModal({
                                      sourceType: 'deal',
                                      deal: {
                                        ...deal,
                                        closedVolumeHours: factHours
                                      },
                                      initialTab: 'act_services'
                                    })
                                  }
                                  className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-white font-semibold border border-slate-700 cursor-pointer"
                                >
                                  Акт
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenClosingModal({
                                      sourceType: 'deal',
                                      deal: {
                                        ...deal,
                                        closedVolumeHours: factHours
                                      },
                                      initialTab: 'ks2'
                                    })
                                  }
                                  className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold border border-slate-700 cursor-pointer"
                                >
                                  КС-2
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenClosingModal({
                                      sourceType: 'deal',
                                      deal: {
                                        ...deal,
                                        closedVolumeHours: factHours
                                      },
                                      initialTab: 'ks3'
                                    })
                                  }
                                  className="py-1 px-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 font-semibold border border-slate-700 cursor-pointer"
                                >
                                  КС-3
                                </button>
                              </div>
                            </div>

                            {onCloseDealVolume && (
                              <button
                                type="button"
                                onClick={() => onCloseDealVolume(deal.id, factHours)}
                                className="w-full py-1.5 px-2 rounded bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/40 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition"
                              >
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                <span>
                                  {isVolumeFixed
                                    ? 'Обновить факт (Акт / КС-2 / КС-3)'
                                    : 'Зафиксировать объём (Акт / КС-2 / КС-3)'}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      }

                      // Column 6: Акт, Счёт · Завершение (только без задолженности)
                      if (col.id === 'act_invoice') {
                        const hasDocumentedVolume = Boolean(
                          deal.actSigned || actSaved || ks2Saved || ks3Saved
                        );
                        const hasNoDebt = deal.debtAmount <= 0;
                        const canComplete =
                          deal.stage !== 'completed' &&
                          hasDocumentedVolume &&
                          hasNoDebt;
                        const actStatusLabel = deal.actSigned
                          ? 'Подписан'
                          : actSaved
                          ? 'В базе'
                          : 'Не оформлен';

                        const blockReason = !hasDocumentedVolume
                          ? 'Сначала зафиксируйте объём (Акт / КС-2 / КС-3)'
                          : !hasNoDebt
                          ? `Есть задолженность: ${deal.debtAmount.toLocaleString('ru-RU')} ₽`
                          : '';

                        return (
                          <div
                            key={deal.id}
                            className="p-2.5 bg-slate-950/90 rounded-lg border border-slate-800 hover:border-slate-700 transition space-y-2 text-xs"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
                                <h4 className="font-bold text-white text-[13px] truncate">
                                  {deal.clientName}
                                </h4>
                                <div className="font-mono text-[11px] text-amber-300 tabular-nums mt-0.5">
                                  {deal.estimatedAmount.toLocaleString('ru-RU')} ₽ ·{' '}
                                  {deal.closedVolumeHours ?? deal.hoursRequested} м/ч
                                </div>
                              </div>
                              {deal.stage === 'completed' && hasNoDebt ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono text-[10px] font-bold shrink-0">
                                  Завершено
                                </span>
                              ) : deal.debtAmount > 0 ? (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[10px] font-bold shrink-0">
                                  Долг
                                </span>
                              ) : null}
                            </div>

                            {/* Статус акта, КС-2/КС-3 и счёта */}
                            <div className="p-2 rounded bg-slate-900 border border-slate-800/80 space-y-1.5 text-[11px]">
                              <div className="flex items-center justify-between gap-1">
                                <span className="text-slate-400">Статус акта:</span>
                                <span
                                  className={`font-semibold ${
                                    deal.actSigned || actSaved
                                      ? 'text-emerald-400'
                                      : 'text-amber-300'
                                  }`}
                                >
                                  {actStatusLabel}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-1 font-mono text-[10px]">
                                <span className="text-slate-400 font-sans text-[11px]">
                                  В базе:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={
                                      actSaved ? 'text-emerald-400' : 'text-slate-500'
                                    }
                                  >
                                    Акт {actSaved ? '✓' : '—'}
                                  </span>
                                  <span
                                    className={
                                      ks2Saved ? 'text-emerald-400' : 'text-slate-500'
                                    }
                                  >
                                    КС-2 {ks2Saved ? '✓' : '—'}
                                  </span>
                                  <span
                                    className={
                                      ks3Saved ? 'text-emerald-400' : 'text-slate-500'
                                    }
                                  >
                                    КС-3 {ks3Saved ? '✓' : '—'}
                                  </span>
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-1.5 pt-0.5">
                                <span className="text-slate-400 shrink-0">
                                  Статус счёта:
                                </span>
                                <select
                                  value={invStatus}
                                  onChange={e => {
                                    const nextSt = e.target.value as InvoiceStatus;
                                    const total = deal.estimatedAmount || 0;
                                    const nextPaid =
                                      nextSt === 'paid'
                                        ? total
                                        : nextSt === 'not_issued'
                                        ? 0
                                        : deal.paidAmount ??
                                          Math.max(0, total - (deal.debtAmount || 0));
                                    onUpdateInvoiceStatus(
                                      'deal',
                                      deal.id,
                                      nextSt,
                                      nextPaid
                                    );
                                  }}
                                  aria-label="Статус счёта за услуги"
                                  className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer bg-slate-950 ${invMeta.badgeClass}`}
                                >
                                  <option value="not_issued">Не выставлен</option>
                                  <option value="issued">Выставлен</option>
                                  <option value="partially_paid">Частично</option>
                                  <option value="paid">Оплачен</option>
                                  <option value="overdue">Просрочен</option>
                                </select>
                              </div>
                              {deal.debtAmount > 0 && (
                                <div className="flex items-center justify-between text-[10px] font-mono text-rose-400 pt-0.5">
                                  <span className="font-sans">Задолженность:</span>
                                  <span>{deal.debtAmount.toLocaleString('ru-RU')} ₽</span>
                                </div>
                              )}
                            </div>

                            {/* Кнопки: Акт / КС-2, КС-2, КС-3, Счёт */}
                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenClosingModal({
                                    sourceType: 'deal',
                                    deal,
                                    initialTab: 'act_services'
                                  })
                                }
                                className="py-1.5 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-semibold border border-slate-700 flex items-center justify-center gap-1 cursor-pointer transition whitespace-nowrap"
                              >
                                <FileSpreadsheet className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>Акт / КС-2</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  onOpenClosingModal({
                                    sourceType: 'deal',
                                    deal,
                                    initialTab: 'ks2'
                                  })
                                }
                                className="py-1.5 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold border border-slate-700 flex items-center justify-center gap-1 cursor-pointer transition whitespace-nowrap"
                              >
                                <FileSpreadsheet className="w-3 h-3 text-sky-400 shrink-0" />
                                <span>КС-2</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  onOpenClosingModal({
                                    sourceType: 'deal',
                                    deal,
                                    initialTab: 'ks3'
                                  })
                                }
                                className="py-1.5 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-semibold border border-slate-700 flex items-center justify-center gap-1 cursor-pointer transition whitespace-nowrap"
                              >
                                <FileSpreadsheet className="w-3 h-3 text-indigo-400 shrink-0" />
                                <span>КС-3</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  onOpenClosingModal({
                                    sourceType: 'deal',
                                    deal,
                                    initialTab: 'invoice'
                                  })
                                }
                                className="py-1.5 px-1.5 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[10px] font-semibold border border-sky-500/30 flex items-center justify-center gap-1 cursor-pointer transition whitespace-nowrap"
                              >
                                <Receipt className="w-3 h-3 shrink-0" />
                                <span>Счёт</span>
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() => handleQuickPrintDeal(deal, 'ks3')}
                                className="py-1 px-1.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-300 text-[10px] font-medium border border-slate-800 flex items-center justify-center gap-1 cursor-pointer transition"
                              >
                                <Printer className="w-3 h-3 text-sky-400" />
                                <span>Печать КС-3</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleQuickSaveDealClosingPack(deal)}
                                className="py-1 px-1.5 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[10px] font-semibold border border-indigo-500/30 flex items-center justify-center gap-1 cursor-pointer transition"
                              >
                                <Database className="w-3 h-3" />
                                <span>В базу</span>
                              </button>
                            </div>

                            {/* Передача в колонку 7 «Завершено» (только при 0 долге и зафиксированном объёме) */}
                            {deal.stage === 'completed' && hasNoDebt ? (
                              <div className="w-full py-1.5 px-2 rounded bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[11px] font-bold flex items-center justify-center gap-1.5">
                                <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                                <span>Статус: Завершено (долг 0 ₽)</span>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  disabled={!canComplete}
                                  onClick={() =>
                                    canComplete && onMoveDealStage(deal.id, 'completed')
                                  }
                                  className={`w-full py-1.5 px-2 rounded text-[11px] font-bold flex items-center justify-center gap-1.5 border transition ${
                                    canComplete
                                      ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950 border-emerald-400 cursor-pointer'
                                      : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                                  }`}
                                >
                                  {canComplete ? (
                                    <CheckCircle className="w-3.5 h-3.5" />
                                  ) : (
                                    <Lock className="w-3 h-3 text-rose-400 shrink-0" />
                                  )}
                                  <span>Перевести в «Завершено»</span>
                                </button>
                                {!canComplete && blockReason && (
                                  <div className="flex items-start gap-1 text-[10px] text-amber-300/90 leading-tight">
                                    <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5 text-amber-400" />
                                    <span>{blockReason}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Column 7: Завершено (статус «Завершено» 2 суток без долга, либо «Задолженность»)
                      if (col.id === 'completed') {
                        const hasDocumentedVolume = Boolean(
                          deal.actSigned || actSaved || ks2Saved || ks3Saved
                        );
                        const isCompletedStatus =
                          deal.stage === 'completed' && deal.debtAmount <= 0;
                        const { remainingLabel, archiveAtLabel } =
                          formatRetentionCountdown(deal.completedAt, nowMs);

                        return (
                          <div
                            key={deal.id}
                            className={`p-2.5 bg-slate-950/90 rounded-lg border transition space-y-2 text-xs ${
                              isCompletedStatus
                                ? 'border-emerald-500/40 hover:border-emerald-500/60'
                                : 'border-rose-500/40 hover:border-rose-500/60'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0">
                                <h4 className="font-bold text-white text-[13px] truncate">
                                  {deal.clientName}
                                </h4>
                                <div className="text-[11px] text-slate-400 truncate">
                                  {deal.siteAddress}
                                </div>
                              </div>
                              {isCompletedStatus ? (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono text-[10px] font-bold shrink-0">
                                  Завершено
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono text-[10px] font-bold shrink-0">
                                  Задолженность
                                </span>
                              )}
                            </div>

                            <div className="p-2 rounded bg-slate-900 border border-slate-800/80 space-y-1 font-mono tabular-nums text-[11px]">
                              <div className="flex items-center justify-between">
                                <span className="text-slate-400 font-sans">Сумма / объём:</span>
                                <span className="text-amber-300 font-bold">
                                  {deal.estimatedAmount.toLocaleString('ru-RU')} ₽ ·{' '}
                                  {deal.closedVolumeHours ?? deal.hoursRequested} м/ч
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-slate-400 font-sans">Документы:</span>
                                <div className="flex items-center gap-1.5">
                                  <span className={actSaved || deal.actSigned ? 'text-emerald-400' : 'text-slate-500'}>
                                    Акт {actSaved || deal.actSigned ? '✓' : '—'}
                                  </span>
                                  <span className={ks2Saved ? 'text-emerald-400' : 'text-slate-500'}>
                                    КС-2 {ks2Saved ? '✓' : '—'}
                                  </span>
                                  <span className={ks3Saved ? 'text-emerald-400' : 'text-slate-500'}>
                                    КС-3 {ks3Saved ? '✓' : '—'}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {isCompletedStatus ? (
                              <div className="p-2 rounded bg-emerald-500/10 border border-emerald-500/30 space-y-1 text-[10px]">
                                <div className="flex items-center justify-between text-emerald-300 font-semibold">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                                    Задолженности нет (0 ₽)
                                  </span>
                                  <span className="font-mono">{remainingLabel}</span>
                                </div>
                                <div className="text-slate-300 leading-tight">
                                  Хранится 2 суток · удаление в архив на 3-и сутки:{' '}
                                  <span className="font-mono text-emerald-200">{archiveAtLabel}</span>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <div className="p-2 rounded bg-rose-500/10 border border-rose-500/30 space-y-1 text-[10px]">
                                  <div className="flex items-center justify-between font-mono text-rose-300 font-bold">
                                    <span className="font-sans">Долг по сделке:</span>
                                    <span>-{deal.debtAmount.toLocaleString('ru-RU')} ₽</span>
                                  </div>
                                  <div className="text-rose-200/90 leading-tight">
                                    Статус «Завершено» недоступен до полного погашения задолженности.
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-1.5 text-[10px]">
                                  <span className="text-slate-400 shrink-0">Оплата счёта:</span>
                                  <select
                                    value={invStatus}
                                    onChange={e => {
                                      const nextSt = e.target.value as InvoiceStatus;
                                      const total = deal.estimatedAmount || 0;
                                      const nextPaid =
                                        nextSt === 'paid'
                                          ? total
                                          : nextSt === 'not_issued'
                                          ? 0
                                          : deal.paidAmount ??
                                            Math.max(0, total - (deal.debtAmount || 0));
                                      onUpdateInvoiceStatus(
                                        'deal',
                                        deal.id,
                                        nextSt,
                                        nextPaid
                                      );
                                      if (nextSt === 'paid' && hasDocumentedVolume) {
                                        onMoveDealStage(deal.id, 'completed');
                                      }
                                    }}
                                    aria-label="Статус оплаты задолженности"
                                    className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold cursor-pointer bg-slate-950 ${invMeta.badgeClass}`}
                                  >
                                    <option value="not_issued">Не выставлен</option>
                                    <option value="issued">Выставлен</option>
                                    <option value="partially_paid">Частично</option>
                                    <option value="paid">Оплачен</option>
                                    <option value="overdue">Просрочен</option>
                                  </select>
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-1">
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenClosingModal({
                                    sourceType: 'deal',
                                    deal,
                                    initialTab: 'act_services'
                                  })
                                }
                                className="py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] font-semibold border border-slate-700 flex items-center justify-center gap-1 cursor-pointer transition"
                              >
                                <FileSpreadsheet className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>Акт / КС</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenClosingModal({
                                    sourceType: 'deal',
                                    deal,
                                    initialTab: 'invoice'
                                  })
                                }
                                className="py-1 px-1.5 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[10px] font-semibold border border-sky-500/30 flex items-center justify-center gap-1 cursor-pointer transition"
                              >
                                <Receipt className="w-3 h-3 shrink-0" />
                                <span>Счёт</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      // Columns 1–3: Stage pipeline cards
                      const nextStageMap: Partial<Record<CRMStage, CRMStage>> = {
                        lead: 'calculation',
                        calculation: 'contract',
                        contract: 'active'
                      };
                      const nextStage = nextStageMap[deal.stage];
                      const nextButtonLabel =
                        deal.stage === 'lead'
                          ? 'В согласование (Смета)'
                          : deal.stage === 'calculation'
                          ? 'Перевести в «Договор»'
                          : deal.stage === 'contract'
                          ? 'Выпустить технику на объект'
                          : null;

                      return (
                        <div
                          key={deal.id}
                          className="p-2.5 bg-slate-950/90 rounded-lg border border-slate-800 hover:border-slate-700 transition shadow-sm space-y-1.5 text-[14px]"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <div>
                              <h4 className="font-bold text-white text-[14px]">
                                {deal.clientName}
                              </h4>
                              <span className="text-xs text-slate-400 font-mono">
                                {deal.contactPerson}
                              </span>
                            </div>
                            {deal.debtAmount > 0 && (
                              <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 font-mono text-[11px] font-bold">
                                Долг
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {col.id === 'order_approval' && (
                              <span
                                className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${
                                  deal.stage === 'calculation'
                                    ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                                    : 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                                }`}
                              >
                                {deal.stage === 'calculation'
                                  ? 'Смета'
                                  : 'Договор'}
                              </span>
                            )}
                            {!activeBranch && (
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300 font-mono text-[11px] font-bold">
                                {branches.find(b => b.id === deal.branchId)
                                  ?.code || deal.branchId}
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold border ${
                                deal.accountingSubject === 'ip_specialtechnica'
                                  ? 'bg-sky-500/10 text-sky-300 border-sky-500/30'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                              }`}
                            >
                              {deal.accountingSubject === 'ip_specialtechnica'
                                ? 'ИП SpecialTechnica'
                                : 'ООО SpecialTech'}
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px] font-mono">
                              {deal.hasContract === false
                                ? 'Без договора (ФЛ)'
                                : 'По договору'}
                            </span>
                          </div>

                          <div className="text-[13px] text-slate-300 space-y-1">
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <Phone className="w-3 h-3 text-slate-500" />
                              <span className="font-mono text-xs">{deal.phone}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-400">
                              <MapPin className="w-3 h-3 text-amber-500 shrink-0" />
                              <span className="truncate text-xs">
                                {deal.siteAddress}
                              </span>
                            </div>
                            {renderDriverLine(deal)}
                          </div>

                          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[13px]">
                            <span className="text-slate-400">
                              {deal.closedVolumeHours ?? deal.hoursRequested} ч
                              {deal.shiftsRequested
                                ? ` (${deal.shiftsRequested} см.)`
                                : ''}{' '}
                              × {deal.hourlyRateAgreed} ₽
                            </span>
                            <span className="font-mono font-bold text-amber-400">
                              {deal.estimatedAmount.toLocaleString('ru-RU')} ₽
                            </span>
                          </div>

                          {deal.debtAmount > 0 && (
                            <div className="text-xs text-rose-400 bg-rose-500/10 px-2 py-1 rounded border border-rose-500/20 font-mono">
                              Задолженность: -{deal.debtAmount.toLocaleString('ru-RU')} ₽
                            </div>
                          )}

                          {/* Next Stage Advance Button (for Lead & Order Approval) */}
                          {nextStage && nextButtonLabel && (
                            <button
                              type="button"
                              onClick={() => onMoveDealStage(deal.id, nextStage)}
                              className="w-full mt-1 py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition cursor-pointer flex items-center justify-center gap-1"
                            >
                              <span>{nextButtonLabel}</span>
                              <ArrowRight className="w-3 h-3 text-amber-400" />
                            </button>
                          )}

                          {col.id === 'active' && (
                            <div className="pt-1 text-[11px] text-emerald-300/90 flex items-center justify-between gap-1">
                              <span>В работе на объекте</span>
                              <span className="text-slate-400 font-mono">
                                Смены → кол. 4 · Объём → кол. 5
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* CRM Archive Modal (deals moved out of CRM column on the 3rd day after Завершено) */}
      {isArchiveOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Архив завершённых сделок CRM
                  </h3>
                  <p className="text-xs text-slate-400">
                    Карточки со статусом «Завершено» хранятся в колонке 2 суток и переносятся сюда на 3-и сутки
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2 flex-1">
              {archivedCrmDeals.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-400">
                  В архиве пока нет сделок. После получения статуса «Завершено» карточка остаётся в CRM двое суток и переносится в архив на третьи сутки.
                </div>
              ) : (
                archivedCrmDeals.map(deal => (
                  <div
                    key={deal.id}
                    className="p-3 rounded-lg bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-sm">
                          {deal.clientName}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                          В архиве
                        </span>
                      </div>
                      <div className="text-slate-400 truncate">
                        {deal.siteAddress} · {deal.contactPerson} ({deal.phone})
                      </div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        Завершено: {formatDateTimeShort(deal.completedAt)} · В архиве с:{' '}
                        {formatDateTimeShort(deal.archivedAt)}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono tabular-nums">
                        <div className="text-amber-300 font-bold">
                          {deal.estimatedAmount.toLocaleString('ru-RU')} ₽
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {deal.closedVolumeHours ?? deal.hoursRequested} м/ч
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onOpenClosingModal({
                            sourceType: 'deal',
                            deal,
                            initialTab: 'act_services'
                          })
                        }
                        className="px-2.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer transition"
                      >
                        Документы
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
