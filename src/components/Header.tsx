import React from 'react';
import { 
  Wrench, 
  Sparkles, 
  PlusCircle, 
  CalendarClock, 
  AlertTriangle,
  PanelLeftClose,
  PanelLeftOpen,
  MapPin,
  Lock,
  Unlock
} from 'lucide-react';
import { Equipment, AnomalyAlert, FleetBranch } from '../types';

interface HeaderProps {
  equipmentList: Equipment[];
  anomalies: AnomalyAlert[];
  branches: FleetBranch[];
  activeBranchId: string | 'all';
  onSelectBranch: (branchId: string | 'all') => void;
  onOpenBranchesSettings: () => void;
  onOpenShiftModal: () => void;
  onOpenDealModal: () => void;
  onOpenAiAnalyst: () => void;
  onOpenFleetManager?: () => void;
  onOpenDashboard?: () => void;
  adminConfirmationAllowed?: boolean;
  onToggleAdminPermission?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  equipmentList,
  anomalies,
  branches,
  activeBranchId,
  onSelectBranch,
  onOpenBranchesSettings,
  onOpenShiftModal,
  onOpenDealModal,
  onOpenAiAnalyst,
  onOpenFleetManager,
  onOpenDashboard,
  adminConfirmationAllowed = false,
  onToggleAdminPermission,
  isSidebarCollapsed = false,
  onToggleSidebar
}) => {
  const activeBranch =
    activeBranchId === 'all' ? null : branches.find(b => b.id === activeBranchId) || null;
  const managerName = activeBranch ? activeBranch.fleetManagerName : 'Сводный контур';
  const managerInitials = managerName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase())
    .join('') || 'ФМ';

  const rentedCount = equipmentList.filter(e => e.status === 'rented').length;
  const availableCount = equipmentList.filter(e => e.status === 'available').length;
  const maintenanceCount = equipmentList.filter(e => e.status === 'maintenance').length;
  const reserveCount = equipmentList.filter(e => e.status === 'reserve').length;

  const activeAnomaliesCount = anomalies.filter(a => !a.resolved).length;

  return (
    <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-3 sm:px-4 py-2 flex flex-wrap items-center justify-between gap-2">
      {/* Brand & Fleet status summary with Sidebar toggle */}
      <div className="flex items-center gap-2 sm:gap-3">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Развернуть боковое меню' : 'Свернуть боковое меню влево'}
            className="p-2 rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800 transition cursor-pointer"
            aria-label="Переключить сайдбар"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 text-amber-400" />
            ) : (
              <PanelLeftClose className="w-5 h-5" />
            )}
          </button>
        )}

        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-sm shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">SpecialTech</span>
              <span className="text-[14px] uppercase font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">ERP + AI</span>
            </div>
            <p className="text-[14px] text-slate-400 hidden sm:block">Учёт и аналитика строительной спецтехники</p>
          </div>
        </div>

        {/* Fleet Status Ribbon */}
        <div className="hidden xl:flex items-center gap-2 pl-3 border-l border-slate-800 text-[14px]">
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>В работе: <strong className="text-white num-mono">{rentedCount}</strong></span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-blue-400"></span>
            <span>Свободно: <strong className="text-white num-mono">{availableCount}</strong></span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span>В ТО: <strong className="text-white num-mono">{maintenanceCount}</strong></span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-slate-400"></span>
            <span>Резерв: <strong className="text-white num-mono">{reserveCount}</strong></span>
          </div>
        </div>
      </div>

      {/* Branch / Fleet Manager Switcher & Action buttons */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1 text-[14px]">
          <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <select
            value={activeBranchId}
            onChange={(e) => onSelectBranch(e.target.value)}
            title="Переключение изолированного интерфейса участка / Fleet Manager"
            className="bg-transparent text-slate-100 font-medium focus:outline-none cursor-pointer pr-1 max-w-[240px]"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id} className="bg-slate-900 text-slate-100">
                [{b.code}] {b.name} — {b.fleetManagerName}
              </option>
            ))}
            <option value="all" className="bg-slate-900 text-emerald-300">
              [ВСЕ] Консолидация участков (Директор)
            </option>
          </select>
          <button
            type="button"
            onClick={onOpenBranchesSettings}
            title="Настройки участков и потоков документов"
            className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-mono text-amber-300 cursor-pointer"
          >
            {activeBranch ? activeBranch.documentFlow.oneCDepartmentCode : 'ВСЕ'}
          </button>
        </div>

        {activeAnomaliesCount > 0 && (
          <button 
            onClick={onOpenAiAnalyst}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/30 text-xs hover:bg-rose-500/20 transition cursor-pointer"
            title="Обнаружены операционные аномалии"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
            <span className="font-medium hidden sm:inline">Аномалий: <strong className="num-mono">{activeAnomaliesCount}</strong></span>
            <span className="font-medium sm:hidden num-mono">{activeAnomaliesCount}</span>
          </button>
        )}

        <button
          onClick={onOpenShiftModal}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
        >
          <CalendarClock className="w-4 h-4 text-amber-400" />
          <span className="hidden sm:inline">Подать смену</span>
        </button>

        <button
          onClick={onOpenDealModal}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition cursor-pointer"
        >
          <PlusCircle className="w-4 h-4 text-emerald-400" />
          <span className="hidden sm:inline">Новая заявка</span>
        </button>

        {onToggleAdminPermission && (
          <button
            onClick={onToggleAdminPermission}
            title={
              adminConfirmationAllowed
                ? 'Админ разрешил подтверждение часов, закрытие смены и объёма (нажмите для блокировки)'
                : 'Подтверждение часов, закрытие смены и объёма заблокировано (нажмите как Админ для разрешения)'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition cursor-pointer ${
              adminConfirmationAllowed
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/25'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30 hover:bg-rose-500/20'
            }`}
          >
            {adminConfirmationAllowed ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-rose-400" />
            )}
            <span className="hidden lg:inline">
              {adminConfirmationAllowed ? 'Админ: ВКЛ' : 'Админ: ВЫКЛ'}
            </span>
          </button>
        )}

        <button
          onClick={onOpenAiAnalyst}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-semibold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
        >
          <Sparkles className="w-4 h-4" />
          <span>AI Аналитик</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!activeBranch && onOpenDashboard) {
              onOpenDashboard();
            } else if (onOpenFleetManager) {
              onOpenFleetManager();
            }
          }}
          title={
            activeBranch
              ? 'Открыть рабочее поле Fleet Manager'
              : 'Открыть Главный дашборд'
          }
          className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-800 ml-0.5 text-left hover:opacity-85 transition cursor-pointer"
        >
          <div className="h-8 w-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-amber-400">
            {managerInitials}
          </div>
          <div className="text-left hidden md:block">
            <p className="text-[14px] font-medium text-slate-200">
              {activeBranch ? `Fleet Manager: ${activeBranch.fleetManagerName}` : 'Ген. директор'}
            </p>
            <p className="text-xs text-slate-400">
              {activeBranch ? `${activeBranch.city} (${activeBranch.code})` : 'Все участки и филиалы'}
            </p>
          </div>
        </button>
      </div>
    </header>
  );
};
