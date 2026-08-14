import supabase from '../src/lib/apiHelpers/_supabase.js';
import mqtt from 'mqtt';

function toNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeRow(row) {
  if (!row || typeof row !== 'object') return null;

  return {
    id: row.id ?? undefined,
    node_id: toNumber(row.node_id, null),
    device_id: (row.node_id ?? row.device_id) ? `node_${row.node_id ?? row.device_id}` : 'ESP32_001',
    temperature: toNumber(row.temperature, null),
    humidity: toNumber(row.humidity, null),
    soil_moisture: toNumber(row.soil_moisture ?? row.soil, null),
    created_at: row.created_at ?? new Date().toISOString(),
  };
}

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // run cleanup at most once per hour
let lastCleanupAt = 0;

async function cleanupOldSensorData() {
  try {
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    await supabase
      .from('sensor_data')
      .delete()
      .lt('created_at', cutoff);
  } catch (err) {
    console.warn('[Cleanup Old Sensor Data Warning]', err?.message);
  }
}

// Publish to MQTT asynchronously in background without delaying HTTP response to ESP32 Gateway
function publishToMqttAsync(data, nodeId, sensorPayload) {
  try {
    const brokerUrl = process.env.VITE_BROKER_URL || 'wss://a4e9379a555f47669c90f4c69b75eeda.s1.eu.hivemq.cloud:8884/mqtt';
    const mqttUrl = brokerUrl.replace('wss://', 'mqtts://').replace(':8884/mqtt', ':8883');
    const realtimePayload = normalizeRow(data) || {
      ...sensorPayload,
      device_id: `node_${nodeId}`,
      created_at: new Date().toISOString(),
    };

    const client = mqtt.connect(mqttUrl, {
      username: process.env.VITE_MQTT_USERNAME || 'NexaGrowv2',
      password: process.env.VITE_MQTT_PASSWORD || 'NexaGrow12345',
      connectTimeout: 3000,
    });

    const timeout = setTimeout(() => {
      try { client.end(true); } catch {}
    }, 4000);

    client.on('connect', () => {
      const payload = JSON.stringify(realtimePayload);
      let pending = 2;
      const done = () => {
        pending--;
        if (pending <= 0) {
          clearTimeout(timeout);
          try { client.end(); } catch {}
        }
      };

      client.publish('sproutai/sensor/data', payload, { qos: 0, retain: false }, done);
      client.publish(`sproutai/sensor/node/${nodeId}`, payload, { qos: 1, retain: true }, done);
    });

    client.on('error', (err) => {
      console.warn('[MQTT Async Publish Error]', err?.message);
      clearTimeout(timeout);
      try { client.end(true); } catch {}
    });
  } catch (err) {
    console.warn('[MQTT Async Exception]', err?.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const now = Date.now();
    if (now - lastCleanupAt > CLEANUP_INTERVAL_MS) {
      lastCleanupAt = now;
      cleanupOldSensorData().catch(() => {});
    }
    if (req.method === 'GET') {
      const { limit = 100, latest, node_id } = req.query;

      if (latest === 'nodes' || latest === 'per-node') {
        const { data, error } = await supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        const latestByNode = new Map();
        for (const row of Array.isArray(data) ? data : []) {
          const normalized = normalizeRow(row);
          if (!normalized?.node_id || latestByNode.has(normalized.node_id)) continue;
          latestByNode.set(normalized.node_id, normalized);
        }

        return res.status(200).json([1, 2].map((nodeId) => latestByNode.get(nodeId)).filter(Boolean));
      }

      if (latest === 'true') {
        let query = supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false });

        if (node_id) {
          query = query.eq('node_id', Number(node_id));
        }

        const { data, error } = await query.limit(1);

        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        return res.status(200).json(row ? normalizeRow(row) : null);
      }

      let query = supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false });

      if (node_id) {
        query = query.eq('node_id', Number(node_id));
      }

      const { data, error } = await query.limit(parseInt(limit, 10) || 100);

      if (error) throw error;
      return res.status(200).json(Array.isArray(data) ? data.map(normalizeRow).filter(Boolean) : []);
    }

    if (req.method === 'POST') {
      // Validate API Key
      const apiKey = String(
        req.headers['x-api-key'] ||
        req.headers['X-Api-Key'] ||
        req.headers['X-API-Key'] ||
        req.headers['x-api'] ||
        ''
      ).trim();

      const validApiKeys = [
        process.env.SECRET_API_KEY,
        process.env.API_AUTH_TOKEN,
        process.env.VITE_API_AUTH_TOKEN,
        'NexaGrow_SecretKey_2026',
        'NXG_2026_x7f83K2Lm91',
      ]
        .map((value) => String(value || '').trim())
        .filter(Boolean);

      if (!validApiKeys.includes(apiKey)) {
        return res.status(401).json({ error: 'Unauthorized: Invalid API Key' });
      }

      const body = req.body || {};

      const nodeId = Number(body.node_id);
      if (!Number.isInteger(nodeId) || (nodeId !== 1 && nodeId !== 2)) {
        return res.status(400).json({ error: 'node_id must be 1 or 2' });
      }

      const sensorPayload = {
        node_id: nodeId,
        temperature: toNumber(body.temperature, null),
        humidity: toNumber(body.humidity, null),
        soil_moisture: toNumber(body.soil_moisture, null),
      };

      const { data, error } = await supabase
        .from('sensor_data')
        .insert(sensorPayload)
        .select()
        .single();

      if (error) throw error;

      // Trigger MQTT publish asynchronously in background
      publishToMqttAsync(data, nodeId, sensorPayload);

      return res.status(201).json(normalizeRow(data));
    }

    if (req.method === 'DELETE') {
      const days = Number(req.query.olderThanDays ?? 3);
      if (!Number.isFinite(days) || days <= 0) {
        return res.status(400).json({ error: 'Invalid olderThanDays value' });
      }

      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase
        .from('sensor_data')
        .delete()
        .lt('created_at', cutoff);

      if (error) throw error;
      return res.status(200).json({ deleted_before: cutoff });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Sensor API error:', err);
    res.status(500).json({ error: err?.message || 'Unknown error' });
  }
}
