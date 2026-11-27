import { quanshuBrightness, quanshuLunarMidnight, quanshuLuYangTuo, readQuanshuNatal } from './ziwei-quanshu';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Scale = 'decadal' | 'minor' | 'yearly';
const branches = '子丑寅卯辰巳午未申酉戌亥', stems = '甲乙丙丁戊己庚辛壬癸';
const mod = (value: number) => (value % 12 + 12) % 12;
const all = (palace: Natal['palaces'][number]) => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
const majorNames = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
export const quanshuYearPolicy = {
  doujun: 'quanshu-doujun-birth-month-hour-v1', kuXu: 'quanshu-kuxu-birth-year-v1',
  kuXuPlacement: 'quanshu-kuxu-birth-year-adjective-layer-v1',
  shangShi: 'quanshu-shangshi-native-palaces-v1',
  calendar: 'native-lunar-new-year-and-civil-midnight',
  relationships: 'same-opposite-trine-adjacent-separate-no-interpretation-score',
} as const;
const relation = (focus: string, target: string) => {
  const distance = mod(branches.indexOf(target) - branches.indexOf(focus));
  return distance === 0 ? '守' : distance === 6 ? '冲' : [4, 8].includes(distance) ? '三合'
    : [1, 11].includes(distance) ? '邻宫' : '其他';
};
export function quanshuKuXuPositions(birthYearBranch: string) {
  if (birthYearBranch.length !== 1 || !branches.includes(birthYearBranch)) throw new RangeError('Invalid source birth-year branch');
  const year = branches.indexOf(birthYearBranch);
  return [{ star: '天哭', branch: branches[mod(6 - year)] }, { star: '天虚', branch: branches[mod(6 + year)] }];
}

export function quanshuVerifiedKuXu(natal: Natal, birthYearBranch: string) {
  return quanshuKuXuPositions(birthYearBranch).map(({ star, branch }) => {
    const archived = natal.palaces.flatMap(palace => all(palace).filter(item => item.name === star).map(() => palace));
    const verified = archived.length === 1 && archived[0].earthlyBranch === branch
      && archived[0].adjectiveStars.some(item => item.name === star);
    return { star, branch, verified };
  });
}
export function quanshuDoujunPosition(lunarYear: number, birthMonth: number, birthHour: string) {
  if (!Number.isInteger(lunarYear) || lunarYear < 1 || lunarYear > 9998 || !Number.isInteger(birthMonth)
    || birthMonth < 1 || birthMonth > 12 || birthHour.length !== 1 || !branches.includes(birthHour)) throw new RangeError('Invalid source Doujun basis');
  const annual = mod(lunarYear - 4), month = mod(annual - (birthMonth - 1));
  return { annualBranch: branches[annual], birthMonthStop: branches[month],
    doujunBranch: branches[mod(month + branches.indexOf(birthHour))] };
}

function common(natal: Natal, palaceIndex: number, annualIndex: number, lunarYear: number, scope: Scale,
  decadalIndex?: number, minorIndex?: number) {
  const basis = readQuanshuNatal(natal), palace = natal.palaces.find(p => p.index === palaceIndex);
  const annual = natal.palaces.find(p => p.index === annualIndex);
  const decadal = natal.palaces.find(p => p.index === decadalIndex), minor = natal.palaces.find(p => p.index === minorIndex);
  if (basis.status !== 'ready' || !palace || !annual || !Number.isInteger(lunarYear) || lunarYear < 1 || lunarYear > 9998
    || !['decadal', 'minor', 'yearly'].includes(scope)) return { ready: false, reason: 'unavailable_source_year_basis' } as const;
  const birthYearBranch = branches[mod(basis.birthYear - 4)], annualBranch = branches[mod(lunarYear - 4)];
  if (natal.rawDates.chineseDate.yearly[1] !== birthYearBranch || annual.earthlyBranch !== annualBranch
    || (decadalIndex !== undefined && !decadal) || (minorIndex !== undefined && !minor)
    || (scope === 'decadal' && decadal?.index !== palaceIndex) || (scope === 'minor' && minor?.index !== palaceIndex)
    || (scope === 'yearly' && palaceIndex !== annualIndex)) return { ready: false, reason: 'inconsistent_source_year_geometry' } as const;
  return { ready: true, basis, palace, birthYearBranch, lunarYear, annualBranch,
    annualStem: stems[((lunarYear - 4) % 10 + 10) % 10], scope,
    branch: palace.earthlyBranch, natalName: palace.name,
    decadalBranch: decadal?.earthlyBranch, minorBranch: minor?.earthlyBranch,
    allThreeSamePalace: decadal && minor ? decadal.index === minor.index && minor.index === annualIndex : undefined,
  } as const;
}
type Args = Parameters<typeof common>;
const metadata = (p: Extract<ReturnType<typeof common>, { ready: true }>) => ({
  ready: true, lunarYear: p.lunarYear, scope: p.scope, branch: p.branch, natalName: p.natalName,
  annualStem: p.annualStem, annualBranch: p.annualBranch, decadalBranch: p.decadalBranch, minorBranch: p.minorBranch,
  allThreeSamePalace: p.allThreeSamePalace, calendarPolicy: quanshuYearPolicy.calendar,
});

export function quanshuKuXuCondition(...args: Args) {
  const p = common(...args); if (!p.ready) return p;
  const [natal] = args, positions = quanshuVerifiedKuXu(natal, p.birthYearBranch);
  const unverified = positions.find(row => !row.verified);
  if (unverified) return { ready: false, reason: 'inconsistent_source_kuxu', star: unverified.star } as const;
  const annualLu = quanshuLuYangTuo(p.annualStem).lucunBranch;
  const mourningBranch = branches[mod(branches.indexOf(p.annualBranch) + 2)];
  const related = positions.map(({ star, branch }) => ({ star, branch, relation: relation(p.branch, branch) }));
  return { ...metadata(p), profile: quanshuYearPolicy.kuXu, kuXuPlacementProof: quanshuYearPolicy.kuXuPlacement, birthYearBranch: p.birthYearBranch,
    positions: related, localSourceStars: related.filter(row => row.relation === '守').map(row => row.star),
    cryInArea: related.some(row => row.star === '天哭' && ['守', '冲', '三合'].includes(row.relation)),
    exceptionSeat: '丑卯申'.includes(p.branch),
    natalLuBranch: p.basis.lucunBranch, natalLuRelation: relation(p.branch, p.basis.lucunBranch),
    annualLuBranch: annualLu, annualLuRelation: relation(p.branch, annualLu),
    mourningBranch, mourningRelation: relation(p.branch, mourningBranch),
    luInterpretation: 'source-layer-unresolved', encounterInterpretation: 'source-contact-range-unresolved' } as const;
}

export function quanshuDoujunCondition(...args: Args) {
  const p = common(...args); if (!p.ready) return p;
  const [natal] = args;
  const { birthMonth, birthHour, birthMonthBasis, birthLeapMonth } = p.basis;
  const position = quanshuDoujunPosition(p.lunarYear, birthMonth, birthHour);
  const palace = natal.palaces.find(row => row.earthlyBranch === position.doujunBranch)!;
  const yearStart = quanshuLunarMidnight(p.lunarYear, 1);
  const yearEnd = quanshuLunarMidnight(p.lunarYear + 1, 1);
  return { ...metadata(p), profile: quanshuYearPolicy.doujun, birthMonth, birthHour, birthMonthBasis, birthLeapMonth, ...position,
    bothLimitSeatsKnown: p.decadalBranch && p.minorBranch ? true : undefined,
    yearStart: new Date(yearStart).toISOString(), yearEnd: new Date(yearEnd).toISOString(),
    doujunNatalName: palace.name, archivedStars: all(palace).map(star => star.name),
    sourceQualities: all(palace).map(star => ({ star: star.name, grade: quanshuBrightness(star.name, palace.earthlyBranch) })),
    interpretation: 'source-year-quality-and-monthly-link-unresolved' } as const;
}

export function quanshuShangShiPalaces(lifeIndex: number) {
  // The same source explicitly names 奴仆 and 疾厄. 仆役 is the public
  // archive's name for the former; the inclusive-count verse is not re-guessed.
  return [{ star: '天伤', name: '仆役', index: mod(lifeIndex + 5) },
    { star: '天使', name: '疾厄', index: mod(lifeIndex + 7) }];
}

export function quanshuShangShiCondition(...args: Args) {
  const p = common(...args); if (!p.ready) return p;
  const [natal] = args;
  const positions = [];
  for (const row of quanshuShangShiPalaces(p.basis.lifeIndex)) {
    const palace = natal.palaces.find(palace => palace.index === row.index);
    const found = natal.palaces.flatMap(palace => all(palace).filter(star => star.name === row.star).map(() => palace.index));
    if (palace?.name !== row.name || found.length !== 1 || found[0] !== row.index) return { ready: false, reason: 'inconsistent_source_shangshi', star: row.star } as const;
    positions.push({ star: row.star, branch: palace.earthlyBranch, natalName: palace.name, relation: relation(p.branch, palace.earthlyBranch) });
  }
  const majorsVerified = majorNames.every(name => natal.palaces.flatMap(palace => all(palace).filter(star => star.name === name)).length === 1);
  return { ...metadata(p), profile: quanshuYearPolicy.shangShi, positions,
    localSourceStars: positions.filter(row => row.relation === '守').map(row => row.star),
    majorPositionsVerified: majorsVerified, localMajorStars: all(p.palace).filter(star => majorNames.includes(star.name)).map(star => star.name),
    archivedLocalStars: all(p.palace).map(star => star.name),
    archivedOppositeStars: all(natal.palaces.find(palace => palace.index === mod(p.palace.index + 6))!).map(star => star.name),
    interpretation: 'source-many-auspicious-and-rescue-unresolved' } as const;
}

type SourceScope = { start: number; end: number; scope: string; lunarYear: number; output: { index: number } };
export function bindQuanshuYearScopes<T extends SourceScope>(scopes: T[]) {
  return scopes.filter(item => ['decadal', 'minor', 'yearly'].includes(item.scope)).flatMap(focus =>
    scopes.filter(item => item.scope === 'yearly').flatMap(year => {
      const start = Math.max(focus.start, year.start), end = Math.min(focus.end, year.end);
      if (start >= end) return [];
      const partners = scopes.filter(item => ['decadal', 'minor'].includes(item.scope) && item.start < end && start < item.end);
      const cuts = [...new Set([start, end, ...partners.flatMap(item => [Math.max(start, item.start), Math.min(end, item.end)])])].sort((a, b) => a - b);
      return cuts.slice(0, -1).map((from, i) => ({ start: from, end: cuts[i + 1], focus, year,
        decadal: partners.find(item => item.scope === 'decadal' && item.start <= from && cuts[i + 1] <= item.end),
        minor: partners.find(item => item.scope === 'minor' && item.start <= from && cuts[i + 1] <= item.end) }));
    }));
}
