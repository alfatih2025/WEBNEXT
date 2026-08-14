import { useEffect, useMemo, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { CloudSun, ChevronDown, Save, MapPin, Navigation2 } from 'lucide-react';
import { WeatherMotionForecast } from '../components/WeatherMotionForecast';
import { useWeather } from '../hooks/useWeather';
import { useControl } from '../hooks/useControl';
import type { Settings } from '../hooks/useSettings';
import {
  DEFAULT_WEATHER_LOCATION_CODE,
  WEATHER_LOCATION_CATEGORIES,
  getWeatherLocationByCode,
  getWeatherLocationCities,
  getWeatherLocationDistricts,
  getWeatherLocationItemByPath,
  getWeatherLocationProvinces,
  getWeatherLocationVillages,
  getWeatherLocationsByCategory,
  normalizeWeatherLocationCode,
  resolveWeatherLocationPath,
} from '../lib/weatherLocations';
import type { WeatherLocationCategory } from '../types/weather';
import { recordActivity } from '../lib/activityLog';

interface WeatherPageProps {
  locationCode?: string;
  settings?: Settings | null;
  updateSettings?: (updates: Partial<Settings>) => Promise<Settings>;
}

type WeatherSelection = {
  category: WeatherLocationCategory;
  province: string;
  city: string;
  district: string;
  locationCode: string;
};

type BmkgVillageLocation = {
  code: string;
  label: string;
  province: string;
  city: string;
  district: string;
  category: 'semarang';
  level: 'village';
  parentCode: string;
  village?: string;
  ready?: boolean;
};

const STORAGE_KEY = 'nexagrow-weather-selection-v1';

function uniqueValues(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function readStoredSelection(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = raw && raw.trim() ? raw.trim() : '';
    return value || null;
  } catch {
    return null;
  }
}

function persistStoredSelection(code: string) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // ignore
  }
}

function resolveSelectionFromCode(code: string): WeatherSelection {
  const normalizedCode = normalizeWeatherLocationCode(code);
  const location = getWeatherLocationByCode(normalizedCode) ?? getWeatherLocationByCode(DEFAULT_WEATHER_LOCATION_CODE);

  if (!location) {
    return {
      category: 'semarang',
      province: 'Jawa Tengah',
      city: 'Kota Semarang',
      district: 'Semarang Selatan',
      locationCode: DEFAULT_WEATHER_LOCATION_CODE,
    };
  }

  return {
    category: location.category,
    province: location.province,
    city: location.city,
    district: location.district || (location.level === 'district' ? location.label : ''),
    locationCode: location.code || normalizedCode,
  };
}

function pickFirstLocationCode(category: WeatherSelection['category'], province: string, city: string, district?: string) {
  const item = getWeatherLocationItemByPath(category, province, city, district);
  return item?.code || DEFAULT_WEATHER_LOCATION_CODE;
}

function resolveSelection(next: Partial<WeatherSelection>, previous: WeatherSelection): WeatherSelection {
  const category = next.category || previous.category;
  const nextCategoryItems = getWeatherLocationsByCategory(category).filter((item) => item.ready !== false);
  const nextProvinces = uniqueValues(nextCategoryItems.map((item) => item.province));
  const province = nextProvinces.includes(next.province || previous.province) ? (next.province || previous.province) : nextProvinces[0] || previous.province;
  const nextCities = uniqueValues(nextCategoryItems.filter((item) => item.province === province).map((item) => item.city));
  const city = nextCities.includes(next.city || previous.city) ? (next.city || previous.city) : nextCities[0] || previous.city;
  const nextDistricts = uniqueValues(
    nextCategoryItems
      .filter((item) => item.province === province && item.city === city)
      .map((item) => item.district || (item.level === 'district' ? item.label : '')),
  );
  const district = nextDistricts.includes(next.district || previous.district) ? (next.district || previous.district) : nextDistricts[0] || '';

  const nextVillages = nextCategoryItems.filter(
    (item) => item.province === province && item.city === city && item.district === district && item.level === 'village',
  );

  let locationCode = next.locationCode || previous.locationCode;
  if (nextVillages.length > 0) {
    locationCode = nextVillages.some((item) => item.code === locationCode) ? locationCode : nextVillages[0].code;
  } else {
    const defaultDistrictCode = pickFirstLocationCode(category, province, city, district);
    const districtPrefix = defaultDistrictCode.split('.').slice(0, 3).join('.');
    const requestedPrefix = locationCode.split('.').slice(0, 3).join('.');
    locationCode = districtPrefix === requestedPrefix ? locationCode : defaultDistrictCode;
  }

  return { category, province, city, district, locationCode };
}

export function WeatherPage({ locationCode, settings, updateSettings }: WeatherPageProps) {
    const initialCode = normalizeWeatherLocationCode(locationCode || settings?.location || readStoredSelection() || DEFAULT_WEATHER_LOCATION_CODE);
  const [selection, setSelection] = useState<WeatherSelection>(resolveSelectionFromCode(initialCode));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bmkgVillages, setBmkgVillages] = useState<BmkgVillageLocation[]>([]);
  const [loadingVillages, setLoadingVillages] = useState(false);
  const [villagesError, setVillagesError] = useState<string | null>(null);

  const lastSyncedRemoteLocation = useRef<string | null>(null);

  useEffect(() => {
    const nextRemote = normalizeWeatherLocationCode(settings?.location || locationCode || '');
    if (nextRemote && nextRemote !== lastSyncedRemoteLocation.current) {
      console.log(`[WeatherPage] Syncing location from ${lastSyncedRemoteLocation.current} to ${nextRemote}`);
      lastSyncedRemoteLocation.current = nextRemote;
      setSelection(resolveSelectionFromCode(nextRemote));
    } else if (!nextRemote && lastSyncedRemoteLocation.current !== DEFAULT_WEATHER_LOCATION_CODE) {
      // Reset to default if no location provided
      lastSyncedRemoteLocation.current = DEFAULT_WEATHER_LOCATION_CODE;
      setSelection(resolveSelectionFromCode(DEFAULT_WEATHER_LOCATION_CODE));
    }
  }, [locationCode, settings?.location]);

  useEffect(() => {
    persistStoredSelection(selection.locationCode);
  }, [selection.locationCode]);

  const provinceOptions = useMemo(() => getWeatherLocationProvinces(selection.category), [selection.category]);
  const cityOptions = useMemo(() => getWeatherLocationCities(selection.category, selection.province), [selection.category, selection.province]);
  const districtOptions = useMemo(() => getWeatherLocationDistricts(selection.category, selection.province, selection.city), [selection.category, selection.province, selection.city]);
  const localVillageOptions = useMemo(
    () => getWeatherLocationVillages(selection.category, selection.province, selection.city, selection.district),
    [selection.category, selection.province, selection.city, selection.district],
  );

  useEffect(() => {
    if (selection.category !== 'semarang' || !selection.district) {
      setBmkgVillages([]);
      setVillagesError(null);
      setLoadingVillages(false);
      return;
    }
    
    // Scrape is disabled as BMKG structure changed. Using local options.
    setBmkgVillages([]);
    setVillagesError(null);
    setLoadingVillages(false);
  }, [selection.category, selection.district]);

  useEffect(() => {
    if (selection.category !== 'semarang') return;
    const options = bmkgVillages.length > 0 ? bmkgVillages : localVillageOptions;
    if (options.length === 0) return;
    // Already in the list — nothing to do
    if (options.some((item) => item.code === selection.locationCode)) return;
    // If the current code belongs to the same district (same prefix up to
    // the kecamatan segment, e.g. "33.74.07"), keep the user's explicit
    // choice even when BMKG uses a different village code for the same area.
    const currentPrefix = selection.locationCode.split('.').slice(0, 3).join('.');
    const districtItem = getWeatherLocationItemByPath(selection.category, selection.province, selection.city, selection.district);
    const expectedPrefix = districtItem?.code?.split('.').slice(0, 3).join('.') || currentPrefix;
    if (currentPrefix === expectedPrefix) return;
    // Code is from a different district entirely — snap to the first option
    setSelection((prev) => ({ ...prev, locationCode: options[0].code }));
  }, [bmkgVillages, localVillageOptions, selection.category, selection.locationCode, selection.province, selection.city, selection.district]);

  const weatherCode = selection.locationCode;
  const { data, loading, error } = useWeather(weatherCode);
  const { sendCommand } = useControl();
  const selectedLabel = useMemo(() => data?.location || resolveWeatherLocationPath(weatherCode), [data?.location, weatherCode]);
  const canSave = Boolean(updateSettings) && weatherCode !== (settings?.location || locationCode || DEFAULT_WEATHER_LOCATION_CODE);

  const updateSelection = (patch: Partial<WeatherSelection>) => {
    setSelection((prev) => resolveSelection(patch, prev));
  };

  const handleCategoryChange = (category: WeatherLocationCategory) => {
    const categoryItems = getWeatherLocationsByCategory(category).filter((item) => item.ready !== false);
    const provinces = uniqueValues(categoryItems.map((item) => item.province));
    const province = provinces[0] || 'Jawa Tengah';
    const cities = uniqueValues(categoryItems.filter((item) => item.province === province).map((item) => item.city));
    const city = cities[0] || 'Kota Semarang';
    const districts = uniqueValues(
      categoryItems.filter((item) => item.province === province && item.city === city).map((item) => item.district || (item.level === 'district' ? item.label : '')),
    );
    const district = districts[0] || '';

    setSelection({
      category,
      province,
      city,
      district,
      locationCode: pickFirstLocationCode(category, province, city, district),
    });
  };

  const handleProvinceChange = (province: string) => updateSelection({ province, city: '', district: '' });
  const handleCityChange = (city: string) => updateSelection({ city, district: '' });
  const handleDistrictChange = (district: string) => {
    const districtItem = getWeatherLocationItemByPath(selection.category, selection.province, selection.city, district);
    setSelection((prev) =>
      resolveSelection(
        {
          district,
          locationCode: districtItem?.code || prev.locationCode,
        },
        prev,
      ),
    );
  };

  const handleVillageChange = (code: string) => updateSelection({ locationCode: code });

  const handleSave = async () => {
    if (!updateSettings) return;
    setSaveState('saving');
    setSaveError(null);
    try {
      const payload: Partial<Settings> = { location: weatherCode };
      const normalized = await updateSettings(payload);
      persistStoredSelection(normalized.location);
      setSelection((prev) => ({ ...prev, locationCode: normalized.location }));

      const weatherForecastSummary = data?.forecast?.length
        ? data.forecast
            .slice(0, 5)
            .map((item) => {
              const date = new Date(item.datetime);
              const formatted = Number.isFinite(date.getTime())
                ? date.toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                : String(item.datetime);
              return `${formatted}: ${item.weather}, ${item.temperature}°C, peluang hujan ${item.rain_chance}%`;
            })
            .join(' | ')
        : null;

      await sendCommand('settings_sync', undefined, {
        plant_phase: normalized.plant_phase,
        location: normalized.location,
        weather_location: normalized.location,
        weather_condition: data?.current.weather,
        weather_rain_chance: data?.current.rain_chance,
        weather_temperature: data?.current.temperature,
        weather_forecast: weatherForecastSummary,
        temp_threshold_low: normalized.temp_threshold_low,
        temp_threshold_high: normalized.temp_threshold_high,
        humidity_threshold_low: normalized.humidity_threshold_low,
        humidity_threshold_high: normalized.humidity_threshold_high,
        soil_threshold_low: normalized.soil_threshold_low,
        soil_threshold_high: normalized.soil_threshold_high,
        soil_threshold_critical: normalized.soil_threshold_critical,
        watering_time: normalized.watering_time,
        watering_duration: normalized.watering_duration,
        watering_enabled: normalized.watering_enabled,
        auto_report: normalized.auto_report,
        report_time: normalized.report_time,
      }).catch(() => undefined);


      await sendCommand('schedule_set', undefined, {
        watering_time: normalized.watering_time,
        watering_duration: normalized.watering_duration,
        schedule_enabled: normalized.watering_enabled,
        watering_enabled: normalized.watering_enabled,
      }).catch(() => undefined);

      recordActivity({
        source: 'weather',
        type: 'weather_location_saved',
        title: 'Lokasi cuaca disimpan',
        message: `Lokasi prakiraan disetel ke ${selectedLabel}.`,
        details: { location: normalized.location, label: selectedLabel },
      });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Gagal menyimpan lokasi cuaca');
      setSaveState('idle');
    }
  };

  const currentCategoryLabel = WEATHER_LOCATION_CATEGORIES.find((item) => item.id === selection.category)?.label || 'Lokasi';
  const isSemarang = selection.category === 'semarang';
  const villageOptions = isSemarang ? (bmkgVillages.length > 0 ? bmkgVillages : localVillageOptions) : localVillageOptions;

  const hasVillageOptions = villageOptions.length > 0;
  const districtFallbackOptions = districtOptions;


  return (
    <div className="space-y-6">
      <div className="mb-2 flex items-center gap-3">
        <CloudSun className="h-6 w-6 text-green-600 dark:text-green-400" />
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Prakiraan Cuaca</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div
          key={selection.locationCode}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="space-y-4 rounded-2xl border border-gray-100 bg-white light-card p-5 shadow-sm sm:p-6 dark:bg-gray-900 dark:border-gray-800"
        >
          <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Set lokasi prakiraan</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">Kategori aktif: {currentCategoryLabel}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {WEATHER_LOCATION_CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => handleCategoryChange(category.id)}
                className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
                  selection.category === category.id
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 bg-slate-100 text-gray-600 hover:border-green-200'
                }`}
              >
                {category.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Kota / Kabupaten</label>
              <div className="relative">
                <select
                  value={selection.city}
                  onChange={(e) => handleCityChange(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-slate-100 px-4 py-3 pr-10 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-800 dark:bg-[#111827]"
                >
                  {cityOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-300" />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Kecamatan</label>
              <div className="relative">
                <select
                  value={selection.district}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-slate-100 px-4 py-3 pr-10 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 dark:border-gray-800 dark:bg-[#111827]"
                >
                  {districtOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-300" />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Kelurahan / Desa</label>
              <div className="relative">
                <select
                  value={weatherCode}
                  onChange={(e) => handleVillageChange(e.target.value)}
                  disabled={isSemarang && loadingVillages && villageOptions.length === 0}
                  className="w-full appearance-none rounded-xl border border-gray-200 bg-slate-100 px-4 py-3 pr-10 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 disabled:cursor-wait disabled:opacity-60 dark:border-gray-800 dark:bg-[#111827]"
                >
                  {hasVillageOptions ? (
                    villageOptions.map((item) => (
                      <option key={item.code} value={item.code}>
                        {item.label}
                      </option>
                    ))
                  ) : (
                    districtFallbackOptions.map((item) => (
                      <option key={item} value={pickFirstLocationCode(selection.category, selection.province, selection.city, item)}>
                        {item}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-600 dark:text-gray-300" />
              </div>
            </div>
          </div>



          <div className="flex flex-col gap-3 rounded-xl border border-green-100 bg-green-50 p-4 text-sm text-green-900 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">Lokasi yang disimpan</p>
              <p className="mt-1 text-green-800">{selectedLabel}</p>
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave || saveState === 'saving'}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save size={16} />
              {saveState === 'saving' ? 'Menyimpan...' : 'Simpan Lokasi'}
            </button>
          </div>
          {saveError ? (
            <div className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{saveError}</div>
          ) : null}

        </motion.div>

        <div className="space-y-6">
          <WeatherMotionForecast data={data} loading={loading} error={error} locationLabel={selectedLabel} />

          <motion.div
            key={`summary-${selection.locationCode}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-gray-100 bg-white light-card p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800"
          >
            <div className="mb-4 flex items-center gap-3">
              <Navigation2 className="h-5 w-5 text-green-600 dark:text-green-400" />
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Ringkasan lokasi</h3>
            </div>
            <div className="rounded-xl bg-slate-100 p-4 text-sm dark:bg-[#111827]">
              <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">Wilayah terpilih</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{selectedLabel}</p>
            </div>
          </motion.div>

          <motion.div
            key={`info-${selection.locationCode}`}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="rounded-2xl border border-gray-100 bg-white light-card p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800"
          >
            <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-gray-100">Informasi Cuaca</h3>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div className="rounded-xl bg-green-50 p-4">
                <h4 className="mb-2 font-semibold text-green-800">🌱 Dampak ke Pertanian</h4>
                <p className="text-green-600 dark:text-green-400">Data cuaca BMKG membantu menentukan jadwal penyiraman optimal dan memprediksi risiko hama.</p>
              </div>
              <div className="rounded-xl bg-blue-50 p-4">
                <h4 className="mb-2 font-semibold text-blue-800">💡 Tips Berdasarkan Cuaca</h4>
                <p className="text-blue-600 dark:text-blue-400">AI Assistant akan memberikan rekomendasi perawatan berdasarkan kondisi cuaca terkini.</p>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
