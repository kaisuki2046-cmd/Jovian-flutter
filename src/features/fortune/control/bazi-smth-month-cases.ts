import * as LunarPackage from 'lunar-javascript';
import { smthLuNextBranch } from './bazi-annual-luck';
import { baziInteractions, describeBaZiPillar } from './bazi-calculation';
import { schoolLuckEntryAges } from './bazi-school';
import { lunarAtBeijing } from './fortune-calendar';

const lunar = LunarPackage as unknown as {
  Lunar: { fromYmd(year: number, month: number, day: number): { getSolar(): { toYmd(): string } } };
  LunarYear: { fromYear(year: number): { getMonth(month: number): { getDayCount(): number } } };
};
const natalPositions = ['year', 'month', 'day', 'hour'] as const;
const virtuePillars = ['甲寅', '丙辰', '戊辰', '庚辰', '壬戌'];
type Natal = Record<typeof natalPositions[number], string>;
type Range = { start: number; end: number };
type Luck = Range & { pillar: string };

export const smthMonthCasePolicy = {
  profile: 'smth-volume-six-monthly-cases-v1',
  clashProfile: 'smth-tai-sui-jia-wu-month-v1',
  fireProfile: 'smth-fire-assembly-jia-xu-month-v1',
  calendar: 'beijing-li-chun-and-jie-month-with-separate-lunar-fourth-candidate',
} as const;

function nativePillars(natal: Natal) {
  return natalPositions.map(layer => ({ id: 'natal:' + layer, pillar: natal[layer] }));
}

export function smthTaiSuiClashMonth(natal: Natal, year: string, month: string, luck?: Luck) {
  const base = { profile: smthMonthCasePolicy.clashProfile };
  // The Xinchou edition reads 己丑, which can produce the printed 乙亥 month.
  if (natal.year !== '己丑' || natal.month !== '乙亥' || natal.day !== '壬申' || natal.hour !== '乙巳'
    || year !== '丙寅' || month !== '甲午') return { ...base, matchesPublishedGeometry: false };
  if (!luck) return { ...base, matchesPublishedGeometry: undefined };
  if (luck.pillar !== '辛未') return { ...base, matchesPublishedGeometry: false };

  const upper = [...nativePillars(natal), { id: 'decadal', pillar: luck.pillar }, { id: 'flow:year', pillar: year }];
  const upperRelations = baziInteractions(upper);
  const punishment = upperRelations.groups.find(row => row.kind === '三刑' && row.values === '寅巳申');
  const dayToYear = upperRelations.pairs.filter(row => row.members.includes('natal:day') && row.members.includes('flow:year'));
  const dayStemControlsYear = upperRelations.elemental.some(row => row.part === 'stem' && row.from === 'natal:day'
    && row.to === 'flow:year' && row.kind === '前克后');
  const dayBranchControlsYear = upperRelations.elemental.some(row => row.part === 'branch' && row.from === 'natal:day'
    && row.to === 'flow:year' && row.kind === '前克后');
  const luckYearStemCombine = upperRelations.pairs.some(row => row.kind === '天干五合'
    && row.members.includes('decadal') && row.members.includes('flow:year'));
  const yinHaiCombine = upperRelations.pairs.some(row => row.kind === '六合'
    && row.members.includes('natal:month') && row.members.includes('flow:year'));
  const woodMembers = upper.filter(row => '亥卯未'.includes(row.pillar[1]));
  const luckWoodOutput = describeBaZiPillar(luck.pillar, natal.day[0]).hiddenStems.find(row =>
    row.element === '木' && row.tenGod === '伤官');
  const withMonth = baziInteractions([...upper, { id: 'flow:month', pillar: month }]);
  const fireMeeting = withMonth.groups.find(row => row.kind === '三会' && row.values === '巳午未');
  const mainQi = describeBaZiPillar(month).hiddenStems[0];
  return { ...base, natalYear: natal.year, year, month, luck: luck.pillar, punishment: punishment?.byBranch,
    dayStemControlsYear, dayBranchControlsYear, luckYearStemCombine, yinHaiCombine, woodMembers,
    luckWoodOutput: luckWoodOutput && { branch: luck.pillar[1], stem: luckWoodOutput.stem, tenGod: luckWoodOutput.tenGod },
    fireMeeting: fireMeeting?.byBranch,
    monthMainQi: mainQi?.stem, stageStart: new Date(luck.start).toISOString(), stageEnd: new Date(luck.end).toISOString(),
    matchesPublishedGeometry: dayStemControlsYear && dayBranchControlsYear && dayToYear.some(row => row.kind === '六冲')
      && punishment?.byBranch[0].includes('flow:year') === true && punishment.byBranch[1].includes('natal:hour')
      && punishment.byBranch[2].includes('natal:day') && luckYearStemCombine && yinHaiCombine && !!luckWoodOutput
      && fireMeeting?.byBranch[1].includes('flow:month') === true };
}

export function smthFireAssemblyMonth(natal: Natal, year: string, month: string, luck?: Luck) {
  const base = { profile: smthMonthCasePolicy.fireProfile };
  if (natal.year !== '壬午' || natal.month !== '癸丑' || natal.day !== '庚寅' || natal.hour !== '丙戌'
    || year !== '甲戌' || month !== '甲戌') return { ...base, matchesPublishedGeometry: false };
  const native = nativePillars(natal);
  const isFire = (row: { kind: string; values: string }) => row.kind === '三合' && row.values === '寅午戌';
  const natalFire = baziInteractions(native).groups.find(isFire);
  if (!natalFire) return { ...base, matchesPublishedGeometry: false };
  if (!luck) return { ...base, matchesPublishedGeometry: undefined };
  if (luck.pillar !== '戊午') return { ...base, matchesPublishedGeometry: false };

  const columns = [...native, { id: 'decadal', pillar: luck.pillar }, { id: 'flow:year', pillar: year }, { id: 'flow:month', pillar: month }];
  const { groups, pairs } = baziInteractions(columns);
  const withFlowsFire = groups.find(isFire);
  const wuGui = pairs.some(row => row.kind === '天干五合'
    && row.members.includes('decadal') && row.members.includes('natal:month'));
  const stems = columns.filter(row => ['壬', '癸'].includes(row.pillar[0])).map(row => ({ id: row.id, stem: row.pillar[0] }));
  const hidden = columns.flatMap(row => describeBaZiPillar(row.pillar).hiddenStems.filter(stem => stem.element === '水')
    .map(stem => ({ id: row.id, branch: row.pillar[1], stem: stem.stem })));
  const natalSiPositions = native.filter(row => row.pillar[1] === '巳').map(row => row.id);
  return { ...base, year, month, luck: luck.pillar, natalMonth: natal.month, natalFire: natalFire.byBranch,
    withFlowsFire: withFlowsFire?.byBranch, wuGui, waterStems: stems, waterHiddenStems: hidden, natalSiPositions,
    natalFireSeason: '寅午戌'.includes(natal.month[1]), flowFireSeason: '寅午戌'.includes(month[1]),
    stageStart: new Date(luck.start).toISOString(), stageEnd: new Date(luck.end).toISOString(),
    matchesPublishedGeometry: wuGui && withFlowsFire?.byBranch[2].includes('flow:year') === true
      && withFlowsFire.byBranch[2].includes('flow:month') };
}

export function smthDragonBackMonth(natal: Natal, year: string, month: string) {
  const base = { profile: smthMonthCasePolicy.profile };
  if (natal.year !== '己丑' || natal.month !== '戊辰' || natal.day !== '壬辰' || natal.hour !== '庚子'
    || year !== '戊辰' || month !== '乙卯') return { ...base, matchesPublishedGeometry: false };

  const native = nativePillars(natal);
  const columns = [...native, { id: 'flow:year', pillar: year }, { id: 'flow:month', pillar: month }];
  const positions = columns.map(({ id, pillar }) => ({ id, ...describeBaZiPillar(pillar, natal.day[0]) }));
  const earthStems = positions.filter(row => row.stemElement === '土').map(({ id, stem, tenGod }) => ({ id, stem, tenGod }));
  const earthMainQi = positions.filter(row => row.hiddenStems[0]?.element === '土')
    .map(({ id, branch, hiddenStems: [mainQi] }) => ({ id, branch, stem: mainQi.stem, tenGod: mainQi.tenGod }));
  const natalWaterMembers = native.filter(row => ['申', '子'].includes(row.pillar[1]));
  const monthTenGod = positions.find(row => row.id === 'flow:month')?.tenGod;
  return { ...base, native, year, month, earthStems, earthMainQi, natalWaterMembers, monthTenGod,
    matchesPublishedGeometry: earthStems.some(row => row.id === 'flow:year' && row.stem === '戊' && row.tenGod === '七杀') };
}

export function smthDayVirtueMonth(natal: Natal & { utc: string }, year: string, month: string, range: Range,
  luck?: Luck, birthTimeZone?: string) {
  if (natal.year !== '庚辰' || natal.month !== '己卯' || natal.day !== '戊辰' || natal.hour !== '甲寅' || year !== '丁巳') return [];
  const localLunar = lunarAtBeijing(range.start) as ReturnType<typeof lunarAtBeijing> & { getYear(): number };
  const lunarYear = localLunar.getYear();
  const lunarStart = Date.parse(lunar.Lunar.fromYmd(lunarYear, 4, 1).getSolar().toYmd() + 'T00:00:00+08:00');
  const lunarEnd = lunarStart + lunar.LunarYear.fromYear(lunarYear).getMonth(4).getDayCount() * 86_400_000;
  const windows = [
    ...(month === '乙巳' ? [{ ...range, monthBasis: 'jie-si-month' }] : []),
    { start: Math.max(range.start, lunarStart), end: Math.min(range.end, lunarEnd), monthBasis: 'regular-lunar-fourth' },
  ].filter(window => window.start < window.end);
  if (!windows.length) return [];
  const sourceAge = schoolLuckEntryAges(Date.parse(natal.utc), windows[0].start, birthTimeZone);
  const sourceAge38 = sourceAge && sourceAge.liChunOrdinal === 38 && sourceAge.lunarOrdinal === 38;

  const native = nativePillars(natal);
  const dayVirtuePositions = native.filter(row => virtuePillars.includes(row.pillar));
  const dayStem = natal.day[0];
  const bladeBranch = smthLuNextBranch(dayStem).bladeBranch;
  const moving = luck?.pillar === '壬午' ? describeBaZiPillar(luck.pillar, dayStem) : undefined;
  const movingBladePeer = moving?.hiddenStems.find(row => row.tenGod === '劫财');
  const sourceLuckWealthBlade = moving && moving.branch === bladeBranch && moving.tenGod === '偏财' && movingBladePeer
    ? { wealthStem: moving.stem, wealthGod: moving.tenGod, bladeBranch, bladePeerStem: movingBladePeer.stem, bladePeerGod: movingBladePeer.tenGod }
    : undefined;
  const compared = baziInteractions([...native, { id: 'flow:year', pillar: year }]);
  const yearHourPunishment = compared.pairs.some(row => row.kind === '相刑'
    && row.members.includes('natal:hour') && row.members.includes('flow:year'));
  const yearStemControlsHour = compared.elemental.some(row => row.part === 'stem' && row.from === 'natal:year'
    && row.to === 'natal:hour' && row.kind === '前克后');
  const matchesPublishedGeometry = luck ? Boolean(sourceLuckWealthBlade)
    && dayVirtuePositions.length === 3 && yearHourPunishment && yearStemControlsHour : undefined;
  return windows.map(({ start, end, monthBasis }) => ({ start, end, payload: {
    profile: smthMonthCasePolicy.profile, monthBasis, dayVirtuePositions, bladeBranch, sourceLuckWealthBlade, yearHourPunishment, yearStemControlsHour,
    year, month, sourceAge, sourceAge38, luck: luck?.pillar, stageStart: luck && new Date(luck.start).toISOString(),
    stageEnd: luck && new Date(luck.end).toISOString(), matchesPublishedGeometry,
  } }));
}
