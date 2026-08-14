export type WeatherLocationCategory = 'indonesia' | 'jateng' | 'semarang';

export type WeatherLocationLevel = 'country' | 'province' | 'city' | 'district' | 'village';

export interface WeatherLocation {
  code: string;
  label: string;
  province: string;
  city: string;
  district?: string;
  village?: string;
  category: WeatherLocationCategory;
  level: WeatherLocationLevel;
  parentCode?: string;
  ready?: boolean;
}

export interface WeatherLocationGroup {
  group: string;
  items: WeatherLocation[];
}

export interface WeatherLocationCategoryOption {
  id: WeatherLocationCategory;
  label: string;
  description: string;
}
