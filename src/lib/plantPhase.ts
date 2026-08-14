export type PlantPhase = 'vegetatif' | 'generatif';

export interface PlantPhaseProfile {
  phase: PlantPhase;
  label: string;
  description: string;
  soilRange: [number, number];
  criticalSoil: number;
  tempRange: [number, number];
  humidityRange: [number, number];
  wateringHint: string;
  aiGuidance: string;
}

export interface PlantHealthSummary {
  phase: PlantPhase;
  phaseLabel: string;
  phaseDescription: string;
  recommendedSoilRange: [number, number];
  recommendedTemperatureRange: [number, number];
  healthState: 'sehat' | 'waspada' | 'kritis' | 'unknown';
  healthLabel: string;
  healthDetail: string;
  statusTone: 'good' | 'warning' | 'danger';
  statusLabel: string;
  recommendation: string;
  alerts: Array<{
    key: string;
    type: 'soil' | 'temperature' | 'weather' | 'phase';
    message: string;
    severity: 'info' | 'warning' | 'danger';
    sendEmail?: boolean;
    metadata?: Record<string, unknown>;
  }>;
}

export const PLANT_PHASE_PROFILES: Record<PlantPhase, PlantPhaseProfile> = {
  vegetatif: {
    phase: 'vegetatif',
    label: 'Fase Vegetatif',
    description: 'Tanaman fokus membentuk akar, batang, dan daun. Butuh air stabil agar pertumbuhan tidak terhambat.',
    soilRange: [45, 75],
    criticalSoil: 35,
    tempRange: [22, 34],
    humidityRange: [60, 85],
    wateringHint: 'Pertahankan kelembapan tanah stabil dan hindari kekeringan mendadak.',
    aiGuidance: 'Berikan saran perawatan yang menekankan pertumbuhan organ vegetatif, stabilitas air, dan pemulihan daun.',
  },
  generatif: {
    phase: 'generatif',
    label: 'Fase Generatif',
    description: 'Tanaman memasuki pembungaan dan pembentukan hasil. Kontrol air lebih presisi agar bunga dan buah tidak terganggu.',
    soilRange: [50, 70],
    criticalSoil: 40,
    tempRange: [24, 32],
    humidityRange: [55, 80],
    wateringHint: 'Jaga air cukup, tetapi jangan sampai media terlalu becek agar fase berbunga tetap optimal.',
    aiGuidance: 'Berikan saran perawatan yang fokus pada pembungaan, pembentukan hasil, dan pengendalian stres air.',
  },
};

export function normalizePlantPhase(value: unknown): PlantPhase {
  return String(value || '').trim().toLowerCase() === 'generatif' ? 'generatif' : 'vegetatif';
}

export function getPlantPhaseProfile(value: unknown): PlantPhaseProfile {
  return PLANT_PHASE_PROFILES[normalizePlantPhase(value)];
}

export function getPhaseDefaults(value: unknown) {
  const profile = getPlantPhaseProfile(value);
  return {
    plant_phase: profile.phase,
    temp_threshold_low: profile.tempRange[0],
    temp_threshold_high: profile.tempRange[1],
    humidity_threshold_low: profile.humidityRange[0],
    humidity_threshold_high: profile.humidityRange[1],
    soil_threshold_low: profile.soilRange[0],
    soil_threshold_high: profile.soilRange[1],
    soil_threshold_critical: profile.criticalSoil,
    humidityRange: profile.humidityRange,
  };
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value.trim().replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  return `${Number(value).toFixed(1)}${suffix}`;
}

export function getPlantHealthSummary(input: {
  phase?: unknown;
  soilMoisture?: unknown;
  temperature?: unknown;
  weatherLabel?: unknown;
  rainChance?: unknown;
  soilLow?: unknown;
  soilHigh?: unknown;
  soilCritical?: unknown;
  tempLow?: unknown;
  tempHigh?: unknown;
}): PlantHealthSummary {
  const phase = normalizePlantPhase(input.phase);
  const profile = getPlantPhaseProfile(phase);

  const soil = toNumber(input.soilMoisture);
  const temperature = toNumber(input.temperature);
  const rainChance = toNumber(input.rainChance) ?? 0;
  const weatherLabel = String(input.weatherLabel || '').trim();

  const soilLow = toNumber(input.soilLow) ?? profile.soilRange[0];
  const soilHigh = toNumber(input.soilHigh) ?? profile.soilRange[1];
  const soilCritical = toNumber(input.soilCritical) ?? profile.criticalSoil;
  const tempLow = toNumber(input.tempLow) ?? profile.tempRange[0];
  const tempHigh = toNumber(input.tempHigh) ?? profile.tempRange[1];

  const alerts: PlantHealthSummary['alerts'] = [];
  let healthState: PlantHealthSummary['healthState'] = 'unknown';
  let healthLabel = 'Data belum lengkap';
  let healthDetail = 'Menunggu pembacaan sensor terbaru.';
  let statusTone: PlantHealthSummary['statusTone'] = 'warning';
  let statusLabel = 'Belum Terdeteksi';
  let recommendation = profile.wateringHint;

  const weatherLooksWet = /hujan|gerimis|mendung|berawan/i.test(weatherLabel) || rainChance >= 60;

  if (typeof soil === 'number') {
    if (soil <= soilCritical) {
      healthState = 'kritis';
      healthLabel = 'Kritis';
      healthDetail = `Kelembapan tanah ${formatNumber(soil, '%')} sudah berada di bawah batas kritis ${formatNumber(soilCritical, '%')}.`;
      statusTone = 'danger';
      statusLabel = 'Perlu Tindakan Cepat';
      recommendation = `Segera lakukan penyiraman terukur. ${profile.wateringHint}`;
      alerts.push({
        key: `soil-critical-${Math.round(soil * 10)}`,
        type: 'soil',
        message: `Kondisi kritis: kelembapan tanah ${formatNumber(soil, '%')} di bawah batas kritis ${formatNumber(soilCritical, '%')}.`,
        severity: 'danger',
        sendEmail: true,
        metadata: { phase, soil, soilCritical, soilLow, soilHigh },
      });
    } else if (soil < soilLow) {
      healthState = 'waspada';
      healthLabel = 'Waspada';
      healthDetail = `Kelembapan tanah ${formatNumber(soil, '%')} mulai turun di bawah batas bawah ${formatNumber(soilLow, '%')}.`;
      statusTone = 'warning';
      statusLabel = 'Perlu Pantauan';
      recommendation = `Tambahkan penyiraman bertahap sebelum tanah makin kering. ${profile.wateringHint}`;
      alerts.push({
        key: `soil-low-${Math.round(soil * 10)}`,
        type: 'soil',
        message: `Kelembapan tanah turun ke ${formatNumber(soil, '%')} di bawah batas bawah ${formatNumber(soilLow, '%')}.`,
        severity: 'warning',
        metadata: { phase, soil, soilCritical, soilLow, soilHigh },
      });
    } else if (soil > soilHigh + 8) {
      healthState = 'waspada';
      healthLabel = 'Waspada';
      healthDetail = `Kelembapan tanah ${formatNumber(soil, '%')} terlalu tinggi untuk fase ${profile.label.toLowerCase()}.`;
      statusTone = 'warning';
      statusLabel = 'Media Terlalu Basah';
      recommendation = 'Kurangi durasi atau frekuensi penyiraman agar akar tidak terlalu lembap.';
      alerts.push({
        key: `soil-high-${Math.round(soil * 10)}`,
        type: 'soil',
        message: `Kelembapan tanah ${formatNumber(soil, '%')} berada di atas batas nyaman fase tanaman.`,
        severity: 'warning',
        metadata: { phase, soil, soilCritical, soilLow, soilHigh },
      });
    } else {
      healthState = 'sehat';
      healthLabel = 'Sehat';
      healthDetail = `Kelembapan tanah ${formatNumber(soil, '%')} masih berada di dalam rentang fase ${profile.label.toLowerCase()}.`;
      statusTone = 'good';
      statusLabel = 'Normal';
      recommendation = `Kondisi air cukup stabil. ${profile.wateringHint}`;
    }
  }

  if (typeof temperature === 'number') {
    const below = temperature < tempLow;
    const above = temperature > tempHigh;
    if (below || above) {
      const isExtreme = temperature < tempLow - 4 || temperature > tempHigh + 4;
      const severity: PlantHealthSummary['alerts'][number]['severity'] = isExtreme ? 'danger' : 'warning';
      alerts.push({
        key: `temperature-${Math.round(temperature * 10)}`,
        type: 'temperature',
        message: `Suhu ${formatNumber(temperature, '°C')} berada di luar rentang fase ${profile.label.toLowerCase()} (${formatNumber(tempLow, '°C')}–${formatNumber(tempHigh, '°C')}).`,
        severity,
        sendEmail: isExtreme,
        metadata: { phase, temperature, tempLow, tempHigh },
      });

      if (isExtreme && healthState !== 'kritis') {
        healthState = 'waspada';
        healthLabel = 'Waspada';
        statusTone = 'warning';
        statusLabel = 'Suhu Ekstrem';
        healthDetail = `Suhu ${formatNumber(temperature, '°C')} cukup jauh dari rentang ideal fase tanaman.`;
      }
    }
  }

  if (weatherLooksWet) {
    alerts.push({
      key: `weather-${weatherLabel}-${Math.round(rainChance)}`,
      type: 'weather',
      message: `Prakiraan BMKG menunjukkan ${weatherLabel || 'mendung'} dengan peluang hujan ${Math.round(rainChance)}%.`,
      severity: 'warning',
      metadata: { rainChance, weatherLabel, phase },
    });
  }

  if (!alerts.length) {
    alerts.push({
      key: `phase-${phase}`,
      type: 'phase',
      message: `Fase ${profile.label} aktif. ${profile.wateringHint}`,
      severity: 'info',
      metadata: { phase, soilLow, soilHigh, soilCritical, tempLow, tempHigh },
    });
  }

  return {
    phase,
    phaseLabel: profile.label,
    phaseDescription: profile.description,
    recommendedSoilRange: [soilLow, soilHigh],
    recommendedTemperatureRange: [tempLow, tempHigh],
    healthState,
    healthLabel,
    healthDetail,
    statusTone,
    statusLabel,
    recommendation,
    alerts,
  };
}

export function formatRange(range: [number, number], suffix = '%') {
  return `${range[0]}${suffix}–${range[1]}${suffix}`;
}
