import React, { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Wallet,
  Fuel,
  ShieldCheck,
  Save,
  Plus,
  Trash2,
  FileSpreadsheet,
  Lock,
  Unlock
} from 'lucide-react';
import {
  BranchFixedOverheadItem,
  BranchOverheadCategory,
  Equipment,
  FleetBranch,
  SystemAdminConfig,
  SystemRoleId
} from '../../types';
import { ROLE_ORDER } from '../../utils/adminConfig';
import {
  getBranchFixedOverheads,
  normalizeBranchOverheadCategory
} from '../../utils/branchOverheads';

interface AdminCostTablesSectionProps {
  branches: FleetBranch[];
  equipmentList: Equipment[];
  config: SystemAdminConfig;
  onSaveBranch: (branch: FleetBranch) => void;
  onUpdateEquipmentList: (nextList: Equipment[]) => void;
  onSaveConfig: (next: SystemAdminConfig) => void;
  onNotify: (msg: string) => void;
}

type CostSubTab = 'fixed' | 'variable' | 'access';

const ADMIN_COST_CATEGORY_LABELS: Record<
  BranchOverheadCategory,
  { label: string; short: string; badgeClass: string }
> = {
  office_itr_salary: {
    label: 'Зарплата офис и ИТР (без водителей и слесарей ремонта)',
    short: 'Зарплата офис и ИТР',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30'
  },
  aho: {
    label: 'АХЧ (аренда офиса, бытовки, канцелярия, оргтехника)',
    short: 'АХЧ',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
  },
  leasing: {
    label: 'Лизинг (лизинговые платежи за спецтехнику и транспорт)',
    short: 'Лизинг',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
  },
  taxes: {
    label: 'Налоги (транспортный, имущество, налоговые отчисления)',
    short: 'Налоги',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
  },
  other: {
    label: 'Прочие постоянные затраты (охрана, медик, ПО)',
    short: 'Прочие',
    badgeClass: 'bg-slate-700/60 text-slate-200 border-slate-600'
  }
};

const CATEGORY_ORDER: BranchOverheadCategory[] = [
  'office_itr_salary',
  'aho',
  'leasing',
  'taxes',
  'other'
];

export const AdminCostTablesSection: React.FC<AdminCostTablesSectionProps> = ({
  branches,
  equipmentList,
  config,
  onSaveBranch,
  onUpdateEquipmentList,
  onSaveConfig,
  onNotify
}) => {
  const [subTab, setSubTab] = useState<CostSubTab>('fixed');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | BranchOverheadCategory>('all');

  // Local editable drafts synced with parent state
  const [fixedByBranch, setFixedByBranch] = useState<Record<string, BranchFixedOverheadItem[]>>(
    () => {
      const map: Record<string, BranchFixedOverheadItem[]> = {};
      branches.forEach(b => {
        map[b.id] = getBranchFixedOverheads(b).map(item => ({ ...item }));
      });
      return map;
    }
  );

  const [variableDraft, setVariableDraft] = useState<Equipment[]>(() =>
    equipmentList.map(eq => ({ ...eq }))
  );

  useEffect(() => {
    const map: Record<string, BranchFixedOverheadItem[]> = {};
    branches.forEach(b => {
      map[b.id] = getBranchFixedOverheads(b).map(item => ({ ...item }));
    });
    setFixedByBranch(map);
  }, [branches]);

  useEffect(() => {
    setVariableDraft(equipmentList.map(eq => ({ ...eq })));
  }, [equipmentList]);

  // Add new fixed line state
  const [newLineBranchId, setNewLineBranchId] = useState<string>(branches[0]?.id || 'branch-hq');
  const [newLineCategory, setNewLineCategory] = useState<BranchOverheadCategory>('office_itr_salary');
  const [newLineName, setNewLineName] = useState('');
  const [newLineNote, setNewLineNote] = useState('');
  const [newLineAmount, setNewLineAmount] = useState<number>(60000);

  const targetBranches = useMemo(
    () => (branchFilter === 'all' ? branches : branches.filter(b => b.id === branchFilter)),
    [branches, branchFilter]
  );

  const flattenedFixedRows = useMemo(() => {
    const rows: Array<{
      branchId: string;
      branchCode: string;
      branchName: string;
      item: BranchFixedOverheadItem;
    }> = [];

    targetBranches.forEach(b => {
      const items = fixedByBranch[b.id] || getBranchFixedOverheads(b);
      items.forEach(item => {
        rows.push({
          branchId: b.id,
          branchCode: b.code,
          branchName: b.name,
          item
        });
      });
    });

    return rows;
  }, [targetBranches, fixedByBranch]);

  const visibleFixedRows = useMemo(
    () =>
      categoryFilter === 'all'
        ? flattenedFixedRows
        : flattenedFixedRows.filter(
            r => normalizeBranchOverheadCategory(r.item.category) === categoryFilter
          ),
    [flattenedFixedRows, categoryFilter]
  );

  const fixedTotals = useMemo(() => {
    const byCategory: Record<BranchOverheadCategory, number> = {
      office_itr_salary: 0,
      aho: 0,
      leasing: 0,
      taxes: 0,
      other: 0
    };
    flattenedFixedRows.forEach(r => {
      const cat = normalizeBranchOverheadCategory(r.item.category);
      byCategory[cat] =
        (byCategory[cat] || 0) + (Number(r.item.monthlyAmountRub) || 0);
    });
    const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
    return { byCategory, total };
  }, [flattenedFixedRows]);

  const filteredVariableRows = useMemo(
    () =>
      branchFilter === 'all'
        ? variableDraft
        : variableDraft.filter(eq => eq.branchId === branchFilter),
    [variableDraft, branchFilter]
  );

  const variableTotals = useMemo(() => {
    return filteredVariableRows.reduce(
      (acc, eq) => {
        const fuel = Number(eq.fuelCostMonth) || 0;
        const salary = Number(eq.driverSalaryMonth) || 0;
        const repair = Number(eq.repairCostMonth) || 0;
        const transport = Number(eq.transportCostMonth) || 0;
        const revenue = Number(eq.revenueMonth) || 0;
        return {
          fuel: acc.fuel + fuel,
          salary: acc.salary + salary,
          repair: acc.repair + repair,
          transport: acc.transport + transport,
          total: acc.total + fuel + salary + repair + transport,
          revenue: acc.revenue + revenue
        };
      },
      { fuel: 0, salary: 0, repair: 0, transport: 0, total: 0, revenue: 0 }
    );
  }, [filteredVariableRows]);

  const handleUpdateFixedRow = (
    branchId: string,
    itemId: string,
    patch: Partial<BranchFixedOverheadItem>
  ) => {
    setFixedByBranch(prev => ({
      ...prev,
      [branchId]: (prev[branchId] || []).map(it =>
        it.id === itemId ? { ...it, ...patch } : it
      )
    }));
  };

  const handleDeleteFixedRow = (branchId: string, itemId: string) => {
    setFixedByBranch(prev => ({
      ...prev,
      [branchId]: (prev[branchId] || []).filter(it => it.id !== itemId)
    }));
  };

  const handleAddFixedRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLineName.trim()) return;
    const targetId = newLineBranchId || branches[0]?.id;
    if (!targetId) return;

    const newItem: BranchFixedOverheadItem = {
      id: `ovh-adm-${Date.now()}`,
      category: newLineCategory,
      name: newLineName.trim(),
      note: newLineNote.trim() || undefined,
      monthlyAmountRub: Math.max(0, Number(newLineAmount) || 0)
    };

    const nextItems = [...(fixedByBranch[targetId] || []), newItem];
    setFixedByBranch(prev => ({
      ...prev,
      [targetId]: nextItems
    }));

    const branchObj = branches.find(b => b.id === targetId);
    if (branchObj) {
      onSaveBranch({
        ...branchObj,
        fixedOverheads: nextItems
      });
    }

    setNewLineName('');
    setNewLineNote('');
    setNewLineAmount(60000);
    onNotify('Статья постоянных затрат добавлена и сохранена.');
  };

  const handleSaveAllFixedCosts = () => {
    branches.forEach(branch => {
      const items = fixedByBranch[branch.id];
      if (items) {
        onSaveBranch({
          ...branch,
          fixedOverheads: items.map(it => ({
            ...it,
            monthlyAmountRub: Math.max(0, Number(it.monthlyAmountRub) || 0)
          }))
        });
      }
    });
    onNotify('Таблица постоянных затрат (Офис и ИТР, АХЧ, лизинг, налоги, прочие) сохранена.');
  };

  const handleUpdateVariableField = (
    eqId: string,
    field: 'fuelCostMonth' | 'driverSalaryMonth' | 'repairCostMonth' | 'transportCostMonth',
    val: number
  ) => {
    const cleanVal = Math.max(0, Number(val) || 0);
    setVariableDraft(prev =>
      prev.map(eq => (eq.id === eqId ? { ...eq, [field]: cleanVal } : eq))
    );
  };

  const handleSaveVariableCosts = () => {
    onUpdateEquipmentList(variableDraft);
    onNotify('Таблица переменных затрат парка сохранена.');
  };

  const handleToggleCostRoleAccess = (
    roleId: SystemRoleId,
    fieldKey: 'canAccessFixedCostsTable' | 'canAccessVariableCostsTable'
  ) => {
    const rolePolicy = config.accessPolicies[roleId];
    onSaveConfig({
      ...config,
      accessPolicies: {
        ...config.accessPolicies,
        [roleId]: {
          ...rolePolicy,
          fields: {
            ...rolePolicy.fields,
            [fieldKey]: !rolePolicy.fields[fieldKey]
          }
        }
      }
    });
  };

  const handleExportFixedExcel = () => {
    const rows = visibleFixedRows.map(r => ({
      Участок: `[${r.branchCode}] ${r.branchName}`,
      Категория: ADMIN_COST_CATEGORY_LABELS[r.item.category]?.short || r.item.category,
      'Статья затрат': r.item.name,
      'Расшифровка / комментарий': r.item.note || '',
      'Сумма (₽ / мес)': r.item.monthlyAmountRub
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Постоянные затраты');
    XLSX.writeFile(wb, `postoyannye-zatraty-${branchFilter}.xlsx`);
    onNotify('Таблица постоянных затрат экспортирована в .xlsx.');
  };

  const handleExportVariableExcel = () => {
    const rows = filteredVariableRows.map(eq => {
      const br = branches.find(b => b.id === eq.branchId);
      const totalVar =
        eq.fuelCostMonth + eq.driverSalaryMonth + eq.repairCostMonth + eq.transportCostMonth;
      return {
        Участок: br ? `[${br.code}] ${br.name}` : eq.branchId,
        'Инв. №': eq.inventoryNumber,
        Техника: eq.name,
        'Моточасы (мес)': eq.monthHours,
        'Топливо ГСМ (₽)': eq.fuelCostMonth,
        'З/П машинистов (₽)': eq.driverSalaryMonth,
        'Ремонт и ТО (₽)': eq.repairCostMonth,
        'Трал и перегон (₽)': eq.transportCostMonth,
        'Итого переменных (₽)': totalVar,
        'Выручка (₽)': eq.revenueMonth
      };
    });
    const sheet = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, 'Переменные затраты');
    XLSX.writeFile(wb, `peremennye-zatraty-${branchFilter}.xlsx`);
    onNotify('Таблица переменных затрат экспортирована в .xlsx.');
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Top Toolbar: Sub-tabs + Branch Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('fixed')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'fixed'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:text-white'
            }`}
          >
            <Wallet className="w-3.5 h-3.5" />
            <span>Постоянные затраты (Офис и ИТР, АХЧ, лизинг, налоги, прочие)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('variable')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'variable'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:text-white'
            }`}
          >
            <Fuel className="w-3.5 h-3.5" />
            <span>Переменные затраты (ГСМ, ФОТ машинистов, ТО, трал)</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('access')}
            className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg font-semibold transition cursor-pointer whitespace-nowrap ${
              subTab === 'access'
                ? 'bg-amber-500 text-slate-950 font-bold'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Права доступа ролей к таблицам затрат</span>
          </button>
        </div>

        {subTab !== 'access' && (
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Участок:</span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Все участки парка ({branches.length})</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>
                  [{b.code}] {b.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* TAB 1: FIXED COSTS TABLE */}
      {subTab === 'fixed' && (
        <div className="space-y-4">
          {/* KPI Summary Strip for Зарплата офис и ИТР, АХЧ, Лизинг, Налоги, Прочие */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-sky-300 font-semibold">Зарплата офис и ИТР</div>
              <div className="text-lg font-bold text-white font-mono tabular-nums mt-1">
                {fixedTotals.byCategory.office_itr_salary.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Без водителей и слесарей ремонта
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-amber-300 font-semibold">АХЧ</div>
              <div className="text-lg font-bold text-white font-mono tabular-nums mt-1">
                {fixedTotals.byCategory.aho.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Офис, бытовка, канцелярия, оргтехника
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-emerald-300 font-semibold">Лизинг</div>
              <div className="text-lg font-bold text-white font-mono tabular-nums mt-1">
                {fixedTotals.byCategory.leasing.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Лизинговые платежи за технику
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-rose-300 font-semibold">Налоги</div>
              <div className="text-lg font-bold text-white font-mono tabular-nums mt-1">
                {fixedTotals.byCategory.taxes.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Транспортный, имущество, сборы
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-300 font-semibold">Прочие</div>
              <div className="text-lg font-bold text-white font-mono tabular-nums mt-1">
                {fixedTotals.byCategory.other.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Охрана, медик, ПО, ГЛОНАСС
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-amber-500/40">
              <div className="text-[11px] text-amber-400 font-semibold">Итого постоянных / мес</div>
              <div className="text-lg font-bold text-amber-300 font-mono tabular-nums mt-1">
                {fixedTotals.total.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                ОХР по выбранным участкам
              </div>
            </div>
          </div>

          {/* Filter Pills + Actions */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  Все статьи ({flattenedFixedRows.length})
                </button>
                {CATEGORY_ORDER.map(catId => (
                  <button
                    key={catId}
                    type="button"
                    onClick={() => setCategoryFilter(catId)}
                    className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                      categoryFilter === catId
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {ADMIN_COST_CATEGORY_LABELS[catId].short}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportFixedExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Экспорт (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveAllFixedCosts}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Сохранить постоянные затраты</span>
                </button>
              </div>
            </div>

            {/* Editable Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Участок</th>
                    <th className="py-2.5 px-3 font-medium">Группа затрат</th>
                    <th className="py-2.5 px-3 font-medium">Статья / подразделение</th>
                    <th className="py-2.5 px-3 font-medium">Расшифровка / штат</th>
                    <th className="py-2.5 px-3 font-medium text-right">Сумма (₽ / мес)</th>
                    <th className="py-2.5 px-3 font-medium text-right">Удал.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {visibleFixedRows.map(({ branchId, branchCode, item }) => (
                    <tr key={`${branchId}-${item.id}`} className="hover:bg-slate-900/60">
                      <td className="py-2 px-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-[11px] font-bold">
                          {branchCode}
                        </span>
                      </td>
                      <td className="py-2 px-3 min-w-[165px]">
                        <select
                          value={item.category}
                          onChange={(e) =>
                            handleUpdateFixedRow(branchId, item.id, {
                              category: e.target.value as BranchOverheadCategory
                            })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
                        >
                          {CATEGORY_ORDER.map(c => (
                            <option key={c} value={c}>
                              {ADMIN_COST_CATEGORY_LABELS[c].short}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-3 min-w-[220px]">
                        <input
                          type="text"
                          value={item.name}
                          onChange={(e) =>
                            handleUpdateFixedRow(branchId, item.id, { name: e.target.value })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-medium focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="py-2 px-3 min-w-[240px]">
                        <input
                          type="text"
                          value={item.note || ''}
                          placeholder="Состав затрат / должности..."
                          onChange={(e) =>
                            handleUpdateFixedRow(branchId, item.id, { note: e.target.value })
                          }
                          className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="py-2 px-3 min-w-[140px]">
                        <input
                          type="number"
                          min={0}
                          step={1000}
                          value={item.monthlyAmountRub}
                          onChange={(e) =>
                            handleUpdateFixedRow(branchId, item.id, {
                              monthlyAmountRub: Math.max(0, parseInt(e.target.value, 10) || 0)
                            })
                          }
                          className="w-full text-right bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-amber-300 font-mono font-bold tabular-nums focus:outline-none focus:border-amber-500"
                        />
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteFixedRow(branchId, item.id)}
                          title="Удалить строку"
                          className="p-1.5 rounded bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {visibleFixedRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        По выбранному фильтру статьи постоянных затрат не найдены.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Add New Line Form */}
            <form
              onSubmit={handleAddFixedRow}
              className="p-3 rounded-lg bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end"
            >
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">Участок</label>
                <select
                  value={newLineBranchId}
                  onChange={(e) => setNewLineBranchId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>
                      [{b.code}] {b.city}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">Категория</label>
                <select
                  value={newLineCategory}
                  onChange={(e) => setNewLineCategory(e.target.value as BranchOverheadCategory)}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  {CATEGORY_ORDER.map(c => (
                    <option key={c} value={c}>
                      {ADMIN_COST_CATEGORY_LABELS[c].short}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label className="block text-slate-400 mb-1">Статья постоянных затрат</label>
                <input
                  type="text"
                  required
                  value={newLineName}
                  onChange={(e) => setNewLineName(e.target.value)}
                  placeholder="Напр.: Главный инженер (ИТР)"
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">Комментарий</label>
                <input
                  type="text"
                  value={newLineNote}
                  onChange={(e) => setNewLineNote(e.target.value)}
                  placeholder="Оклад, налоги..."
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-slate-400 mb-1">Сумма (₽/мес)</label>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={newLineAmount}
                  onChange={(e) => setNewLineAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-amber-300 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="sm:col-span-1">
                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Доб.</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 2: VARIABLE COSTS TABLE */}
      {subTab === 'variable' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400">Топливо (ГСМ)</div>
              <div className="text-lg font-bold text-white font-mono tabular-nums mt-1">
                {variableTotals.fuel.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">По данным парка за месяц</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400">З/П машинистов</div>
              <div className="text-lg font-bold text-emerald-400 font-mono tabular-nums mt-1">
                {variableTotals.salary.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Сдельный ФОТ экипажей</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400">Ремонт и ТО</div>
              <div className="text-lg font-bold text-amber-300 font-mono tabular-nums mt-1">
                {variableTotals.repair.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Запчасти, сервис, РВД</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
              <div className="text-[11px] text-slate-400">Трал и перегон</div>
              <div className="text-lg font-bold text-sky-300 font-mono tabular-nums mt-1">
                {variableTotals.transport.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">Доставка на объекты</div>
            </div>

            <div className="p-3 rounded-xl bg-slate-900 border border-rose-500/40">
              <div className="text-[11px] text-rose-300 font-semibold">Итого переменных</div>
              <div className="text-lg font-bold text-rose-300 font-mono tabular-nums mt-1">
                {variableTotals.total.toLocaleString()} ₽
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                {variableTotals.revenue > 0
                  ? `${((variableTotals.total / variableTotals.revenue) * 100).toFixed(1)}% от выручки`
                  : 'Прямые затраты'}
              </div>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">
                  Таблица переменных (прямых) затрат по единицам техники
                </h3>
                <p className="text-slate-400 mt-0.5">
                  Корректировка прямых затрат на ГСМ, оплату машинистов, ремонт/ТО и перегон тралом
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportVariableExcel}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 font-semibold transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Экспорт (.xlsx)</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveVariableCosts}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition cursor-pointer"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Сохранить переменные затраты</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
              <table className="w-full text-left text-xs">
                <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 font-medium">Участок</th>
                    <th className="py-2.5 px-3 font-medium">Техника</th>
                    <th className="py-2.5 px-3 font-medium text-right">Моточасы</th>
                    <th className="py-2.5 px-3 font-medium text-right">Топливо ГСМ, ₽</th>
                    <th className="py-2.5 px-3 font-medium text-right">З/П машинистов, ₽</th>
                    <th className="py-2.5 px-3 font-medium text-right">Ремонт и ТО, ₽</th>
                    <th className="py-2.5 px-3 font-medium text-right">Трал / перегон, ₽</th>
                    <th className="py-2.5 px-3 font-medium text-right">Итого перем., ₽</th>
                    <th className="py-2.5 px-3 font-medium text-right">Доля от выр.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredVariableRows.map(eq => {
                    const brCode = branches.find(b => b.id === eq.branchId)?.code || eq.branchId;
                    const rowVarTotal =
                      eq.fuelCostMonth +
                      eq.driverSalaryMonth +
                      eq.repairCostMonth +
                      eq.transportCostMonth;
                    const pct = eq.revenueMonth > 0 ? (rowVarTotal / eq.revenueMonth) * 100 : 0;

                    return (
                      <tr key={eq.id} className="hover:bg-slate-900/60">
                        <td className="py-2 px-3 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-sky-300 font-mono text-[11px] font-bold">
                            {brCode}
                          </span>
                        </td>
                        <td className="py-2 px-3 min-w-[200px]">
                          <div className="font-semibold text-white">
                            <span className="font-mono text-amber-300 mr-1.5">
                              [{eq.inventoryNumber}]
                            </span>
                            {eq.name}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-300">
                          {eq.monthHours} м/ч
                        </td>
                        <td className="py-2 px-3 min-w-[115px]">
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={eq.fuelCostMonth}
                            onChange={(e) =>
                              handleUpdateVariableField(
                                eq.id,
                                'fuelCostMonth',
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-full text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-3 min-w-[115px]">
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={eq.driverSalaryMonth}
                            onChange={(e) =>
                              handleUpdateVariableField(
                                eq.id,
                                'driverSalaryMonth',
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-full text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-emerald-300 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-3 min-w-[115px]">
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={eq.repairCostMonth}
                            onChange={(e) =>
                              handleUpdateVariableField(
                                eq.id,
                                'repairCostMonth',
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-full text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-amber-300 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-3 min-w-[115px]">
                          <input
                            type="number"
                            min={0}
                            step={500}
                            value={eq.transportCostMonth}
                            onChange={(e) =>
                              handleUpdateVariableField(
                                eq.id,
                                'transportCostMonth',
                                parseInt(e.target.value, 10) || 0
                              )
                            }
                            className="w-full text-right bg-slate-800 border border-slate-700 rounded px-2 py-1 text-sky-300 font-mono tabular-nums focus:outline-none focus:border-amber-500"
                          />
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-rose-300 tabular-nums whitespace-nowrap">
                          {rowVarTotal.toLocaleString()} ₽
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-300 tabular-nums whitespace-nowrap">
                          {pct.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ROLE ACCESS TO COST TABLES */}
      {subTab === 'access' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="pb-2 border-b border-slate-800">
            <h3 className="text-sm font-bold text-white">
              Доступ ролей к таблицам постоянных и переменных затрат
            </h3>
            <p className="text-slate-400 mt-0.5">
              Управление правами просмотра и редактирования бюджетов зарплат офис и ИТР, АХЧ, лизинга, налогов, прочих постоянных и прямых затрат
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 font-medium">Роль пользователя</th>
                  <th className="py-2.5 px-3 font-medium text-center">
                    Постоянные затраты (Офис и ИТР, АХЧ, лизинг, налоги, прочие)
                  </th>
                  <th className="py-2.5 px-3 font-medium text-center">
                    Переменные затраты (ГСМ, ФОТ машинистов, ТО, трал)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
                {ROLE_ORDER.map(roleId => {
                  const policy = config.accessPolicies[roleId];
                  const fixedAllowed = !!policy.fields.canAccessFixedCostsTable;
                  const varAllowed = !!policy.fields.canAccessVariableCostsTable;

                  return (
                    <tr key={roleId} className="hover:bg-slate-900/50">
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-100">{policy.label}</div>
                        <div className="text-[11px] text-slate-400">{policy.description}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleCostRoleAccess(roleId, 'canAccessFixedCostsTable')
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                            fixedAllowed
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {fixedAllowed ? (
                            <Unlock className="w-3.5 h-3.5" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                          <span>{fixedAllowed ? 'Доступ открыт' : 'Закрыто'}</span>
                        </button>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleCostRoleAccess(roleId, 'canAccessVariableCostsTable')
                          }
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                            varAllowed
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                              : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          }`}
                        >
                          {varAllowed ? (
                            <Unlock className="w-3.5 h-3.5" />
                          ) : (
                            <Lock className="w-3.5 h-3.5" />
                          )}
                          <span>{varAllowed ? 'Доступ открыт' : 'Закрыто'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
