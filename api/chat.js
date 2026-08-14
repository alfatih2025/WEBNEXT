import { requireApiAuth, authError } from '../src/lib/apiHelpers/_auth.js';
import supabase from '../src/lib/apiHelpers/_supabase.js';

const OPENROUTER_API_KEY =
  process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;


const ARDUINO_FORMULA_REFERENCE = [
  'RUMUS ARDUINO NANO YANG WAJIB DIIKUTI:',
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
  'Gunakan rumus ini secara konsisten untuk semua perhitungan dan penjelasan angka.',
].join('\n');

function normalizeFormulaField(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildChatMetadata(latestSensor, latestSettings, role) {
  return {
    role,
    sensor_snapshot: {
      device_id: latestSensor?.device_id ?? null,
      temperature: latestSensor?.temperature ?? null,
      humidity: latestSensor?.humidity ?? null,
      soil_moisture: latestSensor?.soil_moisture ?? null,
      rain: latestSensor?.rain ?? null,
      score: latestSensor?.score ?? null,
      soil_score: latestSensor?.soil_score ?? null,
      vdp_score: latestSensor?.vdp_score ?? null,
      rain_score: latestSensor?.rain_score ?? null,
      vpd: latestSensor?.vpd ?? null,
      duration_estimate: latestSensor?.duration_estimate ?? null,
      pump_status: latestSensor?.pump_status ?? false,
      led_status: latestSensor?.led_status ?? false,
      device_mode: latestSensor?.device_mode ?? null,
      wifi_status: latestSensor?.wifi_status ?? null,
      threshold_kritis: latestSensor?.threshold_kritis ?? null,
      threshold_atas: latestSensor?.threshold_atas ?? null,
      threshold_bawah: latestSensor?.threshold_bawah ?? null,
      watering_time: latestSensor?.watering_time ?? null,
      watering_duration: latestSensor?.watering_duration ?? null,
      schedule_enabled: latestSensor?.schedule_enabled ?? null,
      formula_name: normalizeFormulaField(latestSensor?.formula_name),
      formula_soil: normalizeFormulaField(latestSensor?.formula_soil),
      formula_vpd: normalizeFormulaField(latestSensor?.formula_vpd),
      formula_score: normalizeFormulaField(latestSensor?.formula_score),
      soil_raw_dry: latestSensor?.soil_raw_dry ?? null,
      created_at: latestSensor?.created_at ?? null,
    },
    settings_snapshot: {
      plant_phase: latestSettings?.plant_phase ?? latestSettings?.crop_mode ?? null,
      location: latestSettings?.location ?? null,
      soil_threshold_low: latestSettings?.soil_threshold_low ?? latestSettings?.soil_moisture_threshold ?? null,
      soil_threshold_high: latestSettings?.soil_threshold_high ?? null,
      soil_threshold_critical: latestSettings?.soil_threshold_critical ?? null,
      temp_threshold_low: latestSettings?.temp_threshold_low ?? null,
      temp_threshold_high: latestSettings?.temp_threshold_high ?? null,
      humidity_threshold_low: latestSettings?.humidity_threshold_low ?? null,
      humidity_threshold_high: latestSettings?.humidity_threshold_high ?? null,
      watering_time: latestSettings?.watering_time ?? null,
      watering_duration: latestSettings?.watering_duration ?? null,
      watering_enabled: latestSettings?.watering_enabled ?? null,
      auto_report: latestSettings?.auto_report ?? null,
      report_time: latestSettings?.report_time ?? null,
      user_name: latestSettings?.user_name ?? null,
      user_email: latestSettings?.user_email ?? null,
    },
  };
}


function buildSystemPrompt(latestSensor, settings = {}) {
  const phase = String(settings.plant_phase || settings.crop_mode || 'vegetatif').trim().toLowerCase() === 'generatif'
    ? 'generatif'
    : 'vegetatif';

  return `Kamu adalah Smart Farm Assistant, ahli pertanian cerdas yang membantu petani mengelola lahan.

FOKUS:
- Fase tanaman aktif: ${phase.toUpperCase()}
- Suhu: ${latestSensor?.temperature ?? 28}°C
- Kelembapan Udara: ${latestSensor?.humidity ?? 70}%
- Kelembapan Tanah: ${latestSensor?.soil_moisture ?? 60}%
- Ambang Suhu: ${settings.temp_threshold_low ?? 0} - ${settings.temp_threshold_high ?? 0} °C
- Ambang Kelembapan Udara: ${settings.humidity_threshold_low ?? 0} - ${settings.humidity_threshold_high ?? 0} %
- Ambang Kelembapan Tanah: ${settings.soil_threshold_low ?? settings.soil_moisture_threshold ?? 40} - ${settings.soil_threshold_high ?? 80} % (kritis ${settings.soil_threshold_critical ?? 30} %)
- Status Pompa: ${latestSensor?.pump_status ? 'MENYALA' : 'MATI'}
- Jadwal Siram: ${latestSensor?.schedule_enabled === false ? 'NONAKTIF' : 'AKTIF'}
- Jam Siram: ${latestSensor?.watering_time ?? '-'}
- Durasi Siram: ${latestSensor?.watering_duration ?? '-'} detik

Gunakan rumus pengolahan Arduino berikut tanpa mengganti konstanta kecuali pengguna meminta kalibrasi baru secara eksplisit.

Jika user memberi prompt yang membahas iklim berbeda atau kondisi hipotetis lain, jawab sesuai skenario itu, bukan memaksa data sensor asli. Gunakan bahasa Indonesia yang ramah, singkat, dan akurat.`;
}

function getStatusLevel(latestSensor, settings = {}) {
  const low = Number(settings.soil_threshold_low ?? settings.soil_moisture_threshold ?? 40);
  const critical = Number(settings.soil_threshold_critical ?? Math.max(20, low - 10));
  const soilMoisture = Number(latestSensor?.soil_moisture ?? 60);
  if (soilMoisture <= critical) return 'kritis';
  if (soilMoisture < low) return 'waspada';
  return 'aman';
}

function generateDailyReport(latestSensor) {
  return `📊 Laporan Harian:\n\n🌡️ Suhu: ${latestSensor?.temperature ?? 28}°C\n💧 Kelembapan Tanah: ${latestSensor?.soil_moisture ?? 60}%\n🔌 Pompa: ${latestSensor?.pump_status ? 'Aktif' : 'Nonaktif'}\n🕒 Jadwal Siram: ${latestSensor?.watering_time ?? '-'} (${latestSensor?.schedule_enabled === false ? 'Nonaktif' : 'Aktif'})\n\nSecara keseluruhan kondisi lahan ${getStatusLevel(latestSensor)}.`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!requireApiAuth(req, res)) return;

  try {
    if (req.method === 'GET') {
      const { limit = 50 } = req.query;
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(parseInt(limit, 10));

      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'POST') {
      const { message, user_id = 'anonymous' } = req.body || {};

      const { data: latestSensor } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: latestSettings } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();

      const userChatMetadata = buildChatMetadata(latestSensor, latestSettings || {}, 'user');

      await supabase.from('chat_messages').insert({
        user_id,
        role: 'user',
        content: message,
        metadata: userChatMetadata,
      });

      const systemPrompt = buildSystemPrompt(latestSensor, latestSettings || {});

      let aiResponse = '';

      const lowerMessage = String(message || '').toLowerCase();

      if (lowerMessage.includes('siram') || lowerMessage.includes('pompa')) {
        const soilMoisture = latestSensor?.soil_moisture ?? 60;
        const low = Number(latestSettings?.soil_threshold_low ?? latestSettings?.soil_moisture_threshold ?? 40);
        const critical = Number(latestSettings?.soil_threshold_critical ?? Math.max(20, low - 10));
        if (soilMoisture <= critical) {
          aiResponse = `💧 Kondisi kritis. Kelembapan tanah ${soilMoisture}% sudah di bawah batas kritis ${critical}%.`;
        } else if (soilMoisture < low) {
          aiResponse = `⚠️ Kelembapan tanah ${soilMoisture}% mulai turun di bawah batas bawah ${low}%.`;
        } else {
          aiResponse = `✅ Kelembapan tanah ${soilMoisture}% masih cukup baik.`;
        }
      } else if (lowerMessage.includes('status') || lowerMessage.includes('sawah')) {
        aiResponse = `📊 Status lahan:\n\n🌡️ Suhu: ${latestSensor?.temperature ?? 28}°C\n💧 Kelembapan Tanah: ${latestSensor?.soil_moisture ?? 60}%\n🔌 Pompa: ${latestSensor?.pump_status ? 'Aktif' : 'Nonaktif'}\n🕒 Jadwal Siram: ${latestSensor?.watering_time ?? '-'} (${latestSensor?.schedule_enabled === false ? 'Nonaktif' : 'Aktif'})\n\nSecara keseluruhan kondisi lahan ${getStatusLevel(latestSensor, latestSettings)}.`;
      } else if (lowerMessage.includes('lapor') || lowerMessage.includes('harian')) {
        aiResponse = generateDailyReport(latestSensor);
      } else {
        try {
          const openRouterRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY || 'demo-key'}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': req.headers.origin || 'https://sprout-v2.vercel.app',
            },
            body: JSON.stringify({
              model: process.env.OPENROUTER_MODEL || process.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini',
              messages: [
                { role: 'system', content: systemPrompt + '\n\n' + ARDUINO_FORMULA_REFERENCE },
                { role: 'user', content: message },
              ],
              temperature: 0.5,
              max_tokens: 400,
            }),
          });

          const openRouterData = await openRouterRes.json();
          aiResponse = openRouterData?.choices?.[0]?.message?.content ||
            'Maaf, saya belum bisa memproses pertanyaan ini.';
        } catch (error) {
aiResponse = `Maaf, saya sedang kesulitan terhubung ke AI Online. ${error instanceof Error ? error.message : ''}`;

        }
      }

      const assistantMessage = await supabase.from('chat_messages').insert({
        user_id: 'assistant_001',
        role: 'assistant',
        content: aiResponse,
        metadata: buildChatMetadata(latestSensor, latestSettings || {}, 'assistant'),
      }).select().single();

      return res.status(200).json({
        success: true,
        message: aiResponse,
        data: assistantMessage.data,
      });
    }

    if (req.method === 'DELETE') {
      await supabase.from('chat_messages').delete().neq('id', '');
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown chat error',
    });
  }
}
