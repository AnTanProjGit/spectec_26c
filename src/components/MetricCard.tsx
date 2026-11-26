import React from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  trend?: {
    positive?: boolean;
    text: string;
  };
  icon?: React.ReactNode;
  badge?: string;
  highlight?: boolean;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subValue,
  trend,
  icon,
  badge,
  highlight = false
}) => {
  return (
    <div className={`p-4 rounded-xl border transition relative overflow-hidden ${
      highlight 
        ? 'bg-gradient-to-br from-slate-900 to-amber-950/20 border-amber-500/40 shadow-sm' 
        : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
    }`}>
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span className="font-medium tracking-wide uppercase text-[11px] text-slate-400">{title}</span>
        {icon && <div className="text-slate-400">{icon}</div>}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-2xl font-bold tracking-tight text-white num-mono">{value}</span>
        {subValue && (
          <span className="text-[14px] text-slate-400 font-mono">{subValue}</span>
        )}
      </div>

      <div className="mt-1.5 flex items-center justify-between text-[14px]">
        {trend && (
          <div className="flex items-center gap-1.5">
            <span className={`font-mono font-medium ${trend.positive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {trend.text}
            </span>
            <span className="text-slate-500 text-[13px]">к пред. периоду</span>
          </div>
        )}
        {badge && (
          <span className="text-[13px] font-mono text-slate-400">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
};
