import { useState, useRef, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, Sparkles, Sprout, RefreshCw, Wifi, WifiOff, AlertTriangle, Leaf } from 'lucide-react';
import { useChat } from '../hooks/useChat';
import type { SensorData } from '../hooks/useSensorData';
import type { Settings } from '../hooks/useSettings';
import type { WeatherData } from '../hooks/useWeather';
import { getPlantPhaseProfile, formatRange } from '../lib/plantPhase';
import { resolveWeatherLocationPath } from '../lib/weatherLocations';

const quickPrompts = [
  { icon: Sprout, label: 'Status Tanaman', text: 'Bagaimana kondisi tanaman dan kebutuhan irigasi saat ini?' },
  { icon: Bot, label: 'Lapor Harian', text: 'Berikan laporan harian efisiensi air dan status perangkat.' },
  { icon: Sparkles, label: 'Skenario Iklim', text: 'Kalau tanaman ini dipindahkan ke iklim yang lebih panas dan kering, saran perawatannya apa?' },
];

interface ChatInterfaceProps {
  sensorData?: SensorData | null;
  settings?: Settings | null;
  weatherData?: WeatherData | null;
  variant?: 'full' | 'compact';
}

function renderInlineText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={`${index}-${part}`} className="font-semibold text-slate-900 dark:text-slate-100">
          {part.slice(2, -2)}
        </strong>
      );
    }

    return <span key={`${index}-${part}`}>{part}</span>;
  });
}

function renderAssistantMessage(content: string) {
  const lines = content.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let currentList: ReactNode[] = [];
  let listType: 'ul' | 'ol' | null = null;

  const flushList = () => {
    if (!currentList.length || !listType) return;
    blocks.push(
      <div key={`list-${blocks.length}`} className="space-y-1">
        {currentList}
      </div>,
    );
    currentList = [];
    listType = null;
  };

  lines.forEach((line, lineIndex) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      blocks.push(<div key={`spacer-${lineIndex}`} className="h-1" />);
      return;
    }

    if (trimmed.startsWith('## ')) {
      flushList();
      blocks.push(
        <h4 key={`h2-${lineIndex}`} className="text-sm font-semibold uppercase tracking-wide text-green-700">
          {trimmed.slice(3)}
        </h4>,
      );
      return;
    }

    if (trimmed.startsWith('### ')) {
      flushList();
      blocks.push(
        <h5 key={`h3-${lineIndex}`} className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          {trimmed.slice(4)}
        </h5>,
      );
      return;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      if (listType !== 'ul') {
        flushList();
        listType = 'ul';
      }
      currentList.push(
        <div key={`ul-${lineIndex}`} className="flex gap-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-500" />
          <span>{renderInlineText(trimmed.replace(/^[-*]\s+/, ''))}</span>
        </div>,
      );
      return;
    }

    if (/^\d+[.)]\s+/.test(trimmed)) {
      if (listType !== 'ol') {
        flushList();
        listType = 'ol';
      }
      const number = trimmed.match(/^(\d+[.)])\s+/)?.[1] ?? '';
      const text = trimmed.replace(/^\d+[.)]\s+/, '');
      currentList.push(
        <div key={`ol-${lineIndex}`} className="flex gap-2 text-sm leading-6 text-slate-700 dark:text-gray-300">
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1 text-[11px] font-semibold text-slate-600 dark:bg-[#111827] dark:text-slate-300">
            {number.replace(/[.)]/g, '')}
          </span>
          <span>{renderInlineText(text)}</span>
        </div>,
      );
      return;
    }

    flushList();

    const isKeyValue = trimmed.includes(':') && trimmed.length < 120;
    if (isKeyValue) {
      const [label, ...rest] = trimmed.split(':');
      const value = rest.join(':').trim();
      blocks.push(
        <div key={`kv-${lineIndex}`} className="rounded-xl border border-slate-200 bg-white/70 px-3 py-2 dark:border-gray-800">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">{label.trim()}</div>
          <div className="mt-1 text-sm text-slate-900 dark:text-slate-100">{renderInlineText(value || '-')}</div>
        </div>,
      );
      return;
    }

    blocks.push(
      <p key={`p-${lineIndex}`} className="text-sm leading-6 text-slate-700 dark:text-gray-300">
        {renderInlineText(trimmed)}
      </p>,
    );
  });

  flushList();
  return <div className="space-y-2">{blocks}</div>;
}

export function ChatInterface({ sensorData = null, settings = null, weatherData = null, variant = 'full' }: ChatInterfaceProps) {
  const { messages, loading, error, sendMessage, clearMessages, connectionStatus, refreshConnectionStatus } = useChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isCompact = variant === 'compact';
  const phaseProfile = getPlantPhaseProfile(settings?.plant_phase);
  const weatherLocationLabel = useMemo(() => resolveWeatherLocationPath(settings?.location), [settings?.location]);

  const weatherForecastSummary = useMemo(() => {
    if (!weatherData?.forecast?.length) return null;

    return weatherData.forecast
      .slice(0, 5)
      .map((item) => {
        const date = new Date(item.datetime);
        const formatted = Number.isFinite(date.getTime())
          ? date.toLocaleString('id-ID', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
          : String(item.datetime);
        return `${formatted}: ${item.weather}, ${item.temperature}°C, peluang hujan ${item.rain_chance}%`;
      })
      .join(' | ');
  }, [weatherData]);

  const sensorContext = useMemo(
    () => ({
      device_id: sensorData?.device_id,
      node_id: sensorData?.node_id ?? null,
      temperature: sensorData?.temperature ?? null,
      humidity: sensorData?.humidity ?? null,
      soil_moisture: sensorData?.soil_moisture ?? null,
      created_at: sensorData?.created_at ?? null,
      plant_phase: settings?.plant_phase ?? null,
      soil_threshold_low: settings?.soil_threshold_low ?? null,
      soil_threshold_high: settings?.soil_threshold_high ?? null,
      soil_threshold_critical: settings?.soil_threshold_critical ?? null,
      humidity_threshold_low: settings?.humidity_threshold_low ?? null,
      humidity_threshold_high: settings?.humidity_threshold_high ?? null,
      temp_threshold_low: settings?.temp_threshold_low ?? null,
      temp_threshold_high: settings?.temp_threshold_high ?? null,
      weather_location: weatherLocationLabel,
      weather_condition: weatherData?.current.weather ?? null,
      weather_temperature: weatherData?.current.temperature ?? null,
      weather_rain_chance: weatherData?.current.rain_chance ?? null,
      weather_forecast_location: weatherLocationLabel,
      weather_forecast: weatherForecastSummary,
    }),
    [sensorData, settings, weatherData, weatherLocationLabel, weatherForecastSummary],
  );

  const statusTone =
    connectionStatus.state === 'connected'
      ? {
          dot: 'bg-green-500',
          text: 'text-green-700',
          chip: 'bg-green-100 text-green-700 border-green-200',
          icon: Wifi,
        }
      : connectionStatus.state === 'checking'
        ? {
            dot: 'bg-amber-400',
            text: 'text-amber-700',
            chip: 'bg-amber-100 text-amber-700 border-amber-200',
            icon: RefreshCw,
          }
        : connectionStatus.state === 'missing_key'
          ? {
              dot: 'bg-orange-400',
              text: 'text-orange-700',
              chip: 'bg-orange-100 text-orange-700 border-orange-200',
              icon: AlertTriangle,
            }
          : {
              dot: 'bg-red-500',
              text: 'text-red-700',
              chip: 'bg-red-100 text-red-700 border-red-200',
              icon: WifiOff,
            };

  const StatusIcon = statusTone.icon;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const message = input;
    setInput('');
    await sendMessage(message, sensorContext);
  };

  const handleQuickPrompt = (text: string) => {
    void sendMessage(text, sensorContext);
  };

  const rootClassName = isCompact
    ? 'flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm'
    : 'flex h-[calc(100vh-200px)] min-h-[520px] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm';

  const headerClassName = isCompact
    ? 'rounded-t-2xl border-b border-gray-100 bg-gradient-to-r from-green-50 to-teal-50 p-3'
    : 'rounded-t-2xl border-b border-gray-100 bg-gradient-to-r from-green-50 to-teal-50 p-4';

  const bodyClassName = isCompact ? 'space-y-3 overflow-y-auto p-3' : 'space-y-4 overflow-y-auto p-4 flex-1';

  const footerClassName = isCompact ? 'border-t border-gray-100 bg-white p-3' : 'border-t border-gray-100 bg-white p-4';

  return (
    <div className={rootClassName}>
      <div className={headerClassName}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-teal-600 ${isCompact ? 'h-9 w-9' : 'h-10 w-10'}`}>
              <Bot className={`${isCompact ? 'h-4 w-4' : 'h-5 w-5'} text-white`} />
            </div>
            <div>
              <h3 className={`font-semibold text-gray-800 ${isCompact ? 'text-sm' : ''}`}>NexaBot</h3>
              <p className={`flex items-center gap-1 text-xs ${statusTone.text}`}>
                <span className={`h-2 w-2 rounded-full ${statusTone.dot} ${connectionStatus.state === 'connected' ? 'animate-pulse' : ''}`} />
                {connectionStatus.label}
              </p>
              {!isCompact && <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-300">{connectionStatus.detail}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isCompact && (
              <div className={`hidden items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium sm:flex ${statusTone.chip}`}>
                <StatusIcon size={12} className={connectionStatus.state === 'checking' ? 'animate-spin' : ''} />
                AI Online
              </div>

            )}
            <button
              type="button"
              onClick={() => void clearMessages()}
              disabled={loading || messages.length === 0}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              title="Hapus riwayat chat"
            >
              Hapus Chat
            </button>
            <button
              type="button"
              onClick={refreshConnectionStatus}
              disabled={loading}
              className="rounded-lg border border-white/60 bg-white/80 p-2 text-gray-600 transition hover:bg-white light-card disabled:opacity-50 dark:text-gray-300"
              title="Periksa ulang koneksi AI Online"

            >
              <RefreshCw size={16} className={connectionStatus.state === 'checking' ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {!isCompact && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-green-100 bg-white/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-300">Fase aktif</p>
              <p className="mt-1 font-semibold text-gray-800 dark:text-gray-100">{phaseProfile.label}</p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-300">Rentang tanah</p>
              <p className="mt-1 font-semibold text-gray-800 dark:text-gray-100">{formatRange(phaseProfile.soilRange)}</p>
            </div>
            <div className="rounded-xl border border-green-100 bg-white/80 p-3">
              <p className="text-[11px] uppercase tracking-wide text-gray-600 dark:text-gray-300">Lokasi cuaca</p>
              <p className="mt-1 text-xs leading-snug text-gray-600 dark:text-gray-300">{weatherLocationLabel || weatherData?.location}</p>
            </div>
          </div>
        )}
      </div>

      <div className={bodyClassName}>
        {messages.length === 0 && (
          <div className={isCompact ? 'rounded-2xl border border-green-100 bg-green-50/60 p-4 text-center' : 'py-10 text-center'}>
            <div className={`mx-auto mb-4 flex items-center justify-center rounded-full bg-green-50 ${isCompact ? 'h-14 w-14' : 'h-20 w-20'}`}>
              <Leaf className={`text-green-600 ${isCompact ? 'h-7 w-7' : 'h-10 w-10'}`} />
            </div>
            <h4 className={`mb-2 font-semibold text-gray-700 ${isCompact ? 'text-sm' : 'text-lg'}`}>Selamat datang di NexaBot!</h4>
            <p className={`mx-auto ${isCompact ? 'mb-4 text-xs' : 'mb-6 max-w-md text-gray-600'}`}>
              Saya siap membantu memantau tanaman, membaca data cuaca aktif, dan memberi saran berdasarkan fase vegetatif atau generatif.
            </p>
            <div className={`flex flex-wrap justify-center ${isCompact ? 'gap-2' : 'gap-2'}`}>
              {quickPrompts.map((prompt) => {
                const Icon = prompt.icon;
                return (
                  <button
                    key={prompt.label}
                    type="button"
                    onClick={() => handleQuickPrompt(prompt.text)}
                    className={`inline-flex items-center gap-2 rounded-full border border-green-100 bg-green-50 font-medium text-green-700 transition hover:bg-green-100 ${isCompact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                  >
                    <Icon size={14} />
                    {prompt.label}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                  message.role === 'user' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-800'
                }`}
              >
                {message.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                ) : (
                  renderAssistantMessage(message.content)
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl bg-gray-100 px-4 py-3 text-sm text-gray-600 shadow-sm dark:bg-[#111827] dark:text-gray-300">Sedang berpikir...</div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="max-w-[80%] rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm">
              {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className={footerClassName}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanyakan kondisi tanaman, cuaca, atau jadwal penyiraman..."
            rows={isCompact ? 1 : 2}
            className={`flex-1 resize-none rounded-xl border border-gray-200 bg-slate-100 px-4 py-3 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500/20 ${isCompact ? 'min-h-[44px]' : 'min-h-[56px]'}`}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className={`inline-flex items-center gap-2 rounded-xl bg-green-600 font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50 ${isCompact ? 'h-[44px] px-4 text-sm' : 'h-[56px] px-5'}`}
          >
            <Send size={16} />
            Kirim
          </button>
        </div>
      </form>
    </div>
  );
}
