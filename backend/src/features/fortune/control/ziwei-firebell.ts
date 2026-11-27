import { quanshuBrightness, quanshuLuYangTuo, quanshuMinorLimit,
  quanshuTransformations, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuDecadalVerification } from './ziwei-growth-stages';
import { quanshuFourFlying } from './ziwei-kongjie';
import { readQuanshuSupportNatal } from './ziwei-source-support';
import { jielanFireBellProfile, quanshuFixedFireBellProfile, readQuanshuArchivedFireBell } from './ziwei-firebell-positions';
import type { quanshuDoujunCondition } from './ziwei-source-year';
import { quanshuVersePolicy, quanshuVerseSeat } from './ziwei-verse-seats';

const branches = '子丑寅卯辰巳午未申酉戌亥';
const mod = (value: number) => (value % 12 + 12) % 12;
const majorNames = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
export type QuanshuYearlyPalace = { branch: string; movingStarIds?: readonly string[] };
type Args = [...Parameters<typeof quanshuDoujunCondition>, yearlyPalaces?: readonly QuanshuYearlyPalace[]];
type Natal = Args[0];
const all = (p: Natal['palaces'][number]) => [...p.majorStars, ...p.minorStars, ...p.adjectiveStars];
export const quanshuFireBellPolicy = {
  profile: 'quanshu-firebell-anchor-archive-v1',
  source: 'four-birth-year-groups-pair-only-hour-rule-unresolved',
  archive: 'iztro-2.6.5-both-forward-from-named-anchor-by-birth-hour',
  comparison: jielanFireBellProfile,
  brightness: 'quanshu-volume3-explicit-cells-v2-firebell',
  horse: 'natal-year-table-separate-from-product-annual-candidate',
  flowingHorse: 'verified-product-yearly-horse-guarded-by-an-active-limit',
  verse: quanshuVersePolicy,
} as const;
const relation = (focus: string, target: string) => {
  const distance = mod(branches.indexOf(target) - branches.indexOf(focus));
  return distance === 0 ? '守' : distance === 6 ? '冲' : [4, 8].includes(distance) ? '三合'
    : [1, 11].includes(distance) ? '邻宫' : '其他';
};
export { quanshuFireBellAnchors } from './ziwei-firebell-positions';
export function quanshuHorseBranch(yearBranch: string) {
  if (yearBranch.length !== 1 || !branches.includes(yearBranch)) throw new RangeError('Invalid horse year branch');
  return [{ years: '寅午戌', branch: '申' }, { years: '申子辰', branch: '寅' },
    { years: '巳酉丑', branch: '亥' }, { years: '亥卯未', branch: '巳' }].find(row => row.years.includes(yearBranch))!.branch;
}
export function verifiedQuanshuYearlyStar(palaces: readonly QuanshuYearlyPalace[] | undefined, name: string, expected: string) {
  const actual = palaces?.flatMap(palace => palace.movingStarIds?.filter(star => star === name).map(() => palace.branch) ?? []);
  return actual?.length === 1 && actual[0] === expected ? expected : undefined;
}

export function quanshuFlowHorse(annualBranch: string, palaces: readonly QuanshuYearlyPalace[] | undefined,
  decadalBranch?: string, minorBranch?: string) {
  const branch = verifiedQuanshuYearlyStar(palaces, '流马', quanshuHorseBranch(annualBranch));
  const limits = [{ scope: 'decadal', branch: decadalBranch }, { scope: 'minor', branch: minorBranch }] as const;
  const guardingLimits = branch === undefined ? [] : limits.filter(limit => limit.branch === branch).map(limit => limit.scope);
  const atLimit = guardingLimits.length > 0 ? true : branch !== undefined && limits.every(limit => limit.branch !== undefined) ? false : undefined;
  return { branch, guardingLimits, atLimit };
}

export function quanshuFlowHorseAtBranch(flow: ReturnType<typeof quanshuFlowHorse>, other?: string) {
  if (flow.atLimit === false || (flow.branch !== undefined && other !== undefined && flow.branch !== other)) return false;
  return flow.atLimit === true && other !== undefined ? true : undefined;
}

export function quanshuFireBellCondition(...args: Args) {
  const [natal, palaceIndex, annualIndex, lunarYear, scope, decadalIndex, minorIndex, yearlyPalaces] = args;
  const basis = readQuanshuNatal(natal), palace = natal.palaces.find(p => p.index === palaceIndex);
  const annual = natal.palaces.find(p => p.index === annualIndex);
  if (basis.status !== 'ready' || !palace || !annual || !Number.isInteger(lunarYear) || lunarYear < 1 || lunarYear > 9998
    || !['decadal', 'minor', 'yearly'].includes(scope)) return { ready: false, reason: 'unavailable_firebell_basis' } as const;
  const birthYearBranch = branches[mod(basis.birthYear - 4)], annualBranch = branches[mod(lunarYear - 4)];
  if (natal.rawDates.chineseDate.yearly[1] !== birthYearBranch || annual.earthlyBranch !== annualBranch
    || (scope === 'yearly' && palaceIndex !== annualIndex) || (scope === 'decadal' && palaceIndex !== decadalIndex)
    || (scope === 'minor' && palaceIndex !== minorIndex)) return { ready: false, reason: 'inconsistent_firebell_geometry' } as const;
  const birthHour = natal.rawDates.chineseDate.hourly[1];
  const { anchors, archivedFireBell, inconsistentStar, jielanAnchors, jielanFireBell, quanshuFixedFireBell } =
    readQuanshuArchivedFireBell(natal, birthYearBranch, birthHour);
  const locations = (star: string) => natal.palaces.flatMap(p => all(p).filter(s => s.name === star).map(() => p.earthlyBranch));
  if (inconsistentStar) return { ready: false, reason: 'inconsistent_product_firebell', star: inconsistentStar } as const;
  if (majorNames.some(star => locations(star).length !== 1)) return { ready: false, reason: 'incomplete_major_positions' } as const;
  const fourShaRelations = [{ star: '擎羊', branch: basis.qingyangBranch, coordinateBasis: 'source_calculated' },
    { star: '陀罗', branch: basis.tuoluoBranch, coordinateBasis: 'source_calculated' },
    ...archivedFireBell.map(row => ({ ...row, coordinateBasis: 'archive_product_hour' }))]
    .map(row => ({ ...row, relation: relation(palace.earthlyBranch, row.branch), sourceGrade: quanshuBrightness(row.star, row.branch) }));
  const nativeHorse = quanshuHorseBranch(birthYearBranch), horseActual = locations('天马');
  const natalHorseVerified = horseActual.length === 1 && horseActual[0] === nativeHorse;
  const annualHorseCandidateBranch = quanshuHorseBranch(annualBranch);
  const archiveMinor = natal.palaces.find(row => row.index === minorIndex)?.earthlyBranch;
  const nominalAge = lunarYear - basis.birthYear + 1;
  const sourceMinor = quanshuMinorLimit(birthYearBranch, natal.gender, nominalAge);
  const decadal = quanshuDecadalVerification(natal, basis, natal.palaces.find(row => row.index === decadalIndex), lunarYear);
  const flowHorse = quanshuFlowHorse(annualBranch, yearlyPalaces,
    decadal?.verified === true ? decadal.branch : undefined,
    archiveMinor === sourceMinor?.branch ? archiveMinor : undefined);
  const support = readQuanshuSupportNatal(natal);
  const supportRows = support.ready ? support.sourcePositions.map(row => ({ ...row, relation: relation(palace.earthlyBranch, row.branch) })) : undefined;
  const sourceGradeRows = all(palace).filter(star => [...majorNames, '擎羊', '陀罗', '火星', '铃星'].includes(star.name))
    .map(star => ({ star: star.name, grade: quanshuBrightness(star.name, palace.earthlyBranch) }));
  const whiteTigerBranch = quanshuFourFlying(lunarYear).placements.find(row => row.name === '白虎')!.branch;
  const annualStem = '甲乙丙丁戊己庚辛壬癸'[((lunarYear - 4) % 10 + 10) % 10];
  const otherIndex = scope === 'decadal' ? minorIndex : decadalIndex;
  const other = natal.palaces.find(row => row.index === otherIndex);
  const verseReady = support.ready && (otherIndex === undefined || other !== undefined) ? true : undefined;
  const verseSubjects = verseReady ? ['太阳', '武曲', '破军'].map(star => {
    const branch = locations(star)[0], subject = natal.palaces.find(row => row.earthlyBranch === branch)!;
    return { ...quanshuVerseSeat(star, branch), natalName: subject.name,
      focusRelation: relation(palace.earthlyBranch, branch), otherRelation: other ? relation(other.earthlyBranch, branch) : undefined,
      annualRelation: relation(annualBranch, branch),
      auxiliaryRelations: support.ready ? support.sourcePositions.filter(row => ['文昌', '文曲', '左辅', '右弼', '魁钺组'].includes(row.star))
        .map(row => ({ ...row, relation: relation(branch, row.branch) })) : undefined,
      fourShaRelations: fourShaRelations.map(row => ({ ...row, relation: relation(branch, row.branch) })),
      natalTransformations: quanshuTransformations(basis.birthStem).map(change => {
        const changeBranch = locations(change.star);
        return { ...change, branch: changeBranch.length === 1 ? changeBranch[0] : undefined,
          relation: changeBranch.length === 1 ? relation(branch, changeBranch[0]) : undefined };
      }),
    };
  }) : undefined;
  const atFocus = (star: string, temple = false) => verseSubjects?.some(row => row.star === star && row.focusRelation === '守'
    && (!temple || row.verseGrade === '庙'));
  return { profile: quanshuFireBellPolicy.profile, ready: true, scope, branch: palace.earthlyBranch, natalName: palace.name,
    lunarYear, annualBranch, birthYearBranch, birthHour, ...anchors, archivedFireBell,
    quanshuFixedFireBellProfile, quanshuFixedFireBell,
    quanshuFixedFireAtFocus: quanshuFixedFireBell[0].branch === palace.earthlyBranch,
    quanshuFixedBellAtFocus: quanshuFixedFireBell[1].branch === palace.earthlyBranch,
    quanshuFixedBellAtLife: quanshuFixedFireBell[1].branch === basis.lifeBranch,
    jielanFireBellProfile, jielanAnchors, jielanFireBell,
    jielanFireAtFocus: jielanFireBell[0].branch === palace.earthlyBranch,
    jielanBellAtLife: jielanFireBell[1].branch === basis.lifeBranch,
    sourceHourRuleVerified: false, // Even a coincident anchor is not proof of the missing source hour rule.
    sourcePairEqualsArchive: [...anchors.sourcePair].sort().join() === archivedFireBell.map(row => row.branch).sort().join(),
    localMainStars: all(palace).filter(star => majorNames.includes(star.name)).map(star => star.name),
    sourceGradeRows, localSourceFallenStars: sourceGradeRows.filter(row => row.grade === '陷').map(row => row.star),
    tongSourceFallen: sourceGradeRows.find(row => row.star === '天同')?.grade === undefined ? undefined
      : sourceGradeRows.find(row => row.star === '天同')!.grade === '陷',
    unknownSourceGradeStars: sourceGradeRows.filter(row => !row.grade).map(row => row.star),
    fourShaRelations, areaArchiveFourShaStars: fourShaRelations.filter(row => ['守', '冲', '三合'].includes(row.relation)).map(row => row.star),
    fireArchiveAtFocus: archivedFireBell[0].branch === palace.earthlyBranch, bellArchiveAtFocus: archivedFireBell[1].branch === palace.earthlyBranch,
    natalHorseVerified, natalHorseBranch: natalHorseVerified ? nativeHorse : undefined,
    natalHorseAtFocus: natalHorseVerified ? nativeHorse === palace.earthlyBranch : undefined,
    annualHorseCandidateBranch, annualHorseAtFocus: annualHorseCandidateBranch === palace.earthlyBranch,
    flowHorse,
    flowHorseArchiveFireCandidate: quanshuFlowHorseAtBranch(flowHorse, archivedFireBell[0].branch),
    flowHorseJielanFireCandidate: quanshuFlowHorseAtBranch(flowHorse, jielanFireBell[0].branch),
    flowHorseQuanshuFixedFireCandidate: quanshuFlowHorseAtBranch(flowHorse, quanshuFixedFireBell[0].branch),
    supportReady: support.ready, sourceSupportRelations: supportRows,
    natalLifeBranch: basis.lifeBranch, qingyangAtLife: basis.qingyangBranch === basis.lifeBranch,
    bellArchiveAtLife: archivedFireBell[1].branch === basis.lifeBranch,
    whiteTigerBranch, annualWhiteTigerAtLife: whiteTigerBranch === basis.lifeBranch,
    annualLucunBranch: quanshuLuYangTuo(annualStem).lucunBranch,
    verseProfile: quanshuVersePolicy.profile, verseReady, verseSubjects,
    verseOtherBranch: other?.earthlyBranch, verseOtherScope: scope === 'decadal' ? 'minor' : 'decadal',
    verseSunAtFocus: atFocus('太阳'), verseWuquTempleAtFocus: atFocus('武曲', true), versePoJunTempleAtFocus: atFocus('破军', true),
    calendarPolicy: 'native-lunar-new-year-and-civil-midnight', geometryOnly: true } as const;
}
