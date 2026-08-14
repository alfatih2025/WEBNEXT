import supabase from '../src/lib/apiHelpers/_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      if (!supabase) {
        return res.status(200).json({
          online: false,
          wifi_status: 'unknown',
          last_update: null,
          device_id: 'ESP32_001',
          pump_status: false,
          feeder_status: false
        });
      }

      const { data: latestData, error: dataError } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

      if (dataError) throw dataError;
      const row = Array.isArray(latestData) ? latestData[0] : latestData;
      if (!row) {
        return res.status(200).json({
          online: false,
          wifi_status: 'unknown',
          last_update: null,
          device_id: 'ESP32_001',
          pump_status: false,
          feeder_status: false
        });
      }


      const lastUpdate = new Date(row.created_at);
      const now = new Date();
      const diffMinutes = (now - lastUpdate) / (1000 * 60);
      const isOnline = isNaN(diffMinutes) ? true : diffMinutes < 15;

      return res.status(200).json({
        online: isOnline,
        wifi_status: row.wifi_status,
        last_update: row.created_at,
        device_id: row.device_id,
        pump_status: row.pump_status,
        feeder_status: row.feeder_status
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Device status error:', err);
    res.status(500).json({ error: err.message });
  }
}
