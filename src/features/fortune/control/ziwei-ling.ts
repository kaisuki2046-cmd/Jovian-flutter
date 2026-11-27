import * as LunarPackage from 'lunar-javascript';
import type { DestinyChartSnapshot } from '../../destiny';
import type { PreviewPeriod } from './period-window';
import { lunarAtBeijing } from './fortune-calendar';
import { nextSolarBoundary } from './fortune-preview';
import { quanshuBirthAnchoredMajorPositions, quanshuZiweiBirthAnchorProof } from './ziwei-birth-major-anchor';
import { readQuanshuArchivedFireBell } from './ziwei-firebell-positions';
import { quanshuLifeBureau } from './ziwei-growth-stages';
import { quanshuKongJiePositions } from './ziwei-kongjie';
import { quanshuLuYangTuo, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuAuxiliaryPositions } from './ziwei-source-support';

export const lingZiweiPolicy = {
  profile: 'ling-doujun-jie-month-civil-day-v1', table: 'ling-ten-stems-geng-double-ji-v1',
  dayBoundary: '北京日历午夜', monthBoundary: '农历月宫与交节月干分别切段',
  leapPolicy: 'regular-flow-months-before-insertion-resolved',
  taiyinBrightness: 'ling-taiyin-source-table-v1',
  wenchangBrightness: 'ling-wenchang-temple-or-prosperous-six-palaces-v1',
  natalLiteraryPlacementProof: 'ling-wenchang-wenqu-birth-hour-v1',
  dailyLifeArea: 'daily-life-void-support-peach-contact-travel-v2',
  dailyLearningPlacementProof: 'ling-verified-daily-void-pair-v1',
  dailyStudySupportPlacementProof: 'ling-verified-daily-study-support-v1',
} as const;
const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const palaceNames = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const table = [
  ['廉贞', '破军', '武曲', '太阳'], ['天机', '天梁', '紫微', '太阴'],
  ['天同', '天机', '文昌', '廉贞'], ['太阴', '天同', '天机', '巨门'],
  ['贪狼', '太阴', '右弼', '天机'], ['武曲', '贪狼', '天梁', '文曲'],
  ['太阳', '武曲', '太阴', '天同'], ['巨门', '太阳', '文曲', '文昌'],
  ['天梁', '紫微', '左辅', '武曲'], ['破军', '巨门', '太阴', '贪狼'],
];
const lunarYears = LunarPackage as unknown as { LunarYear: { fromYear(year: number): { getLeapMonth(): number } } };
type Calendar = ReturnType<typeof lunarAtBeijing> & {
  getYear(): number; getMonth(): number; getDay(): number; getYearInGanZhi(): string; getDayInGanZhiExact2(): string;
};
type Natal = DestinyChartSnapshot['ziwei']['rawResult'][number];
type Decadal = { start: number; end: number; stem: string; branch: string };
type Scope = 'decadal' | 'yearly' | 'monthly' | 'daily';
const mod12 = (value: number) => (value % 12 + 12) % 12;
const hourMs = 3_600_000, dayMs = 24 * hourMs, offset = 8 * hourMs;
const beijingMidnight = (instant: number) => Math.floor((instant + offset) / dayMs) * dayMs - offset;
const auspiciousStars = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存'];
const literaryStars = ['文昌', '文曲'];
const nobleStars = ['天魁', '天钺'];
const lingNoblePairs = ['丑未', '子申', '亥酉', '亥酉', '丑未', '子申', '丑未', '午寅', '卯巳', '卯巳'];
const peachStars = ['贪狼', '廉贞', '红鸾', '天喜', '天姚', '咸池'];

// 太阴一列，按作者官网的《星曜庙旺平陷表》逐宫录入。
export function lingTaiyinBrightness(branch: string) {
  const index = branches.indexOf(branch);
  return branch.length === 1 && index >= 0 ? '庙庙陷陷陷陷陷陷旺旺庙庙'[index] : undefined;
}

type PalaceStars = { branch: string; localStarNames: string[] };

function uniqueStarBranch(palaces: PalaceStars[], star: string) {
  const placements = palaces.flatMap(palace => palace.localStarNames.filter(name => name === star).map(() => palace.branch));
  return placements.length === 1 ? placements[0] : undefined;
}

function palaceRelation(center: string, other: string) {
  const distance = mod12(branches.indexOf(other) - branches.indexOf(center));
  if (distance === 0) return '同宫';
  if (distance === 6) return '对宫';
  if (distance === 4 || distance === 8) return '三合';
  return undefined;
}

function dailyLifeConditions(palaces: PalaceStars[], lifeBranch: string, area: string[], contacts: {
  star: string; kind: string; sourceScope: string; sourceStem: string; placements: PalaceStars[];
}[], voidPlacements: { star: string; branch: string }[], verifiedStarBranch: (star: string) => string | undefined,
  complete: boolean, decadeStemKnown: boolean, bathingBranch?: string) {
  const positions = new Map<string, string | undefined>();
  for (const palace of palaces) for (const star of palace.localStarNames) {
    positions.set(star, positions.has(star) ? undefined : palace.branch);
  }
  const knownPositions = (names: string[]) => names.flatMap(star => {
    const branch = positions.get(star);
    return branch ? [{ star, branch }] : [];
  });
  const placedContacts = contacts.flatMap(({ star, kind, sourceScope, sourceStem, placements }) => {
    const branch = placements[0]?.branch;
    return branch && positions.get(star) === branch ? [{ star, kind, sourceScope, sourceStem, branch }] : [];
  });
  const voidsAtLife = voidPlacements.filter(row => row.branch === lifeBranch);
  const dailyLearningVoidPairAtLife = voidsAtLife.length === 2 ? true
    : voidPlacements.length > voidsAtLife.length ? false : undefined;
  const support = auspiciousStars.flatMap(star => {
    const branch = verifiedStarBranch(star);
    return branch && area.includes(branch) ? [{ star, branch }] : [];
  });
  const favorable = (kind: string) => ['禄', '权', '科'].includes(kind);
  const beneficialContacts = placedContacts.filter(row => area.includes(row.branch) && favorable(row.kind)
    && verifiedStarBranch(row.star) === row.branch);
  // The author's void discussion excludes these two Ke contacts from favorable support when they share the void palace.
  const voidKe = beneficialContacts.filter(row => row.branch === lifeBranch && row.kind === '科' && ['武曲', '紫微'].includes(row.star));
  const transformations = beneficialContacts.filter(row => !voidKe.includes(row));
  const dailyStudySupport = voidsAtLife.length ? { voidsAtLife, support, transformations, voidKe } : undefined;
  const hasSupport = support.length > 0 ? true : auspiciousStars.some(star => verifiedStarBranch(star) === undefined) ? undefined : false;
  const hasBeneficialTransformation = transformations.length > 0 ? true
    : !decadeStemKnown || contacts.some(row => favorable(row.kind) && verifiedStarBranch(row.star) === undefined) ? undefined : false;
  const studyChecks = [dailyLearningVoidPairAtLife, hasSupport, hasBeneficialTransformation];
  const study = { dailyLearningPlacementProof: lingZiweiPolicy.dailyLearningPlacementProof, dailyLearningVoidPairAtLife,
    dailyStudySupportPlacementProof: lingZiweiPolicy.dailyStudySupportPlacementProof,
    dailyStudySupportedCandidate: studyChecks.includes(false) ? false : studyChecks.includes(undefined) ? undefined : true,
    dailyStudySupport };
  if (!complete) return study;

  const peachPositions = knownPositions(peachStars);
  if (bathingBranch) peachPositions.push({ star: '沐浴', branch: bathingBranch });
  const dailyLu = placedContacts.find(row => row.sourceScope === 'daily' && row.kind === '禄' && ['廉贞', '贪狼'].includes(row.star));
  const dailyPeachLu = dailyLu && { ...dailyLu, companions: peachPositions.flatMap(position => {
    const relation = palaceRelation(dailyLu.branch, position.branch);
    return position.star !== dailyLu.star && relation ? [{ ...position, relation }] : [];
  }) };

  const migrationBranch = branches[mod12(branches.indexOf(lifeBranch) + 6)];
  const movementBranches = [lifeBranch, migrationBranch];
  const tianjiJi = placedContacts.find(row => row.sourceScope === 'daily' && row.star === '天机' && row.kind === '忌'
    && verifiedStarBranch(row.star) === row.branch && movementBranches.includes(row.branch));
  const tianliangBranch = verifiedStarBranch('天梁'), horseBranch = verifiedStarBranch('天马');
  const pairRelation = tianliangBranch && horseBranch && palaceRelation(tianliangBranch, horseBranch);
  const liangMa = tianliangBranch && horseBranch && movementBranches.includes(tianliangBranch) && '寅申巳亥'.includes(horseBranch)
    && ((pairRelation === '同宫' && tianliangBranch === '寅')
      || ('申巳亥'.includes(tianliangBranch) && (pairRelation === '同宫' || pairRelation === '对宫')))
    ? { tianliangBranch, horseBranch, relation: pairRelation } : undefined;
  const dailyTravelReasons = [...(tianjiJi ? ['天机化忌'] : []), ...(liangMa ? ['梁马飘荡'] : [])];
  return { ...study, dailyPeachLuCandidate: Boolean(dailyPeachLu?.companions.length), dailyPeachLu,
    dailyTravelReasons, dailyTravelEvidence: tianjiJi || liangMa ? { tianjiJi, liangMa } : undefined };
}

// Source-specific table: do not change the shared/default iztro configuration.
// The author's 103/627 articles explicitly add Tianxiang Ji to Geng's Tiantong Ji.
export function lingTransformations(stem: string) {
  const row = table[stems.indexOf(stem)];
  if (!row) throw new RangeError('Unknown Ling transformation stem');
  return [...row.map((star, index) => ({ star, kind: ['禄', '权', '科', '忌'][index] })),
    ...(stem === '庚' ? [{ star: '天相', kind: '忌' }] : [])];
}

export function lingDoujun(yearBranch: string, birthMonth: number, birthHourBranch: string) {
  if (!branches.includes(yearBranch) || yearBranch.length !== 1 || !branches.includes(birthHourBranch)
    || birthHourBranch.length !== 1 || !Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12) {
    throw new RangeError('Invalid Ling Doujun basis');
  }
  return branches[mod12(branches.indexOf(yearBranch) - (birthMonth - 1) + branches.indexOf(birthHourBranch))];
}

function birthBasis(natal: Natal) {
  const date = natal.rawDates?.lunarDate;
  const hour = natal.rawDates?.chineseDate?.hourly?.[1];
  const yearStem = natal.rawDates?.chineseDate?.yearly?.[0];
  const yearBranch = natal.rawDates?.chineseDate?.yearly?.[1];
  const valid = date && Number.isInteger(date.lunarMonth) && date.lunarMonth >= 1 && date.lunarMonth <= 12
    && typeof date.isLeap === 'boolean' && typeof hour === 'string' && hour.length === 1 && branches.includes(hour)
    && typeof yearStem === 'string' && yearStem.length === 1 && stems.includes(yearStem);
  if (!valid) return undefined;
  const verifiedYearBranch = Number.isInteger(date.lunarYear) && stems[((date.lunarYear - 4) % 10 + 10) % 10] === yearStem
    && branches[mod12(date.lunarYear - 4)] === yearBranch ? yearBranch : undefined;
  return { month: date.lunarMonth, leap: date.isLeap, hour, yearStem, yearBranch: verifiedYearBranch };
}

function validPalaces(natal: Natal) {
  return Array.isArray(natal.palaces) && natal.palaces.length === 12
    && new Set(natal.palaces.map(palace => palace.index)).size === 12
    && new Set(natal.palaces.map(palace => palace.earthlyBranch)).size === 12
    && natal.palaces.every(palace => Number.isInteger(palace.index) && palace.index >= 0 && palace.index < 12
      && branches.includes(palace.earthlyBranch) && palace.earthlyBranch.length === 1
      && palace.index === mod12(branches.indexOf(palace.earthlyBranch) - 2)
      && [palace.majorStars, palace.minorStars, palace.adjectiveStars].every(Array.isArray));
}

export function buildLingZiweiWindow(window: { start: number; end: number }, period: PreviewPeriod,
  natal: Natal, decades: Decadal[]) {
  if (!Number.isSafeInteger(window.start) || !Number.isSafeInteger(window.end) || window.end <= window.start
    || window.end - window.start > 368 * dayMs) throw new RangeError('Invalid Ling window');
  const birth = birthBasis(natal);
  if (!birth || !validPalaces(natal)) return { status: 'unavailable', warnings: ['令东来口径缺少完整生月、生时或十二宫依据'], rows: [] } as const;
  const targets: Scope[] = period === 'year' ? ['decadal', 'yearly'] : period === 'month' ? ['decadal', 'yearly', 'monthly']
    : ['decadal', 'yearly', 'monthly', 'daily'];
  const cuts = new Set([window.start, window.end]);
  const includesDaily = targets.includes('daily');
  for (let at = beijingMidnight(window.start); at < window.end; at += dayMs) {
    if (at > window.start) cuts.add(at);
    const lateZi = at + dayMs - hourMs;
    // Only this hour can differ between the midnight and Zi-start day labels.
    if (includesDaily && window.start < lateZi && lateZi < window.end) cuts.add(lateZi);
  }
  const jieNames = new Map<number, string>();
  for (let term = nextSolarBoundary(window.start - 1); term.time < window.end; term = nextSolarBoundary(term.time)) {
    cuts.add(term.time);
    jieNames.set(term.time, term.name);
  }
  for (const decade of decades) for (const at of [decade.start, decade.end]) if (window.start < at && at < window.end) cuts.add(at);
  const points = [...cuts].sort((a, b) => a - b);
  const leapMonths = new Map<number, number>();
  const bathingPalaces = includesDaily ? natal.palaces.filter(palace => palace.changsheng12 === '沐浴') : [];
  const bathingBranch = bathingPalaces.length === 1 ? bathingPalaces[0].earthlyBranch : undefined;
  type Row = { start: number; end: number; scope: Scope; lifeBranch: string; sourceStem: string; yearStem: string;
    decadeStem?: string; decadeBranch?: string; monthStem?: string; lunarYear: number; lunarMonth?: number; lunarDay?: number;
    lunarMonthIsLeap?: boolean; sourceDayAgreed?: boolean;
    calendarReady: boolean; ready: boolean; reason?: string };
  const byScope = new Map(targets.map(scope => [scope, [] as Row[]]));
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1], end = points[i];
    const lunar = lunarAtBeijing(start) as Calendar;
    const year = lunar.getYear(), month = lunar.getMonth(), day = lunar.getDay();
    const yearPillar = lunar.getYearInGanZhi(), monthPillar = lunar.getMonthInGanZhiExact();
    const leapMonth = leapMonths.get(year) ?? lunarYears.LunarYear.fromYear(year).getLeapMonth();
    leapMonths.set(year, leapMonth);
    // The author starts at the first month. An insertion cannot change an earlier month.
    const flowMonthReady = month > 0 && (leapMonth === 0 || month <= leapMonth);
    const decade = decades.filter(decade => decade.start <= start && end <= decade.end);
    const decadeStem = decade.length === 1 && decade[0].stem.length === 1 && stems.includes(decade[0].stem) ? decade[0].stem : undefined;
    const decadeBranch = decade.length === 1 && decade[0].branch.length === 1 && branches.includes(decade[0].branch) ? decade[0].branch : '';
    const doujun = lingDoujun(yearPillar[1], birth.month, birth.hour);
    const monthBranch = branches[mod12(branches.indexOf(doujun) + Math.abs(month) - 1)];
    for (const scope of targets) {
      const calendarReady = scope === 'decadal' ? Boolean(decadeBranch) : scope === 'yearly' || (!birth.leap && flowMonthReady);
      const row: Row = { start, end, scope, lifeBranch: scope === 'decadal' ? decadeBranch : scope === 'yearly' ? yearPillar[1]
        : scope === 'monthly' ? monthBranch : branches[mod12(branches.indexOf(monthBranch) + day - 1)],
        sourceStem: scope === 'decadal' ? decadeStem ?? '' : scope === 'yearly' ? yearPillar[0]
          : scope === 'monthly' ? monthPillar[0] : lunar.getDayInGanZhiExact2()[0],
        yearStem: yearPillar[0], decadeStem, lunarYear: year,
        ...(period === 'year' && scope === 'yearly' && decadeBranch ? { decadeBranch } : {}),
        ...(scope === 'monthly' || scope === 'daily' ? { monthStem: monthPillar[0], lunarMonth: Math.abs(month), lunarMonthIsLeap: month < 0 } : {}),
        ...(scope === 'daily' ? { lunarDay: day, sourceDayAgreed: start < beijingMidnight(start) + dayMs - hourMs } : {}),
        calendarReady, ready: calendarReady && Boolean(decadeStem),
        reason: !calendarReady ? scope === 'decadal' ? '缺少唯一有效大限命宫'
          : birth.leap ? '闰生月的斗君起点仍待核' : '流年进入闰月后的月日续排仍待核'
          : !decadeStem ? '缺少唯一有效大限发干，不能完整合看各层四化' : undefined };
      const rows = byScope.get(scope)!;
      const previous = rows.at(-1);
      const identity = ({ start: _start, end: _end, ...value }: Row) => JSON.stringify(value);
      if (previous && previous.end === start && identity(previous) === identity(row)) previous.end = end;
      else rows.push(row);
    }
  }
  const expectedHongluanBranch = birth.yearBranch === undefined ? undefined : branches[mod12(3 - branches.indexOf(birth.yearBranch))];
  const checksNatalPositions = period === 'year' || includesDaily;
  const calculatedAuxiliary = checksNatalPositions ? quanshuAuxiliaryPositions(birth.month, birth.hour, birth.yearStem).named : [];
  const archivedAt = (star: string, branch: string, layer: 'majorStars' | 'minorStars' | 'adjectiveStars') => natal.palaces.flatMap(palace =>
    [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars].filter(row => row.name === star)).length === 1
    && natal.palaces.some(palace => palace.earthlyBranch === branch && palace[layer].some(row => row.name === star));
  // 令东来课件：文昌从戌起子逆数，文曲从辰起子顺数。
  const writingPlacements = calculatedAuxiliary.filter(({ star, branch }) => literaryStars.includes(star) && archivedAt(star, branch, 'minorStars'));
  // 令东来排盘诀只用出生年干所定的贵曜宫位组，并独立核对归档中的两颗辅曜。
  const noblePair = lingNoblePairs[stems.indexOf(birth.yearStem)];
  const archivedNobles = checksNatalPositions ? nobleStars.flatMap(star => {
    const branch = [...noblePair].find(branch => archivedAt(star, branch, 'minorStars'));
    return branch ? [{ star, branch }] : [];
  }) : [];
  const noblePlacements = new Set(archivedNobles.map(row => row.branch)).size === archivedNobles.length ? archivedNobles : [];
  const birthDay = natal.rawDates.lunarDate.lunarDay;
  // 三台从左辅顺数、八座从右弼逆数，两宫均起农历初一。
  const examPlacements = period === 'year' && !birth.leap && Number.isInteger(birthDay) && birthDay >= 1 && birthDay <= 30
    ? ([['三台', '左辅', 1], ['八座', '右弼', -1]] as const).flatMap(([star, anchor, direction]) => {
      const start = calculatedAuxiliary.find(row => row.star === anchor)?.branch;
      if (!start || !archivedAt(anchor, start, 'minorStars')) return [];
      const branch = branches[mod12(branches.indexOf(start) + direction * (birthDay - 1))];
      return archivedAt(star, branch, 'adjectiveStars') ? [{ star, branch }] : [];
    }) : [];
  const writingBranch = (star: string) => writingPlacements.find(row => row.star === star)?.branch;
  // The fixed natal star positions use the same birth-day and bureau calculation.
  const native = checksNatalPositions ? readQuanshuNatal(natal) : undefined;
  const verifiedMajors = native?.status === 'ready' ? quanshuBirthAnchoredMajorPositions(
    natal, quanshuLifeBureau(natal, native).verifiedLifeBureau, star => {
      const seat = natal.palaces.find(palace => palace.majorStars.some(row => row.name === star));
      return seat && archivedAt(star, seat.earthlyBranch, 'majorStars') ? seat.earthlyBranch : undefined;
    }) : undefined;
  const lingAnnualMajorBirthAnchorProof = verifiedMajors?.ziweiBirthAnchorVerified === true
    ? quanshuZiweiBirthAnchorProof : undefined;
  const nativeYearStars = quanshuLuYangTuo(birth.yearStem);
  // 令东来〈火铃夹命格〉所举午年未时实例与这一组三合年起点一致。
  const dailyFireBell = includesDaily && birth.yearBranch && '寅午戌'.includes(birth.yearBranch)
    ? readQuanshuArchivedFireBell(natal, birth.yearBranch, birth.hour).verifiedArchivedFireBell : [];
  const dailyYangBranch = includesDaily && archivedAt('擎羊', nativeYearStars.qingyangBranch, 'minorStars')
    ? nativeYearStars.qingyangBranch : undefined;
  // 令东来明确采用生年支天马。
  const annualHorse = includesDaily && birth.yearBranch
    ? [{ star: '天马', branch: '寅亥申巳'[branches.indexOf(birth.yearBranch) % 4] }] : [];
  const checkedAuxiliary = new Map([...calculatedAuxiliary, ...noblePlacements, ...annualHorse, { star: '禄存', branch: nativeYearStars.lucunBranch }]
    .filter(({ star, branch }) => archivedAt(star, branch, 'minorStars')).map(({ star, branch }) => [star, branch]));
  const verifiedStarBranch = (star: string) => checkedAuxiliary.get(star) ?? verifiedMajors?.positions.get(star);
  const voids = period === 'year' || byScope.get('daily')?.length ? quanshuKongJiePositions(natal) : undefined;
  const skyBranch = voids?.ready ? voids.skyBranch : voids?.verifiedSkyBranch;
  const robberyBranch = voids?.ready ? voids.robberyBranch : voids?.verifiedRobberyBranch;
  const voidPlacements = [
    ...(skyBranch ? [{ star: '地空', branch: skyBranch }] : []),
    ...(robberyBranch ? [{ star: '地劫', branch: robberyBranch }] : []),
  ];
  const rows = [...byScope.values()].flat().map(row => {
    const sourceStems = [{ scope: 'natal', stem: birth.yearStem },
      ...(row.decadeStem ? [{ scope: 'decadal', stem: row.decadeStem }] : []),
      ...(row.scope !== 'decadal' ? [{ scope: 'yearly', stem: row.yearStem }] : []),
      ...(row.scope === 'monthly' || row.scope === 'daily' ? [{ scope: 'monthly', stem: row.monthStem! }] : []),
      ...(row.scope === 'daily' ? [{ scope: 'daily', stem: row.sourceStem }] : [])];
    const palaces = row.lifeBranch ? natal.palaces.map(palace => {
      const distance = mod12(branches.indexOf(row.lifeBranch) - branches.indexOf(palace.earthlyBranch));
      return { palaceIndex: palace.index, branch: palace.earthlyBranch, natalName: palace.name, gender: String(natal.gender),
        brightStarNames: [...palace.majorStars, ...palace.minorStars].filter(star => ['庙', '旺'].includes(star.brightness ?? '')).map(star => String(star.name)),
        flowName: palaceNames[distance], localStarNames: [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars].map(star => String(star.name)),
        dailyVerifiedMajorStars: row.scope === 'daily' && row.calendarReady
          ? palace.majorStars.map(star => String(star.name))
            .filter(star => verifiedMajors?.positions.get(star) === palace.earthlyBranch)
          : undefined,
        dailyVerifiedAuxiliaryStars: row.scope === 'daily' && row.calendarReady
          ? [
            ...(writingBranch('文昌') === palace.earthlyBranch ? ['文昌'] : []),
            ...(dailyYangBranch === palace.earthlyBranch ? ['擎羊'] : []),
            ...dailyFireBell.filter(star => star.branch === palace.earthlyBranch).map(star => star.star),
          ] : undefined };
    }) : [];
    const life = palaces.find(palace => palace.flowName === '命宫');
    const area = life ? [life.branch, branches[mod12(branches.indexOf(life.branch) + 4)],
      branches[mod12(branches.indexOf(life.branch) + 6)], branches[mod12(branches.indexOf(life.branch) + 8)]] : [];
    const yearlyGeometryReady = row.calendarReady && period === 'year' && row.scope === 'yearly';
    const contacts = sourceStems.flatMap(source => lingTransformations(source.stem).map(transformation => {
      const placements = palaces.filter(palace => palace.localStarNames.includes(transformation.star));
      const located = placements.length === 1 && placements[0].localStarNames.filter(star => star === transformation.star).length === 1;
      const verifiedYearlyMajorRecipient = yearlyGeometryReady && source.scope === 'yearly' && located
        && verifiedMajors?.positions.get(transformation.star) === placements[0].branch;
      return { ...transformation, sourceScope: source.scope, sourceStem: source.stem, placements,
        located, verifiedYearlyMajorRecipient };
    }));
    const ready = row.ready && contacts.every(contact => contact.located);
    const jieName = row.scope === 'monthly' && row.calendarReady ? jieNames.get(row.start) : undefined;
    const previous = jieName ? lunarAtBeijing(row.start - 1) as Calendar : undefined;
    const beforeStem = previous?.getMonthInGanZhiExact()[0];
    const jieWithinSameMonth = previous && previous.getYear() === row.lunarYear && previous.getMonth() === row.lunarMonth
      && beforeStem && beforeStem !== row.sourceStem;
    const beforeTransformations = jieWithinSameMonth && beforeStem ? lingTransformations(beforeStem).map(transformation => ({
      ...transformation, branch: uniqueStarBranch(palaces, transformation.star),
    })) : undefined;
    const monthJie = jieName && beforeTransformations?.every(transformation => transformation.branch)
      && contacts.filter(contact => contact.sourceScope === 'monthly').every(contact => uniqueStarBranch(palaces, contact.star))
      ? { name: jieName, at: new Date(row.start).toISOString(), beforeStem, beforeTransformations } : undefined;
    const decadalGeometryReady = row.calendarReady && period === 'year' && row.scope === 'decadal';
    const taiyinBranch = yearlyGeometryReady || decadalGeometryReady ? verifiedMajors?.positions.get('太阴') : undefined;
    const wenchangBranch = taiyinBranch ? writingBranch('文昌') : undefined;
    const taiyinBrightness = taiyinBranch ? lingTaiyinBrightness(taiyinBranch) : undefined;
    // The author's Wenchang article lists these six palaces together as 庙 or 旺.
    const wenchangBrightness = wenchangBranch ? {
      wenchangBrightnessProfile: lingZiweiPolicy.wenchangBrightness,
      wenchangInAuthorBrightPalace: '申子辰巳酉丑'.includes(wenchangBranch),
      // The separate 星情资料 published on the author's site explicitly lists 亥 as 庙.
      wenchangHaiTempleInAuthorStarNotes: wenchangBranch === '亥',
    } : undefined;
    const taiyinWenchangInLifeArea = taiyinBranch && wenchangBranch ? area.includes(taiyinBranch) && area.includes(wenchangBranch) : undefined;
    const decadeLifeTaiyinWenchangVerified = decadalGeometryReady && taiyinWenchangInLifeArea === true
      && (taiyinBrightness === '庙' || taiyinBrightness === '旺');
    const decadalConditions = decadalGeometryReady && (ready || decadeLifeTaiyinWenchangVerified) && taiyinBranch && wenchangBranch ? {
      taiyinTable: lingZiweiPolicy.taiyinBrightness, lingAnnualMajorBirthAnchorProof,
      natalLiteraryPlacementProof: lingZiweiPolicy.natalLiteraryPlacementProof,
      taiyinBrightness,
      ...wenchangBrightness,
      taiyinBranch, wenchangBranch,
      taiyinBirthDaylight: '寅卯辰巳午未'.includes(birth.hour) ? 'day' : 'night',
      taiyinWenchangInLifeArea, decadeLifeTaiyinWenchangVerified,
    } : undefined;
    const writingStars = yearlyGeometryReady ? writingPlacements.filter(row => area.includes(row.branch)) : [];
    const literaryTransforms = yearlyGeometryReady ? contacts.flatMap(contact => {
      if (!contact.located || !['科', '权'].includes(contact.kind) || !ready && contact.sourceScope !== 'yearly') return [];
      const [placement] = contact.placements;
      if (!area.includes(placement.branch)) return [];
      if (literaryStars.includes(contact.star) && writingBranch(contact.star) !== placement.branch) return [];
      if (contact.sourceScope === 'yearly' && verifiedStarBranch(contact.star) !== placement.branch) return [];
      return [{ star: contact.star, kind: contact.kind, sourceScope: contact.sourceScope, sourceStem: contact.sourceStem, branch: placement.branch }];
    }) : [];
    const annualLiteraryKinds = [...new Set(literaryTransforms.filter(contact => contact.sourceScope === 'yearly')
      .map(contact => contact.kind))];
    const yearLifeLiteraryPairVerified = writingStars.length === 2
      && annualLiteraryKinds.includes('科') && annualLiteraryKinds.includes('权');
    const yearLifeExamStars = yearlyGeometryReady ? examPlacements.filter(row => area.includes(row.branch)) : [];
    const yearLifeExamKeOpposition = literaryTransforms.find(contact => contact.sourceScope === 'yearly' && contact.kind === '科'
      && palaceRelation(row.lifeBranch, contact.branch) === '对宫');
    const yearLifeExamStructureVerified = writingStars.length === 2 && yearLifeExamStars.length === 2 && yearLifeExamKeOpposition !== undefined;
    const yearLifeNobles = noblePlacements.filter(row => area.includes(row.branch));
    const yearLifeExamKeWithNoblesVerified = writingStars.length === 2 && annualLiteraryKinds.includes('科')
      && new Set(yearLifeNobles.map(row => row.branch)).size === 2;
    const literaryConditions = {
      natalLiteraryPlacementProof: lingZiweiPolicy.natalLiteraryPlacementProof,
      yearLifeAreaWritingStars: writingStars,
      yearLifeAreaWritingStarNames: writingStars.map(placement => placement.star),
      yearLifeAreaLiteraryTransforms: literaryTransforms,
      yearLifeAreaLiteraryKinds: [...new Set(literaryTransforms.map(contact => contact.kind))],
      yearLifeAreaAnnualLiteraryKinds: annualLiteraryKinds,
      yearLifeLiteraryPairVerified,
      yearLifeExamStars, yearLifeExamKeOpposition, yearLifeExamStructureVerified,
      yearLifeNobles, yearLifeExamKeWithNoblesVerified,
    };
    const archivedHongluanBranch = yearlyGeometryReady ? uniqueStarBranch(palaces, '红鸾') : undefined;
    const natalHongluanBranch = archivedHongluanBranch && archivedHongluanBranch === expectedHongluanBranch
      && natal.palaces.find(palace => palace.earthlyBranch === archivedHongluanBranch)?.adjectiveStars.some(star => star.name === '红鸾')
      ? archivedHongluanBranch : undefined;
    const yearLifeKeScopes = literaryTransforms.filter(contact => contact.kind === '科' && contact.branch === row.lifeBranch
      && verifiedStarBranch(contact.star) === row.lifeBranch).map(contact => contact.sourceScope);
    const natalHongluanInYearLife = natalHongluanBranch === undefined ? undefined : natalHongluanBranch === row.lifeBranch;
    const yearLifeRomancePairVerified = natalHongluanInYearLife === true && yearLifeKeScopes.includes('yearly');
    const yearLifeVerifiedStars = yearlyGeometryReady
      ? [...literaryStars, '左辅', '右弼', ...nobleStars].filter(star => verifiedStarBranch(star) === row.lifeBranch) : undefined;
    const yearLifeFinance = yearlyGeometryReady ? contacts.filter(contact => contact.located && contact.sourceScope === 'yearly'
      && ['武曲', '太阴'].includes(contact.star) && ['禄', '忌'].includes(contact.kind)
      && contact.placements[0]?.branch === row.lifeBranch && verifiedStarBranch(contact.star) === row.lifeBranch) : [];
    const yearlyConditions = yearlyGeometryReady && (ready || yearLifeRomancePairVerified) ? {
      ...literaryConditions,
      ...wenchangBrightness,
      taiyinWenchangCoGuardDecadeLife: row.decadeBranch && taiyinBranch && wenchangBranch && taiyinBrightness
        ? taiyinBranch === row.decadeBranch && wenchangBranch === row.decadeBranch && ['庙', '旺'].includes(taiyinBrightness)
        : undefined,
      yearLifeKeScopes, yearLifeRomancePairVerified, lingAnnualMajorBirthAnchorProof,
      natalHongluanBranch,
      natalHongluanProof: expectedHongluanBranch === undefined ? undefined : { expectedBranch: expectedHongluanBranch,
        archivedBranch: archivedHongluanBranch, verified: natalHongluanBranch !== undefined },
      natalHongluanInYearLife,
      yearLifeVerifiedStars,
      yearLifeFinanceKinds: yearLifeFinance.map(contact => contact.kind),
      yearLifeVoidPairVerified: Boolean(skyBranch && robberyBranch && skyBranch === row.lifeBranch && robberyBranch === row.lifeBranch),
      natalTianfuYearLifeZiwei: native?.status === 'ready' && verifiedStarBranch('天府') === native.lifeBranch
        && verifiedStarBranch('紫微') === row.lifeBranch,
    } : yearLifeLiteraryPairVerified || yearLifeExamStructureVerified || yearLifeExamKeWithNoblesVerified ? literaryConditions : undefined;
    const dailyConditions = row.calendarReady && row.scope === 'daily'
      ? dailyLifeConditions(palaces, row.lifeBranch, area, contacts, voidPlacements, verifiedStarBranch,
        ready, row.decadeStem !== undefined, bathingBranch)
      : undefined;
    return { ...row, profile: lingZiweiPolicy.profile, tableVersion: lingZiweiPolicy.table,
      palaces, lifeAreaBranches: area, contacts, ready, monthJie, lifeConditions: decadalConditions ?? yearlyConditions ?? dailyConditions };
  });
  const warnings = [...new Set(rows.flatMap(row => [
    ...(row.reason ? [row.reason] : []), ...(!row.contacts.every(contact => contact.located) ? ['部分受化星未在唯一宫位定位'] : []),
  ]))];
  return { status: warnings.length ? 'partial' : 'ready', warnings, rows } as const;
}
