import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X, Thermometer, Droplets } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { SensorData } from '../hooks/useSensorData';
import { Settings } from '../hooks/useSettings';

interface AlertBannerProps {
  sensorData: SensorData | null;
  settings: Settings | null;
}

interface Alert {
  id: string;
  type: string;
  message: string;
  severity: 'warning' | 'danger';
  icon: LucideIcon;
}

export function AlertBanner({ sensorData, settings }: AlertBannerProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!sensorData || !settings) return;

    const newAlerts: Alert[] = [];

    if (sensorData.temperature != null && sensorData.temperature > settings.temp_threshold_high) {
      newAlerts.push({
        id: 'temp-high',
        type: 'temperature',
        message: `Suhu terlalu tinggi (${sensorData.temperature}°C).`,
        severity: 'danger',
        icon: Thermometer,
      });
    }

    if (sensorData.temperature != null && sensorData.temperature < settings.temp_threshold_low) {
      newAlerts.push({
        id: 'temp-low',
        type: 'temperature',
        message: `Suhu terlalu rendah (${sensorData.temperature}°C).`,
        severity: 'warning',
        icon: Thermometer,
      });
    }

    if (sensorData.soil_moisture != null && sensorData.soil_moisture < settings.soil_threshold_critical) {
      newAlerts.push({
        id: 'soil-critical',
        type: 'soil',
        message: `Kelembapan tanah kritis (${sensorData.soil_moisture}%).`,
        severity: 'danger',
        icon: Droplets,
      });
    } else if (sensorData.soil_moisture != null && sensorData.soil_moisture < settings.soil_threshold_low) {
      newAlerts.push({
        id: 'soil-low',
        type: 'soil',
        message: `Kelembapan tanah rendah (${sensorData.soil_moisture}%).`,
        severity: 'warning',
        icon: Droplets,
      });
    }

    setAlerts(newAlerts.filter((a) => !dismissed.has(a.id)));
  }, [sensorData, settings, dismissed]);

  const dismissAlert = (id: string) => {
    setDismissed((prev) => new Set(prev).add(id));
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <AnimatePresence>
      {alerts.map((alert) => (
        <motion.div
          key={alert.id}
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          className={`mb-4 p-4 rounded-xl border-l-4 ${
            alert.severity === 'danger'
              ? 'bg-red-50 border-red-500'
              : 'bg-amber-50 border-amber-500'
          }`}
        >
          <div className="flex items-start gap-3">
            <alert.icon className={`w-5 h-5 mt-0.5 ${alert.severity === 'danger' ? 'text-red-500' : 'text-amber-500'}`} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-gray-800 dark:text-gray-100">{alert.message}</p>
                <button onClick={() => dismissAlert(alert.id)} className="text-gray-600 hover:text-gray-600 dark:text-gray-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-1 dark:text-gray-300">{alert.type}</p>
            </div>
          </div>
        </motion.div>
      ))}
    </AnimatePresence>
  );
}
