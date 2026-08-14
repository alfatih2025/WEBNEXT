import { ControlPanel } from '../components/ControlPanel';
import { Zap, History } from 'lucide-react';
import { useControl } from '../hooks/useControl';
import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { SensorData } from '../hooks/useSensorData';

interface ControlPageProps {
  sensorData: SensorData | null;
}

export function ControlPage({ sensorData }: ControlPageProps) {
  const { logs, fetchLogs } = useControl();

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const recentLogs = useMemo(() => logs.slice(0, 10), [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Zap className="h-6 w-6 text-green-600 dark:text-green-400" />
        <div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Kontrol Perangkat</h2>
        </div>
      </div>

      <ControlPanel sensorData={sensorData} />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-slate-200 bg-white light-card p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-6 flex items-center gap-3">
          <History className="h-5 w-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Riwayat Perintah</h3>
        </div>

        <div className="max-h-64 space-y-3 overflow-y-auto">
          {recentLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-center justify-between rounded-2xl p-3 ${
                log.status === 'completed'
                  ? 'bg-green-50 dark:bg-green-500/10'
                  : log.status === 'failed'
                    ? 'bg-red-50 dark:bg-red-500/10'
                    : 'bg-amber-50 dark:bg-amber-500/10'
              }`}
            >
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">{log.action}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {new Date(log.executed_at).toLocaleString('id-ID')}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  log.status === 'completed'
                    ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-200'
                    : log.status === 'failed'
                      ? 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
                }`}
              >
                {log.status}
              </span>
            </div>
          ))}
          {recentLogs.length === 0 && (
            <div className="text-sm text-slate-600 dark:text-slate-400">Belum ada riwayat perintah.</div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
