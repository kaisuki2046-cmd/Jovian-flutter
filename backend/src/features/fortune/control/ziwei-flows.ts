import AstrolabeExport from 'iztro/lib/astro/FunctionalAstrolabe.js';
import { withConfig } from 'iztro/lib/astro/config.js';
import { withLanguage } from 'iztro/lib/i18n/index.js';
import type { DestinyChartSnapshot } from '../../destiny';
import type { PreviewPeriod } from './fortune-preview';
import { lunarAtBeijing } from './fortune-calendar';

const engineVersion = '2.6.5';
const natalRules = 'standard-new-year-leap-split-late-zi-current-v1';
const version = 'fortune-ziwei-flow-v1';
const dayMs = 86_400_000;
const beijingOffset = 8 * 3_600_000;
const scopes = { day: 'daily', week: 'daily', month: 'monthly', year: 'yearly' } as const;
const config = {
  language: 'zh-CN', yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal',
  dayDivide: 'current', algorithm: 'default', mutagens: {}, brightness: {},
} as const;
export const ziweiFlowConfig = { ...config, fixLeap: true } as const;

// The pinned engine's CJS default is wrapped when imported directly by Node ESM.
const Astrolabe = typeof AstrolabeExport === 'function' ? AstrolabeExport
  : (AstrolabeExport as { default: typeof AstrolabeExport }).default;
type Horoscope = ReturnType<InstanceType<typeof Astrolabe>['horoscope']>;
type Scope = Pick<Horoscope['daily'], 'index' | 'name' | 'heavenlyStem' | 'earthlyBranch' | 'mutagen'>;
type Natal = DestinyChartSnapshot['ziwei']['rawResult'][number];

function restoreAstrolabe(natal: Natal) {
  // The engine has no 闲 grade. Preserve it in natal facts and leave the engine grade empty.
  return new Astrolabe({ ...natal, palaces: natal.palaces.map((palace) => ({
    ...palace, minorStars: palace.minorStars.map((star) => ({
      ...star, brightness: star.brightness === '闲' ? '' as const : star.brightness,
    })),
  })) });
}

function isCompatible(chart: DestinyChartSnapshot['ziwei']) {
  return chart.engineName === 'iztro' && chart.engineVersion === engineVersion && chart.rulesetVersion === natalRules;
}

function runZiwei<T>(calculate: () => T) {
  return withConfig(config, () => withLanguage(config.language, calculate));
}

function plainStars(stars: Horoscope['daily']['stars']) {
  return stars?.map(items => items.map(({ name, type, scope, brightness, mutagen }) =>
    ({ name, type, scope, brightness, mutagen })));
}

function fullScope<T extends Horoscope['daily']>(scope: T, natal: Natal) {
  const transformations = scope.mutagen.map((star, index) => ({
    kind: ['禄', '权', '科', '忌'][index], star,
    natalPalaceIndices: natal.palaces.filter(palace =>
      palace.majorStars.some(item => item.name === star) || palace.minorStars.some(item => item.name === star))
      .map(palace => palace.index),
  }));
  const stars = plainStars(scope.stars);
  return { ...scope, stars, transformations, palaces: natal.palaces.map(palace => ({
    index: palace.index, natalName: palace.name, flowName: scope.palaceNames[palace.index],
    stem: palace.heavenlyStem, branch: palace.earthlyBranch,
    natalStarIds: [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars].map(star => star.name),
    natalStars: [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]
      .map(({ name, type, brightness, mutagen }) => ({ name, type, brightness, mutagen })),
    movingStarIds: stars?.[palace.index]?.map(star => star.name),
    // These are annual positions, distinct from natal sui-qian stars.
    yearlySuiqianStar: 'yearlyDecStar' in scope ? (scope.yearlyDecStar as Horoscope['yearly']['yearlyDecStar']).suiqian12[palace.index] : undefined,
    yearlyJiangqianStar: 'yearlyDecStar' in scope ? (scope.yearlyDecStar as Horoscope['yearly']['yearlyDecStar']).jiangqian12[palace.index] : undefined,
    oppositeIndex: (palace.index + 6) % 12,
    triadIndices: [(palace.index + 4) % 12, (palace.index + 8) % 12],
  })) };
}

type WindowScope = 'decadal' | 'minor' | 'yearly' | 'monthly' | 'daily';

export function buildZiweiFactWindow(window: { start: number; end: number }, period: PreviewPeriod,
  snapshot?: DestinyChartSnapshot) {
  const chart = snapshot?.ziwei;
  if (!(Number.isSafeInteger(window.start) && Number.isSafeInteger(window.end)
    && window.end > window.start && window.end - window.start <= 368 * dayMs)) {
    throw new RangeError('Invalid Ziwei fact window');
  }
  const firstDay = Math.floor((window.start + beijingOffset) / dayMs) * dayMs - beijingOffset;
  const segments: Record<WindowScope, { start: number; end: number; date: string; lunarYear: number;
    lunarMonth: number; lunarDay: number; leap: boolean; boundary: string }[]> =
    { decadal: [], minor: [], yearly: [], monthly: [], daily: [] };
  let lastYear: number | undefined;
  let lastMonth = '';
  const take = (scope: WindowScope, item: typeof segments.daily[number], changed: boolean) => {
    const previous = segments[scope].at(-1);
    if (changed || !previous) segments[scope].push(item);
    else previous.end = item.end;
  };
  for (let day = firstDay; day < window.end; day += dayMs) {
    const lunar = lunarAtBeijing(day + 12 * 3_600_000) as ReturnType<typeof lunarAtBeijing>
      & { getYear(): number; getMonth(): number; getDay(): number };
    const lunarYear = lunar.getYear();
    const month = lunar.getMonth();
    const lunarDay = lunar.getDay();
    const date = new Date(day + beijingOffset).toISOString().slice(0, 10);
    const item = { start: Math.max(day, window.start), end: Math.min(day + dayMs, window.end), date,
      lunarYear, lunarMonth: Math.abs(month), lunarDay, leap: month < 0, boundary: '北京午夜' };
    const monthKey = lunarYear + ':' + month + ':' + (month < 0 && lunarDay > 15);
    take('yearly', { ...item, boundary: lastYear === undefined ? '展示窗口起点' : '农历新年' }, lastYear !== lunarYear);
    if (period !== 'year') take('monthly', { ...item, boundary: !lastMonth ? '展示窗口起点'
      : month < 0 && lunarDay === 16 ? '闰月第十六日' : '农历月初' }, lastMonth !== monthKey);
    if (period === 'week' || period === 'day') take('daily', item, true);
    lastYear = lunarYear;
    lastMonth = monthKey;
  }
  const calendar = { engineVersion, natalRules, config: ziweiFlowConfig, segments };
  if (!chart?.rawResult.length) return { status: 'missing', ...calendar } as const;
  if (!isCompatible(chart)) return { status: 'unsupported', ...calendar } as const;
  const candidates = runZiwei(() => chart.rawResult.map((natal, candidateId) => {
    try {
      const astrolabe = restoreAstrolabe(natal);
      const monthLists = new Map<number, ReturnType<typeof astrolabe.monthlyList>>();
      const scopes = (Object.keys(segments) as WindowScope[]).flatMap(scope => {
        const periods = scope === 'decadal' || scope === 'minor' ? segments.yearly : segments[scope];
        const output = periods.map(item => {
          const horoscope = astrolabe.horoscope(item.date, 6);
          const output = fullScope(scope === 'minor' ? horoscope.age : horoscope[scope], natal);
          let month;
          if (scope === 'monthly') {
            const list = monthLists.get(item.lunarYear) ?? astrolabe.monthlyList(item.lunarYear, true);
            monthLists.set(item.lunarYear, list);
            month = list.find(entry => entry.month === item.lunarMonth && entry.isLeapMonth === item.leap
              && entry.dayRange[0] <= item.lunarDay && item.lunarDay <= entry.dayRange[1]);
          }
          return { ...item, scope, output, age: horoscope.age.nominalAge,
            monthPart: month?.part, dayRange: month?.dayRange };
        });
        if (scope !== 'decadal') return output;
        const decadal: typeof output = [];
        for (const item of output) {
          const last = decadal.at(-1);
          const previous = last?.output;
          if (last && previous?.index === item.output.index && previous.name === item.output.name
            && previous.heavenlyStem === item.output.heavenlyStem && previous.earthlyBranch === item.output.earthlyBranch) {
            last.end = item.end;
          } else decadal.push(item);
        }
        return decadal;
      });
      const natalTransformations = natal.palaces.flatMap(palace => [...palace.majorStars, ...palace.minorStars]
        .filter(star => star.mutagen).map(star => ({ star: star.name, kind: star.mutagen,
          palaceIndex: palace.index, palaceName: palace.name, palaceStem: palace.heavenlyStem })));
      return { status: 'ready', candidateId, scopes, natalTransformations } as const;
    } catch {
      return { status: 'failed', candidateId } as const;
    }
  }));
  return { status: candidates.some(item => item.status === 'ready') ? 'ready' : 'failed',
    ...calendar, candidates } as const;
}

export function readZiweiCalculation(at: number, snapshot?: DestinyChartSnapshot) {
  const chart = snapshot?.ziwei;
  if (!chart?.rawResult.length) return { status: 'missing' } as const;
  if (!isCompatible(chart)) return { status: 'unsupported' } as const;
  const local = new Date(at + beijingOffset);
  const date = local.toISOString().slice(0, 10);
  const timeIndex = Math.floor((local.getUTCHours() + 1) / 2);
  const candidates = runZiwei(() => chart.rawResult.map((natal, candidateId) => {
    try {
      const astrolabe = restoreAstrolabe(natal);
      const horoscope = astrolabe.horoscope(date, timeIndex);
      const lunarYear = natal.rawDates.lunarDate.lunarYear + horoscope.age.nominalAge - 1;
      const scopes = {
        decadal: fullScope(horoscope.decadal, natal), age: fullScope(horoscope.age, natal),
        yearly: fullScope(horoscope.yearly, natal), monthly: fullScope(horoscope.monthly, natal),
        daily: fullScope(horoscope.daily, natal), hourly: fullScope(horoscope.hourly, natal),
      };
      return {
        status: 'ready', candidateId, natal, solarDate: horoscope.solarDate, lunarDate: horoscope.lunarDate,
        lunarYear, scopes,
        decades: astrolabe.decadalList().map(item => ({ ...item, stars: plainStars(item.stars) })),
        yearMonths: astrolabe.monthlyList(lunarYear).map(item => ({ ...item, stars: plainStars(item.stars) })),
      } as const;
    } catch {
      return { status: 'failed', candidateId, natal } as const;
    }
  }));
  return { status: candidates.some(candidate => candidate.status === 'ready') ? 'ready' : 'failed',
    version: 'fortune-ziwei-engine-output-v1', engineVersion, natalRules, at, date, timeIndex,
    timeKnown: snapshot?.timeKnown, candidates } as const;
}

function readScope(scope: Scope, palaces: Natal['palaces']) {
  const palace = palaces.find(item => item.index === scope.index);
  if (!palace) return null;
  return {
    name: scope.name, palace: palace.name, pillar: scope.heavenlyStem + scope.earthlyBranch,
    transformations: [...scope.mutagen],
  };
}

type Flow = NonNullable<ReturnType<typeof readScope>>;
type Interval = { id: string; start: number; end: number; flow: Flow; decadal: Flow | null };

export function buildZiweiFlows(window: { start: number; end: number }, period: PreviewPeriod, snapshot?: DestinyChartSnapshot) {
  const chart = snapshot?.ziwei;
  if (!chart?.rawResult.length) return { status: 'missing' } as const;
  if (!isCompatible(chart)) {
    return { status: 'unsupported' } as const;
  }
  if (!snapshot?.timeKnown || chart.rawResult.length !== 1) return { status: 'uncertain' } as const;

  try {
    if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end)
      || !(window.end > window.start) || window.end - window.start > 368 * dayMs) {
      throw new RangeError('Invalid Ziwei window');
    }
    const natal = chart.rawResult[0];
    const scale = scopes[period];
    const intervals: Interval[] = [];
    const astrolabe = restoreAstrolabe(natal);
    runZiwei(() => {
      const firstDay = Math.floor((window.start + beijingOffset) / dayMs) * dayMs - beijingOffset;
      const lastDay = firstDay + Math.floor((window.end - 1 - firstDay) / dayMs) * dayMs;
      function read(day: number) {
        const date = new Date(day + beijingOffset).toISOString().slice(0, 10);
        const horoscope = astrolabe.horoscope(date, 6);
        const flow = readScope(horoscope[scale], natal.palaces);
        if (!flow) throw new Error('Missing Ziwei flow palace');
        const decadal = readScope(horoscope.decadal, natal.palaces);
        return { flow, decadal, signature: JSON.stringify([flow, decadal]) };
      }
      let previousSignature = '';
      for (let day = firstDay; day <= lastDay;) {
        const { flow, decadal, signature } = read(day);
        let next = day + dayMs;
        if (scale === 'yearly' && day < lastDay) {
          // A 28-day chunk can contain at most one lunar new year. Find its exact Beijing date when present.
          let low = day;
          let high = Math.min(day + 28 * dayMs, lastDay);
          if (read(high).signature === signature) {
            next = high + dayMs;
          } else {
            while (high - low > dayMs) {
              const middle = low + Math.floor((high - low) / (2 * dayMs)) * dayMs;
              if (read(middle).signature === signature) low = middle;
              else high = middle;
            }
            next = high;
          }
        }
        const start = Math.max(day, window.start);
        const end = Math.min(next, window.end);
        const previous = intervals.at(-1);
        if (previous && signature === previousSignature) {
          previous.end = end;
        } else {
          intervals.push({ id: `ziwei:${scale}:${start}`, start, end, flow, decadal });
          previousSignature = signature;
        }
        day = next;
      }
    });
    return { status: 'ready', version, engineVersion, scale, intervals } as const;
  } catch {
    return { status: 'failed' } as const;
  }
}
