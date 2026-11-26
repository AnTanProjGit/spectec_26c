import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Truck, 
  Fuel, 
  Wrench, 
  User, 
  MapPin, 
  Plus, 
  TrendingUp, 
  Clock, 
  ArrowUpDown,
  FileSpreadsheet
} from 'lucide-react';
import { Equipment, EquipmentType, EquipmentStatus, FleetBranch } from '../../types';

interface FleetViewProps {
  equipmentList: Equipment[];
  activeBranch?: FleetBranch | null;
  branches?: FleetBranch[];
  onSelectEquipment: (eq: Equipment) => void;
  onAddEquipmentClick?: () => void;
  onOpenExcelExchange?: () => void;
}

export const FleetView: React.FC<FleetViewProps> = ({
  equipmentList,
  activeBranch,
  branches = [],
  onSelectEquipment,
  onOpenExcelExchange
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'profit' | 'revenue' | 'hours' | 'margin'>('profit');

  // Filter logic
  const filteredList = equipmentList.filter((eq) => {
    const matchesSearch = 
      eq.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.inventoryNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.vin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eq.plateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (eq.assignedSite && eq.assignedSite.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType = selectedType === 'all' || eq.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || eq.status === selectedStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  // Sort logic
  const sortedList = [...filteredList].sort((a, b) => {
    const directA = a.fuelCostMonth + a.driverSalaryMonth + a.repairCostMonth + a.transportCostMonth;
    const profitA = a.revenueMonth - directA - a.overheadsAllocated;
    const directB = b.fuelCostMonth + b.driverSalaryMonth + b.repairCostMonth + b.transportCostMonth;
    const profitB = b.revenueMonth - directB - b.overheadsAllocated;

    if (sortBy === 'profit') return profitB - profitA;
    if (sortBy === 'revenue') return b.revenueMonth - a.revenueMonth;
    if (sortBy === 'hours') return b.monthHours - a.monthHours;
    if (sortBy === 'margin') {
      const marginA = a.revenueMonth > 0 ? (profitA / a.revenueMonth) : 0;
      const marginB = b.revenueMonth > 0 ? (profitB / b.revenueMonth) : 0;
      return marginB - marginA;
    }
    return 0;
  });

  const typeTabs: { id: string; label: string }[] = [
    { id: 'all', label: 'Вся техника' },
    { id: 'excavator', label: 'Экскаваторы' },
    { id: 'crane', label: 'Автокраны' },
    { id: 'dump_truck', label: 'Самосвалы' },
    { id: 'loader', label: 'Погрузчики' },
    { id: 'bulldozer', label: 'Бульдозеры' },
    { id: 'cherry_picker', label: 'Автовышки' }
  ];

  return (
    <div className="p-2.5 space-y-2 max-w-7xl mx-auto">
      {/* Header and Counters */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            {activeBranch ? `Парк участка: ${activeBranch.name}` : 'Парк строительной спецтехники (Все участки)'}
          </h1>
          <p className="text-[14px] text-slate-400 mt-0.5">
            {activeBranch
              ? `Ответственный Fleet Manager: ${activeBranch.fleetManagerName} · База: ${activeBranch.baseAddress}`
              : 'Операционный учёт наработки, расхода ГСМ, ремонтов и рентабельности по всем филиалам'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onOpenExcelExchange && (
            <button
              onClick={onOpenExcelExchange}
              title="Загрузка и выгрузка Excel (.xlsx) реестра спецтехники"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs text-slate-300 hover:text-white font-medium transition cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Excel (.xlsx)</span>
            </button>
          )}
          <div className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs">
            <span className="text-slate-400">В реестре: </span>
            <strong className="text-white num-mono">{equipmentList.length} машин</strong>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Поиск по инв. номеру, марке, VIN, госномеру или объекту..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Статус:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">Все статусы</option>
              <option value="rented">В работе (в аренде)</option>
              <option value="available">Свободна</option>
              <option value="maintenance">В ремонте / ТО</option>
              <option value="reserve">Резерв</option>
            </select>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="profit">По чистой прибыли</option>
              <option value="revenue">По выручке</option>
              <option value="hours">По наработке (моточасы)</option>
              <option value="margin">По маржинальности %</option>
            </select>
          </div>
        </div>

        {/* Equipment Type Filter Tabs */}
        <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-800/80">
          {typeTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedType(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                selectedType === tab.id
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-800/60 hover:bg-slate-800 text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Equipment Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {sortedList.map((eq) => {
          const directCosts = eq.fuelCostMonth + eq.driverSalaryMonth + eq.repairCostMonth + eq.transportCostMonth;
          const operatingProfit = eq.revenueMonth - directCosts - eq.overheadsAllocated;
          const marginPercent = eq.revenueMonth > 0 ? (operatingProfit / eq.revenueMonth) * 100 : 0;
          const utilizationPercent = Math.min(100, (eq.monthHours / 200) * 100);

          return (
            <div
              key={eq.id}
              onClick={() => onSelectEquipment(eq)}
              className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition cursor-pointer group flex flex-col justify-between space-y-2 shadow-sm"
            >
              <div>
                {/* Card Header: Inv Number & Status */}
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {!activeBranch && (
                      <span className="font-mono text-xs font-bold px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
                        {branches.find(b => b.id === eq.branchId)?.code || eq.branchId}
                      </span>
                    )}
                    <span className="font-mono text-[14px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-400 border border-slate-700 group-hover:border-amber-500/40">
                      {eq.inventoryNumber}
                    </span>
                    <span className="text-[13px] font-mono text-slate-400">
                      {eq.plateNumber}
                    </span>
                  </div>

                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    eq.status === 'rented' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    eq.status === 'available' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                    eq.status === 'maintenance' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {eq.status === 'rented' ? 'В работе' : eq.status === 'available' ? 'Свободна' : eq.status === 'maintenance' ? 'В ТО' : 'Резерв'}
                  </span>
                </div>

                {/* Model Title */}
                <h3 className="text-base font-bold text-white group-hover:text-amber-300 transition tracking-tight">
                  {eq.name}
                </h3>
                <p className="text-[13px] text-slate-400 mt-0.5">
                  Ставка: <strong className="text-slate-200 num-mono">{eq.hourlyRate} ₽/час</strong> · VIN: {eq.vin.slice(-6)}
                </p>

                {/* Assignment Info */}
                <div className="mt-2 space-y-1 text-[14px] text-slate-300 border-t border-slate-800/80 pt-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="truncate text-[13px]">{eq.assignedSite || 'Центральная база / Базирование'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                    <span className="truncate text-[13px]">{eq.assignedOperator || 'Экипаж не назначен'}</span>
                  </div>
                </div>
              </div>

              {/* Financial & Operational Breakdown Box */}
              <div className="pt-2 border-t border-slate-800 space-y-1 text-[14px]">
                {/* Financial 2-column metrics */}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Выручка за месяц:</span>
                  <span className="font-mono font-bold text-white">{eq.revenueMonth.toLocaleString()} ₽</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-[11px]">Чистая прибыль:</span>
                  <span className={`font-mono font-bold ${operatingProfit > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {operatingProfit.toLocaleString()} ₽ ({marginPercent.toFixed(1)}%)
                  </span>
                </div>

                {/* Utilization Progress Bar */}
                <div className="pt-1">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Наработка: <strong className="text-slate-200 num-mono">{eq.monthHours} ч</strong></span>
                    <span>Загрузка: <strong className="text-slate-200 num-mono">{utilizationPercent.toFixed(0)}%</strong></span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${utilizationPercent > 70 ? 'bg-emerald-400' : 'bg-amber-400'}`} 
                      style={{ width: `${utilizationPercent}%` }} 
                    />
                  </div>
                </div>

                {/* Maintenance indicator */}
                <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                  <span className="flex items-center gap-1">
                    <Wrench className="w-3 h-3 text-slate-500" /> До ТО:
                  </span>
                  <span className={`font-mono ${eq.nextMaintenanceInHours < 50 ? 'text-rose-400 font-bold' : 'text-slate-300'}`}>
                    {eq.nextMaintenanceInHours} м/ч
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
