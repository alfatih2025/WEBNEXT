import { useState, useEffect, useCallback, useRef } from 'react';
import { getSensorSnapshot, subscribeMqttStatus, getMqttStatusSnapshot, type MqttSensorSnapshot } from '../services/mqtt';

export interface SensorData {
  id?: number;
  node_id: number | null;
  device_id: string;
  temperature: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  created_at: string;
}

function toNumber(value: unknown, fallback: number | null = null): number | null {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no'].includes(normalized)) return false;
  }
  return fallback;
}

function buildFallbackData(): SensorData {
  return {
    node_id: null,
    device_id: 'ESP32_001',
    temperature: null,
    humidity: null,
    soil_moisture: null,
    created_at: new Date().toISOString(),
  };
}

function normalizeSensorDataRow(row: any): SensorData | null {
  if (!row || typeof row !== 'object') return null;
  const fallback = buildFallbackData();

  const nodeId = Number(row.node_id ?? row.node ?? row.device_id?.replace('node_', '') ?? fallback.node_id);

  return {
    id: row.id ?? undefined,
    node_id: Number.isInteger(nodeId) ? nodeId : null,
    device_id: row.device_id ?? (row.node_id ? `node_${row.node_id}` : fallback.device_id),
    temperature: toNumber(row.temperature, fallback.temperature),
    humidity: toNumber(row.humidity, fallback.humidity),
    soil_moisture: toNumber(row.soil_moisture ?? row.soil ?? row.tanah, fallback.soil_moisture),
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

function mergeSensorData(base: SensorData | null, live: MqttSensorSnapshot | null): SensorData | null {
  if (!base && !live) return null;
  const fallback = base ?? buildFallbackData();

  return {
    ...fallback,
    node_id: live?.node_id ?? fallback.node_id,
    device_id: live?.device_id ?? fallback.device_id,
    temperature: live?.temperature ?? fallback.temperature,
    humidity: live?.humidity ?? fallback.humidity,
    soil_moisture: live?.soil_moisture ?? fallback.soil_moisture,
    created_at: live?.updatedAt ?? fallback.created_at,
  };
}

// Saat inisialisasi, kita asumsikan fallback DB yang akan me-refresh
const getInitialSensorData = () => {
  const isOnline = getMqttStatusSnapshot().mqttConnected;
  return mergeSensorData(null, isOnline ? getSensorSnapshot() : null);
};

export function useSensorData(pollInterval = 1000) {
  const [data, setData] = useState<SensorData | null>(getInitialSensorData);
  const [history, setHistory] = useState<SensorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastDataRef = useRef<SensorData | null>(getInitialSensorData());

  const mergeWithLiveSnapshot = useCallback((next: SensorData | null) => {
    const isOnline = getMqttStatusSnapshot().mqttConnected;
    const live = isOnline ? getSensorSnapshot() : null;
    return mergeSensorData(next ?? lastDataRef.current, live);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [latestRes, historyRes] = await Promise.all([
        fetch('/api/sensor?latest=true'),
        fetch('/api/sensor?limit=60'),
      ]);

      if (!latestRes.ok || !historyRes.ok) {
        throw new Error('Failed to fetch sensor data');
      }

      const latest = await latestRes.json().catch(() => null);
      const historyData = await historyRes.json().catch(() => []);

      const normalizedLatest = normalizeSensorDataRow(latest);
      const mergedLatest = mergeWithLiveSnapshot(normalizedLatest);
      if (mergedLatest) {
        lastDataRef.current = mergedLatest;
        setData(mergedLatest);
      }

      setHistory(Array.isArray(historyData) ? historyData.map(normalizeSensorDataRow).filter(Boolean) as SensorData[] : []);
      setError(null);
    } catch (err) {
      const fallback = mergeWithLiveSnapshot(lastDataRef.current);
      if (fallback) {
        lastDataRef.current = fallback;
        setData(fallback);
      }
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [mergeWithLiveSnapshot]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, pollInterval);
    return () => clearInterval(interval);
  }, [fetchData, pollInterval]);

  useEffect(() => {
    const unsubscribe = subscribeMqttStatus(() => {
      const live = getSensorSnapshot();
      if (!live) return;
      setData((prev) => {
        const merged = mergeSensorData(prev ?? lastDataRef.current, live);
        if (merged) lastDataRef.current = merged;
        return merged;
      });

      // Update history in real-time
      setHistory((prev) => {
        if (prev.length > 0 && prev[0].created_at === live.updatedAt) return prev;
        const newRow = mergeSensorData(null, live);
        if (!newRow) return prev;
        return [newRow, ...prev].slice(0, 60);
      });
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { data, history, loading, error, refetch: fetchData };
}
