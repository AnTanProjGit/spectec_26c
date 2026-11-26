import React, { useState } from 'react';
import {
  MapPin,
  Clock,
  CheckCircle,
  FileText,
  Printer,
  Database,
  Receipt,
  Bell,
  FileSpreadsheet
} from 'lucide-react';
import {
  ClosingDocKind,
  ClosingDocumentRecord,
  Equipment,
  FleetBranch,
  InvoiceStatus,
  OneCIntegrationConfig,
  RentalOrder
} from '../../types';
import {
  INVOICE_STATUS_META,
  calculateVatRub,
  generateClosingDocHtml,
  generateClosingDocPlainText,
  getActServicesPrefix,
  getKs2Prefix,
  printClosingDocumentHtml,
  resolveAccountingSubjectForOrder,
  resolveOrderInvoiceStatus
} from '../../utils/closingDocuments';
import { ClosingModalTarget } from '../ClosingDocsModal';

interface RentalsViewProps {
  orders: RentalOrder[];
  equipmentList: Equipment[];
  activeBranch?: FleetBranch | null;
  branches?: FleetBranch[];
  oneCConfig: OneCIntegrationConfig;
  savedClosingDocs: ClosingDocumentRecord[];
  unreadNotificationsCount: number;
  onToggleActSigned: (orderId: string) => void;
  onOpenDealModal: () => void;
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

export const RentalsView: React.FC<RentalsViewProps> = ({
  orders,
  equipmentList,
  activeBranch,
  branches = [],
  oneCConfig,
  savedClosingDocs,
  unreadNotificationsCount,
  onToggleActSigned,
  onOpenDealModal,
  onOpenClosingModal,
  onQuickSaveClosingDoc,
  onUpdateInvoiceStatus,
  onOpenNotificationSettings
}) => {
  const [filterState, setFilterState] = useState<
    'all' | 'active' | 'act_pending' | 'has_debt'
  >('all');

  const filteredOrders = orders.filter(order => {
    if (filterState === 'active') return order.status === 'active';
    if (filterState === 'act_pending') return !order.actSigned;
    if (filterState === 'has_debt') return order.totalAmount - order.paidAmount > 0;
    return true;
  });

  const totalContractVolume = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalPaid = orders.reduce((sum, o) => sum + o.paidAmount, 0);
  const totalUnpaid = totalContractVolume - totalPaid;
  const pendingActsCount = orders.filter(o => !o.actSigned).length;
  const collectionRate =
    totalContractVolume > 0
      ? Math.round((totalPaid / totalContractVolume) * 100)
      : 0;

  const buildOrderQuickDoc = (
    order: RentalOrder,
    kind: ClosingDocKind
  ): { doc: ClosingDocumentRecord; branch: FleetBranch | null } => {
    const branch =
      branches.find(b => b.id === order.branchId) || activeBranch || null;
    const eq = equipmentList.find(e => e.id === order.equipmentId);
    const branchCode = branch?.code || 'МСК';
    const tail =
      order.orderNumber.split('-').pop() || order.id.replace(/\D/g, '') || '101';
    const actPrefix = getActServicesPrefix(branch);
    const ks2Prefix = getKs2Prefix(branch);
    const subject = resolveAccountingSubjectForOrder(order);
    const qty = order.closedVolumeHours ?? order.actualHours;
    const total = Math.round(qty * order.hourlyRate);
    const number =
      kind === 'ks2'
        ? order.ks2Number || `${ks2Prefix}${tail}`
        : kind === 'invoice'
        ? order.invoiceNumber || `СЧ-${branchCode}-${tail}`
        : order.actNumber || `${actPrefix}${tail}`;

    const base: ClosingDocumentRecord = {
      id: `cdoc-order-${order.id}-${kind}`,
      kind,
      number,
      date: getTodayIso(),
      periodStart: order.startDate,
      periodEnd: order.endDate,
      branchId: order.branchId,
      sourceType: 'order',
      sourceId: order.id,
      orderOrDealNumber: order.orderNumber,
      clientName: order.clientName,
      siteAddress: order.siteAddress,
      equipmentName: eq
        ? `[${eq.inventoryNumber}] ${eq.name} (${eq.plateNumber})`
        : 'Спецтехника по договору',
      operatorName: order.operatorName,
      workDescription: `Услуги спецтехники с экипажем на объекте (${
        eq ? `[${eq.inventoryNumber}] ${eq.name}` : 'Спецтехника'
      })`,
      unitLabel: 'маш.-час',
      quantity: qty,
      rateRub: order.hourlyRate,
      totalAmountRub: total,
      vatAmountRub: calculateVatRub(total, subject),
      accountingSubject: subject,
      savedToBase: true,
      savedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      invoiceStatus:
        kind === 'invoice' ? resolveOrderInvoiceStatus(order) : undefined,
      paidAmountRub: kind === 'invoice' ? order.paidAmount : undefined,
      contentText: ''
    };
    base.contentText = generateClosingDocPlainText(base, branch, oneCConfig);
    return { doc: base, branch };
  };

  const handleQuickPrint = (order: RentalOrder, kind: ClosingDocKind) => {
    const { doc, branch } = buildOrderQuickDoc(order, kind);
    const html = generateClosingDocHtml(doc, branch, oneCConfig);
    printClosingDocumentHtml(html);
  };

  const handleQuickSaveActAndKs2 = (order: RentalOrder) => {
    const { doc: actDoc } = buildOrderQuickDoc(order, 'act_services');
    const { doc: ks2Doc } = buildOrderQuickDoc(order, 'ks2');
    onQuickSaveClosingDoc(actDoc);
    onQuickSaveClosingDoc(ks2Doc);
  };

  return (
    <div className="p-2.5 space-y-2 max-w-7xl mx-auto">
      {/* Header and Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {activeBranch
              ? `Аренда и объекты: ${activeBranch.name}`
              : 'Аренда и диспетчеризация объектов'}
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            {activeBranch
              ? `Поток документов: ${activeBranch.documentFlow.orderPrefix} / ${activeBranch.documentFlow.actPrefix} · Fleet Manager: ${activeBranch.fleetManagerName}`
              : 'Реестр действующих договоров аренды спецтехники с экипажем, актов КС-2 и счетов'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            <FileText className="w-4 h-4" />
            <span>Сформировать заказ / договор</span>
          </button>
        </div>
      </div>

      {/* 4 Financial & Operational Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Общий объём контрактов</span>
          <span className="text-xl font-bold text-white num-mono">
            {(totalContractVolume / 1_000_000).toFixed(2)} млн ₽
          </span>
          <span className="text-xs text-slate-500 block mt-0.5">
            {orders.length} действующих договоров
          </span>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Фактически оплачено</span>
          <span className="text-xl font-bold text-emerald-400 num-mono">
            {(totalPaid / 1_000_000).toFixed(2)} млн ₽
          </span>
          <span className="text-xs text-emerald-500 block mt-0.5">
            {collectionRate}% сбор денежных средств
          </span>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Дебиторская задолженность</span>
          <span className="text-xl font-bold text-rose-400 num-mono">
            {(totalUnpaid / 1_000_000).toFixed(2)} млн ₽
          </span>
          <span className="text-xs text-rose-500 block mt-0.5">
            Остаток к оплате по счетам
          </span>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Акты КС-2 на согласовании</span>
          <span className="text-xl font-bold text-amber-400 num-mono">
            {pendingActsCount} шт
          </span>
          <span className="text-xs text-amber-500 block mt-0.5">
            Требуют подписи у заказчика
          </span>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-1.5">
        <button
          onClick={() => setFilterState('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            filterState === 'all'
              ? 'bg-slate-800 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Все договоры ({orders.length})
        </button>
        <button
          onClick={() => setFilterState('active')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            filterState === 'active'
              ? 'bg-slate-800 text-white font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          В работе на объектах
        </button>
        <button
          onClick={() => setFilterState('act_pending')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            filterState === 'act_pending'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Не подписан Акт ({pendingActsCount})
        </button>
        <button
          onClick={() => setFilterState('has_debt')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
            filterState === 'has_debt'
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          С задолженностью
        </button>
      </div>

      {/* Orders Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-[13px]">
            <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/60 border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Договор / Заказчик</th>
                <th className="py-3 px-3">Техника и объект</th>
                <th className="py-3 px-3 text-right">Объём (ч)</th>
                <th className="py-3 px-3 text-right">Сумма / Оплата</th>
                <th className="py-3 px-3 text-center">Акт и КС-2</th>
                <th className="py-3 px-3 text-center">Счёт на оплату</th>
                <th className="py-3 px-3 text-right">Формы, печать и действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filteredOrders.map(order => {
                const assignedEq = equipmentList.find(
                  e => e.id === order.equipmentId
                );
                const debt = order.totalAmount - order.paidAmount;
                const invStatus = resolveOrderInvoiceStatus(order);
                const invMeta = INVOICE_STATUS_META[invStatus];

                const actSaved =
                  Boolean(order.actSavedToBase) ||
                  savedClosingDocs.some(
                    d =>
                      d.sourceType === 'order' &&
                      d.sourceId === order.id &&
                      d.kind === 'act_services' &&
                      d.savedToBase
                  );
                const ks2Saved =
                  Boolean(order.ks2SavedToBase) ||
                  savedClosingDocs.some(
                    d =>
                      d.sourceType === 'order' &&
                      d.sourceId === order.id &&
                      d.kind === 'ks2' &&
                      d.savedToBase
                  );
                const invSaved =
                  Boolean(order.invoiceSavedToBase) ||
                  savedClosingDocs.some(
                    d =>
                      d.sourceType === 'order' &&
                      d.sourceId === order.id &&
                      d.kind === 'invoice' &&
                      d.savedToBase
                  );

                return (
                  <tr key={order.id} className="hover:bg-slate-800/40 transition">
                    <td className="py-3 px-3 align-top">
                      <div className="flex items-center gap-1.5">
                        {!activeBranch && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-[11px] font-bold">
                            {branches.find(b => b.id === order.branchId)?.code ||
                              order.branchId}
                          </span>
                        )}
                        <span className="font-mono text-amber-400 font-bold text-xs">
                          {order.orderNumber}
                        </span>
                      </div>
                      <div className="text-white font-semibold mt-0.5">
                        {order.clientName}
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {order.startDate} — {order.endDate}
                      </span>
                    </td>

                    <td className="py-3 px-3 align-top max-w-[230px]">
                      <div className="font-mono text-xs text-slate-200 font-medium">
                        {assignedEq
                          ? `[${assignedEq.inventoryNumber}] ${assignedEq.name}`
                          : 'Техника не назначена'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Машинист: {order.operatorName}
                      </div>
                      <div className="flex items-start gap-1 text-slate-400 mt-1">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                        <span className="text-[11px] leading-tight">
                          {order.siteAddress}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right align-top">
                      <span className="font-mono font-bold text-white">
                        {order.closedVolumeHours ?? order.actualHours}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {' '}
                        / {order.plannedHours} ч
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        {order.hourlyRate.toLocaleString()} ₽/ч
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right align-top">
                      <div className="font-mono font-bold text-white">
                        {order.totalAmount.toLocaleString()} ₽
                      </div>
                      <div className="font-mono text-xs text-emerald-400">
                        Оплачено: {order.paidAmount.toLocaleString()} ₽
                      </div>
                      {debt > 0 && (
                        <span className="block text-[11px] font-mono text-rose-400 font-bold">
                          Долг: -{debt.toLocaleString()} ₽
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-3 text-center align-top">
                      <div className="flex flex-col items-center gap-1">
                        {order.actSigned ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" /> Подписан
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-semibold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                            <Clock className="w-3 h-3" /> Ожидает
                          </span>
                        )}
                        <div className="flex items-center gap-1 text-[10px] font-mono">
                          <span
                            className={`px-1.5 py-0.2 rounded border ${
                              actSaved
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : 'bg-slate-900 text-slate-500 border-slate-800'
                            }`}
                          >
                            Акт {actSaved ? '✓' : '—'}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded border ${
                              ks2Saved
                                ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                                : 'bg-slate-900 text-slate-500 border-slate-800'
                            }`}
                          >
                            КС-2 {ks2Saved ? '✓' : '—'}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-center align-top">
                      <div className="flex flex-col items-center gap-1">
                        <select
                          value={invStatus}
                          onChange={e => {
                            const nextSt = e.target.value as InvoiceStatus;
                            const nextPaid =
                              nextSt === 'paid'
                                ? order.totalAmount
                                : nextSt === 'not_issued'
                                ? 0
                                : order.paidAmount;
                            onUpdateInvoiceStatus(
                              'order',
                              order.id,
                              nextSt,
                              nextPaid
                            );
                          }}
                          className={`px-2 py-0.5 rounded border text-[11px] font-semibold cursor-pointer bg-slate-950 ${invMeta.badgeClass}`}
                        >
                          <option value="not_issued">Не выставлен</option>
                          <option value="issued">Выставлен</option>
                          <option value="partially_paid">Частично</option>
                          <option value="paid">Оплачен</option>
                          <option value="overdue">Просрочен</option>
                        </select>
                        <span className="text-[10px] font-mono text-slate-400">
                          {order.invoiceNumber || 'Без №'}{' '}
                          {invSaved ? '· в базе ✓' : ''}
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right align-top">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenClosingModal({
                              sourceType: 'order',
                              order,
                              initialTab: 'act_services'
                            })
                          }
                          title="Открыть Акт и форму КС-2 (просмотр, печать, сохранение в базу)"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white text-[11px] font-semibold border border-slate-700 cursor-pointer transition"
                        >
                          <FileSpreadsheet className="w-3 h-3 text-amber-400" />
                          <span>Акт / КС-2</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickPrint(order, 'ks2')}
                          title="Быстрая печать формы КС-2 (ОКУД 0322005)"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-semibold border border-slate-700 cursor-pointer transition"
                        >
                          <Printer className="w-3 h-3" />
                          <span>Печать КС-2</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleQuickSaveActAndKs2(order)}
                          title="Сохранить Акт и КС-2 в базу данных"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 text-[11px] font-semibold border border-indigo-500/30 cursor-pointer transition"
                        >
                          <Database className="w-3 h-3" />
                          <span>В базу</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            onOpenClosingModal({
                              sourceType: 'order',
                              order,
                              initialTab: 'invoice'
                            })
                          }
                          title="Выставить / распечатать счёт на оплату услуг"
                          className="inline-flex items-center gap-1 px-2 py-1 rounded bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 text-[11px] font-semibold border border-sky-500/30 cursor-pointer transition"
                        >
                          <Receipt className="w-3 h-3" />
                          <span>Счёт</span>
                        </button>

                        <button
                          onClick={() => onToggleActSigned(order.id)}
                          className={`px-2 py-1 text-[11px] rounded font-medium transition cursor-pointer ${
                            order.actSigned
                              ? 'bg-slate-800 text-slate-400 hover:text-white'
                              : 'bg-amber-500 text-slate-950 font-bold hover:bg-amber-400'
                          }`}
                        >
                          {order.actSigned ? 'Отозвать акт' : 'Подписать акт'}
                        </button>
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
  );
};
