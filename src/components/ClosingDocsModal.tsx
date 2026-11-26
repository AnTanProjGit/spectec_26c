import React, { useMemo, useState, useEffect } from 'react';
import {
  X,
  Printer,
  Database,
  CheckCircle,
  FileText,
  FileSpreadsheet,
  Receipt,
  Download,
  Bell
} from 'lucide-react';
import {
  AccountingSubjectId,
  CRMDeal,
  ClosingDocKind,
  ClosingDocumentRecord,
  Equipment,
  FleetBranch,
  InvoiceStatus,
  OneCIntegrationConfig,
  RentalOrder
} from '../types';
import {
  INVOICE_STATUS_META,
  calculateVatRub,
  downloadClosingDocx,
  generateClosingDocHtml,
  generateClosingDocPlainText,
  getActServicesPrefix,
  getKs2Prefix,
  printClosingDocumentHtml,
  resolveAccountingSubjectForDeal,
  resolveAccountingSubjectForOrder,
  resolveDealInvoiceStatus,
  resolveOrderInvoiceStatus
} from '../utils/closingDocuments';

export interface ClosingModalTarget {
  sourceType: 'order' | 'deal';
  order?: RentalOrder;
  deal?: CRMDeal;
  initialTab?: ClosingDocKind;
}

interface ClosingDocsModalProps {
  target: ClosingModalTarget | null;
  equipmentList: Equipment[];
  branches: FleetBranch[];
  oneCConfig: OneCIntegrationConfig;
  savedClosingDocs: ClosingDocumentRecord[];
  onClose: () => void;
  onSaveClosingDoc: (doc: ClosingDocumentRecord) => void;
  onCloseVolumeAndSign: (
    actDoc: ClosingDocumentRecord,
    ks2Doc: ClosingDocumentRecord,
    ks3Doc?: ClosingDocumentRecord
  ) => void;
  onIssueInvoice: (
    invoiceDoc: ClosingDocumentRecord,
    invoiceStatus: InvoiceStatus,
    paidAmountRub: number
  ) => void;
  onUpdateInvoiceStatus: (
    sourceType: 'order' | 'deal',
    sourceId: string,
    invoiceStatus: InvoiceStatus,
    paidAmountRub: number
  ) => void;
}

function getTodayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const ClosingDocsModal: React.FC<ClosingDocsModalProps> = ({
  target,
  equipmentList,
  branches,
  oneCConfig,
  savedClosingDocs,
  onClose,
  onSaveClosingDoc,
  onCloseVolumeAndSign,
  onIssueInvoice,
  onUpdateInvoiceStatus
}) => {
  const [activeKind, setActiveKind] = useState<ClosingDocKind>('act_services');
  const [docDate, setDocDate] = useState(getTodayIso);
  const [periodStart, setPeriodStart] = useState(getTodayIso);
  const [periodEnd, setPeriodEnd] = useState(getTodayIso);
  const [quantity, setQuantity] = useState<number>(8);
  const [unitLabel, setUnitLabel] = useState<string>('маш.-час');
  const [rateRub, setRateRub] = useState<number>(3000);
  const [workDescription, setWorkDescription] = useState<string>('');
  const [accountingSubject, setAccountingSubject] =
    useState<AccountingSubjectId>('ooo_specialtech');
  const [actNumber, setActNumber] = useState('');
  const [ks2Number, setKs2Number] = useState('');
  const [ks3Number, setKs3Number] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus>('not_issued');
  const [paidAmountRub, setPaidAmountRub] = useState<number>(0);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  const branch = useMemo(() => {
    if (!target) return null;
    const bId = target.order?.branchId || target.deal?.branchId;
    return branches.find(b => b.id === bId) || branches[0] || null;
  }, [target, branches]);

  const equipment = useMemo(() => {
    if (!target) return undefined;
    if (target.order) {
      return equipmentList.find(e => e.id === target.order?.equipmentId);
    }
    if (target.deal?.equipmentAssignedId) {
      return equipmentList.find(e => e.id === target.deal?.equipmentAssignedId);
    }
    if (target.deal) {
      return equipmentList.find(
        e =>
          e.branchId === target.deal?.branchId &&
          e.type === target.deal?.equipmentType
      );
    }
    return undefined;
  }, [target, equipmentList]);

  useEffect(() => {
    if (!target) return;
    setActiveKind(target.initialTab || 'act_services');
    setFlashMessage(null);

    const today = getTodayIso();
    const branchCode = branch?.code || 'МСК';
    const actPrefix = getActServicesPrefix(branch);
    const ks2Prefix = getKs2Prefix(branch);

    if (target.order) {
      const ord = target.order;
      const numericTail =
        ord.orderNumber.split('-').pop() || ord.id.replace(/\D/g, '') || '101';
      const defaultQty = ord.closedVolumeHours ?? ord.actualHours ?? ord.plannedHours;
      const isDump = equipment?.type === 'dump_truck';
      const eqTitle = equipment
        ? `${equipment.name} [${equipment.inventoryNumber}]`
        : 'Спецтехника по договору';

      setDocDate(today);
      setPeriodStart(ord.startDate || today);
      setPeriodEnd(ord.endDate || today);
      setQuantity(defaultQty);
      setUnitLabel(isDump ? 'маш.-час' : 'маш.-час');
      setRateRub(ord.hourlyRate);
      setWorkDescription(`Услуги спецтехники с экипажем на объекте (${eqTitle})`);
      setAccountingSubject(resolveAccountingSubjectForOrder(ord));
      setActNumber(ord.actNumber || `${actPrefix}${numericTail}`);
      setKs2Number(ord.ks2Number || `${ks2Prefix}${numericTail}`);
      setKs3Number(ord.ks3Number || `КС3-${branchCode}-${numericTail}`);
      setInvoiceNumber(ord.invoiceNumber || `СЧ-${branchCode}-${numericTail}`);
      setInvoiceStatus(resolveOrderInvoiceStatus(ord));
      setPaidAmountRub(ord.paidAmount || 0);
    } else if (target.deal) {
      const d = target.deal;
      const tail = d.id.replace(/\D/g, '') || '201';
      const qty = d.closedVolumeHours ?? d.hoursRequested;
      const eqTitle = equipment
        ? `${equipment.name} [${equipment.inventoryNumber}]`
        : `Спецтехника (${d.equipmentType})`;
      const paid =
        d.paidAmount ?? Math.max(0, (d.estimatedAmount || 0) - (d.debtAmount || 0));

      setDocDate(today);
      setPeriodStart(d.dateCreated || today);
      setPeriodEnd(today);
      setQuantity(qty);
      setUnitLabel('маш.-час');
      setRateRub(d.hourlyRateAgreed);
      setWorkDescription(`Аренда и выполнение работ спецтехникой (${eqTitle})`);
      setAccountingSubject(resolveAccountingSubjectForDeal(d));
      setActNumber(d.actNumber || `${actPrefix}CRM-${tail}`);
      setKs2Number(d.ks2Number || `${ks2Prefix}CRM-${tail}`);
      setKs3Number(d.ks3Number || `КС3-${branchCode}-CRM-${tail}`);
      setInvoiceNumber(d.invoiceNumber || `СЧ-${branchCode}-CRM-${tail}`);
      setInvoiceStatus(resolveDealInvoiceStatus(d));
      setPaidAmountRub(paid);
    }
  }, [target, branch, equipment]);

  if (!target) return null;

  const sourceId = target.order?.id || target.deal?.id || '';
  const sourceType = target.sourceType;
  const orderOrDealNumber =
    target.order?.orderNumber || `CRM-${target.deal?.id.toUpperCase()}`;
  const clientName = target.order?.clientName || target.deal?.clientName || '';
  const siteAddress = target.order?.siteAddress || target.deal?.siteAddress || '';
  const operatorName =
    target.order?.operatorName ||
    target.deal?.assignedDriverName ||
    equipment?.assignedOperator ||
    'Дежурный экипаж';
  const equipmentName = equipment
    ? `[${equipment.inventoryNumber}] ${equipment.name} (${equipment.plateNumber})`
    : `Спецтехника (${target.deal?.equipmentType || 'по заказу'})`;

  const totalAmountRub = Math.round((Number(quantity) || 0) * (Number(rateRub) || 0));
  const vatAmountRub = calculateVatRub(totalAmountRub, accountingSubject);

  const buildRecord = (kind: ClosingDocKind): ClosingDocumentRecord => {
    const number =
      kind === 'ks2'
        ? ks2Number
        : kind === 'ks3'
        ? ks3Number
        : kind === 'invoice'
        ? invoiceNumber
        : actNumber;
    const baseRecord: ClosingDocumentRecord = {
      id: `cdoc-${sourceType}-${sourceId}-${kind}`,
      kind,
      number,
      date: docDate,
      periodStart,
      periodEnd,
      branchId: branch?.id || target.order?.branchId || target.deal?.branchId || 'branch-hq',
      sourceType,
      sourceId,
      orderOrDealNumber,
      clientName,
      siteAddress,
      equipmentName,
      operatorName,
      workDescription,
      unitLabel,
      quantity: Number(quantity) || 0,
      rateRub: Number(rateRub) || 0,
      totalAmountRub,
      vatAmountRub,
      accountingSubject,
      savedToBase: false,
      invoiceStatus: kind === 'invoice' ? invoiceStatus : undefined,
      paidAmountRub: kind === 'invoice' ? paidAmountRub : undefined,
      contentText: ''
    };
    return {
      ...baseRecord,
      contentText: generateClosingDocPlainText(baseRecord, branch, oneCConfig)
    };
  };

  const activeDoc = buildRecord(activeKind);
  const activeHtml = generateClosingDocHtml(activeDoc, branch, oneCConfig);

  const isSavedInDb = (kind: ClosingDocKind) => {
    const inDocs = savedClosingDocs.some(
      d => d.sourceType === sourceType && d.sourceId === sourceId && d.kind === kind && d.savedToBase
    );
    if (inDocs) return true;
    if (target.order) {
      if (kind === 'act_services') return Boolean(target.order.actSavedToBase);
      if (kind === 'ks2') return Boolean(target.order.ks2SavedToBase);
      if (kind === 'ks3') return Boolean(target.order.ks3SavedToBase);
      return Boolean(target.order.invoiceSavedToBase);
    }
    if (target.deal) {
      if (kind === 'act_services') return Boolean(target.deal.actSavedToBase);
      if (kind === 'ks2') return Boolean(target.deal.ks2SavedToBase);
      if (kind === 'ks3') return Boolean(target.deal.ks3SavedToBase);
      return Boolean(target.deal.invoiceSavedToBase);
    }
    return false;
  };

  const showFeedback = (msg: string) => {
    setFlashMessage(msg);
    setTimeout(() => setFlashMessage(null), 4000);
  };

  const handlePrint = () => {
    printClosingDocumentHtml(activeHtml);
  };

  const handleSaveCurrent = () => {
    const rec = {
      ...activeDoc,
      savedToBase: true,
      savedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    onSaveClosingDoc(rec);
    showFeedback(`Документ ${rec.number} сохранён в базу и реестр договоров.`);
  };

  const handleCloseVolume = () => {
    const nowStamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const actRec = {
      ...buildRecord('act_services'),
      savedToBase: true,
      savedAt: nowStamp
    };
    const ks2Rec = {
      ...buildRecord('ks2'),
      savedToBase: true,
      savedAt: nowStamp
    };
    const ks3Rec = {
      ...buildRecord('ks3'),
      savedToBase: true,
      savedAt: nowStamp
    };
    onCloseVolumeAndSign(actRec, ks2Rec, ks3Rec);
    showFeedback(
      `Объём зафиксирован (${quantity} ${unitLabel}). Акт ${actRec.number}, КС-2 ${ks2Rec.number} и КС-3 ${ks3Rec.number} сохранены в базу.`
    );
  };

  const handleIssueOrUpdateInvoice = () => {
    const nextStatus: InvoiceStatus =
      invoiceStatus === 'not_issued' ? 'issued' : invoiceStatus;
    setInvoiceStatus(nextStatus);
    const invRec: ClosingDocumentRecord = {
      ...buildRecord('invoice'),
      savedToBase: true,
      invoiceStatus: nextStatus,
      paidAmountRub,
      savedAt: new Date().toISOString().slice(0, 16).replace('T', ' ')
    };
    onIssueInvoice(invRec, nextStatus, paidAmountRub);
    showFeedback(
      `Счёт ${invRec.number} на сумму ${totalAmountRub.toLocaleString('ru-RU')} ₽ выставлен и сохранён в базу.`
    );
  };

  const handleOnlyStatusChange = (nextStatus: InvoiceStatus) => {
    let nextPaid = paidAmountRub;
    if (nextStatus === 'paid') {
      nextPaid = totalAmountRub;
      setPaidAmountRub(totalAmountRub);
    } else if (nextStatus === 'issued' || nextStatus === 'not_issued') {
      if (nextStatus === 'not_issued') {
        nextPaid = 0;
        setPaidAmountRub(0);
      }
    }
    setInvoiceStatus(nextStatus);
    onUpdateInvoiceStatus(sourceType, sourceId, nextStatus, nextPaid);
    showFeedback(`Статус счёта обновлён: «${INVOICE_STATUS_META[nextStatus].label}».`);
  };

  const isActSigned = Boolean(target.order?.actSigned || target.deal?.actSigned);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl max-h-[94vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Modal Header */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/80 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-white">
                Закрытие объёма работ: {clientName}
              </h2>
              <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-mono text-xs font-bold">
                {orderOrDealNumber}
              </span>
              {isActSigned && (
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5" /> Объём закрыт / Акт подписан
                </span>
              )}
              <span
                className={`px-2 py-0.5 rounded border text-xs font-semibold ${INVOICE_STATUS_META[invoiceStatus].badgeClass}`}
              >
                {INVOICE_STATUS_META[invoiceStatus].label}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Объект: {siteAddress} · Техника: {equipmentName}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Document Type Switcher Tabs */}
        <div className="px-4 py-2 border-b border-slate-800 bg-slate-900 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setActiveKind('act_services')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                activeKind === 'act_services'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>1. Акт оказанных услуг</span>
              {isSavedInDb('act_services') && (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveKind('ks2')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                activeKind === 'ks2'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>2. Форма № КС-2 (ОКУД 0322005)</span>
              {isSavedInDb('ks2') && (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveKind('ks3')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                activeKind === 'ks3'
                  ? 'bg-amber-500 text-slate-950 border-amber-400'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>3. Форма № КС-3</span>
              {isSavedInDb('ks3') && (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveKind('invoice')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border ${
                activeKind === 'invoice'
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:text-white'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>4. Счёт на оплату услуг</span>
              {isSavedInDb('invoice') && (
                <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400">Сумма к закрытию:</span>
            <span className="font-mono font-bold text-amber-400 text-sm">
              {totalAmountRub.toLocaleString('ru-RU')} ₽
            </span>
            <span className="text-slate-400 font-mono">
              ({accountingSubject === 'ooo_specialtech' ? `в т.ч. НДС 20%: ${vatAmountRub.toLocaleString('ru-RU')} ₽` : 'Без НДС, УСН'})
            </span>
          </div>
        </div>

        {/* Editable Parameters Bar */}
        <div className="px-4 py-2.5 border-b border-slate-800 bg-slate-950/50 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 text-xs">
          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">
              № {activeKind === 'ks2' ? 'КС-2' : activeKind === 'ks3' ? 'КС-3' : activeKind === 'invoice' ? 'Счёта' : 'Акта'}
            </label>
            <input
              type="text"
              value={
                activeKind === 'ks2'
                  ? ks2Number
                  : activeKind === 'ks3'
                  ? ks3Number
                  : activeKind === 'invoice'
                  ? invoiceNumber
                  : actNumber
              }
              onChange={e => {
                if (activeKind === 'ks2') setKs2Number(e.target.value);
                else if (activeKind === 'ks3') setKs3Number(e.target.value);
                else if (activeKind === 'invoice') setInvoiceNumber(e.target.value);
                else setActNumber(e.target.value);
              }}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Дата док.</label>
            <input
              type="date"
              value={docDate}
              onChange={e => setDocDate(e.target.value)}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Период с</label>
            <input
              type="date"
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Период по</label>
            <input
              type="date"
              value={periodEnd}
              onChange={e => setPeriodEnd(e.target.value)}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Факт. объём</label>
            <div className="flex gap-1">
              <input
                type="number"
                min={0}
                step={0.5}
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                className="w-16 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
              />
              <select
                value={unitLabel}
                onChange={e => setUnitLabel(e.target.value)}
                className="flex-1 px-1 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200"
              >
                <option value="маш.-час">ч</option>
                <option value="рейс">рейс</option>
                <option value="смена">смена</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Тариф, ₽</label>
            <input
              type="number"
              min={0}
              step={100}
              value={rateRub}
              onChange={e => setRateRub(Number(e.target.value))}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono"
            />
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Юр. лицо 1С</label>
            <select
              value={accountingSubject}
              onChange={e =>
                setAccountingSubject(e.target.value as AccountingSubjectId)
              }
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
            >
              <option value="ooo_specialtech">ООО (НДС 20%)</option>
              <option value="ip_specialtechnica">ИП (УСН б/НДС)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] text-slate-400 block mb-0.5">Статус счёта</label>
            <select
              value={invoiceStatus}
              onChange={e => handleOnlyStatusChange(e.target.value as InvoiceStatus)}
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white"
            >
              <option value="not_issued">Не выставлен</option>
              <option value="issued">Выставлен</option>
              <option value="partially_paid">Частично оплачен</option>
              <option value="paid">Оплачен</option>
              <option value="overdue">Просрочен</option>
            </select>
          </div>

          <div className="col-span-2 sm:col-span-4 lg:col-span-6">
            <label className="text-[11px] text-slate-400 block mb-0.5">
              Наименование работ / услуг в печатной форме
            </label>
            <input
              type="text"
              value={workDescription}
              onChange={e => setWorkDescription(e.target.value)}
              className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-white"
            />
          </div>

          <div className="col-span-2">
            <label className="text-[11px] text-slate-400 block mb-0.5">Оплачено по счёту, ₽</label>
            <input
              type="number"
              min={0}
              step={1000}
              value={paidAmountRub}
              onChange={e => setPaidAmountRub(Number(e.target.value))}
              onBlur={() =>
                onUpdateInvoiceStatus(sourceType, sourceId, invoiceStatus, paidAmountRub)
              }
              className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-emerald-300 font-mono"
            />
          </div>
        </div>

        {/* Feedback Banner */}
        {flashMessage && (
          <div className="px-4 py-2 bg-emerald-500/15 border-b border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 font-medium">
            <Bell className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{flashMessage}</span>
          </div>
        )}

        {/* Live Normative A4 Document Sheet Preview */}
        <div className="flex-1 overflow-y-auto bg-slate-800/80 p-3 sm:p-4 flex justify-center">
          <div className="w-full max-w-[820px] bg-white rounded-lg shadow-2xl border border-slate-300 overflow-hidden">
            <iframe
              title="Предпросмотр нормативной формы"
              srcDoc={activeHtml}
              className="w-full h-[460px] sm:h-[520px] border-0 bg-white"
            />
          </div>
        </div>

        {/* Bottom Action Buttons */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs border border-slate-600 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 text-sky-400" />
              <span>Печать формы</span>
            </button>

            <button
              type="button"
              onClick={() => downloadClosingDocx(activeDoc, branch, oneCConfig)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-400" />
              <span>Скачать .docx</span>
            </button>

            <button
              type="button"
              onClick={handleSaveCurrent}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 font-bold text-xs border border-indigo-500/40 transition cursor-pointer"
            >
              <Database className="w-4 h-4 text-indigo-300" />
              <span>
                {isSavedInDb(activeKind) ? 'Обновить в базе ✓' : 'Сохранить в базу'}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleCloseVolume}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-emerald-500/20"
            >
              <CheckCircle className="w-4 h-4" />
              <span>Закрыть объём: Акт + КС-2 + КС-3</span>
            </button>

            <button
              type="button"
              onClick={handleIssueOrUpdateInvoice}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md shadow-amber-500/20"
            >
              <Receipt className="w-4 h-4" />
              <span>
                {invoiceStatus === 'not_issued'
                  ? 'Выставить счёт за услуги'
                  : 'Обновить счёт и уведомить'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
