import * as LunarPackage from 'lunar-javascript';
import { astro } from 'iztro';
import type { DestinyChartSnapshot } from '../../destiny';
import type { PreviewPeriod } from './period-window';
import { lunarAtBeijing } from './fortune-calendar';
import { quanshuVerifiedBoshiPosition } from './ziwei-kongjie-limits';
import { quanshuKongJiePositions } from './ziwei-kongjie';
import { quanshuBirthAnchoredMajorPositions } from './ziwei-birth-major-anchor';
import { quanshuLifeBureau } from './ziwei-growth-stages';
import { quanshuLuYangTuo, readQuanshuNatal } from './ziwei-quanshu';

type Natal = DestinyChartSnapshot['ziwei']['rawResult'][number];
type Scope = 'monthly' | 'daily';
type Decade = { start: number; end: number; stem: string; branch: string };
const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const names = ['命宫', '父母', '福德', '田宅', '官禄', '仆役', '迁移', '疾厄', '财帛', '子女', '夫妻', '兄弟'];
const majorStars = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
const wealthStars = ['紫微', '天府', '武曲', '太阴', '禄存'];
const financePalaceStars = [...majorStars, '文昌', '文曲', '左辅', '右弼', '天魁', '天钺'];
const financeShaStars = ['天空', '地劫', '擎羊', '陀罗', '火星', '铃星'];
const transformationStars = [...majorStars, '文昌', '文曲', '左辅', '右弼'];
const verifiedLeapStars = [...financePalaceStars, '禄存', '擎羊', '陀罗', '火星', '铃星', '地劫'];
const mod = (n: number, length = 12) => (n % length + length) % length;
const dayMs = 86_400_000, hourMs = 3_600_000, offset = 8 * hourMs;
const validStem = (s: string) => s.length === 1 && stems.includes(s);
const validBranch = (s: string) => s.length === 1 && branches.includes(s);
const starNames = (p: Natal['palaces'][number]) => [...new Set([...p.majorStars, ...p.minorStars, ...p.adjectiveStars].map(s => String(s.name)))];
const table = [
  ['廉贞', '破军', '武曲', '太阳'], ['天机', '天梁', '紫微', '太阴'],
  ['天同', '天机', '文昌', '廉贞'], ['太阴', '天同', '天机', '巨门'],
  ['贪狼', '太阴', '右弼', '天机'], ['武曲', '贪狼', '天梁', '文曲'],
  ['太阳', '武曲', '天府', '天同'], ['巨门', '太阳', '文曲', '文昌'],
  ['天梁', '紫微', '左辅', '武曲'], ['破军', '巨门', '太阴', '贪狼'],
];
export const yunZiweiPolicy = {
  profile: 'yun-official-v3-lunar-sequence-v1', table: 'yun-geng-tianfu-ke-minor-lu-ji-v1',
  nominalLeapBirthFinanceProfile: 'yun-official-v3-nominal-leap-birth-month-finance-v1',
  nominalLeapBirthLayerProof: 'yun-verified-nominal-intercalary-star-layers-v1',
  calendar: 'lunar-new-year-and-lunar-month-first-day-civil-midnight',
  monthStem: 'five-tigers-named-lunar-month-repeat-in-leap-month-not-jie',
  monthPalace: 'doujun-plus-ordinal-including-whole-leap-month-no-half-month-split',
  dayPalace: 'lunar-month-palace-plus-lunar-day-minus-one',
  dayClocks: 'published-midnight-and-zi-start-daily-witnesses-v1',
  timingStatus: 'same-month-day-clock-comparison-month-boundary-and-birth-leap-unresolved',
  natalBasis: 'compatible-archive-geometry-checked-against-official-synthetic-example',
  wealth: 'explicit-source-star-set-plus-lu-and-palace-context-no-automatic-score',
  dailyWealth: 'named-wealth-or-local-month-day-lu-with-separate-same-recipient-month-day-ji',
  dailyReading: 'located-recipients-and-month-day-finance-seats-v1',
  dailyFinanceRoles: 'named-star-palace-and-lu-qualification-v1',
  yearFinanceAxis: 'annual-wealth-fortune-or-children-property-endpoints-with-year-and-month-contacts',
  monthFinance: 'same-seat-upper-support-and-independently-qualified-finance-star-v1',
  monthFinanceArea: 'located-finance-stars-and-separate-positive-taboo-sha-v1',
  sunJiCase: '2014-ordinary-and-intercalary-ninth-months-with-the-same-verified-upper-limits',
  financeSha: 'published-six-sha-unique-archived-natal-placements',
  propertySha: 'yun-checked-natal-tianxing-qingyang-and-separate-dahao-v1',
} as const;

export function yunTransformations(stem: string, minor = false) {
  if (!validStem(stem)) throw new RangeError('Invalid Yun stem');
  return table[stems.indexOf(stem)].flatMap((star, i) => minor && (i === 1 || i === 2) ? [] : [{ star, kind: ['禄', '权', '科', '忌'][i] }]);
}
export function yunMonthPillar(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) throw new RangeError('Invalid Yun lunar month');
  const yearStem = mod(year - 4, 10);
  return stems[(yearStem % 5 * 2 + 2 + month - 1) % 10] + branches[(month + 1) % 12];
}
export function yunLifeBranch(yearBranch: string, birthMonth: number, birthHour: string, monthOrdinal: number, lunarDay = 1) {
  if (!validBranch(yearBranch) || !validBranch(birthHour) || !Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12
    || !Number.isInteger(monthOrdinal) || monthOrdinal < 0 || monthOrdinal > 12 || !Number.isInteger(lunarDay) || lunarDay < 1 || lunarDay > 30) throw new RangeError('Invalid Yun palace basis');
  return branches[mod(branches.indexOf(yearBranch) - birthMonth + 1 + branches.indexOf(birthHour) + monthOrdinal + lunarDay - 1)];
}
export function yunPalaceName(lifeBranch: string, palaceBranch: string) {
  if (!validBranch(lifeBranch) || !validBranch(palaceBranch)) throw new RangeError('Invalid Yun palace branch');
  return names[mod(branches.indexOf(palaceBranch) - branches.indexOf(lifeBranch))];
}

function agreesWithNominalLeapChart(natal: Natal, hour: string) {
  const date = natal.rawDates.lunarDate;
  const solar = typeof natal.solarDate === 'string' && natal.solarDate.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  // Zi-hour births remain excluded until the source birth-date boundary is verified.
  if (!solar || hour === '子' || (natal.gender !== '男' && natal.gender !== '女')) return false;
  const dateStr = solar[1] + '-' + solar[2].padStart(2, '0') + '-' + solar[3].padStart(2, '0');
  const civilNoon = Date.parse(dateStr + 'T12:00:00+08:00');
  if (!Number.isFinite(civilNoon) || new Date(civilNoon).toISOString().slice(0, 10) !== dateStr) return false;
  const lunar = lunarAtBeijing(civilNoon) as Calendar;
  if (lunar.getYear() !== date.lunarYear || lunar.getMonth() !== -date.lunarMonth || lunar.getDay() !== date.lunarDay) return false;

  const expected = astro.withOptions({ dateStr, timeIndex: branches.indexOf(hour), gender: natal.gender, fixLeap: false, language: 'zh-CN',
    config: { yearDivide: 'normal', horoscopeDivide: 'normal', ageDivide: 'normal', dayDivide: 'current', algorithm: 'default' },
  }).toJSON();
  const archived = natal.palaces.flatMap(palace => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars].map(star => star.name));
  if (verifiedLeapStars.some(star => archived.filter(name => name === star).length !== 1)) return false;
  return expected.palaces.every(palace => {
    const actual = natal.palaces.find(seat => seat.earthlyBranch === palace.earthlyBranch)!;
    return actual.name === palace.name && actual.heavenlyStem === palace.heavenlyStem && actual.isBodyPalace === palace.isBodyPalace
      && mod(actual.ages[0]) === mod(palace.ages[0])
      && actual.decadal?.range?.[0] === palace.decadal.range[0] && actual.decadal?.range?.[1] === palace.decadal.range[1]
      && actual.decadal?.heavenlyStem === palace.decadal.heavenlyStem && actual.decadal?.earthlyBranch === palace.decadal.earthlyBranch
      && (['majorStars', 'minorStars', 'adjectiveStars'] as const).every(layer => {
        const actualStars = new Set<string>(actual[layer].map(star => star.name));
        const expectedStars = new Set<string>(palace[layer].map(star => star.name));
        return verifiedLeapStars.every(star => actualStars.has(star) === expectedStars.has(star));
      });
  });
}

function readNatal(natal: Natal) {
  const date = natal.rawDates?.lunarDate, chinese = natal.rawDates?.chineseDate;
  if (!date || !Number.isInteger(date.lunarYear) || !Number.isInteger(date.lunarMonth) || date.lunarMonth < 1 || date.lunarMonth > 12
    || !Number.isInteger(date.lunarDay) || date.lunarDay < 1 || date.lunarDay > 30
    || typeof date.isLeap !== 'boolean' || !Array.isArray(natal.palaces) || natal.palaces.length !== 12
    || new Set(natal.palaces.map(p => p.index)).size !== 12 || new Set(natal.palaces.map(p => p.earthlyBranch)).size !== 12
    || natal.palaces.some(p => !Number.isInteger(p.index) || p.index < 0 || p.index > 11 || branches[mod(p.index + 2)] !== p.earthlyBranch
      || ![p.majorStars, p.minorStars, p.adjectiveStars, p.ages].every(Array.isArray))) return undefined;
  const hour = chinese?.hourly?.[1], birthStem = chinese?.yearly?.[0];
  if (!hour || !birthStem || !validBranch(hour) || !validStem(birthStem) || stems[mod(date.lunarYear - 4, 10)] !== birthStem) return undefined;
  const life = branches[mod(2 + date.lunarMonth - 1 - branches.indexOf(hour))];
  if (natal.palaces.some(p => yunPalaceName(life, p.earthlyBranch) !== p.name)) return undefined;
  const required = [...transformationStars, '禄存', '擎羊', '陀罗', '地劫'];
  if (required.some(star => natal.palaces.flatMap(p => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars]).filter(s => s.name === star).length !== 1)
    || natal.palaces.some(p => !validStem(p.heavenlyStem))) return undefined;
  if (natal.palaces.some(p => !p.ages.length || p.ages.some(age => !Number.isInteger(age) || age < 1 || mod(age - p.ages[0]) !== 0))
    || new Set(natal.palaces.map(p => mod(p.ages[0]))).size !== 12) return undefined;
  if (date.isLeap && !agreesWithNominalLeapChart(natal, hour)) return undefined;
  return { birthYear: date.lunarYear, birthMonth: date.lunarMonth, birthHour: hour, birthStem, leap: date.isLeap };
}
const lunarCalendar = LunarPackage as unknown as {
  LunarYear: { fromYear(year: number): { getMonthsInYear(): { getMonth(): number }[] } };
  Lunar: { fromYmd(year: number, month: number, day: number): { getSolar(): { toYmd(): string } } };
};
type Calendar = ReturnType<typeof lunarAtBeijing> & { getYear(): number; getMonth(): number; getDay(): number; getDayInGanZhiExact2(): string };
type DayClock = 'agreed' | 'civil-midnight' | 'zi-start';
type Frame = { start: number; end: number; scope: Scope; lunarYear: number; lunarMonth: number; lunarDay?: number; leap: boolean;
  monthOrdinal: number; monthPillar: string; sourceStem: string; lifeBranch: string; yearBranch: string; yearStem: string;
  sourceDayClock?: DayClock; dayMonthBasisAgreed?: boolean;
  monthLifeBranch: string; minorLifeBranch: string; minorStem: string; decadeLifeBranch?: string; decadeStem?: string; nominalAge: number;
  financeMonthEnd?: number };

function yunFinancePalaceScopes(frame: Frame, palace: { branch: string; natalName: string; yearlyName: string; monthlyName: string; dailyName?: string }) {
  return [
    ...(palace.natalName === '财帛' ? ['natal'] : []),
    ...(frame.decadeLifeBranch && yunPalaceName(frame.decadeLifeBranch, palace.branch) === '财帛' ? ['decadal'] : []),
    ...(palace.yearlyName === '财帛' ? ['yearly'] : []),
    ...(palace.monthlyName === '财帛' ? ['monthly'] : []),
    ...(palace.dailyName === '财帛' ? ['daily'] : []),
  ];
}

export function yunSunJiCaseWindow() {
  const lunarYear = 2014;
  const [start, transition, end] = [9, -9, 10].map(month => Date.parse(
    lunarCalendar.Lunar.fromYmd(lunarYear, month, 1).getSolar().toYmd() + 'T00:00:00+08:00'));
  return { lunarYear, start, transition, end };
}

export function yunSunJiCaseEvidence(rows: ReturnType<typeof buildYunZiweiWindow>['rows'], window: ReturnType<typeof yunSunJiCaseWindow>) {
  const [ordinary, intercalary] = rows;
  if (rows.length !== 2 || !ordinary || !intercalary || ordinary.leap || !intercalary.leap
    || rows.some(row => row.profile !== yunZiweiPolicy.profile)
    || ordinary.start !== window.start || ordinary.end !== window.transition
    || intercalary.start !== window.transition || intercalary.end !== window.end
    || ordinary.yearBranch !== intercalary.yearBranch || ordinary.yearStem !== intercalary.yearStem
    || ordinary.decadeLifeBranch !== intercalary.decadeLifeBranch || ordinary.decadeStem !== intercalary.decadeStem
    || ordinary.minorLifeBranch !== intercalary.minorLifeBranch || ordinary.minorStem !== intercalary.minorStem
    || !rows.every(row => row.scope === 'monthly' && row.lunarYear === window.lunarYear && row.lunarMonth === 9
      && row.decadeLifeBranch !== undefined && yunPalaceName(row.decadeLifeBranch, row.yearBranch) === '官禄')) {
    return undefined;
  }
  const upperScopes = ['decadal', 'yearly', 'minor'] as const;
  function occurrence(row: YunRow, sourceScope: typeof upperScopes[number] | 'monthly') {
    const sourceStem = { decadal: row.decadeStem, yearly: row.yearStem, minor: row.minorStem, monthly: row.monthPillar[0] }[sourceScope];
    const contacts = row.contacts.filter(contact => contact.sourceScope === sourceScope && contact.star === '太阳'
      && contact.kind === '忌');
    if (!sourceStem || contacts.length !== 1 || contacts[0].sourceStem !== sourceStem || contacts[0].branch !== row.yearBranch) return undefined;
    return { sourceScope, sourceStem, star: '太阳', branch: row.yearBranch };
  }
  const upper = upperScopes.flatMap(scope => {
    const first = occurrence(ordinary, scope);
    const second = occurrence(intercalary, scope);
    return first && second && first.sourceStem === second.sourceStem ? [first] : [];
  });
  const months = rows.flatMap(row => {
    const monthly = occurrence(row, 'monthly');
    if (!monthly || row.financeMonthEnd === undefined || row.financeMonthEnd <= row.start || row.financeMonthEnd >= row.end) return [];
    return [{ start: new Date(row.start).toISOString(), end: new Date(row.end).toISOString(),
      matchedEnd: new Date(row.financeMonthEnd).toISOString(), leap: row.leap,
      monthPillar: row.monthPillar, monthLifeBranch: row.monthLifeBranch,
      scopes: [...upperScopes, 'monthly'], monthly }];
  });
  if (upper.length !== upperScopes.length || months.length !== rows.length) return undefined;
  return { lunarYear: window.lunarYear, yearLifeBranch: ordinary.yearBranch, upper, months, occurrenceCount: upper.length + months.length };
}

export function buildYunZiweiWindow(window: { start: number; end: number }, period: PreviewPeriod, natal: Natal, decades: Decade[]) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.start >= window.end || window.end - window.start > 368 * dayMs) throw new RangeError('Invalid Yun window');
  const birth = readNatal(natal);
  if (!birth) return { status: 'unavailable', warnings: ['紫微雲缺少可核验的生月、十二宫、小限年龄或唯一星位依据'], rows: [] } as const;
  if (birth.leap && period !== 'month') return { status: 'unavailable', warnings: ['紫微雲名义闰生月暂仅核验月财章节'], rows: [] } as const;
  const profile = birth.leap ? yunZiweiPolicy.nominalLeapBirthFinanceProfile : yunZiweiPolicy.profile;
  const birthMonthEvidence = birth.leap ? { birthMonthBasis: 'nominal-intercalary-month', birthLunarMonth: birth.birthMonth,
    birthMonthLayerProof: yunZiweiPolicy.nominalLeapBirthLayerProof } as const : undefined;
  const placementsByName = new Map<string, string[]>();
  for (const palace of natal.palaces) for (const star of [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]) {
    const name = String(star.name);
    // The archived annual Sky position differs from the official source on the checked leap-birth charts.
    if (birth.leap && name === '天空') continue;
    if (!placementsByName.has(name)) placementsByName.set(name, []);
    placementsByName.get(name)!.push(palace.earthlyBranch);
  }
  const starPlacements = (star: string) => placementsByName.get(star) ?? [];
  const native = (period === 'month' || period === 'day') && !birth.leap ? readQuanshuNatal(natal) : undefined;
  const verifiedMajors = native?.status === 'ready' ? quanshuBirthAnchoredMajorPositions(
    natal, quanshuLifeBureau(natal, native).verifiedLifeBureau,
    star => natal.palaces.find(palace => palace.majorStars.some(row => row.name === star))?.earthlyBranch,
  ).positions : undefined;
  const uniqueFinancePalaceStars = new Set(financePalaceStars.filter(star => starPlacements(star).length === 1));
  const verifiedArchiveStar = (star: string, layer: 'minorStars' | 'adjectiveStars', expectedBranch?: string) => {
    const places = starPlacements(star);
    return places.length === 1 && (expectedBranch === undefined || places[0] === expectedBranch)
      && natal.palaces.find(palace => palace.earthlyBranch === places[0])?.[layer]
      .some(row => row.name === star) ? places : [];
  };
  const financeShaLocations = financeShaStars.map(star => ({ star,
    places: verifiedArchiveStar(star, star === '天空' ? 'adjectiveStars' : 'minorStars') }));
  const financeSha = financeShaLocations.flatMap(({ star, places }) =>
    places.length === 1 ? [{ star, branch: places[0] }] : []);
  const missingFinanceSha = financeShaLocations.filter(({ places }) => !places.length).map(({ star }) => ({ star, layer: 'natal' }));
  // The source names Dahao without selecting a layer. Validate both archive
  // placements by their own rules before either can count as a named witness.
  const boshiHao = quanshuVerifiedBoshiPosition(natal, birth.birthStem, '大耗');
  const suiqianHao = natal.palaces.filter(palace => palace.suiqian12 === '大耗');
  const expectedSuiqianHao = branches[mod(birth.birthYear - 4 + 6)];
  const expectedTianxing = branches[mod(9 + birth.birthMonth - 1)];
  const { qingyangBranch, lucunBranch } = quanshuLuYangTuo(birth.birthStem);
  const [verifiedLucunBranch] = period === 'day' ? verifiedArchiveStar('禄存', 'minorStars', lucunBranch) : [];
  const voids = period === 'month' && native?.status === 'ready' ? quanshuKongJiePositions(natal) : undefined;
  const verifiedDiJieBranch = voids?.ready ? voids.robberyBranch
    : voids && 'verifiedRobberyBranch' in voids ? voids.verifiedRobberyBranch : undefined;
  const propertyShaLocations = [
    { star: '天刑', layer: 'natal', places: verifiedArchiveStar('天刑', 'adjectiveStars', expectedTianxing) },
    { star: '擎羊', layer: 'natal', places: verifiedArchiveStar('擎羊', 'minorStars', qingyangBranch) },
    { star: '大耗', layer: 'boshi', places: boshiHao ? [boshiHao] : [] },
    { star: '大耗', layer: 'suiqian', places: suiqianHao.length === 1 && suiqianHao[0].earthlyBranch === expectedSuiqianHao ? [expectedSuiqianHao] : [] },
  ];
  const propertySha = propertyShaLocations.flatMap(({ star, layer, places }) =>
    places.length === 1 ? [{ star, layer, branch: places[0] }] : []);
  const missingPropertySha = propertyShaLocations.filter(({ places }) => places.length !== 1).map(({ star, layer }) => ({ star, layer }));
  const scopes: Scope[] = period === 'year' ? [] : period === 'month' ? ['monthly'] : ['monthly', 'daily'];
  const cuts = new Set([window.start, window.end]);
  const hasDayScope = scopes.includes('daily');
  for (let at = Math.floor((window.start + offset) / dayMs) * dayMs - offset + dayMs; at < window.end + hourMs; at += dayMs) {
    if (at < window.end) cuts.add(at);
    if (hasDayScope && window.start < at - hourMs && at - hourMs < window.end) cuts.add(at - hourMs);
  }
  for (const decade of decades) for (const at of [decade.start, decade.end]) if (window.start < at && at < window.end) cuts.add(at);
  const points = [...cuts].sort((a, b) => a - b), frames = new Map(scopes.map(scope => [scope, [] as Frame[]]));
  const months = new Map<number, number[]>();
  const financeMonthEnds = new Map<string, number>();
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1], end = points[i], civil = lunarAtBeijing(start) as Calendar;
    const withinZiDifference = hasDayScope && mod(start + offset, dayMs) >= dayMs - hourMs;
    const next = withinZiDifference ? lunarAtBeijing(start + hourMs) as Calendar : undefined;
    const decade = decades.filter(d => d.start <= start && end <= d.end && validStem(d.stem) && validBranch(d.branch));
    const dayMonthBasisAgreed = !next || civil.getYear() === next.getYear() && civil.getMonth() === next.getMonth();
    const dailyFrames = next
      ? [{ lunar: civil, clock: 'civil-midnight' }, { lunar: next, clock: 'zi-start' }] as const
      : [{ lunar: civil, clock: 'agreed' }] as const;
    for (const scope of scopes) for (const { lunar, clock } of scope === 'monthly' ? [{ lunar: civil, clock: undefined }] : dailyFrames) {
      const year = lunar.getYear(), signedMonth = lunar.getMonth(), day = lunar.getDay(), age = year - birth.birthYear + 1;
      if (age < 1) continue;
      const yearMonths = months.get(year) ?? lunarCalendar.LunarYear.fromYear(year).getMonthsInYear().map(m => m.getMonth());
      months.set(year, yearMonths);
      const ordinal = yearMonths.indexOf(signedMonth);
      if (ordinal < 0) throw new Error('Missing source lunar month');
      const minor = natal.palaces.filter(p => p.ages.some(n => mod(n - age) === 0));
      if (minor.length !== 1 || !validStem(minor[0].heavenlyStem)) throw new Error('Missing unique source minor limit');
      const yearBranch = branches[mod(year - 4)], yearStem = stems[mod(year - 4, 10)];
      const monthPillar = yunMonthPillar(year, Math.abs(signedMonth));
      const monthLife = yunLifeBranch(yearBranch, birth.birthMonth, birth.birthHour, ordinal);
      let financeMonthEnd: number | undefined;
      if (scope === 'monthly') {
        const monthKey = year + ':' + signedMonth;
        financeMonthEnd = financeMonthEnds.get(monthKey);
        if (financeMonthEnd === undefined) {
          const nextMonth = yearMonths[ordinal + 1];
          const nextMonthDate = lunarCalendar.Lunar.fromYmd(nextMonth === undefined ? year + 1 : year, nextMonth ?? 1, 1)
            .getSolar().toYmd();
          // Both published day clocks agree on the lunar month before the last Zi hour.
          financeMonthEnd = Date.parse(nextMonthDate + 'T00:00:00+08:00') - hourMs;
          financeMonthEnds.set(monthKey, financeMonthEnd);
        }
      }
      const frame: Frame = { start, end, scope, lunarYear: year, lunarMonth: Math.abs(signedMonth), leap: signedMonth < 0,
        monthOrdinal: ordinal, monthPillar, yearBranch, yearStem, monthLifeBranch: monthLife,
        lifeBranch: scope === 'monthly' ? monthLife : yunLifeBranch(yearBranch, birth.birthMonth, birth.birthHour, ordinal, day),
        sourceStem: scope === 'monthly' ? monthPillar[0] : lunar.getDayInGanZhiExact2()[0],
        ...(clock ? { lunarDay: day, sourceDayClock: clock, dayMonthBasisAgreed } : {}), nominalAge: age,
        minorLifeBranch: minor[0].earthlyBranch, minorStem: minor[0].heavenlyStem, financeMonthEnd,
        ...(decade.length === 1 ? { decadeLifeBranch: decade[0].branch, decadeStem: decade[0].stem } : {}) };
      const rows = frames.get(scope)!, previous = rows.at(-1);
      const identity = ({ start: _start, end: _end, ...rest }: Frame) => JSON.stringify(rest);
      if (previous && previous.end === start && identity(previous) === identity(frame)) previous.end = end;
      else rows.push(frame);
    }
  }
  const rows = [...frames.values()].flat().map(frame => {
    const sourceStems = [{ sourceScope: 'natal', sourceStem: birth.birthStem },
      ...(frame.decadeStem ? [{ sourceScope: 'decadal', sourceStem: frame.decadeStem }] : []),
      { sourceScope: 'yearly', sourceStem: frame.yearStem }, { sourceScope: 'minor', sourceStem: frame.minorStem },
      { sourceScope: 'monthly', sourceStem: frame.monthPillar[0] },
      ...(frame.scope === 'daily' ? [{ sourceScope: 'daily', sourceStem: frame.sourceStem }] : [])];
    const contacts = sourceStems.flatMap(source => yunTransformations(source.sourceStem, source.sourceScope === 'minor').map(t => {
      const palace = natal.palaces.find(p => starNames(p).includes(t.star))!;
      return { ...source, ...t, branch: palace.earthlyBranch, palaceIndex: palace.index };
    }));
    const palaces = natal.palaces.map(p => {
      const localStarNames = birth.leap ? starNames(p).filter(name => name !== '天空') : starNames(p);
      const localContacts = contacts.filter(c => c.branch === p.earthlyBranch);
      const surroundingBranches = [0, 4, 6, 8].map(d => branches[mod(branches.indexOf(p.earthlyBranch) + d)]);
      const surroundingContacts = contacts.filter(c => surroundingBranches.includes(c.branch));
      const surroundingYearMonthJi = surroundingContacts.filter(c => c.kind === '忌' && ['yearly', 'monthly'].includes(c.sourceScope));
      const surroundingWealthJi = surroundingYearMonthJi.filter(c => wealthStars.includes(c.star));
      const localFinanceShaStars = financeSha.filter(placement => placement.branch === p.earthlyBranch).map(placement => placement.star);
      const surroundingFinanceSha = financeSha.filter(placement => surroundingBranches.includes(placement.branch));
      const yearlyName = yunPalaceName(frame.yearBranch, p.earthlyBranch), monthlyName = yunPalaceName(frame.monthLifeBranch, p.earthlyBranch);
      const dailyName = frame.scope === 'daily' ? yunPalaceName(frame.lifeBranch, p.earthlyBranch) : undefined;
      const natalWealth = p.name === '财帛', monthWealth = monthlyName === '财帛';
      const localWealthStars = localStarNames.filter(s => wealthStars.includes(s));
      const localLuScopes = [...new Set(localContacts.filter(c => c.kind === '禄').map(c => c.sourceScope))];
      const localUpperWealthJi = frame.scope === 'monthly' ? localContacts.filter(c => c.kind === '忌'
        && (c.sourceScope === 'yearly' || c.sourceScope === 'minor') && localWealthStars.includes(c.star)) : undefined;
      const localUpperClearWealthStars = localUpperWealthJi && localWealthStars.filter(star => !localUpperWealthJi.some(c => c.star === star));
      const dayFinanceContacts = localContacts.filter(c => c.sourceScope === 'monthly' || c.sourceScope === 'daily');
      const localDailyFinanceStars = frame.scope === 'daily' ? localStarNames.flatMap(star => {
        const intrinsic = localWealthStars.includes(star);
        const transfers = dayFinanceContacts.filter(c => c.star === star);
        const luScopes = transfers.filter(c => c.kind === '禄').map(c => c.sourceScope);
        const jiScopes = transfers.filter(c => c.kind === '忌').map(c => c.sourceScope);
        return intrinsic || luScopes.length ? [{ star, intrinsic, luScopes, jiScopes }] : [];
      }) : undefined;
      const atYearWealthPropertyAxis = ['财帛', '福德', '子女', '田宅'].includes(yearlyName);
      const yearAxisEvidence = frame.scope === 'monthly' && p.earthlyBranch === frame.lifeBranch && atYearWealthPropertyAxis
        ? [p.earthlyBranch, branches[mod(branches.indexOf(p.earthlyBranch) + 6)]].map(branch => {
          const seat = natal.palaces.find(row => row.earthlyBranch === branch)!;
          const transfers = contacts.filter(c => c.branch === branch && (c.sourceScope === 'yearly' || c.sourceScope === 'monthly'));
          return { branch, yearlyName: yunPalaceName(frame.yearBranch, branch), wealth: starNames(seat).filter(star => wealthStars.includes(star)),
            transfers, sha: financeSha.filter(row => row.branch === branch).map(row => row.star) };
        }) : undefined;
      const tokens = (cs: typeof contacts) => cs.map(c => c.sourceScope + ':' + c.kind + ':' + c.star);
      return { palaceIndex: p.index, branch: p.earthlyBranch, natalName: p.name, yearlyName, monthlyName, dailyName,
        flowName: frame.scope === 'monthly' ? monthlyName : dailyName!, localStarNames, localWealthStars,
        localFinancePalaceStars: localStarNames.filter(star => uniqueFinancePalaceStars.has(star)),
        localWealthCount: localWealthStars.length,
        localUpperWealthJi, localUpperClearWealthStars, localUpperClearWealthCount: localUpperClearWealthStars?.length,
        localDailyFinanceStars, localDailyFinanceWealth: localDailyFinanceStars?.some(row => row.jiScopes.length === 0),
        localFinanceShaStars, surroundingFinanceSha, surroundingFinanceShaCount: surroundingFinanceSha.length,
        surroundingYearMonthJiBranchCount: new Set(surroundingYearMonthJi.map(contact => contact.branch)).size,
        surroundingWealthJi, surroundingWealthJiCount: surroundingWealthJi.length,
        surroundingWealthCount: natal.palaces.filter(p => surroundingBranches.includes(p.earthlyBranch))
          .reduce((n, p) => n + starNames(p).filter(s => wealthStars.includes(s)).length, 0),
        atWealth: natalWealth || (frame.scope === 'daily' ? monthWealth : yearlyName === '财帛'),
        atProperty: p.name === '田宅' || (frame.scope === 'daily' ? monthlyName === '田宅' : yearlyName === '田宅'),
        dayOrNatalWealth: p.name === '财帛' || dailyName === '财帛',
        dayOrNatalProperty: p.name === '田宅' || dailyName === '田宅', isDayWealth: dailyName === '财帛',
        atYearWealthPropertyAxis, yearAxisEvidence,
        yearAxisPositiveScopes: yearAxisEvidence && [...new Set(yearAxisEvidence.flatMap(row => row.transfers
          .filter(c => c.kind !== '忌').map(c => c.sourceScope)))],
        yearAxisWealthCount: yearAxisEvidence?.reduce((count, row) => count + row.wealth.length, 0),
        hasLuCun: localStarNames.includes('禄存'), hasDiJie: localStarNames.includes('地劫'),
        localTransformations: tokens(localContacts), surroundingTransformations: tokens(surroundingContacts),
        localLuScopes,
        localPositiveScopes: [...new Set(localContacts.filter(c => c.kind !== '忌').map(c => c.sourceScope))],
        localJiScopes: [...new Set(localContacts.filter(c => c.kind === '忌').map(c => c.sourceScope))],
        surroundingPositiveScopes: [...new Set(surroundingContacts.filter(c => c.kind !== '忌').map(c => c.sourceScope))],
        surroundingJiScopes: [...new Set(surroundingContacts.filter(c => c.kind === '忌').map(c => c.sourceScope))],
      };
    });
    const dayWealth = palaces.find(palace => palace.dailyName === '财帛');
    const financePalaces = frame.scope === 'daily' ? palaces.map(palace => ({ ...palace, dailyFinanceAxisSide:
      palace.dailyName === '财帛' && palace.natalName === '财帛' && palace.localDailyFinanceWealth ? 'overlaid_wealth'
        : palace.dailyName === '福德' && palace.localDailyFinanceWealth && dayWealth?.localDailyFinanceWealth === false ? 'fortune_only' : 'neither' })) : palaces;
    return { ...frame, profile, ...birthMonthEvidence, tableVersion: yunZiweiPolicy.table,
      sourceTimingStatus: yunZiweiPolicy.timingStatus, allLayersReady: Boolean(frame.decadeStem), palaces: financePalaces,
      yearlyAtDecadeCareer: frame.decadeLifeBranch ? yunPalaceName(frame.decadeLifeBranch, frame.yearBranch) === '官禄' : undefined,
      sunJiScopesAtYearLife: contacts.filter(c => c.star === '太阳' && c.kind === '忌' && c.branch === frame.yearBranch).map(c => c.sourceScope),
      contacts: contacts.map(c => {
        const { surroundingWealthJi: _wealthJi, surroundingFinanceSha: _financeSha, ...palace } = palaces.find(p => p.branch === c.branch)!;
        const intrinsicWealthStar = wealthStars.includes(c.star), isJi = c.kind === '忌';
        const monthlyFinanceSupport = frame.scope === 'monthly' && palace.flowName === '命宫'
          && (palace.atWealth || palace.atProperty) && (c.sourceScope === 'yearly' && !isJi || c.sourceScope === 'minor' && c.kind === '禄')
          ? palace.localStarNames.flatMap(star => {
            const intrinsic = wealthStars.includes(star);
            const wealthPalaceScopes = uniqueFinancePalaceStars.has(star) ? yunFinancePalaceScopes(frame, palace) : [];
            const changes = contacts.filter(change => change.branch === c.branch && change.star === star
              && change.sourceScope !== 'monthly');
            const luScopes = changes.filter(change => change.kind === '禄' && change !== c).map(change => change.sourceScope);
            const hasUpperJi = changes.some(change => change.kind === '忌'
              && (change.sourceScope === 'yearly' || change.sourceScope === 'minor'));
            return !hasUpperJi && (intrinsic || wealthPalaceScopes.length || luScopes.length)
              ? [{ star, intrinsic, wealthPalaceScopes, luScopes }] : [];
          }) : undefined;
        const upperPropertyJi = frame.scope === 'monthly' && isJi && palace.flowName === '命宫' && palace.atProperty
          && (c.sourceScope === 'yearly' || c.sourceScope === 'minor');
        const jumenPropertyJi = frame.scope === 'monthly' && c.sourceScope === 'monthly' && isJi && c.star === '巨门'
          && (palace.natalName === '田宅' || palace.monthlyName === '田宅');
        const propertyShaContacts = jumenPropertyJi ? propertySha.flatMap(placement => {
            const difference = mod(branches.indexOf(placement.branch) - branches.indexOf(c.branch));
            const relation = difference === 0 ? '同宫' : difference === 6 ? '对宫' : difference === 4 || difference === 8 ? '三合' : undefined;
            return relation ? [{ ...placement, relation }] : [];
          }) : undefined;
        const shaWitnesses = upperPropertyJi
          ? financeSha.filter(row => row.branch === c.branch).map(row => ({ ...row, layer: 'natal', relation: '同宫' }))
          : propertyShaContacts;
        const missingShaPlacements = upperPropertyJi ? missingFinanceSha : missingPropertySha;
        let jumenMonthlyPropertyShaSameSeat: boolean | undefined;
        if (jumenPropertyJi) {
          jumenMonthlyPropertyShaSameSeat = false;
          if (palace.monthlyName === '田宅') {
            const sameSeat = new Set(propertyShaContacts?.filter(placement => placement.relation === '同宫').map(({ star }) => star));
            const unlocated = new Set(missingPropertySha.map(({ star }) => star));
            const requiredStars = ['天刑', '擎羊', '大耗'];
            if (requiredStars.every(star => sameSeat.has(star))) jumenMonthlyPropertyShaSameSeat = true;
            else if (requiredStars.every(star => sameSeat.has(star) || unlocated.has(star))) jumenMonthlyPropertyShaSameSeat = undefined;
          }
        }
        const jumenOverlaidPropertyShaSameSeat = jumenPropertyJi
          ? palace.natalName === '田宅' && jumenMonthlyPropertyShaSameSeat : undefined;
        const monthlyPropertyContact = shaWitnesses && {
          propertyReading: upperPropertyJi ? 'upper-taboo' : 'jumen-taboo',
          propertyScopes: [
            ...(palace.natalName === '田宅' ? ['natal'] : []),
            ...(upperPropertyJi && palace.yearlyName === '田宅' ? ['yearly'] : []),
            ...(jumenPropertyJi && palace.monthlyName === '田宅' ? ['monthly'] : []),
          ],
          shaWitnesses, missingShaPlacements, jumenMonthlyPropertyShaSameSeat, jumenOverlaidPropertyShaSameSeat,
          ...(jumenPropertyJi && { propertyShaPlacementProof: yunZiweiPolicy.propertySha }),
          shaWitnessCount: shaWitnesses.length > 0 || !missingShaPlacements.length
            ? new Set(shaWitnesses.map(({ star }) => star)).size : undefined,
          recipientFinance: upperPropertyJi ? {
            intrinsic: intrinsicWealthStar,
            wealthPalaceScopes: palace.localFinancePalaceStars.includes(c.star) ? yunFinancePalaceScopes(frame, palace) : [],
            luScopes: contacts.filter(row => row.branch === c.branch && row.star === c.star && row.kind === '禄')
              .map(row => row.sourceScope),
          } : undefined,
        };
        return { ...palace, ...c, intrinsicWealthStar, wealthByLu: c.kind === '禄', monthlyFinanceSupport,
          verifiedMajorSeat: verifiedMajors?.get(c.star) === c.branch ? true : undefined,
          verifiedDiJieAtSeat: verifiedDiJieBranch === c.branch ? true : undefined,
          verifiedNatalLucunAtSeat: verifiedLucunBranch === undefined ? undefined : verifiedLucunBranch === c.branch,
          monthlyPropertyContact,
          dailyFinanceRecipientClear: c.sourceScope === 'daily'
            ? palace.localDailyFinanceStars?.some(row => row.star === c.star && row.jiScopes.length === 0) : undefined,
          isJi, intrinsicWealthJi: isJi && intrinsicWealthStar, propertyShaContacts, propertyShaContactCount: propertyShaContacts?.length };
      }) };
  });
  const warning = birth.leap ? '紫微雲闰生月按名义月核验月财；天空来源位置仍待核'
    : '紫微雲同月流日按两种日界核对；跨农历月、年和其他闰生月口径仍待同源核验';
  return { status: 'ready', warnings: rows.length ? [warning] : [], rows } as const;
}

type YunRow = ReturnType<typeof buildYunZiweiWindow>['rows'][number];
type YunPalace = YunRow['palaces'][number];
type YunContact = Pick<YunRow['contacts'][number], 'star' | 'sourceScope' | 'sourceStem' | 'kind'>;

function yunFinanceRoles(row: YunRow, palace: YunPalace, localContacts: YunContact[]) {
  return palace.localStarNames.flatMap(star => {
    const intrinsic = palace.localWealthStars.includes(star);
    const wealthPalaceScopes = palace.localFinancePalaceStars.includes(star) ? yunFinancePalaceScopes(row, palace) : [];
    const sameStar = localContacts.filter(contact => contact.star === star);
    const luScopes = sameStar.filter(contact => contact.kind === '禄').map(contact => contact.sourceScope);
    const jiScopes = sameStar.filter(contact => contact.kind === '忌').map(contact => contact.sourceScope);
    return intrinsic || wealthPalaceScopes.length || luScopes.length ? [{ star, intrinsic, wealthPalaceScopes, luScopes, jiScopes }] : [];
  });
}

export function yunMonthlyFinanceAreas(row: YunRow) {
  if (row.scope !== 'monthly') return [];
  const life = row.palaces.find(palace => palace.branch === row.lifeBranch)!;
  const lifeArea = row.palaces.filter(palace => ['命宫', '官禄', '财帛', '迁移'].includes(palace.monthlyName));
  const areas = [{ area: 'life-area', palaces: lifeArea, upperScopes: ['yearly', 'minor'] }];
  if (life.atYearWealthPropertyAxis) {
    const axis = life.yearAxisEvidence!;
    areas.push({ area: 'year-axis', palaces: axis.map(seat => row.palaces.find(palace => palace.branch === seat.branch)!),
      upperScopes: ['yearly'] });
  }
  const completeShaLocations = new Set(row.palaces.flatMap(palace => palace.localFinanceShaStars)).size === financeShaStars.length;
  const locatedTabooScopes = new Set(row.contacts.filter(contact => contact.kind === '忌').map(contact => contact.sourceScope));
  const distinct = (rows: YunContact[]) => new Set(rows.map(contact => contact.sourceScope + ':' + contact.star + ':' + contact.kind)).size;
  return areas.map(({ area, palaces, upperScopes }) => {
    const scopes = [...upperScopes, 'monthly'];
    const positions = palaces.map(palace => {
      const { branch, monthlyName, yearlyName, localFinanceShaStars: sha } = palace;
      const allContacts = row.contacts.filter(contact => contact.branch === branch)
        .map(({ star, sourceScope, sourceStem, kind }) => ({ star, sourceScope, sourceStem, kind }));
      const transfers = allContacts.filter(contact => scopes.includes(contact.sourceScope));
      const minorContacts = area === 'year-axis' ? allContacts.filter(contact => contact.sourceScope === 'minor') : undefined;
      const finance = yunFinanceRoles(row, palace, minorContacts ? allContacts.filter(contact => contact.sourceScope !== 'minor') : allContacts);
      return { branch, monthlyName, yearlyName, transfers, finance, sha, minorContacts };
    });
    const positives = positions.flatMap(seat => seat.transfers.filter(contact => contact.kind !== '忌'));
    const taboos = positions.flatMap(seat => seat.transfers.filter(contact => contact.kind === '忌'));
    const favorableFinanceContacts = positions.flatMap(seat => seat.transfers.flatMap(contact => {
      const financeRole = seat.finance.find(role => role.star === contact.star);
      return contact.kind !== '忌' && financeRole ? [{ ...contact, branch: seat.branch, financeRole }] : [];
    }));
    const clearFinanceSupport = favorableFinanceContacts.filter(contact =>
      !contact.financeRole.jiScopes.some(scope => scopes.includes(scope)));
    const clearFinanceSupportSeatCount = new Set(clearFinanceSupport.map(contact => contact.branch)).size;
    const lifeSeatFinanceSupport = area === 'year-axis'
      ? clearFinanceSupport.filter(contact => contact.branch === life.branch) : [];
    const yearAxisLifeSeatFinanceSupportCandidate = area === 'year-axis' && clearFinanceSupportSeatCount === 1
      && new Set(lifeSeatFinanceSupport.map(contact => contact.star)).size >= 2
      && ['yearly', 'monthly'].every(scope => new Set(
        lifeSeatFinanceSupport.filter(contact => contact.sourceScope === scope).map(contact => contact.kind),
      ).size >= 2);
    const yearAxisLifeSeatFinanceSupportWitness = yearAxisLifeSeatFinanceSupportCandidate ? {
      branch: life.branch, contacts: lifeSeatFinanceSupport.map(({ star, sourceScope, sourceStem, kind }) =>
        ({ star, sourceScope, sourceStem, kind })),
    } : undefined;
    const annualPositiveKinds = new Set(positives.filter(contact => contact.sourceScope === 'yearly').map(contact => contact.kind));
    const annualQuanKeWithMinorLu = area === 'life-area' && annualPositiveKinds.size === 2
      && annualPositiveKinds.has('权') && annualPositiveKinds.has('科')
      && positives.some(contact => contact.sourceScope === 'minor' && contact.kind === '禄');
    const tabooShaSameSeat = positions.flatMap(seat => {
      const taboo = seat.transfers.filter(contact => contact.kind === '忌');
      return taboo.length && seat.sha.length ? [{ branch: seat.branch, taboo, sha: seat.sha }] : [];
    });
    const affectedFinance = positions.flatMap(seat => seat.transfers.filter(contact => contact.kind === '忌'
      && ['yearly', 'monthly'].includes(contact.sourceScope) && seat.finance.some(role => role.star === contact.star))
      .map(contact => ({ ...contact, branch: seat.branch })));
    const financeCount = new Set(positions.flatMap(seat => seat.finance.map(role => role.star))).size;
    const unaffectedFinance = positions.flatMap(seat => seat.finance.filter(role => !role.jiScopes.some(scope => scopes.includes(scope)))
      .map(role => role.star));
    const recordedShaCount = new Set(positions.flatMap(seat => seat.sha)).size;
    const shaCount = recordedShaCount > 0 || completeShaLocations ? recordedShaCount : undefined;
    const allRelevantTaboosLocated = scopes.every(scope => locatedTabooScopes.has(scope));
    const completeTabooAndShaLocations = completeShaLocations && allRelevantTaboosLocated;
    const hasTaboo = taboos.length > 0, hasSha = recordedShaCount > 0;
    const separatedTabooAndSha = tabooShaSameSeat.length ? false
      : completeTabooAndShaLocations ? hasTaboo && hasSha : undefined;
    const onlyTabooOrOnlySha = hasTaboo && hasSha ? false
      : completeTabooAndShaLocations ? hasTaboo || hasSha : undefined;
    const yearAxisTabooShaSeats = area === 'year-axis' ? positions.flatMap(seat => {
      const monthTaboo = seat.transfers.find(contact => contact.kind === '忌' && contact.sourceScope === 'monthly');
      if (!monthTaboo || !seat.sha.length) return [];
      const upperTaboos = [...seat.transfers.filter(contact => contact.sourceScope === 'yearly'), ...(seat.minorContacts ?? [])]
        .filter(contact => contact.kind === '忌');
      return [{ branch: seat.branch, yearlyName: seat.yearlyName, monthTaboo, upperTaboos, sha: seat.sha }];
    }) : undefined;
    const axisTabooWitnesses = (sameRecipient: boolean) => yearAxisTabooShaSeats?.flatMap(seat => {
      const upperTaboos = seat.upperTaboos.filter(contact => (contact.star === seat.monthTaboo.star) === sameRecipient);
      return upperTaboos.length ? [{ ...seat, upperTaboos }] : [];
    });
    const yearAxisTabooShaWitnesses = axisTabooWitnesses(false);
    const yearAxisRepeatedTabooShaWitnesses = axisTabooWitnesses(true);
    const yearAxisTabooShaComplete = area === 'year-axis' && completeShaLocations
      && ['yearly', 'minor', 'monthly'].every(scope => locatedTabooScopes.has(scope));
    const yearAxisTabooShaCandidate = yearAxisTabooShaWitnesses?.length ? true : yearAxisTabooShaComplete ? false : undefined;
    const yearAxisRepeatedTabooShaCandidate = yearAxisRepeatedTabooShaWitnesses?.length ? true : yearAxisTabooShaComplete ? false : undefined;
    const investmentExamples = area === 'life-area' && row.profile === yunZiweiPolicy.profile ? (() => {
      const lifeSeat = positions.find(seat => seat.monthlyName === '命宫')!;
      const wealthSeat = positions.find(seat => seat.monthlyName === '财帛')!;
      const dijieSeats = row.palaces.filter(seat => seat.localFinanceShaStars.includes('地劫'));
      const lifeDijie = dijieSeats.length === 1 ? dijieSeats[0].branch === lifeSeat.branch : undefined;
      const annualJiStar = yunTransformations(row.yearStem).find(contact => contact.kind === '忌')!.star;
      const annualJiSeats = row.palaces.filter(seat => seat.localStarNames.includes(annualJiStar));
      const annualJiContacts = row.contacts.filter(contact => contact.sourceScope === 'yearly' && contact.kind === '忌');
      const annualJiLocated = annualJiSeats.length === 1 && annualJiContacts.length === 1
        && annualJiContacts[0].sourceStem === row.yearStem && annualJiContacts[0].star === annualJiStar
        && annualJiContacts[0].branch === annualJiSeats[0].branch;
      const lifeAnnualFinanceJi = affectedFinance.filter(contact => contact.branch === lifeSeat.branch && contact.sourceScope === 'yearly');
      const wealthSeatSupport = favorableFinanceContacts.filter(contact => contact.branch === wealthSeat.branch
        && (contact.sourceScope === 'yearly' || contact.sourceScope === 'monthly'));
      const wealthSeatLucun = wealthSeat.finance.some(role => role.star === '禄存' && role.intrinsic);
      const branches = new Set(positions.map(seat => seat.branch));
      const areaTaboos = row.contacts.filter(contact => contact.kind === '忌' && branches.has(contact.branch))
        .map(({ star, sourceScope, sourceStem, kind, branch }) => ({ star, sourceScope, sourceStem, kind, branch }));
      const noNamedTabooOrSha = areaTaboos.length || recordedShaCount ? false : row.allLayersReady && completeShaLocations ? true : undefined;
      const companionFinance = [...new Set(positions.flatMap(seat => seat.finance.filter(role => role.star !== '禄存')
        .map(role => role.star)))];
      return {
        lifeBranch: lifeSeat.branch, lifeDijie, lifeAnnualFinanceJi, annualJiLocated,
        wealthBranch: wealthSeat.branch, wealthSeatSupport, wealthSeatLucun,
        wealthSupportWithUnobstructedLife: lifeDijie === true || annualJiLocated && lifeAnnualFinanceJi.length ? false
          : lifeDijie === undefined || !annualJiLocated ? undefined : wealthSeatSupport.length > 0,
        areaTaboos, companionFinance, noNamedTabooOrSha,
        clearAreaWithWealthLucun: !wealthSeatLucun || !companionFinance.length ? false : noNamedTabooOrSha,
      };
    })() : undefined;
    const birthMonthEvidence = row.birthMonthBasis ? { birthMonthBasis: row.birthMonthBasis, birthLunarMonth: row.birthLunarMonth,
      birthMonthLayerProof: row.birthMonthLayerProof,
      unverifiedShaLocations: ['天空'] } : undefined;
    return { area, readingProfile: yunZiweiPolicy.monthFinanceArea, ...birthMonthEvidence, branch: life.branch, positions, affectedFinance,
      favorableFinanceContacts, tabooShaSameSeat, separatedTabooAndSha, onlyTabooOrOnlySha,
      yearAxisLifeSeatFinanceSupportCandidate, yearAxisLifeSeatFinanceSupportWitness,
      yearAxisTabooShaCandidate, yearAxisTabooShaWitnesses,
      yearAxisRepeatedTabooShaCandidate, yearAxisRepeatedTabooShaWitnesses, investmentExamples,
      monthWealthSupportWithUnobstructedLife: investmentExamples?.wealthSupportWithUnobstructedLife,
      monthWealthLucunWithClearArea: investmentExamples?.clearAreaWithWealthLucun,
      positiveScopes: [...new Set(positives.map(contact => contact.sourceScope))],
      tabooScopes: [...new Set(taboos.map(contact => contact.sourceScope))],
      annualPositiveKindCount: annualPositiveKinds.size, annualQuanKeWithMinorLu,
      monthlyPositiveKindCount: new Set(positives.filter(contact => contact.sourceScope === 'monthly').map(contact => contact.kind)).size,
      clearFinanceSupportStarCount: new Set(clearFinanceSupport.map(contact => contact.star)).size,
      clearFinanceSupportSeatCount,
      positiveContactCount: distinct(positives), tabooContactCount: distinct(taboos), shaCount, completeShaLocations, financeCount,
      clearFinanceCount: new Set(unaffectedFinance).size,
      affectedFinanceCount: new Set(affectedFinance.map(contact => contact.star)).size,
      noRecordedTabooOrSha: hasTaboo || hasSha ? false : completeTabooAndShaLocations ? true : undefined };
  });
}

export function yunDailyReadings(row: YunRow) {
  if (row.scope !== 'daily' || !row.dayMonthBasisAgreed) return [];
  const life = row.palaces.find(palace => palace.branch === row.lifeBranch)!;
  const monthLife = row.palaces.find(palace => palace.branch === row.monthLifeBranch)!;
  const contactsAt = (palace: YunPalace) => row.contacts.filter(contact => contact.branch === palace.branch)
    .map(({ star, sourceScope, sourceStem, kind }) => ({ star, sourceScope, sourceStem, kind }));
  const monthlyContext = { branch: monthLife.branch, natalName: monthLife.natalName, yearlyName: monthLife.yearlyName,
    stars: monthLife.localStarNames, upperContacts: contactsAt(monthLife).filter(contact => ['yearly', 'minor'].includes(contact.sourceScope)),
    sha: monthLife.localFinanceShaStars };
  const seatEvidence = (palace: YunPalace) => ({
    branch: palace.branch, palaceIndex: palace.palaceIndex, natalName: palace.natalName, yearlyName: palace.yearlyName,
    monthlyName: palace.monthlyName, dailyName: palace.dailyName,
    localContacts: contactsAt(palace), localStars: palace.localStarNames, localSha: palace.localFinanceShaStars,
    monthlyContext, readingProfile: yunZiweiPolicy.dailyReading,
  });
  const lifeSeat = seatEvidence(life);
  const monthInfluences = lifeSeat.localContacts.filter(contact => contact.sourceScope === 'monthly')
    .map(contact => ({ ...lifeSeat, reading: 'monthly-influence', polarity: contact.kind === '忌' ? 'ji' : 'positive',
      receivingContacts: [contact], financeScopes: [] as string[] }));
  const lifeFinanceScopes = [
    ...(life.natalName === '财帛' ? ['natal'] : []), ...(life.monthlyName === '财帛' ? ['monthly'] : []),
  ];
  const combined = lifeFinanceScopes.length ? (['positive', 'ji'] as const).flatMap(polarity => {
    const receivingContacts = lifeSeat.localContacts.filter(contact => ['monthly', 'daily'].includes(contact.sourceScope)
      && (contact.kind === '忌') === (polarity === 'ji'));
    return receivingContacts.some(contact => contact.sourceScope === 'monthly')
      && receivingContacts.some(contact => contact.sourceScope === 'daily')
      ? [{ ...lifeSeat, reading: 'finance-overlap', polarity, receivingContacts, financeScopes: lifeFinanceScopes }] : [];
  }) : [];
  const dailyTransfers = row.palaces.filter(palace => palace.dayOrNatalWealth).flatMap(palace => {
    const seat = seatEvidence(palace);
    const financeScopes = [
      ...(palace.natalName === '财帛' ? ['natal'] : []), ...(palace.dailyName === '财帛' ? ['daily'] : []),
    ];
    return seat.localContacts.filter(contact => contact.sourceScope === 'daily')
      .map(contact => ({ ...seat, reading: 'daily-finance', polarity: contact.kind === '忌' ? 'ji' : 'positive',
        receivingContacts: [contact], financeScopes }));
  });
  const financeSlots = row.palaces.map(palace => {
    const seat = seatEvidence(palace);
    const localFinanceRoles = yunFinanceRoles(row, palace, seat.localContacts).map(role => ({ ...role,
      clearForDay: !role.jiScopes.some(scope => scope === 'monthly' || scope === 'daily') }));
    const dayMonthPositive = seat.localContacts.filter(contact => contact.kind !== '忌'
      && (contact.sourceScope === 'monthly' || contact.sourceScope === 'daily'));
    return { palace, seat, localFinanceRoles, dayMonthPositive, hasClearFinance: localFinanceRoles.some(role => role.clearForDay) };
  });
  const financeLife = financeSlots.find(slot => slot.palace.branch === life.branch)!;
  const monthLifePositive = financeLife.dayMonthPositive.filter(contact => contact.sourceScope === 'monthly');
  const dayFinanceAxis = financeSlots.filter(slot => ['财帛', '福德'].includes(slot.palace.dailyName!));
  const overlappingNatalWealth = dayFinanceAxis.some(slot => slot.palace.natalName === '财帛'
    && slot.palace.dailyName === '财帛' && slot.hasClearFinance
    && ['monthly', 'daily'].every(scope => slot.dayMonthPositive.some(contact => contact.sourceScope === scope)));
  const lifeSupport = { branch: life.branch, natalName: life.natalName, monthlyName: life.monthlyName,
    receivingContacts: monthLifePositive, financeRoles: financeLife.localFinanceRoles };
  const lifeAndAxis = dayFinanceAxis.flatMap(({ palace, seat, localFinanceRoles, dayMonthPositive, hasClearFinance }) => {
    if (!hasClearFinance || !dayMonthPositive.length) return [];
    const base = { ...seat, polarity: 'positive', receivingContacts: dayMonthPositive, localFinanceRoles,
      dailyFinanceRoleProfile: yunZiweiPolicy.dailyFinanceRoles, lifeSupport };
    const wuqu = palace.dailyName === '财帛' && monthLifePositive.find(contact => contact.star === '武曲' && contact.kind === '禄');
    const both = ['monthly', 'daily'].every(scope => dayMonthPositive.some(contact => contact.sourceScope === scope));
    return [
      ...(wuqu ? [{ ...base, reading: 'wuqu-life-and-wealth' }] : []),
      ...(both && financeLife.hasClearFinance && monthLifePositive.length
        ? [{ ...base, reading: 'life-and-finance-axis', overlappingNatalWealth }] : []),
    ];
  });
  const byRecipient = financeSlots.flatMap(({ palace, seat, localFinanceRoles }) =>
    seat.localContacts.flatMap(contact => {
      const financeRole = localFinanceRoles.find(role => role.star === contact.star);
      const base = { ...seat, dailyFinanceRoleProfile: yunZiweiPolicy.dailyFinanceRoles,
        polarity: contact.kind === '忌' ? 'ji' : 'positive', receivingContacts: [contact], financeRole, localFinanceRoles };
      if (contact.sourceScope === 'monthly' && contact.kind === '忌' && palace.branch === life.branch && palace.atProperty) {
        const hasMonthFinance = localFinanceRoles.some(role => role.intrinsic || role.wealthPalaceScopes.length
          || role.luScopes.some(scope => scope !== 'daily'));
        if (hasMonthFinance || palace.hasDiJie) return [{ ...base, reading: 'month-ji-at-property',
          financeBasis: hasMonthFinance ? 'companion' : 'di-jie' }];
      }
      if (contact.sourceScope !== 'daily') return [];
      if (contact.kind === '忌') return palace.natalName === '田宅' && (financeRole || palace.hasDiJie)
        ? [{ ...base, reading: 'day-ji-at-property', financeBasis: financeRole ? 'recipient' : 'di-jie' }] : [];
      const friend = palace.natalName === '仆役' && !palace.isDayWealth;
      const work = palace.natalName === '官禄' && palace.dailyName === '迁移';
      return [
        ...(palace.dayOrNatalProperty && (financeRole?.clearForDay || palace.hasLuCun)
          ? [{ ...base, reading: 'day-positive-at-property', financeBasis: financeRole?.clearForDay ? 'recipient' : 'lu-cun' }] : []),
        ...(financeRole?.clearForDay && (friend || work)
          ? [{ ...base, reading: 'day-positive-by-recipient', financeBasis: 'recipient' }] : []),
      ];
    }));
  return [...monthInfluences, ...combined, ...dailyTransfers, ...lifeAndAxis, ...byRecipient];
}
