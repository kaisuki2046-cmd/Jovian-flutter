import { baziInteractions, describeBaZiPillar } from './bazi-calculation';
import { apparentSolarEpoch, fateClearSolarDayPolicy } from './bazi-apparent-solar-time';
import { fateClearBalancePolicy, fateClearBaseBalance } from './bazi-fateclear-balance';
import { lunarAtBeijing, lunarAtCivilClock } from './fortune-calendar';
import { nextSolarBoundary } from './fortune-preview';

const natalLayers = ['year', 'month', 'day', 'hour'] as const;
const natalTrineElements = [
  { branches: '申子辰', element: '水' }, { branches: '亥卯未', element: '木' },
  { branches: '寅午戌', element: '火' }, { branches: '巳酉丑', element: '金' },
] as const;
type Natal = { utc: string; apparentBornAt?: number } & Record<typeof natalLayers[number], string>;
type PublishedLuck = { pillar: string; genderBasis: string };

export const fateClearBaziPolicy = {
  profile: 'fateclear-branch-and-example-v1',
  monthlyClock: 'beijing-instant-solar-term-month',
  monthlyWindow: 'fateclear-full-jie-month-midpoint-v1',
  dailyClock: fateClearSolarDayPolicy,
  balance: fateClearBalancePolicy,
  clashReview: 'fateclear-direct-clash-role-and-combination-v1',
  combinations: 'separate-native-and-moving-branch-positions-no-rescue-inference',
  examples: 'published-civil-birth-and-pillars-with-confirmed-sex-specific-luck',
} as const;

export function fateClearJieMonth(at: number) {
  const previous = lunarAtBeijing(at).getPrevJie() as { getName(): string; getSolar(): { toYmdHms(): string } } | null;
  if (!previous) return undefined;
  const start = Date.parse(previous.getSolar().toYmdHms().replace(' ', 'T') + '+08:00');
  const next = nextSolarBoundary(at);
  if (!(start <= at)) return undefined;
  const midpoint = start + Math.floor((next.time - start) / 2);
  const representative = lunarAtBeijing(midpoint);
  return { profile: fateClearBaziPolicy.monthlyWindow, start, end: next.time, midpoint,
    startTerm: previous.getName(), endTerm: next.name,
    annualPillar: representative.getYearInGanZhiExact(), monthPillar: representative.getMonthInGanZhiExact() };
}

const stemThemes: Readonly<Record<string, string>> = {
  正财: '财星', 偏财: '财星', 正官: '官杀', 七杀: '官杀', 正印: '印星', 偏印: '印星', 食神: '食伤', 伤官: '食伤',
};

export function repeatedMonthStemTheme(dayMaster: string, current: NonNullable<ReturnType<typeof fateClearJieMonth>>, stageStart: number) {
  const previous = fateClearJieMonth(current.start - 1);
  if (!previous || previous.end !== current.start || previous.annualPillar !== current.annualPillar || previous.start < stageStart) return;
  const god = describeBaZiPillar(current.monthPillar, dayMaster).tenGod;
  const previousGod = describeBaZiPillar(previous.monthPillar, dayMaster).tenGod;
  const theme = god && stemThemes[god];
  if (theme && previousGod && theme === stemThemes[previousGod]) return { theme, previousMonthPillar: previous.monthPillar };
}

const monthlyExamples = [
  { id: 'strong_ji_renzi_jiachen', birth: '1959-11-02T17:15:00.000Z', apparentBirth: '1959-11-03T01:16:00Z', genderBasis: '男',
    pillars: ['己亥', '甲戌', '己丑', '乙丑'], year: '壬子', month: '甲辰',
    strength: '身强', useful: '木', supportive: ['水', '金'], adverse: ['土'] },
  { id: 'weak_jia_jisi_bingyin', birth: '1979-05-17T10:45:00.000Z', apparentBirth: '1979-05-17T18:34:00Z', genderBasis: '女',
    pillars: ['己未', '己巳', '甲申', '癸酉'], year: '己巳', month: '丙寅',
    strength: '身弱', useful: '水', supportive: ['木'], adverse: ['火', '土'] },
] as const;

const dailyExamples = [
  { id: 'strong_gui_bingshen', birth: '1973-09-24T01:45:00.000Z', apparentBirth: '1973-09-24T09:39:00Z',
    genderBasis: '男', luck: '庚申', date: '1983-09-05', day: '丙申',
    pillars: ['癸丑', '辛酉', '癸亥', '丁巳'], strength: '身强', useful: '火', supportive: ['木', '土'], adverse: ['水'] },
  { id: 'weak_gui_gengchen', birth: '1980-03-10T22:30:00.000Z', apparentBirth: '1980-03-11T06:05:00Z',
    genderBasis: '女', luck: '戊寅', date: '1986-02-05', day: '庚辰',
    pillars: ['庚申', '己卯', '癸未', '乙卯'], strength: '身弱', useful: '金', supportive: ['水'], adverse: ['木', '土'] },
] as const;

const balanceExamples = [
  { birth: '1961-07-18T18:30:00.000Z', apparentBirth: '1961-07-19T02:09:00Z', genderBasis: '女',
    pillars: ['辛丑', '乙未', '癸丑', '癸丑'], strength: '身弱', useful: '金', supportive: ['水'], adverse: ['火', '土'] },
  { birth: '1989-03-19T06:15:00.000Z', apparentBirth: '1989-03-19T13:52:00Z', genderBasis: '男',
    pillars: ['己巳', '丁卯', '戊寅', '己未'], strength: '身强', useful: '水', supportive: ['木', '金'], adverse: ['土'], neutral: ['火'] },
  { birth: '1973-06-13T10:30:00.000Z', apparentBirth: '1973-06-13T18:15:00Z', genderBasis: '女',
    pillars: ['癸丑', '戊午', '庚辰', '乙酉'], strength: '身强', useful: '水', supportive: ['木', '火'], adverse: ['土', '金'] },
  { birth: '1989-05-21T00:00:00.000Z', apparentBirth: '1989-05-21T07:49:00Z', genderBasis: '男',
    pillars: ['己巳', '己巳', '辛巳', '壬辰'], strength: '中和', useful: '水', supportive: ['土', '金'], adverse: ['木'] },
  // The Liuhe article prints Beijing civil times. The apparent times use its documented Beijing longitude.
  { birth: '1957-03-15T06:30:00.000Z', apparentBirth: '1957-03-15T14:06:30Z', genderBasis: '女',
    pillars: ['丁酉', '癸卯', '丙戌', '乙未'], strength: '身强', useful: '水', supportive: ['金'], adverse: ['木', '火'] },
  { birth: '1994-10-09T22:00:00.000Z', apparentBirth: '1994-10-10T05:58:23Z', genderBasis: '女',
    pillars: ['甲戌', '甲戌', '己巳', '丁卯'], strength: '身强', useful: '水', supportive: ['木', '金'], adverse: ['土'] },
  // The annual article gives Beijing civil times. The solar times were recalculated for 116.4°E.
  { birth: '1964-10-21T17:15:00.000Z', apparentBirth: '1964-10-22T01:16:00Z', genderBasis: '男',
    pillars: ['甲辰', '甲戌', '甲辰', '乙丑'], strength: '身弱', useful: '木', supportive: ['水', '金'], adverse: ['土'] },
  { birth: '1963-05-12T07:45:00.000Z', apparentBirth: '1963-05-12T15:34:17Z', genderBasis: '男',
    pillars: ['癸卯', '丁巳', '乙卯', '甲申'], strength: '身弱', useful: '水', supportive: ['木'], adverse: ['土', '火'] },
  { birth: '2004-08-22T04:00:00.000Z', apparentBirth: '2004-08-22T11:43:00Z', genderBasis: '女',
    pillars: ['甲申', '壬申', '癸酉', '戊午'], strength: '身强', useful: '火', supportive: ['土', '木'], adverse: ['金', '水'] },
  { birth: '2002-02-02T09:15:00.000Z', apparentBirth: '2002-02-02T16:46:00Z', genderBasis: '男',
    pillars: ['辛巳', '辛丑', '辛丑', '丙申'], strength: '身强', useful: '火', supportive: ['水', '木'], adverse: ['土', '金'] },
  // The climate article gives civil times. Recalculate its Beijing solar clock at 116.4°E.
  { birth: '1966-01-08T23:00:00.000Z', apparentBirth: '1966-01-09T06:38:46Z', genderBasis: '女',
    pillars: ['乙巳', '己丑', '戊辰', '乙卯'], strength: '身弱', useful: '火', supportive: ['土'], adverse: ['水', '木'] },
  { birth: '1978-07-22T21:15:00.000Z', apparentBirth: '1978-07-23T04:54:13Z', genderBasis: '男',
    pillars: ['戊午', '己未', '丙戌', '庚寅'], strength: '身强', useful: '金', supportive: ['水', '土'], adverse: ['火', '木'] },
  // The five-combinations example explicitly retains ordinary balance rather than transforming to Water.
  { birth: '1987-11-23T06:30:00.000Z', apparentBirth: '1987-11-23T14:29:23Z', genderBasis: '女',
    pillars: ['丁卯', '辛亥', '丙子', '乙未'], strength: '身弱', useful: '木', supportive: ['火'], adverse: ['土', '金'] },
  { birth: '1990-06-02T09:45:00.000Z', apparentBirth: '1990-06-02T17:32:00Z', genderBasis: '女',
    pillars: ['庚午', '辛巳', '戊戌', '辛酉'], strength: '身弱', useful: '火', supportive: ['土', '木'], adverse: ['金'] },
] as const;

export function fateClearSolarBirth(utc: string, longitude: number) {
  const apparentBornAt = apparentSolarEpoch(Date.parse(utc), longitude);
  const lunar = lunarAtCivilClock(apparentBornAt);
  return { utc, apparentBornAt, year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(),
    day: lunar.getDayInGanZhiExact(), hour: lunar.getTimeInGanZhi() };
}

function matchesPublishedClock(natal: Natal, row: { apparentBirth: string }) {
  return natal.apparentBornAt !== undefined && Math.abs(natal.apparentBornAt - Date.parse(row.apparentBirth)) <= 90_000;
}

function matchesPublishedBirth(natal: Natal, row: { birth: string; apparentBirth: string; pillars: readonly string[] }, requireSolarClock = true) {
  return Date.parse(row.birth) === Date.parse(natal.utc) && natalLayers.every((layer, index) => natal[layer] === row.pillars[index])
    && (matchesPublishedClock(natal, row) || !requireSolarClock && natal.apparentBornAt === undefined);
}

type ElementReading = {
  sourceReading?: { useful: string; supportive: readonly string[]; adverse: readonly string[]; neutral?: readonly string[] };
  baseBalance?: Pick<ReturnType<typeof fateClearBaseBalance>, 'aligned' | 'opposed' | 'tongGuan' | 'primaryClimate'>;
  publishedReadingVerified?: boolean;
  monthlyUsefulnessBasis?: string;
  direction?: readonly { layer: string; pillar: string }[];
};

function fateClearElementDirection({ sourceReading, baseBalance }: ElementReading, element: string | undefined) {
  if (!element) return undefined;
  if (sourceReading) {
    if (element === sourceReading.useful) return 'useful';
    if (sourceReading.supportive.some(value => value === element)) return 'supportive';
    if (sourceReading.adverse.some(value => value === element)) return 'adverse';
    if (sourceReading.neutral?.includes(element)) return 'neutral';
    return 'unlisted';
  }
  if (baseBalance?.aligned?.includes(element)) return 'aligns_with_balance';
  if (baseBalance?.opposed?.includes(element)) {
    if (baseBalance.primaryClimate === element) return 'climate_review';
    return baseBalance.tongGuan.routes.some(route => route.bridge === element) ? 'tong_guan_review' : 'opposes_balance';
  }
  return undefined;
}

const requiresRoleReview = (role: string | undefined) => role === 'tong_guan_review' || role === 'climate_review';
const isPublishedRole = (role: string | undefined) =>
  role === 'useful' || role === 'supportive' || role === 'adverse' || role === 'neutral';

export function fateClearBranchContext(natal: Natal, timeKnown: boolean, layer: 'month' | 'day', movingPillar: string,
  reading?: ElementReading & { balanceDirectionReady?: boolean }) {
  const dayMaster = natal.day[0];
  const native = natalLayers.filter(id => id !== 'hour' || timeKnown).map(id => ({ id, pillar: natal[id] }));
  const moving = describeBaZiPillar(movingPillar, dayMaster);
  const { pairs, groups } = baziInteractions([...native, { id: 'flow', pillar: movingPillar }]);
  const combinations = pairs.filter(pair => pair.kind === '六合')
    .map(pair => ({ ...pair, origin: pair.members.includes('flow') ? 'flow' : 'natal' }));
  const oppositions = pairs.filter(pair => pair.kind === '六冲');
  const dayClashedByMonth = layer === 'month' && oppositions.some(pair => pair.members.includes('day') && pair.members.includes('flow'));
  const upperPeriods = dayClashedByMonth ? (reading?.direction ?? []).filter(period => ['annual', 'decadal'].includes(period.layer)) : [];
  const upperOppositions = upperPeriods.length ? baziInteractions([...native, ...upperPeriods.map(({ layer: id, pillar }) => ({ id, pillar }))])
    .pairs.filter(pair => pair.kind === '六冲') : [];
  const trines = groups.filter(group => group.kind === '三合');
  const direction = (element: string | undefined) => reading && timeKnown && (reading.sourceReading || reading.balanceDirectionReady === true)
    ? fateClearElementDirection(reading, element) : undefined;
  const movingBranchDirection = direction(moving.hiddenStems[0]?.element);
  const clashes = native.filter(column => oppositions.some(pair =>
    pair.members.includes('flow') && pair.members.includes(column.id))).map(column => {
    const detail = describeBaZiPillar(column.pillar, dayMaster);
    const natalCombinations = combinations.filter(pair => pair.origin === 'natal' && pair.members.includes(column.id)).map(pair => {
      const partner = natalLayers.find(id => id !== column.id && pair.members.includes(id))!;
      const partnerMain = describeBaZiPillar(natal[partner], dayMaster).hiddenStems[0];
      return { ...pair, partner, partnerDirection: direction(partnerMain?.element),
        adjacent: Math.abs(natalLayers.indexOf(partner) - natalLayers.indexOf(column.id)) === 1,
        opposingColumns: oppositions.filter(row => row.members.includes(partner))
          .flatMap(row => row.members.filter(id => id !== partner)),
        upperOppositions: column.id === 'day' ? upperPeriods.filter(period => upperOppositions.some(row =>
          row.members.includes(partner) && row.members.includes(period.layer))) : [],
      };
    });
    return { ...column, branch: detail.branch, mainQi: detail.hiddenStems[0], element: detail.branchElement,
      branchDirection: direction(detail.hiddenStems[0]?.element), natalCombinations,
      hasDirectNatalCombination: natalCombinations.length ? true : timeKnown ? false : undefined,
      natalTrines: trines.filter(group => group.byBranch.every(ids => ids.some(id => id !== 'flow'))
        && group.byBranch.some(ids => ids.includes(column.id))).map(group => ({
        branches: group.values, positions: group.byBranch.map(ids => ids.filter(id => id !== 'flow')),
      })),
    };
  });
  const clashReviewed = (id: 'year' | 'day') => {
    const target = clashes.find(column => column.id === id);
    if (!target) return false;
    // The month passage asks about the incoming branch. The day passage asks about the natal branch.
    const role = layer === 'month' ? movingBranchDirection : target.branchDirection;
    return role && role !== 'unlisted' && !requiresRoleReview(role) && target.hasDirectNatalCombination !== undefined ? true : undefined;
  };
  const monthlyDayClash = layer === 'month' ? clashes.find(column => column.id === 'day') : undefined;
  const monthDayClashGeometryVerified = layer === 'month' && timeKnown && natal.apparentBornAt !== undefined ? true : undefined;
  const monthDayClashNatalCombinationsChecked = monthDayClashGeometryVerified && monthlyDayClash ? true : undefined;
  const natalTrine = monthlyDayClash && timeKnown ? natalTrineElements.find(row => row.branches.includes(monthlyDayClash.branch)) : undefined;
  const natalTrineMembers = natalTrine ? [...natalTrine.branches].map(branch => ({ branch,
    positions: native.filter(column => column.pillar[1] === branch).map(column => column.id),
  })) : [];
  const missingTrineMembers = natalTrineMembers.filter(row => !row.positions.length);
  const relatedNatalHalfTrine = natalTrine && missingTrineMembers.length === 1 ? {
    fullGroup: natalTrine.branches, element: natalTrine.element, missingBranch: missingTrineMembers[0].branch,
    hasCentralBranch: natalTrineMembers[1].positions.length > 0,
    members: natalTrineMembers.filter(row => row.positions.length), direction: direction(natalTrine.element),
  } : undefined;
  const calculatedEarth = reading?.monthlyUsefulnessBasis === 'calculated-earth-transformation';
  const checkedIncomingDirection = (reading?.publishedReadingVerified || calculatedEarth) && isPublishedRole(movingBranchDirection)
    ? movingBranchDirection : undefined;
  const natalCombination = monthlyDayClash?.natalCombinations.length === 1 ? monthlyDayClash.natalCombinations[0] : undefined;
  const checkedAdjacentCombination = monthDayClashGeometryVerified && checkedIncomingDirection && upperPeriods.length === 2
    && monthlyDayClash && isPublishedRole(monthlyDayClash.branchDirection) && natalCombination?.adjacent
    && isPublishedRole(natalCombination.partnerDirection)
    && !natalCombination.opposingColumns.length && !natalCombination.upperOppositions.length
    && !oppositions.some(pair => pair.members.includes('day') && !pair.members.includes('flow'))
    && !upperOppositions.some(pair => pair.members.includes('day'))
    ? { ...natalCombination, dayDirection: monthlyDayClash.branchDirection } : undefined;
  const natalTrineWithDay = monthlyDayClash?.natalTrines.find(group => group.branches === natalTrine?.branches);
  const natalTrineDirection = direction(natalTrine?.element);
  const groupPositions = new Set<string>(natalTrineMembers.flatMap(member => member.positions));
  const incomingOpposedPositions = new Set<string>(native
    .filter(column => column.pillar[1] === monthlyDayClash?.branch).map(column => column.id));
  // A repeated natal branch can receive the same monthly opposition at two columns.
  const hasCompetingGroupOpposition = [...oppositions, ...upperOppositions].some(pair =>
    pair.members.some(member => groupPositions.has(member))
    && !(pair.members.includes('flow') && pair.members.some(member => incomingOpposedPositions.has(member))));
  const publishedGroupDayDirection = monthDayClashGeometryVerified && reading?.publishedReadingVerified && checkedIncomingDirection
    && upperPeriods.length === 2 && isPublishedRole(natalTrineDirection) && !hasCompetingGroupOpposition
    && isPublishedRole(monthlyDayClash?.branchDirection) ? monthlyDayClash?.branchDirection : undefined;
  const publishedNatalTrine = publishedGroupDayDirection && natalTrine && natalTrineWithDay
    ? { ...natalTrineWithDay, element: natalTrine.element, direction: natalTrineDirection,
      dayDirection: publishedGroupDayDirection } : undefined;
  const publishedNatalHalfTrine = publishedGroupDayDirection && relatedNatalHalfTrine && !relatedNatalHalfTrine.hasCentralBranch
    && moving.branch !== relatedNatalHalfTrine.missingBranch
    && !upperPeriods.some(({ pillar }) => pillar[1] === relatedNatalHalfTrine.missingBranch)
    ? { ...relatedNatalHalfTrine, dayDirection: publishedGroupDayDirection } : undefined;
  const monthDayClashReview = monthlyDayClash && {
    natalDay: monthlyDayClash.pillar,
    hasRelatedNatalSixCombination: monthlyDayClash.hasDirectNatalCombination,
    relatedNatalTrines: monthlyDayClash.natalTrines,
    relatedNatalHalfTrine,
    relatedNatalMeetings: groups.filter(group => group.kind === '三会'
      && group.byBranch.every(ids => ids.some(id => id !== 'flow')) && group.byBranch.some(ids => ids.includes('day')))
      .map(group => ({ branches: group.values, positions: group.byBranch.map(ids => ids.filter(id => id !== 'flow')) })),
    publishedIncomingDirection: reading?.publishedReadingVerified ? checkedIncomingDirection : undefined,
    publishedAdjacentCombination: reading?.publishedReadingVerified ? checkedAdjacentCombination : undefined,
    publishedNatalTrine, publishedNatalHalfTrine,
    calculatedEarthIncomingDirection: calculatedEarth ? checkedIncomingDirection : undefined,
    calculatedEarthAdjacentCombination: calculatedEarth ? checkedAdjacentCombination : undefined,
  };
  const publishedMonthDayClashReviewed = monthDayClashGeometryVerified && monthDayClashReview?.publishedIncomingDirection
    ? true : undefined;
  const monthDayClashNoNatalCombination = monthDayClashGeometryVerified && monthDayClashReview
    ? monthDayClashReview.hasRelatedNatalSixCombination === false && monthDayClashReview.relatedNatalTrines.length === 0
      && !monthDayClashReview.relatedNatalHalfTrine && monthDayClashReview.relatedNatalMeetings.length === 0
    : undefined;
  return {
    profile: fateClearBaziPolicy.profile, layer,
    clock: layer === 'month' ? fateClearBaziPolicy.monthlyClock : fateClearBaziPolicy.dailyClock,
    timeKnown, dayMaster, movingPillar, movingBranch: moving.branch, movingElement: moving.branchElement, movingStemTenGod: moving.tenGod,
    movingMainQi: moving.hiddenStems[0], clashes, clashedColumns: clashes.map(column => column.id),
    clashReviewProfile: fateClearBaziPolicy.clashReview, movingBranchDirection,
    dayClashReviewed: clashReviewed('day'), yearClashReviewed: clashReviewed('year'),
    monthDayClashGeometryVerified, monthDayClashNatalCombinationsChecked, monthDayClashReview, publishedMonthDayClashReviewed,
    publishedMonthDayClashAdjacentCombination: monthDayClashReview?.publishedAdjacentCombination ? true : undefined,
    publishedMonthDayClashNatalTrine: publishedNatalTrine ? true : undefined,
    publishedMonthDayClashNatalHalfTrine: publishedNatalHalfTrine ? true : undefined,
    calculatedEarthMonthDayClashReviewed: monthDayClashGeometryVerified && monthDayClashReview?.calculatedEarthIncomingDirection
      ? true : undefined,
    calculatedEarthMonthDayClashAdjacentCombination: monthDayClashReview?.calculatedEarthAdjacentCombination ? true : undefined,
    monthDayClashNoNatalCombination,
    movingCombinations: combinations.filter(pair => pair.origin === 'flow'),
    movingTrines: trines.filter(group => group.byBranch.some(ids => ids.includes('flow'))).map(group => ({
      branches: group.values, positions: group.byBranch,
    })),
  };
}

export function fateClearMonthlyExample(natal: Natal, timeKnown: boolean, year: string | undefined, month: string, luck?: PublishedLuck) {
  if (!timeKnown) return {};
  const example = monthlyExamples.find(row => row.year === year && row.month === month && matchesPublishedBirth(natal, row, false));
  if (!example) return { exampleId: 'other' };
  if (!luck) return { exampleId: example.id };
  if (luck.genderBasis !== example.genderBasis) return { exampleId: 'other' };
  return { exampleId: example.id, exampleVerified: true, exampleYear: year, exampleLuck: luck.pillar,
    exampleReading: { strength: example.strength, useful: example.useful, supportive: example.supportive, adverse: example.adverse } };
}

function annualFrictionAtKeyColumns(natal: Natal, year: string, luck: string, useful?: string) {
  const native = natalLayers.map(id => ({ id, pillar: natal[id] }));
  const roots = native.filter(({ pillar }) => describeBaZiPillar(pillar, natal.day[0]).hiddenStems.some(row => row.element === useful));
  const keyColumns = new Set(['month', 'day', 'decadal', ...roots.map(row => row.id)]);
  const positions = [...native, { id: 'decadal', pillar: luck }, { id: 'annual', pillar: year }];
  return baziInteractions(positions).pairs.filter(row => ['六冲', '相刑', '六害'].includes(row.kind) && row.members.includes('annual'))
    .flatMap(row => positions.filter(position => row.members.includes(position.id) && keyColumns.has(position.id))
      .map(position => ({ ...position, kind: row.kind })));
}

export function fateClearPeriodReading(natal: Natal, year: string, month: string, luck?: PublishedLuck,
  day?: { pillar: string; solarDate: string }) {
  const layers = [{ layer: 'annual', pillar: year }, { layer: 'monthly', pillar: month },
    ...(luck ? [{ layer: 'decadal', pillar: luck.pillar }] : []), ...(day ? [{ layer: 'daily', pillar: day.pillar }] : [])];
  const original = luck && [...monthlyExamples, ...dailyExamples].find(row =>
    row.genderBasis === luck.genderBasis && matchesPublishedBirth(natal, row, day !== undefined));
  const balanceExample = luck && balanceExamples.find(row => row.genderBasis === luck.genderBasis
    && matchesPublishedBirth(natal, row));
  const profile = original ?? balanceExample;
  const baseBalance = !original && natal.apparentBornAt !== undefined ? fateClearBaseBalance(natal) : undefined;
  const sourceReading = profile ? { strength: profile.strength, useful: profile.useful, supportive: profile.supportive, adverse: profile.adverse }
    : luck && baseBalance?.earthTransformation ? { strength: '化土格', useful: '土', supportive: ['火', '金'], adverse: ['木'],
      earthTransformation: baseBalance.earthTransformation } : undefined;
  const neutral = balanceExample && 'neutral' in balanceExample ? balanceExample.neutral : undefined;
  const reading = sourceReading && neutral ? { ...sourceReading, neutral } : sourceReading;
  const tag = (element: string | undefined) => fateClearElementDirection({ sourceReading: reading, baseBalance }, element);
  const direction = layers.map(({ layer, pillar }) => {
    const p = describeBaZiPillar(pillar, natal.day[0]), main = p.hiddenStems[0];
    return { layer, pillar, stem: p.stem, stemElement: p.stemElement, stemDirection: tag(p.stemElement),
      mainQi: main?.stem, mainElement: main?.element, mainDirection: tag(main?.element) };
  });
  const [annual, monthly] = direction;
  const daily = direction.find(row => row.layer === 'daily');
  const usefulSide = (role?: string) => role === 'useful' || role === 'supportive';
  const supportiveYear = sourceReading && usefulSide(annual.stemDirection) && usefulSide(annual.mainDirection);
  const ordinaryDirection = baseBalance?.strength !== undefined && luck !== undefined;
  const supportsBalance = (role?: string) => role === 'aligns_with_balance';
  const yearAlignedByBalance = ordinaryDirection && supportsBalance(annual.stemDirection) && supportsBalance(annual.mainDirection);
  const annualFriction = !day && luck && (supportiveYear || yearAlignedByBalance)
    ? annualFrictionAtKeyColumns(natal, year, luck.pillar, sourceReading?.useful) : undefined;
  const annualCoreClashes = annualFriction?.filter(row => row.kind === '六冲').map(({ id, pillar }) => ({ id, pillar }));
  const annualCorePunishmentsAndHarms = annualFriction?.filter(row => row.kind !== '六冲');
  // A calculated transformation can be retained for review without supplying the author's natal reading.
  const dailyUsefulnessBasis = !daily ? undefined : profile ? 'published-natal-reading'
    : sourceReading ? 'calculated-earth-transformation' : ordinaryDirection ? 'base-balance-candidate' : undefined;
  const publishedDaily = dailyUsefulnessBasis === 'published-natal-reading' ? daily : undefined;
  const calculatedEarthDay = dailyUsefulnessBasis === 'calculated-earth-transformation' ? daily : undefined;
  const knownOpposingSides = ({ stemDirection, mainDirection }: NonNullable<typeof daily>) =>
    (usefulSide(stemDirection) && mainDirection === 'adverse') || (stemDirection === 'adverse' && usefulSide(mainDirection));
  const sourceDailyExample = day && dailyExamples.find(row => matchesPublishedBirth(natal, row)
    && row.date === day.solarDate && row.day === day.pillar);
  const publishedReadingVerified = profile && matchesPublishedClock(natal, profile) ? true : undefined;
  const publishedMonth = !day && publishedReadingVerified ? monthly : undefined;
  const monthlyUsefulnessBasis = day ? undefined : profile ? publishedReadingVerified ? 'published-natal-reading' : 'legacy-published-civil-match'
    : sourceReading ? 'calculated-earth-transformation' : ordinaryDirection ? 'base-balance-candidate' : undefined;
  const monthlyCalendarOnly = day ? undefined
    : monthlyUsefulnessBasis !== 'published-natal-reading' && monthlyUsefulnessBasis !== 'calculated-earth-transformation';
  return { direction, archiveLuckConfirmed: luck ? true : undefined, profileReadingReady: reading ? true : undefined, baseBalance, sourceReading: reading,
    publishedReadingVerified, monthlyUsefulnessBasis, monthlyCalendarOnly,
    balanceProfile: baseBalance?.profile, balanceClimateProfile: baseBalance ? fateClearBalancePolicy.climate : undefined,
    balanceDirectionReady: sourceReading ? false : ordinaryDirection ? true : undefined,
    yearAlignedMonthOpposedByBalance: sourceReading ? false : ordinaryDirection && !annualFriction?.length
      && ![annual.stemDirection, annual.mainDirection, monthly.stemDirection].some(requiresRoleReview)
      ? yearAlignedByBalance && monthly.stemDirection === 'opposes_balance' : undefined,
    dayStemAlignedByBalance: sourceReading ? false : ordinaryDirection && daily && !requiresRoleReview(daily.stemDirection)
      ? supportsBalance(daily.stemDirection) : undefined,
    dayStemBranchOpposedByBalance: sourceReading ? false : ordinaryDirection && daily && ![daily.stemDirection, daily.mainDirection].some(requiresRoleReview)
      ? (supportsBalance(daily.stemDirection) && daily.mainDirection === 'opposes_balance')
      || (daily.stemDirection === 'opposes_balance' && supportsBalance(daily.mainDirection)) : undefined,
    annualCoreClashes, annualCorePunishmentsAndHarms,
    yearFavourableCandidate: annualFriction?.length ? undefined : supportiveYear,
    monthUsefulYearOther: sourceReading ? monthly.stemDirection === 'useful' && annual.stemDirection !== 'useful' : undefined,
    publishedMonthStemDirection: publishedMonth?.stemDirection,
    publishedMonthMainDirection: publishedMonth?.mainDirection,
    sameAnnualAndMonthlyStemElement: !day ? annual.stemElement === monthly.stemElement : undefined,
    monthStemAdverse: sourceReading ? monthly.stemDirection === 'adverse' : undefined,
    dailyUsefulnessBasis,
    publishedDayStemDirection: publishedDaily?.stemDirection,
    publishedDayMainDirection: publishedDaily?.mainDirection,
    sameAnnualAndDailyStemElement: daily ? annual.stemElement === daily.stemElement : undefined,
    dayStemSupportive: publishedDaily ? usefulSide(publishedDaily.stemDirection) : undefined,
    dayStemBranchOpposed: publishedDaily ? knownOpposingSides(publishedDaily) : undefined,
    calculatedEarthDayStemSupportive: calculatedEarthDay ? usefulSide(calculatedEarthDay.stemDirection) : undefined,
    calculatedEarthDayStemBranchOpposed: calculatedEarthDay ? knownOpposingSides(calculatedEarthDay) : undefined,
    dayUsefulYearOther: publishedDaily ? publishedDaily.stemDirection === 'useful' && annual.stemDirection !== 'useful' : undefined,
    dailyCaseId: day ? sourceDailyExample?.id ?? 'other' : undefined,
    dailyCaseVerified: sourceDailyExample && luck ? sourceDailyExample.genderBasis === luck.genderBasis && sourceDailyExample.luck === luck.pillar
      : day && !sourceDailyExample ? false : undefined,
  };
}
