import React from 'react';
import { X, Wrench, Fuel, Banknote, Clock, MapPin, User, Activity, AlertTriangle, ShieldCheck } from 'lucide-react';
import { Equipment } from '../types';

interface EquipmentDetailModalProps {
  equipment: Equipment | null;
  onClose: () => void;
  onEditStatus?: (id: string, newStatus: Equipment['status']) => void;
}

export const EquipmentDetailModal: React.FC<EquipmentDetailModalProps> = ({
  equipment,
  onClose,
  onEditStatus
}) => {
  if (!equipment) return null;

  const directCosts = equipment.fuelCostMonth + equipment.driverSalaryMonth + equipment.repairCostMonth + equipment.transportCostMonth;
  const contributionProfit = equipment.revenueMonth - directCosts;
  const operatingProfit = contributionProfit - equipment.overheadsAllocated;
  const marginPercent = equipment.revenueMonth > 0 ? (operatingProfit / equipment.revenueMonth) * 100 : 0;
  const costPerHour = equipment.monthHours > 0 ? Math.round(directCosts / equipment.monthHours) : 0;
  const revenuePerHour = equipment.monthHours > 0 ? Math.round(equipment.revenueMonth / equipment.monthHours) : 0;

  const statusLabels: Record<Equipment['status'], { label: string; color: string; border: string }> = {
    rented: { label: 'В аренде', color: 'text-emerald-400 bg-emerald-500/10', border: 'border-emerald-500/30' },
    available: { label: 'Свободна', color: 'text-blue-400 bg-blue-500/10', border: 'border-blue-500/30' },
    maintenance: { label: 'В ТО / Ремонте', color: 'text-amber-400 bg-amber-500/10', border: 'border-amber-500/30' },
    reserve: { label: 'Резерв', color: 'text-slate-400 bg-slate-500/10', border: 'border-slate-500/30' }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-[14px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30">
                {equipment.inventoryNumber}
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">{equipment.name}</h2>
              <span className={`text-[14px] px-2.5 py-0.5 rounded-full font-medium border ${statusLabels[equipment.status].color} ${statusLabels[equipment.status].border}`}>
                {statusLabels[equipment.status].label}
              </span>
            </div>
            <p className="text-[14px] text-slate-400 mt-1">
              VIN: <span className="font-mono text-slate-300">{equipment.vin}</span> · Гос. номер: <span className="font-mono text-slate-300">{equipment.plateNumber}</span> · Год: {equipment.year} · {equipment.owner}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-2.5">
          {/* Key Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Выручка за месяц</span>
              <span className="text-base font-bold text-white num-mono">{equipment.revenueMonth.toLocaleString()} ₽</span>
              <span className="text-xs text-slate-500 block mt-0.5">{equipment.monthHours} моточасов</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Операционная прибыль</span>
              <span className="text-base font-bold text-emerald-400 num-mono">{operatingProfit.toLocaleString()} ₽</span>
              <span className="text-xs text-emerald-500 block mt-0.5">Маржа {marginPercent.toFixed(1)}%</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Доход / час</span>
              <span className="text-base font-bold text-amber-400 num-mono">{revenuePerHour.toLocaleString()} ₽/ч</span>
              <span className="text-xs text-slate-500 block mt-0.5">Ставка: {equipment.hourlyRate} ₽/ч</span>
            </div>
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
              <span className="text-[11px] text-slate-400 block">Себестоимость / час</span>
              <span className="text-base font-bold text-slate-300 num-mono">{costPerHour.toLocaleString()} ₽/ч</span>
              <span className="text-xs text-slate-500 block mt-0.5">Прямые затраты</span>
            </div>
          </div>

          {/* Strict Formula Breakdown Accordion/Card */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-800/80">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                Экономика машины (Структура доходов и затрат)
              </span>
              <span className="text-[13px] text-slate-400 font-mono">
                Formula: Revenue - DirectCosts - Overheads
              </span>
            </div>

            <div className="space-y-1.5 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Выручка (Revenue = {equipment.monthHours}ч × {equipment.hourlyRate}₽):
                </span>
                <span className="font-bold text-white num-mono">+{equipment.revenueMonth.toLocaleString()} ₽</span>
              </div>

              <div className="pl-4 border-l-2 border-slate-800 space-y-1.5 text-slate-400">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Fuel className="w-3.5 h-3.5 text-amber-400" /> Дизельное топливо ({equipment.fuelRateHour} л/ч):
                  </span>
                  <span className="text-rose-400 font-mono">-{equipment.fuelCostMonth.toLocaleString()} ₽</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-400" /> Зарплата экипажа (сдельная):
                  </span>
                  <span className="text-rose-400 font-mono">-{equipment.driverSalaryMonth.toLocaleString()} ₽</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-amber-400" /> Запчасти, ТО и ремонты:
                  </span>
                  <span className="text-rose-400 font-mono">-{equipment.repairCostMonth.toLocaleString()} ₽</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Доставка / трал / перебазировка:
                  </span>
                  <span className="text-rose-400 font-mono">-{equipment.transportCostMonth.toLocaleString()} ₽</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-slate-300 font-medium">Маржинальный доход (Contribution Profit):</span>
                <span className="font-mono font-semibold text-emerald-300">
                  {contributionProfit.toLocaleString()} ₽
                </span>
              </div>

              <div className="flex items-center justify-between text-slate-400">
                <span>Распределённые накладные расходы (Overheads):</span>
                <span className="text-rose-400 font-mono">-{equipment.overheadsAllocated.toLocaleString()} ₽</span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-700 bg-slate-900/60 p-2.5 rounded-lg">
                <span className="text-slate-100 font-bold">Итоговая чистая операционная прибыль:</span>
                <span className="text-base font-bold text-emerald-400 font-mono">
                  {operatingProfit.toLocaleString()} ₽ ({marginPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Operational Context & Telemetry */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
              <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide block">
                Текущая дислокация и экипаж
              </span>
              <div className="space-y-1.5 text-[14px]">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Текущий объект:</span>
                    <span className="text-slate-200 font-medium">{equipment.assignedSite || 'Не назначен / База'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <User className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Закреплённый машинист:</span>
                    <span className="text-slate-200 font-medium">{equipment.assignedOperator || 'Сменный экипаж'}</span>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-slate-400 block text-[10px]">Общий счётчик моточасов:</span>
                    <span className="text-amber-400 font-mono font-bold">{equipment.currentHours.toLocaleString()} м/ч</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200 uppercase tracking-wide">
                  Техническое обслуживание (ТО)
                </span>
                <Wrench className="w-4 h-4 text-amber-400" />
              </div>
              <div className="space-y-1.5 text-[14px]">
                <div>
                  <div className="flex justify-between text-[13px] mb-1">
                    <span className="text-slate-400 text-[11px]">До следующего ТО:</span>
                    <span className={`font-mono font-bold ${equipment.nextMaintenanceInHours < 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {equipment.nextMaintenanceInHours} моточасов
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${equipment.nextMaintenanceInHours < 50 ? 'bg-rose-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, Math.max(10, (250 - equipment.nextMaintenanceInHours) / 2.5))}%` }}
                    />
                  </div>
                </div>

                <div className="pt-2 text-[13px] text-slate-400">
                  <span>Балансовая стоимость: </span>
                  <span className="text-slate-200 font-mono font-medium">{(equipment.currentValue / 1_000_000).toFixed(2)} млн ₽</span>
                </div>
                {equipment.notes && (
                  <p className="text-[13px] text-amber-300/90 bg-amber-500/10 p-2 rounded border border-amber-500/20">
                    {equipment.notes}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick status change buttons */}
          {onEditStatus && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <span className="text-xs text-slate-400">Сменить операционный статус:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onEditStatus(equipment.id, 'rented')}
                  className="px-2.5 py-1 text-xs rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20 transition cursor-pointer"
                >
                  В аренду
                </button>
                <button
                  onClick={() => onEditStatus(equipment.id, 'available')}
                  className="px-2.5 py-1 text-xs rounded bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition cursor-pointer"
                >
                  Свободна
                </button>
                <button
                  onClick={() => onEditStatus(equipment.id, 'maintenance')}
                  className="px-2.5 py-1 text-xs rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition cursor-pointer"
                >
                  В ремонт / ТО
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
