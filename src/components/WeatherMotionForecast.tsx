import { motion } from 'framer-motion';
import { Cloud, CloudRain, CloudSun, Droplets, Sun, Wind, AlertCircle, Waves } from 'lucide-react';
import type { WeatherData } from '../hooks/useWeather';

interface WeatherMotionForecastProps {
  data: WeatherData | null;
  loading: boolean;
  error?: string | null;
  locationLabel: string;
}

const weatherMeta: Record<string, { icon: typeof Sun; title: string; accent: string }> = {
  Cerah: { icon: Sun, title: 'Cerah', accent: 'from-amber-400 to-orange-500' },
  'Cerah Berawan': { icon: CloudSun, title: 'Cerah Berawan', accent: 'from-blue-400 to-blue-500' },
  Berawan: { icon: Cloud, title: 'Berawan', accent: 'from-slate-400 to-slate-600' },
  Hujan: { icon: CloudRain, title: 'Hujan', accent: 'from-blue-500 to-indigo-600' },
  'Hujan Ringan': { icon: CloudRain, title: 'Hujan Ringan', accent: 'from-blue-400 to-blue-500' },
  'Hujan Lebat': { icon: CloudRain, title: 'Hujan Lebat', accent: 'from-indigo-600 to-violet-700' },
};

function getWeatherMeta(weather?: string) {
  return weatherMeta[weather || ''] || { icon: Sun, title: weather || 'Cerah', accent: 'from-amber-400 to-orange-500' };
}

function formatTime(datetime: string) {
  const date = new Date(datetime);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function ForecastSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white light-card p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
      <div className="animate-pulse space-y-5">
        <div className="h-6 w-48 rounded bg-gray-200" />
        <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl bg-gray-100 p-5 dark:bg-[#111827]">
            <div className="h-4 w-28 rounded bg-gray-200" />
            <div className="mt-4 h-16 w-28 rounded bg-gray-200" />
            <div className="mt-3 h-4 w-40 rounded bg-gray-200" />
          </div>
          <div className="rounded-2xl bg-gray-100 p-5 dark:bg-[#111827]">
            <div className="h-4 w-20 rounded bg-gray-200" />
            <div className="mt-3 grid grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl bg-gray-200 p-3">
                  <div className="h-3 w-12 rounded bg-gray-300" />
                  <div className="mt-4 h-8 rounded bg-gray-300" />
                  <div className="mt-3 h-3 w-10 rounded bg-gray-300" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WeatherMotionForecast({ data, loading, error, locationLabel }: WeatherMotionForecastProps) {
  if (!data) return <ForecastSkeleton />;

  const currentMeta = getWeatherMeta(data.current.weather);
  const CurrentIcon = currentMeta.icon;
  const forecastItems = data.forecast.slice(0, 8);

  return (
    <motion.div
      key={locationLabel}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="overflow-hidden rounded-2xl border border-gray-100 bg-white light-card shadow-sm dark:bg-gray-900 dark:border-gray-800"
    >
      <div className={`bg-gradient-to-br ${currentMeta.accent} p-6 text-white`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] text-white/80">Prakiraan BMKG</p>
            <h3 className="mt-2 truncate text-2xl font-bold">{locationLabel}</h3>
            <p className="mt-1 text-sm text-white/90">
              {new Intl.DateTimeFormat('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              }).format(new Date())}
            </p>
            {loading && (
              <div className="mt-3 inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white/90">
                Memuat pembaruan cuaca...
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-md">
            <CurrentIcon size={34} />
            <div>
              <p className="text-xs uppercase tracking-wide text-white/75">Kondisi sekarang</p>
              <p className="text-2xl font-semibold leading-none">{data.current.temperature}°C</p>
              <p className="text-sm text-white/90">{currentMeta.title}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/80">
              <Droplets size={16} />
              <span className="text-xs uppercase tracking-wide">Kelembapan</span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{data.current.humidity}%</p>
          </div>
          <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/80">
              <Wind size={16} />
              <span className="text-xs uppercase tracking-wide">Angin</span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{data.current.wind_speed} km/j</p>
          </div>
          <div className="rounded-2xl bg-white/12 p-4 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-white/80">
              <Waves size={16} />
              <span className="text-xs uppercase tracking-wide">Peluang hujan</span>
            </div>
            <p className="mt-3 text-2xl font-semibold">{data.current.rain_chance}%</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Prakiraan per waktu</h4>
            <p className="text-sm text-gray-600 dark:text-gray-300">Berubah mengikuti lokasi yang Anda simpan di halaman Cuaca.</p>
          </div>
          <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            Update otomatis
          </div>
        </div>

        {forecastItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {forecastItems.map((item, index) => {
              const meta = getWeatherMeta(item.weather);
              const Icon = meta.icon;
              return (
                <motion.div
                  key={`${item.datetime}-${index}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.04 * index }}
                  className="rounded-2xl border border-gray-100 bg-slate-100 p-4 shadow-sm dark:border-gray-800 dark:bg-[#111827]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-300">{formatTime(item.datetime)}</p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{meta.title}</p>
                    </div>
                    <div className="rounded-xl bg-white light-card p-2 text-slate-700 shadow-sm dark:bg-gray-900 dark:border-gray-800 dark:text-gray-300">
                      <Icon size={18} />
                    </div>
                  </div>

                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-3xl font-bold text-slate-900 dark:text-slate-100">{item.temperature}</span>
                    <span className="pb-1 text-sm font-medium text-slate-600 dark:text-slate-300">°C</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-white light-card p-3 dark:bg-gray-900 dark:border-gray-800">
                      <p className="text-xs text-slate-600 dark:text-slate-300">Kelembapan</p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{item.humidity}%</p>
                    </div>
                    <div className="rounded-xl bg-white light-card p-3 dark:bg-gray-900 dark:border-gray-800">
                      <p className="text-xs text-slate-600 dark:text-slate-300">Hujan</p>
                      <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{item.rain_chance}%</p>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-100 p-5 text-sm text-gray-600 dark:border-gray-800 dark:bg-[#111827] dark:text-gray-300">
            Data prakiraan per waktu belum tersedia untuk lokasi ini.
          </div>
        )}

        {error && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
