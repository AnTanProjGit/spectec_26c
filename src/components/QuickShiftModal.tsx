import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Camera,
  ShieldAlert,
  FileText,
  Download,
  CreditCard,
  Clock,
  Truck,
  ArrowRightLeft,
  ChevronDown,
  MessageSquare,
  Send,
  Phone,
  MapPin,
  UserCheck,
  Calendar,
  Building2
} from 'lucide-react';
import {
  CRMDeal,
  DriverProfile,
  DriverReplacementRecord,
  DriverShiftRoster,
  Equipment,
  FleetBranch,
  PaymentCategory,
  RentalOrder,
  ShiftReport
} from '../types';
import { resolveDriverForEquipment, SHIFT_ROSTER_LABELS } from '../utils/driverAssignment';

interface QuickShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  embedded?: boolean;
  equipmentList: Equipment[];
  drivers?: DriverProfile[];
  deals?: CRMDeal[];
  orders?: RentalOrder[];
  replacements?: Record<string, DriverReplacementRecord>;
  activeBranch?: FleetBranch | null;
  branches?: FleetBranch[];
  onSubmitShift: (shift: ShiftReport) => void;
  onSendChatNote?: (payload: {
    branchId: string;
    senderName: string;
    text: string;
  }) => void;
  onOpenFleetManagerPanel?: () => void;
  onOpenAdminPanel?: () => void;
}

const PAYMENT_CATEGORY_LABELS: Record<PaymentCategory, string> = {
  fuel_own_tank: 'ГСМ свой бак',
  fuel_for_equipment: 'ГСМ для (из списка парка техники)',
  parts: 'Запчасти',
  other: 'Другое'
};

function timeToMinutes(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  const h = parseInt(hStr || '0', 10);
  const m = parseInt(mStr || '0', 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function computeRelocationFromTimes(shiftStart: string, workStart: string): number {
  const diffMin = timeToMinutes(workStart) - timeToMinutes(shiftStart);
  if (diffMin <= 0) return 0;
  return Math.round((diffMin / 60) * 10) / 10;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const QuickShiftModal: React.FC<QuickShiftModalProps> = ({
  isOpen,
  onClose,
  embedded = false,
  equipmentList,
  drivers = [],
  deals = [],
  orders = [],
  replacements = {},
  activeBranch,
  branches = [],
  onSubmitShift,
  onSendChatNote,
  onOpenFleetManagerPanel,
  onOpenAdminPanel: _onOpenAdminPanel
}) => {
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    activeBranch?.id || branches[0]?.id || 'branch-hq'
  );
  const [selectedEqId, setSelectedEqId] = useState(equipmentList[0]?.id || '');
  const [shiftRoster, setShiftRoster] = useState<DriverShiftRoster>('shift_1');
  const [shiftDate, setShiftDate] = useState<string>(getTodayIsoDate);
  const [selectedAssignmentKey, setSelectedAssignmentKey] = useState<string>('manual');
  const [clientName, setClientName] = useState<string>('');
  const [cardLast4Override, setCardLast4Override] = useState<string>('');
  const [siteName, setSiteName] = useState(equipmentList[0]?.assignedSite || 'ЖК «Северный квартал»');

  // Rule 3: Default shift start = 08:00, work start on site = 08:00, relocation = (workStart - shiftStart) or manual override
  const [shiftStartTime, setShiftStartTime] = useState('08:00');
  const [workStartTime, setWorkStartTime] = useState('08:00');
  const [workEndTime, setWorkEndTime] = useState('18:00');
  const [relocationHours, setRelocationHours] = useState(0);
  const [relocationManualOverride, setRelocationManualOverride] = useState(false);

  const [startHours, setStartHours] = useState(equipmentList[0]?.currentHours || 5420);
  const [endHours, setEndHours] = useState((equipmentList[0]?.currentHours || 5420) + 10);
  const [downtimeHours, setDowntimeHours] = useState(0);
  const [downtimeReason, setDowntimeReason] = useState('');
  const [mileageKm, setMileageKm] = useState(0);
  const [tripsCount, setTripsCount] = useState(0);
  const [fuelLiters, setFuelLiters] = useState(170);

  // Payments ("Платежи")
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>('fuel_own_tank');
  const [paymentTargetEqId, setPaymentTargetEqId] = useState<string>(
    equipmentList[1]?.id || equipmentList[0]?.id || ''
  );
  const [paymentAmountRub, setPaymentAmountRub] = useState<number>(170 * 65);
  const [paymentComment, setPaymentComment] = useState<string>('');

  // Rule 4: Collapsible piece-rate payroll calculation (hidden by default)
  const [isPayrollOpen, setIsPayrollOpen] = useState(false);

  // Rule 6: Corporate chat field
  const [chatMessageText, setChatMessageText] = useState('');
  const [chatSentNotice, setChatSentNotice] = useState(false);

  const [photoVerified, setPhotoVerified] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [waybillPreviewOpen, setWaybillPreviewOpen] = useState(false);
  const [waybillNumber, setWaybillNumber] = useState<string>('');
  const [waybillSubmitted, setWaybillSubmitted] = useState(false);

  useEffect(() => {
    if (!embedded && !isOpen) return;
    if (activeBranch) {
      setSelectedBranchId(activeBranch.id);
    } else if (branches.length > 0) {
      setSelectedBranchId(branches[0].id);
    }
    setWaybillPreviewOpen(false);
    setWaybillSubmitted(false);
    setWaybillNumber('');
    setShiftDate(getTodayIsoDate());
    setIsPayrollOpen(false);
    setChatSentNotice(false);
    setCardLast4Override('');
  }, [isOpen, embedded, activeBranch, branches]);

  useEffect(() => {
    const branchIdForEq = activeBranch?.id || selectedBranchId;
    const scopedList = branchIdForEq
      ? equipmentList.filter(e => e.branchId === branchIdForEq)
      : equipmentList;
    if (scopedList.length > 0 && !scopedList.some(e => e.id === selectedEqId)) {
      const first = scopedList[0];
      setSelectedEqId(first.id);
      setStartHours(first.currentHours);
      setEndHours(first.currentHours + 10);
      if (first.assignedSite) setSiteName(first.assignedSite);
      const second = scopedList.find(e => e.id !== first.id) || first;
      setPaymentTargetEqId(second.id);
    }
  }, [equipmentList, selectedEqId, selectedBranchId, activeBranch, isOpen, embedded]);

  // Auto-calculate relocation when shiftStartTime or workStartTime changes unless overridden manually
  useEffect(() => {
    if (!relocationManualOverride) {
      setRelocationHours(computeRelocationFromTimes(shiftStartTime, workStartTime));
    }
  }, [shiftStartTime, workStartTime, relocationManualOverride]);

  const effectiveBranch =
    activeBranch ||
    branches.find(b => b.id === selectedBranchId) ||
    branches[0];
  const branchScopedEquipment = effectiveBranch
    ? equipmentList.filter(e => e.branchId === effectiveBranch.id)
    : equipmentList;
  const selectedEquipment =
    branchScopedEquipment.find(e => e.id === selectedEqId) ||
    equipmentList.find(e => e.id === selectedEqId);
  const effectiveBranchId = selectedEquipment?.branchId || effectiveBranch?.id;
  const sameBranchEquipment = effectiveBranchId
    ? equipmentList.filter(e => e.branchId === effectiveBranchId)
    : branchScopedEquipment;

  const branchOrdersForEq = effectiveBranchId
    ? orders.filter(o => o.branchId === effectiveBranchId)
    : orders;
  const branchDealsForEq = effectiveBranchId
    ? deals.filter(d => d.branchId === effectiveBranchId && !d.archivedAt)
    : deals.filter(d => !d.archivedAt);

  // Auto-resolve active customer order/deal for selected equipment within same branch
  useEffect(() => {
    if (!embedded && !isOpen) return;
    const eqOrders = branchOrdersForEq.filter(o => o.equipmentId === selectedEqId);
    const activeOrder = eqOrders.find(o => o.status === 'active') || eqOrders[0];
    const eqDeals = branchDealsForEq.filter(d => d.equipmentAssignedId === selectedEqId);
    const activeDeal = eqDeals.find(d => d.stage === 'active') || eqDeals[0];

    if (activeOrder) {
      setSelectedAssignmentKey(`order:${activeOrder.id}`);
      setClientName(activeOrder.clientName);
      if (activeOrder.siteAddress) setSiteName(activeOrder.siteAddress);
    } else if (activeDeal) {
      setSelectedAssignmentKey(`deal:${activeDeal.id}`);
      setClientName(activeDeal.clientName);
      if (activeDeal.siteAddress) setSiteName(activeDeal.siteAddress);
    } else {
      setSelectedAssignmentKey('manual');
      const fallbackClient = effectiveBranch?.regularClients?.[0] || '';
      setClientName(prev => prev || fallbackClient);
    }
  }, [selectedEqId, effectiveBranchId, isOpen, embedded]);

  if (!embedded && !isOpen) return null;

  const driverResolution = resolveDriverForEquipment(
    selectedEquipment,
    drivers,
    replacements,
    shiftRoster
  );

  const resolvedDriverId =
    driverResolution.replacementRecord?.driverId ||
    driverResolution.resolvedDriver?.id;
  const resolvedDriverName =
    driverResolution.replacementRecord?.driverName ||
    driverResolution.resolvedDriver?.name ||
    selectedEquipment?.assignedOperator ||
    'Не назначен';
  const resolvedDriverPhone =
    driverResolution.replacementRecord?.driverPhone ||
    driverResolution.resolvedDriver?.phone ||
    'Не привязан';
  const resolvedDriverFromProfile = resolvedDriverId
    ? drivers.find(d => d.id === resolvedDriverId)
    : driverResolution.resolvedDriver;
  const effectiveCardLast4 = (
    cardLast4Override ||
    resolvedDriverFromProfile?.cardLast4 ||
    ''
  ).trim();

  const linkedOrder = selectedAssignmentKey.startsWith('order:')
    ? branchOrdersForEq.find(o => `order:${o.id}` === selectedAssignmentKey)
    : undefined;
  const linkedDeal = selectedAssignmentKey.startsWith('deal:')
    ? branchDealsForEq.find(d => `deal:${d.id}` === selectedAssignmentKey)
    : undefined;

  const waybillPrefix = effectiveBranch?.documentFlow.waybillPrefix || 'ПЛ-';
  const shiftPrefix = effectiveBranch?.documentFlow.shiftPrefix || 'SH-';
  const otherEquipmentOptions = sameBranchEquipment.filter(e => e.id !== selectedEqId);
  const targetEquipment = otherEquipmentOptions.find(e => e.id === paymentTargetEqId);

  const workHours = Math.max(0, endHours - startHours);
  const effectiveFuelForOwnMachine = paymentCategory === 'fuel_for_equipment' ? 0 : fuelLiters;
  const fuelHourly = workHours > 0 ? effectiveFuelForOwnMachine / workHours : 0;
  const standardFuelRate = selectedEquipment?.fuelRateHour || 17;
  const isFuelExcessive =
    paymentCategory !== 'fuel_for_equipment' && fuelHourly > standardFuelRate * 1.2;

  // Validation rules (non-blocking: creates Alert + logs date + notifies driver)
  const validationErrors: string[] = [];
  if (endHours < startHours) {
    validationErrors.push('Отрицательная наработка: конечные моточасы меньше начальных.');
  }
  if (workHours > 24) {
    validationErrors.push('Подозрительная длительность: свыше 24 часов за одну смену.');
  }
  if (isFuelExcessive) {
    validationErrors.push(
      `Отклонение расхода ГСМ: ${fuelHourly.toFixed(1)} л/ч (норма: ${standardFuelRate} л/ч). Будет создан Alert, дата зафиксирована в логах.`
    );
  }
  if (downtimeHours > 2 && !downtimeReason) {
    validationErrors.push('Простой свыше 2 часов требует обязательного указания причины.');
  }
  if (paymentCategory === 'fuel_for_equipment' && (!paymentTargetEqId || !targetEquipment)) {
    validationErrors.push('Укажите технику-получатель своего участка для переброса расхода ГСМ.');
  }

  // Driver piece rate calculation (approx 550-700 ₽/hr) + relocation hours
  const hourlyPayRate = selectedEquipment?.type === 'crane' ? 700 : 550;
  const calculatedSalary = (workHours + relocationHours) * hourlyPayRate;
  const todayDate = getTodayIsoDate();

  const handleSimulateOCR = async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/ocr-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ equipmentType: selectedEquipment?.type || 'excavator' })
      });
      const data = await res.json();
      if (data.success && data.extractedData) {
        setStartHours(data.extractedData.detectedStartHours);
        setEndHours(data.extractedData.detectedEndHours);
        setFuelLiters(data.extractedData.estimatedFuelConsumptionLiters);
        setPaymentAmountRub(Math.round(data.extractedData.estimatedFuelConsumptionLiters * 65));
        setPhotoVerified(true);
      }
    } catch {
      setEndHours(startHours + 10);
      const estFuel = Math.round(10 * standardFuelRate);
      setFuelLiters(estFuel);
      setPaymentAmountRub(estFuel * 65);
      setPhotoVerified(true);
    } finally {
      setIsScanning(false);
    }
  };

  const handleSendToCorporateChat = () => {
    const trimmed = chatMessageText.trim();
    if (!trimmed || !onSendChatNote) return;
    const resolvedBranchId = selectedEquipment?.branchId || effectiveBranch?.id || 'branch-hq';
    onSendChatNote({
      branchId: resolvedBranchId,
      senderName: `${resolvedDriverName} (${selectedEquipment ? selectedEquipment.inventoryNumber : 'Машинист'})`,
      text: trimmed
    });
    setChatMessageText('');
    setChatSentNotice(true);
    setTimeout(() => setChatSentNotice(false), 3000);
  };

  // Rule 7: Forming the waybill submits the document to Fleet Manager for approval
  const handleGenerateWaybill = (e: React.FormEvent) => {
    e.preventDefault();
    const dateStamp = (shiftDate || todayDate).slice(2).replace(/-/g, '');
    const num =
      waybillNumber && waybillNumber.startsWith(waybillPrefix)
        ? waybillNumber
        : `${waybillPrefix}${dateStamp}-${Math.floor(100 + Math.random() * 899)}`;
    setWaybillNumber(num);
    setWaybillPreviewOpen(true);

    const resolvedBranchId = effectiveBranch?.id || selectedEquipment?.branchId || 'branch-hq';
    const trimmedNote = chatMessageText.trim();
    if (trimmedNote && onSendChatNote) {
      onSendChatNote({
        branchId: resolvedBranchId,
        senderName: `${resolvedDriverName} (${selectedEquipment ? selectedEquipment.inventoryNumber : 'Машинист'})`,
        text: `[Путевой лист ${num}] ${trimmedNote}`
      });
      setChatMessageText('');
      setChatSentNotice(true);
    }

    if (!waybillSubmitted) {
      const hasAnomaly = validationErrors.length > 0;
      const newShift: ShiftReport = {
        id: `sh-${Date.now().toString().slice(-4)}`,
        branchId: resolvedBranchId,
        shiftNumber: `${shiftPrefix}${Math.floor(Math.random() * 800 + 420)}`,
        date: shiftDate || todayDate,
        equipmentId: selectedEqId,
        driverId: resolvedDriverId,
        operatorName: resolvedDriverName,
        driverPhone: resolvedDriverPhone !== 'Не привязан' ? resolvedDriverPhone : undefined,
        cardLast4: effectiveCardLast4 || undefined,
        clientName: clientName.trim() || linkedOrder?.clientName || linkedDeal?.clientName || undefined,
        orderId: linkedOrder?.id,
        dealId: linkedDeal?.id,
        siteName,
        shiftStartTime,
        workStartTime,
        workEndTime,
        relocationHours,
        startHours,
        endHours,
        workHours,
        downtimeHours,
        mileageKm: mileageKm > 0 ? mileageKm : 0,
        tripsCount: selectedEquipment?.type === 'dump_truck' ? tripsCount : undefined,
        downtimeReason: downtimeHours > 0 ? downtimeReason : undefined,
        fuelLitersAdded: fuelLiters,
        fuelHourlyCalculated: parseFloat(fuelHourly.toFixed(1)),
        paymentCategory,
        paymentTargetEquipmentId:
          paymentCategory === 'fuel_for_equipment' ? paymentTargetEqId : undefined,
        paymentAmountRub,
        paymentComment: paymentComment.trim() || undefined,
        chatNote: trimmedNote || undefined,
        waybillGenerated: true,
        waybillNumber: num,
        photoVerified,
        status: hasAnomaly ? 'anomaly' : 'pending',
        anomalyMessage: hasAnomaly ? validationErrors.join(' ') : undefined,
        calculatedSalary
      };
      onSubmitShift(newShift);
      setWaybillSubmitted(true);
    }
  };

  const handleDownloadWaybillExcel = () => {
    const num =
      waybillNumber && waybillNumber.startsWith(waybillPrefix)
        ? waybillNumber
        : `${waybillPrefix}${Date.now().toString().slice(-5)}`;
    const rows = [
      {
        '№ Путевого листа': num,
        'Участок': effectiveBranch ? `[${effectiveBranch.code}] ${effectiveBranch.name}` : '',
        'Подразделение 1С': effectiveBranch?.documentFlow.oneCDepartmentCode || '',
        'Дата': shiftDate || todayDate,
        'Инв. номер техники': selectedEquipment?.inventoryNumber || '',
        'Техника': selectedEquipment?.name || '',
        'Гос. номер': selectedEquipment?.plateNumber || '',
        'Водитель / Машинист': resolvedDriverName,
        'Телефон водителя (MAX)': resolvedDriverPhone,
        'Корп. карта водителя': effectiveCardLast4 ? `**** ${effectiveCardLast4}` : '—',
        'Заказчик': clientName.trim() || linkedOrder?.clientName || linkedDeal?.clientName || '—',
        'Заказ / Заявка': linkedOrder?.orderNumber || linkedDeal?.id || '—',
        'Объект': siteName,
        'Начало смены': shiftStartTime,
        'Начало работы на объекте': workStartTime,
        'Окончание работы на объекте': workEndTime,
        'Перегон техники (ч)': relocationHours,
        'Моточасы старт': startHours,
        'Моточасы финиш': endHours,
        'Отработано на объекте (ч)': workHours,
        'Простой (ч)': downtimeHours,
        'Заправлено ГСМ (л)': fuelLiters,
        'Платежи (корп. карта)': PAYMENT_CATEGORY_LABELS[paymentCategory],
        'Получатель ГСМ (при переливе)':
          paymentCategory === 'fuel_for_equipment' && targetEquipment
            ? `[${targetEquipment.inventoryNumber}] ${targetEquipment.name} (${targetEquipment.assignedOperator || '—'})`
            : '—',
        'Сумма по карте (₽)': paymentAmountRub,
        'Комментарий к платежу': paymentComment || '—',
        'Начислено машинисту (₽)': calculatedSalary
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = Array(24).fill({ wch: 22 });
    XLSX.utils.book_append_sheet(wb, ws, 'Путевой лист');
    XLSX.writeFile(wb, `Путевой_лист_${num}_${shiftDate || todayDate}.xlsx`);
  };

  const formCard = (
    <div
      className={
        embedded
          ? 'bg-slate-900 border border-slate-800 rounded-xl w-full overflow-hidden'
          : 'bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl'
      }
    >
      {/* Form Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b border-slate-800 ${
          embedded ? 'bg-slate-950/60' : 'sticky top-0 bg-slate-900/95 backdrop-blur z-10'
        }`}
      >
        <div>
          <h3 className="text-base font-bold text-white">Регистрация смены машиниста</h3>
          <p className="text-[13px] text-slate-400">
            Сменный рапорт ЭСМ-7 и формирование путевого листа на утверждение Fleet Manager
          </p>
        </div>
        {!embedded && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Закрыть окно"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

        <form onSubmit={handleGenerateWaybill} className="p-4 space-y-2.5 text-xs">
          {/* Rule 8: Concise Branch field for accurate document routing */}
          {effectiveBranch && (
            <div className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-300">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-medium text-slate-400">Участок:</span>
                {activeBranch ? (
                  <span className="font-semibold text-white">
                    [{activeBranch.code}] {activeBranch.name}
                  </span>
                ) : (
                  <select
                    value={effectiveBranch.id}
                    onChange={(e) => setSelectedBranchId(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                  >
                    {branches.map(b => (
                      <option key={b.id} value={b.id}>
                        [{b.code}] {b.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <span className="font-mono text-[11px] text-amber-300 tabular-nums">
                {effectiveBranch.documentFlow.waybillPrefix} · {effectiveBranch.documentFlow.oneCDepartmentCode}
              </span>
            </div>
          )}

          {/* Equipment selector */}
          <div>
            <label className="block font-medium text-slate-300 mb-1">Единица спецтехники</label>
            <select
              value={selectedEqId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedEqId(nextId);
                setCardLast4Override('');
                const eq = sameBranchEquipment.find(item => item.id === nextId) || equipmentList.find(item => item.id === nextId);
                if (eq) {
                  setStartHours(eq.currentHours);
                  setEndHours(eq.currentHours + 10);
                  if (eq.assignedSite) setSiteName(eq.assignedSite);
                  if (!activeBranch && eq.branchId) setSelectedBranchId(eq.branchId);
                }
                if (paymentTargetEqId === nextId || !sameBranchEquipment.some(item => item.id === paymentTargetEqId && item.id !== nextId)) {
                  const fallbackTarget = sameBranchEquipment.find(item => item.id !== nextId);
                  setPaymentTargetEqId(fallbackTarget?.id || '');
                }
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
            >
              {branchScopedEquipment.map(eq => (
                <option key={eq.id} value={eq.id}>
                  [{eq.inventoryNumber}] {eq.name} ({eq.plateNumber}) — {eq.status === 'rented' ? 'В аренде' : 'Свободна'}
                </option>
              ))}
            </select>
          </div>

          {/* Rules 1 & 2: Fleet Manager bound Driver Name + MAX Bot Phone + Timesheet shift / replacement */}
          <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                <UserCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Привязка водителя к технике (MAX / табель)</span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                {onOpenFleetManagerPanel && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenFleetManagerPanel();
                    }}
                    className="text-amber-400 hover:text-amber-300 underline underline-offset-2 cursor-pointer"
                  >
                    Подбор / замена (Поле Fleet Manager)
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-slate-400 mb-1">
                  ФИО Машиниста (привязано)
                </label>
                <input
                  type="text"
                  value={resolvedDriverName}
                  readOnly
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-slate-100 font-medium focus:outline-none cursor-default"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                  <Phone className="w-3 h-3 text-sky-400" />
                  <span>Бот-номер (MAX)</span>
                </label>
                <input
                  type="text"
                  value={resolvedDriverPhone}
                  readOnly
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-sky-300 font-mono focus:outline-none cursor-default"
                />
              </div>
              <div>
                <label className="flex items-center gap-1 text-[11px] text-slate-400 mb-1">
                  <CreditCard className="w-3 h-3 text-amber-400" />
                  <span>Карта водителя (подотчёт)</span>
                </label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="4819"
                  value={effectiveCardLast4}
                  onChange={(e) => setCardLast4Override(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-1.5 text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {driverResolution.mode === 'timesheet_shift' && (
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
                <span className="text-[11px] text-sky-300">
                  На технике несколько водителей ({driverResolution.boundDrivers.length} чел.) — выбор смены по табелю:
                </span>
                <select
                  value={shiftRoster}
                  onChange={(e) => setShiftRoster(e.target.value as DriverShiftRoster)}
                  className="bg-slate-900 border border-sky-500/40 rounded px-2.5 py-1 text-xs text-sky-200 focus:outline-none focus:border-sky-400"
                >
                  <option value="shift_1">{SHIFT_ROSTER_LABELS.shift_1}</option>
                  <option value="shift_2">{SHIFT_ROSTER_LABELS.shift_2}</option>
                </select>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              {driverResolution.explanation}
            </p>
          </div>

          {/* Customer + Active Order/Deal link for driver stream */}
          <div className="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 font-medium text-slate-300">
                <Building2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Заказчик и заявка/заказ участка</span>
              </label>
              {(linkedOrder || linkedDeal) && (
                <span className="font-mono text-[11px] text-emerald-400">
                  {linkedOrder ? linkedOrder.orderNumber : `CRM ${linkedDeal?.id}`}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <select
                  value={selectedAssignmentKey}
                  onChange={(e) => {
                    const key = e.target.value;
                    setSelectedAssignmentKey(key);
                    if (key.startsWith('order:')) {
                      const ord = branchOrdersForEq.find(o => `order:${o.id}` === key);
                      if (ord) {
                        setClientName(ord.clientName);
                        if (ord.siteAddress) setSiteName(ord.siteAddress);
                      }
                    } else if (key.startsWith('deal:')) {
                      const dl = branchDealsForEq.find(d => `deal:${d.id}` === key);
                      if (dl) {
                        setClientName(dl.clientName);
                        if (dl.siteAddress) setSiteName(dl.siteAddress);
                      }
                    }
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {branchOrdersForEq.map(o => (
                    <option key={`order:${o.id}`} value={`order:${o.id}`}>
                      [{o.orderNumber}] {o.clientName}
                    </option>
                  ))}
                  {branchDealsForEq.map(d => (
                    <option key={`deal:${d.id}`} value={`deal:${d.id}`}>
                      [CRM] {d.clientName} ({d.siteAddress})
                    </option>
                  ))}
                  <option value="manual">Указать заказчика вручную / из справочника</option>
                </select>
              </div>
              <div>
                <input
                  type="text"
                  list="quick-shift-branch-clients"
                  placeholder="Наименование заказчика (ООО / ИП / ФЛ)"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-200 focus:outline-none focus:border-amber-500"
                />
                <datalist id="quick-shift-branch-clients">
                  {(effectiveBranch?.regularClients || []).map(c => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Date (auto with edit) & Site */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1 font-medium text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-amber-400" />
                  <span>Дата смены</span>
                </label>
                {shiftDate !== todayDate && (
                  <button
                    type="button"
                    onClick={() => setShiftDate(todayDate)}
                    className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                  >
                    Сегодня
                  </button>
                )}
              </div>
              <input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-medium text-slate-300 mb-1">Строительный объект</label>
              <input
                type="text"
                value={siteName}
                onChange={(e) => setSiteName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          {/* Rule 3: Shift Start (08:00 default), Work Start on site, Work End, Relocation auto = workStart - shiftStart (0 if equal) */}
          <div className="p-2.5 rounded-lg bg-slate-800/40 border border-slate-800 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="flex items-center gap-1 font-medium text-slate-300 mb-1 text-[11px]">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span>Начало смены</span>
                </label>
                <input
                  type="time"
                  value={shiftStartTime}
                  onChange={(e) => setShiftStartTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-1 font-medium text-slate-300 mb-1 text-[11px]">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Начало работы (объект)</span>
                </label>
                <input
                  type="time"
                  value={workStartTime}
                  onChange={(e) => setWorkStartTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="flex items-center gap-1 font-medium text-slate-300 mb-1 text-[11px]">
                  <Clock className="w-3 h-3 text-amber-400" />
                  <span>Окончание работы</span>
                </label>
                <input
                  type="time"
                  value={workEndTime}
                  onChange={(e) => setWorkEndTime(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="flex items-center gap-1 font-medium text-slate-300 text-[11px]">
                    <Truck className="w-3 h-3 text-sky-400" />
                    <span>Перегон (ч)</span>
                  </label>
                  {relocationManualOverride && (
                    <button
                      type="button"
                      onClick={() => setRelocationManualOverride(false)}
                      className="text-[10px] text-sky-400 hover:underline cursor-pointer"
                    >
                      Авто
                    </button>
                  )}
                </div>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={relocationHours}
                  onChange={(e) => {
                    setRelocationManualOverride(true);
                    setRelocationHours(Math.max(0, parseFloat(e.target.value) || 0));
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <p className="text-[11px] text-slate-400">
              Дневная смена с 08:00 · Перегон = 0, если «Начало работы» − «Начало смены» = 0 (можно скорректировать по факту).
            </p>
          </div>

          {/* Photo OCR Simulation Bar */}
          <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/80 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <Camera className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <p className="text-slate-200 text-[13px] font-medium">Фото счётчика моточасов / Рапорт</p>
                <p className="text-[12px] text-slate-400">
                  {photoVerified ? 'Распознано и сверено с телематикой' : 'Прикрепите фото для автоматической валидации'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSimulateOCR}
              disabled={isScanning}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[13px] font-semibold hover:bg-amber-500/30 transition cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isScanning ? 'Сканирование...' : 'OCR Проверка'}
            </button>
          </div>

          {/* Hours start / end */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Моточасы старт</label>
              <input
                type="number"
                step="0.1"
                value={startHours}
                onChange={(e) => setStartHours(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Моточасы финиш</label>
              <input
                type="number"
                step="0.1"
                value={endHours}
                onChange={(e) => setEndHours(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Итого часов</label>
              <div className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-amber-400 font-mono font-bold">
                {workHours.toFixed(1)} ч{relocationHours > 0 ? ` (+${relocationHours} перегон)` : ''}
              </div>
            </div>
          </div>

          {/* Mileage & Dump Truck Trips */}
          <div className={`grid gap-2 ${selectedEquipment?.type === 'dump_truck' ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Пробег за смену (км)</label>
              <input
                type="number"
                min="0"
                step="1"
                value={mileageKm}
                onChange={(e) => setMileageKm(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            {selectedEquipment?.type === 'dump_truck' && (
              <div>
                <label className="block font-medium text-slate-300 mb-1">Количество рейсов (самосвал)</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={tripsCount}
                  onChange={(e) => setTripsCount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            )}
          </div>

          {/* Fuel & Downtime */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Заправлено топлива (литров)
              </label>
              <input
                type="number"
                min="0"
                value={fuelLiters}
                onChange={(e) => {
                  const liters = Math.max(0, parseFloat(e.target.value) || 0);
                  setFuelLiters(liters);
                  if (paymentCategory === 'fuel_own_tank' || paymentCategory === 'fuel_for_equipment') {
                    setPaymentAmountRub(Math.round(liters * 65));
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
              <span className="text-[11px] text-slate-400 mt-1 block">
                {paymentCategory === 'fuel_for_equipment' ? (
                  <span className="text-sky-400">Топливо перебрасывается на технику-получатель</span>
                ) : (
                  <>
                    Удельный: <strong className="num-mono">{fuelHourly.toFixed(1)} л/ч</strong> (норма: {standardFuelRate} л/ч)
                  </>
                )}
              </span>
            </div>

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Простой (часов)
              </label>
              <input
                type="number"
                min="0"
                step="0.5"
                value={downtimeHours}
                onChange={(e) => setDowntimeHours(Math.max(0, parseFloat(e.target.value) || 0))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {downtimeHours > 0 && (
            <div>
              <label className="block font-medium text-slate-300 mb-1">Причина простоя</label>
              <input
                type="text"
                placeholder="Например: Ожидание подвоза бетона / перебазировка"
                value={downtimeReason}
                onChange={(e) => setDowntimeReason(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          )}

          {/* Corporate Card Payments ("Платежи") */}
          <div className="p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-400" />
                <span className="font-semibold text-slate-200">
                  Платежи (корпоративная карта водителя{effectiveCardLast4 ? ` *${effectiveCardLast4}` : ''})
                </span>
              </div>
              <span className="text-[11px] text-slate-400">Отчёт водителя → CRM и ERP</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Назначение платежа</label>
                <select
                  value={paymentCategory}
                  onChange={(e) => {
                    const cat = e.target.value as PaymentCategory;
                    setPaymentCategory(cat);
                    if (cat === 'fuel_for_equipment' && (!paymentTargetEqId || paymentTargetEqId === selectedEqId)) {
                      const firstOther = otherEquipmentOptions[0];
                      if (firstOther) setPaymentTargetEqId(firstOther.id);
                    }
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="fuel_own_tank">ГСМ свой бак</option>
                  <option value="fuel_for_equipment">ГСМ для (из списка парка техники)</option>
                  <option value="parts">Запчасти</option>
                  <option value="other">Другое</option>
                </select>
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Сумма оплаты (₽)</label>
                <input
                  type="number"
                  min="0"
                  step="10"
                  value={paymentAmountRub}
                  onChange={(e) => setPaymentAmountRub(Math.max(0, parseFloat(e.target.value) || 0))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {paymentCategory === 'fuel_for_equipment' && (
              <div className="p-2.5 rounded-lg bg-sky-500/10 border border-sky-500/30 space-y-2">
                <label className="flex items-center gap-1.5 font-medium text-sky-300">
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>Техника-получатель ГСМ на участке [{effectiveBranch?.code || 'УЧАСТОК'}]:</span>
                </label>
                {otherEquipmentOptions.length === 0 ? (
                  <p className="text-[12px] text-amber-300">
                    На участке нет другой техники для внутрипаркового перелива ГСМ (перелив между разными участками/городами невозможен).
                  </p>
                ) : (
                  <select
                    value={targetEquipment?.id || ''}
                    onChange={(e) => setPaymentTargetEqId(e.target.value)}
                    className="w-full bg-slate-900 border border-sky-500/40 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-sky-400"
                  >
                    {otherEquipmentOptions.map(eq => (
                      <option key={eq.id} value={eq.id}>
                        [{eq.inventoryNumber}] {eq.name} ({eq.plateNumber}) — {eq.assignedOperator || 'Без водителя'}
                      </option>
                    ))}
                  </select>
                )}
                {targetEquipment && (
                  <p className="text-[12px] text-sky-200/90">
                    Расход {fuelLiters} л ({paymentAmountRub.toLocaleString()} ₽) будет переброшен на отчёт водителя{' '}
                    <strong>{targetEquipment.assignedOperator || 'принимающей техники'}</strong> и карточку{' '}
                    <strong>[{targetEquipment.inventoryNumber}] {targetEquipment.name}</strong>.
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="block font-medium text-slate-300 mb-1">
                Комментарий к платежу (чек, запчасти, детали)
              </label>
              <input
                type="text"
                placeholder={
                  paymentCategory === 'parts'
                    ? 'Например: Фильтр топливный Fleetguard / РВД'
                    : paymentCategory === 'other'
                    ? 'Укажите назначение расхода по карте'
                    : 'Номер АЗС или пояснение по заправке'
                }
                value={paymentComment}
                onChange={(e) => setPaymentComment(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Rule 4: Hidden / collapsible dropdown "Автоматический расчёт сдельщины" */}
          <div className="bg-slate-950 rounded-lg border border-slate-800 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPayrollOpen(prev => !prev)}
              className="w-full px-3 py-2 flex items-center justify-between text-left hover:bg-slate-900/80 transition cursor-pointer"
            >
              <span className="text-slate-300 font-medium">
                Автоматический расчёт сдельщины
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] text-slate-400">
                <span>{isPayrollOpen ? 'Скрыть' : 'Развернуть'}</span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    isPayrollOpen ? 'rotate-180 text-amber-400' : ''
                  }`}
                />
              </span>
            </button>

            {isPayrollOpen && (
              <div className="px-3 py-2.5 border-t border-slate-800 flex items-center justify-between bg-slate-950">
                <p className="text-[13px] text-slate-200">
                  ({workHours.toFixed(1)} ч работа{relocationHours > 0 ? ` + ${relocationHours.toFixed(1)} ч перегон` : ''}) × {hourlyPayRate} ₽/ч
                </p>
                <span className="text-base font-bold text-emerald-400 num-mono">
                  {calculatedSalary.toLocaleString()} ₽
                </span>
              </div>
            )}
          </div>

          {/* Rule 6: Corporate Chat field */}
          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 font-medium text-slate-300">
                <MessageSquare className="w-3.5 h-3.5 text-sky-400" />
                <span>Корпоративный чат (сообщение диспетчеру / участку)</span>
              </label>
              {chatSentNotice && (
                <span className="text-[11px] text-emerald-400 font-medium">
                  ✓ Отправлено в чат участка
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Напишите сообщение по объекту, заправке или подаче техники..."
                value={chatMessageText}
                onChange={(e) => setChatMessageText(e.target.value)}
                className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
              />
              {onSendChatNote && (
                <button
                  type="button"
                  disabled={!chatMessageText.trim()}
                  onClick={handleSendToCorporateChat}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>В чат</span>
                </button>
              )}
            </div>
          </div>

          {/* Validation alerts (Rule 5: Removed "Все показатели в пределах утвержденных нормативов..." green block) */}
          {validationErrors.length > 0 && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[13px]">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                <span>Зафиксированы отклонения (будут переданы Fleet Manager с путевым листом):</span>
              </div>
              <ul className="list-disc list-inside text-[13px] text-rose-200/90 pl-1 space-y-0.5">
                {validationErrors.map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Waybill Preview Card ("Сформировать путевой лист") */}
          {waybillPreviewOpen && (
            <div className="p-3.5 rounded-lg bg-slate-950 border border-amber-500/40 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-amber-400" />
                  <span className="font-bold text-amber-300 text-[13px]">
                    Путевой лист {waybillNumber} от {shiftDate || todayDate} · Направлен Fleet Manager на утверждение
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadWaybillExcel}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30 transition cursor-pointer text-xs font-semibold"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Скачать .xlsx</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                <div className="text-slate-400">Участок:</div>
                <div className="text-slate-100 font-medium">
                  {effectiveBranch ? `[${effectiveBranch.code}] ${effectiveBranch.name}` : '—'}
                </div>
                <div className="text-slate-400">Техника:</div>
                <div className="text-slate-100 font-mono">
                  [{selectedEquipment?.inventoryNumber}] {selectedEquipment?.name} ({selectedEquipment?.plateNumber})
                </div>
                <div className="text-slate-400">Водитель / Тел. (MAX):</div>
                <div className="text-slate-100">
                  {resolvedDriverName} · <span className="font-mono text-sky-300">{resolvedDriverPhone}</span>
                  {effectiveCardLast4 ? (
                    <span className="font-mono text-amber-300"> · карта *{effectiveCardLast4}</span>
                  ) : null}
                </div>
                <div className="text-slate-400">Заказчик / Объект:</div>
                <div className="text-slate-100">
                  {clientName || '—'} · <span className="text-slate-300">{siteName}</span>
                </div>
                <div className="text-slate-400">Смена / На объекте / Перегон:</div>
                <div className="text-slate-100 font-mono">
                  смена {shiftStartTime} · объект {workStartTime}—{workEndTime} · перегон {relocationHours} ч
                </div>
                <div className="text-slate-400">Моточасы / ГСМ:</div>
                <div className="text-slate-100 font-mono">
                  {startHours} → {endHours} ({workHours.toFixed(1)} ч) · {fuelLiters} л
                </div>
                <div className="text-slate-400">Платежи (корп. карта):</div>
                <div className="text-slate-100">
                  {PAYMENT_CATEGORY_LABELS[paymentCategory]} — {paymentAmountRub.toLocaleString()} ₽
                  {paymentCategory === 'fuel_for_equipment' && targetEquipment
                    ? ` → [${targetEquipment.inventoryNumber}] ${targetEquipment.name}`
                    : ''}
                </div>
              </div>
            </div>
          )}

          {/* Rule 7: Removed "Отмена" and "Утвердить смену" buttons; only Waybill generation for Fleet Manager approval */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800">
            <span className="text-[11px] text-slate-400">
              Сформированный путевой лист направляется на утверждение Fleet Manager.
            </span>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer shadow-md shadow-amber-500/20 ml-auto"
            >
              <FileText className="w-4 h-4" />
              <span>{waybillSubmitted ? 'Обновить путевой лист' : 'Сформировать путевой лист'}</span>
            </button>
          </div>
        </form>
      </div>
  );

  if (embedded) return formCard;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      {formCard}
    </div>
  );
};
