import { motion } from 'framer-motion';
import { CloudRain, Sun, Cloud, Wind, Droplets, Umbrella, AlertCircle } from 'lucide-react';
import { WeatherData } from '../hooks/useWeather';

interface WeatherCardProps {
  data: WeatherData | null;
  loading: boolean;
  error?: string | null;
}

const weatherIcons: Record<string, typeof Sun> = {
  Cerah: Sun,
  'Cerah Berawan': Cloud,
  Berawan: Cloud,
  Hujan: CloudRain,
  'Hujan Ringan': CloudRain,
  'Hujan Lebat': CloudRain,
};

export function WeatherCard({ data, loading, error }: WeatherCardProps) {
  if (loading || !data) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white light-card p-6 shadow-sm animate-pulse dark:bg-gray-900 dark:border-gray-800">
        <div className="h-40 rounded-xl bg-gray-200" />
      </div>
    );
  }

  const WeatherIcon = weatherIcons[data.current.weather] || Sun;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 p-6 text-white shadow-lg shadow-blue-200">
      <div className="mb-2 flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold">{data.location}</h3>
          <p className="text-sm text-blue-100">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>
        <div className="rounded-xl bg-white/20 p-3 backdrop-blur-sm">
          <WeatherIcon size={32} className="text-white" />
        </div>
      </div>

      <div className="mb-3 flex items-end gap-2">
        <span className="text-5xl font-bold">{data.current.temperature}</span>
        <span className="mb-1 text-2xl text-blue-200">°C</span>
      </div>

      <p className="mb-4 text-lg font-medium">{data.current.weather}</p>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex items-center gap-2">
          <Droplets size={18} className="text-blue-200" />
          <div>
            <p className="text-xs text-blue-200">Kelembapan</p>
            <p className="font-semibold">{data.current.humidity}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Wind size={18} className="text-blue-200" />
          <div>
            <p className="text-xs text-blue-200">Angin</p>
            <p className="font-semibold">{data.current.wind_speed} km/j</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Umbrella size={18} className="text-blue-200" />
          <div>
            <p className="text-xs text-blue-200">Hujan</p>
            <p className="font-semibold">{data.current.rain_chance}%</p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-xl bg-white/15 p-3 text-sm text-white/90">
          <AlertCircle size={16} className="mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      {data.forecast.length > 0 && (
        <div className="mt-6 border-t border-white/20 pt-6">
          <p className="mb-3 text-sm font-medium">Prakiraan Mendatang</p>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {data.forecast.slice(0, 5).map((item, idx) => (
              <div key={idx} className="min-w-[60px] text-center">
                <p className="text-xs text-blue-200">{new Date(item.datetime).getHours()}:00</p>
                <div className="my-2">{weatherIcons[item.weather] ? <span className="text-xl">🌤️</span> : <span className="text-xl">☀️</span>}</div>
                <p className="font-semibold">{item.temperature}°</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
