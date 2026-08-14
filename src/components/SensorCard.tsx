import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface SensorCardProps {
  title: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  status: 'good' | 'warning' | 'danger';
  trend?: 'up' | 'down' | 'stable';
  color?: string;
}

const statusColors = {
  good: {
    bg: 'bg-green-50 dark:bg-green-500/10',
    border: 'border-green-200 dark:border-green-500/20',
    icon: 'text-green-600 dark:text-green-400',
    value: 'text-green-700 dark:text-green-300',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/20',
    icon: 'text-amber-600 dark:text-amber-400',
    value: 'text-amber-700 dark:text-amber-300',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-500/10',
    border: 'border-red-200 dark:border-red-500/20',
    icon: 'text-red-600 dark:text-red-400',
    value: 'text-red-700 dark:text-red-300',
  },
} as const;

export function SensorCard({ title, value, unit, icon: Icon, status, trend }: SensorCardProps) {
  const colors = statusColors[status];

  return (
    <motion.div
      whileHover={{ y: -2, scale: 1.01 }}
      className={`rounded-2xl border ${colors.border} ${colors.bg} p-3 shadow-sm transition-all hover:shadow-md sm:p-3 h-full min-h-[120px]`}
    >
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-600 sm:text-xs dark:text-slate-300">{title}</p>
            <div className="mt-2 flex items-end gap-2 sm:mt-3">
              <span className={`text-xl font-bold leading-none sm:text-2xl ${colors.value}`}>{value}</span>
              {unit && <span className="pb-0.5 text-xs text-slate-600 sm:text-sm dark:text-slate-300">{unit}</span>}
            </div>
          </div>

          <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/70 dark:bg-slate-900/50 ${colors.icon} sm:h-10 sm:w-10`}>
            <Icon size={18} />
          </div>
        </div>

        {trend && (
          <div className="flex items-center gap-1 text-[11px] sm:text-xs">
            <span
              className={`h-2 w-2 rounded-full ${trend === 'up' ? 'bg-red-500' : trend === 'down' ? 'bg-green-500' : 'bg-gray-400'}`}
            />
            <span className="text-slate-600 dark:text-slate-300">{trend === 'up' ? 'Meningkat' : trend === 'down' ? 'Menurun' : 'Stabil'}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
