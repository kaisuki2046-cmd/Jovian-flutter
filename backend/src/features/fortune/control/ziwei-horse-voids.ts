import { quanshuLuYangTuo, quanshuMinorLimit, readQuanshuNatal,
  quanshuTianxingCondition } from './ziwei-quanshu';
import { quanshuFlowHorse, quanshuFlowHorseAtBranch, quanshuHorseBranch, verifiedQuanshuYearlyStar,
  type QuanshuYearlyPalace } from './ziwei-firebell';
import { quanshuKongJiePositions } from './ziwei-kongjie';
import { quanshuBodyLifePositions, readQuanshuBodyNatal } from './ziwei-body-limits';
import { quanshuZiweiBirthAnchor, quanshuZiweiBirthAnchorProof } from './ziwei-birth-major-anchor';
import { quanshuDecadalVerification, quanshuGrowthAtBranch, quanshuGrowthProfile, quanshuLifeBureau,
  quanshuLimitPlacementProof } from './ziwei-growth-stages';
import { readQuanshuSupportNatal } from './ziwei-source-support';
import type { quanshuDoujunCondition } from './ziwei-source-year';

const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const mod = (n: number) => (n % 12 + 12) % 12;
const relation = (from: string, to: string) => {
  const distance = mod(branches.indexOf(to) - branches.indexOf(from));
  return distance === 0 ? '守' : distance === 6 ? '冲' : [4, 8].includes(distance) ? '三合'
    : [1, 11].includes(distance) ? '邻宫' : '其他';
};
export const quanshuHorseVoidPolicy = {
  profile: 'quanshu-horse-birth-void-pairs-atomic-v1',
  horse: 'volume2-birth-year-branch-table; annual-reapplication-is-candidate-only',
  cutVoid: 'volume2-birth-year-stem-unordered-two-palace-group-no-primary-secondary-name-assignment',
  xunVoid: 'volume2-birth-sexagenary-year-six-xun-unordered-pair-not-day-or-current-year',
  sky: 'separate-source-hour-sky-and-robbery-not-any-archive-name-containing-kong',
  contact: 'same-opposite-trine-adjacent-other-separated; dynamic-Chang-unverified',
  encounters: 'yearly-tai-sui-to-native-horse-plus-named-same-seat-companions-or-birth-void-pairs',
  xingSha: 'natal-Tianxing-from-birth-month-and-Qisha-opposite-Tianfu-verified-against-Ziwei',
  xingShaZiweiPlacement: quanshuZiweiBirthAnchorProof,
  flowingHorse: 'verified-yearly-flow-horse-and-actual-limit-co-seat-with-named-companions-or-birth-voids',
  mingNatalHorse: 'quanshu-nanyangtang-cut-void-horse-guard-v1',
  archiveLayers: 'quanshu-horse-natal-star-layers-v1',
  calendar: 'native-lunar-new-year-and-civil-midnight',
} as const;

export function quanshuBirthVoidPairs(yearPillar: string) {
  if (typeof yearPillar !== 'string' || yearPillar.length !== 2) throw new RangeError('Invalid source void year');
  const index = Array.from({ length: 60 }, (_, i) => i).find(i => stems[i % 10] + branches[i % 12] === yearPillar);
  if (index === undefined) throw new RangeError('Invalid source sexagenary year');
  const xunIndex = Math.floor(index / 10), head = index - index % 10;
  return { yearPillar, xunHead: stems[head % 10] + branches[head % 12],
    cutVoidPair: [...['申酉', '午未', '辰巳', '寅卯', '子丑'][stems.indexOf(yearPillar[0]) % 5]],
    xunVoidPair: [...['戌亥', '申酉', '午未', '辰巳', '寅卯', '子丑'][xunIndex]] };
}

type Args = [...Parameters<typeof quanshuDoujunCondition>, yearlyPalaces?: readonly QuanshuYearlyPalace[]];

export function quanshuHorseVoidCondition(...args: Args) {
  const [natal, palaceIndex, annualIndex, lunarYear, scope, decadalIndex, minorIndex, yearlyPalaces] = args;
  const basis = readQuanshuNatal(natal), focus = natal.palaces.find(p => p.index === palaceIndex);
  const annual = natal.palaces.find(p => p.index === annualIndex), decadal = natal.palaces.find(p => p.index === decadalIndex);
  const minor = natal.palaces.find(p => p.index === minorIndex);
  const unavailable = { ready: false, reason: 'unavailable_horse_void_basis' } as const;
  if ((basis.status !== 'ready' && basis.status !== 'inconsistent_lu_yang_tuo') || !focus || !annual) return unavailable;
  const birthYear = natal.rawDates.lunarDate.lunarYear;
  if (!Number.isInteger(lunarYear) || lunarYear < Math.max(1, birthYear) || lunarYear > 9998
    || !['decadal', 'minor', 'yearly'].includes(scope)) return unavailable;
  const birthYearBranch = branches[mod(birthYear - 4)], annualBranch = branches[mod(lunarYear - 4)];
  if (natal.rawDates.chineseDate.yearly[1] !== birthYearBranch || annual.earthlyBranch !== annualBranch
    || decadalIndex !== undefined && !decadal || minorIndex !== undefined && !minor
    || scope === 'yearly' && palaceIndex !== annualIndex || scope === 'decadal' && palaceIndex !== decadalIndex
    || scope === 'minor' && palaceIndex !== minorIndex) return { ready: false, reason: 'inconsistent_horse_void_geometry' } as const;
  const all = (palace: typeof focus) => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
  const locations = (star: string) => natal.palaces.flatMap(palace => all(palace).filter(s => s.name === star).map(() => palace.earthlyBranch));
  const layeredBranch = (star: string, layer: 'majorStars' | 'minorStars' | 'adjectiveStars') => {
    const placements = locations(star);
    if (placements.length !== 1) return undefined;
    const palace = natal.palaces.find(p => p.earthlyBranch === placements[0]);
    return palace?.[layer].some(row => row.name === star) ? placements[0] : undefined;
  };
  const horseBranch = quanshuHorseBranch(birthYearBranch);
  if (layeredBranch('天马', 'minorStars') !== horseBranch) return { ready: false, reason: 'inconsistent_source_horse' } as const;
  const annualStem = stems[((lunarYear - 4) % 10 + 10) % 10];
  const annualAtHorse = annualBranch === horseBranch;
  const flowTuoluoBranch = verifiedQuanshuYearlyStar(yearlyPalaces, '流陀', quanshuLuYangTuo(annualStem).tuoluoBranch);
  const horseAnnualTuoluoCandidate = !annualAtHorse ? false : flowTuoluoBranch === undefined ? undefined : flowTuoluoBranch === horseBranch;
  const basisFields = { ready: true, profile: quanshuHorseVoidPolicy.profile, horseArchiveLayerProof: quanshuHorseVoidPolicy.archiveLayers,
    scope, lunarYear, branch: focus.earthlyBranch, natalName: focus.name, annualStem, annualBranch, birthYearBranch,
    horseBranch, natalHorseAtFocus: focus.earthlyBranch === horseBranch, horseAnnualTuoluoCandidate, flowTuoluoBranch } as const;
  if (basis.status !== 'ready') {
    // 明刊另按流年干安流陀，不借未核的本命禄羊陀填补其他组合。
    return scope === 'yearly' ? basisFields : unavailable;
  }
  const voids = quanshuBirthVoidPairs(basis.birthStem + birthYearBranch);
  const annualVoidCandidates = quanshuBirthVoidPairs(annualStem + annualBranch);
  const archiveVoids = ['截路', '空亡', '旬空', '截空', '副截', '副旬', '天空', '地空', '地劫'].flatMap(star =>
    locations(star).map(branch => ({ star, branch, horseRelation: relation(horseBranch, branch),
      focusRelation: relation(focus.earthlyBranch, branch) })));
  // The book provides two-palace groups; no unverified principal/secondary
  // star naming, polarity choice, day-xun substitution or archive override.
  const groups = [{ kind: '截路空亡', pair: voids.cutVoidPair }, { kind: '旬中空亡', pair: voids.xunVoidPair }].map(row => ({
    ...row, atHorse: row.pair.includes(horseBranch), atFocus: row.pair.includes(focus.earthlyBranch),
    members: row.pair.map(branch => ({ branch, horseRelation: relation(horseBranch, branch), focusRelation: relation(focus.earthlyBranch, branch) })),
  }));
  const sky = quanshuKongJiePositions(natal), tianxing = quanshuTianxingCondition(natal, palaceIndex);
  const tianxingBranch = tianxing.ready ? tianxing.tianxingBranch : undefined;
  const tuoluoBranch = layeredBranch('陀罗', 'minorStars');
  const ziweiBranch = layeredBranch('紫微', 'majorStars');
  const tianfuBranch = layeredBranch('天府', 'majorStars');
  const qishaBranch = layeredBranch('七杀', 'majorStars');
  const companion = (star: string, branch?: string) => ({
    star, known: branch !== undefined, branch, horseRelation: branch === undefined ? undefined : relation(horseBranch, branch),
    focusRelation: branch === undefined ? undefined : relation(focus.earthlyBranch, branch),
  });
  const companions = [companion('禄存', basis.lucunBranch), companion('陀罗', tuoluoBranch), companion('紫微', ziweiBranch),
    companion('天府', tianfuBranch), companion('七杀', qishaBranch), ...(tianxingBranch ? [companion('天刑', tianxingBranch)] : [])];
  const support = readQuanshuSupportNatal(natal);
  const annualHorseCandidateBranch = quanshuHorseBranch(annualBranch);
  const scopeRelations = [
    { scope: 'yearly', palace: annual }, { scope: 'decadal', palace: decadal }, { scope: 'minor', palace: minor },
  ].flatMap(row => row.palace ? [{ scope: row.scope, branch: row.palace.earthlyBranch,
    natalName: row.palace.name, horseRelation: relation(horseBranch, row.palace.earthlyBranch),
    focusRelation: relation(focus.earthlyBranch, row.palace.earthlyBranch) }] : []);
  const nominalAge = lunarYear - birthYear + 1;
  const { verifiedLifeBureau } = quanshuLifeBureau(natal, basis);
  const horseGrowth = verifiedLifeBureau ? quanshuGrowthAtBranch(verifiedLifeBureau, natal.gender, horseBranch) : undefined;
  const horseDeadOrExtinctStageCandidate = !annualAtHorse ? false : horseGrowth && ['死', '绝'].includes(horseGrowth.phase);
  const sourceDecadal = quanshuDecadalVerification(natal, basis, decadal, lunarYear, verifiedLifeBureau);
  const verifiedDecadal = sourceDecadal?.verified === true ? sourceDecadal.branch : undefined;
  const minorSource = quanshuMinorLimit(birthYearBranch, natal.gender, nominalAge);
  const sourceMinorVerified = minorSource && minor ? minor.earthlyBranch === minorSource.branch : undefined;
  const verifiedMinor = sourceMinorVerified === true ? minorSource?.branch : undefined;
  const mingHorseGuardScopes = [...(verifiedDecadal === horseBranch ? ['decadal'] : []),
    ...(verifiedMinor === horseBranch ? ['minor'] : [])];
  const mingHorseGuard = mingHorseGuardScopes.length > 0 ? true : !verifiedDecadal || !verifiedMinor ? undefined : false;
  const horseCutVoidCandidate = annualAtHorse && voids.cutVoidPair.includes(horseBranch);
  const mingHorseCutVoidGuardCandidate = horseCutVoidCandidate ? mingHorseGuard : false;
  const mingHorseCutVoidAnnualCandidate = horseCutVoidCandidate && mingHorseCutVoidGuardCandidate !== true;
  const skyBranch = sky.ready ? sky.skyBranch : 'verifiedSkyBranch' in sky ? sky.verifiedSkyBranch : undefined;
  const robberyBranch = sky.ready ? sky.robberyBranch : 'verifiedRobberyBranch' in sky ? sky.verifiedRobberyBranch : undefined;
  const horseSkyVoidCandidate = !annualAtHorse ? false : skyBranch === undefined ? undefined : skyBranch === horseBranch;
  const horseXunVoidCandidate = annualAtHorse && voids.xunVoidPair.includes(horseBranch);
  const bodyPositionAtHorse = quanshuBodyLifePositions(basis.birthMonth, basis.birthHour).bodyBranch === horseBranch;
  const bodyAtHorse = annualAtHorse && basis.lifeBranch !== horseBranch && bodyPositionAtHorse
    && (horseSkyVoidCandidate !== false || horseXunVoidCandidate) ? readQuanshuBodyNatal(natal) : undefined;
  const mingHorseLifeBodyRole = !annualAtHorse ? undefined : basis.lifeBranch === horseBranch ? '命宫'
    : bodyAtHorse?.ready === true ? '身宫' : undefined;
  const lifeBodyVoid = (candidate?: boolean) => candidate === false || (!bodyPositionAtHorse && basis.lifeBranch !== horseBranch)
    ? false : mingHorseLifeBodyRole ? candidate : undefined;
  const mingHorseLifeBodySkyVoidAnnualCandidate = lifeBodyVoid(horseSkyVoidCandidate);
  const mingHorseLifeBodyXunVoidAnnualCandidate = lifeBodyVoid(horseXunVoidCandidate);
  const sourceVoidsAtHorse = [skyBranch, robberyBranch].some(branch => branch !== undefined && branch !== horseBranch) ? false
    : skyBranch === horseBranch && robberyBranch === horseBranch ? true : undefined;
  const mingHorseNativeVoidsGuardCandidate = !annualAtHorse || mingHorseGuard === false || sourceVoidsAtHorse === false ? false
    : sourceVoidsAtHorse === true ? mingHorseGuard : undefined;
  // 起本命紫微，再依〈安天府图〉、〈安南北斗诸星诀〉核天府、七杀。
  const ziweiExpectedBranch = quanshuZiweiBirthAnchor(natal, verifiedLifeBureau);
  const ziweiVerified = ziweiBranch === undefined || ziweiExpectedBranch === undefined ? undefined : ziweiBranch === ziweiExpectedBranch;
  const tianfuExpectedBranch = ziweiExpectedBranch === undefined ? undefined : branches[mod(4 - branches.indexOf(ziweiExpectedBranch))];
  const tianfuVerified = tianfuBranch === undefined || tianfuExpectedBranch === undefined ? undefined : tianfuBranch === tianfuExpectedBranch;
  const qishaExpectedBranch = tianfuExpectedBranch === undefined ? undefined : branches[mod(branches.indexOf(tianfuExpectedBranch) + 6)];
  const qishaVerified = qishaBranch === undefined || qishaExpectedBranch === undefined || ziweiVerified === undefined || tianfuVerified === undefined
    ? undefined : ziweiVerified && tianfuVerified && qishaBranch === qishaExpectedBranch;
  const sourceQishaBranch = qishaVerified ? qishaBranch : undefined;
  const xingShaSeatProof = { tianxingBranch, ziweiBranch, ziweiExpectedBranch, ziweiVerified, tianfuBranch, tianfuExpectedBranch, tianfuVerified,
    qishaBranch, qishaExpectedBranch, qishaVerified };
  const tianxingAtHorse = tianxingBranch === undefined ? undefined : tianxingBranch === horseBranch;
  const qishaAtHorse = sourceQishaBranch === undefined ? undefined : sourceQishaBranch === horseBranch;
  const horseLuQishaXunVoidGuardCandidate = !horseXunVoidCandidate || basis.lucunBranch !== horseBranch
    || mingHorseGuard === false || qishaAtHorse === false ? false
    : mingHorseGuard === true && qishaAtHorse === true ? true : undefined;
  const horseTianxingQishaCandidate = !annualAtHorse || tianxingAtHorse === false || qishaAtHorse === false ? false
    : tianxingAtHorse === true && qishaAtHorse === true ? true : undefined;
  const lifeHorseXingShaAtVerifiedLimit = horseTianxingQishaCandidate === false || basis.lifeBranch !== horseBranch || mingHorseGuard === false
    ? false : horseTianxingQishaCandidate === true && mingHorseGuard === true ? true : undefined;
  const decadalHorseGuard = verifiedDecadal === undefined ? undefined : verifiedDecadal === horseBranch;
  const nonLifeHorseXingShaAtVerifiedDecade = horseTianxingQishaCandidate === false || basis.lifeBranch === horseBranch || decadalHorseGuard === false
    ? false : horseTianxingQishaCandidate === true && decadalHorseGuard === true ? true : undefined;
  const horseXingShaAnnualCandidate = horseTianxingQishaCandidate === true
    ? lifeHorseXingShaAtVerifiedLimit !== true && nonLifeHorseXingShaAtVerifiedDecade !== true : horseTianxingQishaCandidate;
  const sourceVoids = [
    ...(skyBranch ? [{ kind: '古天空', branch: skyBranch }] : []),
    ...(robberyBranch ? [{ kind: '地劫', branch: robberyBranch }] : []),
  ].map(row => ({ ...row, horseRelation: relation(horseBranch, row.branch), focusRelation: relation(focus.earthlyBranch, row.branch) }));
  const flowHorse = quanshuFlowHorse(annualBranch, yearlyPalaces, verifiedDecadal, verifiedMinor);
  const flowMeets = (branch?: string) => quanshuFlowHorseAtBranch(flowHorse, branch);
  const flowTianxing = flowMeets(tianxingBranch), flowQisha = flowMeets(sourceQishaBranch);
  const flowInVoid = (pair: readonly string[]) => flowHorse.atLimit === false || (flowHorse.branch && !pair.includes(flowHorse.branch))
    ? false : flowHorse.atLimit;
  return { ...basisFields, xingShaNatalZiweiPlacementProof: quanshuHorseVoidPolicy.xingShaZiweiPlacement, ...voids, annualHorseCandidateBranch,
    annualHorseAtFocus: focus.earthlyBranch === annualHorseCandidateBranch, annualHorseRuleVerified: false,
    annualVoidCandidates, annualVoidRuleVerified: false,
    scopeRelations, sourceDecadal, limitPlacementProof: quanshuLimitPlacementProof,
    sourceMinor: minorSource && { ...minorSource, verified: sourceMinorVerified },
    decadalMinorSamePalace: verifiedDecadal && verifiedMinor ? verifiedDecadal === verifiedMinor : undefined,
    groups, archiveVoids, sourceSkyReady: skyBranch !== undefined, sourceRobberyReady: robberyBranch !== undefined, sourceVoidPairReady: sky.ready,
    horseTianxingQishaCandidate, lifeHorseXingShaAtVerifiedLimit, nonLifeHorseXingShaAtVerifiedDecade, horseXingShaAnnualCandidate,
    horseCutVoidCandidate, horseLuQishaXunVoidGuardCandidate,
    horseXunVoidCandidate, horseSkyVoidCandidate, mingHorseLifeBodyRole,
    mingHorseLifeBodySkyVoidAnnualCandidate, mingHorseLifeBodyXunVoidAnnualCandidate,
    horseGrowthProfile: quanshuGrowthProfile, horseGrowth, horseDeadOrExtinctStageCandidate,
    mingNatalHorseProfile: quanshuHorseVoidPolicy.mingNatalHorse,
    mingHorseCutVoidGuardCandidate, mingHorseCutVoidAnnualCandidate, mingHorseNativeVoidsGuardCandidate,
    mingHorseGuardScopes: mingHorseCutVoidGuardCandidate === true || mingHorseNativeVoidsGuardCandidate === true
      ? mingHorseGuardScopes : [],
    horseTuoluoTogetherCandidate: !annualAtHorse ? false : tuoluoBranch === undefined ? undefined : tuoluoBranch === horseBranch,
    flowHorse,
    flowHorseXingShaCandidate: flowTianxing === false || flowQisha === false ? false
      : flowTianxing === true && flowQisha === true ? true : undefined,
    flowHorseCutVoidCandidate: flowInVoid(voids.cutVoidPair),
    flowHorseXunVoidCandidate: flowInVoid(voids.xunVoidPair),
    flowHorseSkyVoidCandidate: flowMeets(skyBranch),
    flowHorseNatalTuoluoCandidate: flowMeets(tuoluoBranch),
    flowHorseAnnualTuoluoCandidate: flowMeets(flowTuoluoBranch),
    sourceVoids: sourceVoids.length ? sourceVoids : undefined,
    modernSkyBranches: sky.ready ? sky.modernSkyBranches : locations('天空'),
    companions, tianxingReady: tianxingBranch !== undefined, xingShaSeatProof,
    tuoluoBranch, tuoluoHorseRelation: tuoluoBranch === undefined ? undefined : relation(horseBranch, tuoluoBranch),
    supportReady: support.ready, natalAuxiliary: support.ready ? support.sourcePositions.filter(row => ['文昌', '文曲'].includes(row.star))
      .map(row => ({ ...row, horseRelation: relation(horseBranch, row.branch), focusRelation: relation(focus.earthlyBranch, row.branch) })) : undefined,
    flowChangRuleVerified: false, geometryOnly: true,
  } as const;
}
