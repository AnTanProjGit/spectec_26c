import React, { useState, useEffect } from 'react';
import {
  Phone,
  Truck,
  UserPlus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CreditCard
} from 'lucide-react';
import {
  DriverProfile,
  DriverReplacementRecord,
  DriverShiftRoster,
  Equipment,
  FleetBranch
} from '../types';
import { resolveDriverForEquipment } from '../utils/driverAssignment';

interface DriverBindingPanelProps {
  roleMode: 'fleet_manager' | 'director_admin';
  drivers: DriverProfile[];
  equipmentList: Equipment[];
  branches: FleetBranch[];
  activeBranch?: FleetBranch | null;
  replacements: Record<string, DriverReplacementRecord>;
  onUpdateDriver: (driver: DriverProfile) => void;
  onAddDriver: (driver: DriverProfile) => void;
  onSetReplacement: (equipmentId: string, record: DriverReplacementRecord | null) => void;
}

export const DriverBindingPanel: React.FC<DriverBindingPanelProps> = ({
  roleMode,
  drivers,
  equipmentList,
  branches,
  activeBranch,
  replacements,
  onUpdateDriver,
  onAddDriver,
  onSetReplacement
}) => {
  const [selectedEqIdForAssign, setSelectedEqIdForAssign] = useState<Record<string, string>>({});
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('+7 (9');
  const [newCardLast4, setNewCardLast4] = useState('');
  const [newBranchId, setNewBranchId] = useState(activeBranch?.id || branches[0]?.id || 'branch-hq');
  const [newEqId, setNewEqId] = useState('');
  const [newShiftRoster, setNewShiftRoster] = useState<DriverShiftRoster>('shift_1');

  const scopedEquipmentList = activeBranch
    ? equipmentList.filter(eq => eq.branchId === activeBranch.id)
    : equipmentList;
  const scopedDrivers = activeBranch
    ? drivers.filter(d => d.branchId === activeBranch.id)
    : drivers;

  useEffect(() => {
    const resolvedBranchId = activeBranch?.id || branches[0]?.id || 'branch-hq';
    setNewBranchId(resolvedBranchId);
  }, [activeBranch, branches]);

  useEffect(() => {
    const branchEq = equipmentList.filter(eq => !newBranchId || eq.branchId === newBranchId);
    if (newEqId && !branchEq.some(eq => eq.id === newEqId)) {
      setNewEqId(branchEq[0]?.id || '');
    } else if (!newEqId && branchEq[0]?.id) {
      setNewEqId(branchEq[0].id);
    }
  }, [newBranchId, equipmentList, newEqId]);

  const handleCreateDriver = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim() || !newPhone.trim()) return;
    const effectiveBranchId = activeBranch?.id || newBranchId;
    const cleanCard = newCardLast4.replace(/\D/g, '').slice(0, 4);
    const created: DriverProfile = {
      id: `drv-${Date.now().toString().slice(-4)}`,
      branchId: effectiveBranchId,
      name: newName.trim(),
      phone: newPhone.trim(),
      maxLinked: true,
      cardLast4: cleanCard || undefined,
      cardLimitRub: 150000,
      assignedEquipmentIds: newEqId ? [newEqId] : [],
      shiftRoster: newShiftRoster,
      needsReplacement: false
    };
    onAddDriver(created);
    setNewName('');
    setNewPhone('+7 (9');
    setNewCardLast4('');
    setIsAddOpen(false);
  };

  return (
    <div className="space-y-3 text-xs">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Phone className="w-4 h-4 text-amber-400" />
            <span>
              Экипажи участка (Панель Fleet Manager{activeBranch ? `: ${activeBranch.fleetManagerName}` : ''})
            </span>
          </h3>
          <p className="text-[13px] text-slate-400 mt-0.5">
            Схема CRM: 1 водитель — по умолчанию · несколько водителей — выбор смены по табелю · требуется замена — назначает Fleet Manager.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(prev => !prev)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer whitespace-nowrap shrink-0"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Добавить водителя и бот-номер</span>
        </button>
      </div>

      {/* Add Driver inline form */}
      {isAddOpen && (
        <form
          onSubmit={handleCreateDriver}
          className="p-3 rounded-lg bg-slate-950 border border-amber-500/40 grid grid-cols-1 sm:grid-cols-6 gap-2 items-end"
        >
          <div>
            <label className="block font-medium text-slate-300 mb-1">ФИО машиниста</label>
            <input
              type="text"
              placeholder="Иванов А. С."
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
              required
            />
          </div>
          <div>
            <label className="block font-medium text-slate-300 mb-1">Бот-номер (MAX)</label>
            <input
              type="tel"
              value={newPhone}
              onChange={(e) => setNewPhone(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              required
            />
          </div>
          <div>
            <label className="block font-medium text-slate-300 mb-1">Корп. карта (4 ц.)</label>
            <input
              type="text"
              maxLength={4}
              placeholder="4819"
              value={newCardLast4}
              onChange={(e) => setNewCardLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono focus:outline-none focus:border-amber-500"
            />
          </div>
          <div>
            <label className="block font-medium text-slate-300 mb-1">Участок</label>
            {activeBranch ? (
              <div className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-amber-300 font-medium truncate">
                [{activeBranch.code}] {activeBranch.name}
              </div>
            ) : (
              <select
                value={newBranchId}
                onChange={(e) => setNewBranchId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>
                    [{b.code}] {b.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block font-medium text-slate-300 mb-1">Техника / Смена</label>
            <div className="flex gap-1">
              <select
                value={newEqId}
                onChange={(e) => setNewEqId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 font-mono focus:outline-none focus:border-amber-500"
              >
                <option value="">Без привязки</option>
                {equipmentList
                  .filter(eq => !newBranchId || eq.branchId === newBranchId)
                  .map(eq => (
                    <option key={eq.id} value={eq.id}>
                      {eq.inventoryNumber}
                    </option>
                  ))}
              </select>
              <select
                value={newShiftRoster}
                onChange={(e) => setNewShiftRoster(e.target.value as DriverShiftRoster)}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-100 focus:outline-none focus:border-amber-500"
              >
                <option value="shift_1">Смена 1</option>
                <option value="shift_2">Смена 2</option>
              </select>
            </div>
          </div>
          <div className="flex gap-1.5">
            <button
              type="submit"
              className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold cursor-pointer"
            >
              Привязать
            </button>
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
            >
              Закрыть
            </button>
          </div>
        </form>
      )}

      {/* Table 1: Equipment -> Resolved Crew & Replacement Control */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div className="px-3 py-2 border-b border-slate-800 flex items-center justify-between bg-slate-950">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            Назначение водителей на технику (актуальная схема для CRM и путевых листов)
          </span>
          <span className="text-[11px] text-slate-400 font-mono tabular-nums">
            Единиц техники: {scopedEquipmentList.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="text-[11px] text-slate-400 bg-slate-900/70 border-b border-slate-800">
              <tr>
                <th className="py-2 px-3">Техника (инв. №)</th>
                <th className="py-2 px-3">Привязанные водители (табель)</th>
                <th className="py-2 px-3">Текущий режим / Определён</th>
                <th className="py-2 px-3">Подбор / замена водителя (Fleet Manager участка)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {scopedEquipmentList.map((eq) => {
                const branchDrivers = scopedDrivers.filter(d => d.branchId === eq.branchId);
                const resolution = resolveDriverForEquipment(eq, branchDrivers, replacements);
                const activeReplacement = replacements[eq.id];
                const selectedReplacementDriverId =
                  selectedEqIdForAssign[eq.id] ?? activeReplacement?.driverId ?? '';

                return (
                  <tr key={eq.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-2.5 px-3 align-top">
                      <div className="font-mono font-bold text-white">
                        [{eq.inventoryNumber}] {eq.name}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {eq.plateNumber} · {branches.find(b => b.id === eq.branchId)?.code || eq.branchId}
                      </div>
                    </td>

                    <td className="py-2.5 px-3 align-top">
                      {resolution.boundDrivers.length === 0 ? (
                        <span className="text-rose-400">Нет привязанных водителей</span>
                      ) : (
                        <div className="space-y-1">
                          {resolution.boundDrivers.map(d => (
                            <div key={d.id} className="flex flex-wrap items-center gap-1.5 text-slate-200">
                              <span className="font-medium">{d.name}</span>
                              <span className="text-slate-500">·</span>
                              <span className="font-mono text-[11px] text-sky-300">{d.phone}</span>
                              <span className="text-slate-500">·</span>
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] text-amber-300" title="Корпоративная карта подотчёта">
                                <CreditCard className="w-3 h-3" />
                                <input
                                  type="text"
                                  maxLength={4}
                                  placeholder="карта"
                                  value={d.cardLast4 || ''}
                                  onChange={(e) =>
                                    onUpdateDriver({
                                      ...d,
                                      cardLast4: e.target.value.replace(/\D/g, '').slice(0, 4) || undefined
                                    })
                                  }
                                  aria-label={`Корпоративная карта ${d.name}`}
                                  className="w-12 bg-slate-900 border border-slate-800 focus:border-amber-500 rounded px-1 py-0.5 text-[11px] font-mono text-amber-300 focus:outline-none"
                                />
                              </span>
                              <span className="text-slate-500">·</span>
                              <span className="text-[11px] text-slate-400">
                                {d.shiftRoster === 'shift_1' ? 'Смена 1' : 'Смена 2'}
                              </span>
                              {d.needsReplacement && (
                                <span className="text-[11px] text-rose-400 font-semibold">
                                  (требуется замена)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 align-top">
                      {activeReplacement ? (
                        <div className="text-amber-300 space-y-0.5">
                          <div className="font-semibold flex items-center gap-1">
                            <RefreshCw className="w-3 h-3 shrink-0" />
                            <span>Замена: {activeReplacement.driverName}</span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            {activeReplacement.driverPhone} ·{' '}
                            {activeReplacement.setByRole === 'director_admin'
                              ? 'установил Директор (Админ)'
                              : 'установил Fleet Manager'}
                          </div>
                        </div>
                      ) : resolution.requiresManagerSelection ? (
                        <div className="text-rose-300 font-semibold flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>Требуется назначение замены</span>
                        </div>
                      ) : resolution.mode === 'timesheet_shift' ? (
                        <div className="text-sky-300">
                          <span className="font-semibold">По табелю ({resolution.boundDrivers.length} чел.)</span>
                          <div className="text-[11px] text-slate-400">
                            Смена 1: {resolution.resolvedDriver?.name}
                          </div>
                        </div>
                      ) : (
                        <div className="text-emerald-300 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                          <span>По умолчанию: {resolution.resolvedDriver?.name}</span>
                        </div>
                      )}
                    </td>

                    <td className="py-2.5 px-3 align-top">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <select
                          value={selectedReplacementDriverId}
                          onChange={(e) =>
                            setSelectedEqIdForAssign(prev => ({
                              ...prev,
                              [eq.id]: e.target.value
                            }))
                          }
                          className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-100 max-w-[200px] focus:outline-none focus:border-amber-500"
                        >
                          <option value="">Выберите водителя для замены...</option>
                          {branchDrivers.map(d => (
                            <option key={d.id} value={d.id}>
                              {d.name} ({d.phone})
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!selectedReplacementDriverId}
                          onClick={() => {
                            const drv = branchDrivers.find(d => d.id === selectedReplacementDriverId);
                            if (!drv) return;
                            onSetReplacement(eq.id, {
                              equipmentId: eq.id,
                              driverId: drv.id,
                              driverName: drv.name,
                              driverPhone: drv.phone,
                              setByRole: roleMode,
                              reason: 'Оперативная замена водителя',
                              updatedAt: new Date().toLocaleTimeString('ru-RU', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })
                            });
                          }}
                          className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                        >
                          Назначить замену
                        </button>
                        {activeReplacement && (
                          <button
                            type="button"
                            onClick={() => onSetReplacement(eq.id, null)}
                            title="Снять замену и вернуться к штатному экипажу"
                            className="p-1 rounded text-slate-400 hover:text-rose-400 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
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
