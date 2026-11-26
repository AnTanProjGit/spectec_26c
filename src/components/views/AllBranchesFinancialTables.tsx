import React, { useMemo, useState } from 'react';
import {
  Building2,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Download,
  ArrowUpRight
} from 'lucide-react';
import { Equipment, FleetBranch, ShiftReport } from '../../types';
import { computeBranchesFinancialSummary } from '../../utils/periodAnalytics';
import { exportBranchesSummaryToExcel } from '../../utils/excelUtils';

interface AllBranchesFinancialTablesProps {
  branches: FleetBranch[];
  equipmentList: Equipment[];
  shiftReports: ShiftReport[];
  latestShiftDate: string;
  activeDataYearMonth: string;
  availableYears: string[];
  monthOptions: { value: string; label: string }[];
  onSelectBranch?: (branchId: string | 'all') => void;
  onNavigateToBranches?: () => void;
}

export const AllBranchesFinancialTables: React.FC<AllBranchesFinancialTablesProps> = ({
  branches,
  equipmentList,
  shiftReports,
  latestShiftDate,
  activeDataYearMonth,
  availableYears,
  monthOptions,
  onSelectBranch,
  onNavigateToBranches
}) => {
  const [periodMode, setPeriodMode] = useState<'month' | 'date'>('month');
  const [selectedDate, setSelectedDate] = useState<string>(latestShiftDate);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    activeDataYearMonth.slice(5, 7) || '11'
  );
  const [selectedYear, setSelectedYear] = useState<string>(
    activeDataYearMonth.slice(0, 4) || '2026'
  );

  const [openBranchProfitTable, setOpenBranchProfitTable] = useState(true);
  const [openExpensesTable, setOpenExpensesTable] = useState(true);
  const [openConsolidatedTable, setOpenConsolidatedTable] = useState(true);

  const selectedMonthLabel =
    monthOptions.find(m => m.value === selectedMonth)?.label || selectedMonth;

  const summary = useMemo(
    () =>
      computeBranchesFinancialSummary({
        branches,
        equipmentList,
        shiftReports,
        mode: periodMode,
        selectedDate,
        selectedYear,
        selectedMonth,
        activeDataYearMonth
      }),
    [
      branches,
      equipmentList,
      shiftReports,
      periodMode,
      selectedDate,
      selectedYear,
      selectedMonth,
      activeDataYearMonth
    ]
  );

  const periodLabel =
    periodMode === 'date'
      ? `За сутки: ${selectedDate.split('-').reverse().join('.')}`
      : selectedMonth === 'all'
        ? `За ${selectedYear} г. (${summary.activeMonthsCount} мес.)`
        : `${selectedMonthLabel} ${selectedYear}`;

  const { branchRows, totals } = summary;

  const formatRub = (val: number, showPlus = false) => {
    const absStr = Math.abs(Math.round(val)).toLocaleString('ru-RU');
    if (val < 0) return `-${absStr} ₽`;
    if (showPlus && val > 0) return `+${absStr} ₽`;
    return `${absStr} ₽`;
  };

  if (branches.length === 0) {
    return (
      <div className="p-5 bg-slate-900 rounded-xl border border-slate-800 text-center space-y-3">
        <p className="text-sm text-slate-300">
          В системе пока не настроены участки и филиалы для сводного расчёта.
        </p>
        {onNavigateToBranches && (
          <button
            type="button"
            onClick={onNavigateToBranches}
            className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-semibold transition cursor-pointer"
          >
            Добавить участок
          </button>
        )}
      </div>
    );
  }

  const expenseMatrixRows: {
    id: string;
    group: 'direct' | 'fixed' | 'subtotal_direct' | 'subtotal_overhead';
    label: string;
    note?: string;
    getter: (r: (typeof branchRows)[number]) => number;
    total: number;
  }[] = [
    {
      id: 'fuel',
      group: 'direct',
      label: 'Дизельное топливо (ГСМ)',
      getter: r => r.fuelCost,
      total: totals.fuelCost
    },
    {
      id: 'salary',
      group: 'direct',
      label: 'Зарплата машинистов (сдельщина)',
      getter: r => r.salaryCost,
      total: totals.salaryCost
    },
    {
      id: 'repair',
      group: 'direct',
      label: 'Запчасти, ТО и ремонты',
      getter: r => r.repairCost,
      total: totals.repairCost
    },
    {
      id: 'transport',
      group: 'direct',
      label: 'Трал / доставка на объект',
      getter: r => r.transportCost,
      total: totals.transportCost
    },
    {
      id: 'subcontract',
      group: 'direct',
      label: 'Субподряд (привлечённая техника / услуги)',
      getter: r => r.subcontractCost,
      total: totals.subcontractCost
    },
    {
      id: 'subtotal_direct',
      group: 'subtotal_direct',
      label: 'Итого прямые операционные расходы',
      getter: r => r.directCosts,
      total: totals.directCosts
    },
    {
      id: 'office_itr_salary',
      group: 'fixed',
      label: 'Зарплата офис и ИТР',
      note: 'Fleet Manager, ИТР, бухгалтерия',
      getter: r => r.fixedByCategory.office_itr_salary,
      total: totals.fixedByCategory.office_itr_salary
    },
    {
      id: 'aho',
      group: 'fixed',
      label: 'АХЧ (офис, бытовки, канцелярия, оргтехника)',
      getter: r => r.fixedByCategory.aho,
      total: totals.fixedByCategory.aho
    },
    {
      id: 'leasing',
      group: 'fixed',
      label: 'Лизинг спецтехники и транспорта',
      getter: r => r.fixedByCategory.leasing,
      total: totals.fixedByCategory.leasing
    },
    {
      id: 'taxes',
      group: 'fixed',
      label: 'Налоги и обязательные сборы',
      getter: r => r.fixedByCategory.taxes,
      total: totals.fixedByCategory.taxes
    },
    {
      id: 'other_fixed',
      group: 'fixed',
      label: 'Прочие постоянные (охрана, медик, ПО/ГЛОНАСС)',
      getter: r => r.fixedByCategory.other,
      total: totals.fixedByCategory.other
    },
    {
      id: 'equipment_overheads',
      group: 'fixed',
      label: 'Накладные расходы, аллоцированные на парк',
      getter: r => r.equipmentOverheads,
      total: totals.equipmentOverheads
    },
    {
      id: 'subtotal_overhead',
      group: 'subtotal_overhead',
      label: 'Итого постоянные и накладные расходы',
      getter: r => r.totalOverheads,
      total: totals.totalOverheads
    }
  ];

  return (
    <section className="space-y-2.5" aria-label="Сводные расчёты по всем участкам">
      {/* Unified Control Header */}
      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Расчёты по расходам и прибылям по всем участкам и сводный расчёт
          </h2>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Участков: <strong className="text-slate-200 tabular-nums">{branchRows.length}</strong>
            <span className="mx-1.5 text-slate-600">·</span>
            Техники в парке: <strong className="text-slate-200 tabular-nums">{totals.equipmentCount} ед.</strong>
            <span className="mx-1.5 text-slate-600">·</span>
            Период расчёта: <strong className="text-amber-300">{periodLabel}</strong>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Period Mode Selector */}
          <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-950 border border-slate-800">
            <button
              type="button"
              onClick={() => setPeriodMode('date')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                periodMode === 'date'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Дата</span>
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode('month')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0 ${
                periodMode === 'month'
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>Месяц / Год</span>
            </button>
          </div>

          {periodMode === 'date' ? (
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              aria-label="Выбор даты для расчёта по участкам"
              className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500"
            />
          ) : (
            <div className="flex items-center gap-1.5">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                aria-label="Выбор месяца для расчёта по участкам"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {monthOptions.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                aria-label="Выбор года для расчёта по участкам"
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="button"
            onClick={() => exportBranchesSummaryToExcel(summary, periodLabel)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Экспорт Excel</span>
          </button>

          {onNavigateToBranches && (
            <button
              type="button"
              onClick={onNavigateToBranches}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs font-medium transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Участки</span>
            </button>
          )}
        </div>

        {periodMode === 'date' && totals.hours === 0 && (
          <p className="w-full text-xs text-amber-300/90 pt-1 border-t border-slate-800/80">
            За выбранную дату смены в табеле не зафиксированы: выручка и переменные затраты равны 0 ₽, отражена расчётная дневная доля постоянных расходов (1/30 месяца).
          </p>
        )}
      </div>

      {/* TABLE 1: Profit & Expenses by Branch */}
      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <button
            type="button"
            onClick={() => setOpenBranchProfitTable(prev => !prev)}
            className="flex items-center gap-2 text-left group cursor-pointer"
          >
            <span className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white group-hover:bg-slate-700 transition">
              {openBranchProfitTable ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                1. Расчёт доходов, расходов и прибылей по всем участкам
              </h3>
              <p className="text-[13px] text-slate-400">
                Сравнение выручки, прямых и постоянных затрат, валовой и операционной прибыли по каждому подразделению
              </p>
            </div>
          </button>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {periodLabel}
          </span>
        </div>

        {openBranchProfitTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-2.5">Участок / Fleet Manager</th>
                  <th className="py-2.5 px-2.5 text-right">Парк / Наработка</th>
                  <th className="py-2.5 px-2.5 text-right">Выручка</th>
                  <th className="py-2.5 px-2.5 text-right">Прямые затраты</th>
                  <th className="py-2.5 px-2.5 text-right">Постоянные и накладные</th>
                  <th className="py-2.5 px-2.5 text-right">Всего расходы</th>
                  <th className="py-2.5 px-2.5 text-right">Валовая прибыль</th>
                  <th className="py-2.5 px-2.5 text-right">Операционная прибыль</th>
                  <th className="py-2.5 px-2.5 text-right">Маржа / Доля</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {branchRows.map(row => (
                  <tr
                    key={row.branch.id}
                    className="hover:bg-slate-800/40 transition group"
                  >
                    <td className="py-2.5 px-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-amber-400 text-xs">
                          {row.branch.code}
                        </span>
                        {onSelectBranch ? (
                          <button
                            type="button"
                            onClick={() => onSelectBranch(row.branch.id)}
                            title={`Переключиться в рабочий контур участка ${row.branch.name}`}
                            className="font-semibold text-slate-100 hover:text-amber-300 inline-flex items-center gap-1 transition cursor-pointer text-left"
                          >
                            <span>{row.branch.name}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 shrink-0" />
                          </button>
                        ) : (
                          <span className="font-semibold text-slate-100">
                            {row.branch.name}
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-slate-400 mt-0.5">
                        {row.branch.city} · {row.branch.fleetManagerName}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className="text-slate-200 font-medium">
                        {row.equipmentCount} ед. · {row.hours.toLocaleString('ru-RU')} ч
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Загрузка {row.utilizationPct.toFixed(1)}% · В работе {row.rentedCount}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-white whitespace-nowrap">
                      <div>{formatRub(row.revenue, true)}</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {row.revenuePerHour.toLocaleString('ru-RU')} ₽/ч
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-rose-300 whitespace-nowrap">
                      <div>-{row.directCosts.toLocaleString('ru-RU')} ₽</div>
                      <div className="text-[11px] text-slate-400">
                        {row.directCostPerHour.toLocaleString('ru-RU')} ₽/ч
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-amber-300 whitespace-nowrap">
                      <div>-{row.totalOverheads.toLocaleString('ru-RU')} ₽</div>
                      <div className="text-[11px] text-slate-400">
                        Пост: {row.fixedOverheadsTotal.toLocaleString('ru-RU')} · Парк: {row.equipmentOverheads.toLocaleString('ru-RU')}
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-medium text-rose-400 whitespace-nowrap">
                      <div>-{row.totalExpenses.toLocaleString('ru-RU')} ₽</div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {row.totalCostPerHour.toLocaleString('ru-RU')} ₽/ч
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className={row.grossProfit >= 0 ? 'text-sky-300 font-semibold' : 'text-rose-400 font-semibold'}>
                        {formatRub(row.grossProfit)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {row.grossMarginPct.toFixed(1)}%
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <div className={`font-bold ${row.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatRub(row.operatingProfit)}
                      </div>
                      <div className="text-[11px] text-slate-400 font-normal">
                        {row.profitPerUnit.toLocaleString('ru-RU')} ₽/ед.
                      </div>
                    </td>
                    <td className="py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap">
                      <div
                        className={`font-semibold ${
                          row.operatingMarginPct > 25
                            ? 'text-emerald-400'
                            : row.operatingMarginPct > 10
                              ? 'text-amber-400'
                              : row.operatingProfit < 0
                                ? 'text-rose-400'
                                : 'text-slate-300'
                        }`}
                      >
                        {row.operatingMarginPct.toFixed(1)}%
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Доля выр.: {row.revenueSharePct.toFixed(1)}%
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-slate-700 bg-slate-950/90 text-[13px]">
                <tr>
                  <td className="py-2.5 px-2.5 font-bold text-white">
                    Сводно по всем участкам (Итого)
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-200 whitespace-nowrap">
                    <div className="font-semibold">
                      {totals.equipmentCount} ед. · {totals.hours.toLocaleString('ru-RU')} ч
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Загрузка {totals.utilizationPct.toFixed(1)}%
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-white whitespace-nowrap">
                    {formatRub(totals.revenue, true)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-rose-300 whitespace-nowrap">
                    -{totals.directCosts.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-amber-300 whitespace-nowrap">
                    -{totals.totalOverheads.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-rose-400 whitespace-nowrap">
                    -{totals.totalExpenses.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-sky-300 whitespace-nowrap">
                    <div>{formatRub(totals.grossProfit)}</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      {totals.grossMarginPct.toFixed(1)}%
                    </div>
                  </td>
                  <td
                    className={`py-2.5 px-2.5 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                      totals.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    <div>{formatRub(totals.operatingProfit)}</div>
                    <div className="text-[11px] text-slate-400 font-normal">
                      {totals.profitPerUnit.toLocaleString('ru-RU')} ₽/ед.
                    </div>
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-emerald-400 whitespace-nowrap">
                    <div>{totals.operatingMarginPct.toFixed(1)}%</div>
                    <div className="text-[11px] text-slate-400 font-normal">100.0%</div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* TABLE 2: Detailed Expenses by Branch and Category */}
      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <button
            type="button"
            onClick={() => setOpenExpensesTable(prev => !prev)}
            className="flex items-center gap-2 text-left group cursor-pointer"
          >
            <span className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white group-hover:bg-slate-700 transition">
              {openExpensesTable ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                2. Детальный расчёт расходов по статьям и участкам
              </h3>
              <p className="text-[13px] text-slate-400">
                Постатейная структура прямых переменных затрат, условно-постоянных расходов участков и накладных парка
              </p>
            </div>
          </button>
          <span className="text-xs font-mono text-rose-400 font-semibold tabular-nums">
            Всего расходов: -{totals.totalExpenses.toLocaleString('ru-RU')} ₽
          </span>
        </div>

        {openExpensesTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-2.5">Статья расходов</th>
                  {branchRows.map(r => (
                    <th key={r.branch.id} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <span className="text-amber-400 font-mono">{r.branch.code}</span>
                      <span className="text-slate-400 ml-1.5 font-normal normal-case">
                        ({r.equipmentCount} ед.)
                      </span>
                    </th>
                  ))}
                  <th className="py-2.5 px-2.5 text-right whitespace-nowrap text-slate-200">
                    Сводно (Итого)
                  </th>
                  <th className="py-2.5 px-2.5 text-right whitespace-nowrap">Доля в расходах</th>
                  <th className="py-2.5 px-2.5 text-right whitespace-nowrap">На 1 м.ч</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr className="bg-slate-950/60">
                  <td
                    colSpan={branchRows.length + 4}
                    className="py-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                  >
                    I. Прямые операционные расходы (переменные)
                  </td>
                </tr>

                {expenseMatrixRows
                  .filter(r => r.group === 'direct' || r.group === 'subtotal_direct')
                  .map(item => {
                    const isSubtotal = item.group === 'subtotal_direct';
                    const sharePct =
                      totals.totalExpenses > 0
                        ? (item.total / totals.totalExpenses) * 100
                        : 0;
                    const perHour =
                      totals.hours > 0 ? Math.round(item.total / totals.hours) : 0;

                    return (
                      <tr
                        key={item.id}
                        className={
                          isSubtotal
                            ? 'bg-slate-950/80 border-t border-slate-700 font-semibold'
                            : 'hover:bg-slate-800/40 transition'
                        }
                      >
                        <td
                          className={`py-2 px-2.5 ${
                            isSubtotal ? 'text-slate-100 font-bold' : 'text-slate-300'
                          }`}
                        >
                          {item.label}
                        </td>
                        {branchRows.map(br => {
                          const val = item.getter(br);
                          const brShare =
                            br.totalExpenses > 0 ? (val / br.totalExpenses) * 100 : 0;
                          return (
                            <td
                              key={br.branch.id}
                              className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap"
                            >
                              <span className={isSubtotal ? 'text-rose-300 font-bold' : 'text-slate-200'}>
                                {val.toLocaleString('ru-RU')} ₽
                              </span>
                              <span className="text-[11px] text-slate-500 ml-1.5">
                                ({brShare.toFixed(1)}%)
                              </span>
                            </td>
                          );
                        })}
                        <td
                          className={`py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                            isSubtotal ? 'text-rose-300 font-bold' : 'text-white font-semibold'
                          }`}
                        >
                          {item.total.toLocaleString('ru-RU')} ₽
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {sharePct.toFixed(1)}%
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {perHour.toLocaleString('ru-RU')} ₽/ч
                        </td>
                      </tr>
                    );
                  })}

                <tr className="bg-slate-950/60">
                  <td
                    colSpan={branchRows.length + 4}
                    className="py-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                  >
                    II. Условно-постоянные расходы участков и накладные парка
                  </td>
                </tr>

                {expenseMatrixRows
                  .filter(r => r.group === 'fixed' || r.group === 'subtotal_overhead')
                  .map(item => {
                    const isSubtotal = item.group === 'subtotal_overhead';
                    const sharePct =
                      totals.totalExpenses > 0
                        ? (item.total / totals.totalExpenses) * 100
                        : 0;
                    const perHour =
                      totals.hours > 0 ? Math.round(item.total / totals.hours) : 0;

                    return (
                      <tr
                        key={item.id}
                        className={
                          isSubtotal
                            ? 'bg-slate-950/80 border-t border-slate-700 font-semibold'
                            : 'hover:bg-slate-800/40 transition'
                        }
                      >
                        <td
                          className={`py-2 px-2.5 ${
                            isSubtotal ? 'text-slate-100 font-bold' : 'text-slate-300'
                          }`}
                        >
                          <div>{item.label}</div>
                          {item.note && (
                            <div className="text-[11px] text-slate-500">{item.note}</div>
                          )}
                        </td>
                        {branchRows.map(br => {
                          const val = item.getter(br);
                          const brShare =
                            br.totalExpenses > 0 ? (val / br.totalExpenses) * 100 : 0;
                          return (
                            <td
                              key={br.branch.id}
                              className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap"
                            >
                              <span className={isSubtotal ? 'text-amber-300 font-bold' : 'text-slate-200'}>
                                {val.toLocaleString('ru-RU')} ₽
                              </span>
                              <span className="text-[11px] text-slate-500 ml-1.5">
                                ({brShare.toFixed(1)}%)
                              </span>
                            </td>
                          );
                        })}
                        <td
                          className={`py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                            isSubtotal ? 'text-amber-300 font-bold' : 'text-white font-semibold'
                          }`}
                        >
                          {item.total.toLocaleString('ru-RU')} ₽
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-300 whitespace-nowrap">
                          {sharePct.toFixed(1)}%
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-400 whitespace-nowrap">
                          {perHour.toLocaleString('ru-RU')} ₽/ч
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
              <tfoot className="border-t-2 border-slate-700 bg-slate-950/95 text-[13px]">
                <tr>
                  <td className="py-2.5 px-2.5 font-bold text-white">
                    Всего совокупные расходы (I + II)
                  </td>
                  {branchRows.map(br => (
                    <td
                      key={br.branch.id}
                      className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-rose-400 whitespace-nowrap"
                    >
                      -{br.totalExpenses.toLocaleString('ru-RU')} ₽
                    </td>
                  ))}
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-rose-400 whitespace-nowrap">
                    -{totals.totalExpenses.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-slate-200 whitespace-nowrap">
                    100.0%
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-slate-300 whitespace-nowrap">
                    {totals.totalCostPerHour.toLocaleString('ru-RU')} ₽/ч
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* TABLE 3: Consolidated Executive P&L (Сводный расчёт) */}
      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <button
            type="button"
            onClick={() => setOpenConsolidatedTable(prev => !prev)}
            className="flex items-center gap-2 text-left group cursor-pointer"
          >
            <span className="p-1.5 rounded-lg bg-slate-800 text-slate-300 group-hover:text-white group-hover:bg-slate-700 transition">
              {openConsolidatedTable ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </span>
            <div>
              <h3 className="text-sm font-bold text-white group-hover:text-amber-300 transition">
                3. Сводный финансовый расчёт предприятия (ОПиУ и юнит-экономика)
              </h3>
              <p className="text-[13px] text-slate-400">
                Итоговый расчёт прибыли от выручки до чистого операционного результата и удельные показатели эффективности
              </p>
            </div>
          </button>
          <span
            className={`text-xs font-mono font-bold tabular-nums ${
              totals.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            Итог: {formatRub(totals.operatingProfit, true)} ({totals.operatingMarginPct.toFixed(1)}%)
          </span>
        </div>

        {openConsolidatedTable && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-2.5">Показатель сводного расчёта</th>
                  {branchRows.map(r => (
                    <th key={r.branch.id} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                      <span className="text-amber-400 font-mono">{r.branch.code}</span>
                      <span className="text-slate-400 ml-1.5 font-normal normal-case">
                        {r.branch.city}
                      </span>
                    </th>
                  ))}
                  <th className="py-2.5 px-2.5 text-right text-white whitespace-nowrap">
                    Сводно по предприятию
                  </th>
                  <th className="py-2.5 px-2.5 text-right whitespace-nowrap">% от выручки</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr className="hover:bg-slate-800/40 transition">
                  <td className="py-2.5 px-2.5 font-semibold text-white">
                    1. Валовая выручка (Revenue)
                  </td>
                  {branchRows.map(r => (
                    <td
                      key={r.branch.id}
                      className="py-2.5 px-2.5 text-right font-mono tabular-nums font-semibold text-white whitespace-nowrap"
                    >
                      {formatRub(r.revenue, true)}
                    </td>
                  ))}
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums font-bold text-white whitespace-nowrap">
                    {formatRub(totals.revenue, true)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-slate-300">
                    100.0%
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/40 transition">
                  <td className="py-2 px-2.5 text-slate-300">
                    2. Прямые операционные расходы (Direct Costs)
                  </td>
                  {branchRows.map(r => (
                    <td
                      key={r.branch.id}
                      className="py-2 px-2.5 text-right font-mono tabular-nums text-rose-300 whitespace-nowrap"
                    >
                      -{r.directCosts.toLocaleString('ru-RU')} ₽
                    </td>
                  ))}
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-rose-300 whitespace-nowrap">
                    -{totals.directCosts.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-400">
                    {totals.revenue > 0
                      ? ((totals.directCosts / totals.revenue) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </td>
                </tr>

                <tr className="bg-slate-950/70 font-semibold">
                  <td className="py-2.5 px-2.5 text-sky-300">
                    3. Валовая (маржинальная) прибыль (1 − 2)
                  </td>
                  {branchRows.map(r => (
                    <td
                      key={r.branch.id}
                      className={`py-2.5 px-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                        r.grossProfit >= 0 ? 'text-sky-300' : 'text-rose-400'
                      }`}
                    >
                      {formatRub(r.grossProfit)}
                    </td>
                  ))}
                  <td
                    className={`py-2.5 px-2.5 text-right font-mono tabular-nums font-bold whitespace-nowrap ${
                      totals.grossProfit >= 0 ? 'text-sky-300' : 'text-rose-400'
                    }`}
                  >
                    {formatRub(totals.grossProfit)}
                  </td>
                  <td className="py-2.5 px-2.5 text-right font-mono tabular-nums text-sky-300">
                    {totals.grossMarginPct.toFixed(1)}%
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/40 transition">
                  <td className="py-2 px-2.5 text-slate-300">
                    4. Условно-постоянные расходы участков (Офис, АХЧ, лизинг, налоги, прочие)
                  </td>
                  {branchRows.map(r => (
                    <td
                      key={r.branch.id}
                      className="py-2 px-2.5 text-right font-mono tabular-nums text-amber-300 whitespace-nowrap"
                    >
                      -{r.fixedOverheadsTotal.toLocaleString('ru-RU')} ₽
                    </td>
                  ))}
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-amber-300 whitespace-nowrap">
                    -{totals.fixedOverheadsTotal.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-400">
                    {totals.revenue > 0
                      ? ((totals.fixedOverheadsTotal / totals.revenue) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/40 transition">
                  <td className="py-2 px-2.5 text-slate-300">
                    5. Накладные расходы, аллоцированные на парк техники
                  </td>
                  {branchRows.map(r => (
                    <td
                      key={r.branch.id}
                      className="py-2 px-2.5 text-right font-mono tabular-nums text-amber-300/90 whitespace-nowrap"
                    >
                      -{r.equipmentOverheads.toLocaleString('ru-RU')} ₽
                    </td>
                  ))}
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-amber-300/90 whitespace-nowrap">
                    -{totals.equipmentOverheads.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums text-slate-400">
                    {totals.revenue > 0
                      ? ((totals.equipmentOverheads / totals.revenue) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/40 transition font-medium">
                  <td className="py-2 px-2.5 text-slate-200">
                    6. Совокупные расходы предприятия (2 + 4 + 5)
                  </td>
                  {branchRows.map(r => (
                    <td
                      key={r.branch.id}
                      className="py-2 px-2.5 text-right font-mono tabular-nums text-rose-400 whitespace-nowrap"
                    >
                      -{r.totalExpenses.toLocaleString('ru-RU')} ₽
                    </td>
                  ))}
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums font-bold text-rose-400 whitespace-nowrap">
                    -{totals.totalExpenses.toLocaleString('ru-RU')} ₽
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums text-rose-300">
                    {totals.revenue > 0
                      ? ((totals.totalExpenses / totals.revenue) * 100).toFixed(1)
                      : '0.0'}
                    %
                  </td>
                </tr>

                <tr className="bg-emerald-950/20 border-t-2 border-emerald-500/30 font-bold">
                  <td className="py-3 px-2.5 text-emerald-300">
                    7. Итоговая операционная прибыль (1 − 6)
                  </td>
                  {branchRows.map(r => (
                    <td
                      key={r.branch.id}
                      className={`py-3 px-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                        r.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {formatRub(r.operatingProfit, true)}
                    </td>
                  ))}
                  <td
                    className={`py-3 px-2.5 text-right font-mono tabular-nums text-sm whitespace-nowrap ${
                      totals.operatingProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatRub(totals.operatingProfit, true)}
                  </td>
                  <td className="py-3 px-2.5 text-right font-mono tabular-nums text-emerald-400">
                    {totals.operatingMarginPct.toFixed(1)}%
                  </td>
                </tr>

                {/* Unit Economics Block */}
                <tr className="bg-slate-950/60">
                  <td
                    colSpan={branchRows.length + 3}
                    className="py-1.5 px-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                  >
                    Удельные показатели и эффективность (Юнит-экономика)
                  </td>
                </tr>

                <tr className="hover:bg-slate-800/40 transition text-slate-300">
                  <td className="py-2 px-2.5">Операционная прибыль на 1 ед. техники</td>
                  {branchRows.map(r => (
                    <td
                      key={r.branch.id}
                      className={`py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                        r.profitPerUnit >= 0 ? 'text-emerald-300' : 'text-rose-400'
                      }`}
                    >
                      {formatRub(r.profitPerUnit)}
                    </td>
                  ))}
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold text-emerald-300 whitespace-nowrap">
                    {formatRub(totals.profitPerUnit)}
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-slate-500">—</td>
                </tr>

                <tr className="hover:bg-slate-800/40 transition text-slate-300">
                  <td className="py-2 px-2.5">Средняя доходность / полная себестоимость 1 м.ч</td>
                  {branchRows.map(r => (
                    <td
                      key={r.branch.id}
                      className="py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap"
                    >
                      <span className="text-slate-200">{r.revenuePerHour.toLocaleString('ru-RU')}</span>
                      <span className="text-slate-500 mx-1">/</span>
                      <span className="text-rose-300">{r.totalCostPerHour.toLocaleString('ru-RU')} ₽/ч</span>
                    </td>
                  ))}
                  <td className="py-2 px-2.5 text-right font-mono tabular-nums font-semibold whitespace-nowrap">
                    <span className="text-white">{totals.revenuePerHour.toLocaleString('ru-RU')}</span>
                    <span className="text-slate-500 mx-1">/</span>
                    <span className="text-rose-300">{totals.totalCostPerHour.toLocaleString('ru-RU')} ₽/ч</span>
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-slate-500">—</td>
                </tr>

                <tr className="hover:bg-slate-800/40 transition text-slate-300">
                  <td className="py-2 px-2.5">Коэффициент покрытия постоянных и накладных (Валовая прибыль / Пост.+Накл.)</td>
                  {branchRows.map(r => {
                    const coverage = r.totalOverheads > 0 ? r.grossProfit / r.totalOverheads : 0;
                    return (
                      <td
                        key={r.branch.id}
                        className={`py-2 px-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                          coverage >= 1.5
                            ? 'text-emerald-400'
                            : coverage >= 1
                              ? 'text-amber-300'
                              : 'text-rose-400'
                        }`}
                      >
                        {coverage.toFixed(2)}×
                      </td>
                    );
                  })}
                  <td
                    className={`py-2 px-2.5 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                      totals.totalOverheads > 0 && totals.grossProfit / totals.totalOverheads >= 1.5
                        ? 'text-emerald-400'
                        : 'text-amber-300'
                    }`}
                  >
                    {(totals.totalOverheads > 0
                      ? totals.grossProfit / totals.totalOverheads
                      : 0
                    ).toFixed(2)}
                    ×
                  </td>
                  <td className="py-2 px-2.5 text-right font-mono text-slate-500">—</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
