import { useState, useEffect, useRef } from 'react';
import { buildBmkgWeatherUrl, resolveWeatherLocationLabel, normalizeWeatherLocationCode, resolveWeatherLocationPath, DEFAULT_WEATHER_LOCATION_CODE } from '../lib/weatherLocations';
import { createStaticWeatherFallback, transformBmkgWeather } from '../lib/bmkgWeather';

export interface WeatherData {
  location: string;
  location_code?: string;
  current: {
    temperature: number;
    humidity: number;
    weather: string;
    wind_speed: number;
    rain_chance: number;
  };
  forecast: Array<{
    datetime: string;
    temperature: number;
    humidity: number;
    weather: string;
    rain_chance: number;
  }>;
}

type WeatherCacheRecord = {
  createdAt: number;
  weather: WeatherData;
};

const BMKG_URL = import.meta.env.VITE_BMKG_URL;
const WEATHER_CACHE_PREFIX = 'nexagrow_weather_cache_v3';

function getWeatherCacheKey(locationCode: string) {
  // Clear cache key on location change to force refresh
  if (!locationCode) return `${WEATHER_CACHE_PREFIX}:empty`;
  return `${WEATHER_CACHE_PREFIX}:${locationCode}`;
}

function readWeatherCache(locationCode: string) {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(getWeatherCacheKey(locationCode));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;

    const cacheRecord = parsed as WeatherCacheRecord;
    if (!cacheRecord.weather || typeof cacheRecord.createdAt !== 'number') return null;

    const now = Date.now();
    if (now - cacheRecord.createdAt > 5 * 60 * 1000) {
      return null;
    }

    return cacheRecord.weather;
  } catch {
    return null;
  }
}

function normalizeWeatherData(locationCode: string, data: WeatherData | null | undefined, fallbackLabel: string, pathLabel: string): WeatherData {
  const safe = data && typeof data === 'object' ? data : null;
  const isKnownLocation = pathLabel !== locationCode && !fallbackLabel.startsWith('Lokasi BMKG');
  const bestLocation = isKnownLocation ? pathLabel : (safe?.location ?? fallbackLabel);
  const current = safe?.current ?? {
    temperature: 28,
    humidity: 75,
    weather: 'Cerah Berawan',
    wind_speed: 10,
    rain_chance: 20,
  };

  const sourceForecast = safe?.forecast;
  const forecast = Array.isArray(sourceForecast)
    ? sourceForecast.filter(Boolean).slice(0, 8).map((item) => ({
        datetime: String(item?.datetime ?? new Date().toISOString()),
        temperature: Number(item?.temperature ?? 0) || 0,
        humidity: Number(item?.humidity ?? 0) || 0,
        weather: String(item?.weather ?? 'Cerah Berawan'),
        rain_chance: Number(item?.rain_chance ?? 0) || 0,
      }))
    : [];

  return {
    location: String(bestLocation),
    location_code: String(safe?.location_code ?? locationCode),
    current: {
      temperature: Number(current.temperature) || 0,
      humidity: Number(current.humidity) || 0,
      weather: String(current.weather ?? 'Cerah Berawan'),
      wind_speed: Number(current.wind_speed) || 0,
      rain_chance: Number(current.rain_chance) || 0,
    },
    forecast,
  };
}

function writeWeatherCache(locationCode: string, data: WeatherData) {
  if (typeof window === 'undefined') return;

  try {
    const pathLabel = resolveWeatherLocationPath(locationCode);
    const normalizedWeather = normalizeWeatherData(locationCode, data, data.location, pathLabel);
    const cacheRecord: WeatherCacheRecord = {
      createdAt: Date.now(),
      weather: normalizedWeather,
    };
    window.localStorage.setItem(getWeatherCacheKey(locationCode), JSON.stringify(cacheRecord));
  } catch {
    // ignore cache write failures
  }
}

export function useWeather(locationCode?: string) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const prevLocationCode = useRef<string | undefined>(undefined);

  useEffect(() => {
    // Invalidate cache immediately when location changes
    if (locationCode && prevLocationCode.current !== locationCode) {
      const cacheKey = getWeatherCacheKey(locationCode);
      window.localStorage.removeItem(cacheKey);
      prevLocationCode.current = locationCode;
    }

    const controller = new AbortController();
    const normalizedLocation = locationCode ? normalizeWeatherLocationCode(locationCode) : DEFAULT_WEATHER_LOCATION_CODE;
    const fallbackLabel = resolveWeatherLocationLabel(normalizedLocation);
    const pathLabel = resolveWeatherLocationPath(normalizedLocation);
    const cachedWeather = readWeatherCache(normalizedLocation);
    const staticFallback = createStaticWeatherFallback(normalizedLocation, pathLabel);

    setLoading(true);
    setError(null);
    setData(normalizeWeatherData(normalizedLocation, cachedWeather ?? staticFallback, fallbackLabel, pathLabel));

    const fetchWeather = async () => {
      try {
        const apiUrl = `/api/weather?location=${encodeURIComponent(normalizedLocation)}`;
        const response = await fetch(apiUrl, { signal: controller.signal });

        if (response.ok) {
          const weather = await response.json();
          const resolved = normalizeWeatherData(normalizedLocation, { ...weather, location_code: normalizedLocation }, fallbackLabel, pathLabel);
          setData(resolved);
          writeWeatherCache(normalizedLocation, resolved);
          setError(null);
          return;
        }

        const apiErrorText = await response.text();
        const apiError = `Weather API failed (${response.status}): ${apiErrorText}`;

        if (BMKG_URL) {
          const bmkgUrl = buildBmkgWeatherUrl(BMKG_URL, normalizedLocation);
          const bmkgRes = await fetch(bmkgUrl, { signal: controller.signal });

          if (bmkgRes.ok) {
            const bmkgJson = await bmkgRes.json();
            const weather = transformBmkgWeather(bmkgJson, fallbackLabel);
            const resolved = normalizeWeatherData(normalizedLocation, { ...weather, location_code: normalizedLocation }, fallbackLabel, pathLabel);
            setData(resolved);
            writeWeatherCache(normalizedLocation, resolved);
            setError(null);
            return;
          }

          const bmkgErrorText = await bmkgRes.text();
          setError(`BMKG fallback failed (${bmkgRes.status}): ${bmkgErrorText}`);
          const fallbackData = normalizeWeatherData(normalizedLocation, cachedWeather ?? staticFallback, fallbackLabel, pathLabel);
          setData(fallbackData);
          return;
        }

        setError(apiError);
        const fallbackData = normalizeWeatherData(normalizedLocation, cachedWeather ?? staticFallback, fallbackLabel, pathLabel);
        setData(fallbackData);
      } catch (err) {
        if ((err as Error)?.name === 'AbortError') return;

        const fallbackData = normalizeWeatherData(normalizedLocation, cachedWeather ?? staticFallback, fallbackLabel, pathLabel);
        setData(fallbackData);
        setError(err instanceof Error ? err.message : 'Gagal memuat cuaca');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchWeather();
    const interval = window.setInterval(fetchWeather, 300000);

    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [locationCode]);

  return { data, loading, error };
}
