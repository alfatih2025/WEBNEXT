import { buildApiHeaders } from '../lib/apiAuth';

const OPENROUTER_ENDPOINT = '/api/openrouter';
const SENSOR_ENDPOINT = '/api/sensor?latest=true';

export type OpenRouterConnectionState =
  | 'checking'
  | 'connected'
  | 'missing_key'
  | 'error';

export interface OpenRouterStatus {
  state: OpenRouterConnectionState;
  label: string;
  detail: string;
  checkedAt?: string;
}

export interface OpenRouterChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface SensorSnapshotContext {
  node_id?: number | null;
  device_id?: string;
  temperature?: number | null;
  humidity?: number | null;
  soil_moisture?: number | null;
  created_at?: string | null;
  updatedAt?: string | null;
  sourceTopic?: string | null;
  plant_phase?: 'vegetatif' | 'generatif' | null;
  soil_threshold_low?: number | null;
  soil_threshold_high?: number | null;
  soil_threshold_critical?: number | null;
  humidity_threshold_low?: number | null;
  humidity_threshold_high?: number | null;
  temp_threshold_low?: number | null;
  temp_threshold_high?: number | null;
  weather_location?: string | null;
  weather_condition?: string | null;
  weather_temperature?: number | null;
  weather_rain_chance?: number | null;
  weather_forecast_location?: string | null;
  weather_forecast?: string | null;
}

interface SensorSnapshotApi {
  node_id?: number | string | null;
  device_id?: string;
  temperature?: number | string | null;
  humidity?: number | string | null;
  soil_moisture?: number | string | null;
  created_at?: string | null;
  updatedAt?: string | null;
  sourceTopic?: string | null;
  plant_phase?: 'vegetatif' | 'generatif' | string | null;
  soil_threshold_low?: number | string | null;
  soil_threshold_high?: number | string | null;
  soil_threshold_critical?: number | string | null;
  humidity_threshold_low?: number | string | null;
  humidity_threshold_high?: number | string | null;
  temp_threshold_low?: number | string | null;
  temp_threshold_high?: number | string | null;
  weather_location?: string | null;
  weather_condition?: string | null;
  weather_temperature?: number | string | null;
  weather_rain_chance?: number | string | null;
  weather_forecast_location?: string | null;
  weather_forecast?: string | null;
}

interface SensorSnapshotResponse {
  node_id?: number | null;
  device_id?: string;
  temperature?: number;
  humidity?: number;
  soil_moisture?: number;
  created_at?: string | null;
  updatedAt?: string | null;
  sourceTopic?: string | null;
  plant_phase?: 'vegetatif' | 'generatif' | null;
  soil_threshold_low?: number | null;
  soil_threshold_high?: number | null;
  soil_threshold_critical?: number | null;
  humidity_threshold_low?: number | null;
  humidity_threshold_high?: number | null;
  temp_threshold_low?: number | null;
  temp_threshold_high?: number | null;
  weather_location?: string | null;
  weather_condition?: string | null;
  weather_temperature?: number | null;
  weather_rain_chance?: number | null;
  weather_forecast_location?: string | null;
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no', 'n'].includes(normalized)) return false;
  }
  return undefined;
}

function safePhase(value: unknown): 'vegetatif' | 'generatif' | null | undefined {
  if (typeof value !== 'string') return undefined;
  return value.trim().toLowerCase() === 'generatif' ? 'generatif' : 'vegetatif';
}

function normalizeSensorContext(input: unknown): Partial<SensorSnapshotContext> | null {
  if (!input || typeof input !== 'object') return null;

  const sensor = input as SensorSnapshotApi;

  return {
    node_id: safeNumber(sensor.node_id),
    device_id: typeof sensor.device_id === 'string' && sensor.device_id.trim() ? sensor.device_id.trim() : undefined,
    temperature: safeNumber(sensor.temperature),
    humidity: safeNumber(sensor.humidity),
    soil_moisture: safeNumber(sensor.soil_moisture),
    created_at: typeof sensor.created_at === 'string' ? sensor.created_at : null,
    updatedAt: typeof sensor.updatedAt === 'string' ? sensor.updatedAt : null,
    sourceTopic: typeof sensor.sourceTopic === 'string' ? sensor.sourceTopic : null,
    plant_phase: sensor.plant_phase === 'generatif' || sensor.plant_phase === 'vegetatif' ? sensor.plant_phase : null,
    soil_threshold_low: typeof sensor.soil_threshold_low === 'number' ? sensor.soil_threshold_low : null,
    soil_threshold_high: typeof sensor.soil_threshold_high === 'number' ? sensor.soil_threshold_high : null,
    soil_threshold_critical: typeof sensor.soil_threshold_critical === 'number' ? sensor.soil_threshold_critical : null,
    humidity_threshold_low: typeof sensor.humidity_threshold_low === 'number' ? sensor.humidity_threshold_low : null,
    humidity_threshold_high: typeof sensor.humidity_threshold_high === 'number' ? sensor.humidity_threshold_high : null,
    temp_threshold_low: typeof sensor.temp_threshold_low === 'number' ? sensor.temp_threshold_low : null,
    temp_threshold_high: typeof sensor.temp_threshold_high === 'number' ? sensor.temp_threshold_high : null,
    weather_location: typeof sensor.weather_location === 'string' ? sensor.weather_location : null,
    weather_condition: typeof sensor.weather_condition === 'string' ? sensor.weather_condition : null,
    weather_temperature: typeof sensor.weather_temperature === 'number' ? sensor.weather_temperature : null,
    weather_rain_chance: typeof sensor.weather_rain_chance === 'number' ? sensor.weather_rain_chance : null,
    weather_forecast_location: typeof sensor.weather_forecast_location === 'string' ? sensor.weather_forecast_location : null,
    weather_forecast: typeof sensor.weather_forecast === 'string' ? sensor.weather_forecast : null,
  };
}

async function fetchLatestSensorSnapshot(): Promise<Partial<SensorSnapshotContext> | null> {
  try {
    const response = await fetch(SENSOR_ENDPOINT, { headers: buildApiHeaders() });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || typeof payload !== 'object') return null;
    return normalizeSensorContext(payload);
  } catch {
    return null;
  }
}

function normalizeStatusPayload(payload: unknown): OpenRouterStatus | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Partial<OpenRouterStatus>;
  if (!obj.state || !obj.label || !obj.detail) return null;

  return {
    state: obj.state,
    label: obj.label,
    detail: obj.detail,
    checkedAt: obj.checkedAt,
  };
}

export async function checkOpenRouterConnection(): Promise<OpenRouterStatus> {
  try {
    const response = await fetch(`${OPENROUTER_ENDPOINT}`, { headers: buildApiHeaders() });
    const payload = await response.json().catch(() => null);
    const normalized = normalizeStatusPayload(payload);
    if (!response.ok || !normalized) {
      throw new Error(normalized?.detail || `OpenRouter status gagal (${response.status})`);
    }
    return normalized;
  } catch (error) {
    return {
      state: 'error',
      label: 'OpenRouter tidak tersambung',
      detail: error instanceof Error ? error.message : 'Unknown connection error',
      checkedAt: new Date().toISOString(),
    };
  }
}

export async function sendMessageToOpenRouter(
  userMessage: string,
  history: OpenRouterChatMessage[],
  sensorContext?: Partial<SensorSnapshotContext> | null,
): Promise<string> {
  const latestSensorSnapshot = await fetchLatestSensorSnapshot();
  const mergedSensorContext = normalizeSensorContext({
    ...latestSensorSnapshot,
    ...(sensorContext || {}),
  });

  const recentHistory = history.slice(-8);
  const lastHistoryItem = recentHistory[recentHistory.length - 1];
  const shouldAppendCurrentMessage =
    !(lastHistoryItem && lastHistoryItem.role === 'user' && lastHistoryItem.content.trim() === userMessage.trim());

  const response = await fetch(OPENROUTER_ENDPOINT, {
    method: 'POST',
    headers: buildApiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      message: userMessage,
      history: shouldAppendCurrentMessage ? recentHistory : recentHistory.slice(0, -1),
      sensorContext: mergedSensorContext,
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      payload?.error ||
        payload?.detail ||
        `OpenRouter request gagal dengan status ${response.status}`,
    );
  }

  const content = payload?.content ?? payload?.message?.content ?? payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('OpenRouter tidak mengembalikan jawaban yang valid.');
  }

  return content.trim();
}
