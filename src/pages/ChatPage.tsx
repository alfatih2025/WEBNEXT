
import { ChatInterface } from '../components/ChatInterface';
import { MessageSquare, Sparkles } from 'lucide-react';
import { SensorData } from '../hooks/useSensorData';
import { Settings } from '../hooks/useSettings';
import { WeatherData } from '../hooks/useWeather';
import { getPlantPhaseProfile } from '../lib/plantPhase';

interface ChatPageProps {
  sensorData?: SensorData | null;
  settings?: Settings | null;
  weatherData?: WeatherData | null;
}

export function ChatPage({ sensorData = null, settings = null, weatherData = null }: ChatPageProps) {
  const phase = getPlantPhaseProfile(settings?.plant_phase);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NexaBot</h2>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-200">
          <Sparkles size={12} />
          AI Pertanian
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-3xl border border-green-100 bg-white light-card p-4 shadow-sm dark:border-green-500/20 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Fase aktif</p>
          <p className="mt-1 font-semibold text-slate-900 dark:text-slate-100">{phase.label}</p>
        </div>
        <div className="rounded-3xl border border-green-100 bg-white light-card p-4 shadow-sm dark:border-green-500/20 dark:bg-slate-900">
          <p className="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Lokasi cuaca</p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{weatherData?.location || 'Lokasi cuaca belum dipilih'}</p>
        </div>
      </div>

      <ChatInterface sensorData={sensorData} settings={settings} weatherData={weatherData} />
    </div>
  );
}
