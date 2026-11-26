import React, { useState } from 'react';
import { 
  TrendingUp, 
  AlertTriangle, 
  Sparkles, 
  ArrowUpRight, 
  Fuel, 
  UserCheck, 
  Wrench, 
  Truck,
  CheckCircle2,
  Clock,
  ArrowRight,
  Wallet,
  Building2,
  ChevronDown,
  ChevronUp,
  Calendar,
  CalendarDays,
  Handshake
} from 'lucide-react';
import { Equipment, AnomalyAlert, ShiftReport, FleetBranch } from '../../types';
import { MetricCard } from '../MetricCard';
import {
  BRANCH_OVERHEAD_CATEGORIES,
  aggregateBranchFixedOverheads
} from '../../utils/branchOverheads';
import {
  computeEquipmentProfitRanking,
  computeDirectCostsBreakdown
} from '../../utils/periodAnalytics';
import { AllBranchesFinancialTables } from './AllBranchesFinancialTables';

interface DashboardViewProps {
  equipmentList: Equipment[];
  anomalies: AnomalyAlert[];
  shiftReports: ShiftReport[];
  activeBranch?: FleetBranch | null;
  branches?: FleetBranch[];
  onSelectEquipment: (eq: Equipment) => void;
  onOpenAiAnalyst: () => void;
  onNavigateToTab: (tab: any) => void;
  onResolveAnomaly: (id: string) => void;
  onSelectBranch?: (branchId: string | 'all') => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  equipmentList,
  anomalies,
  shiftReports,
  activeBranch,
  branches = [],
  onSelectEquipment,
  onOpenAiAnalyst,
  onNavigateToTab,
  onResolveAnomaly,
  onSelectBranch
}) => {
  // Aggregate real-time totals
  const totalRevenue = equipmentList.reduce((sum, e) => sum + e.revenueMonth, 0);
  const totalDirectCosts = equipmentList.reduce((sum, e) => 
    sum + e.fuelCostMonth + e.driverSalaryMonth + e.repairCostMonth + e.transportCostMonth + (e.subcontractCostMonth ?? 0), 0
  );
  const totalEquipmentOverheads = equipmentList.reduce((sum, e) => sum + e.overheadsAllocated, 0);
  const branchFixedOverheads = aggregateBranchFixedOverheads(branches, activeBranch ?? null);
  const totalOverheads = totalEquipmentOverheads + branchFixedOverheads.total;
  const totalOperatingProfit = totalRevenue - totalDirectCosts - totalOverheads;
  const averageMargin = totalRevenue > 0 ? (totalOperatingProfit / totalRevenue) * 100 : 0;

  const totalMonthHours = equipmentList.reduce((sum, e) => sum + e.monthHours, 0);
  const totalDowntimeHours = equipmentList.reduce((sum, e) => sum + e.downtimeHoursMonth, 0);
  const fleetUtilization = equipmentList.length > 0 && totalMonthHours > 0 ? (totalMonthHours / (equipmentList.length * 200)) * 100 : 0;
  const fleetDowntime = (totalMonthHours + totalDowntimeHours) > 0 
    ? (totalDowntimeHours / (totalMonthHours + totalDowntimeHours)) * 100 
    : 0;

  // Ranking period controls & calculations
  const latestShiftDate = shiftReports.reduce((latest, s) => (s.date > latest ? s.date : latest), '') || '2026-11-02';
  const activeDataYearMonth = latestShiftDate.slice(0, 7) || '2026-11';

  const [isRankingOpen, setIsRankingOpen] = useState(true);
  const [showAllRanking, setShowAllRanking] = useState(false);
  const [rankingPeriodMode, setRankingPeriodMode] = useState<'month' | 'date'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(latestShiftDate);
  const [selectedMonth, setSelectedMonth] = useState<string>(activeDataYearMonth.slice(5, 7) || '11');
  const [selectedYear, setSelectedYear] = useState<string>(activeDataYearMonth.slice(0, 4) || '2026');

  const selectedYearMonth = `${selectedYear}-${selectedMonth}`;

  const availableYears = Array.from(
    new Set(['2025', '2026', '2027', ...shiftReports.map(s => s.date.slice(0, 4)).filter(Boolean)])
  ).sort();

  const monthOptions = [
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

  const selectedMonthLabel = monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  // Direct costs period controls & calculations
  const [directPeriodMode, setDirectPeriodMode] = useState<'month' | 'date'>('month');
  const [directSelectedDate, setDirectSelectedDate] = useState<string>(latestShiftDate);
  const [directSelectedMonth, setDirectSelectedMonth] = useState<string>(activeDataYearMonth.slice(5, 7) || '11');
  const [directSelectedYear, setDirectSelectedYear] = useState<string>(activeDataYearMonth.slice(0, 4) || '2026');

  const directSelectedMonthLabel =
    monthOptions.find(m => m.value === directSelectedMonth)?.label || directSelectedMonth;

  // Fixed overheads period controls & calculations
  const [fixedPeriodMode, setFixedPeriodMode] = useState<'month' | 'date'>('month');
  const [fixedSelectedDate, setFixedSelectedDate] = useState<string>(latestShiftDate);
  const [fixedSelectedMonth, setFixedSelectedMonth] = useState<string>(activeDataYearMonth.slice(5, 7) || '11');
  const [fixedSelectedYear, setFixedSelectedYear] = useState<string>(activeDataYearMonth.slice(0, 4) || '2026');

  const fixedSelectedMonthLabel =
    monthOptions.find(m => m.value === fixedSelectedMonth)?.label || fixedSelectedMonth;

  const fixedActiveMonthsCount = (() => {
    if (fixedSelectedMonth !== 'all') return 1;
    const activeYear = activeDataYearMonth.slice(0, 4);
    if (fixedSelectedYear === activeYear) {
      const hasDecShifts = shiftReports.some(s => s.date.startsWith(`${fixedSelectedYear}-12`));
      return hasDecShifts ? 12 : Math.max(1, parseInt(activeDataYearMonth.slice(5, 7), 10) || 11);
    }
    return 12;
  })();

  const scaleFixedAmount = (monthlyRub: number): number => {
    if (fixedPeriodMode === 'date') return Math.round(monthlyRub / 30);
    if (fixedSelectedMonth === 'all') return monthlyRub * fixedActiveMonthsCount;
    return monthlyRub;
  };

  const fixedPeriodTotal = BRANCH_OVERHEAD_CATEGORIES.reduce(
    (sum, cat) => sum + scaleFixedAmount(branchFixedOverheads.byCategory[cat.id] || 0),
    0
  );
  const fixedPerEquipment =
    equipmentList.length > 0 ? Math.round(fixedPeriodTotal / equipmentList.length) : 0;

  const shiftsForSelectedDate = shiftReports.filter(s => s.date === selectedDate);

  const formatTripsLabel = (count: number) => {
    const abs = Math.abs(count) % 100;
    const mod10 = abs % 10;
    if (abs > 10 && abs < 20) return `${count} рейсов`;
    if (mod10 === 1) return `${count} рейс`;
    if (mod10 >= 2 && mod10 <= 4) return `${count} рейса`;
    return `${count} рейсов`;
  };

  const rankingRows = computeEquipmentProfitRanking({
    equipmentList,
    shiftReports,
    mode: rankingPeriodMode,
    selectedDate,
    selectedYear,
    selectedMonth,
    activeDataYearMonth
  });

  const periodSummary = rankingRows.reduce(
    (acc, row) => {
      acc.hours += row.hours;
      acc.mileageKm += row.mileageKm;
      acc.tripsCount += row.tripsCount;
      acc.revenue += row.revenue;
      acc.expenses += row.expenses;
      acc.profit += row.profit;
      return acc;
    },
    { hours: 0, mileageKm: 0, tripsCount: 0, revenue: 0, expenses: 0, profit: 0 }
  );
  const periodSummaryMargin =
    periodSummary.revenue > 0 ? (periodSummary.profit / periodSummary.revenue) * 100 : 0;

  const regularRankingRows = rankingRows.filter(r => r.eq.type !== 'dump_truck');
  const dumpTruckRankingRows = rankingRows.filter(r => r.eq.type === 'dump_truck');
  const visibleRegularRows = showAllRanking ? regularRankingRows : regularRankingRows.slice(0, 6);
  const visibleDumpTruckRows = dumpTruckRankingRows;

  const directBreakdown = computeDirectCostsBreakdown({
    equipmentList,
    shiftReports,
    mode: directPeriodMode,
    selectedDate: directSelectedDate,
    selectedYear: directSelectedYear,
    selectedMonth: directSelectedMonth,
    activeDataYearMonth
  });

  const activeAnomalies = anomalies.filter(a => !a.resolved);
  const fuelShare = directBreakdown.totalDirectCosts > 0 ? (directBreakdown.fuelCost / directBreakdown.totalDirectCosts) * 100 : 0;
  const salaryShare = directBreakdown.totalDirectCosts > 0 ? (directBreakdown.salaryCost / directBreakdown.totalDirectCosts) * 100 : 0;
  const repairShare = directBreakdown.totalDirectCosts > 0 ? (directBreakdown.repairCost / directBreakdown.totalDirectCosts) * 100 : 0;
  const transportShare = directBreakdown.totalDirectCosts > 0 ? (directBreakdown.transportCost / directBreakdown.totalDirectCosts) * 100 : 0;
  const subcontractShare = directBreakdown.totalDirectCosts > 0 ? (directBreakdown.subcontractCost / directBreakdown.totalDirectCosts) * 100 : 0;
  const formattedDirectTotal =
    directBreakdown.totalDirectCosts >= 100_000
      ? `${(directBreakdown.totalDirectCosts / 1_000_000).toFixed(2)} млн ₽`
      : `${directBreakdown.totalDirectCosts.toLocaleString()} ₽`;

  return (
    <div className="p-2.5 space-y-2 max-w-7xl mx-auto">
      {/* Top Welcome & AI Prompt banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/95 to-amber-950/30 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="text-[14px] uppercase font-mono text-amber-400 font-semibold tracking-wider">
              {activeBranch
                ? `Участок ${activeBranch.code} · Fleet Manager: ${activeBranch.fleetManagerName} · Поток ${activeBranch.documentFlow.orderPrefix}`
                : `Сводный контур предприятия · ${branches.length} участков`}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {activeBranch ? activeBranch.name : 'Панель управления (Все участки)'}
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            Парк строительной техники: <strong className="text-slate-200">{equipmentList.length} единиц</strong> · {activeBranch ? activeBranch.city : 'Москва, Казань и филиалы'} · Смен в реестре: <strong className="text-slate-200">{shiftReports.length}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAiAnalyst}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Задать вопрос AI Аналитику</span>
          </button>
        </div>
      </div>

      {/* Top 4 Primary KPI cards from Section 7 of Blueprint */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <MetricCard
          title="Выручка за месяц"
          value={`${(totalRevenue / 1_000_000).toFixed(2)} млн ₽`}
          subValue="Revenue"
          trend={{ positive: true, text: "+12.4%" }}
          icon={<TrendingUp className="w-4 h-4 text-emerald-400" />}
          badge={`${totalMonthHours.toLocaleString()} моточасов`}
          highlight
        />

        <MetricCard
          title="Операционная прибыль"
          value={`${(totalOperatingProfit / 1_000_000).toFixed(2)} млн ₽`}
          subValue={`Маржа ${averageMargin.toFixed(1)}%`}
          trend={{ positive: true, text: "+8.1%" }}
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          badge="Operating Profit"
        />

        <MetricCard
          title="Загрузка парка"
          value={`${fleetUtilization.toFixed(1)}%`}
          subValue="Utilization"
          trend={{ positive: true, text: "+4.2 п.п." }}
          icon={<Truck className="w-4 h-4 text-blue-400" />}
          badge="Цель: 75%+"
        />

        <MetricCard
          title="Простой техники"
          value={`${fleetDowntime.toFixed(1)}%`}
          subValue={`${totalDowntimeHours} ч`}
          trend={{ positive: false, text: "Выше нормы" }}
          icon={<Clock className="w-4 h-4 text-amber-400" />}
          badge="Целевой: <8.0%"
        />
      </div>

      {/* Formula Transparency Widget: Revenue - DirectCosts - AllocatedOverheads */}
      <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-1.5 mb-2 text-xs">
          <span className="font-semibold text-slate-200 uppercase tracking-wide">
            Операционный финансовый расчёт (Строгая методология)
          </span>
          <span className="text-[13px] font-mono text-slate-400">
            Operating Profit = Revenue - DirectCosts - Overheads
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-xs">
          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">1. Валовая выручка (Revenue)</span>
            <span className="text-base font-bold text-white num-mono">+{totalRevenue.toLocaleString()} ₽</span>
            <span className="text-xs text-slate-500 block mt-0.5">Счета за фактически отработанные часы</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">2. Прямые затраты (Direct Costs)</span>
            <span className="text-base font-bold text-rose-400 num-mono">-{totalDirectCosts.toLocaleString()} ₽</span>
            <span className="text-xs text-slate-500 block mt-0.5">Топливо + З/П машинистов + ТО + Трал + Субподряд</span>
          </div>

          <div className="p-3 bg-slate-950 rounded-lg border border-slate-800/80">
            <span className="text-slate-400 block text-[11px]">3. Условно-постоянные и накладные</span>
            <span className="text-base font-bold text-amber-400 num-mono">-{totalOverheads.toLocaleString()} ₽</span>
            <span className="text-xs text-slate-500 block mt-0.5">
              Постоянные участка: {branchFixedOverheads.total.toLocaleString()} ₽ · Парк: {totalEquipmentOverheads.toLocaleString()} ₽
            </span>
          </div>

          <div className="p-3 bg-gradient-to-br from-slate-950 to-emerald-950/20 rounded-lg border border-emerald-500/30">
            <span className="text-emerald-400 block text-[11px] font-medium">4. Итоговая операционная прибыль</span>
            <span className="text-base font-bold text-emerald-400 num-mono">={totalOperatingProfit.toLocaleString()} ₽</span>
            <span className="text-xs text-emerald-500 block mt-0.5">Рентабельность: {averageMargin.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* Real-time Anomalies Strip (Critical Alerts requiring immediate action) */}
      {activeAnomalies.length > 0 && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 animate-pulse" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-rose-300">
                Контролёр аномалий (AI Auditor) — обнаружено {activeAnomalies.length} инцидента
              </h3>
            </div>
            <button
              onClick={() => onNavigateToTab('timesheets')}
              className="text-[14px] text-rose-300 hover:text-white flex items-center gap-1 transition cursor-pointer font-medium"
            >
              <span>Перейти в табели смен</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {activeAnomalies.slice(0, 2).map((alert) => (
              <div 
                key={alert.id}
                className="p-2.5 bg-slate-900/90 rounded-lg border border-rose-500/30 flex items-start justify-between gap-2 text-[14px]"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{alert.title}</span>
                    {alert.equipmentName && (
                      <span className="font-mono text-xs px-1.5 py-0.2 rounded bg-slate-800 text-amber-300 border border-slate-700">
                        {alert.equipmentName}
                      </span>
                    )}
                  </div>
                  <p className="text-[13px] text-slate-300 leading-relaxed">{alert.description}</p>
                  {alert.impactRubles && (
                    <span className="text-xs font-mono text-rose-400 font-semibold block">
                      Риск потерь: ~{alert.impactRubles.toLocaleString()} ₽
                    </span>
                  )}
                </div>

                <button
                  onClick={() => onResolveAnomaly(alert.id)}
                  className="px-2.5 py-1 text-[13px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer shrink-0 font-medium"
                >
                  Устранено
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All-Branches Expense, Profit & Consolidated Financial Calculation Tables */}
      {!activeBranch && (
        <AllBranchesFinancialTables
          branches={branches}
          equipmentList={equipmentList}
          shiftReports={shiftReports}
          latestShiftDate={latestShiftDate}
          activeDataYearMonth={activeDataYearMonth}
          availableYears={availableYears}
          monthOptions={monthOptions}
          onSelectBranch={onSelectBranch}
          onNavigateToBranches={() => onNavigateToTab('branches')}
        />
      )}

      {/* Middle Section: 50/50 Direct Costs (Left) + Fixed Overheads Table (Right), then Ranking below */}
      <div className="space-y-2">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
          {/* Left Column (50%): Direct Costs Structure with Period Selector */}
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-white">Структура прямых расходов</h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {directPeriodMode === 'date'
                        ? `За сутки: ${directSelectedDate.split('-').reverse().join('.')}`
                        : directSelectedMonth === 'all'
                          ? `За ${directSelectedYear} г. (все месяцы)`
                          : `${directSelectedMonthLabel} ${directSelectedYear}`}
                    </span>
                  </div>
                  <p className="text-[14px] text-slate-400 mt-0.5">
                    Всего прямых затрат: <strong className="text-white num-mono">{formattedDirectTotal}</strong>
                  </p>
                </div>
              </div>

              {/* Direct Costs Period Selector Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800/80">
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setDirectPeriodMode('date')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                      directPeriodMode === 'date'
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Дата</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectPeriodMode('month')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                      directPeriodMode === 'month'
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Месяц</span>
                  </button>
                </div>

                {directPeriodMode === 'date' ? (
                  <input
                    type="date"
                    value={directSelectedDate}
                    onChange={(e) => {
                      if (e.target.value) setDirectSelectedDate(e.target.value);
                    }}
                    aria-label="Выбор даты для прямых расходов"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={directSelectedMonth}
                      onChange={(e) => setDirectSelectedMonth(e.target.value)}
                      aria-label="Выбор месяца для прямых расходов"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {monthOptions.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={directSelectedYear}
                      onChange={(e) => setDirectSelectedYear(e.target.value)}
                      aria-label="Выбор года для прямых расходов"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2.5 text-[14px]">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Fuel className="w-3.5 h-3.5 text-amber-400" /> Дизельное топливо (ГСМ)
                    </span>
                    <span className="font-mono font-bold text-white">{directBreakdown.fuelCost.toLocaleString()} ₽</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-amber-400 h-full rounded-full" style={{ width: `${fuelShare}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{fuelShare.toFixed(1)}% от расходов</span>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-blue-400" /> Зарплата машинистов (Сдельщина)
                    </span>
                    <span className="font-mono font-bold text-white">{directBreakdown.salaryCost.toLocaleString()} ₽</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-blue-400 h-full rounded-full" style={{ width: `${salaryShare}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{salaryShare.toFixed(1)}% от расходов</span>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-rose-400" /> Запчасти, ТО и Ремонты
                    </span>
                    <span className="font-mono font-bold text-white">{directBreakdown.repairCost.toLocaleString()} ₽</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-rose-400 h-full rounded-full" style={{ width: `${repairShare}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{repairShare.toFixed(1)}% от расходов</span>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-emerald-400" /> Трал / Доставка на объект
                    </span>
                    <span className="font-mono font-bold text-white">{directBreakdown.transportCost.toLocaleString()} ₽</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${transportShare}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{transportShare.toFixed(1)}% от расходов</span>
                </div>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="text-slate-300 flex items-center gap-1.5">
                      <Handshake className="w-3.5 h-3.5 text-violet-400" /> Субподряд (привлечённая техника / услуги)
                    </span>
                    <span className="font-mono font-bold text-white">{directBreakdown.subcontractCost.toLocaleString()} ₽</span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div className="bg-violet-400 h-full rounded-full" style={{ width: `${subcontractShare}%` }} />
                  </div>
                  <span className="text-xs text-slate-500 font-mono">{subcontractShare.toFixed(1)}% от расходов</span>
                </div>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800 text-[13px] text-slate-400">
              💡 Себестоимость одного машино-часа по парку: <strong className="text-slate-200 num-mono">{directBreakdown.avgCostPerHour.toLocaleString()} ₽/ч</strong>
            </div>
          </div>

          {/* Right Column (50%): Fixed Overheads Table with Period Selector */}
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex flex-col justify-between">
            <div>
              <div className="flex flex-wrap items-start justify-between gap-2 mb-2.5">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
                    <h3 className="text-sm font-bold text-white">
                      Постоянные расходы {activeBranch ? `[${activeBranch.code}]` : '(Все участки)'}
                    </h3>
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                      {fixedPeriodMode === 'date'
                        ? `За сутки: ${fixedSelectedDate.split('-').reverse().join('.')}`
                        : fixedSelectedMonth === 'all'
                          ? `За ${fixedSelectedYear} г. (${fixedActiveMonthsCount} мес.)`
                          : `${fixedSelectedMonthLabel} ${fixedSelectedYear}`}
                    </span>
                  </div>
                  <p className="text-[13px] text-slate-400 mt-0.5">
                    Зарплата офис и ИТР, АХЧ, лизинг, налоги и прочие
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigateToTab('branches')}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer font-medium shrink-0"
                >
                  <Building2 className="w-3.5 h-3.5" />
                  <span>Настроить</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Period Selector Controls */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-800/80">
                <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setFixedPeriodMode('date')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                      fixedPeriodMode === 'date'
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Дата</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFixedPeriodMode('month')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                      fixedPeriodMode === 'month'
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <CalendarDays className="w-3.5 h-3.5" />
                    <span>Месяц</span>
                  </button>
                </div>

                {fixedPeriodMode === 'date' ? (
                  <input
                    type="date"
                    value={fixedSelectedDate}
                    onChange={(e) => {
                      if (e.target.value) setFixedSelectedDate(e.target.value);
                    }}
                    aria-label="Выбор даты для постоянных расходов"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                ) : (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={fixedSelectedMonth}
                      onChange={(e) => setFixedSelectedMonth(e.target.value)}
                      aria-label="Выбор месяца для постоянных расходов"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {monthOptions.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                    <select
                      value={fixedSelectedYear}
                      onChange={(e) => setFixedSelectedYear(e.target.value)}
                      aria-label="Выбор года для постоянных расходов"
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {availableYears.map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Fixed Expenses Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-2">Статья расходов</th>
                      <th className="py-2 px-2 text-right">Сумма</th>
                      <th className="py-2 px-2 text-right">Доля</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {BRANCH_OVERHEAD_CATEGORIES.map(cat => {
                      const baseMonthly = branchFixedOverheads.byCategory[cat.id] || 0;
                      const amount = scaleFixedAmount(baseMonthly);
                      const share = fixedPeriodTotal > 0 ? (amount / fixedPeriodTotal) * 100 : 0;
                      const catItems = branchFixedOverheads.items.filter(i => i.category === cat.id);
                      const subtitle =
                        catItems.length > 0
                          ? catItems
                              .map(i => (activeBranch ? i.name : `[${i.branchCode}] ${i.name}`))
                              .slice(0, 2)
                              .join(' · ')
                          : cat.defaultNote;

                      return (
                        <tr key={cat.id} className="hover:bg-slate-800/40 transition">
                          <td className="py-2 px-2">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[11px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${cat.badgeClass}`}>
                                {cat.shortLabel}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400 line-clamp-1">{subtitle}</p>
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-bold text-white whitespace-nowrap">
                            {amount.toLocaleString()} ₽
                          </td>
                          <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-slate-300 text-xs">{share.toFixed(1)}%</span>
                              <div className="w-14 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                <div className={`${cat.barClass} h-full rounded-full`} style={{ width: `${share}%` }} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="border-t-2 border-slate-700 bg-slate-950/80 text-[13px]">
                    <tr>
                      <td className="py-2 px-2 font-bold text-slate-200">
                        Итого постоянных расходов
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-amber-300 whitespace-nowrap">
                        {fixedPeriodTotal.toLocaleString()} ₽
                      </td>
                      <td className="py-2 px-2 text-right font-mono font-semibold text-slate-300">
                        100.0%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="mt-3 pt-2.5 border-t border-slate-800 text-[13px] text-slate-400">
              📌 Постоянные расходы на 1 единицу техники ({equipmentList.length} ед.):{' '}
              <strong className="text-slate-200 num-mono">{fixedPerEquipment.toLocaleString()} ₽</strong>
            </div>
          </div>
        </div>

        {/* Fleet Profitability Ranking (Full-width single column, expandable) */}
        <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIsRankingOpen(prev => !prev)}
              className="flex items-center gap-2.5 text-left group cursor-pointer"
            >
              <span className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white group-hover:bg-slate-700 transition">
                {isRankingOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                    Рейтинг техники по операционной прибыли
                  </h3>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    {rankingRows.length} ед.
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                    {rankingPeriodMode === 'date'
                      ? `За сутки: ${selectedDate.split('-').reverse().join('.')}`
                      : selectedMonth === 'all'
                        ? `За ${selectedYear} год (все месяцы)`
                        : `За месяц: ${selectedMonthLabel} ${selectedYear}`}
                  </span>
                </div>
                <p className="text-[14px] text-slate-400">
                  {rankingPeriodMode === 'date'
                    ? `Сводный расчёт за конкретные сутки по табелям смен (смен за день: ${shiftsForSelectedDate.length})`
                    : selectedMonth === 'all'
                      ? `Сводный расчёт доходности за все месяцы ${selectedYear} года с учётом прямых расходов и накладных`
                      : 'Сводный расчёт доходности за выбранный месяц с учётом прямых расходов и накладных'}
                </p>
              </div>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {/* Period Mode Buttons: Дата / Месяц */}
              <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setRankingPeriodMode('date')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                    rankingPeriodMode === 'date'
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Дата</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRankingPeriodMode('month')}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition cursor-pointer ${
                    rankingPeriodMode === 'month'
                      ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" />
                  <span>Месяц</span>
                </button>
              </div>

              {/* Period Value Picker */}
              {rankingPeriodMode === 'date' ? (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) setSelectedDate(e.target.value);
                  }}
                  aria-label="Выбор конкретной даты"
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              ) : (
                <div className="flex items-center gap-1.5">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    aria-label="Выбор месяца"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {monthOptions.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    aria-label="Выбор года"
                    className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    {availableYears.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsRankingOpen(prev => !prev)}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1.5 transition cursor-pointer font-medium"
              >
                {isRankingOpen ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5" />
                    <span>Свернуть</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5" />
                    <span>Развернуть</span>
                  </>
                )}
              </button>
              <button
                onClick={() => onNavigateToTab('fleet')}
                className="text-[14px] text-amber-400 hover:text-amber-300 flex items-center gap-1 transition cursor-pointer font-medium"
              >
                <span>Весь парк</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {isRankingOpen && (
            <div className="mt-3">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[14px]">
                  <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">Инв. № / Модель</th>
                      <th className="py-2.5 px-3 text-right">Пробег / м.часы</th>
                      <th className="py-2.5 px-3 text-right">Наработка</th>
                      <th className="py-2.5 px-3 text-right">Выручка</th>
                      <th className="py-2.5 px-3 text-right">Расходы</th>
                      <th className="py-2.5 px-3 text-right">Прибыль</th>
                      <th className="py-2.5 px-3 text-right">Маржа</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {rankingRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-slate-500 text-[14px]">
                          На данном участке пока нет закреплённой спецтехники. Загрузите реестр через Excel (.xlsx) или переключитесь на другой участок.
                        </td>
                      </tr>
                    ) : (
                      <>
                        {visibleRegularRows.map(({ eq, hours, mileageKm, revenue, expenses, profit, margin }) => (
                          <tr
                            key={eq.id}
                            onClick={() => onSelectEquipment(eq)}
                            className="hover:bg-slate-800/50 transition cursor-pointer group"
                          >
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-amber-400 text-[13px] group-hover:underline">
                                  {eq.inventoryNumber}
                                </span>
                                <span className="text-slate-200 font-medium truncate max-w-xs">{eq.name}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                              <span>{mileageKm.toLocaleString()} км</span>
                              <span className="text-slate-500 mx-1">/</span>
                              <span className="text-sky-300">{hours} м.ч</span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                              {hours} ч
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                              {revenue.toLocaleString()} ₽
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-rose-400">
                              -{expenses.toLocaleString()} ₽
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {profit.toLocaleString()} ₽
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono">
                              <span className={`font-semibold ${margin > 30 ? 'text-emerald-400' : margin > 15 ? 'text-amber-400' : profit < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                {margin.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}

                        {visibleDumpTruckRows.length > 0 && (
                          <>
                            <tr className="bg-slate-950/80 border-t-2 border-slate-700/80">
                              <td colSpan={7} className="py-2 px-3">
                                <div className="flex items-center justify-between gap-2 text-xs">
                                  <span className="font-semibold text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                                    <Truck className="w-3.5 h-3.5 text-amber-400" />
                                    Самосвалы — пробег и рейсы ({visibleDumpTruckRows.length} ед.)
                                  </span>
                                  <span className="text-[11px] font-mono text-slate-400">
                                    Пробег (км) / Кол-во рейсов
                                  </span>
                                </div>
                              </td>
                            </tr>
                            {visibleDumpTruckRows.map(({ eq, hours, mileageKm, tripsCount, revenue, expenses, profit, margin }) => (
                              <tr
                                key={eq.id}
                                onClick={() => onSelectEquipment(eq)}
                                className="hover:bg-slate-800/50 transition cursor-pointer group bg-slate-950/30"
                              >
                                <td className="py-2.5 px-3">
                                  <div className="flex items-center gap-2">
                                    <span className="font-mono font-bold text-amber-400 text-[13px] group-hover:underline">
                                      {eq.inventoryNumber}
                                    </span>
                                    <span className="text-slate-200 font-medium truncate max-w-xs">{eq.name}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                                  <span>{mileageKm.toLocaleString()} км</span>
                                  <span className="text-slate-500 mx-1">/</span>
                                  <span className="text-amber-300">{formatTripsLabel(tripsCount)}</span>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                                  {hours} ч
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-200">
                                  {revenue.toLocaleString()} ₽
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-rose-400">
                                  -{expenses.toLocaleString()} ₽
                                </td>
                                <td className={`py-2.5 px-3 text-right font-mono font-bold ${profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {profit.toLocaleString()} ₽
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono">
                                  <span className={`font-semibold ${margin > 30 ? 'text-emerald-400' : margin > 15 ? 'text-amber-400' : profit < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                    {margin.toFixed(1)}%
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </tbody>
                  {rankingRows.length > 0 && (
                    <tfoot className="border-t-2 border-slate-700 bg-slate-950/90 text-[13px]">
                      <tr>
                        <td className="py-2.5 px-3 font-bold text-slate-200">
                          {rankingPeriodMode === 'date'
                            ? `Итого за ${selectedDate.split('-').reverse().join('.')}`
                            : selectedMonth === 'all'
                              ? `Итого за ${selectedYear} год`
                              : `Итого за ${selectedMonthLabel} ${selectedYear}`}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-300 whitespace-nowrap">
                          <span>{periodSummary.mileageKm.toLocaleString()} км</span>
                          {periodSummary.tripsCount > 0 && (
                            <>
                              <span className="text-slate-500 mx-1">/</span>
                              <span className="text-amber-300">{formatTripsLabel(periodSummary.tripsCount)}</span>
                            </>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-200">
                          {periodSummary.hours.toLocaleString()} ч
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-white">
                          {periodSummary.revenue.toLocaleString()} ₽
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-rose-400">
                          -{periodSummary.expenses.toLocaleString()} ₽
                        </td>
                        <td className={`py-2.5 px-3 text-right font-mono font-bold ${periodSummary.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {periodSummary.profit.toLocaleString()} ₽
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">
                          <span className={periodSummaryMargin > 30 ? 'text-emerald-400' : periodSummaryMargin > 15 ? 'text-amber-400' : periodSummary.profit < 0 ? 'text-rose-400' : 'text-slate-400'}>
                            {periodSummaryMargin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>

              {regularRankingRows.length > 6 && (
                <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex justify-center">
                  <button
                    type="button"
                    onClick={() => setShowAllRanking(prev => !prev)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-amber-400 hover:text-amber-300 border border-slate-700/80 flex items-center gap-1.5 transition cursor-pointer font-medium"
                  >
                    {showAllRanking ? (
                      <>
                        <ChevronUp className="w-3.5 h-3.5" />
                        <span>Свернуть список (показать топ-6)</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-3.5 h-3.5" />
                        <span>Развернуть весь рейтинг ({rankingRows.length} ед.)</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
