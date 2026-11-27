export type BirthDate = { year: number; month: number; day: number };
export type BirthTime =
  | { timeKnown: true; hour: number; minute: number }
  | { timeKnown: false; hour: number; minute: null }
  | { timeKnown: false; hour: null; minute: number | null };

export type BirthPlace = {
  id: string;
  name: string;
  countryCode: string;
  country: string;
  region: string;
  city: string;
  district?: string;
  adminCode?: string;
  latitude: number;
  longitude: number;
  timeZone: string;
};

export const genderLabels = { female: '女', male: '男', other: '其他' } as const;
export type Gender = keyof typeof genderLabels;
export const birthGenderOptions = ['female', 'male'] as const satisfies readonly Gender[];
export type BirthGenderOption = typeof birthGenderOptions[number];

export function isBirthGenderOption(gender: Gender | null | undefined): gender is BirthGenderOption {
  return birthGenderOptions.some((option) => option === gender);
}

export type BirthProfile = {
  date: BirthDate;
  time: BirthTime;
  place: BirthPlace;
  gender: Gender;
};

export const firstBirthYear = 1900;
export const unknownBirthTime: BirthTime = { timeKnown: false, hour: null, minute: null };

export function birthTimeFromParts(hour: number | null, minute: number | null): BirthTime {
  if (hour === null) return { timeKnown: false, hour, minute };
  if (minute === null) return { timeKnown: false, hour, minute };
  return { timeKnown: true, hour, minute };
}

export function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isBirthDate(date: BirthDate, today = new Date()) {
  const { year, month, day } = date;
  return Number.isInteger(year) && year >= firstBirthYear && year <= today.getFullYear()
    && Number.isInteger(month) && month >= 1 && month <= 12
    && Number.isInteger(day) && day >= 1 && day <= daysInMonth(year, month)
    && Date.UTC(year, month - 1, day) <= Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
}

export function isBirthTime(time: BirthTime | null): time is BirthTime {
  if (!time) return false;
  const { hour, minute } = time;
  return time.timeKnown === (hour !== null && minute !== null)
    && (hour === null || Number.isInteger(hour) && hour >= 0 && hour < 24)
    && (minute === null || Number.isInteger(minute) && minute >= 0 && minute < 60);
}

// GeoNames WGS84 representative points, translated and rounded for this local catalog.
export const birthPlaces: readonly BirthPlace[] = [
  { id: '1816670', name: '中国 · 北京市', countryCode: 'CN', country: '中国', region: '北京市', city: '北京', latitude: 39.907, longitude: 116.397, timeZone: 'Asia/Shanghai' },
  { id: '1796236', name: '中国 · 上海市', countryCode: 'CN', country: '中国', region: '上海市', city: '上海', latitude: 31.222, longitude: 121.458, timeZone: 'Asia/Shanghai' },
  { id: '1809858', name: '中国 · 广东省 · 广州市', countryCode: 'CN', country: '中国', region: '广东省', city: '广州市', latitude: 23.117, longitude: 113.25, timeZone: 'Asia/Shanghai' },
  { id: '1795565', name: '中国 · 广东省 · 深圳市', countryCode: 'CN', country: '中国', region: '广东省', city: '深圳市', adminCode: '4403', latitude: 22.546, longitude: 114.068, timeZone: 'Asia/Shanghai' },
  { id: 'CN-440307', name: '中国 · 广东省 · 深圳市 · 龙岗区', countryCode: 'CN', country: '中国', region: '广东省', city: '深圳市', district: '龙岗区', adminCode: '440307', latitude: 22.672, longitude: 114.255, timeZone: 'Asia/Shanghai' },
  { id: '5128581', name: '美国 · 纽约州 · 纽约市', countryCode: 'US', country: '美国', region: '纽约州', city: '纽约市', adminCode: 'NY', latitude: 40.714, longitude: -74.006, timeZone: 'America/New_York' },
  { id: '2643743', name: '英国 · 英格兰 · 伦敦', countryCode: 'GB', country: '英国', region: '英格兰', city: '伦敦', latitude: 51.509, longitude: -0.126, timeZone: 'Europe/London' },
];
