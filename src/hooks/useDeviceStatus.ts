import { useState, useEffect, useCallback } from 'react';

export interface DeviceStatus {
  online: boolean;
  wifi_status: string;
  last_update: string;
  device_id: string;
  pump_status: boolean;
  feeder_status: boolean;
  led_status?: boolean;
}

export function useDeviceStatus(pollInterval = 5000) {
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/device-status');
      if (!res.ok) throw new Error('Failed to fetch device status');
      const data = await res.json();
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, pollInterval);
    return () => clearInterval(interval);
  }, [fetchStatus, pollInterval]);

  return { status, loading, error, refetch: fetchStatus };
}
