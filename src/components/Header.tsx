import { Bell, Wifi, WifiOff, ChevronDown, CheckCheck, ShieldAlert, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { MqttStatusSnapshot } from '../hooks/useMqttStatus';
import { useAlerts } from '../hooks/useAlerts';
import { PlantHealthSummary } from '../lib/plantPhase';
import { useTheme } from '../context/ThemeContext';

interface HeaderProps {
  mqttStatus: MqttStatusSnapshot;
  currentPage: string;
  health?: PlantHealthSummary | null;
}

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard',
  monitoring: 'Monitoring Real-time',
  chat: 'NexaBot',
  control: 'Kontrol Perangkat',
  weather: 'Prakiraan Cuaca',
  logs: 'Log & Analitik',
  settings: 'Pengaturan',
  about: 'About / Tentang NexaGrow',
};

export function Header({ mqttStatus, currentPage, health }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const { alerts, unreadCount, markAsRead, fetchAlerts } = useAlerts();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const isOnline = mqttStatus.espOnline;
  
  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  useEffect(() => {
    if (open) fetchAlerts();
  }, [open, fetchAlerts]);

  const title = pageTitles[currentPage] || 'Dashboard';

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="min-w-0 pl-12 pr-1 sm:pl-0">
          <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100 sm:text-2xl">{title}</h2>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <motion.div
            initial={false}
            animate={{
              backgroundColor: isOnline ? 'rgba(16, 185, 129, 0.14)' : 'rgba(248, 113, 113, 0.14)',
              color: isOnline ? (theme === 'dark' ? '#34d399' : '#065f46') : (theme === 'dark' ? '#f87171' : '#991b1b'),
            }}
            className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] font-semibold sm:px-3 sm:py-2 sm:text-xs"
          >
            {isOnline ? (
              <>
                <Wifi size={15} className="text-green-600 dark:text-green-400" />
                <span className="hidden sm:inline">Sistem Online</span>
                <span className="sm:hidden">Online</span>
              </>
            ) : (
              <>
                <WifiOff size={15} className="text-red-500" />
                <span className="hidden sm:inline">Sistem Offline</span>
                <span className="sm:hidden">Offline</span>
              </>
            )}
          </motion.div>

          <div className="relative" ref={panelRef}>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setOpen((prev) => !prev)}
              className="relative inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white light-card px-3 py-2 text-slate-700 transition hover:bg-slate-100 dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300"
              title="Notifikasi"
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold text-white"
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </motion.span>
              )}
              <ChevronDown size={14} className={`text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
            </motion.button>

            <AnimatePresence>
              {open && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.98 }}
                  className="absolute right-0 mt-3 w-[min(92vw,24rem)] overflow-hidden rounded-3xl border border-slate-200 bg-white light-card shadow-2xl dark:bg-gray-900 dark:border-gray-800"
                >
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-gray-800">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Histori Notifikasi</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300">{unreadCount} belum dibaca</p>
                    </div>
                    <button
                      onClick={() => markAsRead()}
                      className="inline-flex items-center gap-1 rounded-xl bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100"
                    >
                      <CheckCheck size={14} />
                      Tandai semua
                    </button>
                  </div>

                  <div className="max-h-[22rem] space-y-2 overflow-y-auto p-3">
                    {alerts.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-200 p-5 text-center text-sm text-slate-600 dark:border-gray-800 dark:text-slate-300">
                        Belum ada notifikasi.
                      </div>
                    )}

                    {alerts.slice(0, 10).map((alert) => (
                      <div
                        key={alert.id}
                        className={`rounded-2xl border p-3 ${
                          alert.severity === 'danger' ? 'border-red-200 bg-red-50' 
                            : alert.severity === 'info' ? 'border-blue-200 bg-blue-50' 
                            : 'border-amber-200 bg-amber-50'
                        }`}
                      >
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{alert.message}</p>
                        <div className="mt-1 flex items-center justify-between">
                          <p className="text-xs text-slate-600 dark:text-slate-300">{alert.type}</p>
                          {!alert.read && (
                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-green-700">
                              Baru
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
