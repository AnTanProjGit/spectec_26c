import {
  BranchFixedOverheadItem,
  BranchOverheadCategory,
  BranchOverheadDetailRow,
  FleetBranch
} from '../types';

export const BRANCH_OVERHEAD_CATEGORIES: {
  id: BranchOverheadCategory;
  label: string;
  shortLabel: string;
  defaultNote: string;
  badgeClass: string;
  barClass: string;
}[] = [
  {
    id: 'office_itr_salary',
    label: 'Зарплата офис и ИТР (без водителей и слесарей ремонта)',
    shortLabel: 'Зарплата офис и ИТР',
    defaultNote:
      'Fleet Manager, ИТР, бухгалтерия и офис (без водителей и слесарей ремонта техники)',
    badgeClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    barClass: 'bg-sky-400'
  },
  {
    id: 'aho',
    label: 'АХЧ (аренда офиса, бытовки, канцелярия, оргтехника)',
    shortLabel: 'АХЧ',
    defaultNote:
      'Аренда офиса, бытовки, канцелярии, оргтехники и другого имущества офиса',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    barClass: 'bg-amber-400'
  },
  {
    id: 'leasing',
    label: 'Лизинг (платежи за спецтехнику и транспорт)',
    shortLabel: 'Лизинг',
    defaultNote: 'Ежемесячные лизинговые платежи за спецтехнику и транспорт',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    barClass: 'bg-emerald-400'
  },
  {
    id: 'taxes',
    label: 'Налоги (транспортный, имущество, налоговые отчисления)',
    shortLabel: 'Налоги',
    defaultNote: 'Транспортный налог, налог на имущество и налоговые сборы',
    badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    barClass: 'bg-rose-400'
  },
  {
    id: 'other',
    label: 'Прочие условно-постоянные расходы',
    shortLabel: 'Прочие (охрана, медик, ИТ)',
    defaultNote: 'Охрана базы, предрейсовый медосмотр, ГЛОНАСС/ПО, юр. услуги',
    badgeClass: 'bg-slate-700/60 text-slate-200 border-slate-600',
    barClass: 'bg-slate-400'
  }
];

export const BRANCH_OVERHEAD_CATEGORY_MAP: Record<
  BranchOverheadCategory,
  (typeof BRANCH_OVERHEAD_CATEGORIES)[number]
> = BRANCH_OVERHEAD_CATEGORIES.reduce(
  (acc, item) => {
    acc[item.id] = item;
    return acc;
  },
  {} as Record<BranchOverheadCategory, (typeof BRANCH_OVERHEAD_CATEGORIES)[number]>
);

export function normalizeBranchOverheadCategory(
  category: string | undefined
): BranchOverheadCategory {
  if (
    category === 'office_itr_salary' ||
    category === 'aho' ||
    category === 'leasing' ||
    category === 'taxes' ||
    category === 'other'
  ) {
    return category;
  }
  if (
    category === 'accounting' ||
    category === 'mechanics' ||
    category === 'fleet_manager'
  ) {
    return 'office_itr_salary';
  }
  return 'other';
}

export function normalizeBranchFixedOverheads(
  items: BranchFixedOverheadItem[]
): BranchFixedOverheadItem[] {
  return items.map(item => {
    const rawCat = item.category as string;
    const category = normalizeBranchOverheadCategory(rawCat);

    if (item.id === 'ovh-aho-hq' && rawCat === 'aho' && item.note?.includes('промбазы')) {
      return {
        ...item,
        category,
        name: 'Аренда офиса, бытовки, канцелярия и оргтехника',
        note: 'Аренда офиса, бытовки, канцелярия, оргтехника и имущество офиса'
      };
    }

    if (item.id === 'ovh-aho-kzn' && rawCat === 'aho' && item.note?.includes('площадки')) {
      return {
        ...item,
        category,
        name: 'Аренда офиса, бытовки, канцелярия и оргтехника',
        note: 'Аренда офиса, бытовки, канцелярия, оргтехника и имущество офиса'
      };
    }

    return {
      ...item,
      category
    };
  });
}

export function createDefaultBranchFixedOverheads(
  isHeadquarters = false
): BranchFixedOverheadItem[] {
  if (isHeadquarters) {
    return [
      {
        id: 'ovh-sal-hq',
        category: 'office_itr_salary',
        name: 'Зарплата офис и ИТР (Fleet Manager, ИТР, бухгалтерия)',
        monthlyAmountRub: 400000
      },
      {
        id: 'ovh-aho-hq',
        category: 'aho',
        name: 'Аренда офиса, бытовки, канцелярия и оргтехника',
        monthlyAmountRub: 185000
      },
      {
        id: 'ovh-leasing-hq',
        category: 'leasing',
        name: 'Лизинг спецтехники и автопарка',
        monthlyAmountRub: 320000
      },
      {
        id: 'ovh-taxes-hq',
        category: 'taxes',
        name: 'Налоги и обязательные сборы участка',
        monthlyAmountRub: 115000
      },
      {
        id: 'ovh-oth-hq',
        category: 'other',
        name: 'Охрана, предрейсовый медик и ПО/ГЛОНАСС',
        monthlyAmountRub: 85000
      }
    ];
  }

  return [
    {
      id: `ovh-sal-${Date.now()}-1`,
      category: 'office_itr_salary',
      name: 'Зарплата офис и ИТР (Fleet Manager, ИТР, бухгалтерия)',
      monthlyAmountRub: 255000
    },
    {
      id: `ovh-aho-${Date.now()}-2`,
      category: 'aho',
      name: 'Аренда офиса, бытовки, канцелярия и оргтехника',
      monthlyAmountRub: 95000
    },
    {
      id: `ovh-leasing-${Date.now()}-3`,
      category: 'leasing',
      name: 'Лизинг спецтехники филиала',
      monthlyAmountRub: 180000
    },
    {
      id: `ovh-taxes-${Date.now()}-4`,
      category: 'taxes',
      name: 'Налоги и сборы филиала',
      monthlyAmountRub: 65000
    },
    {
      id: `ovh-oth-${Date.now()}-5`,
      category: 'other',
      name: 'Охрана, медик и ГЛОНАСС',
      monthlyAmountRub: 45000
    }
  ];
}

export function getBranchFixedOverheads(branch: FleetBranch): BranchFixedOverheadItem[] {
  if (Array.isArray(branch.fixedOverheads) && branch.fixedOverheads.length > 0) {
    return normalizeBranchFixedOverheads(branch.fixedOverheads);
  }
  return createDefaultBranchFixedOverheads(branch.isHeadquarters);
}

export function getBranchFixedOverheadsTotal(branch: FleetBranch): number {
  return getBranchFixedOverheads(branch).reduce(
    (sum, item) => sum + (Number(item.monthlyAmountRub) || 0),
    0
  );
}

export function aggregateBranchFixedOverheads(
  branches: FleetBranch[],
  activeBranch: FleetBranch | null
): {
  total: number;
  byCategory: Record<BranchOverheadCategory, number>;
  items: (BranchFixedOverheadItem & { branchCode: string; branchName: string })[];
} {
  const targetBranches = activeBranch ? [activeBranch] : branches;
  const byCategory: Record<BranchOverheadCategory, number> = {
    office_itr_salary: 0,
    aho: 0,
    leasing: 0,
    taxes: 0,
    other: 0
  };
  const items: (BranchFixedOverheadItem & { branchCode: string; branchName: string })[] = [];

  for (const branch of targetBranches) {
    const branchItems = getBranchFixedOverheads(branch);
    for (const item of branchItems) {
      const cat = normalizeBranchOverheadCategory(item.category);
      const amount = Number(item.monthlyAmountRub) || 0;
      byCategory[cat] = (byCategory[cat] || 0) + amount;
      items.push({
        ...item,
        category: cat,
        monthlyAmountRub: amount,
        branchCode: branch.code,
        branchName: branch.name
      });
    }
  }

  const total = Object.values(byCategory).reduce((s, v) => s + v, 0);
  return { total, byCategory, items };
}

function splitAmountByWeights(total: number, weights: number[]): number[] {
  const cleanTotal = Math.max(0, Math.round(Number(total) || 0));
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((s, w) => s + w, 0) || 1;
  const result = weights.map(w => Math.round((cleanTotal * w) / weightSum));
  const diff = cleanTotal - result.reduce((s, v) => s + v, 0);
  result[0] = Math.max(0, result[0] + diff);
  return result;
}

export function getOverheadItemDetails(
  item: BranchFixedOverheadItem,
  branchEquipment: { id: string; inventoryNumber: string; name: string; owner: string }[] = []
): BranchOverheadDetailRow[] {
  if (Array.isArray(item.details) && item.details.length > 0) {
    return item.details;
  }

  const total = Math.max(0, Math.round(Number(item.monthlyAmountRub) || 0));
  const cat = normalizeBranchOverheadCategory(item.category);

  if (cat === 'office_itr_salary') {
    const [a, b] = splitAmountByWeights(total, [0.65, 0.35]);
    return [
      {
        id: `${item.id}-d1`,
        title: 'Fleet Manager и ИТР (без водителей и слесарей ремонта)',
        amountRub: a
      },
      {
        id: `${item.id}-d2`,
        title: 'Бухгалтерия и офисный персонал',
        amountRub: b
      }
    ];
  }

  if (cat === 'aho') {
    const [a, b, c] = splitAmountByWeights(total, [0.55, 0.15, 0.3]);
    return [
      {
        id: `${item.id}-d1`,
        title: 'Аренда офиса и бытовки',
        amountRub: a
      },
      {
        id: `${item.id}-d2`,
        title: 'Канцелярия и хоз. принадлежности',
        amountRub: b
      },
      {
        id: `${item.id}-d3`,
        title: 'Оргтехника и прочее имущество офиса',
        amountRub: c
      }
    ];
  }

  if (cat === 'leasing') {
    const leasedUnits = branchEquipment.filter(eq =>
      eq.owner.toLowerCase().includes('лизинг')
    );
    const unitsToShow =
      leasedUnits.length > 0 ? leasedUnits.slice(0, 3) : branchEquipment.slice(0, 2);

    if (unitsToShow.length > 0) {
      const weights = unitsToShow.map((_, idx) =>
        idx === 0 ? 0.45 : 0.55 / Math.max(1, unitsToShow.length - 1)
      );
      const amounts = splitAmountByWeights(total, weights);
      return unitsToShow.map((eq, idx) => ({
        id: `${item.id}-d${idx + 1}`,
        title: `[${eq.inventoryNumber}] ${eq.name}`,
        amountRub: amounts[idx]
      }));
    }

    const [a, b] = splitAmountByWeights(total, [0.6, 0.4]);
    return [
      {
        id: `${item.id}-d1`,
        title: 'Лизинг спецтехники',
        amountRub: a
      },
      {
        id: `${item.id}-d2`,
        title: 'Лизинг служебного транспорта',
        amountRub: b
      }
    ];
  }

  if (cat === 'taxes') {
    const [a, b, c] = splitAmountByWeights(total, [0.4, 0.25, 0.35]);
    return [
      {
        id: `${item.id}-d1`,
        title: 'Транспортный налог',
        amountRub: a
      },
      {
        id: `${item.id}-d2`,
        title: 'Налог на имущество',
        amountRub: b
      },
      {
        id: `${item.id}-d3`,
        title: 'Налоговые отчисления (УСН / прибыль / НДС)',
        amountRub: c
      }
    ];
  }

  const [a, b, c] = splitAmountByWeights(total, [0.45, 0.25, 0.3]);
  return [
    {
      id: `${item.id}-d1`,
      title: 'Охрана базы',
      amountRub: a
    },
    {
      id: `${item.id}-d2`,
      title: 'Предрейсовый медосмотр',
      amountRub: b
    },
    {
      id: `${item.id}-d3`,
      title: 'ПО, 1С и ГЛОНАСС',
      amountRub: c
    }
  ];
}
