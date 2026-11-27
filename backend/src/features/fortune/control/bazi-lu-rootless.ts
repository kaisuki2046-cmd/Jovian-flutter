import { baziInteractions, describeBaZiPillar } from './bazi-calculation';
import { baziNatalConditions } from './bazi-conditions';
import { baziSourceContextPolicy, luPublishedDayRange } from './bazi-source-context';
import { civilClockEpoch } from './period-window';

type Natal = Parameters<typeof baziNatalConditions>[0] & { utc: string };
type Range = { start: number; end: number };
type Luck = Range & { pillar: string };

export const luRootlessDayPolicy = {
  profile: 'lu-rootless-case-56-v1', dayClock: baziSourceContextPolicy.dayClock,
  birthDate: '1957-02-19', sourceDate: '1997-09-02', stemYears: 5,
} as const;
const sourceDayStart = Date.parse(luRootlessDayPolicy.sourceDate + 'T00:00:00+08:00');

export function luRootlessDayRange(range: Range) {
  return luPublishedDayRange(range, sourceDayStart);
}

// The caller has already verified the archived natal clock and the effective flow segments.
export function luRootlessDayCase(natal: Natal, birthTimeZone: string, year: string, month: string, day: string, luck?: Luck) {
  const { profile, dayClock, sourceDate } = luRootlessDayPolicy;
  const base = { profile, dayClock, sourceDate };
  if (natal.year !== '丁酉' || natal.month !== '壬寅' || natal.day !== '壬戌' || natal.hour !== '壬寅'
    || year !== '丁丑' || month !== '戊申' || day !== '丁未') return { ...base, matchesPublishedGeometry: false };
  const birthDate = new Date(civilClockEpoch(Date.parse(natal.utc), birthTimeZone)).toISOString().slice(0, 10);
  if (birthDate !== luRootlessDayPolicy.birthDate) return { ...base, matchesPublishedGeometry: false };
  if (!luck) return { ...base, matchesPublishedGeometry: undefined };
  if (luck.pillar !== '戊戌') return { ...base, matchesPublishedGeometry: false };
  const branchHalf = new Date(luck.start);
  branchHalf.setUTCFullYear(branchHalf.getUTCFullYear() + luRootlessDayPolicy.stemYears);
  const sourceBranchHalf = branchHalf.getTime() <= sourceDayStart && sourceDayStart < luck.end;

  const native = (['year', 'month', 'day', 'hour'] as const).map(layer => ({ id: 'natal:' + layer, pillar: natal[layer] }));
  const moving = [{ id: 'decadal', pillar: luck.pillar }, { id: 'flow:year', pillar: year },
    { id: 'flow:month', pillar: month }, { id: 'flow:day', pillar: day }];
  const { stemConditions } = baziNatalConditions(natal, true);
  const root = stemConditions.find(row => row.stem === '壬')!;
  const renStemPositions = native.filter(row => row.pillar[0] === '壬').map(row => row.id);
  const mainQi = (rows: typeof moving) => rows.map(({ id, pillar }) => {
    const { hiddenStems, tenGod } = describeBaZiPillar(pillar, natal.day[0]);
    return { id, pillar, tenGod, mainQi: hiddenStems[0], holdsWater: hiddenStems.some(stem => stem.element === '水') };
  });
  const { pairs, groups } = baziInteractions([...native, ...moving]);
  const involves = (members: string[], first: string, second: string) => members.includes(first) && members.includes(second);
  const contacts = (kind: string, branches: string) => pairs.filter(row => row.kind === kind
    && (row.values === branches || row.values === branches[1] + branches[0]));
  const dingRen = contacts('天干五合', '丁壬').filter(row => row.members.includes('natal:day'));
  const chouXu = contacts('相刑', '丑戌').filter(row => row.members.includes('flow:year'));
  const youXu = contacts('六害', '酉戌').filter(row => row.members.includes('natal:year'));
  const yinShen = contacts('六冲', '寅申').filter(row => row.members.includes('flow:month'));
  const chouXuWei = groups.find(row => row.kind === '三刑' && row.values === '丑戌未');

  return { ...base, natal: mainQi(native), moving: mainQi(moving), renStemPositions, rootPositions: root.rootPositions,
    dingRen, chouXu, youXu, yinShen, chouXuWei: chouXuWei?.byBranch,
    archingColumns: [['natal:month', 'natal:day'], ['natal:day', 'natal:hour']],
    stageStart: new Date(luck.start).toISOString(), stageEnd: new Date(luck.end).toISOString(),
    branchHalfStartsAt: branchHalf.toISOString(), sourceBranchHalf,
    matchesPublishedGeometry: root.rooted === false && renStemPositions.length === 3
      && ['natal:year', 'flow:year', 'flow:day'].every(id => dingRen.some(row => involves(row.members, 'natal:day', id)))
      && chouXu.some(row => involves(row.members, 'flow:year', 'natal:day'))
      && youXu.some(row => involves(row.members, 'natal:year', 'natal:day'))
      && ['natal:month', 'natal:hour'].every(id => yinShen.some(row => involves(row.members, 'flow:month', id)))
      && chouXuWei?.byBranch[0].includes('flow:year') === true && chouXuWei.byBranch[1].includes('decadal')
      && chouXuWei.byBranch[2].includes('flow:day') };
}
