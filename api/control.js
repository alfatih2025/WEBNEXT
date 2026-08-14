import supabase from '../src/lib/apiHelpers/_supabase.js';
import { requireApiAuth, authError } from '../src/lib/apiHelpers/_auth.js';
import mqtt from 'mqtt'; // Pastikan kamu menginstal library ini (npm install mqtt)

// CATATAN UNTUK MAINTAINER: per pengecekan terakhir, SettingsPage.tsx TIDAK
// memanggil endpoint /api/control ini untuk settings_sync/schedule_set.
// Yang dipakai adalah hooks/useControl.ts, yang publish MQTT LANGSUNG dari
// browser lewat services/mqtt (WebSocket), bukan lewat route serverless ini.
// Endpoint ini tetap berguna sebagai jalur server-side (mis. fallback kalau
// koneksi WebSocket browser bermasalah, atau dipanggil dari luar dashboard),
// makanya tetap dijaga formatnya konsisten dengan useControl.ts. Kalau mau
// dipakai sebagai fallback otomatis, itu perlu ditambahkan sendiri di
// SettingsPage.tsx / useControl.ts.
const COMMAND_MAP = {
  pump_on: { topic: 'sproutai/pompa/cmd', payload: 'ON' },
  pump_off: { topic: 'sproutai/pompa/cmd', payload: 'OFF' },
  pump_10s: (duration, commandId) => ({
    topic: 'sproutai/ai/action',
    payload: JSON.stringify({
      command_id: commandId,
      action: 'pump_10s',
      pump: 'ON',
      duration: Number(duration || 10),
    }),
  }),
  led_on: { topic: 'sproutai/lampu/cmd', payload: 'ON' },
  led_off: { topic: 'sproutai/lampu/cmd', payload: 'OFF' },
  mode_auto: { topic: 'sproutai/mode/cmd', payload: 'AUTO' },
  mode_manual: { topic: 'sproutai/mode/cmd', payload: 'MANUAL' },
  // Key JSON di sini sengaja dibuat SAMA PERSIS dengan payload yang dikirim
  // hooks/useControl.ts (jalur client-side MQTT yang sebenarnya dipakai
  // SettingsPage.tsx) supaya kedua jalur pengiriman command konsisten dan
  // tidak membingungkan saat debugging. Firmware (tanganiPerintahSettings di
  // ESP32) tetap menerima key singkat lama (pp/rc/tk/wt/wd/se/am) untuk
  // kompatibilitas mundur, jadi mengganti ke key penuh di sini aman.
  settings_sync: (data, commandId) => {
    const phaseValue = String(data?.plant_phase ?? '').trim().toLowerCase() === 'generatif' ? 'generatif' : 'vegetatif';
    const autoModeValue = typeof data?.auto_mode === 'string'
      ? String(data?.auto_mode).trim().toLowerCase() !== 'manual'
      : Boolean(data?.auto_mode ?? true);
    const enabled = Boolean(data?.watering_enabled ?? data?.schedule_enabled ?? true);
    const location = String(data?.location || '').trim();
    const weatherLocation = String(data?.weather_location || data?.location || '').trim();
    const weatherCondition = String(data?.weather_condition || '').trim();
    const weatherRainChance = Number(data?.weather_rain_chance ?? data?.rain_chance ?? 0);
    const weatherTemperature = Number(data?.weather_temperature ?? data?.temperature ?? 0);
    const wateringTime = String(data?.watering_time || '').trim();
    const wateringDuration = Number(data?.watering_duration ?? 10);

    return {
      topic: 'sproutai/settings/cmd',
      payload: JSON.stringify({
        command_id: commandId,
        plant_phase: phaseValue,
        pp: phaseValue === 'generatif' ? 1 : 0,
        auto_mode: autoModeValue,
        am: autoModeValue ? 1 : 0,
        location,
        weather_location: weatherLocation,
        weather_location_code: weatherLocation,
        weather_condition: weatherCondition,
        weather_desc: weatherCondition,
        weather_rain_chance: weatherRainChance,
        rain: weatherRainChance,
        rc: weatherRainChance,
        weather_temperature: weatherTemperature,
        weather_temp: weatherTemperature,
        temp_threshold_low: Number(data?.temp_threshold_low ?? 0),
        temp_threshold_high: Number(data?.temp_threshold_high ?? 0),
        humidity_threshold_low: Number(data?.humidity_threshold_low ?? 0),
        humidity_threshold_high: Number(data?.humidity_threshold_high ?? 0),
        soil_threshold_low: Number(data?.soil_threshold_low ?? 0),
        soil_threshold_high: Number(data?.soil_threshold_high ?? 0),
        soil_threshold_critical: Number(data?.soil_threshold_critical ?? 0),
        tk: Number(data?.soil_threshold_critical ?? 0),
        watering_time: wateringTime,
        wt: wateringTime,
        watering_duration: wateringDuration,
        wd: wateringDuration,
        watering_enabled: enabled,
        schedule_enabled: enabled,
        se: enabled,
        auto_report: Boolean(data?.auto_report ?? true),
        report_time: String(data?.report_time ?? '08:00').trim(),
        user_name: String(data?.user_name || '').trim(),
        user_email: String(data?.user_email || '').trim(),
      }),
    };
  },
  schedule_set: (data, commandId) => ({
    topic: 'sproutai/schedule/cmd',
    payload: JSON.stringify({
      command_id: commandId,
      watering_time: String(data?.watering_time || '').trim(),
      wt: String(data?.watering_time || '').trim(),
      watering_duration: Number(data?.watering_duration || 10),
      wd: Number(data?.watering_duration || 10),
      schedule_enabled: Boolean(data?.schedule_enabled ?? data?.watering_enabled ?? true),
      watering_enabled: Boolean(data?.schedule_enabled ?? data?.watering_enabled ?? true),
      se: Boolean(data?.schedule_enabled ?? data?.watering_enabled ?? true),
    }),
  }),
  wifi_update: (data, commandId) => ({
    topic: 'sproutai/wifi/cmd',
    payload: JSON.stringify({
      command_id: commandId,
      ssid: String(data?.ssid || '').trim(),
      password: String(data?.password || ''),
    }),
  }),
};

// =====================================================================
// FUNGSI UTILITY KIRIM MQTT - ASYNC (OPTIMAL UNTUK SERVERLESS/VERCEL)
// =====================================================================
async function publishToMqttBroker(topic, payload) {
  // Secara fleksibel mendeteksi variabel MQTT standar maupun variabel VITE_ milik frontend
  let brokerUrl = process.env.MQTT_SERVER || process.env.VITE_BROKER_URL || 'broker.hivemq.com';
  const username = process.env.MQTT_USERNAME || process.env.VITE_MQTT_USERNAME || '';
  const password = process.env.MQTT_PASSWORD || process.env.VITE_MQTT_PASSWORD || '';
  const defaultPort = Number(process.env.MQTT_PORT || 1883);

  // Jika broker menggunakan protokol wss (WebSocket Secure), pastikan opsi konfigurasi path '/mqtt' disesuaikan
  const options = {
    username: username,
    password: password,
    connectTimeout: 7000,
    rejectUnauthorized: false, // Menghindari kegagalan TLS handshake di serverless cloud
  };

  // Jika URL broker belum menyertakan port spesifik, gunakan defaultPort
  if (!/:[0-9]+/.test(brokerUrl)) {
    options.port = defaultPort;
  }

  console.log(`[MQTT Client] Mencoba koneksi async ke ${brokerUrl}`);
  
  // Membuka koneksi, mengirimkan pesan dengan QoS 1 (At Least Once) & Retain, lalu langsung memutuskannya secara aman
  const client = await mqtt.connectAsync(brokerUrl, options);
  await client.publishAsync(topic, payload, { qos: 1, retain: true });
  await client.endAsync();
  
  console.log(`[MQTT Client] Pesan sukses terpublikasi ke topik: ${topic}`);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!supabase) return res.status(500).json({ error: 'Supabase belum dikonfigurasi' });

  try {
    if (req.method === 'GET') {
      const { limit = 50 } = req.query;
      const { data, error } = await supabase
        .from('control_logs')
        .select('*')
        .order('executed_at', { ascending: false })
        .limit(Math.min(Number(limit) || 50, 200));

      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      if (!requireApiAuth(req, res)) return;

      const body = req.body || {};
      const action = String(body.action || '').trim();
      const device = String(body.device || 'ESP32_001').trim();
      const duration = body.duration ?? null;
      const data = body.data || null;

      if (!Object.keys(COMMAND_MAP).includes(action)) {
        return res.status(400).json({ error: 'Invalid action' });
      }

      const now = new Date().toISOString();
      const { data: row, error } = await supabase
        .from('control_logs')
        .insert({
          action,
          device,
          duration: duration === null || duration === undefined || duration === '' ? null : Number(duration),
          status: 'pending',
          executed_at: now,
        })
        .select('*')
        .single();

      if (error) throw error;

      // Ambil detail topik & payload yang sudah dirakit
      const resolved = typeof COMMAND_MAP[action] === 'function'
        ? COMMAND_MAP[action](data ?? duration, row.id)
        : COMMAND_MAP[action];

      // ======================================================
      // PROSES KIRIM REAL-TIME KE BROKER MQTT (AWAIT SECURE TRANSIT)
      // ======================================================
      let currentStatus = 'pending';
      let mqttErrorLog = '';

      try {
        await publishToMqttBroker(resolved.topic, resolved.payload);
        currentStatus = 'sent';
      } catch (mqttErr) {
        currentStatus = 'failed';
        mqttErrorLog = mqttErr instanceof Error ? mqttErr.message : String(mqttErr);
        console.error('[MQTT Error] Gagal mengirim pesan:', mqttErr);
      }

      // Update status log terbaru ke Supabase berdasarkan hasil kirim MQTT
      await supabase
        .from('control_logs')
        .update({ status: currentStatus })
        .eq('id', row.id)
        .catch(() => {});

      await supabase.from('activity_logs').insert({
        type: 'control',
        message: `Command ${action} is ${currentStatus} for ${device}`,
        details: { 
          action, 
          device, 
          duration, 
          command_id: row.id,
          mqtt_error: mqttErrorLog || undefined
        },
      }).catch(() => {});

      return res.status(200).json({
        success: currentStatus === 'sent',
        command_id: row.id,
        status: currentStatus,
        topic: resolved.topic,
        payload: resolved.payload,
        action,
        device,
        duration: row.duration,
        error: mqttErrorLog || undefined
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: error instanceof Error ? error.message : 'Control error' });
  }
}