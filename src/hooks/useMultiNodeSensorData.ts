import { useCallback, useState, useEffect } from 'react';
import { subscribeMqttStatus, getMqttStatusSnapshot, type MqttSensorSnapshot } from '../services/mqtt';

export interface NodeSensorData {
  node_id: number;
  temperature: number | null;
  humidity: number | null;
  soil_moisture: number | null;
  created_at: string;
}

const REFRESH_INTERVAL_MS = 10000;

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeNodeData(row: Record<string, unknown>): NodeSensorData | null {
  const nodeId = toNumber(row.node_id ?? String(row.device_id ?? '').replace('node_', ''));
  if (nodeId !== 1 && nodeId !== 2) return null;

  return {
    node_id: nodeId,
    temperature: toNumber(row.temperature),
    humidity: toNumber(row.humidity),
    soil_moisture: toNumber(row.soil_moisture),
    created_at: typeof row.created_at === 'string' ? row.created_at : new Date().toISOString(),
  };
}

function normalizeMqttSensor(snap: MqttSensorSnapshot): NodeSensorData | null {
  if (snap.node_id !== 1 && snap.node_id !== 2) return null;

  return {
    node_id: snap.node_id,
    temperature: snap.temperature,
    humidity: snap.humidity,
    soil_moisture: snap.soil_moisture,
    created_at: snap.updatedAt || new Date().toISOString(),
  };
}

export function useMultiNodeSensorData() {
  const [node1, setNode1] = useState<NodeSensorData | null>(null);
  const [node2, setNode2] = useState<NodeSensorData | null>(null);
  const [loading, setLoading] = useState(true);

  const applyNodeData = useCallback((next: NodeSensorData) => {
    if (next.node_id === 1) {
      setNode1((prev) => ({ ...prev, ...next }));
    } else if (next.node_id === 2) {
      setNode2((prev) => ({ ...prev, ...next }));
    }
  }, []);

  // 1. Initial fetch + polling fallback from Vercel/Supabase
  useEffect(() => {
    let cancelled = false;

    const fetchLatest = async () => {
      try {
        const res = await fetch('/api/sensor?latest=nodes', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            for (const row of data) {
              if (cancelled || !row || typeof row !== 'object') continue;
              const normalized = normalizeNodeData(row as Record<string, unknown>);
              if (normalized) applyNodeData(normalized);
            }
          }
        }
      } catch (e) {
        console.warn('Failed to fetch node data:', e instanceof Error ? e.message : e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLatest();
    const intervalId = window.setInterval(fetchLatest, REFRESH_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyNodeData]);

  // 2. Real-time updates from MQTT
  useEffect(() => {
    const unsubscribe = subscribeMqttStatus(() => {
      const status = getMqttStatusSnapshot();
      const snap = status.sensorSnapshot;
      const normalized = snap ? normalizeMqttSensor(snap) : null;
      if (normalized) applyNodeData(normalized);
    });

    return () => { unsubscribe(); };
  }, [applyNodeData]);

  return { node1, node2, loading };
}
