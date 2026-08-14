import supabase from '../src/lib/apiHelpers/_supabase.js';
import { requireApiAuth } from '../src/lib/apiHelpers/_auth.js';

const DEFAULT_LOCATION_CODE = '33.74.07.1010';

const DEFAULT_SETTINGS = {
  id: 1,
  plant_phase: 'vegetatif',
  location: DEFAULT_LOCATION_CODE,
  temp_threshold_high: 34,
  temp_threshold_low: 22,
  soil_threshold_low: 45,
  soil_threshold_high: 75,
  soil_threshold_critical: 35,
  humidity_threshold_low: 60,
  humidity_threshold_high: 85,
  ph_min: 5.5,
  ph_max: 8.0,
  auto_report: true,
  report_time: '08:00',
  watering_time: '06:00',
  watering_duration: 10,
  watering_enabled: true,
  user_name: 'Petani Cerdas',
  user_email: 'petani@sprout.id',
};

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeRange(low, high, min, max, fallbackLow, fallbackHigh) {
  let safeLow = clampNumber(low, min, max, fallbackLow);
  let safeHigh = clampNumber(high, min, max, fallbackHigh);

  if (safeHigh <= safeLow) {
    safeHigh = Math.min(max, safeLow + 1);
  }
  if (safeLow >= safeHigh) {
    safeLow = Math.max(min, safeHigh - 1);
  }
  if (safeLow >= safeHigh) {
    safeLow = fallbackLow;
    safeHigh = Math.max(fallbackHigh, safeLow + 1);
  }

  return [safeLow, safeHigh];
}

function normalizePhase(value) {
  return String(value || '').trim().toLowerCase() === 'generatif' ? 'generatif' : 'vegetatif';
}

function normalizeLocation(value) {
  const raw = String(value || '').trim();
  return /^\d{2}(?:\.\d{2}){1,2}(?:\.\d{1,4})?$/.test(raw) ? raw : DEFAULT_LOCATION_CODE;
}

function phaseDefaults(phase) {
  return phase === 'generatif'
    ? { temp_threshold_low: 24, temp_threshold_high: 32, soil_threshold_low: 50, soil_threshold_high: 70, soil_threshold_critical: 40 }
    : { temp_threshold_low: 22, temp_threshold_high: 34, soil_threshold_low: 45, soil_threshold_high: 75, soil_threshold_critical: 35 };
}

function normalizeSettings(input = {}) {
  const obj = { ...DEFAULT_SETTINGS };
  for (const [key, value] of Object.entries(input || {})) {
    if (value !== null && value !== undefined) {
      obj[key] = value;
    }
  }

  const phase = normalizePhase(obj.plant_phase || obj.crop_mode);
  const defaults = phaseDefaults(phase);
  const soilLow = clampNumber(obj.soil_threshold_low ?? obj.soil_moisture_threshold ?? defaults.soil_threshold_low, 0, 100, defaults.soil_threshold_low);
  const soilHigh = clampNumber(obj.soil_threshold_high ?? defaults.soil_threshold_high, 0, 100, defaults.soil_threshold_high);
  const soilCritical = clampNumber(obj.soil_threshold_critical ?? defaults.soil_threshold_critical, 0, 100, defaults.soil_threshold_critical);
  const humidityLow = clampNumber(obj.humidity_threshold_low ?? obj.air_humidity_low ?? defaults.humidity_threshold_low, 0, 100, defaults.humidity_threshold_low);
  const humidityHigh = clampNumber(obj.humidity_threshold_high ?? obj.air_humidity_high ?? defaults.humidity_threshold_high, 0, 100, defaults.humidity_threshold_high);

  const [safeSoilLow, safeSoilHigh] = normalizeRange(soilLow, soilHigh, 0, 100, defaults.soil_threshold_low, defaults.soil_threshold_high);
  const [safeHumidityLow, safeHumidityHigh] = normalizeRange(humidityLow, humidityHigh, 0, 100, defaults.humidity_threshold_low, defaults.humidity_threshold_high);

  return {
    ...obj,
    id: 1,
    plant_phase: phase,
    crop_mode: phase,
    location: normalizeLocation(obj.location),
    temp_threshold_high: clampNumber(obj.temp_threshold_high ?? defaults.temp_threshold_high, -20, 60, defaults.temp_threshold_high),
    temp_threshold_low: clampNumber(obj.temp_threshold_low ?? defaults.temp_threshold_low, -20, 60, defaults.temp_threshold_low),
    soil_threshold_low: safeSoilLow,
    soil_threshold_high: safeSoilHigh,
    soil_threshold_critical: Math.min(Math.max(0, soilCritical), safeSoilLow),
    humidity_threshold_low: safeHumidityLow,
    humidity_threshold_high: safeHumidityHigh,
    ph_min: clampNumber(obj.ph_min, 0, 14, DEFAULT_SETTINGS.ph_min),
    ph_max: clampNumber(obj.ph_max, 0, 14, DEFAULT_SETTINGS.ph_max),
    auto_report: Boolean(obj.auto_report),
    report_time: typeof obj.report_time === 'string' && /^\d{2}:\d{2}$/.test(obj.report_time) ? obj.report_time : DEFAULT_SETTINGS.report_time,
    watering_time: typeof obj.watering_time === 'string' && /^\d{2}:\d{2}$/.test(obj.watering_time) ? obj.watering_time : DEFAULT_SETTINGS.watering_time,
    watering_duration: clampNumber(obj.watering_duration, 1, 3600, DEFAULT_SETTINGS.watering_duration),
    watering_enabled: Boolean(obj.watering_enabled),
    user_name: String(obj.user_name || DEFAULT_SETTINGS.user_name).trim() || DEFAULT_SETTINGS.user_name,
    user_email: String(obj.user_email || DEFAULT_SETTINGS.user_email).trim() || DEFAULT_SETTINGS.user_email,
    updated_at: new Date().toISOString(),
    soil_moisture_threshold: soilLow,
  };
}

const SETTINGS_DB_COLUMNS = new Set([
  'id',
  'plant_phase',
  'crop_mode',
  'location',
  'temp_threshold_high',
  'temp_threshold_low',
  'soil_threshold_low',
  'soil_threshold_high',
  'soil_threshold_critical',
  'humidity_threshold_low',
  'humidity_threshold_high',
  'ph_min',
  'ph_max',
  'auto_report',
  'report_time',
  'watering_time',
  'watering_duration',
  'watering_enabled',
  'user_name',
  'user_email',
  'updated_at',
  'soil_moisture_threshold',
]);

function filterSettingsForDatabase(input = {}) {
  return Object.fromEntries(
    Object.entries(input).filter(([key]) => SETTINGS_DB_COLUMNS.has(key)),
  );
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      if (!supabase) return res.status(503).json({ error: 'Database not configured' });

      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found, safe to return default
          return res.status(200).json(normalizeSettings(DEFAULT_SETTINGS));
        }
        // Any other error (connection, etc) should fail so frontend uses localStorage
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json(normalizeSettings(data || DEFAULT_SETTINGS));
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      if (!requireApiAuth(req, res)) return;

      const updates = req.body || {};
      const payload = normalizeSettings(updates);
      const dbPayload = filterSettingsForDatabase(payload);

      if (!supabase) {
        console.warn('[api/settings] Supabase not configured; returning normalized payload locally');
        return res.status(200).json(payload);
      }

      const { data, error } = await supabase
        .from('settings')
        .upsert(dbPayload)
        .select()
        .single();

      if (error) throw error;

      await supabase.from('activity_logs').insert({
        type: 'settings',
        message: 'Settings updated',
        details: updates,
      }).catch(() => {});

      return res.status(200).json(normalizeSettings(data || payload));
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Settings API error:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
}
