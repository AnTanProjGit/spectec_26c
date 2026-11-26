import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Clock,
  CheckCircle,
  AlertTriangle,
  Lock,
  CalendarDays,
  FileSpreadsheet,
  UserPlus,
  Search
} from 'lucide-react';
import {
  ShiftReport,
  Equipment,
  FleetBranch,
  DriverProfile,
  DriverShiftRoster,
  TimesheetDayCode,
  TableViewSettings
} from '../../types';

interface TimesheetsViewProps {
  shiftReports: ShiftReport[];
  equipmentList: Equipment[];
  drivers?: DriverProfile[];
  activeBranch?: FleetBranch | null;
  branches?: FleetBranch[];
  tableConfig?: TableViewSettings;
  adminConfirmationAllowed?: boolean;
  hasActiveRequest?: boolean;
  onApproveShift: (shiftId: string) => void;
  onUpdateDriver?: (driver: DriverProfile) => void;
  onAddDriver?: (driver: DriverProfile) => void;
}

const TIMESHEET_DAYS = Array.from({ length: 15 }, (_, idx) =>
  String(idx + 1).padStart(2, '0')
);

const DAY_CODE_SEQUENCE: TimesheetDayCode[] = ['Я', 'Н', 'В', 'Б', 'О'];

const DAY_CODE_META: Record<
  TimesheetDayCode,
  { label: string; hours: number; pillClass: string }
> = {
  Я: {
    label: 'Дневная смена (10 ч)',
    hours: 10,
    pillClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
  },
  Н: {
    label: 'Ночная смена (10 ч)',
    hours: 10,
    pillClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
  },
  В: {
    label: 'Выходной (0 ч)',
    hours: 0,
    pillClass: 'bg-slate-800/80 text-slate-400 border-slate-700 hover:bg-slate-700/80'
  },
  Б: {
    label: 'Больничный / требуется замена',
    hours: 0,
    pillClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 hover:bg-rose-500/30'
  },
  О: {
    label: 'Отпуск',
    hours: 0,
    pillClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
  }
};

function getDefaultDayCode(driver: DriverProfile, dayIndex: number): TimesheetDayCode {
  if (driver.needsReplacement && dayIndex >= 11) {
    return 'Б';
  }
  const cyclePos = (dayIndex + (driver.shiftRoster === 'shift_2' ? 2 : 0)) % 4;
  if (cyclePos === 0 || cyclePos === 1) {
    return driver.shiftRoster === 'shift_2' ? 'Н' : 'Я';
  }
  return 'В';
}

function getDriverDaysMap(driver: DriverProfile): Record<string, TimesheetDayCode> {
  const result: Record<string, TimesheetDayCode> = {};
  TIMESHEET_DAYS.forEach((day, idx) => {
    result[day] = driver.timesheetDays?.[day] || getDefaultDayCode(driver, idx);
  });
  return result;
}

export const TimesheetsView: React.FC<TimesheetsViewProps> = ({
  shiftReports,
  equipmentList,
  drivers = [],
  activeBranch,
  branches = [],
  tableConfig,
  adminConfirmationAllowed = false,
  hasActiveRequest = false,
  onApproveShift,
  onUpdateDriver,
  onAddDriver
}) => {
  const [activeTab, setActiveTab] = useState<'shifts' | 'roster'>('shifts');
  const [filter, setFilter] = useState<'all' | 'pending' | 'anomaly' | 'approved'>('all');
  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterShiftFilter, setRosterShiftFilter] = useState<'all' | DriverShiftRoster | 'replacement'>('all');
  const [isAddDriverOpen, setIsAddDriverOpen] = useState(false);
  const [newDriverName, setNewDriverName] = useState('');
  const [newDriverPhone, setNewDriverPhone] = useState('+7 (9');
  const [newDriverCardLast4, setNewDriverCardLast4] = useState('');
  const [newDriverBranchId, setNewDriverBranchId] = useState(
    activeBranch?.id || branches[0]?.id || 'branch-hq'
  );
  const [newDriverEqId, setNewDriverEqId] = useState(equipmentList[0]?.id || '');
  const [newDriverShift, setNewDriverShift] = useState<DriverShiftRoster>('shift_1');

  const filteredShifts = shiftReports.filter(shift => {
    if (filter === 'pending') return shift.status === 'pending';
    if (filter === 'anomaly') return shift.status === 'anomaly';
    if (filter === 'approved') return shift.status === 'approved';
    return true;
  });

  const filteredDrivers = drivers.filter(d => {
    if (rosterShiftFilter === 'shift_1' && d.shiftRoster !== 'shift_1') return false;
    if (rosterShiftFilter === 'shift_2' && d.shiftRoster !== 'shift_2') return false;
    if (rosterShiftFilter === 'replacement' && !d.needsReplacement) return false;
    if (rosterSearch.trim()) {
      const q = rosterSearch.toLowerCase();
      const eq = equipmentList.find(e => d.assignedEquipmentIds.includes(e.id));
      const matchesName = d.name.toLowerCase().includes(q);
      const matchesPhone = d.phone.toLowerCase().includes(q);
      const matchesEq = eq
        ? eq.inventoryNumber.toLowerCase().includes(q) || eq.name.toLowerCase().includes(q)
        : false;
      if (!matchesName && !matchesPhone && !matchesEq) return false;
    }
    return true;
  });

  const totalShiftHours = shiftReports.reduce((sum, s) => sum + s.workHours, 0);
  const totalPayrollMonth = shiftReports.reduce((sum, s) => sum + s.calculatedSalary, 0);
  const anomaliesCount = shiftReports.filter(s => s.status === 'anomaly').length;

  const totalRosterHours = drivers.reduce((sum, drv) => {
    const daysMap = getDriverDaysMap(drv);
    const hours = Object.values(daysMap).reduce((s, code) => s + DAY_CODE_META[code].hours, 0);
    return sum + hours;
  }, 0);

  const cellPadClass =
    tableConfig?.density === 'compact'
      ? 'py-2 px-3'
      : tableConfig?.density === 'comfortable'
      ? 'py-4 px-4'
      : 'py-3 px-4';
  const showBranchBadge = !activeBranch && (tableConfig?.showBranchCode ?? true);

  const handleCycleDayCode = (driver: DriverProfile, dayKey: string) => {
    if (!onUpdateDriver) return;
    const currentMap = getDriverDaysMap(driver);
    const currentCode = currentMap[dayKey] || 'Я';
    const nextIndex = (DAY_CODE_SEQUENCE.indexOf(currentCode) + 1) % DAY_CODE_SEQUENCE.length;
    const nextCode = DAY_CODE_SEQUENCE[nextIndex];
    const nextMap = { ...currentMap, [dayKey]: nextCode };
    const hasSickLeave = Object.values(nextMap).some(c => c === 'Б');
    onUpdateDriver({
      ...driver,
      timesheetDays: nextMap,
      needsReplacement: nextCode === 'Б' ? true : hasSickLeave ? driver.needsReplacement : false
    });
  };

  const handleCreateDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!onAddDriver || !newDriverName.trim() || !newDriverPhone.trim()) return;
    const cleanCard = newDriverCardLast4.replace(/\D/g, '').slice(0, 4);
    onAddDriver({
      id: `drv-${Date.now().toString().slice(-4)}`,
      branchId: newDriverBranchId,
      name: newDriverName.trim(),
      phone: newDriverPhone.trim(),
      maxLinked: true,
      cardLast4: cleanCard || undefined,
      cardLimitRub: 150000,
      assignedEquipmentIds: newDriverEqId ? [newDriverEqId] : [],
      shiftRoster: newDriverShift,
      needsReplacement: false
    });
    setNewDriverName('');
    setNewDriverPhone('+7 (9');
    setNewDriverCardLast4('');
    setIsAddDriverOpen(false);
  };

  const handleExportRosterExcel = () => {
    const rows = filteredDrivers.map(drv => {
      const daysMap = getDriverDaysMap(drv);
      const eq = equipmentList.find(e => drv.assignedEquipmentIds.includes(e.id));
      const workShifts = Object.values(daysMap).filter(c => c === 'Я' || c === 'Н').length;
      const totalHours = Object.values(daysMap).reduce((s, c) => s + DAY_CODE_META[c].hours, 0);
      const row: Record<string, string | number> = {
        Машинист: drv.name,
        'Телефон (MAX)': drv.phone,
        'Карта водителя': drv.cardLast4 ? `**** ${drv.cardLast4}` : '—',
        Участок: branches.find(b => b.id === drv.branchId)?.code || drv.branchId,
        Техника: eq ? `[${eq.inventoryNumber}] ${eq.name}` : 'Не закреплена',
        Смена: drv.shiftRoster === 'shift_1' ? 'Смена 1 (день)' : 'Смена 2 (ночь)'
      };
      TIMESHEET_DAYS.forEach(d => {
        row[d] = daysMap[d];
      });
      row['Смен'] = workShifts;
      row['Часов'] = totalHours;
      row['Статус'] = drv.needsReplacement ? 'Требуется замена' : 'На линии';
      return row;
    });

    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Табель Т-13');
    XLSX.writeFile(wb, `tabel-ekipazhey-${activeBranch?.code || 'ALL'}.xlsx`);
  };

  return (
    <div className="p-2.5 space-y-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {activeBranch ? `Табели и путевые листы: ${activeBranch.name}` : 'Табели смен и расчёт зарплаты машинистов'}
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            {activeBranch
              ? `Поток смен: ${activeBranch.documentFlow.shiftPrefix} · Путевые листы: ${activeBranch.documentFlow.waybillPrefix} · Fleet Manager: ${activeBranch.fleetManagerName}`
              : 'Сменный рапорт ЭСМ-7 и табель выходов экипажей Т-13: контроль моточасов, ГСМ и сменной оплаты'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Отработано часов экипажами</span>
          <span className="text-xl font-bold text-white num-mono">{totalShiftHours.toFixed(1)} м/ч</span>
          <span className="text-xs text-slate-500 block mt-0.5">По сменным рапортам ЭСМ-7</span>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Начислено зарплаты машинистам</span>
          <span className="text-xl font-bold text-emerald-400 num-mono">{totalPayrollMonth.toLocaleString()} ₽</span>
          <span className="text-xs text-emerald-500 block mt-0.5">Сдельная ставка по тарифной сетке</span>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Аномалий и ошибок в рапортах</span>
          <span className="text-xl font-bold text-rose-400 num-mono">{anomaliesCount} смен</span>
          <span className="text-xs text-rose-500 block mt-0.5">Требуют ручного подтверждения</span>
        </div>

        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">План / факт по табелю (15 дн.)</span>
          <span className="text-xl font-bold text-amber-400 num-mono">{totalRosterHours} ч</span>
          <span className="text-xs text-slate-400 block mt-0.5">
            Машинистов в табеле: {drivers.length} чел.
          </span>
        </div>
      </div>

      {/* Primary Section Tabs: Shift Reports vs Full Timesheet */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('shifts')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'shifts'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Рапорты смен ЭСМ-7 ({shiftReports.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('roster')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold border transition cursor-pointer whitespace-nowrap shrink-0 ${
              activeTab === 'roster'
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Табель выходов и график экипажей ({drivers.length})</span>
          </button>
        </div>

        {activeTab === 'roster' && (
          <div className="flex flex-wrap items-center gap-2">
            {onAddDriver && (
              <button
                type="button"
                onClick={() => setIsAddDriverOpen(prev => !prev)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-400" />
                <span>Добавить в табель</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportRosterExcel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Экспорт табеля (.xlsx)</span>
            </button>
          </div>
        )}
      </div>

      {activeTab === 'shifts' ? (
        <>
          {/* Filter Tabs */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                filter === 'all' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Все смены ({shiftReports.length})
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                filter === 'pending' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              На утверждении (ПЛ) ({shiftReports.filter(s => s.status === 'pending').length})
            </button>
            <button
              onClick={() => setFilter('anomaly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                filter === 'anomaly' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Требуют проверки / Аномалии ({anomaliesCount})
            </button>
            <button
              onClick={() => setFilter('approved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                filter === 'approved' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Утвержденные смены
            </button>
          </div>

          {/* Shift Register Table */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/60 border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Рапорт / Дата</th>
                    <th className="py-3 px-4">Спецтехника</th>
                    <th className="py-3 px-4">Машинист / Объект</th>
                    <th className="py-3 px-4 text-center">Счётчик старт → финиш</th>
                    <th className="py-3 px-4 text-right">Часы / Простой</th>
                    <th className="py-3 px-4 text-right">Расход ГСМ</th>
                    <th className="py-3 px-4 text-right">З/П машиниста</th>
                    <th className="py-3 px-4 text-center">Статус проверки</th>
                    <th className="py-3 px-4 text-right">Действие</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredShifts.map((shift) => {
                    const assignedEq = equipmentList.find(e => e.id === shift.equipmentId);
                    const targetEq = shift.paymentTargetEquipmentId
                      ? equipmentList.find(e => e.id === shift.paymentTargetEquipmentId)
                      : undefined;

                    const paymentLabelMap: Record<string, string> = {
                      fuel_own_tank: 'ГСМ свой бак',
                      fuel_for_equipment: targetEq
                        ? `ГСМ → [${targetEq.inventoryNumber}]`
                        : 'ГСМ для техники парка',
                      parts: 'Запчасти',
                      other: 'Другое'
                    };

                    return (
                      <tr key={shift.id} className="hover:bg-slate-800/40 transition">
                        <td className={cellPadClass}>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {showBranchBadge && (
                                <span className="px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-[11px] font-bold">
                                  {branches.find(b => b.id === shift.branchId)?.code || shift.branchId}
                                </span>
                              )}
                              <span className="font-mono text-amber-400 font-bold">{shift.shiftNumber}</span>
                              {shift.waybillGenerated && (
                                <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[11px] font-mono">
                                  {shift.waybillNumber || 'ПЛ'}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {shift.date}
                              {shift.workStartTime && shift.workEndTime
                                ? ` · ${shift.workStartTime}–${shift.workEndTime}`
                                : ''}
                            </div>
                          </div>
                        </td>

                        <td className={cellPadClass}>
                          <span className="font-mono text-[14px] font-semibold text-white">
                            {assignedEq ? `[${assignedEq.inventoryNumber}] ${assignedEq.name}` : 'Техника'}
                          </span>
                        </td>

                        <td className={cellPadClass}>
                          <div>
                            <div className="font-medium text-slate-200">{shift.operatorName}</div>
                            {shift.clientName && (
                              <div className="text-xs text-amber-300 font-medium">{shift.clientName}</div>
                            )}
                            <span className="text-xs text-slate-400">{shift.siteName}</span>
                          </div>
                        </td>

                        <td className={`${cellPadClass} text-center font-mono num-mono`}>
                          <span className="text-slate-400">{shift.startHours}</span>
                          <span className="text-slate-600 mx-1">→</span>
                          <span className="text-white font-bold">{shift.endHours}</span>
                          {shift.photoVerified && (
                            <span className="ml-1.5 text-xs text-emerald-400" title="Фото счётчика проверено">
                              📷
                            </span>
                          )}
                        </td>

                        <td className={`${cellPadClass} text-right`}>
                          <span className="font-mono font-bold text-white text-[14px] num-mono">{shift.workHours} ч</span>
                          {shift.relocationHours ? (
                            <div className="text-xs text-sky-400 font-mono num-mono">
                              Перегон: {shift.relocationHours} ч
                            </div>
                          ) : null}
                          {shift.downtimeHours > 0 && (
                            <div className="text-xs text-amber-400 font-mono num-mono">
                              Простой: {shift.downtimeHours} ч
                            </div>
                          )}
                        </td>

                        <td className={`${cellPadClass} text-right`}>
                          <span className="font-mono text-slate-200 font-medium num-mono">{shift.fuelLitersAdded} л</span>
                          <span className="block text-xs text-slate-400 font-mono num-mono">
                            ({shift.fuelHourlyCalculated} л/ч)
                          </span>
                          {shift.paymentCategory && (
                            <span className="block text-xs text-sky-300 mt-0.5">
                              {shift.cardLast4 ? `*${shift.cardLast4} · ` : ''}
                              {paymentLabelMap[shift.paymentCategory]}
                              {shift.paymentAmountRub ? ` · ${shift.paymentAmountRub.toLocaleString()} ₽` : ''}
                            </span>
                          )}
                        </td>

                        <td className={`${cellPadClass} text-right`}>
                          <span className="font-mono font-bold text-emerald-400 num-mono">
                            {shift.calculatedSalary.toLocaleString()} ₽
                          </span>
                        </td>

                        <td className={`${cellPadClass} text-center`}>
                          {shift.status === 'anomaly' ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs font-semibold">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              <span>Аномалия</span>
                            </div>
                          ) : shift.status === 'pending' ? (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-semibold">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>На утверждении (ПЛ)</span>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-xs font-medium">
                              <CheckCircle className="w-3 h-3 text-emerald-400" />
                              <span>Проверено</span>
                            </div>
                          )}
                        </td>

                        <td className={`${cellPadClass} text-right`}>
                          {shift.status !== 'approved' && (() => {
                            const canCloseRow = adminConfirmationAllowed && hasActiveRequest;
                            return (
                              <button
                                type="button"
                                disabled={!canCloseRow}
                                onClick={() => canCloseRow && onApproveShift(shift.id)}
                                title={
                                  canCloseRow
                                    ? 'Закрыть смену и подтвердить часы / объём'
                                    : !adminConfirmationAllowed && !hasActiveRequest
                                    ? 'Требуется разрешение админа и созданная активная заявка'
                                    : !adminConfirmationAllowed
                                    ? 'Кнопка активна только с разрешения администратора'
                                    : 'Для закрытия смены заявка должна быть создана и активна'
                                }
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[13px] rounded font-bold transition whitespace-nowrap ${
                                  canCloseRow
                                    ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 cursor-pointer'
                                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                                }`}
                              >
                                {!canCloseRow && <Lock className="w-3 h-3 text-rose-400" />}
                                <span>Закрыть смену</span>
                              </button>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Full Timesheet Tab (Т-13) */
        <div className="space-y-2">
          {/* Add Driver Inline Form */}
          {isAddDriverOpen && onAddDriver && (
            <form
              onSubmit={handleCreateDriver}
              className="p-3 rounded-xl bg-slate-900 border border-amber-500/40 grid grid-cols-1 sm:grid-cols-7 gap-2 items-end text-xs"
            >
              <div>
                <label className="block font-medium text-slate-300 mb-1">ФИО машиниста</label>
                <input
                  type="text"
                  placeholder="Иванов А. С."
                  value={newDriverName}
                  onChange={(e) => setNewDriverName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Телефон (MAX)</label>
                <input
                  type="tel"
                  value={newDriverPhone}
                  onChange={(e) => setNewDriverPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sky-300 font-mono focus:outline-none focus:border-amber-500"
                  required
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Карта (4 ц.)</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="4819"
                  value={newDriverCardLast4}
                  onChange={(e) => setNewDriverCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Участок</label>
                <select
                  value={newDriverBranchId}
                  onChange={(e) => setNewDriverBranchId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      [{b.code}] {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">Техника</label>
                <select
                  value={newDriverEqId}
                  onChange={(e) => setNewDriverEqId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                >
                  <option value="">Без закрепления</option>
                  {equipmentList.map(eq => (
                    <option key={eq.id} value={eq.id}>
                      [{eq.inventoryNumber}] {eq.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-medium text-slate-300 mb-1">График смены</label>
                <select
                  value={newDriverShift}
                  onChange={(e) => setNewDriverShift(e.target.value as DriverShiftRoster)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="shift_1">Смена 1 (день)</option>
                  <option value="shift_2">Смена 2 (ночь)</option>
                </select>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="submit"
                  className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
                >
                  Добавить
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddDriverOpen(false)}
                  className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  Отмена
                </button>
              </div>
            </form>
          )}

          {/* Filter + Legend Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={rosterSearch}
                  onChange={(e) => setRosterSearch(e.target.value)}
                  placeholder="Поиск по ФИО, телефону или инв. №..."
                  className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-slate-100 placeholder-slate-500 w-60 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                {(
                  [
                    { id: 'all', label: 'Все экипажи' },
                    { id: 'shift_1', label: 'Смена 1 (день)' },
                    { id: 'shift_2', label: 'Смена 2 (ночь)' },
                    { id: 'replacement', label: 'Требуется замена' }
                  ] as const
                ).map(item => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setRosterShiftFilter(item.id)}
                    className={`px-2.5 py-1 rounded-lg border text-xs font-medium transition cursor-pointer ${
                      rosterShiftFilter === item.id
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
              <span>Клик по дню меняет код:</span>
              {DAY_CODE_SEQUENCE.map(code => (
                <span
                  key={code}
                  title={DAY_CODE_META[code].label}
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border font-mono font-bold ${DAY_CODE_META[code].pillClass}`}
                >
                  {code}
                </span>
              ))}
              <span className="text-slate-500">(Я/Н=10ч, В/Б/О=0ч)</span>
            </div>
          </div>

          {/* Real Timesheet Table (Т-13) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="text-[11px] uppercase tracking-wider text-slate-400 bg-slate-950/70 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 min-w-[165px]">Машинист (ФИО)</th>
                    <th className="py-2.5 px-2.5 min-w-[140px]">Телефон (MAX)</th>
                    <th className="py-2.5 px-2 min-w-[78px]">Карта</th>
                    <th className="py-2.5 px-2.5 min-w-[170px]">Техника</th>
                    <th className="py-2.5 px-2.5 min-w-[115px]">Смена</th>
                    {TIMESHEET_DAYS.map(day => (
                      <th key={day} className="py-2.5 px-1 text-center font-mono w-7">
                        {day}
                      </th>
                    ))}
                    <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Итого</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">Статус</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredDrivers.map(drv => {
                    const daysMap = getDriverDaysMap(drv);
                    const workShiftsCount = Object.values(daysMap).filter(c => c === 'Я' || c === 'Н').length;
                    const workHoursTotal = Object.values(daysMap).reduce(
                      (s, c) => s + DAY_CODE_META[c].hours,
                      0
                    );
                    const primaryEqId = drv.assignedEquipmentIds[0] || '';
                    const branchEq = equipmentList.filter(e => e.branchId === drv.branchId);
                    const eqOptions = branchEq.length > 0 ? branchEq : equipmentList;

                    return (
                      <tr key={drv.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={drv.name}
                            onChange={(e) =>
                              onUpdateDriver?.({ ...drv, name: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded px-2 py-1 text-slate-100 font-medium focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2.5">
                          <input
                            type="tel"
                            value={drv.phone}
                            onChange={(e) =>
                              onUpdateDriver?.({ ...drv, phone: e.target.value })
                            }
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded px-2 py-1 text-sky-300 font-mono focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="text"
                            maxLength={4}
                            placeholder="4819"
                            value={drv.cardLast4 || ''}
                            onChange={(e) =>
                              onUpdateDriver?.({
                                ...drv,
                                cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) || undefined
                              })
                            }
                            className="w-16 bg-slate-950 border border-slate-800 focus:border-amber-500 rounded px-2 py-1 text-amber-300 font-mono focus:outline-none"
                          />
                        </td>
                        <td className="py-2 px-2.5">
                          <select
                            value={primaryEqId}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              onUpdateDriver?.({
                                ...drv,
                                assignedEquipmentIds: selectedId ? [selectedId] : []
                              });
                            }}
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded px-2 py-1 text-slate-200 font-mono text-[11px] focus:outline-none"
                          >
                            <option value="">Без закрепления</option>
                            {eqOptions.map(eq => (
                              <option key={eq.id} value={eq.id}>
                                [{eq.inventoryNumber}] {eq.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 px-2.5">
                          <select
                            value={drv.shiftRoster}
                            onChange={(e) =>
                              onUpdateDriver?.({
                                ...drv,
                                shiftRoster: e.target.value as DriverShiftRoster
                              })
                            }
                            className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none"
                          >
                            <option value="shift_1">Смена 1 (день)</option>
                            <option value="shift_2">Смена 2 (ночь)</option>
                          </select>
                        </td>

                        {TIMESHEET_DAYS.map(day => {
                          const code = daysMap[day];
                          return (
                            <td key={day} className="py-2 px-0.5 text-center">
                              <button
                                type="button"
                                onClick={() => handleCycleDayCode(drv, day)}
                                title={`${day} число: ${DAY_CODE_META[code].label}. Нажмите для смены отметки.`}
                                className={`w-6 h-6 rounded border font-mono text-[11px] font-bold transition cursor-pointer ${DAY_CODE_META[code].pillClass}`}
                              >
                                {code}
                              </button>
                            </td>
                          );
                        })}

                        <td className="py-2 px-2.5 text-right whitespace-nowrap">
                          <span className="font-mono font-bold text-white num-mono">
                            {workShiftsCount} см
                          </span>
                          <span className="block text-[11px] text-emerald-400 font-mono num-mono">
                            {workHoursTotal} ч
                          </span>
                        </td>

                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              onUpdateDriver?.({
                                ...drv,
                                needsReplacement: !drv.needsReplacement
                              })
                            }
                            className={`px-2 py-1 rounded border text-[11px] font-semibold transition cursor-pointer ${
                              drv.needsReplacement
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                            }`}
                          >
                            {drv.needsReplacement ? 'Требуется замена' : 'На линии'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredDrivers.length === 0 && (
                    <tr>
                      <td colSpan={22} className="py-8 text-center text-slate-500">
                        По текущему фильтру машинисты не найдены.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
