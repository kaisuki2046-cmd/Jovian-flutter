import { buildDisplayWindow, periodPolicyVersion } from './period-window';
import type { FortuneFactInput } from '../model/fortune-facts';

export const isoUtc = (at: number) => new Date(at).toISOString();
export const utcRange = (start: number, end: number) =>
  ({ startInstant: isoUtc(start), endInstantExclusive: isoUtc(end) });

export function buildFactTimeContext(input: FortuneFactInput, asOf: number, clockSource: 'server' | 'preview' | 'client') {
  if (!['day', 'week', 'month', 'year'].includes(input.periodType) || !Number.isSafeInteger(asOf)) {
    throw new RangeError('Invalid period or clock');
  }
  const { displayTimezone, periodType, targetPeriod, weekStartsOn = 1 } = input;
  if (typeof displayTimezone !== 'string' || !displayTimezone || /^[+-]/u.test(displayTimezone)) {
    throw new RangeError('Expected an IANA time zone');
  }
  const dateFormatter = new Intl.DateTimeFormat('sv-SE', {
    timeZone: displayTimezone, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const dateAt = (at: number) => dateFormatter.format(at);
  const options = { timeZone: displayTimezone, weekStartsOn };
  let anchor = asOf;
  if (targetPeriod) {
    const required = { year: ['year'], month: ['year', 'month'], week: ['weekStartDate'], day: ['date'] }[periodType];
    if (Object.keys(targetPeriod).length !== required.length || required.some(key => !Object.hasOwn(targetPeriod, key))) {
      throw new RangeError('Target fields do not match the period');
    }
    let date: string | undefined;
    if (periodType === 'day') date = targetPeriod.date;
    if (periodType === 'week') date = targetPeriod.weekStartDate;
    if (periodType === 'month' || periodType === 'year') {
      const year = targetPeriod.year;
      const month = periodType === 'month' ? targetPeriod.month : 1;
      if (typeof year !== 'number' || !Number.isInteger(year) || year < 1900 || year > 2099
        || typeof month !== 'number' || !Number.isInteger(month) || month < 1 || month > 12) {
        throw new RangeError('Invalid calendar year or month');
      }
      date = year + '-' + String(month).padStart(2, '0') + '-01';
    }
    if (typeof date !== 'string' || !/^(19|20)\d\d-\d\d-\d\d$/u.test(date)) throw new RangeError('Invalid civil date');
    const midday = Date.parse(date + 'T12:00:00Z');
    if (!Number.isFinite(midday) || isoUtc(midday).slice(0, 10) !== date) throw new RangeError('Invalid civil date');
    const matches = [midday, midday - 24 * 3_600_000, midday + 24 * 3_600_000].find(instant => dateAt(instant) === date);
    if (matches === undefined) throw new RangeError('Requested local date does not exist');
    anchor = matches;
    if (periodType === 'week' && dateAt(buildDisplayWindow(anchor, periodType, options).start) !== date) {
      throw new RangeError('Requested date is not the configured week start');
    }
  }
  const window = buildDisplayWindow(anchor, periodType, options);
  const referenceAt = asOf >= window.start && asOf < window.end ? asOf : window.start;
  return {
    clockSource, asOfUtc: isoUtc(asOf), serverAsOfUtc: clockSource === 'server' ? isoUtc(asOf) : undefined,
    referenceAt, displayTimezone, weekStartsOn, window, policy: periodPolicyVersion,
    displayWindow: { periodType, localStart: dateAt(window.start), localEndExclusive: dateAt(window.end),
      timezone: displayTimezone, instantRange: utcRange(window.start, window.end) },
  };
}
