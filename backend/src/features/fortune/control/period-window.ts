import type { FortuneWindow } from '../model/fortune-calendar';

export type PreviewPeriod = Exclude<FortuneWindow['period'], 'hour'>;
export type DisplayTime = { timeZone: string; weekStartsOn?: number };

const hourMs = 3_600_000;
const dayMs = 24 * hourMs;
export const periodPolicyVersion = 'fortune-iana-civil-v1';

export function deviceDisplayTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function zonedFormatter(timeZone: string) {
  // Intl also accepts fixed UTC offsets on newer engines. Display preferences require IANA IDs.
  if (!timeZone || /^[+-]/u.test(timeZone)) throw new RangeError('Expected an IANA display time zone');
  return new Intl.DateTimeFormat('en-GB', {
    timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
  });
}

function localEpoch(formatter: Intl.DateTimeFormat, instant: number) {
  const parts = Object.fromEntries(formatter.formatToParts(instant).map(({ type, value }) => [type, Number(value)]));
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

export function civilClockEpoch(instant: number, timeZone: string) {
  return localEpoch(zonedFormatter(timeZone), instant);
}

function startOfCivilDay(formatter: Intl.DateTimeFormat, midnight: number) {
  // Check both offsets at a fall-back overlap and choose the first matching midnight.
  const exact: number[] = [];
  for (let sample = midnight - 36 * hourMs; sample <= midnight + 36 * hourMs; sample += 6 * hourMs) {
    const candidate = midnight - (localEpoch(formatter, sample) - sample);
    if (localEpoch(formatter, candidate) === midnight) exact.push(candidate);
  }
  if (exact.length) return Math.min(...exact);

  // In a midnight gap, or on a skipped civil day, the next representable instant is the boundary.
  let low = midnight - 36 * hourMs;
  let high = midnight + 36 * hourMs;
  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2000) * 1000;
    if (localEpoch(formatter, middle) < midnight) low = middle;
    else high = middle;
  }
  return high;
}

export function buildDisplayWindow(asOf: number, period: PreviewPeriod, {
  timeZone, weekStartsOn = 1,
}: DisplayTime = { timeZone: deviceDisplayTimezone() }) {
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) {
    throw new RangeError('Expected a week start from Sunday (0) through Saturday (6)');
  }
  const formatter = zonedFormatter(timeZone);
  const date = new Date(localEpoch(formatter, asOf));
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const today = Date.UTC(year, month, day);
  const weekStart = today - ((date.getUTCDay() + 7 - weekStartsOn) % 7) * dayMs;
  const dates = {
    day: [today, today + dayMs],
    week: [weekStart, weekStart + 7 * dayMs],
    month: [Date.UTC(year, month, 1), Date.UTC(year, month + 1, 1)],
    year: [Date.UTC(year, 0, 1), Date.UTC(year + 1, 0, 1)],
  }[period];
  return { start: startOfCivilDay(formatter, dates[0]), end: startOfCivilDay(formatter, dates[1]) };
}
