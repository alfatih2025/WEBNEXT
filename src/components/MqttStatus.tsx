import { motion } from 'framer-motion';
import { Wifi, AlertCircle, Activity, CalendarClock, Droplets, Thermometer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMqttStatus } from '../hooks/useMqttStatus';

function formatOneDecimal(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return 'N/A';
  return Number(value).toFixed(1);
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: 'good' | 'warning' | 'danger';
}) {
  const toneMap = {
    good: 'border-green-200 bg-green-50 text-green-800 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-200',
    warning: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
    danger: 'border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200',
  } as const;

  return (
    <div className={`rounded-2xl border p-3 ${toneMap[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
        <Icon size={15} />
      </div>
      <p className="mt-1 text-base font-bold leading-tight">{value}</p>
    </div>
  );
}

export function MqttStatus() {
  const status = useMqttStatus();
  const sensor = status.sensorSnapshot;
  const statusTone = status.espOnline ? 'good' : 'danger';

  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-slate-200 bg-white light-card p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <Wifi size={18} className="text-green-600 dark:text-green-400" />
          <div>
            <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Status Sistem</h4>
            <p className="text-xs text-slate-600 dark:text-slate-400">Ringkasan koneksi web, MQTT, dan ESP32</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${status.espOnline ? 'bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-200' : 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200'}`}>
            {status.espOnline ? 'ESP32 Online' : 'ESP32 Offline'}
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${status.mqttConnected ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'}`}>
            {status.mqttConnected ? 'MQTT Connected' : 'MQTT Disconnected'}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="ESP32" value={status.espOnline ? 'Online' : 'Offline'} icon={Activity} tone={status.espOnline ? 'good' : 'danger'} />
        <StatTile
          label="Node"
          value={sensor?.node_id != null ? `${sensor.node_id}` : 'N/A'}
          icon={CalendarClock}
          tone="good"
        />
        <StatTile label="Suhu" value={`${formatOneDecimal(sensor?.temperature)}${sensor?.temperature != null ? '°C' : ''}`} icon={Thermometer} tone="warning" />
        <StatTile label="Soil" value={`${formatOneDecimal(sensor?.soil_moisture)}${sensor?.soil_moisture != null ? '%' : ''}`} icon={Droplets} tone="warning" />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
          <p className="text-xs text-slate-600 dark:text-slate-400">Broker</p>
          <p className="truncate font-mono text-xs text-slate-700 dark:text-slate-200">{status.brokerUrl.split('//')[1]?.split(':')[0] || 'N/A'}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
          <p className="text-xs text-slate-600 dark:text-slate-400">Last Message</p>
          <p className="font-mono text-xs text-slate-700 dark:text-slate-200">{status.lastMessageAt ? new Date(status.lastMessageAt).toLocaleTimeString('id-ID') : 'N/A'}</p>
        </div>
        <div className="rounded-2xl bg-slate-100 p-3 dark:bg-slate-800">
          <p className="text-xs text-slate-600 dark:text-slate-400">Device</p>
          <p className="truncate font-semibold text-slate-700 dark:text-slate-200">{sensor?.device_id ?? 'N/A'}</p>
        </div>
      </div>

      {status.mqttError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-500/20 dark:bg-red-500/10"
        >
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0 text-red-600 dark:text-red-300" />
          <div>
            <p className="text-xs font-medium text-red-700 dark:text-red-200">Error:</p>
            <p className="text-xs text-red-600 dark:text-red-200">{status.mqttError}</p>
          </div>
        </motion.div>
      )}

      <div className={`mt-3 flex items-start gap-2 rounded-2xl border p-3 text-xs ${statusTone === 'good' ? 'border-blue-200 bg-blue-50 dark:border-blue-500/20 dark:bg-blue-500/10' : 'border-red-200 bg-red-50 dark:border-red-500/20 dark:bg-red-500/10'}`}>
        <Activity size={16} className="mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-300" />
        <div>
          <p className="font-medium text-blue-700 dark:text-blue-200">Ringkasan sistem</p>
          <p className="text-blue-600 dark:text-blue-200">{status.systemDetail}</p>
        </div>
      </div>
    </motion.section>
  );
}
