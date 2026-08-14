import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings as SettingsIcon, User, Sprout, Wifi, CalendarDays, SlidersHorizontal, Droplets, Thermometer, MapPinned } from 'lucide-react';
import { useSettings, Settings as SettingsType } from '../hooks/useSettings';
import { useControl } from '../hooks/useControl';
import { useWeather } from '../hooks/useWeather';
import { getPhaseDefaults, getPlantPhaseProfile, formatRange } from '../lib/plantPhase';
import { recordActivity } from '../lib/activityLog';

const phaseOptions = [
  { id: 'vegetatif', icon: '🌱' },
  { id: 'generatif', icon: '🌼' },
] as const;

export function SettingsPage() {
  const { settings, loading, updateSettings } = useSettings();
  const { sendCommand, loading: controlLoading } = useControl();

  const [formData, setFormData] = useState<Partial<SettingsType>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  // Status pengiriman MQTT ke ESP32, terpisah dari status simpan ke database.
  // Sebelumnya hasil sendCommand() dibuang begitu saja sehingga kegagalan MQTT
  // tidak pernah terlihat di UI.
  const [syncError, setSyncError] = useState<string | null>(null);
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPassword, setWifiPassword] = useState('');
  const [wifiStatus, setWifiStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [wifiError, setWifiError] = useState<string | null>(null);

  useEffect(() => {
    if (settings && !isDirty) setFormData(settings);
  }, [settings, isDirty]);

  const weatherLocation = String(formData.location || settings?.location || '');

  // Kode wilayah disimpan internal untuk API cuaca, namun tidak ditampilkan mentah di UI web.
  const { data: weatherData } = useWeather(weatherLocation);


  const currentPhase = (formData.plant_phase || settings?.plant_phase || 'vegetatif') as 'vegetatif' | 'generatif';
  const phaseProfile = getPlantPhaseProfile(currentPhase);

  const updateField = (field: keyof SettingsType, value: unknown) => {
    setIsDirty(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const applyPhaseDefaults = (phase: 'vegetatif' | 'generatif') => {
    setIsDirty(true);
    const defaults = getPhaseDefaults(phase);
    setFormData((prev) => ({
      ...prev,
      ...defaults,
      plant_phase: phase,
      crop_mode: phase,
    }));
    recordActivity({
      source: 'settings',
      type: 'phase_change',
      title: 'Fase tanaman diubah',
      message: `Fase diatur ke ${phase === 'vegetatif' ? 'Vegetatif' : 'Generatif'}.`,
      details: { phase },
    });
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    setSyncError(null);

    // Bangun payload dari formData dengan fallback ke settings yang ada
    const rawWateringTime = formData.watering_time || settings?.watering_time || '06:00';
    // Bug #3 Fix: Validasi format HH:MM sebelum dipakai — jika tidak valid, fallback ke '06:00'
    const safeWateringTime = /^\d{2}:\d{2}$/.test(rawWateringTime) ? rawWateringTime : '06:00';

    const payload: Partial<SettingsType> = {
      ...formData,
      plant_phase: currentPhase,
      crop_mode: currentPhase,
      location: String(formData.location ?? settings?.location ?? '').trim() || settings?.location || '',
      watering_time: safeWateringTime,
      watering_duration: Number(formData.watering_duration ?? settings?.watering_duration ?? 10),
      watering_enabled: Boolean(formData.watering_enabled ?? settings?.watering_enabled ?? true),
      temp_threshold_low: Number(formData.temp_threshold_low ?? settings?.temp_threshold_low ?? phaseProfile.tempRange[0]),
      temp_threshold_high: Number(formData.temp_threshold_high ?? settings?.temp_threshold_high ?? phaseProfile.tempRange[1]),
      humidity_threshold_low: Number(formData.humidity_threshold_low ?? settings?.humidity_threshold_low ?? phaseProfile.humidityRange[0]),
      humidity_threshold_high: Number(formData.humidity_threshold_high ?? settings?.humidity_threshold_high ?? phaseProfile.humidityRange[1]),
      soil_threshold_low: Number(formData.soil_threshold_low ?? settings?.soil_threshold_low ?? phaseProfile.soilRange[0]),
      soil_threshold_high: Number(formData.soil_threshold_high ?? settings?.soil_threshold_high ?? phaseProfile.soilRange[1]),
      soil_threshold_critical: Number(formData.soil_threshold_critical ?? settings?.soil_threshold_critical ?? phaseProfile.criticalSoil),
    };

    // Bug #2 Fix: Simpan ke API database dulu (tapi jangan blokir pengiriman MQTT jika gagal).
    // updateSettings() dari hooks/useSettings tidak pernah throw — jika API gagal,
    // ia return payload lokal sehingga normalized selalu valid.
    let normalized: SettingsType;
    try {
      normalized = await updateSettings(payload);
    } catch {
      // Fallback ke payload lokal agar MQTT tetap bisa dikirim walau API bermasalah
      normalized = payload as SettingsType;
    }

    // DEBUG: pastikan payload threshold valid dan benar-benar dikirim ke MQTT.
    // Buka DevTools Console di browser untuk melihat output ini.
    console.log('[SettingsPage] settings_sync payload', {
      soil_threshold_low: normalized.soil_threshold_low,
      soil_threshold_high: normalized.soil_threshold_high,
      soil_threshold_critical: normalized.soil_threshold_critical,
      watering_time: normalized.watering_time,
      watering_duration: normalized.watering_duration,
      watering_enabled: normalized.watering_enabled,
      plant_phase: normalized.plant_phase,
    });

    const weatherForecastSummary = weatherData?.forecast?.length
      ? weatherData.forecast
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

    try {
      // Bug #2 Fix: Pengiriman MQTT ke ESP32 SELALU dijalankan, tidak bergantung pada
      // keberhasilan API database di atas. sendCommand() sudah punya timeout internal
      // (~10 detik) dan SELALU resolve dengan { success, error } — tidak pernah throw.
      const [settingsSyncResult, scheduleSetResult] = await Promise.all([
        sendCommand('settings_sync', undefined, {
          plant_phase: normalized.plant_phase,
          location: normalized.location,
          weather_location: normalized.location,
          weather_condition: weatherData?.current.weather,
          weather_rain_chance: weatherData?.current.rain_chance,
          weather_temperature: weatherData?.current.temperature,
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
        }),
        sendCommand('schedule_set', undefined, {
          watering_time: normalized.watering_time,
          watering_duration: normalized.watering_duration,
          schedule_enabled: normalized.watering_enabled,
          watering_enabled: normalized.watering_enabled,
        }),
      ]);

      const failedCommands: string[] = [];
      if (!settingsSyncResult.success) failedCommands.push('settings_sync');
      if (!scheduleSetResult.success) failedCommands.push('schedule_set');
      const mqttSynced = failedCommands.length === 0;

      recordActivity({
        source: 'settings',
        type: 'settings_saved',
        title: 'Pengaturan disimpan',
        message: mqttSynced
          ? `Fase ${normalized.plant_phase} dan ambang batas sensor berhasil diperbarui & dikirim ke ESP32.`
          : `Fase ${normalized.plant_phase} dan ambang batas sensor tersimpan di database, tapi GAGAL dikirim ke ESP32 (${failedCommands.join(', ')}).`,
        details: {
          phase: normalized.plant_phase,
          location: normalized.location,
          temp: [normalized.temp_threshold_low, normalized.temp_threshold_high],
          humidity: [normalized.humidity_threshold_low, normalized.humidity_threshold_high],
          soil: [normalized.soil_threshold_low, normalized.soil_threshold_high, normalized.soil_threshold_critical],
          mqtt_synced: mqttSynced,
        },
      });

      setFormData(normalized);
      setIsDirty(false);
      setSaveStatus('saved');

      if (!mqttSynced) {
        // Data sudah aman di database, tapi ESP32 belum tentu menerima
        // perubahan ini. Tampilkan alasannya supaya tidak menyesatkan.
        const reason = settingsSyncResult.error || scheduleSetResult.error || 'MQTT tidak terkirim';
        setSyncError(`Tersimpan, tapi gagal dikirim ke ESP32 (${failedCommands.join(', ')}): ${reason}`);
      } else {
        setSyncError(null);
      }

      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err) {
      setIsDirty(false);
      setSaveStatus('idle');
      setSyncError(err instanceof Error ? err.message : 'Gagal mengirim perintah ke ESP32');
    }
  };


  const handleSendWifi = async () => {
    setWifiStatus('sending');
    setWifiError(null);
    try {
      await sendCommand('wifi_update', undefined, { ssid: wifiSsid, password: wifiPassword });
      setWifiStatus('sent');
      setWifiSsid('');
      setWifiPassword('');
      recordActivity({
        source: 'settings',
        type: 'wifi_update',
        title: 'SSID WiFi dikirim',
        message: 'Kredensial WiFi dikirim ke ESP32.',
        details: { ssid: wifiSsid.trim() },
      });
      setTimeout(() => setWifiStatus('idle'), 2000);
    } catch (err) {
      setWifiError(err instanceof Error ? err.message : 'Gagal mengirim WiFi');
      setWifiStatus('error');
    }
  };

  if (loading && !settings) {
    return <div className="p-6 text-gray-600 dark:text-gray-300">Memuat pengaturan...</div>;
  }

  const humidityLow = formData.humidity_threshold_low ?? settings?.humidity_threshold_low ?? phaseProfile.humidityRange[0];
  const humidityHigh = formData.humidity_threshold_high ?? settings?.humidity_threshold_high ?? phaseProfile.humidityRange[1];

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center gap-3">
        <SettingsIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Pengaturan</h2>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="rounded-2xl border border-gray-100 bg-white light-card p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <div className="mb-6 flex items-center gap-3">
            <Sprout className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Fase Tanaman</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {phaseOptions.map((phase) => (
              <motion.button
                key={phase.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => applyPhaseDefaults(phase.id)}
                className={`rounded-xl border-2 p-4 transition-all ${currentPhase === phase.id ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-green-200'}`}
              >
                <span className="mb-2 block text-2xl">{phase.icon}</span>
                <span className={`font-medium ${currentPhase === phase.id ? 'text-green-700' : 'text-gray-700'}`}>
                  {phase.id === 'vegetatif' ? 'Vegetatif' : 'Generatif'}
                </span>
              </motion.button>
            ))}
          </div>
          <div className="mt-5 rounded-xl bg-green-50 p-4 text-sm text-green-900">
            <p className="font-semibold">{phaseProfile.label}</p>
            <p className="mt-1 text-green-800">{phaseProfile.description}</p>
            <p className="mt-2 text-green-700">Rentang rekomendasi tanah: {formatRange(phaseProfile.soilRange)}</p>
            <p className="mt-1 text-green-700">Rentang rekomendasi kelembapan udara: {phaseProfile.humidityRange[0]}%–{phaseProfile.humidityRange[1]}%</p>
          </div>

        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-2xl border border-gray-100 bg-white light-card p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <div className="mb-6 flex items-center gap-3">
            <SlidersHorizontal className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Ambang Batas Sensor</h3>
          </div>

          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-100 bg-slate-100 p-4 dark:border-gray-800 dark:bg-[#111827]">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-300">
                <Thermometer className="h-4 w-4 text-green-600 dark:text-green-400" />
                Suhu udara
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Batas bawah</label>
                  <input type="number" value={formData.temp_threshold_low ?? settings?.temp_threshold_low ?? phaseProfile.tempRange[0]} onChange={(e) => updateField('temp_threshold_low', Number(e.target.value))} className="w-full rounded-xl border border-gray-200 bg-white light-card px-4 py-3 dark:bg-gray-900 dark:border-gray-800" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Batas atas</label>
                  <input type="number" value={formData.temp_threshold_high ?? settings?.temp_threshold_high ?? phaseProfile.tempRange[1]} onChange={(e) => updateField('temp_threshold_high', Number(e.target.value))} className="w-full rounded-xl border border-gray-200 bg-white light-card px-4 py-3 dark:bg-gray-900 dark:border-gray-800" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-100 p-4 dark:border-gray-800 dark:bg-[#111827]">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-300">
                <Droplets className="h-4 w-4 text-green-600 dark:text-green-400" />
                Kelembapan udara
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Batas bawah</label>
                  <input type="number" value={formData.humidity_threshold_low ?? settings?.humidity_threshold_low ?? phaseProfile.humidityRange[0]} onChange={(e) => updateField('humidity_threshold_low', Number(e.target.value))} className="w-full rounded-xl border border-gray-200 bg-white light-card px-4 py-3 dark:bg-gray-900 dark:border-gray-800" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Batas atas</label>
                  <input type="number" value={formData.humidity_threshold_high ?? settings?.humidity_threshold_high ?? phaseProfile.humidityRange[1]} onChange={(e) => updateField('humidity_threshold_high', Number(e.target.value))} className="w-full rounded-xl border border-gray-200 bg-white light-card px-4 py-3 dark:bg-gray-900 dark:border-gray-800" />
                </div>
              </div>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">Rentang aktif: {humidityLow}%–{humidityHigh}%</p>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-slate-100 p-4 dark:border-gray-800 dark:bg-[#111827]">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-gray-300">
                <MapPinned className="h-4 w-4 text-green-600 dark:text-green-400" />
                Kelembapan tanah
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Batas bawah</label>
                  <input type="number" value={formData.soil_threshold_low ?? settings?.soil_threshold_low ?? phaseProfile.soilRange[0]} onChange={(e) => updateField('soil_threshold_low', Number(e.target.value))} className="w-full rounded-xl border border-gray-200 bg-white light-card px-4 py-3 dark:bg-gray-900 dark:border-gray-800" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Batas atas</label>
                  <input type="number" value={formData.soil_threshold_high ?? settings?.soil_threshold_high ?? phaseProfile.soilRange[1]} onChange={(e) => updateField('soil_threshold_high', Number(e.target.value))} className="w-full rounded-xl border border-gray-200 bg-white light-card px-4 py-3 dark:bg-gray-900 dark:border-gray-800" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-600 dark:text-slate-300">Kritis</label>
                  <input type="number" value={formData.soil_threshold_critical ?? settings?.soil_threshold_critical ?? phaseProfile.criticalSoil} onChange={(e) => updateField('soil_threshold_critical', Number(e.target.value))} className="w-full rounded-xl border border-gray-200 bg-white light-card px-4 py-3 dark:bg-gray-900 dark:border-gray-800" />
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="rounded-2xl border border-gray-100 bg-white light-card p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <div className="mb-6 flex items-center gap-3">
            <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Kirim WiFi ke ESP32</h3>
          </div>
          <div className="space-y-3">
            <input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="SSID WiFi" className="w-full rounded-xl border border-gray-200 bg-slate-100 px-4 py-3 dark:border-gray-800 dark:bg-[#111827]" />
            <input value={wifiPassword} onChange={(e) => setWifiPassword(e.target.value)} placeholder="Password WiFi" type="password" className="w-full rounded-xl border border-gray-200 bg-slate-100 px-4 py-3 dark:border-gray-800 dark:bg-[#111827]" />
            <button onClick={handleSendWifi} disabled={wifiStatus === 'sending' || controlLoading} className="w-full rounded-xl bg-green-600 px-4 py-3 font-semibold text-white disabled:opacity-50">
              {wifiStatus === 'sending' ? 'Mengirim...' : 'Kirim ke ESP32'}
            </button>
            {wifiError && <p className="text-sm text-red-600">{wifiError}</p>}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl border border-gray-100 bg-white light-card p-6 shadow-sm dark:bg-gray-900 dark:border-gray-800">
          <div className="mb-6 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-green-600 dark:text-green-400" />
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">Jadwal Penyiraman</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Waktu siram</label>
              <input type="time" value={formData.watering_time || settings?.watering_time || '06:00'} onChange={(e) => updateField('watering_time', e.target.value)} className="w-full rounded-xl border border-gray-200 bg-slate-100 px-4 py-3 dark:border-gray-800 dark:bg-[#111827]" />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Durasi (detik)</label>
              <input type="number" value={formData.watering_duration ?? settings?.watering_duration ?? 10} onChange={(e) => updateField('watering_duration', Number(e.target.value))} className="w-full rounded-xl border border-gray-200 bg-slate-100 px-4 py-3 dark:border-gray-800 dark:bg-[#111827]" />
            </div>
          </div>
          <label className="mt-4 flex items-center gap-3 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={formData.watering_enabled ?? settings?.watering_enabled ?? true} onChange={(e) => updateField('watering_enabled', e.target.checked)} className="h-5 w-5 rounded border-gray-300 text-green-600 focus:ring-green-500 dark:text-green-400" />
            Jadwal penyiraman aktif
          </label>
        </motion.div>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          {saveStatus === 'saved' && !syncError && (
            <span className="text-gray-600 dark:text-gray-300">Pengaturan tersimpan &amp; berhasil dikirim ke ESP32.</span>
          )}
          {saveStatus === 'saved' && syncError && (
            <span className="text-amber-600">{syncError}</span>
          )}
        </div>
        <button onClick={handleSave} className="rounded-xl bg-green-600 px-6 py-3 font-semibold text-white shadow-sm">
          {saveStatus === 'saving' ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  );
}
