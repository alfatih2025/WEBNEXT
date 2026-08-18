import { Thermometer, Droplets, Activity } from 'lucide-react';
import type { NodeSensorData } from '../hooks/useMultiNodeSensorData';

interface NodeCardProps {
  nodeName: string;
  data: NodeSensorData | null;
}

function formatOneDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '--';
  return Number(value).toFixed(1);
}

export function NodeCard({ nodeName, data }: NodeCardProps) {
  return (
    <div className="glass-card p-6 flex flex-col relative overflow-hidden group">
      {/* Background Glow */}
      <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-3xl opacity-20 pointer-events-none transition-colors duration-1000 bg-blue-500`} />
      
      <div className="flex justify-between items-center mb-6 relative z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tight">{nodeName}</h2>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
        {/* Temperature */}
        <div className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Thermometer className="w-4 h-4 text-rose-500" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Suhu</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{formatOneDecimal(data?.temperature)}</span>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">°C</span>
          </div>
        </div>

        {/* Humidity */}
        <div className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-2 mb-2">
            <Droplets className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Kelembapan</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black text-slate-900 dark:text-white">{formatOneDecimal(data?.humidity)}</span>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">%</span>
          </div>
        </div>
      </div>

      {/* Soil Moisture with Progress Bar */}
      <div className="bg-slate-100 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-100 dark:border-slate-800/50 relative z-10">
        <div className="flex justify-between items-end mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-600 dark:text-green-400" />
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Kelembapan Tanah</span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{formatOneDecimal(data?.soil_moisture)}</span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">%</span>
          </div>
        </div>
        
        {/* Progress Bar Container */}
        <div className="h-3 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-green-500 to-blue-400 transition-all duration-1000 ease-out"
            style={{ width: `${Math.min(Math.max(data?.soil_moisture || 0, 0), 100)}%` }}
          />
        </div>
      </div>
      
      {/* Last Update */}
      <div className="mt-4 text-right text-xs text-slate-600 dark:text-slate-500 relative z-10">
        {data?.created_at ? `Diperbarui: ${new Date(data.created_at).toLocaleTimeString('id-ID')}` : 'Menunggu data...'}
      </div>
    </div>
  );
}
