import { Solar } from 'lunar-javascript';
import type { FortuneCalendar, FortuneReference, FourPillars } from '../model/fortune-calendar';

const minuteMs = 60_000;
const hourMs = 60 * minuteMs;
const dayMs = 24 * hourMs;
const beijingOffset = 8 * hourMs;

export function fortuneReferenceFields(instant: number): FortuneReference {
  const local = new Date(instant + beijingOffset).toISOString();
  return { date: local.slice(0, 10), time: local.slice(11, 16) };
}

export function lunarAtBeijing(instant: number) {
  return lunarAtCivilClock(instant + beijingOffset);
}

export function lunarAtCivilClock(wallTime: number) {
  const local = new Date(wallTime);
  const lunar = Solar.fromYmdHms(
    local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate(),
    local.getUTCHours(), local.getUTCMinutes(), local.getUTCSeconds(),
  ).getLunar();
  return lunar as typeof lunar & { getYear(): number };
}

function pillarsAt(instant: number): FourPillars {
  const lunar = lunarAtBeijing(instant);
  // The installed library exposes a separate midnight day-pillar API for sect 2.
  const sectTwoLunar = lunar as typeof lunar & { getDayInGanZhiExact2(): string };
  return {
    year: lunar.getYearInGanZhiExact(),
    month: lunar.getMonthInGanZhiExact(),
    day: sectTwoLunar.getDayInGanZhiExact2(),
    hour: lunar.getTimeInGanZhi(),
  };
}

export function calculateFortuneCalendar(fields: FortuneReference): FortuneCalendar | null {
  const date = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(fields.date.trim());
  const time = /^([01]\d|2[0-3]):([0-5]\d)$/u.exec(fields.time.trim());
  if (!date || !time) return null;
  const [year, month, day] = date.slice(1).map(Number);
  const [hour, minute] = time.slice(1).map(Number);
  if (year < 1900 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) return null;

  const localDay = new Date(Date.UTC(year, month - 1, day));
  if (localDay.getUTCDate() !== day) return null;
  const dayStart = localDay.getTime() - beijingOffset;
  const monday = dayStart - ((localDay.getUTCDay() + 6) % 7) * dayMs;
  const referenceAt = dayStart + hour * hourMs + minute * minuteMs;
  const actionAt = dayStart + (hour + 1) * hourMs;

  return {
    referencePillars: pillarsAt(referenceAt),
    actionPillars: pillarsAt(actionAt),
    windows: [
      { period: 'year', periodStart: Date.UTC(year, 0, 1) - beijingOffset, start: referenceAt,
        end: Date.UTC(year + 1, 0, 1) - beijingOffset },
      { period: 'month', periodStart: Date.UTC(year, month - 1, 1) - beijingOffset, start: referenceAt,
        end: Date.UTC(year, month, 1) - beijingOffset },
      { period: 'week', periodStart: monday, start: referenceAt, end: monday + 7 * dayMs },
      { period: 'day', periodStart: dayStart, start: referenceAt, end: dayStart + dayMs },
      { period: 'hour', periodStart: actionAt, start: actionAt, end: actionAt + hourMs },
    ],
  };
}
