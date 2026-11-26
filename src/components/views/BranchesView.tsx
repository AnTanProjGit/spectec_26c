import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Building2,
  UserCheck,
  FileText,
  GitBranch,
  Plus,
  CheckCircle2,
  ArrowRightLeft,
  Save,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  Trash2,
  ChevronDown,
  ChevronRight,
  EyeOff,
  Eye,
  Wrench
} from 'lucide-react';
import {
  AccountingSubjectId,
  BranchFixedOverheadItem,
  BranchOverheadCategory,
  CRMDeal,
  Equipment,
  FleetBranch,
  RentalOrder
} from '../../types';
import {
  BRANCH_OVERHEAD_CATEGORIES,
  BRANCH_OVERHEAD_CATEGORY_MAP,
  createDefaultBranchFixedOverheads,
  getBranchFixedOverheads,
  getBranchFixedOverheadsTotal,
  getOverheadItemDetails,
  normalizeBranchOverheadCategory
} from '../../utils/branchOverheads';

interface BranchesViewProps {
  branches: FleetBranch[];
  activeBranchId: string | 'all';
  equipmentList: Equipment[];
  deals: CRMDeal[];
  orders: RentalOrder[];
  onSelectBranchWorkspace: (branchId: string | 'all') => void;
  onOpenFleetManager?: (branchId: string) => void;
  onSaveBranch: (branch: FleetBranch) => void;
  onCreateBranch: (branch: FleetBranch) => void;
}

export const BranchesView: React.FC<BranchesViewProps> = ({
  branches,
  activeBranchId,
  equipmentList,
  deals,
  orders,
  onSelectBranchWorkspace,
  onOpenFleetManager,
  onSaveBranch,
  onCreateBranch
}) => {
  const initialSelected =
    activeBranchId !== 'all'
      ? branches.find(b => b.id === activeBranchId) || branches[0]
      : branches[0];

  const [editingBranchId, setEditingBranchId] = useState<string>(initialSelected?.id || '');
  const [draft, setDraft] = useState<FleetBranch | null>(initialSelected || null);
  const [clientsInput, setClientsInput] = useState<string>(
    initialSelected?.regularClients.join(', ') || ''
  );
  const [savedNotice, setSavedNotice] = useState(false);

  const [overheadsSavedNotice, setOverheadsSavedNotice] = useState(false);
  const [expandedOverheadId, setExpandedOverheadId] = useState<string | null>(null);
  const [showHiddenOverheads, setShowHiddenOverheads] = useState(false);

  // New overhead line form state
  const [newOverheadCategory, setNewOverheadCategory] = useState<BranchOverheadCategory>('office_itr_salary');
  const [newOverheadName, setNewOverheadName] = useState('');
  const [newOverheadAmount, setNewOverheadAmount] = useState<number>(0);

  // New branch form
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newManager, setNewManager] = useState('');
  const [newPhone, setNewPhone] = useState('+7 (');
  const [newChiefMechanic, setNewChiefMechanic] = useState('');
  const [newChiefMechanicPhone, setNewChiefMechanicPhone] = useState('+7 (');
  const [newAddress, setNewAddress] = useState('');
  const [newClients, setNewClients] = useState('');

  useEffect(() => {
    if (activeBranchId !== 'all' && branches.some(b => b.id === activeBranchId)) {
      setEditingBranchId(activeBranchId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId]);

  useEffect(() => {
    const found = branches.find(b => b.id === editingBranchId) || branches[0];
    if (found) {
      setDraft({
        ...found,
        fixedOverheads: getBranchFixedOverheads(found)
      });
      setClientsInput(found.regularClients.join(', '));
    }
  }, [editingBranchId, branches]);

  const buildNormalizedBranch = (source: FleetBranch, clientsRaw: string): FleetBranch => {
    const parsedClients = clientsRaw
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    const cleanCode = source.code.trim().toUpperCase() || 'FIL';
    return {
      ...source,
      code: cleanCode,
      regularClients: parsedClients,
      documentFlow: {
        ...source.documentFlow,
        orderPrefix: source.documentFlow.orderPrefix.trim() || `RO-${cleanCode}-`,
        waybillPrefix: source.documentFlow.waybillPrefix.trim() || `ПЛ-${cleanCode}-`,
        shiftPrefix: source.documentFlow.shiftPrefix.trim() || `SH-${cleanCode}-`,
        actPrefix: source.documentFlow.actPrefix.trim() || `КС2-${cleanCode}-`,
        oneCDepartmentCode: source.documentFlow.oneCDepartmentCode.trim() || `ПОДР-${cleanCode}-01`
      },
      fixedOverheads: getBranchFixedOverheads(source)
    };
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft) return;
    const normalized = buildNormalizedBranch(draft, clientsInput);
    onSaveBranch(normalized);
    setDraft(normalized);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const draftFixedOverheads = draft ? getBranchFixedOverheads(draft) : [];
  const hiddenOverheadsCount = draftFixedOverheads.filter(i => i.hidden).length;
  const visibleFixedOverheads = showHiddenOverheads
    ? draftFixedOverheads
    : draftFixedOverheads.filter(i => !i.hidden);
  const draftFixedOverheadsTotal = draftFixedOverheads.reduce(
    (sum, item) => sum + (Number(item.monthlyAmountRub) || 0),
    0
  );
  const draftBranchEquipment = draft
    ? equipmentList.filter(eq => eq.branchId === draft.id)
    : [];

  const handleUpdateOverheadItem = (
    itemId: string,
    patch: Partial<BranchFixedOverheadItem>
  ) => {
    if (!draft) return;
    const updatedItems = getBranchFixedOverheads(draft).map(item =>
      item.id === itemId ? { ...item, ...patch } : item
    );
    setDraft({
      ...draft,
      fixedOverheads: updatedItems
    });
  };

  const handleToggleHideOverhead = (itemId: string) => {
    if (!draft) return;
    const updatedItems = getBranchFixedOverheads(draft).map(item =>
      item.id === itemId ? { ...item, hidden: !item.hidden } : item
    );
    if (expandedOverheadId === itemId) {
      setExpandedOverheadId(null);
    }
    setDraft({
      ...draft,
      fixedOverheads: updatedItems
    });
  };

  const handleUpdateOverheadDetailRow = (
    itemId: string,
    detailId: string,
    amountRub: number
  ) => {
    if (!draft) return;
    const updatedItems = getBranchFixedOverheads(draft).map(item => {
      if (item.id !== itemId) return item;
      const baseDetails = getOverheadItemDetails(item, draftBranchEquipment);
      const nextDetails = baseDetails.map(d =>
        d.id === detailId ? { ...d, amountRub: Math.max(0, amountRub) } : d
      );
      const nextTotal = nextDetails.reduce(
        (sum, d) => sum + Math.max(0, Number(d.amountRub) || 0),
        0
      );
      return {
        ...item,
        details: nextDetails,
        monthlyAmountRub: nextTotal
      };
    });
    setDraft({
      ...draft,
      fixedOverheads: updatedItems
    });
  };

  const handleRemoveOverheadItem = (itemId: string) => {
    if (!draft) return;
    const updatedItems = getBranchFixedOverheads(draft).filter(item => item.id !== itemId);
    if (expandedOverheadId === itemId) {
      setExpandedOverheadId(null);
    }
    setDraft({
      ...draft,
      fixedOverheads: updatedItems
    });
  };

  const handleAddOverheadItem = () => {
    if (!draft || !newOverheadName.trim()) return;
    const newItem: BranchFixedOverheadItem = {
      id: `ovh-${Date.now().toString().slice(-5)}`,
      category: newOverheadCategory,
      name: newOverheadName.trim(),
      monthlyAmountRub: Math.max(0, Number(newOverheadAmount) || 0)
    };
    const updatedItems = [...getBranchFixedOverheads(draft), newItem];
    setDraft({
      ...draft,
      fixedOverheads: updatedItems
    });
    setNewOverheadName('');
    setNewOverheadAmount(0);
  };

  const handleSaveFixedOverheadsOnly = () => {
    if (!draft) return;
    const normalized = buildNormalizedBranch(draft, clientsInput);
    onSaveBranch(normalized);
    setDraft(normalized);
    setOverheadsSavedNotice(true);
    setTimeout(() => setOverheadsSavedNotice(false), 2500);
  };

  const handleCreateNewBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newCity.trim() || !newManager.trim()) return;

    const cleanCode = (newCode.trim() || newCity.slice(0, 3)).toUpperCase().replace(/[^A-ZА-Я0-9]/g, '');
    const id = `branch-${Date.now().toString().slice(-4)}`;
    const branch: FleetBranch = {
      id,
      code: cleanCode || 'FIL',
      name: newName.trim(),
      city: newCity.trim(),
      isHeadquarters: false,
      fleetManagerName: newManager.trim(),
      fleetManagerPhone: newPhone.trim(),
      chiefMechanicName: newChiefMechanic.trim() || undefined,
      chiefMechanicPhone:
        newChiefMechanicPhone.trim() && newChiefMechanicPhone.trim() !== '+7 ('
          ? newChiefMechanicPhone.trim()
          : undefined,
      baseAddress: newAddress.trim() || `${newCity.trim()}, промбаза филиала`,
      regularClients: newClients
        .split(',')
        .map(s => s.trim())
        .filter(Boolean),
      documentFlow: {
        isolatedStreams: true,
        isolateCrmAndErp: true,
        orderPrefix: `RO-${cleanCode || 'FIL'}-`,
        waybillPrefix: `ПЛ-${cleanCode || 'FIL'}-`,
        shiftPrefix: `SH-${cleanCode || 'FIL'}-`,
        actPrefix: `КС2-${cleanCode || 'FIL'}-`,
        oneCDepartmentCode: `ПОДР-${cleanCode || 'FIL'}-01`,
        default1CSubject: 'ooo_specialtech'
      },
      fixedOverheads: createDefaultBranchFixedOverheads(false)
    };

    onCreateBranch(branch);
    setEditingBranchId(branch.id);
    setIsAddOpen(false);
    setNewName('');
    setNewCode('');
    setNewCity('');
    setNewManager('');
    setNewPhone('+7 (');
    setNewChiefMechanic('');
    setNewChiefMechanicPhone('+7 (');
    setNewAddress('');
    setNewClients('');
  };

  const isolatedBranchesCount = branches.filter(b => b.documentFlow.isolatedStreams).length;
  const currentActiveBranch = activeBranchId === 'all' ? null : branches.find(b => b.id === activeBranchId);

  return (
    <div className="p-2.5 space-y-2 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-[14px] uppercase font-mono text-amber-400 font-semibold tracking-wider">
              Мультиучастковая структура · Главный парк и удалённые филиалы
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Участки парка, Fleet Managers и разделение потоков документов
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            Изоляция техники, постоянных заказчиков, CRM/ERP-интерфейса и нумерации документов по каждому городу и участку
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onSelectBranchWorkspace('all')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-[14px] font-medium border transition cursor-pointer ${
              activeBranchId === 'all'
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold'
                : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Консолидация (Все участки)</span>
          </button>

          <button
            onClick={() => setIsAddOpen(prev => !prev)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[14px] transition cursor-pointer shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Добавить участок / филиал</span>
          </button>
        </div>
      </div>

      {/* Top KPI summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
        <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Всего участков / филиалов</span>
          <span className="text-xl font-bold text-white num-mono">{branches.length}</span>
          <span className="text-xs text-slate-500 block mt-0.5">Главный парк + удалённые города</span>
        </div>

        <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Активный интерфейс</span>
          <span className="text-base font-bold text-amber-400 truncate block">
            {currentActiveBranch ? currentActiveBranch.name : 'Сводный режим (Все участки)'}
          </span>
          <span className="text-xs text-slate-400 block mt-0.5">
            {currentActiveBranch
              ? `Fleet Manager: ${currentActiveBranch.fleetManagerName}`
              : 'Режим генерального директора'}
          </span>
        </div>

        <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Изолированных потоков</span>
          <span className="text-xl font-bold text-emerald-400 num-mono">
            {isolatedBranchesCount} / {branches.length}
          </span>
          <span className="text-xs text-emerald-500 block mt-0.5">Раздельные ЭСМ-7, КС-2 и 1С</span>
        </div>

        <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-800">
          <span className="text-[11px] text-slate-400 block">Общий парк во всех городах</span>
          <span className="text-xl font-bold text-white num-mono">{equipmentList.length} ед.</span>
          <span className="text-xs text-slate-500 block mt-0.5">
            {deals.length} сделок · {orders.length} договоров
          </span>
        </div>
      </div>

      {/* Add new branch modal-like panel */}
      {isAddOpen && (
        <form
          onSubmit={handleCreateNewBranch}
          className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/40 space-y-2 text-xs"
        >
          <div className="flex items-center justify-between pb-1.5 border-b border-slate-800">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Новый участок / удалённый филиал парка спецтехники
            </span>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              Закрыть
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Название филиала / участка</label>
              <input
                type="text"
                placeholder="Например: Филиал «Урал» (Екатеринбург)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Город / регион</label>
              <input
                type="text"
                placeholder="г. Екатеринбург и СО"
                value={newCity}
                onChange={(e) => setNewCity(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Код (для префиксов)</label>
              <input
                type="text"
                placeholder="EKB"
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono uppercase focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Ответственный Fleet Manager</label>
              <input
                type="text"
                placeholder="Смирнов К. А."
                value={newManager}
                onChange={(e) => setNewManager(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Телефон Fleet Manager</label>
              <input
                type="text"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Главный механик участка</label>
              <input
                type="text"
                placeholder="Ковалёв Д. И."
                value={newChiefMechanic}
                onChange={(e) => setNewChiefMechanic(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Телефон главного механика</label>
              <input
                type="text"
                value={newChiefMechanicPhone}
                onChange={(e) => setNewChiefMechanicPhone(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Адрес базы участка</label>
              <input
                type="text"
                placeholder="г. Екатеринбург, ул. Базовая, 10"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium text-slate-300 mb-1">Регулярные заказчики (через запятую)</label>
            <input
              type="text"
              placeholder="ООО «УралСтрой», АО «СвердловскДор»"
              value={newClients}
              onChange={(e) => setNewClients(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold cursor-pointer"
            >
              Создать участок и изолированный контур
            </button>
          </div>
        </form>
      )}

      {/* Branch Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {branches.map((branch) => {
          const isCurrentWorkspace = activeBranchId === branch.id;
          const isEditing = editingBranchId === branch.id;
          const branchEquipmentCount = equipmentList.filter(e => e.branchId === branch.id).length;
          const branchDealsCount = deals.filter(d => d.branchId === branch.id).length;
          const branchOrdersCount = orders.filter(o => o.branchId === branch.id).length;
          const branchFixedOverheadsTotal = getBranchFixedOverheadsTotal(branch);

          return (
            <div
              key={branch.id}
              onClick={() => setEditingBranchId(branch.id)}
              className={`p-3.5 rounded-xl border transition cursor-pointer space-y-2 ${
                isEditing
                  ? 'bg-slate-900 border-amber-500/60 shadow-sm'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700">
                      {branch.code}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                        branch.isHeadquarters
                          ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                          : 'bg-sky-500/15 text-sky-300 border border-sky-500/30'
                      }`}
                    >
                      {branch.isHeadquarters ? 'Главный парк' : 'Удалённый филиал'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white mt-1">{branch.name}</h3>
                  <p className="text-[13px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{branch.city}</span>
                  </p>
                </div>

                {isCurrentWorkspace && (
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold shrink-0">
                    Активен
                  </span>
                )}
              </div>

              <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <UserCheck className="w-3.5 h-3.5 text-sky-400" /> Fleet Manager:
                  </span>
                  <span className="font-semibold text-white text-[14px]">{branch.fleetManagerName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                    <Wrench className="w-3.5 h-3.5 text-emerald-400" /> Главный механик:
                  </span>
                  <span className="font-medium text-slate-200 text-[13px]">
                    {branch.chiefMechanicName || 'Не назначен'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Truck className="w-3.5 h-3.5 text-amber-400" /> Парк / CRM / Договоры:
                  </span>
                  <span className="font-mono text-slate-200 text-[13px]">
                    {branchEquipmentCount} ед. · {branchDealsCount} · {branchOrdersCount}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <GitBranch className="w-3.5 h-3.5 text-emerald-400" /> Поток документов:
                  </span>
                  <span className="font-mono text-emerald-400 text-[13px]">
                    {branch.documentFlow.orderPrefix} / {branch.documentFlow.waybillPrefix}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Wallet className="w-3.5 h-3.5 text-amber-400" /> Постоянные расходы (ОХР):
                  </span>
                  <span className="font-mono font-semibold text-amber-300 text-[13px]">
                    {branchFixedOverheadsTotal.toLocaleString()} ₽/мес
                  </span>
                </div>
              </div>

              {branch.regularClients.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {branch.regularClients.slice(0, 3).map((client, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700/80"
                    >
                      {client}
                    </span>
                  ))}
                  {branch.regularClients.length > 3 && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                      +{branch.regularClients.length - 3}
                    </span>
                  )}
                </div>
              )}

              <div className="pt-1.5 border-t border-slate-800 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectBranchWorkspace(branch.id);
                  }}
                  className={`flex-1 py-1.5 px-2.5 rounded-lg text-[13px] font-semibold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                    isCurrentWorkspace
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold'
                  }`}
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                  <span>
                    {isCurrentWorkspace
                      ? 'Вы в интерфейсе этого участка'
                      : `Открыть CRM/ERP (${branch.fleetManagerName})`}
                  </span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Branch & Document Flow Settings Editor */}
      {draft && (
        <form
          onSubmit={handleSaveDraft}
          className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2.5 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-amber-400" />
              <div>
                <h2 className="text-base font-bold text-white">
                  Настройки участка и разделения потоков документов: {draft.name}
                </h2>
                <p className="text-[14px] text-slate-400">
                  Параметры изоляции CRM/ERP для Fleet Manager, префиксы ЭСМ-7/КС-2 и маршрутизация в 1С
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {savedNotice && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[14px] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Сохранено · префиксы обновлены
                </span>
              )}
              <button
                type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[14px] transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Сохранить настройки участка</span>
              </button>
            </div>
          </div>

          {/* General Branch Parameters */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Наименование участка / филиала</label>
              <input
                type="text"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Город / регион обслуживания</label>
              <input
                type="text"
                value={draft.city}
                onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Ответственный Fleet Manager</label>
              <input
                type="text"
                value={draft.fleetManagerName}
                onChange={(e) => setDraft({ ...draft, fleetManagerName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Код участка (шифр)</label>
              <input
                type="text"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Телефон Fleet Manager</label>
              <input
                type="text"
                value={draft.fleetManagerPhone || ''}
                onChange={(e) => setDraft({ ...draft, fleetManagerPhone: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Главный механик участка</label>
              <input
                type="text"
                placeholder="ФИО главного механика участка"
                value={draft.chiefMechanicName || ''}
                onChange={(e) => setDraft({ ...draft, chiefMechanicName: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-medium text-slate-300 mb-1">Телефон главного механика</label>
              <input
                type="text"
                placeholder="+7 (..."
                value={draft.chiefMechanicPhone || ''}
                onChange={(e) => setDraft({ ...draft, chiefMechanicPhone: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block font-medium text-slate-300 mb-1">Адрес базы участка</label>
              <input
                type="text"
                value={draft.baseAddress}
                onChange={(e) => setDraft({ ...draft, baseAddress: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="flex items-center gap-1.5 font-medium text-slate-300 mb-1">
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Регулярные заказчики участка (через запятую)</span>
              </label>
              <input
                type="text"
                value={clientsInput}
                onChange={(e) => setClientsInput(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Document Flow Separation Rules */}
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
              <span className="font-bold text-amber-300 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Разделение потоков документов и изоляция CRM / ERP
              </span>
              <div className="flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    const cleanCode = draft.code.trim().toUpperCase() || 'FIL';
                    setDraft({
                      ...draft,
                      code: cleanCode,
                      documentFlow: {
                        ...draft.documentFlow,
                        orderPrefix: `RO-${cleanCode}-`,
                        waybillPrefix: `ПЛ-${cleanCode}-`,
                        shiftPrefix: `SH-${cleanCode}-`,
                        actPrefix: `КС2-${cleanCode}-`,
                        oneCDepartmentCode: `ПОДР-${cleanCode}-01`
                      }
                    });
                  }}
                  className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 text-[11px] font-semibold transition cursor-pointer"
                >
                  Подставить код [{draft.code || 'FIL'}] в префиксы
                </button>

                <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.documentFlow.isolatedStreams}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        documentFlow: { ...draft.documentFlow, isolatedStreams: e.target.checked }
                      })
                    }
                    className="rounded border-slate-600 bg-slate-800 text-amber-500"
                  />
                  <span>Разделять потоки документов участка</span>
                </label>

                <label className="inline-flex items-center gap-2 text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.documentFlow.isolateCrmAndErp}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        documentFlow: { ...draft.documentFlow, isolateCrmAndErp: e.target.checked }
                      })
                    }
                    className="rounded border-slate-600 bg-slate-800 text-amber-500"
                  />
                  <span>Отдельный интерфейс CRM/ERP для Fleet Manager</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <div>
                <label className="block font-medium text-slate-300 mb-1">Префикс договоров</label>
                <input
                  type="text"
                  value={draft.documentFlow.orderPrefix}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      documentFlow: { ...draft.documentFlow, orderPrefix: e.target.value }
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Префикс путевых</label>
                <input
                  type="text"
                  value={draft.documentFlow.waybillPrefix}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      documentFlow: { ...draft.documentFlow, waybillPrefix: e.target.value }
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Префикс смен</label>
                <input
                  type="text"
                  value={draft.documentFlow.shiftPrefix}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      documentFlow: { ...draft.documentFlow, shiftPrefix: e.target.value }
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Префикс актов КС-2</label>
                <input
                  type="text"
                  value={draft.documentFlow.actPrefix}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      documentFlow: { ...draft.documentFlow, actPrefix: e.target.value }
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Подразделение 1С</label>
                <input
                  type="text"
                  value={draft.documentFlow.oneCDepartmentCode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      documentFlow: { ...draft.documentFlow, oneCDepartmentCode: e.target.value }
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-300 mb-1">Субъект 1С (базовый)</label>
                <select
                  value={draft.documentFlow.default1CSubject}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      documentFlow: {
                        ...draft.documentFlow,
                        default1CSubject: e.target.value as AccountingSubjectId
                      }
                    })
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-slate-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="ooo_specialtech">ООО «SpecialTech»</option>
                  <option value="ip_specialtechnica">ИП «SpecialTechnica»</option>
                </select>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>Предпросмотр нумерации участка после сохранения:</span>
              <div className="flex flex-wrap items-center gap-2 font-mono text-emerald-400">
                <span>Договор/заказ: {draft.documentFlow.orderPrefix}2026-101</span>
                <span className="text-slate-600">·</span>
                <span>Путевой: {draft.documentFlow.waybillPrefix}261120-101</span>
                <span className="text-slate-600">·</span>
                <span>Смена: {draft.documentFlow.shiftPrefix}415</span>
                <span className="text-slate-600">·</span>
                <span>Акт КС-2: {draft.documentFlow.actPrefix}015</span>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Separate Block: Branch Semi-Fixed Overheads (Зарплата офис и ИТР, АХЧ, Лизинг, Налоги, Прочие) */}
      {draft && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <h2 className="text-base font-bold text-white">
                  Условно-постоянные расходы участка: {draft.name}
                </h2>
                <p className="text-[13px] text-slate-400">
                  Раздельный учёт ОХР участка: зарплата офис и ИТР (без водителей и слесарей ремонта), АХЧ (офис, бытовка, канцелярия, оргтехника), лизинг, налоги и прочие.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-amber-500/30 font-mono">
                <span className="text-slate-400 mr-1.5">Итого за месяц:</span>
                <strong className="text-amber-300 text-sm">
                  {draftFixedOverheadsTotal.toLocaleString()} ₽
                </strong>
              </div>

              {overheadsSavedNotice && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[13px] font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Расходы сохранены
                </span>
              )}

              <button
                type="button"
                onClick={handleSaveFixedOverheadsOnly}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-[13px] transition cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>Сохранить расходы участка</span>
              </button>
            </div>
          </div>

          {/* Category Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {BRANCH_OVERHEAD_CATEGORIES.map(cat => {
              const catSum = draftFixedOverheads
                .filter(i => i.category === cat.id)
                .reduce((s, i) => s + (Number(i.monthlyAmountRub) || 0), 0);
              const share = draftFixedOverheadsTotal > 0 ? (catSum / draftFixedOverheadsTotal) * 100 : 0;
              return (
                <div
                  key={cat.id}
                  className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 space-y-1"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border font-semibold ${cat.badgeClass}`}>
                      {cat.shortLabel}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">{share.toFixed(0)}%</span>
                  </div>
                  <div className="font-mono font-bold text-sm text-white tabular-nums">
                    {catSum.toLocaleString()} ₽
                  </div>
                </div>
              );
            })}
          </div>

          {/* Hidden rows control bar (when some rows are hidden) */}
          {hiddenOverheadsCount > 0 && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[12px]">
              <span className="text-slate-400">
                Скрыто строк в таблице: <strong className="text-slate-200">{hiddenOverheadsCount}</strong>
              </span>
              <button
                type="button"
                onClick={() => setShowHiddenOverheads(prev => !prev)}
                className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-medium cursor-pointer transition"
              >
                {showHiddenOverheads ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                <span>{showHiddenOverheads ? 'Скрыть обратно' : 'Показать скрытые'}</span>
              </button>
            </div>
          )}

          {/* Editable Expense Items Table */}
          <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs">
              <thead className="text-slate-400 bg-slate-950 border-b border-slate-800">
                <tr>
                  <th className="py-2 px-3 font-medium">Категория</th>
                  <th className="py-2 px-3 font-medium">Статья расходов</th>
                  <th className="py-2 px-3 font-medium text-right">Сумма (₽ / мес)</th>
                  <th className="py-2 px-3 font-medium text-right">Действие</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {visibleFixedOverheads.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-slate-500">
                      Все статьи скрыты или отсутствуют. Добавьте новую статью ниже или нажмите «Показать скрытые».
                    </td>
                  </tr>
                ) : (
                  visibleFixedOverheads.map(item => {
                    const cat = BRANCH_OVERHEAD_CATEGORY_MAP[normalizeBranchOverheadCategory(item.category)];
                    const isExpanded = expandedOverheadId === item.id;
                    const detailRows = getOverheadItemDetails(item, draftBranchEquipment);

                    return (
                      <React.Fragment key={item.id}>
                        <tr className={`hover:bg-slate-900/60 ${item.hidden ? 'opacity-60 bg-slate-950/50' : ''}`}>
                          <td className="py-2 px-3 whitespace-nowrap">
                            <span className={`inline-flex items-center text-[11px] px-2 py-1 rounded border font-semibold ${cat.badgeClass}`}>
                              {cat.shortLabel}
                            </span>
                          </td>
                          <td className="py-2 px-3 min-w-[260px]">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedOverheadId(prev => (prev === item.id ? null : item.id))
                              }
                              className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 hover:border-amber-500/50 transition cursor-pointer group"
                            >
                              <span className="flex items-center gap-2 min-w-0">
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-amber-400 shrink-0" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-amber-400 shrink-0" />
                                )}
                                <span className="text-slate-100 font-medium truncate group-hover:text-amber-300 transition">
                                  {item.name}
                                </span>
                              </span>
                              <span className="text-[11px] font-mono text-amber-400/90 underline decoration-dotted shrink-0">
                                {isExpanded ? 'свернуть таблицу' : `таблица (${detailRows.length})`}
                              </span>
                            </button>
                          </td>
                          <td className="py-2 px-3 text-right min-w-[145px]">
                            <input
                              type="number"
                              min={0}
                              step={1000}
                              value={item.monthlyAmountRub}
                              onChange={(e) =>
                                handleUpdateOverheadItem(item.id, {
                                  monthlyAmountRub: Math.max(0, parseInt(e.target.value, 10) || 0),
                                  details: undefined
                                })
                              }
                              className="w-full text-right bg-slate-800 border border-slate-700 rounded px-2.5 py-1.5 text-amber-300 font-mono font-semibold tabular-nums focus:outline-none focus:border-amber-500"
                            />
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleToggleHideOverhead(item.id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded border text-[11px] font-medium transition cursor-pointer ${
                                  item.hidden
                                    ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/40'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                                }`}
                              >
                                {item.hidden ? (
                                  <>
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>Показать</span>
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="w-3.5 h-3.5" />
                                    <span>Скрыть</span>
                                  </>
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveOverheadItem(item.id)}
                                title="Удалить статью расходов"
                                className="p-1.5 rounded bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-700 transition cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-950/90">
                            <td colSpan={4} className="px-4 py-2.5 border-t border-slate-800/80">
                              <table className="w-full text-left text-[12px] border border-slate-800 rounded overflow-hidden">
                                <thead className="text-[11px] text-slate-400 bg-slate-900/90 border-b border-slate-800">
                                  <tr>
                                    <th className="py-1.5 px-3 font-medium">Позиция</th>
                                    <th className="py-1.5 px-3 font-medium text-right">Сумма (₽ / мес)</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-800/70 bg-slate-950/60">
                                  {detailRows.map(dRow => (
                                    <tr key={dRow.id} className="hover:bg-slate-900/40">
                                      <td className="py-1.5 px-3 text-slate-200">{dRow.title}</td>
                                      <td className="py-1.5 px-3 text-right w-[160px]">
                                        <input
                                          type="number"
                                          min={0}
                                          step={1000}
                                          value={dRow.amountRub}
                                          onChange={(e) =>
                                            handleUpdateOverheadDetailRow(
                                              item.id,
                                              dRow.id,
                                              parseInt(e.target.value, 10) || 0
                                            )
                                          }
                                          className="w-full text-right bg-slate-900 border border-slate-700/80 rounded px-2 py-1 text-amber-300 font-mono font-semibold tabular-nums focus:outline-none focus:border-amber-500"
                                        />
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Add New Overhead Line */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
            <div className="sm:col-span-4">
              <label className="block text-slate-400 mb-1">Категория ОХР</label>
              <select
                value={newOverheadCategory}
                onChange={(e) => setNewOverheadCategory(e.target.value as BranchOverheadCategory)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {BRANCH_OVERHEAD_CATEGORIES.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.shortLabel}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-4">
              <label className="block text-slate-400 mb-1">Новая статья расходов</label>
              <input
                type="text"
                placeholder="Например: Лизинг экскаватора / Транспортный налог / Бытовка"
                value={newOverheadName}
                onChange={(e) => setNewOverheadName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-slate-400 mb-1">Сумма (₽/мес)</label>
              <input
                type="number"
                min={0}
                step={1000}
                value={newOverheadAmount}
                onChange={(e) => setNewOverheadAmount(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono tabular-nums focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={handleAddOverheadItem}
                disabled={!newOverheadName.trim()}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Добавить</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Routing notice: driver selection & replacement belong strictly in Поле Fleet Manager */}
      {draft && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-amber-400" />
              <span>Подбор и замена водителей участка [{draft.code}]</span>
            </div>
            <p className="text-slate-400">
              Закрепление машинистов и оперативные замены выполняются ответственным{' '}
              <strong className="text-slate-200">Fleet Manager ({draft.fleetManagerName})</strong>{' '}
              непосредственно на странице участка «Поле Fleet Manager» внутри изолированной базы этого участка.
            </p>
          </div>
          {onOpenFleetManager && (
            <button
              type="button"
              onClick={() => onOpenFleetManager(draft.id)}
              className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shrink-0 flex items-center gap-1.5"
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              <span>Открыть «Поле Fleet Manager» ({draft.code})</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
