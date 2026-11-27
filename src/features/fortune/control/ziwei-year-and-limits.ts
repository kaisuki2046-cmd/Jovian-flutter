import type { quanshuLimitBranches } from './ziwei-limit-branches';
import { quanshuBrightness, quanshuMajorStarNames, quanshuPalaceRelation, quanshuVerifiedMajorPositions, readQuanshuNatal, type quanshuAnnualContext } from './ziwei-quanshu';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Limits = ReturnType<typeof quanshuLimitBranches>;
type Annual = ReturnType<typeof quanshuAnnualContext>;
type Layer = 'decadal' | 'minor' | 'yearly';
type Star = { star: string; branch: string; grade?: string };
const allKnown = (checks: (boolean | undefined)[]) => checks.includes(false) ? false : checks.includes(undefined) ? undefined : true;
const anyKnown = (checks: (boolean | undefined)[]) => checks.includes(true) ? true : checks.includes(undefined) ? undefined : false;

export const quanshuYearAndLimitsPolicy = {
  profile: 'quanshu-v3-year-and-limits-v1',
  basis: 'one-known-natal-chart-and-native-lunar-year-limit-intersections',
  guards: 'local-book-grade-cells-and-verified-source-star-seats',
  contacts: 'three-pairs-and-annual-opposition-to-natal-yang-tuo-qisha',
  annualYangTuo: 'tai-sui-opposition-to-year-stem-yang-tuo-on-the-same-three-layer-fragment',
  mutualTrines: 'three-distinct-actual-seats-with-all-three-pairs-trinal',
  shangShi: 'three-distinct-actual-seats-each-guarded-by-fallen-major-and-natal-sha-with-verified-shang-or-shi',
  outcome: 'preserve-stage-evidence-without-assuming-a-weight-or-effective-rescue',
} as const;

export function quanshuYearAndLimits(natal: Natal, limits: Limits, annual?: Annual) {
  const birth = readQuanshuNatal(natal);
  if (!limits.ready || birth.status !== 'ready') return { ready: false } as const;

  const archivedMajors: Star[] = quanshuMajorStarNames.flatMap(star => {
    const [palace, ...others] = natal.palaces.flatMap(p => p.majorStars.filter(row => row.name === star).map(() => p));
    return palace && !others.length ? [{ star, branch: palace.earthlyBranch,
      grade: quanshuBrightness(star, palace.earthlyBranch) }] : [];
  });
  if (archivedMajors.length !== quanshuMajorStarNames.length) return { ready: false } as const;
  const verifiedMajors = quanshuVerifiedMajorPositions(star => {
    const branch = archivedMajors.find(row => row.star === star)?.branch;
    return branch === limits.principalPositions.find(row => row.star === star)?.branch ? branch : undefined;
  });
  const majors = archivedMajors.filter(row => verifiedMajors.get(row.star) === row.branch);
  const allMajorSeatsVerified = majors.length === quanshuMajorStarNames.length;

  const lucun = { star: '禄存', branch: birth.lucunBranch };
  const helpers = [lucun, ...limits.relief.filter(group => ['文昌文曲', '左辅右弼'].includes(group.name))
    .flatMap(group => group.stars.flatMap(row => row.branch ? [{ star: row.star, branch: row.branch }] : []))];
  const sha = limits.adverse.filter(group => ['羊陀', '归档火铃', '古空劫'].includes(group.name))
    .flatMap(group => group.stars.flatMap(row => row.branch
      ? [{ star: group.name === '归档火铃' ? '归档' + row.star : row.star, branch: row.branch }] : []));
  const addGrade = (row: Star) => ({ ...row, grade: quanshuBrightness(row.star.replace(/^归档/u, ''), row.branch) });
  const positions = [...majors, ...helpers.map(addGrade), ...sha.map(addGrade)];
  const possibleSupport = positions.filter(row => ['紫微', '天府', '天同', '太阳', '太阴', '文昌', '文曲'].includes(row.star)
    && (row.grade === '庙' || row.grade === '旺')).concat(helpers.filter(row => ['左辅', '右弼', '禄存'].includes(row.star)));

  const scopes: { layer: Layer; branch?: string }[] = [
    { layer: 'decadal', branch: limits.sourceDecadal?.verified === true ? limits.sourceDecadal.branch : undefined },
    { layer: 'minor', branch: limits.sourceMinor?.verified === true ? limits.sourceMinor.branch : undefined },
    { layer: 'yearly', branch: limits.annualBranch },
  ];
  const guards = scopes.flatMap(({ layer, branch }) => {
    const palace = natal.palaces.find(row => row.earthlyBranch === branch);
    if (!palace || !branch) return [];
    const stars = positions.filter(row => row.branch === branch);
    const adverseGuards = sha.filter(row => row.branch === branch).map(row => row.star);
    return [{ layer, branch, natalName: palace.name, stars, adverseGuards,
      supportGuards: possibleSupport.filter(row => row.branch === branch).map(row => row.star),
      fallenMajors: majors.filter(row => row.branch === branch && row.grade === '陷').map(row => row.star) }];
  });
  const pairs = guards.flatMap((first, i) => guards.slice(i + 1).map(second => ({ first: first.layer, second: second.layer,
    relation: quanshuPalaceRelation(first.branch, second.branch) })));
  const annualOppositions = guards.filter(row => row.layer !== 'yearly'
    && quanshuPalaceRelation(limits.annualBranch, row.branch) === '冲').map(row => row.layer);
  const annualContact = (row: Star) => ({ ...row, relation: quanshuPalaceRelation(limits.annualBranch, row.branch) });
  const annualNamedStarContacts = [{ star: '擎羊', branch: birth.qingyangBranch }, { star: '陀罗', branch: birth.tuoluoBranch },
    ...majors.filter(row => row.star === '七杀')].map(annualContact);
  const annualFlowContacts = annual?.ready && annual.lunarYear === limits.lunarYear
    && annual.birthYear === birth.birthYear && annual.lifeBranch === birth.lifeBranch
    ? [{ star: '擎羊', branch: annual.annualQingyangBranch }, { star: '陀罗', branch: annual.annualTuoluoBranch }].map(annualContact)
    : undefined;
  const independentGuardsReady = guards.length === scopes.length;
  const annualFlowOppositionCandidate = independentGuardsReady ? annualFlowContacts?.some(row => row.relation === '冲') : undefined;
  const threeLayerTrineCandidate = independentGuardsReady ? pairs.every(row => row.relation === '三合') : undefined;
  const fallenWithAdverseAtAllThree = independentGuardsReady
    && guards.every(row => row.fallenMajors.length > 0 && row.adverseGuards.length > 0);
  const knownLimitContact = pairs.some(row => row.relation === '守') || annualOppositions.length > 0
    || annualNamedStarContacts.some(row => row.relation === '冲') || fallenWithAdverseAtAllThree;
  const reviewedLimitContact = independentGuardsReady && (knownLimitContact || allMajorSeatsVerified) ? knownLimitContact : undefined;
  const gradedNamedStars = [...majors, ...limits.verifiedNatalYangTuo.flatMap(row => row.branch === undefined ? []
    : [addGrade({ star: row.star, branch: row.branch })])].filter(row => row.grade !== undefined);
  const completeGradedRoster = allMajorSeatsVerified && limits.verifiedNatalYangTuo.every(row => row.branch !== undefined);
  const verifiedIndependentGradedGuardsCandidate = independentGuardsReady ? allKnown([
    new Set(guards.map(row => row.branch)).size === 3,
    annualOppositions.length === 1,
    ...guards.map(({ branch }) => gradedNamedStars.some(row => row.branch === branch) ? true : completeGradedRoster ? false : undefined),
  ]) : undefined;
  const shangShi = limits.adverse.find(group => group.name === '伤使')!.stars;
  const nativeSha = [...limits.adverse.filter(group => ['羊陀', '古空劫'].includes(group.name)).flatMap(group => group.stars), ...shangShi];
  const knownShaPositions = nativeSha.every(row => row.branch !== undefined);
  const sameSeatSha = guards.map(({ layer, branch, fallenMajors }) => ({ scope: layer, branch, fallenStars: fallenMajors,
    shaStars: nativeSha.filter(row => row.branch === branch).map(row => row.star) }));
  const atAnyGuard = (branch?: string) => branch === undefined ? undefined : guards.some(row => row.branch === branch);
  const threeLayerFallenShangShiCandidate = independentGuardsReady ? allKnown([
    new Set(guards.map(row => row.branch)).size === 3,
    anyKnown(shangShi.map(row => atAnyGuard(row.branch))),
    ...sameSeatSha.map(row => allKnown([row.fallenStars.length > 0 ? true : allMajorSeatsVerified ? false : undefined,
      row.shaStars.length > 0 ? true : knownShaPositions ? false : undefined])),
  ]) : undefined;

  const annualAtLife = limits.annualBranch === birth.lifeBranch;
  const annualMinorSameSeatVerified = limits.sourceMinor?.verified === true
    ? limits.sourceMinor.branch === limits.annualBranch : undefined;
  const annualAnchoredMajors = limits.ziweiBirthAnchorVerified === true
    ? majors.filter(row => row.branch === limits.annualBranch
      && limits.birthAnchoredMajorBranches[row.star] === row.branch) : undefined;
  const lifeArea = annualAtLife ? natal.palaces.flatMap(palace => {
    const branch = palace.earthlyBranch, relation = quanshuPalaceRelation(birth.lifeBranch, branch);
    return relation === '其他' ? [] : [{ branch, relation, natalName: palace.name, stars: positions.filter(row => row.branch === branch),
      supportPositions: possibleSupport.filter(row => row.branch === branch).map(row => row.star),
      adversePositions: sha.filter(row => row.branch === branch).map(row => row.star) }];
  }) : [];
  return { ready: true, profile: quanshuYearAndLimitsPolicy.profile, lunarYear: limits.lunarYear, birthStem: birth.birthStem,
    lifeBranch: birth.lifeBranch, annualBranch: limits.annualBranch, guards, pairs, annualOppositions, annualNamedStarContacts,
    annualOppositionProfile: limits.annualOppositionProfile, sourceMinor: limits.sourceMinor, sourceDecadal: limits.sourceDecadal,
    limitPlacementProof: limits.limitPlacementProof, verifiedIndependentGradedGuardsCandidate,
    annualDoubleVerifiedOppositionCandidate: limits.annualDoubleVerifiedOppositionCandidate,
    annualFlowContacts, annualFlowOppositionCandidate, threeLayerTrineCandidate, threeLayerFallenShangShiCandidate,
    threeLayerFallenShangShiWitnesses: threeLayerFallenShangShiCandidate === true ? sameSeatSha : [],
    independentGuardsReady, fallenWithAdverseAtAllThree, reviewedLimitContact, annualAtLife, lifeArea,
    annualMinorSameSeatVerified,
    annualTempleMajorStars: annualAnchoredMajors?.filter(row => row.grade === '庙').map(row => row.star),
    annualNonTempleMajorStars: annualAnchoredMajors?.filter(row => row.grade && row.grade !== '庙').map(row => row.star),
    guiLifeZiExample: annualAtLife && birth.birthStem === '癸' && birth.lifeBranch === '子' } as const;
}
