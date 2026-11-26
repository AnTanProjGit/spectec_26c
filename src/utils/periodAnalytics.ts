import { BranchOverheadCategory, Equipment, FleetBranch, ShiftReport } from '../types';
import { initialEquipmentList } from '../data/seedData';
import { aggregateBranchFixedOverheads } from './branchOverheads';

export interface EquipmentPeriodMetrics {
  eq: Equipment;
  hours: number;
  mileageKm: number;
  tripsCount: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
}

export interface DirectCostsBreakdown {
  fuelCost: number;
  salaryCost: number;
  repairCost: number;
  transportCost: number;
  subcontractCost: number;
  totalDirectCosts: number;
  totalHours: number;
  avgCostPerHour: number;
}

export interface BranchPeriodFinancials {
  branch: FleetBranch;
  equipmentCount: number;
  rentedCount: number;
  hours: number;
  downtimeHours: number;
  utilizationPct: number;
  mileageKm: number;
  tripsCount: number;
  revenue: number;
  fuelCost: number;
  salaryCost: number;
  repairCost: number;
  transportCost: number;
  subcontractCost: number;
  directCosts: number;
  equipmentOverheads: number;
  fixedByCategory: Record<BranchOverheadCategory, number>;
  fixedOverheadsTotal: number;
  totalOverheads: number;
  totalExpenses: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingProfit: number;
  operatingMarginPct: number;
  directCostPerHour: number;
  totalCostPerHour: number;
  revenuePerHour: number;
  profitPerUnit: number;
  revenueSharePct: number;
  profitSharePct: number;
}

export interface ConsolidatedBranchSummary {
  branchRows: BranchPeriodFinancials[];
  activeMonthsCount: number;
  totals: {
    equipmentCount: number;
    rentedCount: number;
    hours: number;
    downtimeHours: number;
    utilizationPct: number;
    mileageKm: number;
    tripsCount: number;
    revenue: number;
    fuelCost: number;
    salaryCost: number;
    repairCost: number;
    transportCost: number;
    subcontractCost: number;
    directCosts: number;
    equipmentOverheads: number;
    fixedByCategory: Record<BranchOverheadCategory, number>;
    fixedOverheadsTotal: number;
    totalOverheads: number;
    totalExpenses: number;
    grossProfit: number;
    grossMarginPct: number;
    operatingProfit: number;
    operatingMarginPct: number;
    directCostPerHour: number;
    totalCostPerHour: number;
    revenuePerHour: number;
    profitPerUnit: number;
  };
}

interface ShiftStatBucket {
  hours: number;
  downtimeHours: number;
  salaryCost: number;
  fuelCost: number;
  repairCost: number;
  transportCost: number;
  subcontractCost: number;
  mileageKm: number;
  tripsCount: number;
}

const SEASONAL_MONTH_FACTORS_2026: Record<string, number> = {
  '01': 0.62,
  '02': 0.68,
  '03': 0.82,
  '04': 0.92,
  '05': 1.02,
  '06': 1.12,
  '07': 1.15,
  '08': 1.10,
  '09': 1.04,
  '10': 0.96
};

const ALL_MONTH_CODES = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

const seedEquipmentMap = new Map<string, Equipment>(
  initialEquipmentList.map(item => [item.id, item])
);

function getDeterministicUnitFactor(eqId: string, monthCode: string): number {
  let hash = 0;
  const key = `${eqId}:${monthCode}`;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) % 1000;
  }
  // +/- 7% deterministic unit-level variance across months
  return 0.93 + (hash % 15) * 0.01;
}

function createEmptyBucket(): ShiftStatBucket {
  return {
    hours: 0,
    downtimeHours: 0,
    salaryCost: 0,
    fuelCost: 0,
    repairCost: 0,
    transportCost: 0,
    subcontractCost: 0,
    mileageKm: 0,
    tripsCount: 0
  };
}

function aggregateShiftStats(scopedShifts: ShiftReport[]): Map<string, ShiftStatBucket> {
  const map = new Map<string, ShiftStatBucket>();

  const ensureEntry = (id: string) => {
    let existing = map.get(id);
    if (!existing) {
      existing = createEmptyBucket();
      map.set(id, existing);
    }
    return existing;
  };

  for (const shift of scopedShifts) {
    const eqEntry = ensureEntry(shift.equipmentId);
    eqEntry.hours += shift.workHours;
    eqEntry.downtimeHours += shift.downtimeHours || 0;
    eqEntry.salaryCost += shift.calculatedSalary;
    eqEntry.mileageKm += shift.mileageKm ?? 0;
    eqEntry.tripsCount += shift.tripsCount ?? 0;
    eqEntry.subcontractCost += shift.subcontractCostRub ?? 0;

    const fuelOrExpenseRub =
      shift.paymentAmountRub !== undefined
        ? shift.paymentAmountRub
        : shift.fuelLitersAdded * 65;

    if (shift.paymentCategory === 'fuel_for_equipment' && shift.paymentTargetEquipmentId) {
      const targetEntry = ensureEntry(shift.paymentTargetEquipmentId);
      targetEntry.fuelCost += fuelOrExpenseRub;
    } else if (shift.paymentCategory === 'parts') {
      eqEntry.repairCost += fuelOrExpenseRub;
    } else if (shift.paymentCategory === 'other') {
      eqEntry.transportCost += fuelOrExpenseRub;
    } else {
      eqEntry.fuelCost += fuelOrExpenseRub;
    }
  }

  return map;
}

function computeSingleMonthForEquipment(
  eq: Equipment,
  year: string,
  monthCode: string,
  activeDataYearMonth: string,
  shiftStatsMap: Map<string, ShiftStatBucket>
): {
  hours: number;
  downtimeHours: number;
  mileageKm: number;
  tripsCount: number;
  revenue: number;
  fuelCost: number;
  salaryCost: number;
  repairCost: number;
  transportCost: number;
  subcontractCost: number;
  overheads: number;
} {
  const yearMonth = `${year}-${monthCode}`;

  if (yearMonth === activeDataYearMonth) {
    return {
      hours: eq.monthHours,
      downtimeHours: eq.downtimeHoursMonth,
      mileageKm: eq.mileageKmMonth ?? 0,
      tripsCount: eq.tripsMonth ?? 0,
      revenue: eq.revenueMonth,
      fuelCost: eq.fuelCostMonth,
      salaryCost: eq.driverSalaryMonth,
      repairCost: eq.repairCostMonth,
      transportCost: eq.transportCostMonth,
      subcontractCost: eq.subcontractCostMonth ?? 0,
      overheads: eq.overheadsAllocated
    };
  }

  const shiftStats = shiftStatsMap.get(eq.id) || createEmptyBucket();

  const activeYear = activeDataYearMonth.slice(0, 4);
  const seasonalBase = year === activeYear ? SEASONAL_MONTH_FACTORS_2026[monthCode] : undefined;
  const seedEq = seedEquipmentMap.get(eq.id);

  if (seasonalBase !== undefined && seedEq) {
    const factor = seasonalBase * getDeterministicUnitFactor(eq.id, monthCode);
    const baseHours = Math.max(0, Math.round(seedEq.monthHours * factor));
    const baseDowntime = Math.max(0, Math.round(seedEq.downtimeHoursMonth * factor));
    const baseRevenue = baseHours * seedEq.hourlyRate;
    const baseMileage = Math.round((seedEq.mileageKmMonth ?? 0) * factor);
    const baseTrips =
      seedEq.type === 'dump_truck' ? Math.round((seedEq.tripsMonth ?? 0) * factor) : 0;

    const baseFuel = Math.round(seedEq.fuelCostMonth * factor);
    const baseSalary = Math.round(seedEq.driverSalaryMonth * factor);
    const baseRepair = Math.round(seedEq.repairCostMonth * factor);
    const baseTransport = Math.round(seedEq.transportCostMonth * factor);
    const baseSubcontract = Math.round((seedEq.subcontractCostMonth ?? 0) * factor);

    const totalHours = baseHours + shiftStats.hours;

    return {
      hours: totalHours,
      downtimeHours: baseDowntime + shiftStats.downtimeHours,
      mileageKm: baseMileage + shiftStats.mileageKm,
      tripsCount: baseTrips + shiftStats.tripsCount,
      revenue: baseRevenue + shiftStats.hours * eq.hourlyRate,
      fuelCost: baseFuel + shiftStats.fuelCost,
      salaryCost: baseSalary + shiftStats.salaryCost,
      repairCost: baseRepair + shiftStats.repairCost,
      transportCost: baseTransport + shiftStats.transportCost,
      subcontractCost: baseSubcontract + shiftStats.subcontractCost,
      overheads: totalHours > 0 ? seedEq.overheadsAllocated : 0
    };
  }

  return {
    hours: shiftStats.hours,
    downtimeHours: shiftStats.downtimeHours,
    mileageKm: shiftStats.mileageKm,
    tripsCount: shiftStats.tripsCount,
    revenue: shiftStats.hours * eq.hourlyRate,
    fuelCost: shiftStats.fuelCost,
    salaryCost: shiftStats.salaryCost,
    repairCost: shiftStats.repairCost,
    transportCost: shiftStats.transportCost,
    subcontractCost: shiftStats.subcontractCost,
    overheads: shiftStats.hours > 0 ? eq.overheadsAllocated : 0
  };
}

export function computeEquipmentProfitRanking(params: {
  equipmentList: Equipment[];
  shiftReports: ShiftReport[];
  mode: 'date' | 'month';
  selectedDate: string;
  selectedYear: string;
  selectedMonth: string; // 'all' | '01'..'12'
  activeDataYearMonth: string;
}): EquipmentPeriodMetrics[] {
  const {
    equipmentList,
    shiftReports,
    mode,
    selectedDate,
    selectedYear,
    selectedMonth,
    activeDataYearMonth
  } = params;

  if (mode === 'date') {
    const dayShifts = shiftReports.filter(s => s.date === selectedDate);
    const dayStats = aggregateShiftStats(dayShifts);

    return equipmentList
      .map(eq => {
        const stats = dayStats.get(eq.id) || createEmptyBucket();
        const revenue = stats.hours * eq.hourlyRate;
        const dailyOverhead = stats.hours > 0 ? Math.round(eq.overheadsAllocated / 30) : 0;
        const direct =
          stats.fuelCost +
          stats.salaryCost +
          stats.repairCost +
          stats.transportCost +
          stats.subcontractCost;
        const expenses = direct + dailyOverhead;
        const profit = revenue - expenses;
        const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
        return {
          eq,
          hours: stats.hours,
          mileageKm: stats.mileageKm,
          tripsCount: stats.tripsCount,
          revenue,
          expenses,
          profit,
          margin
        };
      })
      .sort((a, b) => {
        if (b.profit !== a.profit) return b.profit - a.profit;
        if (b.hours !== a.hours) return b.hours - a.hours;
        return b.revenue - a.revenue;
      });
  }

  const monthsToAggregate = selectedMonth === 'all' ? ALL_MONTH_CODES : [selectedMonth];

  const statsByMonthCode = new Map<string, Map<string, ShiftStatBucket>>();
  for (const monthCode of monthsToAggregate) {
    const ym = `${selectedYear}-${monthCode}`;
    const monthShifts = shiftReports.filter(s => s.date.startsWith(ym));
    statsByMonthCode.set(monthCode, aggregateShiftStats(monthShifts));
  }

  return equipmentList
    .map(eq => {
      let totalHours = 0;
      let totalMileage = 0;
      let totalTrips = 0;
      let totalRevenue = 0;
      let totalExpenses = 0;

      for (const monthCode of monthsToAggregate) {
        const shiftStatsMap = statsByMonthCode.get(monthCode)!;
        const m = computeSingleMonthForEquipment(
          eq,
          selectedYear,
          monthCode,
          activeDataYearMonth,
          shiftStatsMap
        );
        totalHours += m.hours;
        totalMileage += m.mileageKm;
        totalTrips += m.tripsCount;
        totalRevenue += m.revenue;
        totalExpenses +=
          m.fuelCost +
          m.salaryCost +
          m.repairCost +
          m.transportCost +
          m.subcontractCost +
          m.overheads;
      }

      const profit = totalRevenue - totalExpenses;
      const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      return {
        eq,
        hours: totalHours,
        mileageKm: totalMileage,
        tripsCount: totalTrips,
        revenue: totalRevenue,
        expenses: totalExpenses,
        profit,
        margin
      };
    })
    .sort((a, b) => {
      if (b.profit !== a.profit) return b.profit - a.profit;
      if (b.hours !== a.hours) return b.hours - a.hours;
      return b.revenue - a.revenue;
    });
}

export function computeDirectCostsBreakdown(params: {
  equipmentList: Equipment[];
  shiftReports: ShiftReport[];
  mode: 'date' | 'month';
  selectedDate: string;
  selectedYear: string;
  selectedMonth: string; // 'all' | '01'..'12'
  activeDataYearMonth: string;
}): DirectCostsBreakdown {
  const {
    equipmentList,
    shiftReports,
    mode,
    selectedDate,
    selectedYear,
    selectedMonth,
    activeDataYearMonth
  } = params;

  let fuelCost = 0;
  let salaryCost = 0;
  let repairCost = 0;
  let transportCost = 0;
  let subcontractCost = 0;
  let totalHours = 0;

  if (mode === 'date') {
    const dayShifts = shiftReports.filter(s => s.date === selectedDate);
    const dayStats = aggregateShiftStats(dayShifts);
    for (const eq of equipmentList) {
      const s = dayStats.get(eq.id);
      if (!s) continue;
      fuelCost += s.fuelCost;
      salaryCost += s.salaryCost;
      repairCost += s.repairCost;
      transportCost += s.transportCost;
      subcontractCost += s.subcontractCost;
      totalHours += s.hours;
    }
  } else {
    const monthsToAggregate = selectedMonth === 'all' ? ALL_MONTH_CODES : [selectedMonth];
    for (const monthCode of monthsToAggregate) {
      const ym = `${selectedYear}-${monthCode}`;
      const monthShifts = shiftReports.filter(s => s.date.startsWith(ym));
      const shiftStatsMap = aggregateShiftStats(monthShifts);
      for (const eq of equipmentList) {
        const m = computeSingleMonthForEquipment(
          eq,
          selectedYear,
          monthCode,
          activeDataYearMonth,
          shiftStatsMap
        );
        fuelCost += m.fuelCost;
        salaryCost += m.salaryCost;
        repairCost += m.repairCost;
        transportCost += m.transportCost;
        subcontractCost += m.subcontractCost;
        totalHours += m.hours;
      }
    }
  }

  const totalDirectCosts =
    fuelCost + salaryCost + repairCost + transportCost + subcontractCost;
  const avgCostPerHour = totalHours > 0 ? Math.round(totalDirectCosts / totalHours) : 0;

  return {
    fuelCost,
    salaryCost,
    repairCost,
    transportCost,
    subcontractCost,
    totalDirectCosts,
    totalHours,
    avgCostPerHour
  };
}

export function computeBranchesFinancialSummary(params: {
  branches: FleetBranch[];
  equipmentList: Equipment[];
  shiftReports: ShiftReport[];
  mode: 'date' | 'month';
  selectedDate: string;
  selectedYear: string;
  selectedMonth: string; // 'all' | '01'..'12'
  activeDataYearMonth: string;
}): ConsolidatedBranchSummary {
  const {
    branches,
    equipmentList,
    shiftReports,
    mode,
    selectedDate,
    selectedYear,
    selectedMonth,
    activeDataYearMonth
  } = params;

  const activeMonthsCount = (() => {
    if (mode === 'date') return 1;
    if (selectedMonth !== 'all') return 1;
    const activeYear = activeDataYearMonth.slice(0, 4);
    if (selectedYear === activeYear) {
      const hasDecShifts = shiftReports.some(s => s.date.startsWith(`${selectedYear}-12`));
      return hasDecShifts ? 12 : Math.max(1, parseInt(activeDataYearMonth.slice(5, 7), 10) || 11);
    }
    return 12;
  })();

  const scaleFixedAmount = (monthlyRub: number): number => {
    if (mode === 'date') return Math.round(monthlyRub / 30);
    if (selectedMonth === 'all') return monthlyRub * activeMonthsCount;
    return monthlyRub;
  };

  const monthsToAggregate = selectedMonth === 'all' ? ALL_MONTH_CODES : [selectedMonth];

  const dayStats =
    mode === 'date'
      ? aggregateShiftStats(shiftReports.filter(s => s.date === selectedDate))
      : null;

  const statsByMonthCode = new Map<string, Map<string, ShiftStatBucket>>();
  if (mode === 'month') {
    for (const monthCode of monthsToAggregate) {
      const ym = `${selectedYear}-${monthCode}`;
      const monthShifts = shiftReports.filter(s => s.date.startsWith(ym));
      statsByMonthCode.set(monthCode, aggregateShiftStats(monthShifts));
    }
  }

  const rawRows: Omit<BranchPeriodFinancials, 'revenueSharePct' | 'profitSharePct'>[] = branches.map(
    branch => {
      const branchEquipment = equipmentList.filter(e => e.branchId === branch.id);
      const equipmentCount = branchEquipment.length;
      const rentedCount = branchEquipment.filter(e => e.status === 'rented').length;

      let hours = 0;
      let downtimeHours = 0;
      let mileageKm = 0;
      let tripsCount = 0;
      let revenue = 0;
      let fuelCost = 0;
      let salaryCost = 0;
      let repairCost = 0;
      let transportCost = 0;
      let subcontractCost = 0;
      let equipmentOverheads = 0;

      if (mode === 'date' && dayStats) {
        for (const eq of branchEquipment) {
          const stats = dayStats.get(eq.id);
          if (!stats) continue;
          hours += stats.hours;
          downtimeHours += stats.downtimeHours;
          mileageKm += stats.mileageKm;
          tripsCount += stats.tripsCount;
          revenue += stats.hours * eq.hourlyRate;
          fuelCost += stats.fuelCost;
          salaryCost += stats.salaryCost;
          repairCost += stats.repairCost;
          transportCost += stats.transportCost;
          subcontractCost += stats.subcontractCost;
          equipmentOverheads += stats.hours > 0 ? Math.round(eq.overheadsAllocated / 30) : 0;
        }
      } else {
        for (const monthCode of monthsToAggregate) {
          const shiftStatsMap = statsByMonthCode.get(monthCode)!;
          for (const eq of branchEquipment) {
            const m = computeSingleMonthForEquipment(
              eq,
              selectedYear,
              monthCode,
              activeDataYearMonth,
              shiftStatsMap
            );
            hours += m.hours;
            downtimeHours += m.downtimeHours;
            mileageKm += m.mileageKm;
            tripsCount += m.tripsCount;
            revenue += m.revenue;
            fuelCost += m.fuelCost;
            salaryCost += m.salaryCost;
            repairCost += m.repairCost;
            transportCost += m.transportCost;
            subcontractCost += m.subcontractCost;
            equipmentOverheads += m.overheads;
          }
        }
      }

      const branchFixedRaw = aggregateBranchFixedOverheads([branch], branch);
      const fixedByCategory: Record<BranchOverheadCategory, number> = {
        office_itr_salary: scaleFixedAmount(branchFixedRaw.byCategory.office_itr_salary || 0),
        aho: scaleFixedAmount(branchFixedRaw.byCategory.aho || 0),
        leasing: scaleFixedAmount(branchFixedRaw.byCategory.leasing || 0),
        taxes: scaleFixedAmount(branchFixedRaw.byCategory.taxes || 0),
        other: scaleFixedAmount(branchFixedRaw.byCategory.other || 0)
      };
      const fixedOverheadsTotal =
        fixedByCategory.office_itr_salary +
        fixedByCategory.aho +
        fixedByCategory.leasing +
        fixedByCategory.taxes +
        fixedByCategory.other;

      const directCosts = fuelCost + salaryCost + repairCost + transportCost + subcontractCost;
      const totalOverheads = equipmentOverheads + fixedOverheadsTotal;
      const totalExpenses = directCosts + totalOverheads;
      const grossProfit = revenue - directCosts;
      const operatingProfit = revenue - totalExpenses;
      const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
      const operatingMarginPct = revenue > 0 ? (operatingProfit / revenue) * 100 : 0;

      const normHoursCapacity =
        mode === 'date'
          ? equipmentCount * 8
          : equipmentCount * 200 * (selectedMonth === 'all' ? activeMonthsCount : 1);
      const utilizationPct =
        normHoursCapacity > 0 && hours > 0 ? (hours / normHoursCapacity) * 100 : 0;

      const directCostPerHour = hours > 0 ? Math.round(directCosts / hours) : 0;
      const totalCostPerHour = hours > 0 ? Math.round(totalExpenses / hours) : 0;
      const revenuePerHour = hours > 0 ? Math.round(revenue / hours) : 0;
      const profitPerUnit = equipmentCount > 0 ? Math.round(operatingProfit / equipmentCount) : 0;

      return {
        branch,
        equipmentCount,
        rentedCount,
        hours,
        downtimeHours,
        utilizationPct,
        mileageKm,
        tripsCount,
        revenue,
        fuelCost,
        salaryCost,
        repairCost,
        transportCost,
        subcontractCost,
        directCosts,
        equipmentOverheads,
        fixedByCategory,
        fixedOverheadsTotal,
        totalOverheads,
        totalExpenses,
        grossProfit,
        grossMarginPct,
        operatingProfit,
        operatingMarginPct,
        directCostPerHour,
        totalCostPerHour,
        revenuePerHour,
        profitPerUnit
      };
    }
  );

  const totalsAcc = rawRows.reduce(
    (acc, r) => {
      acc.equipmentCount += r.equipmentCount;
      acc.rentedCount += r.rentedCount;
      acc.hours += r.hours;
      acc.downtimeHours += r.downtimeHours;
      acc.mileageKm += r.mileageKm;
      acc.tripsCount += r.tripsCount;
      acc.revenue += r.revenue;
      acc.fuelCost += r.fuelCost;
      acc.salaryCost += r.salaryCost;
      acc.repairCost += r.repairCost;
      acc.transportCost += r.transportCost;
      acc.subcontractCost += r.subcontractCost;
      acc.directCosts += r.directCosts;
      acc.equipmentOverheads += r.equipmentOverheads;
      acc.fixedByCategory.office_itr_salary += r.fixedByCategory.office_itr_salary;
      acc.fixedByCategory.aho += r.fixedByCategory.aho;
      acc.fixedByCategory.leasing += r.fixedByCategory.leasing;
      acc.fixedByCategory.taxes += r.fixedByCategory.taxes;
      acc.fixedByCategory.other += r.fixedByCategory.other;
      acc.fixedOverheadsTotal += r.fixedOverheadsTotal;
      acc.totalOverheads += r.totalOverheads;
      acc.totalExpenses += r.totalExpenses;
      acc.grossProfit += r.grossProfit;
      acc.operatingProfit += r.operatingProfit;
      return acc;
    },
    {
      equipmentCount: 0,
      rentedCount: 0,
      hours: 0,
      downtimeHours: 0,
      mileageKm: 0,
      tripsCount: 0,
      revenue: 0,
      fuelCost: 0,
      salaryCost: 0,
      repairCost: 0,
      transportCost: 0,
      subcontractCost: 0,
      directCosts: 0,
      equipmentOverheads: 0,
      fixedByCategory: {
        office_itr_salary: 0,
        aho: 0,
        leasing: 0,
        taxes: 0,
        other: 0
      } as Record<BranchOverheadCategory, number>,
      fixedOverheadsTotal: 0,
      totalOverheads: 0,
      totalExpenses: 0,
      grossProfit: 0,
      operatingProfit: 0
    }
  );

  const totalNormCapacity =
    mode === 'date'
      ? totalsAcc.equipmentCount * 8
      : totalsAcc.equipmentCount * 200 * (selectedMonth === 'all' ? activeMonthsCount : 1);

  const totals = {
    ...totalsAcc,
    utilizationPct:
      totalNormCapacity > 0 && totalsAcc.hours > 0
        ? (totalsAcc.hours / totalNormCapacity) * 100
        : 0,
    grossMarginPct:
      totalsAcc.revenue > 0 ? (totalsAcc.grossProfit / totalsAcc.revenue) * 100 : 0,
    operatingMarginPct:
      totalsAcc.revenue > 0 ? (totalsAcc.operatingProfit / totalsAcc.revenue) * 100 : 0,
    directCostPerHour:
      totalsAcc.hours > 0 ? Math.round(totalsAcc.directCosts / totalsAcc.hours) : 0,
    totalCostPerHour:
      totalsAcc.hours > 0 ? Math.round(totalsAcc.totalExpenses / totalsAcc.hours) : 0,
    revenuePerHour:
      totalsAcc.hours > 0 ? Math.round(totalsAcc.revenue / totalsAcc.hours) : 0,
    profitPerUnit:
      totalsAcc.equipmentCount > 0
        ? Math.round(totalsAcc.operatingProfit / totalsAcc.equipmentCount)
        : 0
  };

  const totalPositiveProfit = rawRows.reduce(
    (sum, r) => sum + (r.operatingProfit > 0 ? r.operatingProfit : 0),
    0
  );

  const branchRows: BranchPeriodFinancials[] = rawRows.map(r => ({
    ...r,
    revenueSharePct: totals.revenue > 0 ? (r.revenue / totals.revenue) * 100 : 0,
    profitSharePct:
      totals.operatingProfit > 0 && r.operatingProfit > 0 && totalPositiveProfit > 0
        ? (r.operatingProfit / totalPositiveProfit) * 100
        : 0
  }));

  return {
    branchRows,
    activeMonthsCount,
    totals
  };
}

