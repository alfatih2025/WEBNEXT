import fs from 'node:fs';
import path from 'node:path';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models';

let cachedLocalEnv = null;

function readLocalEnv() {
  if (cachedLocalEnv) return cachedLocalEnv;
  const envMap = {};

  try {
    const envPath = path.join(process.cwd(), '.env');
    const raw = fs.readFileSync(envPath, 'utf8');

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const separatorIndex = trimmed.indexOf('=');
      if (separatorIndex === -1) continue;

      const key = trimmed.slice(0, separatorIndex).trim();
      let value = trimmed.slice(separatorIndex + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      envMap[key] = value;
    }
  } catch {
    // ignore missing local env
  }

  cachedLocalEnv = envMap;
  return envMap;
}

function getOpenRouterKey() {
  const localEnv = readLocalEnv();
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.VITE_OPENROUTER_API_KEY ||
    localEnv.OPENROUTER_API_KEY ||
    localEnv.VITE_OPENROUTER_API_KEY ||
    ''
  ).trim();
}

function getOpenRouterModel() {
  const localEnv = readLocalEnv();
  return (
    process.env.OPENROUTER_MODEL ||
    process.env.VITE_OPENROUTER_MODEL ||
    localEnv.OPENROUTER_MODEL ||
    localEnv.VITE_OPENROUTER_MODEL ||
    'openai/gpt-4o-mini'
  ).trim();
}

function getHeaders(origin) {
  return {
    Authorization: `Bearer ${getOpenRouterKey()}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': origin || 'http://localhost:5173',
    'X-Title': 'NexaGrow NexaBot',
  };
}

function safeNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function safeBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'on', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'off', 'no', 'n'].includes(normalized)) return false;
  }
  return undefined;
}

function safePhase(value) {
  if (typeof value !== 'string') return 'vegetatif';
  return value.trim().toLowerCase() === 'generatif' ? 'generatif' : 'vegetatif';
}

function normalizeSensorContext(sensor) {
  if (!sensor || typeof sensor !== 'object') return null;

  return {
    device_id: typeof sensor.device_id === 'string' && sensor.device_id.trim() ? sensor.device_id.trim() : null,
    temperature: safeNumber(sensor.temperature),
    humidity: safeNumber(sensor.humidity),
    soil_moisture: safeNumber(sensor.soil_moisture),
    rain: safeNumber(sensor.rain),
    score: safeNumber(sensor.score),
    soil_score: safeNumber(sensor.soil_score),
    vdp_score: safeNumber(sensor.vdp_score),
    rain_score: safeNumber(sensor.rain_score),
    vpd: safeNumber(sensor.vpd),
    duration_estimate: safeNumber(sensor.duration_estimate),
    pump_status: safeBoolean(sensor.pump_status) ?? false,
    led_status: safeBoolean(sensor.led_status) ?? false,
    device_mode: typeof sensor.device_mode === 'string' && ['manual', 'auto'].includes(sensor.device_mode) ? sensor.device_mode : null,
    wifi_status: typeof sensor.wifi_status === 'string' && sensor.wifi_status.trim() ? sensor.wifi_status.trim() : null,
    threshold_kritis: safeNumber(sensor.threshold_kritis),
    threshold_atas: safeNumber(sensor.threshold_atas),
    threshold_bawah: safeNumber(sensor.threshold_bawah),
    watering_time: typeof sensor.watering_time === 'string' && sensor.watering_time.trim() ? sensor.watering_time.trim() : null,
    watering_duration: safeNumber(sensor.watering_duration),
    schedule_enabled: safeBoolean(sensor.schedule_enabled),
    created_at: typeof sensor.created_at === 'string' ? sensor.created_at : null,
    updatedAt: typeof sensor.updatedAt === 'string' ? sensor.updatedAt : null,
    sourceTopic: typeof sensor.sourceTopic === 'string' ? sensor.sourceTopic : null,
    plant_phase: safePhase(sensor.plant_phase || sensor.crop_mode),
    soil_threshold_low: safeNumber(sensor.soil_threshold_low ?? sensor.soil_moisture_threshold),
    soil_threshold_high: safeNumber(sensor.soil_threshold_high),
    soil_threshold_critical: safeNumber(sensor.soil_threshold_critical),
    temp_threshold_low: safeNumber(sensor.temp_threshold_low),
    temp_threshold_high: safeNumber(sensor.temp_threshold_high),
    formula_name: typeof sensor.formula_name === 'string' && sensor.formula_name.trim() ? sensor.formula_name.trim() : null,
    formula_soil: typeof sensor.formula_soil === 'string' && sensor.formula_soil.trim() ? sensor.formula_soil.trim() : null,
    formula_vpd: typeof sensor.formula_vpd === 'string' && sensor.formula_vpd.trim() ? sensor.formula_vpd.trim() : null,
    formula_score: typeof sensor.formula_score === 'string' && sensor.formula_score.trim() ? sensor.formula_score.trim() : null,
    soil_raw_dry: safeNumber(sensor.soil_raw_dry),
    weather_location: typeof sensor.weather_location === 'string' && sensor.weather_location.trim() ? sensor.weather_location.trim() : null,
    weather_condition: typeof sensor.weather_condition === 'string' && sensor.weather_condition.trim() ? sensor.weather_condition.trim() : null,
    weather_temperature: safeNumber(sensor.weather_temperature),
    weather_rain_chance: safeNumber(sensor.weather_rain_chance),
    weather_forecast_location: typeof sensor.weather_forecast_location === 'string' && sensor.weather_forecast_location.trim() ? sensor.weather_forecast_location.trim() : null,
    weather_forecast: typeof sensor.weather_forecast === 'string' && sensor.weather_forecast.trim() ? sensor.weather_forecast.trim() : null,
  };
}

function formatLine(label, value, suffix = '') {
  if (value === null || value === undefined || value === '') return `- ${label}: -`;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `- ${label}: ${Number(value).toFixed(1)}${suffix}`;
  }
  return `- ${label}: ${value}${suffix}`;
}

export function buildFormulaReference() {
  return [
    'RUMUS ARDUINO YANG WAJIB DIPAKAI SAAT MENJELASKAN PERHITUNGAN:',
    'void hitungSkor() {',
    '  if (isnan(suhu) || isnan(kelembapan) || isnan(tanah) || suhu == 0.0 || kelembapan == 0.0) return;',
    '',
    '  float svp = 0.6108 * exp((17.27 * suhu) / (suhu + 237.3));',
    '  vdp = svp * (1.0 - (kelembapan / 100.0));',
    '  vdp = constrain(vdp, 0.4, 2.0);',
    '',
    '  if (Atas - Kritis == 0) Kritis = Atas - 1;',
    '',
    '  skorTanah = ((Atas - tanah) * 50.0) / (Atas - Kritis);',
    '  skorTanah = constrain(skorTanah, 0, 50);',
    '',
    '  skorvdp = ((vdp - 0.4) * 30.0) / (2.0 - 0.4);',
    '',
    '  skorHujan = (peluangHujan / 100.0) * 40.0;',
    '  skorHujan = constrain(skorHujan, 0, 40);',
    '',
    '  skorInteraksi = ((skorTanah * skorvdp) / 50.0) * 0.667;',
    '  skorInteraksi = constrain(skorInteraksi, 0, 30);',
    '',
    '  skorTotal = skorTanah + skorvdp + skorInteraksi - skorHujan;',
    '  durasiOff = durasiOn * (1.0 + ((Atas - tanah) / 100.0));',
    '}',
    '',
    'Deskripsi rumus:',
    '- VPD: dari suhu & kelembapan (0.4-2.0 kPa)',
    '- skorTanah: 0-50 berdasarkan posisi tanah antara Kritis-Atas',
    '- skorvdp: 0-30 berdasarkan VPD',
    '- skorHujan: 0-40 berdasarkan peluang hujan BMKG',
    '- skorInteraksi: 0-30 interaksi tanah&VPD (faktor 0.667)',
    '- skorTotal: 0-100 (total akhir)',
    '- durasiOff: jeda pematian pompa',
    '',
    'ATURAN JAWABAN:',
    '- Jika user meminta "rumus Arduino", "rumus sensor", atau "rumus perhitungan", tampilkan rumus di atas secara langsung.',
    '- Jika data sensor tidak lengkap, tetap tampilkan rumus dan sebutkan data yang belum tersedia.',
    '- Gunakan rumus ini secara konsisten untuk semua perhitungan dan penjelasan angka.',
  ].join('\n');
}

export function isArduinoFormulaRequest(message) {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('rumus') || normalized.includes('formula') || normalized.includes('arduino');
}

function buildSystemPrompt(sensor) {
  const normalized = normalizeSensorContext(sensor);
  const sensorLines = normalized
    ? [
        formatLine('Device ID', normalized.device_id),
        formatLine('Fase Tanaman', normalized.plant_phase ? normalized.plant_phase.toUpperCase() : 'VEGETATIF'),
        formatLine('Suhu', normalized.temperature, ' °C'),
        formatLine('Kelembapan Udara', normalized.humidity, ' %'),
        formatLine('Kelembapan Tanah', normalized.soil_moisture, ' %'),
        formatLine('Status Pompa', normalized.pump_status ? 'MENYALA' : 'MATI'),
        formatLine('Status Lampu', normalized.led_status ? 'MENYALA' : 'MATI'),
        formatLine('Mode Operasi', normalized.device_mode ? normalized.device_mode.toUpperCase() : 'TIDAK DIKETAHUI'),
        formatLine('Jadwal Siram', normalized.schedule_enabled === false ? 'NONAKTIF' : 'AKTIF'),
        formatLine('Jam Siram', normalized.watering_time),
        formatLine('Durasi Siram', normalized.watering_duration, ' detik'),
        formatLine('WiFi', normalized.wifi_status),
        formatLine('Threshold Kritis', normalized.threshold_kritis),
        formatLine('Threshold Atas', normalized.threshold_atas),
        formatLine('Threshold Bawah', normalized.threshold_bawah),
        formatLine('Batas Tanah Rendah', normalized.soil_threshold_low, ' %'),
        formatLine('Batas Tanah Tinggi', normalized.soil_threshold_high, ' %'),
        formatLine('Batas Kritis Tanah', normalized.soil_threshold_critical, ' %'),
        formatLine('Batas Suhu Rendah', normalized.temp_threshold_low, ' °C'),
        formatLine('Batas Suhu Tinggi', normalized.temp_threshold_high, ' °C'),
        formatLine('Nama Rumus', normalized.formula_name),
        formatLine('Rumus Soil', normalized.formula_soil),
        formatLine('Rumus VPD', normalized.formula_vpd),
        formatLine('Rumus Skor', normalized.formula_score),
        formatLine('Soil Dry Raw', normalized.soil_raw_dry),
        formatLine('Waktu Data', normalized.created_at || normalized.updatedAt),
      ].join('\n')
    : '- Data sensor belum tersedia.';

  const weatherLines = normalized
    ? [
        formatLine('Lokasi Cuaca', normalized.weather_location),
        formatLine('Lokasi Prakiraan', normalized.weather_forecast_location),
        formatLine('Kondisi Cuaca', normalized.weather_condition),
        formatLine('Suhu Cuaca', normalized.weather_temperature, ' °C'),
        formatLine('Peluang Hujan', normalized.weather_rain_chance, ' %'),
        formatLine('Prakiraan Cuaca', normalized.weather_forecast),
      ].join('\n')
    : '- Data cuaca belum tersedia.';

  return [
    'Kamu adalah Smart Farm Assistant untuk aplikasi NexaGrow.',
    'Jawab dalam bahasa Indonesia yang ramah, singkat, dan langsung bisa dipakai.',
    'Gunakan format yang rapi dan mudah dibaca: judul singkat, bullet point, dan tabel sederhana bila perlu.',
    'Utamakan struktur seperti: Ringkasan, Analisis, Rekomendasi, dan jika relevan tampilkan Rumus.',
    'Fokus pada kondisi tanaman, rekomendasi perawatan, irigasi, jadwal penyiraman, dan perangkat IoT.',
    'Gunakan data sensor yang diberikan sebagai sumber utama. Jangan mengarang angka yang tidak ada.',
    'Jika rumus pengolahan disediakan dari perangkat, gunakan rumus itu sebagai acuan utama untuk menjelaskan perhitungan dan verifikasi.',
    'Saat diminta menjelaskan angka, uraikan langkah hitung sesuai rumus perangkat, bukan rumus generik lain.',
    'Jika pengguna memberi skenario hipotetis yang berbeda dari data sensor nyata, prioritaskan skenario pengguna dan jawab sesuai konteks baru itu.',
    'Jika data sensor belum tersedia, katakan bahwa data belum masuk lalu berikan saran umum yang aman, kecuali jika pengguna meminta rumus Arduino, maka tampilkan rumusnya.',
    'Jika data cuaca tersedia, gunakan lokasi cuaca aktif dan kondisi cuaca untuk rekomendasi yang spesifik wilayah.',
    'Bila fase tanaman aktif disebut vegetatif atau generatif, sesuaikan saran air, suhu, dan stres tanaman dengan fase tersebut.',
    '',
    buildFormulaReference(),
    '',
    'DATA SENSOR TERKINI:',
    sensorLines,
    '',
    'DATA CUACA TERKINI:',
    weatherLines,
  ].join('\n');
}

export async function getOpenRouterStatus(origin) {
  const key = getOpenRouterKey();
  const checkedAt = new Date().toISOString();

  if (!key) {
    return {
      ok: false,
      state: 'missing_key',
      label: 'AI Online: API key belum diatur',
      detail: 'Tambahkan OPENROUTER_API_KEY di environment server.',

      checkedAt,
    };
  }

  try {
    const response = await fetch(OPENROUTER_MODELS_URL, {
      method: 'GET',
      headers: getHeaders(origin),
    });

    if (!response.ok) {
      const detail = await response.text();
      return {
        ok: false,
        state: 'error',
        label: 'AI Online tidak tersambung',
        detail: detail || `HTTP ${response.status}`,

        checkedAt,
      };
    }

    return {
      ok: true,
      state: 'connected',
      label: 'AI Online',

      detail: `Model aktif: ${getOpenRouterModel()}`,
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      state: 'error',
      label: 'AI Online tidak tersambung',
      detail: error instanceof Error ? error.message : 'Unknown connection error',

      checkedAt,
    };
  }
}

export async function sendOpenRouterMessage({ message, history = [], sensorContext = null, origin }) {
  const key = getOpenRouterKey();
  if (!key) {
    throw new Error('OPENROUTER_API_KEY belum diatur di server.');
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(sensorContext) },
    ...history.slice(-8).map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content,
    })),
    { role: 'user', content: message },
  ];

  const response = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: getHeaders(origin),
    body: JSON.stringify({
      model: getOpenRouterModel(),
      messages,
      temperature: 0.45,
      max_tokens: 550,
    }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
      payload?.message ||
      `OpenRouter request gagal dengan status ${response.status}`,
    );
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenRouter tidak mengembalikan jawaban yang valid.');
  }

  return {
    content: content.trim(),
    model: getOpenRouterModel(),
    checkedAt: new Date().toISOString(),
  };
}
