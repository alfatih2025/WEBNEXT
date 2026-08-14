
import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Bot, Zap, Activity, CalendarDays, Filter, RefreshCw, Trash2 } from 'lucide-react';
import { buildApiHeaders } from '../lib/apiAuth';
import {
  readActivityLogs,
  sortActivityLogs,
  dedupeActivityLogs,
  getJakartaDateKey,
  formatActivityTime,
  type ActivityLogEntry,
  toCsv,
  clearActivityLogs,
} from '../lib/activityLog';

interface ServerLogEntry {
  id: number | string;
  type: string;
  message: string;
  details?: unknown;
  created_at: string;
}

interface ChatRow {
  id: number | string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

interface ControlRow {
  id: number | string;
  action: string;
  device: string;
  duration: number | null;
  status: string;
  executed_at: string;
}

interface SensorRow {
  id: number | string;
  device_id: string;
  temperature: number;
  humidity: number;
  soil_moisture: number;
  pump_status: boolean;
  created_at: string;
}

type UnifiedLog = ActivityLogEntry & {
  bucket: 'activity' | 'chat' | 'control' | 'sensor';
};

const sourceIcons = {
  activity: FileText,
  chat: Bot,
  control: Zap,
  sensor: Activity,
};

const sourceColors = {
  activity: 'bg-gray-100 text-gray-700',
  chat: 'bg-purple-100 text-purple-700',
  control: 'bg-blue-100 text-blue-700',
  sensor: 'bg-blue-100 text-blue-700',
};

function safeString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function describeSensor(row: SensorRow) {
  return `Suhu ${Number(row.temperature).toFixed(1)}°C • Udara ${Number(row.humidity).toFixed(1)}% • Tanah ${Number(row.soil_moisture).toFixed(1)}% • Pompa ${row.pump_status ? 'ON' : 'OFF'}`;
}

function mapActivity(entry: ActivityLogEntry): UnifiedLog {
  return {
    ...entry,
    bucket: 'activity',
  };
}

function mapServerLog(entry: ServerLogEntry): UnifiedLog {
  return {
    id: String(entry.id),
    source: 'system',
    type: entry.type,
    title: entry.type.replace(/_/g, ' '),
    message: entry.message,
    details: (entry.details as Record<string, unknown>) || null,
    created_at: entry.created_at,
    bucket: 'activity',
  };
}

function mapChatRow(entry: ChatRow): UnifiedLog {
  return {
    id: String(entry.id),
    source: 'chat',
    type: 'chat_message',
    title: entry.role === 'assistant' ? 'Balasan AI' : 'Pesan Pengguna',
    message: entry.content,
    details: { role: entry.role },
    created_at: entry.created_at,
    bucket: 'chat',
  };
}

function mapControlRow(entry: ControlRow): UnifiedLog {
  return {
    id: String(entry.id),
    source: 'control',
    type: entry.action,
    title: entry.action.replace(/_/g, ' '),
    message: `${entry.device} • ${entry.status}${entry.duration != null ? ` • ${entry.duration} detik` : ''}`,
    details: { action: entry.action, device: entry.device, duration: entry.duration, status: entry.status },
    created_at: entry.executed_at,
    bucket: 'control',
  };
}

function mapSensorRow(entry: SensorRow): UnifiedLog {
  return {
    id: String(entry.id),
    source: 'sensor',
    type: 'sensor_update',
    title: 'Update Sensor',
    message: describeSensor(entry),
    details: {
      device_id: entry.device_id,
      temperature: entry.temperature,
      humidity: entry.humidity,
      soil_moisture: entry.soil_moisture,
      pump_status: entry.pump_status,
    },
    created_at: entry.created_at,
    bucket: 'sensor',
  };
}

async function fetchJson<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { headers: buildApiHeaders() });
  if (!response.ok) return [];
  const payload = await response.json().catch(() => []);
  return Array.isArray(payload) ? payload as T[] : [];
}

export function LogsPage() {
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getJakartaDateKey());
  const [filter, setFilter] = useState<'all' | 'activity' | 'chat' | 'control' | 'sensor'>('all');
  const [items, setItems] = useState<UnifiedLog[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const [serverLogs, chatRows, controlRows, sensorRows] = await Promise.all([
        fetchJson<ServerLogEntry>('/api/logs?limit=1000'),
        fetchJson<ChatRow>('/api/chat?limit=300'),
        fetchJson<ControlRow>('/api/control?limit=300'),
        fetchJson<SensorRow>('/api/sensor?limit=300'),
      ]);

      const merged = dedupeActivityLogs([
        ...sortActivityLogs(readActivityLogs()).map(mapActivity),
        ...serverLogs.map(mapServerLog),
        ...chatRows.map(mapChatRow),
        ...controlRows.map(mapControlRow),
        ...sensorRows.map(mapSensorRow),
      ]);

      setItems(sortActivityLogs(merged) as UnifiedLog[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat log');
      setItems(sortActivityLogs(readActivityLogs()).map(mapActivity) as UnifiedLog[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const filteredItems = useMemo(() => {
    const byDate = items.filter((item) => getJakartaDateKey(item.created_at) === selectedDate);
    return filter === 'all' ? byDate : byDate.filter((item) => item.bucket === filter);
  }, [items, selectedDate, filter]);

  const summary = useMemo(() => {
    const total = filteredItems.length;
    const counts = {
      activity: filteredItems.filter((item) => item.bucket === 'activity').length,
      chat: filteredItems.filter((item) => item.bucket === 'chat').length,
      control: filteredItems.filter((item) => item.bucket === 'control').length,
      sensor: filteredItems.filter((item) => item.bucket === 'sensor').length,
    };
    const latest = filteredItems[0] || null;
    const first = filteredItems[filteredItems.length - 1] || null;
    return { total, counts, latest, first };
  }, [filteredItems]);

  const exportFiltered = (format: 'csv' | 'json') => {
    const filenameBase = `nexagrow_${selectedDate}`;
    if (format === 'csv') {
      const blob = new Blob([toCsv(filteredItems)], { type: 'text/csv;charset=utf-8' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      return;
    }

    const blob = new Blob([JSON.stringify(filteredItems, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenameBase}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const clearLocalHistory = () => {
    clearActivityLogs();
    void refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Log & Analitik</h2>
        </div>
        <div className="flex flex-wrap gap-2">

          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={refresh} className="flex items-center gap-2 rounded-xl bg-white light-card px-4 py-2 text-sm font-medium text-gray-700 shadow-sm ring-1 ring-gray-200 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300">
            <RefreshCw size={16} />
            Muat Ulang
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => exportFiltered('csv')} className="flex items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-600">
            <Download size={16} />
            CSV
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => exportFiltered('json')} className="flex items-center gap-2 rounded-xl bg-gray-800 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-900">
            <Download size={16} />
            JSON
          </motion.button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={clearLocalHistory} className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm ring-1 ring-red-200">
            <Trash2 size={16} />
            Hapus Lokal
          </motion.button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white light-card p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Total hari ini</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.total}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white light-card p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Sensor</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.counts.sensor}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white light-card p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Kontrol</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.counts.control}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white light-card p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <p className="text-xs uppercase tracking-wide text-gray-600 dark:text-gray-300">Chat</p>
          <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.counts.chat}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-gray-100 bg-white light-card p-4 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 ring-1 ring-gray-200 dark:bg-[#111827]">
              <CalendarDays size={16} className="text-green-600 dark:text-green-400" />
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-transparent text-sm outline-none" />
            </div>

            <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 ring-1 ring-gray-200 dark:bg-[#111827]">
              <Filter size={16} className="text-green-600 dark:text-green-400" />
              <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="bg-transparent text-sm outline-none">
                <option value="all">Semua</option>
                <option value="activity">Aktivitas</option>
                <option value="chat">Chat</option>
                <option value="control">Kontrol</option>
                <option value="sensor">Sensor</option>
              </select>
            </div>

            {error && <span className="text-sm text-red-600">{error}</span>}
          </div>

          <div className="max-h-[760px] space-y-3 overflow-y-auto pr-1">
            {loading ? (
              <div className="p-8 text-center text-gray-600 dark:text-gray-300">Memuat log...</div>
            ) : filteredItems.length === 0 ? (
              <div className="p-8 text-center text-gray-600 dark:text-gray-300">Tidak ada histori untuk tanggal ini.</div>
            ) : (
              filteredItems.map((item, idx) => {
                const Icon = sourceIcons[item.bucket];
                return (
                  <motion.div
                    key={`${item.bucket}-${item.id}-${idx}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className="rounded-2xl border border-gray-100 p-4 shadow-sm hover:bg-slate-100/70 dark:border-gray-800"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`rounded-xl p-2 ${sourceColors[item.bucket]}`}>
                        <Icon size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:bg-[#111827] dark:text-gray-300">
                            {item.bucket}
                          </span>
                          <span className="text-xs text-gray-600 dark:text-gray-300">{formatActivityTime(item.created_at)}</span>
                          <span className="text-xs text-gray-600 dark:text-gray-300">{item.type}</span>
                        </div>
                        <p className="mt-1 font-semibold text-gray-900 dark:text-gray-100">{item.title}</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{item.message}</p>
                        {item.details && (
                          <pre className="mt-3 overflow-auto rounded-xl bg-slate-100 p-3 text-[11px] text-gray-600 dark:bg-[#111827] dark:text-gray-300">
                            {JSON.stringify(item.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-100 bg-white light-card p-5 shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Analisa Harian</h3>
            <div className="mt-4 space-y-3 text-sm text-gray-600 dark:text-gray-300">
              <p>
                {summary.total > 0
                  ? `Ada ${summary.total} aktivitas pada ${selectedDate}.`
                  : `Belum ada aktivitas pada ${selectedDate}.`}
              </p>
              <p>
                {summary.latest
                  ? `Aktivitas terakhir: ${summary.latest.title} pada ${formatActivityTime(summary.latest.created_at)}.`
                  : 'Belum ada aktivitas terbaru.'}
              </p>
              <p>
                {summary.counts.sensor > summary.counts.control
                  ? 'Histori sensor lebih dominan, sehingga data pemantauan dapat dianalisis lebih rinci.'
                  : 'Histori kontrol dan interaksi manual cukup aktif untuk menilai respons operator.'}
              </p>
              <p>
                {summary.first
                  ? `Rentang histori hari ini dimulai dari ${formatActivityTime(summary.first.created_at)}.`
                  : ''}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white light-card p-5 shadow-sm dark:bg-gray-900 dark:border-gray-800">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ringkasan Sumber</h3>
            <div className="mt-4 space-y-3 text-sm">
              {(['activity', 'chat', 'control', 'sensor'] as const).map((bucket) => (
                <div key={bucket} className="flex items-center justify-between rounded-xl bg-slate-100 px-3 py-2 dark:bg-[#111827]">
                  <span className="capitalize text-gray-700 dark:text-gray-300">{bucket}</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{summary.counts[bucket]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
