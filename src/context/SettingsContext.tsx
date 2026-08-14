import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { buildApiHeaders } from '../lib/apiAuth';
import { getPhaseDefaults, normalizePlantPhase, type PlantPhase } from '../lib/plantPhase';
import { DEFAULT_WEATHER_LOCATION_CODE, normalizeWeatherLocationCode } from '../lib/weatherLocations';

export interface Settings {
  id: number;
  plant_phase: PlantPhase;
  location: string;
  temp_threshold_high: number;
  temp_threshold_low: number;
  soil_threshold_low: number;
  soil_threshold_high: number;
  soil_threshold_critical: number;
  humidity_threshold_low: number;
  humidity_threshold_high: number;
  ph_min: number;
  ph_max: number;
  auto_report: boolean;
  report_time: string;
  watering_time: string;
  watering_duration: number;
  watering_enabled: boolean;
  user_name: string;
  user_email: string;
  crop_mode?: PlantPhase;
  soil_moisture_threshold?: number;
}

const STORAGE_KEY = 'nexagrow-settings-cache-v2';

const DEFAULT_PHASE = 'vegetatif' as const;
const phaseDefaults = getPhaseDefaults(DEFAULT_PHASE);

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  plant_phase: DEFAULT_PHASE,
  location: DEFAULT_WEATHER_LOCATION_CODE,
  temp_threshold_high: phaseDefaults.temp_threshold_high,
  temp_threshold_low: phaseDefaults.temp_threshold_low,
  soil_threshold_low: phaseDefaults.soil_threshold_low,
  soil_threshold_high: phaseDefaults.soil_threshold_high,
  soil_threshold_critical: phaseDefaults.soil_threshold_critical,
  humidity_threshold_low: phaseDefaults.humidityRange[0],
  humidity_threshold_high: phaseDefaults.humidityRange[1],
  ph_min: 5.5,
  ph_max: 8.0,
  auto_report: true,
  report_time: '08:00',
  watering_time: '06:00',
  watering_duration: 10,
  watering_enabled: true,
  user_name: 'Petani Cerdas',
  user_email: 'petani@sprout.id',
  crop_mode: DEFAULT_PHASE,
  soil_moisture_threshold: phaseDefaults.soil_threshold_low,
};

function toFiniteNumber(value: unknown, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeSettings(input: Partial<Settings> | null | undefined): Settings {
  const value = { ...DEFAULT_SETTINGS };
  for (const [key, item] of Object.entries(input || {})) {
    if (item !== null && item !== undefined) {
      (value as Record<string, unknown>)[key] = item;
    }
  }
  const phase = normalizePlantPhase((value.plant_phase ?? value.crop_mode) as unknown);
  const defaults = getPhaseDefaults(phase);

  const rawLow = toFiniteNumber(value.soil_threshold_low ?? value.soil_moisture_threshold, defaults.soil_threshold_low);
  const rawHigh = toFiniteNumber(value.soil_threshold_high, defaults.soil_threshold_high);
  const rawCritical = toFiniteNumber(value.soil_threshold_critical, defaults.soil_threshold_critical);
  const rawHumidityLow = toFiniteNumber((value as Record<string, unknown>).humidity_threshold_low ?? (value as Record<string, unknown>).air_humidity_low, defaults.humidityRange[0]);
  const rawHumidityHigh = toFiniteNumber((value as Record<string, unknown>).humidity_threshold_high ?? (value as Record<string, unknown>).air_humidity_high, defaults.humidityRange[1]);

  const [soilLow, soilHigh] = [rawLow, rawHigh].sort((a, b) => a - b);
  const critical = Math.min(Math.max(0, rawCritical), soilLow);

  return {
    ...value,
    id: 1,
    plant_phase: phase,
    crop_mode: phase,
    location: normalizeWeatherLocationCode(value.location),
    temp_threshold_high: toFiniteNumber(value.temp_threshold_high, defaults.temp_threshold_high),
    temp_threshold_low: toFiniteNumber(value.temp_threshold_low, defaults.temp_threshold_low),
    soil_threshold_low: soilLow,
    soil_threshold_high: soilHigh,
    soil_threshold_critical: critical,
    humidity_threshold_low: rawHumidityLow,
    humidity_threshold_high: rawHumidityHigh,
    ph_min: toFiniteNumber(value.ph_min, DEFAULT_SETTINGS.ph_min),
    ph_max: toFiniteNumber(value.ph_max, DEFAULT_SETTINGS.ph_max),
    auto_report: toBoolean(value.auto_report, DEFAULT_SETTINGS.auto_report),
    report_time: typeof value.report_time === 'string' && /^\d{2}:\d{2}$/.test(value.report_time) ? value.report_time : DEFAULT_SETTINGS.report_time,
    watering_time: typeof value.watering_time === 'string' && /^\d{2}:\d{2}$/.test(value.watering_time) ? value.watering_time : DEFAULT_SETTINGS.watering_time,
    watering_duration: toFiniteNumber(value.watering_duration, DEFAULT_SETTINGS.watering_duration),
    watering_enabled: toBoolean(value.watering_enabled, DEFAULT_SETTINGS.watering_enabled),
    user_name: String(value.user_name || DEFAULT_SETTINGS.user_name).trim() || DEFAULT_SETTINGS.user_name,
    user_email: String(value.user_email || DEFAULT_SETTINGS.user_email).trim() || DEFAULT_SETTINGS.user_email,
    soil_moisture_threshold: soilLow,
  };
}

function readStoredSettings(): Settings | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return normalizeSettings(parsed);
  } catch {
    return null;
  }
}

function persistSettings(settings: Settings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    window.dispatchEvent(new CustomEvent('nexagrow:settings-updated', { detail: settings }));
  } catch {
    // ignore
  }
}

interface SettingsContextType {
  settings: Settings | null;
  loading: boolean;
  updateSettings: (updates: Partial<Settings>) => Promise<Settings>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings | null>(() => readStoredSettings());
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings', { headers: buildApiHeaders() });
      if (!res.ok) throw new Error('Failed to fetch settings');
      const data = await res.json();
      const normalized = normalizeSettings(data);
      setSettings(normalized);
      persistSettings(normalized);
    } catch (err) {
      const fallback = readStoredSettings() ?? DEFAULT_SETTINGS;
      setSettings(fallback);
      persistSettings(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  const updateSettings = useCallback(
    async (updates: Partial<Settings>) => {
      const previous = settings ? normalizeSettings(settings) : DEFAULT_SETTINGS;
      const payload = normalizeSettings({ ...previous, ...updates });

      // Optimistic update
      setSettings(payload);
      persistSettings(payload);

      try {
        const res = await fetch('/api/settings', {
          method: 'PUT',
          headers: buildApiHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(payload),
        });

        if (!res.ok) throw new Error('Failed to update settings');
        const data = await res.json();
        const normalized = normalizeSettings(data);
        setSettings(normalized);
        persistSettings(normalized);
        return normalized;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        // Keep local update if API fails
        throw new Error(message);
      }
    },
    [settings],
  );

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue) as Partial<Settings>;
        setSettings(normalizeSettings(parsed));
      } catch {
        // ignore
      }
    };

    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<Partial<Settings>>).detail;
      if (!detail || typeof detail !== 'object') return;
      setSettings(normalizeSettings(detail));
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('nexagrow:settings-updated', handleSettingsUpdated);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('nexagrow:settings-updated', handleSettingsUpdated);
    };
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    // Fallback for when used outside provider (development/testing)
    const [settings, setSettings] = useState<Settings | null>(() => readStoredSettings());
    return { settings, loading: false, updateSettings: async () => settings || DEFAULT_SETTINGS };
  }
  return context;
}
