
export type ActivitySource = 'ui' | 'sensor' | 'chat' | 'control' | 'weather' | 'settings' | 'navigation' | 'system';

export interface ActivityLogEntry {
  id: string;
  source: ActivitySource;
  type: string;
  title: string;
  message: string;
  created_at: string;
  details?: Record<string, unknown> | null;
}

const STORAGE_KEY = 'nexagrow-activity-log-v1';
const MAX_ITEMS = 5000;

function isBrowser() {
  return typeof window !== 'undefined';
}

function readJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed;
  } catch {
    return fallback;
  }
}

export function getJakartaDateKey(date: Date | string | number = new Date()) {
  const input = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(input.getTime())) return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(input);
}

export function formatActivityTime(date: Date | string | number) {
  const input = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(input.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(input);
}

export function readActivityLogs(): ActivityLogEntry[] {
  if (!isBrowser()) return [];
  return readJson<ActivityLogEntry[]>(window.localStorage.getItem(STORAGE_KEY), []).filter(Boolean);
}

export function writeActivityLogs(entries: ActivityLogEntry[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ITEMS)));
}

export function recordActivity(input: Omit<ActivityLogEntry, 'id' | 'created_at'> & Partial<Pick<ActivityLogEntry, 'id' | 'created_at'>>) {
  if (!isBrowser()) return null;

  const entry: ActivityLogEntry = {
    id: input.id || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    source: input.source,
    type: input.type,
    title: input.title,
    message: input.message,
    details: input.details ?? null,
    created_at: input.created_at || new Date().toISOString(),
  };

  const next = [entry, ...readActivityLogs()].slice(0, MAX_ITEMS);
  writeActivityLogs(next);
  return entry;
}

export function clearActivityLogs() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function mapActivityDayKey(entry: { created_at: string }) {
  return getJakartaDateKey(entry.created_at);
}

export function groupActivitiesByDay(entries: ActivityLogEntry[]) {
  return entries.reduce<Record<string, ActivityLogEntry[]>>((acc, entry) => {
    const key = mapActivityDayKey(entry);
    acc[key] = acc[key] || [];
    acc[key].push(entry);
    return acc;
  }, {});
}

export function dedupeActivityLogs(entries: ActivityLogEntry[]) {
  const seen = new Set<string>();
  return entries.filter((entry) => {
    const key = `${entry.source}|${entry.type}|${entry.title}|${entry.message}|${entry.created_at}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sortActivityLogs(entries: ActivityLogEntry[]) {
  return [...entries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function toCsv(entries: ActivityLogEntry[]) {
  const headers = ['created_at', 'source', 'type', 'title', 'message', 'details'];
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return '';
    const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const rows = entries.map((entry) =>
    [
      entry.created_at,
      entry.source,
      entry.type,
      entry.title,
      entry.message,
      entry.details ? JSON.stringify(entry.details) : '',
    ].map(escape).join(','),
  );

  return [headers.join(','), ...rows].join('\n');
}
