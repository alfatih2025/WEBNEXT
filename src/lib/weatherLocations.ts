import type {
  WeatherLocation,
  WeatherLocationCategory,
  WeatherLocationCategoryOption,
  WeatherLocationGroup,
} from '../types/weather';
import { JAWA_TENGAH } from '../data/weatherLocations/jateng';
import { SEMARANG_KECAMATAN, SEMARANG_DISTRICT_MAP } from '../data/weatherLocations/semarang';

export type WeatherLocationOption = WeatherLocation;

export const WEATHER_LOCATION_OPTIONS: WeatherLocationOption[] = [...JAWA_TENGAH, ...SEMARANG_KECAMATAN];

export const WEATHER_LOCATION_CATEGORIES: WeatherLocationCategoryOption[] = [
  {
    id: 'jateng',
    label: 'Jawa Tengah',
    description: 'Kota-kota utama di Jawa Tengah',
  },
  {
    id: 'semarang',
    label: 'Semarang',
    description: 'Kecamatan dan kelurahan Kota Semarang',
  },
];

export const WEATHER_LOCATION_GROUPS: WeatherLocationGroup[] = [
  {
    group: 'Jawa Tengah',
    items: JAWA_TENGAH,
  },
  {
    group: 'Semarang',
    items: SEMARANG_KECAMATAN,
  },
] as const;

export const DEFAULT_WEATHER_LOCATION_CODE = '33.74.07.1010';

const LEGACY_WEATHER_LOCATION_CODE_MAP: Record<string, string> = {
  '33.22.07': '33.74.01.1001',
};

const ADM4_PATTERN = /^\d{2}(?:\.\d{2}){1,2}(?:\.\d{1,4})?$/;
const SEMARANG_VILLAGE_PATTERN = /^33\.74\.\d{2}\.\d{4}$/;

function normalizeText(value: unknown) {
  return String(value ?? '').trim();
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => normalizeText(value)).filter(Boolean)));
}

function resolveSyntheticSemarangLocation(code: string): WeatherLocation | null {
  if (SEMARANG_VILLAGE_PATTERN.test(code)) {
    const districtCode = code.slice(0, 8);
    const districtLabel = SEMARANG_DISTRICT_MAP[districtCode] || 'Semarang';
    const village = code.slice(9);
    return {
      code,
      label: village,
      province: 'Jawa Tengah',
      city: 'Kota Semarang',
      district: districtLabel,
      village,
      category: 'semarang',
      level: 'village',
      parentCode: districtCode,
      ready: true,
    };
  }

  if (/^33\.74\.\d{2}$/.test(code)) {
    const districtLabel = SEMARANG_DISTRICT_MAP[code];
    if (!districtLabel) return null;
    return {
      code,
      label: districtLabel,
      province: 'Jawa Tengah',
      city: 'Kota Semarang',
      district: districtLabel,
      category: 'semarang',
      level: 'district',
      parentCode: '33.74',
      ready: true,
    };
  }

  if (code === '33.74') {
    return {
      code,
      label: 'Kota Semarang',
      province: 'Jawa Tengah',
      city: 'Kota Semarang',
      category: 'semarang',
      level: 'city',
      ready: true,
    };
  }

  return null;
}

export function isValidWeatherLocationCode(value: string) {
  return ADM4_PATTERN.test(normalizeText(value));
}

export function normalizeWeatherLocationCode(value: unknown) {
  const raw = normalizeText(value);
  if (raw && LEGACY_WEATHER_LOCATION_CODE_MAP[raw]) {
    return LEGACY_WEATHER_LOCATION_CODE_MAP[raw];
  }
  return isValidWeatherLocationCode(raw) ? raw : DEFAULT_WEATHER_LOCATION_CODE;
}

export function getWeatherLocationByCode(code: unknown) {
  const normalized = normalizeText(code);
  return WEATHER_LOCATION_OPTIONS.find((item) => item.code === normalized) ?? resolveSyntheticSemarangLocation(normalized);
}

export function formatWeatherLocationPath(location: WeatherLocation | null | undefined) {
  if (!location) return '';

  const trail = [
    location.village || (location.level === 'village' ? location.label : ''),
    location.district || (location.level === 'district' ? location.label : ''),
    location.city,
    location.province,
  ].filter(Boolean);

  return Array.from(new Set(trail)).join(' • ');
}

export function resolveWeatherLocationLabel(code: unknown) {
  const item = getWeatherLocationByCode(code);
  if (!item) return `Lokasi BMKG ${normalizeText(code) || DEFAULT_WEATHER_LOCATION_CODE}`;

  const path = formatWeatherLocationPath(item);
  return path ? `${path} (${item.code})` : `${item.label} (${item.code})`;
}

export function resolveWeatherLocationPath(code: unknown) {
  const item = getWeatherLocationByCode(code);
  if (!item) return normalizeText(code) || DEFAULT_WEATHER_LOCATION_CODE;
  return formatWeatherLocationPath(item) || item.label || item.code;
}

export function resolveWeatherLocationDisplayName(code: unknown) {
  return resolveWeatherLocationPath(code);
}

export function getWeatherLocationsByCategory(category: WeatherLocationCategory) {
  return WEATHER_LOCATION_OPTIONS.filter((item) => item.category === category);
}

export function getWeatherLocationProvinces(category: WeatherLocationCategory) {
  return uniqueStrings(getWeatherLocationsByCategory(category).map((item) => item.province));
}

export function getWeatherLocationCities(category: WeatherLocationCategory, province: string) {
  return uniqueStrings(
    getWeatherLocationsByCategory(category)
      .filter((item) => item.province === province)
      .map((item) => item.city),
  );
}

export function getWeatherLocationDistricts(category: WeatherLocationCategory, province: string, city: string) {
  return uniqueStrings(
    getWeatherLocationsByCategory(category)
      .filter((item) => item.province === province && item.city === city)
      .map((item) => item.district || (item.level === 'district' ? item.label : '')),
  );
}

export function getWeatherLocationVillages(
  category: WeatherLocationCategory,
  province: string,
  city: string,
  district: string,
) {
  return getWeatherLocationsByCategory(category).filter(
    (item) =>
      item.province === province &&
      item.city === city &&
      item.district === district &&
      item.level === 'village',
  );
}

export function getWeatherLocationItemByPath(
  category: WeatherLocationCategory,
  province: string,
  city: string,
  district?: string,
) {
  const items = getWeatherLocationsByCategory(category).filter(
    (item) => item.province === province && item.city === city,
  );

  if (district) {
    const village = items.find((item) => item.level === 'village' && item.district === district);
    if (village) return village;

    const districtItem = items.find((item) => item.level === 'district' && (item.district || item.label) === district);
    if (districtItem) return districtItem;
  }

  return (
    items.find((item) => item.level === 'city') ||
    items.find((item) => item.level === 'district') ||
    items[0] ||
    null
  );
}

export function buildBmkgWeatherUrl(baseUrl: string, locationCode?: string) {
  const normalizedCode = normalizeWeatherLocationCode(locationCode);
  const fallback = `/api/weather?location=${encodeURIComponent(normalizedCode)}`;

  if (!baseUrl?.trim()) return fallback;

  try {
    const url = new URL(baseUrl, typeof window === 'undefined' ? 'https://example.com' : window.location.origin);
    url.searchParams.set('adm4', normalizedCode);
    return url.origin === 'https://example.com' ? url.pathname + url.search + url.hash : url.toString();
  } catch {
    const separator = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${separator}adm4=${encodeURIComponent(normalizedCode)}`;
  }
}
