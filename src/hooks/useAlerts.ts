import { useState, useEffect, useCallback } from 'react';

export interface Alert {
  id: number;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'danger';
  read: boolean;
  created_at: string;
}

export interface CreateAlertOptions {
  sendEmail?: boolean;
  recipientEmail?: string;
  metadata?: Record<string, unknown> | null;
}

const STORAGE_KEY = 'nexagrow_alerts';

function getLocalAlerts(): Alert[] {
  try {
    if (typeof window === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalAlerts(alerts: Alert[]) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
    }
  } catch {}
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = getLocalAlerts();
      data.sort((a, b) => b.id - a.id); // Descending
      setAlerts(data);
      setUnreadCount(data.filter((a) => !a.read).length);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id?: number) => {
    const data = getLocalAlerts();
    let changed = false;
    for (const alert of data) {
      if (!alert.read && (id === undefined || alert.id === id)) {
        alert.read = true;
        changed = true;
      }
    }
    if (changed) {
      saveLocalAlerts(data);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('nexagrow:alerts_updated'));
      }
      await fetchAlerts();
    }
  }, [fetchAlerts]);

  const createAlert = useCallback(async (
    type: string,
    message: string,
    severity: Alert['severity'] = 'info',
    options: CreateAlertOptions = {},
  ) => {
    const data = getLocalAlerts();
    const newId = data.length > 0 ? Math.max(...data.map(a => a.id)) + 1 : 1;
    const newAlert: Alert = {
      id: newId,
      type,
      message,
      severity,
      read: false,
      created_at: new Date().toISOString()
    };
    
    data.push(newAlert);
    if (data.length > 100) {
      data.shift();
    }
    
    saveLocalAlerts(data);
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('nexagrow:alerts_updated'));
    }
    
    await fetchAlerts();
  }, [fetchAlerts]);

  useEffect(() => {
    fetchAlerts();
    
    const handleUpdate = () => fetchAlerts();
    if (typeof window !== 'undefined') {
      window.addEventListener('nexagrow:alerts_updated', handleUpdate);
      return () => window.removeEventListener('nexagrow:alerts_updated', handleUpdate);
    }
  }, [fetchAlerts]);

  return { alerts, unreadCount, loading, fetchAlerts, markAsRead, createAlert };
}
