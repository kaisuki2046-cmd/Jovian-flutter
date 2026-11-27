import { lunarAtBeijing } from './fortune-calendar';
import { quanshuBirthAnchoredMajorPositions } from './ziwei-birth-major-anchor';
import { quanshuFireBellCondition } from './ziwei-firebell';
import { quanshuFireBellAnchors, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import { quanshuDecadalVerification, quanshuLifeBureau, quanshuLimitPlacementProof } from './ziwei-growth-stages';
import { quanshuKongJiePositions } from './ziwei-kongjie';
import { quanshuVerifiedBoshiPosition } from './ziwei-kongjie-limits';
import { quanshuBrightness, quanshuLimitPhase, quanshuLunarMidnight, quanshuLuYangTuo, quanshuMajorStarNames, quanshuMinorLimit, quanshuPalaceRelation,
  quanshuMingTabooStar, quanshuTransformations, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuAuxiliaryPositions } from './ziwei-source-support';
import { quanshuDoujunPosition, quanshuShangShiPalaces } from './ziwei-source-year';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Palace = Natal['palaces'][number];
type LunarDate = ReturnType<typeof lunarAtBeijing> & { getMonth(): number; getDay(): number };
type Frame = { at: number; lunarYear: number; age: number; yearIndex: number; decadalIndex?: number;
  minorIndex?: number; monthIndex?: number; dayIndex?: number; dayEnd?: number; windowEnd: number };
const branches = '子丑寅卯辰巳午未申酉戌亥', stems = '甲乙丙丁戊己庚辛壬癸';
const hour = 3_600_000, day = 24 * hour, beijingOffset = 8 * hour;
const modBranch = (index: number) => (index % 12 + 12) % 12;
const flyingShaDestinations = { 寅午戌: '亥卯未', 申子辰: '巳酉丑', 亥卯未: '申子辰', 巳酉丑: '寅午戌' };
const chapterSupport = ['紫微', '天府', '天同', '太阳', '太阴', '文昌', '文曲', '禄存'];
const chapterRelief = ['紫微', '天同', '天梁', '贪狼'];
const around = ['守', '冲', '三合'];
const allKnown = (...checks: (boolean | undefined)[]) => checks.includes(false) ? false
  : checks.includes(undefined) ? undefined : true;
const anyKnown = (checks: (boolean | undefined)[]) => checks.includes(true) ? true
  : checks.includes(undefined) ? undefined : false;
export const quanshuLimitChapterPolicy = {
  profile: 'quanshu-limit-chapter-atomic-v1',
  starPlacementProof: 'quanshu-nanyangtang-limit-chapter-star-layers-v1',
  natalBladePlacementProof: 'quanshu-natal-yang-tuo-and-lucun-auxiliary-layer-v1',
  shangShiPlacementProof: 'quanshu-shangshi-native-palaces-adjective-layer-v1',
  limitPlacementProof: quanshuLimitPlacementProof,
  year: 'native-lunar-year-both-limits-split-at-every-boundary',
  month: 'source-doujun-month-only-where-verified',
  day: 'product-civil-day-seat-candidate-not-source-day-interpretation',
  jielanDay: 'jielan-doujun-month-seat-day-count-shared-civil-interval-v1',
  jielanHour: 'jielan-daily-seat-zi-hour-forward-shared-civil-interval-v1',
  flanks: 'both-immediate-neighbors-of-one-actual-upper-seat-from-one-verified-pair',
  pairedTaboo: 'source-birth-or-annual-taboo-recipient-and-named-native-sha-guard-the-same-actual-month-or-day-seat',
  flyingSha: 'volume-two-transmitted-annual-branch-group-without-individual-name-assignment',
  boshi: 'nanyang-natal-lucun-boshi-sequence-verified-before-tai-sui-seat',
  exit: 'full-native-limit-end-in-window-no-invented-advance-duration',
  verifiedMajorSeats: 'nanyang-birth-day-ziwei-anchor-and-major-sequence-before-counting-seat-dignities-or-taboo-recipients',
  outcome: 'named-witnesses-without-count-based-auspiciousness-or-rescue',
} as const;

export function quanshuLateZiStart(at: number) {
  return Math.floor((at + beijingOffset) / day) * day - beijingOffset + 23 * hour;
}

export function quanshuAnnualFlyingShaBranches(lunarYear: number) {
  if (!Number.isInteger(lunarYear) || lunarYear < 1 || lunarYear > 9999) throw new RangeError('Invalid source lunar year');
  const yearBranch = branches[((lunarYear - 4) % 12 + 12) % 12];
  const destinations = Object.entries(flyingShaDestinations).find(([years]) => years.includes(yearBranch))![1];
  return [...destinations];
}

export function quanshuLimitChapter(natal: Natal, frame: Frame) {
  const native = readQuanshuNatal(natal);
  const palace = (index?: number) => natal.palaces.find(row => row.index === index);
  const yearPalace = palace(frame.yearIndex), decade = palace(frame.decadalIndex), minor = palace(frame.minorIndex);
  const annualOrdinal = frame.lunarYear - 4;
  if (native.status !== 'ready' || !Number.isInteger(frame.lunarYear) || frame.lunarYear < 1 || frame.lunarYear > 9998
    || yearPalace?.earthlyBranch !== branches[(annualOrdinal % 12 + 12) % 12]) {
    return { ready: false, reason: 'unverified_limit_year_basis' } as const;
  }
  const annualStem = stems[(annualOrdinal % 10 + 10) % 10], annual = quanshuLuYangTuo(annualStem);
  const sourceVoids = quanshuKongJiePositions(natal);
  const skyBranch = sourceVoids.ready ? sourceVoids.skyBranch
    : 'verifiedSkyBranch' in sourceVoids ? sourceVoids.verifiedSkyBranch : undefined;
  const robberyBranch = sourceVoids.ready ? sourceVoids.robberyBranch
    : 'verifiedRobberyBranch' in sourceVoids ? sourceVoids.verifiedRobberyBranch : undefined;
  const natalVoids = [{ star: '天空', branch: skyBranch }, { star: '地劫', branch: robberyBranch }];
  const yearSha = [{ star: '流年擎羊', branch: annual.qingyangBranch }, { star: '流年陀罗', branch: annual.tuoluoBranch }];
  const firebell = quanshuFireBellCondition(natal, frame.yearIndex, frame.yearIndex, frame.lunarYear, 'yearly',
    frame.decadalIndex, frame.minorIndex);
  const birthYearBranch = natal.rawDates.chineseDate.yearly[1];
  const verifiedBirthYearBranch = birthYearBranch === branches[((native.birthYear - 4) % 12 + 12) % 12];
  const fixedFireBell = verifiedBirthYearBranch ? quanshuFireBellAnchors(birthYearBranch).engineNamedAnchors : undefined;
  const sourceMinor = verifiedBirthYearBranch ? quanshuMinorLimit(birthYearBranch, natal.gender, frame.lunarYear - native.birthYear + 1) : undefined;
  const sourceMinorVerified = sourceMinor && minor ? sourceMinor.branch === minor.earthlyBranch : undefined;
  const { verifiedLifeBureau } = quanshuLifeBureau(natal, native);
  const sourceDecadal = quanshuDecadalVerification(natal, native, decade, frame.lunarYear, verifiedLifeBureau);
  const verifiedDecade = sourceDecadal?.verified === true ? decade : undefined;
  const archived = new Map<string, { branch: string; layer: 'majorStars' | 'minorStars' | 'adjectiveStars' } | undefined>();
  for (const row of natal.palaces) for (const layer of ['majorStars', 'minorStars', 'adjectiveStars'] as const) {
    for (const star of row[layer]) archived.set(star.name, archived.has(star.name) ? undefined : { branch: row.earthlyBranch, layer });
  }
  const archiveMajor = (star: string) => {
    const at = archived.get(star);
    return at?.layer === 'majorStars' ? at.branch : undefined;
  };
  const { positions: majorPlacements, ziweiBirthAnchorVerified } = quanshuBirthAnchoredMajorPositions(natal, verifiedLifeBureau, archiveMajor);
  const unverifiedMajorStars = quanshuMajorStarNames.filter(star => majorPlacements.get(star) === undefined);
  const majorsVerified = unverifiedMajorStars.length === 0 && natal.palaces.reduce((sum, row) => sum + row.majorStars.length, 0) === quanshuMajorStarNames.length;
  const verifiedAuxiliary = (row: { star: string; branch: string }) => {
    const placement = archived.get(row.star);
    return { ...row, branch: placement?.layer === 'minorStars' && placement.branch === row.branch ? row.branch : undefined };
  };
  const natalBlades = [{ star: '擎羊', branch: native.qingyangBranch }, { star: '陀罗', branch: native.tuoluoBranch }].map(verifiedAuxiliary);
  const natalSha = [...natalBlades, ...natalVoids];
  const natalShaComplete = natalSha.every(row => row.branch !== undefined);
  const auxiliarySeats = quanshuAuxiliaryPositions(native.birthMonth, native.birthHour, native.birthStem).named;
  const natalAuxiliary = auxiliarySeats.map(verifiedAuxiliary);
  const lucunSeat = { star: '禄存', branch: native.lucunBranch };
  const natalLucun = verifiedAuxiliary(lucunSeat);
  const unverifiedAuxiliaryStars = natalAuxiliary.filter(row => row.branch === undefined).map(row => row.star);
  const majorSupports = quanshuMajorStarNames.filter(star => chapterSupport.includes(star)).map(star => ({ star, branch: majorPlacements.get(star) }));
  const supports = [...majorSupports, ...natalAuxiliary, natalLucun];
  const locate = (star: string) => ({ star, branch: majorPlacements.get(star) ?? natalAuxiliary.find(row => row.star === star)?.branch });
  const tabooForStem = (stem: string) => locate(quanshuTransformations(stem).find(row => row.kind === '忌')!.star);
  const natalTaboo = tabooForStem(native.birthStem), annualTabooCandidate = tabooForStem(annualStem);
  const mingNatalTaboo = locate(quanshuMingTabooStar(native.birthStem));
  const forSeat = (seat: Palace | undefined) => {
    if (!seat) return undefined;
    const relation = (branch: string) => quanshuPalaceRelation(seat.earthlyBranch, branch);
    const contacts = (rows: readonly { star: string; branch?: string }[]) => rows.flatMap(row => {
      if (row.branch === undefined) return [];
      const at = relation(row.branch);
      return around.includes(at) ? [{ star: row.star, branch: row.branch, relation: at }] : [];
    });
    const taboo = (row: typeof natalTaboo) => ({ ...row, relation: row.branch ? relation(row.branch) : undefined });
    const grades = seat.majorStars.filter(row => majorPlacements.get(row.name) === seat.earthlyBranch)
      .map(row => ({ star: row.name, grade: quanshuBrightness(row.name, seat.earthlyBranch) }));
    const namedNativeSha = contacts(natalSha), archiveFireBell = firebell.ready ? contacts(firebell.archivedFireBell) : undefined;
    const mingFixedFireBell = fixedFireBell && contacts(fixedFireBell);
    const mingFireBellAtSeat = mingFixedFireBell?.some(row => row.relation === '守');
    const natalJi = taboo(natalTaboo), mingNatalJi = taboo(mingNatalTaboo), yearJi = taboo(annualTabooCandidate);
    const nativeShaAtSeat = namedNativeSha.some(row => row.relation === '守') ? true : natalShaComplete ? false : undefined;
    const localSha = (ji: typeof natalJi) => anyKnown([nativeShaAtSeat, ji.relation === undefined ? undefined : ji.relation === '守']);
    return { branch: seat.earthlyBranch, natalName: seat.name, grades, namedNativeSha, archiveFireBell,
      mingFixedFireBell, mingFireBellAtSeat,
      annualSha: contacts(yearSha), natalJi, mingNatalJi, annualJiCandidate: yearJi, nativeShaAtSeat,
      localSourceSha: localSha(natalJi), mingLocalSourceSha: localSha(mingNatalJi),
      namedSupport: contacts(supports),
    };
  };
  const decadal = forSeat(verifiedDecade), yearly = forSeat(yearPalace);
  const minorLayer = forSeat(sourceMinorVerified === true ? minor : undefined);
  const shangShiPositions = quanshuShangShiPalaces(native.lifeIndex).map(({ star, name, index }) => {
    const expected = palace(index), placement = archived.get(star);
    const verified = verifiedBirthYearBranch && expected?.name === name
      && placement?.layer === 'adjectiveStars' && placement.branch === expected.earthlyBranch;
    return { star, branch: verified ? placement.branch : undefined };
  });
  const annualShangShiGuard = anyKnown(shangShiPositions.map(row => row.branch === undefined ? undefined : row.branch === yearly?.branch));
  const annualShangShiGuards = annualShangShiGuard === undefined ? undefined
    : shangShiPositions.filter(row => row.branch !== undefined && row.branch === yearly?.branch);
  const natalBoshi = (['将军', '奏书'] as const).map(star => ({ star, branch: quanshuVerifiedBoshiPosition(natal, native.birthStem, star) }));
  const annualBoshiGuards = natalBoshi.filter(row => row.branch !== undefined && row.branch === yearly?.branch);
  const knownAnnualBoshi = anyKnown(natalBoshi.map(row => row.branch === undefined ? undefined : row.branch === yearly?.branch));
  const annualFlyingShaBranches = quanshuAnnualFlyingShaBranches(frame.lunarYear);
  const flankingPairs = [
    { group: '伤使', stars: shangShiPositions },
    { group: '空劫', stars: sourceVoids.ready ? natalVoids : undefined },
    { group: '本命羊陀', stars: natalBlades },
  ];
  const flanks = ([['decadal', decadal?.branch], ['minor', minorLayer?.branch], ['yearly', yearly?.branch]] as const)
    .flatMap(([scope, branch]) => flankingPairs.map(({ group, stars }) => {
      const index = branch === undefined ? undefined : branches.indexOf(branch);
      const candidate = index === undefined || !stars ? undefined : allKnown(
        ...[branches.at(index - 1), branches[(index + 1) % 12]].map(neighbor => anyKnown(
          stars.map(row => row.branch === undefined ? undefined : row.branch === neighbor))));
      return { scope, branch, group, stars, candidate };
    }));
  const monthly = forSeat(palace(frame.monthIndex)), daily = forSeat(palace(frame.dayIndex));
  const phase = verifiedDecade ? quanshuLimitPhase(natal, verifiedDecade.index, frame.age, frame.at) : undefined;
  const endAt = phase?.ready ? Date.parse(phase.stageEnd) : undefined;
  const exitInWindow = endAt === undefined ? undefined : frame.at < endAt && endAt < frame.windowEnd;
  const guardedSupport = decadal?.namedSupport.filter(row => row.relation === '守');
  const namedAuxiliarySeats = [...auxiliarySeats, lucunSeat];
  const archivedDecadalAuxiliaryNames = new Set<string>(verifiedDecade?.minorStars.map(row => row.name));
  const decadalAuxiliariesVerified = verifiedDecade && guardedSupport && namedAuxiliarySeats
    .filter(row => row.branch === verifiedDecade.earthlyBranch || archivedDecadalAuxiliaryNames.has(row.star))
    .every(row => guardedSupport.some(verified => verified.star === row.star));
  const namedGuardRosterKnown = decadalAuxiliariesVerified === true && majorSupports.every(row => row.branch !== undefined);
  const decadalMultipleSupportAtSeat = guardedSupport && new Set(guardedSupport.map(row => row.star)).size >= 2 ? true
    : namedGuardRosterKnown ? false : undefined;
  const exitNamedGuards = allKnown(exitInWindow,
    decadal ? [...'寅申巳亥子午'].includes(decadal.branch) : undefined,
    ...['紫微', '天府', '文昌', '禄存'].map(star => {
      const branch = supports.find(row => row.star === star)?.branch;
      return branch && decadal ? branch === decadal.branch : undefined;
    }),
    decadal?.nativeShaAtSeat === undefined ? undefined : !decadal.nativeShaAtSeat,
    decadal?.mingFireBellAtSeat === undefined ? undefined : !decadal.mingFireBellAtSeat,
    decadal?.mingNatalJi.branch === undefined ? undefined : decadal.mingNatalJi.relation !== '守');
  const upperContacts = [decadal?.nativeShaAtSeat, minorLayer?.nativeShaAtSeat, yearly?.nativeShaAtSeat,
    yearly?.annualSha.some(row => row.relation === '守')];
  const upperSha = anyKnown(upperContacts);
  const upperFlankCandidate = anyKnown(flanks.map(row => row.candidate));
  const observedFallen = decadal?.grades.some(row => row.grade === '陷');
  const localFallen = phase?.ready && (observedFallen === true || majorsVerified) ? observedFallen : undefined;
  const withoutNamedGuard = guardedSupport?.length ? false
    : namedGuardRosterKnown ? true : undefined;
  const exitFallenWithoutNamedGuardCandidate = allKnown(exitInWindow, localFallen, withoutNamedGuard,
    anyKnown([decadal?.nativeShaAtSeat, decadal?.mingFireBellAtSeat]));
  const exitFallenWithoutNamedGuardWitness = exitFallenWithoutNamedGuardCandidate === true && decadal && phase?.ready ? {
    branch: decadal.branch, stageEnd: phase.stageEnd, fallen: decadal.grades.filter(row => row.grade === '陷'),
    sha: [...decadal.namedNativeSha, ...(decadal.mingFixedFireBell ?? [])].filter(row => row.relation === '守'),
    supportAspects: decadal.namedSupport.filter(row => row.relation !== '守'),
  } : undefined;
  const mingNatalLu = locate(quanshuTransformations(native.birthStem)[0].star);
  const noDecadeHuaLu = decadal && mingNatalLu.branch !== undefined
    ? !around.includes(quanshuPalaceRelation(decadal.branch, mingNatalLu.branch)) : undefined;
  const fewKnownDecadalSupports = decadal && allKnown(decadal.namedSupport.length <= 1,
    ...namedAuxiliarySeats.filter(row => around.includes(quanshuPalaceRelation(decadal.branch, row.branch)))
      .map(row => supports.find(verified => verified.star === row.star)?.branch === row.branch ? true : undefined));
  const exitMingFewNamedSupportsCandidate = allKnown(exitFallenWithoutNamedGuardCandidate, fewKnownDecadalSupports, noDecadeHuaLu);
  const overlappingLimits = allKnown(localFallen, decadal?.localSourceSha, minorLayer?.nativeShaAtSeat);
  const overlappingMingAnnualBladeAtDecadalCandidate = allKnown(localFallen,
    anyKnown([decadal?.mingLocalSourceSha, decadal?.mingFireBellAtSeat]),
    decadal?.annualSha.some(row => row.relation === '守'), minorLayer?.nativeShaAtSeat);
  const annualFlyingShaAtDecadal = decadal && annualFlyingShaBranches.includes(decadal.branch);
  const overlappingMingFlyingShaCandidate = allKnown(localFallen, decadal?.nativeShaAtSeat,
    minorLayer?.nativeShaAtSeat, annualFlyingShaAtDecadal);
  const overlappingMingFlyingShaWitness = overlappingMingFlyingShaCandidate === true && decadal && minorLayer ? {
    annualBranch: yearPalace.earthlyBranch, decadalBranch: decadal.branch, minorBranch: minorLayer.branch,
    groupBranches: annualFlyingShaBranches,
    decadalFallen: decadal.grades.filter(row => row.grade === '陷'),
    decadalSha: decadal.namedNativeSha.filter(row => row.relation === '守'),
    minorSha: minorLayer.namedNativeSha.filter(row => row.relation === '守'),
  } : undefined;
  const brightNamedMajors = majorsVerified && phase?.ready && decadal
    ? decadal.grades.length > 0 && decadal.grades.every(row => chapterSupport.includes(row.star)
      && ['庙', '旺', '地'].includes(row.grade ?? '')) : undefined;
  const noLocalSha = decadal?.localSourceSha === undefined ? undefined : !decadal.localSourceSha;
  const archiveIsClear = decadal?.archiveFireBell && !decadal.archiveFireBell.some(row => row.relation === '守');
  const cleanSeatCandidate = brightNamedMajors !== undefined && archiveIsClear !== undefined && noLocalSha !== undefined
    ? allKnown(brightNamedMajors, noLocalSha, archiveIsClear) : undefined;
  const noMingLocalSha = decadal?.mingLocalSourceSha === undefined ? undefined : !decadal.mingLocalSourceSha;
  const mingIsClear = decadal?.mingFireBellAtSeat === undefined ? undefined : !decadal.mingFireBellAtSeat;
  const cleanSeatMingFixedCandidate = allKnown(brightNamedMajors, noMingLocalSha, mingIsClear);
  const namedAuxiliaryRoster = verifiedDecade ? allKnown(
    [...archivedDecadalAuxiliaryNames].every(name => namedAuxiliarySeats.some(row => row.star === name)),
    decadalAuxiliariesVerified || undefined,
  ) : undefined;
  const shangShiOutsideDecade = verifiedDecade ? allKnown(...shangShiPositions.map(row =>
    row.branch === undefined ? undefined : row.branch !== verifiedDecade.earthlyBranch)) : undefined;
  const cleanSeatMingNamedRosterCandidate = allKnown(cleanSeatMingFixedCandidate, namedAuxiliaryRoster, shangShiOutsideDecade);
  const fourHelpersGuard = decadal && allKnown(...natalAuxiliary.map(row => row.branch === undefined ? undefined : row.branch === decadal.branch));
  const isBright = (grade?: string) => grade === undefined ? undefined : ['庙', '旺', '地'].includes(grade);
  const literaryStarsBright = decadal && allKnown(isBright(quanshuBrightness('文昌', decadal.branch)),
    isBright(quanshuBrightness('文曲', decadal.branch)));
  const knownBrightSeat = majorsVerified && phase?.ready && decadal
    ? allKnown(...decadal.grades.map(row => isBright(row.grade))) : undefined;
  const cleanSeatMingFourHelpersCandidate = allKnown(fourHelpersGuard, literaryStarsBright, knownBrightSeat,
    noMingLocalSha, mingIsClear, shangShiOutsideDecade);
  const atDecade = (branch?: string) => branch === undefined || decadal === undefined ? undefined : branch === decadal.branch;
  const cleanSeatMingLucunHuaLuCandidate = allKnown(decadal && '寅申巳亥子午'.includes(decadal.branch),
    atDecade(natalLucun.branch), atDecade(mingNatalLu.branch), knownBrightSeat, noMingLocalSha, mingIsClear, shangShiOutsideDecade);
  const cleanSeatMingLucunHuaLuWitness = cleanSeatMingLucunHuaLuCandidate === true && decadal ? {
    branch: decadal.branch, stem: native.birthStem, lucun: natalLucun, recipient: mingNatalLu,
  } : undefined;
  const exitMingFourHelpersCandidate = allKnown(exitInWindow, cleanSeatMingFourHelpersCandidate);
  const overlappingMingFixedShaCandidate = allKnown(localFallen,
    anyKnown([decadal?.mingLocalSourceSha, decadal?.mingFireBellAtSeat]),
    sourceMinorVerified === true ? true : undefined,
    anyKnown([minorLayer?.nativeShaAtSeat, minorLayer?.mingFireBellAtSeat]),
    anyKnown([yearly?.mingLocalSourceSha, yearly?.mingFireBellAtSeat, annualShangShiGuard]),
    anyKnown([decadal?.mingFireBellAtSeat, minorLayer?.mingFireBellAtSeat, yearly?.mingFireBellAtSeat]));
  const minorMingBellAtSeat = minorLayer?.mingFixedFireBell?.some(row => row.star === '铃星' && row.relation === '守');
  const overlappingMingNamedShaCandidate = allKnown(overlappingMingFixedShaCandidate,
    decadal?.nativeShaAtSeat, yearly?.nativeShaAtSeat, minorMingBellAtSeat);
  const mingNatalTabooAtDecadal = decadal?.mingNatalJi.branch === undefined ? undefined : decadal.mingNatalJi.relation === '守';
  const overlappingMingNatalTabooWithAnnualShangShiCandidate = allKnown(localFallen,
    mingNatalTabooAtDecadal, minorLayer?.nativeShaAtSeat, annualShangShiGuard);
  const overlappingMingNatalTabooAndMinorBellCandidate = allKnown(overlappingMingFixedShaCandidate,
    mingNatalTabooAtDecadal, yearly?.nativeShaAtSeat, minorMingBellAtSeat);
  const annualMingFireBellContext = allKnown(overlappingMingFixedShaCandidate, decadal?.nativeShaAtSeat, minorLayer?.nativeShaAtSeat);
  const annualMingFireAtSeat = yearly?.mingFixedFireBell?.some(row => row.star === '火星' && row.relation === '守');
  const annualMingBellAtSeat = yearly?.mingFixedFireBell?.some(row => row.star === '铃星' && row.relation === '守');
  const overlappingMingAnnualFireCandidate = allKnown(annualMingFireBellContext, annualMingFireAtSeat);
  const overlappingMingAnnualBellCandidate = allKnown(annualMingFireBellContext, annualMingBellAtSeat);
  const annualMingNatalTabooAtSeat = yearly?.mingNatalJi.relation === undefined ? undefined : yearly.mingNatalJi.relation === '守';
  const overlappingMingAnnualNatalShaGuardCandidate = allKnown(localFallen, decadal?.nativeShaAtSeat, minorLayer?.nativeShaAtSeat,
    anyKnown([yearly?.nativeShaAtSeat, annualMingNatalTabooAtSeat]));
  const overlappingMingAnnualBoshiCandidate = allKnown(localFallen, decadal?.nativeShaAtSeat, minorLayer?.nativeShaAtSeat, knownAnnualBoshi);
  const overlappingMingAnnualNatalShaGuardWitness = overlappingMingAnnualNatalShaGuardCandidate === true && decadal && minorLayer && yearly ? {
    annualBranch: yearly.branch, decadalBranch: decadal.branch, minorBranch: minorLayer.branch,
    annualSha: yearly.namedNativeSha.filter(row => row.relation === '守'),
    natalTaboo: annualMingNatalTabooAtSeat === true ? yearly.mingNatalJi : undefined,
  } : undefined;
  const dailyLayersReady = phase?.ready && decadal && minorLayer && yearly && monthly && daily;
  const lowerTabooContacts = ([['monthly', monthly], ['daily', daily]] as const).map(([scope, seat]) => {
    const taboos = [{ layer: '生年', stem: native.birthStem, ...seat?.natalJi },
      { layer: '流年', stem: annualStem, ...seat?.annualJiCandidate }];
    const seatedTaboo = anyKnown(taboos.map(row => row.relation === undefined ? undefined : row.relation === '守'));
    return { scope, branch: seat?.branch, sha: seat?.namedNativeSha.filter(row => row.relation === '守'),
      taboos: taboos.filter(row => row.relation === '守'),
      candidate: allKnown(seat?.nativeShaAtSeat, seatedTaboo) };
  });
  const dailyGuardedTabooCandidate = dailyLayersReady ? allKnown(
    anyKnown([upperSha, upperFlankCandidate]), anyKnown(lowerTabooContacts.map(row => row.candidate))) : undefined;
  const lateZi = quanshuLateZiStart(frame.at);
  const lunarDate = frame.dayEnd !== undefined && frame.at < frame.dayEnd && frame.dayEnd <= lateZi + hour
    && native.birthMonthBasis === 'regular-month' && monthly ? lunarAtBeijing(frame.at) as LunarDate : undefined;
  const sourceMonth = lunarDate && lunarDate.getYear() === frame.lunarYear && lunarDate.getMonth() > 0 ? lunarDate.getMonth() : undefined;
  const sourceDay = sourceMonth === undefined ? undefined : lunarDate?.getDay();
  const sourceMonthBranch = sourceMonth === undefined ? undefined : branches[modBranch(branches.indexOf(
    quanshuDoujunPosition(frame.lunarYear, native.birthMonth, native.birthHour).doujunBranch) + sourceMonth - 1)];
  const sourceMonthly = sourceMonthBranch === monthly?.branch ? monthly : undefined;
  const jielanDaySeat = (monthSeat: typeof monthly, lunarDay?: number) => {
    if (!monthSeat || lunarDay === undefined) return undefined;
    const branch = branches[modBranch(branches.indexOf(monthSeat.branch) + lunarDay - 1)];
    return forSeat(natal.palaces.find(row => row.earthlyBranch === branch));
  };
  const jielanDaily = jielanDaySeat(sourceMonthly, sourceDay);
  const jielanDayCandidate = (monthSeat: typeof monthly, daySeat: typeof jielanDaily) => daySeat && phase?.ready && monthSeat ? allKnown(
    sourceMinorVerified === true ? true : undefined, anyKnown([upperSha, upperFlankCandidate]),
    monthSeat.nativeShaAtSeat, daySeat.nativeShaAtSeat) : undefined;
  const civilDayCandidate = jielanDayCandidate(sourceMonthly, jielanDaily);
  const nextDate = lunarDate && frame.at >= lateZi
    ? lunarAtBeijing(lateZi + hour) as LunarDate : undefined;
  const nextMonthNumber = nextDate?.getMonth();
  const regularMonthRollover = sourceMonth !== undefined && nextMonthNumber === sourceMonth + 1 && nextDate?.getDay() === 1;
  const nextMonthly = sourceMonthly && nextDate?.getYear() === frame.lunarYear
    ? nextMonthNumber === sourceMonth ? sourceMonthly
      : regularMonthRollover ? forSeat(natal.palaces.find(row =>
        row.earthlyBranch === branches[modBranch(branches.indexOf(sourceMonthly.branch) + 1)])) : undefined
    : undefined;
  const nextDay = jielanDaySeat(nextMonthly, nextDate?.getDay());
  const beforeLateZi = frame.dayEnd !== undefined && frame.dayEnd <= lateZi;
  // 午夜和子初两种日界分别采用当时的月宫和日宫。
  const agreedDayCandidate = (civil: boolean | undefined, next: boolean | undefined) =>
    beforeLateZi || civil === next ? civil : undefined;
  const jielanDailyShaCandidate = agreedDayCandidate(civilDayCandidate, jielanDayCandidate(nextMonthly, nextDay));
  const lateZiDay = nextDay && nextDate && { lunarDay: nextDate.getDay(), dayBranch: nextDay.branch,
    daySha: nextDay.namedNativeSha.filter(row => row.relation === '守'),
    ...(regularMonthRollover && nextMonthly && { lunarMonth: nextMonthNumber, monthBranch: nextMonthly.branch,
      monthSha: nextMonthly.namedNativeSha.filter(row => row.relation === '守') }) };
  const jielanFireBell = firebell.ready ? firebell.jielanFireBell : undefined;
  const jielanFireBellAt = (branch?: string) => branch === undefined ? undefined
    : jielanFireBell?.filter(row => row.branch === branch);
  const monthFireBell = jielanFireBellAt(monthly?.branch), dayFireBell = jielanFireBellAt(jielanDaily?.branch);
  const jielanFireBellCandidate = (monthSeat: typeof monthly, daySeat: typeof jielanDaily,
    monthGuards: typeof monthFireBell, dayGuards: typeof dayFireBell) => {
    if (!daySeat || !phase?.ready || !monthSeat) return undefined;
    const monthFireBellGuards = monthGuards && monthGuards.length > 0;
    const dayFireBellGuards = dayGuards && dayGuards.length > 0;
    return allKnown(sourceMinorVerified === true ? true : undefined, anyKnown([upperSha, upperFlankCandidate]),
      anyKnown([monthSeat.nativeShaAtSeat, monthFireBellGuards]), anyKnown([daySeat.nativeShaAtSeat, dayFireBellGuards]),
      anyKnown([monthFireBellGuards, dayFireBellGuards]));
  };
  const civilDayFireBellCandidate = jielanFireBellCandidate(sourceMonthly, jielanDaily, monthFireBell, dayFireBell);
  const nextMonthFireBell = jielanFireBellAt(nextMonthly?.branch), nextDayFireBell = jielanFireBellAt(nextDay?.branch);
  const jielanDailyFireBellCandidate = agreedDayCandidate(civilDayFireBellCandidate,
    jielanFireBellCandidate(nextMonthly, nextDay, nextMonthFireBell, nextDayFireBell));
  const hourSeat = (dayBranch: string, timeIndex: number) => {
    const branch = branches[modBranch(branches.indexOf(dayBranch) + timeIndex)];
    const guards = [...natalSha, ...(jielanFireBell ?? [])].filter(row => row.branch === branch);
    return { dayBranch, branch, guards };
  };
  const dayEnd = frame.dayEnd;
  const jielanHourlyWitnesses = dayEnd !== undefined && jielanDaily && sourceMonthly
    && (jielanDailyShaCandidate === true || jielanDailyFireBellCandidate === true)
    ? Array.from({ length: 13 }, (_, index) => {
      const shichenStart = lateZi - day + index * 2 * hour;
      const start = Math.max(frame.at, shichenStart), end = Math.min(dayEnd, shichenStart + 2 * hour);
      if (start >= end) return undefined;
      const timeIndex = index % 12;
      const civil = { lunarMonth: sourceMonth, lunarDay: sourceDay, monthBranch: sourceMonthly.branch,
        ...hourSeat(jielanDaily.branch, timeIndex) };
      const ziStart = start >= lateZi && nextDay && nextMonthly && nextDate
        ? { lunarMonth: nextMonthNumber, lunarDay: nextDate.getDay(), monthBranch: nextMonthly.branch,
          ...hourSeat(nextDay.branch, timeIndex) } : undefined;
      if (!civil.guards.length || (start >= lateZi && !ziStart?.guards.length)) return undefined;
      return { start, end, hourBranch: branches[timeIndex], civil, ziStart };
    }).filter(row => row !== undefined) : [];
  const openingAt = frame.dayEnd === undefined ? undefined : quanshuLunarMidnight(frame.lunarYear, 1);
  const isOpeningDay = openingAt === undefined ? undefined : frame.at >= openingAt && frame.at < openingAt + 24 * 3_600_000;
  const openingDoujun = isOpeningDay === true && native.birthMonthBasis === 'regular-month'
    ? quanshuDoujunPosition(frame.lunarYear, native.birthMonth, native.birthHour).doujunBranch : undefined;
  // The two civil day conventions agree before the late Zi hour. The source only anchors the opening date.
  const commonOpeningDay = isOpeningDay === true && openingAt !== undefined && frame.dayEnd !== undefined
    && frame.dayEnd > frame.at && frame.dayEnd <= openingAt + 23 * 3_600_000;
  const openingDayVerified = commonOpeningDay && openingDoujun && monthly && daily
    ? monthly.branch === openingDoujun && daily.branch === openingDoujun : undefined;
  const mingOpeningShaCandidate = dailyLayersReady ? allKnown(isOpeningDay, openingDayVerified,
    sourceMinorVerified === true ? true : undefined, monthly.mingFireBellAtSeat,
    anyKnown([upperSha, upperFlankCandidate, decadal.mingFireBellAtSeat, minorLayer.mingFireBellAtSeat, yearly.mingFireBellAtSeat]))
    : undefined;
  const openingMonthAtMinor = monthly && minorLayer ? monthly.branch === minorLayer.branch : undefined;
  const mingOpeningMinorBellCandidate = allKnown(mingOpeningShaCandidate, minorMingBellAtSeat, openingMonthAtMinor);
  const minorMingFireAtSeat = minorLayer?.mingFixedFireBell?.some(row => row.star === '火星' && row.relation === '守');
  const mingOpeningMinorFireCandidate = allKnown(mingOpeningShaCandidate, minorMingFireAtSeat, openingMonthAtMinor);
  const mingOpeningMinorNatalShaCandidate = dailyLayersReady
    ? allKnown(isOpeningDay, openingDayVerified, openingMonthAtMinor, minorLayer.nativeShaAtSeat) : undefined;
  const mingOpeningMinorNatalShaWitness = mingOpeningMinorNatalShaCandidate === true && minorLayer
    ? { branch: minorLayer.branch, guards: minorLayer.namedNativeSha.filter(row => row.relation === '守') } : undefined;
  return { ready: true, profile: quanshuLimitChapterPolicy.profile, lunarYear: frame.lunarYear, annualStem, ziweiBirthAnchorVerified, unverifiedMajorStars,
    starPlacementProof: quanshuLimitChapterPolicy.starPlacementProof, limitPlacementProof: quanshuLimitPlacementProof,
    natalBladePlacementProof: quanshuLimitChapterPolicy.natalBladePlacementProof,
    shangShiPlacementProof: quanshuLimitChapterPolicy.shangShiPlacementProof,
    unverifiedAuxiliaryStars, sourceDecadal,
    sourceSkyReady: skyBranch !== undefined, sourceRobberyReady: robberyBranch !== undefined,
    decadal, yearly, minor: minorLayer, monthly, daily, cleanSeatCandidate,
    quanshuFixedFireBellProfile: fixedFireBell ? quanshuFixedFireBellProfile : undefined,
    sourceMinor: sourceMinor && { ...sourceMinor, verified: sourceMinorVerified },
    cleanSeatMingFixedCandidate, cleanSeatMingFourHelpersCandidate, cleanSeatMingNamedRosterCandidate,
    cleanSeatMingLucunHuaLuCandidate, cleanSeatMingLucunHuaLuWitness,
    cleanSeatMingFourHelpersWitness: cleanSeatMingFourHelpersCandidate === true && decadal ? {
      branch: decadal.branch, helpers: natalAuxiliary, grades: decadal.grades,
    } : undefined,
    overlappingMingFixedShaCandidate, overlappingMingNamedShaCandidate, overlappingMingAnnualFireCandidate, overlappingMingAnnualBellCandidate,
    overlappingMingAnnualBladeAtDecadalCandidate, overlappingMingNatalTabooAndMinorBellCandidate, overlappingMingNatalTabooWithAnnualShangShiCandidate,
    overlappingMingAnnualNatalShaGuardCandidate, overlappingMingAnnualNatalShaGuardWitness,
    dailyShaCandidate: dailyLayersReady ? allKnown(upperSha, monthly.nativeShaAtSeat, daily.nativeShaAtSeat) : undefined,
    dailyFlankedShaCandidate: dailyLayersReady ? allKnown(upperFlankCandidate, monthly.nativeShaAtSeat, daily.nativeShaAtSeat) : undefined,
    dailyGuardedTabooCandidate,
    jielanDayProfile: quanshuLimitChapterPolicy.jielanDay, jielanDailyShaCandidate,
    jielanDailyShaWitness: jielanDailyShaCandidate === true && monthly && jielanDaily ? {
      lunarMonth: sourceMonth, lunarDay: sourceDay, monthBranch: monthly.branch, dayBranch: jielanDaily.branch,
      productDayBranch: daily?.branch, monthSha: monthly.namedNativeSha.filter(row => row.relation === '守'),
      daySha: jielanDaily.namedNativeSha.filter(row => row.relation === '守'),
      ...(lateZiDay && { lateZiAlternative: lateZiDay }),
    } : undefined,
    jielanFireBellProfile: firebell.ready ? firebell.jielanFireBellProfile : undefined,
    jielanDailyFireBellCandidate,
    jielanHourVerified: false,
    jielanHourlyWitnesses,
    jielanDailyFireBellWitness: jielanDailyFireBellCandidate === true && monthly && jielanDaily ? {
      lunarMonth: sourceMonth, lunarDay: sourceDay, monthBranch: monthly.branch, dayBranch: jielanDaily.branch,
      productDayBranch: daily?.branch, monthFireBell, dayFireBell,
      monthSha: monthly.namedNativeSha.filter(row => row.relation === '守'),
      daySha: jielanDaily.namedNativeSha.filter(row => row.relation === '守'),
      ...(lateZiDay && { lateZiAlternative: { ...lateZiDay, dayFireBell: nextDayFireBell,
        ...(regularMonthRollover && { monthFireBell: nextMonthFireBell }) } }),
    } : undefined,
    mingOpeningShaCandidate, mingOpeningMinorBellCandidate, mingOpeningMinorFireCandidate,
    mingOpeningMinorNatalShaCandidate, mingOpeningMinorNatalShaWitness,
    mingOpeningSha: mingOpeningShaCandidate === true && monthly?.mingFixedFireBell
      ? { branch: monthly.branch, guards: monthly.mingFixedFireBell.filter(row => row.relation === '守') } : undefined,
    guardedTabooWitnesses: dailyGuardedTabooCandidate === true ? lowerTabooContacts.filter(row => row.candidate === true) : [],
    upperFlankCandidate, flankWitnesses: flanks.filter(row => row.candidate === true),
    overlappingShaCandidate: allKnown(overlappingLimits, decadal ? decadal.annualSha.length > 0 : undefined),
    overlappingAnnualSeatShaCandidate: allKnown(overlappingLimits, yearly?.nativeShaAtSeat),
    overlappingAnnualShangShiCandidate: allKnown(overlappingLimits, annualShangShiGuard),
    overlappingAnnualFlyingShaCandidate: allKnown(overlappingLimits, annualFlyingShaAtDecadal),
    overlappingMingFlyingShaCandidate, overlappingMingFlyingShaWitness,
    overlappingAnnualBoshiCandidate: allKnown(overlappingLimits, knownAnnualBoshi), overlappingMingAnnualBoshiCandidate, annualBoshiGuards,
    annualShangShiGuards, annualFlyingShaBranches,
    stageStart: phase?.ready ? phase.stageStart : undefined, stageEnd: phase?.ready ? phase.stageEnd : undefined,
    exitInWindow, decadalMultipleSupportAtSeat, exitNamedGuards, exitFallenWithoutNamedGuardCandidate, exitFallenWithoutNamedGuardWitness,
    exitMingFewNamedSupportsCandidate, exitMingFourHelpersCandidate,
    lifeBranch: native.lifeBranch,
    lifeReliefStars: palace(native.lifeIndex)?.majorStars.map(row => row.name)
      .filter(star => chapterRelief.includes(star) && majorPlacements.get(star) === native.lifeBranch),
  } as const;
}
