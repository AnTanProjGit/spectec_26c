import React from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  FileSpreadsheet, 
  Users, 
  Clock, 
  Bot, 
  BookOpen,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Building2,
  MessageSquare,
  ShieldCheck,
  Briefcase,
  Scale
} from 'lucide-react';

export type NavTab = 
  | 'dashboard'
  | 'fleet_manager'
  | 'fleet'
  | 'rentals'
  | 'contracts'
  | 'crm'
  | 'timesheets'
  | 'chat'
  | 'ai_analyst'
  | 'knowledge'
  | 'branches'
  | 'integrations_1c'
  | 'admin_panel';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  unresolvedAnomaliesCount: number;
  chatMessagesCount?: number;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenExcelExchange?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  unresolvedAnomaliesCount,
  chatMessagesCount = 0,
  isCollapsed,
  onToggleCollapse,
  onOpenExcelExchange
}) => {
  const navItems: {
    id: NavTab;
    label: string;
    icon: React.FC<{ className?: string }>;
    badge?: number;
    badgeTone?: 'rose' | 'sky';
  }[] = [
    { id: 'dashboard', label: 'Главный Дашборд (BI)', icon: LayoutDashboard },
    { id: 'fleet_manager', label: 'Поле Fleet Manager', icon: Briefcase },
    { id: 'fleet', label: 'Парк спецтехники', icon: Truck },
    { id: 'rentals', label: 'Аренда и Объекты', icon: FileSpreadsheet },
    { id: 'crm', label: 'CRM и Воронка продаж', icon: Users },
    { 
      id: 'timesheets', 
      label: 'Табели и Смены (З/П)', 
      icon: Clock,
      badge: unresolvedAnomaliesCount > 0 ? unresolvedAnomaliesCount : undefined,
      badgeTone: 'rose'
    },
    {
      id: 'chat',
      label: 'Операционный чат',
      icon: MessageSquare,
      badge: chatMessagesCount > 0 ? chatMessagesCount : undefined,
      badgeTone: 'sky'
    },
    { id: 'ai_analyst', label: 'AI-Аналитик и Юрист', icon: Bot },
    { id: 'contracts', label: 'Договора', icon: Scale },
    { id: 'knowledge', label: 'База знаний', icon: BookOpen },
    { id: 'branches', label: 'Участки и Филиалы', icon: Building2 },
    { id: 'admin_panel', label: 'Администрирование', icon: ShieldCheck },
    { id: 'integrations_1c', label: '1С Бухгалтерия API', icon: Landmark }
  ];

  return (
    <aside 
      className={`bg-slate-900 border-r border-slate-800 flex flex-col justify-between shrink-0 select-none transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-[46px]' : 'w-64'
      }`}
    >
      <div className={isCollapsed ? 'py-2' : 'py-3.5'}>
        {/* Sidebar Header with Collapse Button */}
        <div className={`flex items-center ${isCollapsed ? 'justify-center px-1 mb-1.5' : 'justify-between px-3.5 mb-3'}`}>
          {!isCollapsed && (
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 truncate">
              Управление
            </span>
          )}
          <button
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Развернуть сайдбар меню' : 'Свернуть сайдбар влево'}
            className={`${isCollapsed ? 'p-1' : 'p-1.5'} rounded-lg text-slate-400 hover:text-amber-400 hover:bg-slate-800/90 transition cursor-pointer flex items-center justify-center`}
            aria-label={isCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-amber-400" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Navigation links */}
        <nav className={isCollapsed ? 'space-y-0.5 px-1' : 'space-y-1 px-2.5'}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const isSkyBadge = item.badgeTone === 'sky';
            return (
              <button
                key={item.id}
                onClick={() => onSelectTab(item.id)}
                title={isCollapsed ? item.label : undefined}
                className={`w-full flex items-center rounded-lg text-xs font-medium transition cursor-pointer relative group ${
                  isCollapsed ? 'justify-center p-1.5' : 'justify-between px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                }`}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-slate-200'}`} />
                  {!isCollapsed && <span className="truncate">{item.label}</span>}
                </div>

                {item.badge && (
                  isCollapsed ? (
                    <span 
                      className={`absolute top-1 right-1 w-2 h-2 rounded-full ring-2 ring-slate-900 ${
                        isSkyBadge ? 'bg-sky-400' : 'bg-rose-500'
                      }`}
                      title={`${item.label}: ${item.badge}`}
                    />
                  ) : (
                    <span
                      className={`px-1.5 py-0.5 text-xs font-mono rounded font-bold shrink-0 border ${
                        isSkyBadge
                          ? 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                          : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )
                )}

                {/* Floating tooltip on hover when collapsed */}
                {isCollapsed && (
                  <div className="absolute left-full ml-2 z-50 px-2.5 py-1 rounded bg-slate-950 text-slate-100 text-xs font-medium whitespace-nowrap shadow-xl border border-slate-800 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                    {item.label}
                    {item.badge && (
                      <span className={`ml-1.5 font-mono font-bold ${isSkyBadge ? 'text-sky-400' : 'text-rose-400'}`}>
                        ({item.badge})
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        {/* Excel (.xlsx) Exchange Tool button */}
        {onOpenExcelExchange && (
          <div className={isCollapsed ? 'pt-1.5 px-1 mt-1.5 border-t border-slate-800/60' : 'pt-2 px-2.5 mt-2 border-t border-slate-800/60'}>
            <button
              onClick={onOpenExcelExchange}
              title={isCollapsed ? "Импорт / Экспорт Excel (.xlsx)" : undefined}
              className={`w-full flex items-center rounded-lg text-xs font-medium transition cursor-pointer text-slate-300 hover:bg-slate-800/80 hover:text-white relative group ${
                isCollapsed ? 'justify-center p-1.5' : 'gap-3 px-3 py-2'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400 shrink-0" />
              {!isCollapsed && <span>Импорт / Экспорт Excel</span>}

              {isCollapsed && (
                <div className="absolute left-full ml-2 z-50 px-2.5 py-1 rounded bg-slate-950 text-slate-100 text-xs font-medium whitespace-nowrap shadow-xl border border-slate-800 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity">
                  Импорт / Экспорт Excel (.xlsx)
                </div>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Footer / System formula widget */}
      <div className={`border-t border-slate-800/80 bg-slate-950/40 ${isCollapsed ? 'p-1.5 text-center' : 'p-3'}`}>
        {isCollapsed ? (
          <button
            onClick={onToggleCollapse}
            title="Развернуть боковое меню"
            className="w-full flex justify-center py-1 text-slate-400 hover:text-amber-400 transition cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-start justify-between gap-2 text-xs text-slate-400">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 text-amber-400 shrink-0">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <div>
                <p className="text-slate-200 font-medium text-[13px]">Операционный расчёт</p>
                <p className="text-xs text-slate-400 leading-relaxed mt-0.5 font-mono">
                  Rev - Costs - Overheads
                </p>
              </div>
            </div>
            <button
              onClick={onToggleCollapse}
              title="Свернуть сайдбар влево"
              className="p-1 rounded text-slate-500 hover:text-slate-300 transition cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
