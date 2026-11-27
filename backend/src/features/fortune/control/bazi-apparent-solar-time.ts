import { Body, EquatorFromVector, GeoVector, RotateVector, Rotation_EQJ_EQD, SiderealTime } from 'astronomy-engine';
import { lunarAtCivilClock } from './fortune-calendar';

const hourMs = 3_600_000;
const dayMs = 24 * hourMs;
export const fateClearSolarDayPolicy = 'fateclear-apparent-solar-23h-archive-longitude-v1';

export function apparentSolarEpoch(at: number, longitude: number) {
  const time = new Date(at);
  const equator = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(time), GeoVector(Body.Sun, time, true)));
  const utcHour = (at - Math.floor(at / dayMs) * dayMs) / hourMs;
  const difference = 12 + SiderealTime(time) - equator.ra - utcHour;
  const equationOfTime = difference - 24 * Math.floor((difference + 12) / 24);
  return at + (longitude / 15 + equationOfTime) * hourMs;
}

function solarBoundary(target: number, longitude: number) {
  const mean = target - longitude / 15 * hourMs;
  let low = Math.floor(mean - hourMs), high = Math.ceil(mean + hourMs);
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (apparentSolarEpoch(middle, longitude) >= target) high = middle;
    else low = middle;
  }
  return high;
}

export function fateClearSolarDays(window: { start: number; end: number }, longitude: number) {
  if (!Number.isFinite(longitude) || Math.abs(longitude) > 180) return [];
  let day = Math.floor((apparentSolarEpoch(window.start, longitude) + hourMs) / dayMs);
  let solarStart = solarBoundary(day * dayMs - hourMs, longitude);
  const days = [];
  while (solarStart < window.end) {
    const solarEnd = solarBoundary((day + 1) * dayMs - hourMs, longitude);
    const noon = day * dayMs + 12 * hourMs;
    const start = Math.max(window.start, solarStart), end = Math.min(window.end, solarEnd);
    if (start < end) days.push({ start, end, solarStart, solarEnd,
      solarDate: new Date(noon).toISOString().slice(0, 10), pillar: lunarAtCivilClock(noon).getDayInGanZhiExact() });
    day += 1;
    solarStart = solarEnd;
  }
  return days;
}
