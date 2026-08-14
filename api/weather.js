import supabase from '../src/lib/apiHelpers/_supabase.js';

const DEFAULT_LOCATION_CODE = '33.74.07.1010';
const WEATHER_LOCATION_MAP = {
  '33.74.01.1001': 'Semarang Tengah',
  '33.74.02.1001': 'Semarang Utara',
  '33.74.03.1001': 'Semarang Timur',
  '33.74.04.1001': 'Gayamsari',
  '33.74.05.1001': 'Genuk',
  '33.74.06.1001': 'Pedurungan',
  '33.74.07.1010': 'Semarang Selatan / Lamper Tengah',
  '33.74.08.1001': 'Candisari',
  '33.74.09.1001': 'Gajahmungkur',
  '33.74.10.1001': 'Tembalang',
  '33.74.11.1001': 'Banyumanik',
  '33.74.12.1001': 'Gunungpati',
  '33.74.13.1001': 'Semarang Barat',
  '33.74.14.1001': 'Mijen',
  '33.74.15.1001': 'Ngaliyan',
  '33.74.16.1001': 'Tugu',
  '33.72.04.1010': 'Surakarta / Jebres',
  '33.73.01.1001': 'Salatiga',
  '33.75.01.1001': 'Pekalongan',
  '33.76.01.1001': 'Tegal',
};

function resolveLocationCode(value) {
  const raw = String(value || '').trim();
  return /^\d{2}(?:\.\d{2}){1,2}(?:\.\d{1,4})?$/.test(raw) ? raw : DEFAULT_LOCATION_CODE;
}

function resolveLocationLabel(code) {
  return WEATHER_LOCATION_MAP[code] || `Lokasi BMKG ${code}`;
}

function resolveBmkgUrl(locationCode) {
  const code = resolveLocationCode(locationCode);
  return `https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4=${encodeURIComponent(code)}`;
}

const DEFAULT_WEATHER = {
  location_code: DEFAULT_LOCATION_CODE,
  location: resolveLocationLabel(DEFAULT_LOCATION_CODE),
  current: {
    temperature: 28,
    humidity: 75,
    weather: 'Cerah Berawan',
    wind_speed: 10,
    rain_chance: 20,
  },
  forecast: [],
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify(body),
  };
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getRainChance(weatherCode) {
  const normalized = String(weatherCode ?? '').trim().toLowerCase();
  if (normalized === '0' || normalized === 'nol') return 0;
  if (['1', '2', '3', 'ringan', 'cerah'].includes(normalized)) return 10;
  if (['4', '5', '6', '7', 'berawan', 'hujan ringan'].includes(normalized)) return 35;
  if (normalized.includes('hujan')) return 70;
  return 60;
}

function formatLocation(location, fallbackLocation = DEFAULT_WEATHER.location) {
  const parts = [
    location?.desa || location?.kelurahan,
    location?.kecamatan,
    location?.kotkab,
    location?.provinsi,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(', ') : fallbackLocation;
}

function extractForecastRows(data) {
  const root = Array.isArray(data) ? data[0] : data;
  const candidates = [
    root?.data?.[0]?.cuaca,
    root?.data?.[0]?.forecast,
    root?.cuaca,
    root?.forecast,
  ].filter(Boolean);

  return candidates.flatMap((entry) => {
    if (Array.isArray(entry)) {
      return entry.flatMap((item) => (Array.isArray(item) ? item : [item]));
    }
    return [];
  }).filter(Boolean);
}

function transformBmkgWeather(data, fallbackLocation = DEFAULT_WEATHER.location) {
  const root = Array.isArray(data) ? data[0] : data;
  const forecasts = extractForecastRows(data);
  const [currentForecast, ...nextForecasts] = forecasts;
  if (!currentForecast) {
    return {
      ...DEFAULT_WEATHER,
      location: formatLocation(root?.lokasi, fallbackLocation),
    };
  }

  return {
    location_code: resolveLocationCode(root?.lokasi?.adm4 || root?.location_code || root?.adm4 || DEFAULT_LOCATION_CODE),
    location: formatLocation(root?.lokasi || root?.lokasi_terpilih, fallbackLocation),
    current: {
      temperature: toNumber(currentForecast.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(currentForecast.hu, DEFAULT_WEATHER.current.humidity),
      weather: currentForecast.weather_desc || DEFAULT_WEATHER.current.weather,
      wind_speed: toNumber(currentForecast.ws, DEFAULT_WEATHER.current.wind_speed),
      rain_chance: getRainChance(currentForecast.weather),
    },
    forecast: nextForecasts.slice(0, 8).map((item) => ({
      datetime: item.local_datetime || new Date().toISOString(),
      temperature: toNumber(item.t, DEFAULT_WEATHER.current.temperature),
      humidity: toNumber(item.hu, DEFAULT_WEATHER.current.humidity),
      weather: item.weather_desc || DEFAULT_WEATHER.current.weather,
      rain_chance: getRainChance(item.weather),
    })),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
      const urlStr = String(req.url || '');
      let queryLocation = req.query?.location || req.query?.adm4;
      if (Array.isArray(queryLocation)) {
        queryLocation = queryLocation[0];
      }

      // Fallback manual URL parsing if req.query is unavailable or stripped.
      if (!queryLocation && urlStr.includes('?')) {
        try {
          const url = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
          queryLocation = url.searchParams.get('location') || url.searchParams.get('adm4');
        } catch {
          // ignore URL parsing errors
        }
      }

      const locationCode = String(queryLocation || DEFAULT_LOCATION_CODE).trim();
      const normalizedCode = resolveLocationCode(locationCode);
    const bmkgUrl = resolveBmkgUrl(normalizedCode);
    
    let bmkgData = null;
    let lastError = null;

    try {
      const response = await fetch(bmkgUrl, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0',
        },
        next: { revalidate: 0 }, // Disable cache for Vercel
      });
      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
      } else {
        bmkgData = await response.json();
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (!bmkgData) {
      return res.status(502).json({
        error: 'BMKG API unavailable',
        location_code: normalizedCode,
        location: resolveLocationLabel(normalizedCode)
      });
    }

    const weatherData = transformBmkgWeather(bmkgData, resolveLocationLabel(normalizedCode));
    weatherData.location_code = normalizedCode;

    if (supabase) {
      await supabase.from('activity_logs').insert({
        type: 'weather',
        message: `Weather data fetched for ${weatherData.location}`,
        details: weatherData.current,
      }).catch(() => {});
    }

    return res.status(200).json(weatherData);
  } catch (err) {
    console.error('[Weather API] Unexpected error:', err);
    return res.status(500).json({
      error: 'Internal server error',
      location_code: normalizedCode,
      location: resolveLocationLabel(normalizedCode)
    });
  }
}
