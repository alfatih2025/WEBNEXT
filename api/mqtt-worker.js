import mqtt from 'mqtt';
import supabase from '../src/lib/apiHelpers/_supabase.js';

// Konfigurasi API Laravel Railway
const LARAVEL_API_URL = 'https://backendnexa-production-adce.up.railway.app/api/sensor-data';
const LARAVEL_API_KEY = 'NXG_2026_x7f83K2Lm91';

export function startMqttWorker() {
  const brokerUrl = process.env.VITE_BROKER_URL || 'wss://a4e9379a555f47669c90f4c69b75eeda.s1.eu.hivemq.cloud:8884/mqtt';
  // Use mqtts port 8883 for NodeJS client instead of wss
  const mqttUrl = brokerUrl.replace('wss://', 'mqtts://').replace(':8884/mqtt', ':8883');
  
  console.log('[MQTT Worker] Connecting to MQTT broker...');
  const client = mqtt.connect(mqttUrl, {
    username: process.env.VITE_MQTT_USERNAME || 'NexaGrowv2',
    password: process.env.VITE_MQTT_PASSWORD || 'NexaGrow12345',
    connectTimeout: 5000,
    reconnectPeriod: 5000,
  });

  client.on('connect', () => {
    console.log('[MQTT Worker] Connected to MQTT broker. Subscribing to sensor topics...');
    client.subscribe('sproutai/sensor/node/+', { qos: 1 });
  });

  client.on('message', async (topic, message) => {
    try {
      const payloadStr = message.toString();
      const payload = JSON.parse(payloadStr);

      // Verify topic format
      const match = topic.match(/^sproutai\/sensor\/node\/(\d+)$/);
      if (!match) return;

      const nodeId = Number(payload.node_id);
      if (!nodeId) return;

      const sensorPayload = {
        node_id: nodeId,
        temperature: payload.temperature,
        humidity: payload.humidity,
        soil_moisture: payload.soil_moisture ?? payload.soil,
      };
      
      if (payload.created_at) {
         sensorPayload.created_at = payload.created_at;
      }

      // 1. Simpan ke Database Web (Supabase)
      const { error } = await supabase.from('sensor_data').insert(sensorPayload);
      if (error) {
        console.error('[MQTT Worker] Supabase Insert Error:', error.message);
      } else {
        console.log(`[MQTT Worker] Saved data for node ${nodeId} to Supabase`);
      }

      // 2. TERUSKAN KE LARAVEL RAILWAY (Server-to-Server)
      // Tambahkan ke antrean untuk dikirim secara batch
      laravelBuffer.push(sensorPayload);

    } catch (e) {
      console.error('[MQTT Worker] Error processing message:', e.message);
    }
  });

  client.on('error', (err) => {
    console.error('[MQTT Worker] MQTT Error:', err.message);
  });
}

// ============================================================================
// LOGIKA BATCHING & BACKOFF KE LARAVEL
// ============================================================================
let laravelBuffer = [];
let backoffDelayMs = 0;
let lastRateLimitAt = 0;
let isSending = false;

setInterval(async () => {
  if (laravelBuffer.length === 0 || isSending) return;

  // Jika sedang dalam masa hukuman (backoff) karena 429
  if (backoffDelayMs > 0 && (Date.now() - lastRateLimitAt) < backoffDelayMs) {
    return; // Tunggu
  }

  isSending = true;
  
  // Ambil maksimal 10 data sekaligus dari antrean
  const batchSize = Math.min(laravelBuffer.length, 10);
  const batchPayload = laravelBuffer.slice(0, batchSize);

  // Send items one by one to avoid 500 Error in Laravel if it doesn't support arrays
  let sentCount = 0;
  for (const item of batchPayload) {
    try {
      const laravelRes = await fetch(LARAVEL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': LARAVEL_API_KEY
        },
        body: JSON.stringify(item)
      });
      
      if (laravelRes.status === 429) {
        backoffDelayMs = backoffDelayMs === 0 ? 15000 : Math.min(backoffDelayMs * 2, 300000);
        lastRateLimitAt = Date.now();
        console.warn(`[MQTT Worker] Laravel 429 Too Many Requests. Backoff for ${backoffDelayMs/1000}s`);
        break; // Stop sending this batch, will retry remaining next time
      } else if (!laravelRes.ok) {
        console.warn(`[MQTT Worker] Forward to Laravel failed with status ${laravelRes.status}`);
        sentCount++; // count as processed so we don't get stuck
      } else {
        sentCount++;
        backoffDelayMs = 0; // reset backoff on success
      }
    } catch (fetchErr) {
      console.error('[MQTT Worker] Failed to reach Laravel:', fetchErr.message);
      break; // stop on network error
    }
  }

  // Remove processed items from buffer
  if (sentCount > 0) {
    console.log(`[MQTT Worker] Processed ${sentCount} records to Laravel`);
    laravelBuffer = laravelBuffer.slice(sentCount);
  }
  
  isSending = false;
  
  // Keamanan jika buffer terlalu penuh (misal server Laravel mati berhari-hari)
  if (laravelBuffer.length > 500) {
    console.warn('[MQTT Worker] Laravel buffer full! Dropping oldest 100 records');
    laravelBuffer = laravelBuffer.slice(100);
  }
}, 5000); // Cek dan kirim setiap 5 detik
