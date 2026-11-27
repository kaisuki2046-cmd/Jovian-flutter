import { quanshuBirthAnchoredMajorPositions, quanshuZiweiBirthAnchorProof } from './ziwei-birth-major-anchor';
import { jielanFireBellProfile, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import { quanshuLifeBureau, quanshuLimitPlacementProof } from './ziwei-growth-stages';
import { quanshuFourFlying, quanshuKongJiePositions } from './ziwei-kongjie';
import type { quanshuLimitBranches } from './ziwei-limit-branches';
import { quanshuLuYangTuo, quanshuMajorStarNames, quanshuPalaceRelation, readQuanshuNatal } from './ziwei-quanshu';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Limits = ReturnType<typeof quanshuLimitBranches>;
type Condition = boolean | undefined;
const branches = '子丑寅卯辰巳午未申酉戌亥';
const stems = '甲乙丙丁戊己庚辛壬癸';
const visible = ['守', '冲', '三合'];
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const contact = (branch?: string, target?: string) => branch && target ? quanshuPalaceRelation(branch, target) : undefined;
const atSeat = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : relation === '守';
const inArea = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : visible.includes(relation);
const inAspect = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : relation === '冲' || relation === '三合';
const sameBranch = (branch?: string, target?: string) => branch === undefined || target === undefined ? undefined : branch === target;

export const quanshuKongJieLimitPolicy = {
  profile: 'quanshu-kongjie-limit-branches-v1',
  pairing: 'verified-native-voids-and-actual-limit-seats-in-the-same-lunar-year-fragment',
  pairAspect: 'one-limit-guards-one-void-and-the-other-aspects-the-second-void-which-also-aspects-the-guarded-palace',
  sha: 'annual-yang-tuo-and-labelled-four-flying-and-natal-boshi-official',
  taiSuiSha: 'verified-native-yang-or-tuo-in-the-annual-palace-guarding-or-opposing-the-actual-robbery-limit',
  taiSuiFireBellEnvoy: 'verified-archive-fire-bell-or-source-envoy-guarding-the-annual-palace',
  mingBoshiOfficial: 'quanshu-nanyangtang-boshi-official-same-limit-v1',
  support: 'recorded-principal-groups-and-distinct-explicit-support-candidates',
  skySupportLimits: 'actual-decade-and-source-verified-small-limit-kept-separate-from-archived-geometry',
  lucun: 'separate-natal-and-year-stem-lucun-at-an-aspect-to-sky-or-guarding-its-aspecting-partner-limit',
  partnerSkySupport: 'the-other-aspecting-limit-guards-both-a-verified-principal-and-a-distinct-support-star',
} as const;

const quanshuBoshiOffsets = { 将军: 4, 奏书: 5, 大耗: 9, 官府: 11 } as const;

export function quanshuVerifiedBoshiPosition(natal: Natal, stem: string, star: keyof typeof quanshuBoshiOffsets) {
  if (natal.gender !== '男' && natal.gender !== '女') return undefined;
  const birthLu = branches.indexOf(quanshuLuYangTuo(stem).lucunBranch);
  const forward = '甲丙戊庚壬'.includes(stem) === (natal.gender === '男');
  const offset = quanshuBoshiOffsets[star];
  const calculated = branches[(birthLu + (forward ? offset : 12 - offset)) % 12];
  const archived = natal.palaces.filter(palace => palace.boshi12 === star);
  return archived.length === 1 && archived[0].earthlyBranch === calculated ? calculated : undefined;
}

export function quanshuKongJieLimits(natal: Natal, limits: Limits) {
  if (!limits.ready) return { ready: false } as const;
  const voids = quanshuKongJiePositions(natal);
  const skyBranch = voids.ready ? voids.skyBranch : 'verifiedSkyBranch' in voids ? voids.verifiedSkyBranch : undefined;
  const robberyBranch = voids.ready ? voids.robberyBranch : 'verifiedRobberyBranch' in voids ? voids.verifiedRobberyBranch : undefined;
  if (skyBranch === undefined && robberyBranch === undefined) return { ready: false } as const;
  const { lunarYear, annualBranch, decadalBranch, minorBranch, birthStem, sourceDecadal } = limits;
  const verifiedDecadal = sourceDecadal?.verified === true ? sourceDecadal.branch : undefined;
  const verifiedMinor = limits.sourceMinor?.verified === true ? limits.sourceMinor.branch : undefined;
  const skyRobberyTogether = sameBranch(skyBranch, robberyBranch);
  const contacts = (branch?: string) => ({ annual: contact(branch, annualBranch),
    decadal: contact(branch, decadalBranch), minor: contact(branch, minorBranch) } as const);
  const sky = contacts(skyBranch), robbery = contacts(robberyBranch);
  const verifiedContacts = (branch?: string) => ({ decadal: contact(branch, verifiedDecadal), minor: contact(branch, verifiedMinor) } as const);
  const skySupportLimits = verifiedContacts(skyBranch), robberyLimits = verifiedContacts(robberyBranch);
  const skyGuarded = any(Object.values(skySupportLimits).map(atSeat));
  const verifiedRobberyMinor = atSeat(robberyLimits.minor);
  const verifiedRobberyDecadal = atSeat(robberyLimits.decadal);
  const robberyVerifiedLimit = any([verifiedRobberyDecadal, verifiedRobberyMinor]);
  const robberyVerifiedLimitScopes = ([['decadal', verifiedRobberyDecadal], ['minor', verifiedRobberyMinor]] as const)
    .filter(([, guards]) => guards === true).map(([scope]) => scope);
  const taiSuiAtRobberyLimit = all([robberyVerifiedLimit, robbery.annual === undefined ? undefined
    : robbery.annual === '守' || robbery.annual === '冲']);
  const sharedPalace = all([skyRobberyTogether, skyGuarded]);
  const splitLimits = all([skyRobberyTogether === undefined ? undefined : !skyRobberyTogether, skyGuarded, robberyVerifiedLimit]);
  const voidPairRelation = contact(skyBranch, robberyBranch);
  const voidAspectPaths = ([['古天空', skyBranch, skySupportLimits, '地劫', robberyBranch, robberyLimits],
    ['地劫', robberyBranch, robberyLimits, '古天空', skyBranch, skySupportLimits]] as const).flatMap(
    ([guardStar, guardBranch, guard, otherStar, otherBranch, other]) =>
      ([['decadal', 'minor'], ['minor', 'decadal']] as const).map(([guardScope, otherScope]) => ({
        guardStar, guardBranch, guardScope, otherStar, otherBranch, otherScope, otherRelation: other[otherScope],
        candidate: all([inAspect(voidPairRelation), atSeat(guard[guardScope]), inAspect(other[otherScope])]),
      })),
  );

  const annualStem = stems[(lunarYear - 4 + 10) % 10];
  const annualSha = quanshuLuYangTuo(annualStem);
  const atRobbery = (star: string, branch?: string) => ({ star, branch, relation: contact(robberyBranch, branch) } as const);
  const annualShaPositions = [atRobbery('流年擎羊', annualSha.qingyangBranch), atRobbery('流年陀罗', annualSha.tuoluoBranch)];
  const annualOfficial = atRobbery('四飞官府', quanshuFourFlying(lunarYear).placements.find(row => row.name === '官府')?.branch);
  const boshiOfficial = atRobbery('本命博士官府', quanshuVerifiedBoshiPosition(natal, birthStem, '官府'));
  const robberyMingBoshiOfficialGuardCandidate = all([atSeat(boshiOfficial.relation), robberyVerifiedLimit]);
  const robberyMingBoshiOfficialScopes = robberyMingBoshiOfficialGuardCandidate === true
    ? robberyVerifiedLimitScopes : [];
  const robberyFourFlyingOfficialDoubleGuardCandidate = all([
    atSeat(annualOfficial.relation), verifiedRobberyDecadal, verifiedRobberyMinor,
  ]);

  const basis = readQuanshuNatal(natal);
  const bureau = basis.status === 'ready' ? quanshuLifeBureau(natal, basis).verifiedLifeBureau : undefined;
  const { positions: verifiedMajor, ziweiBirthAnchorVerified } = quanshuBirthAnchoredMajorPositions(natal, bureau, star => {
    const branch = limits.principalPositions.find(row => row.star === star)?.branch;
    return natal.palaces.find(row => row.earthlyBranch === branch)?.majorStars.some(row => row.name === star) ? branch : undefined;
  });
  // The Ming combined verse separately discusses Ziwei at Mao or You.
  const ziweiBranch = verifiedMajor.get('紫微');
  const ziweiOutsideVoidException = ziweiBranch === undefined ? undefined : !'卯酉'.includes(ziweiBranch);
  const voidsBothActualLimitsGuardCandidate = all([skyRobberyTogether, verifiedRobberyDecadal, verifiedRobberyMinor, ziweiOutsideVoidException]);
  const voidsSeparateActualLimitsGuardCandidate = all([splitLimits, ziweiOutsideVoidException]);
  const voidsZiweiMaoYouSplitTrineCandidate = all([
    ziweiOutsideVoidException === undefined ? undefined : !ziweiOutsideVoidException,
    splitLimits,
    voidPairRelation === undefined ? undefined : voidPairRelation === '三合',
    any([sameBranch(ziweiBranch, skyBranch), sameBranch(ziweiBranch, robberyBranch)]),
  ]);
  const voidsZiweiMaoYouSplitTrineWitness = voidsZiweiMaoYouSplitTrineCandidate === true ? {
    ziweiBranch, skyBranch, robberyBranch, decadalBranch: verifiedDecadal, minorBranch: verifiedMinor,
  } : undefined;
  const principals = limits.principalPositions.map(row => quanshuMajorStarNames.includes(row.star)
    ? { ...row, branch: verifiedMajor.get(row.star) } : row);
  const atSky = (branch?: string) => sameBranch(branch, skyBranch);
  const knownLocalPrincipals = principals.filter(row => atSky(row.branch) === true).map(row => row.star);
  const independentSupport = [...limits.verifiedBellNatalAid.filter(row => row.star === '魁钺组'),
    ...limits.verifiedBellNatalAid.filter(row => row.star === '天马')]
    .map(row => ({ ...row, relation: contact(skyBranch, row.branch) } as const));
  const lucunSupport = [{ star: '本命禄存', branch: limits.verifiedBellNatalAid.find(row => row.star === '禄存')?.branch },
    { star: '流年禄存', branch: annualSha.lucunBranch }]
    .map(row => ({ ...row, relation: contact(skyBranch, row.branch) } as const));
  const skyHasPrincipal = all([any(Object.values(skySupportLimits).map(atSeat)), inArea(sky.annual),
    any(principals.map(row => atSky(row.branch)))]);
  const skySupportCandidate = all([skyHasPrincipal, any(independentSupport.map(row => inArea(row.relation)))]);
  const skyLuSupportCandidate = all([skyHasPrincipal, any(lucunSupport.map(row => inAspect(row.relation)))]);
  const skyMainStars = principals.filter(row => quanshuMajorStarNames.includes(row.star));
  const skyAssistants = limits.relief.find(group => group.name === '左辅右弼')?.stars ?? [];
  const skyBothLimitsAtSeat = all([atSeat(skySupportLimits.decadal), atSeat(skySupportLimits.minor)]);
  const skyAllThreeAtSeat = all([atSeat(sky.annual), skyBothLimitsAtSeat]);
  const localMainStars = skyMainStars.filter(row => atSky(row.branch) === true);
  const localAssistants = skyAssistants.filter(row => atSky(row.branch) === true);
  const mainAtSky = any(skyMainStars.map(row => atSky(row.branch)));
  const assistantAtSky = any(skyAssistants.map(row => atSky(row.branch)));
  const skyCoSeatedAssistantCandidate = all([skyAllThreeAtSeat, mainAtSky, assistantAtSky]);
  const skyCoSeatedAssistantWitness = skyCoSeatedAssistantCandidate === true ? {
    branch: skyBranch, principals: localMainStars.map(row => row.star),
    assistants: localAssistants.map(row => row.star),
  } : undefined;
  const nobleSeats = independentSupport.filter(row => row.star === '魁钺组');
  const noblePairVerified = nobleSeats.length === 2 && nobleSeats.every(row => row.branch !== undefined);
  const nobleAtSky = any(nobleSeats.map(row => atSeat(row.relation)));
  const skyCoSeatedNobleCandidate = all([skyAllThreeAtSeat, mainAtSky, noblePairVerified ? nobleAtSky : undefined]);
  const skyCoSeatedNobleWitness = skyCoSeatedNobleCandidate === true ? {
    branch: skyBranch, principals: localMainStars.map(row => row.star), noble: '魁钺组',
  } : undefined;
  const skyCoSeatedMingAuxiliaryNobleCandidate = all([skyAllThreeAtSeat, assistantAtSky, nobleAtSky]);
  const skyCoSeatedMingAuxiliaryNobleWitness = skyCoSeatedMingAuxiliaryNobleCandidate === true ? {
    branch: skyBranch, principals: localAssistants.map(row => row.star), noble: '魁钺组',
  } : undefined;
  // In the same Ming chapter, Tai Sui can oppose both limits with named aid at the decade seat.
  const skyOpposedDoubleLimitNamedSupportCandidate = all([
    sky.annual === undefined ? undefined : sky.annual === '冲', skyBothLimitsAtSeat, mainAtSky, any([assistantAtSky, nobleAtSky]),
  ]);
  const skyOpposedDoubleLimitNamedSupportWitness = skyOpposedDoubleLimitNamedSupportCandidate === true ? {
    branch: skyBranch, annualBranch, principals: localMainStars.map(row => row.star),
    support: [...localAssistants.map(row => row.star), ...(nobleAtSky === true ? ['魁钺组'] : [])],
  } : undefined;
  const partnerSeats = [['decadal', verifiedMinor, 'minor'], ['minor', verifiedDecadal, 'decadal']] as const;
  const partnerWitnesses = (support: { star: string; branch?: string }[]) => partnerSeats.map(
    ([guardScope, supportBranch, supportScope]) => ({
      guardScope, supportBranch, supportScope, relation: skySupportLimits[supportScope],
      principals: principals.filter(row => sameBranch(row.branch, supportBranch) === true).map(row => row.star),
      support: support.filter(row => sameBranch(row.branch, supportBranch) === true).map(row => row.star),
      candidate: all([atSeat(skySupportLimits[guardScope]), inArea(sky.annual), inAspect(skySupportLimits[supportScope]),
        any(principals.map(row => sameBranch(row.branch, supportBranch))),
        any(support.map(row => sameBranch(row.branch, supportBranch)))]),
    }),
  );
  const partnerSkySupport = partnerWitnesses(independentSupport), partnerSkyLuSupport = partnerWitnesses(lucunSupport);

  const pairedSha = limits.adverse.filter(group => ['羊陀', '归档火铃'].includes(group.name)).flatMap(group => group.stars.map(row => ({
    star: group.name === '归档火铃' ? '归档' + row.star : row.star, branch: row.branch,
    skyRelation: contact(skyBranch, row.branch), robberyRelation: contact(robberyBranch, row.branch),
  })));
  const natalYangTuo = limits.adverse.find(group => group.name === '羊陀')?.stars ?? [];
  const fourShaAtVoids = (fireBell: readonly { star: string; branch?: string }[], knownMinor: Condition) =>
    ([['古天空', skyBranch, skySupportLimits], ['地劫', robberyBranch, robberyLimits]] as const)
    .map(([voidStar, branch, voidContacts]) => {
      const scopes = (['decadal', 'minor'] as const).filter(scope => atSeat(voidContacts[scope]));
      const related = [...natalYangTuo, ...fireBell].map(({ star, branch: shaBranch }) => ({
        star, branch: shaBranch, relation: contact(branch, shaBranch),
      } as const));
      const paired = any([sharedPalace, splitLimits, ...voidAspectPaths.filter(path => path.guardStar === voidStar).map(path => path.candidate)]);
      const candidate = all([paired, knownMinor, any([atSeat(voidContacts.decadal), atSeat(voidContacts.minor)]),
        ...related.map(row => inArea(row.relation)),
        any(related.map(row => row.relation === undefined ? undefined : row.relation === '冲'))]);
      return { voidStar, branch, scopes, related, candidate };
    });
  const voidMingFixedFourSha = fourShaAtVoids(limits.quanshuFixedFireBell, true);
  const voidJielanFourSha = fourShaAtVoids(limits.jielanFireBell, limits.sourceMinor?.verified === true ? true : undefined);
  const fireBellEnvoy = limits.adverse.filter(group => ['归档火铃', '伤使'].includes(group.name))
    .flatMap(group => group.stars.map(row => ({ star: (group.name === '归档火铃' ? '归档' : '本命') + row.star, branch: row.branch })));
  const guardsTaiSui = (row: { branch?: string }) => sameBranch(row.branch, annualBranch);
  const taiSuiNamedSha = natalYangTuo.filter(row => guardsTaiSui(row) === true).map(row => '本命' + row.star);
  const taiSuiFireBellEnvoy = fireBellEnvoy.filter(row => guardsTaiSui(row) === true).map(row => row.star);
  const taiSuiQuanshuFixedFireBell = limits.quanshuFixedFireBell.filter(row => guardsTaiSui(row) === true);
  const robberyMingTaiSuiFixedFireBellDoubleGuardCandidate = all([
    atSeat(robbery.annual), verifiedRobberyDecadal, verifiedRobberyMinor, taiSuiQuanshuFixedFireBell.length > 0,
  ]);
  const taiSuiNatalSha = [{ star: '古天空', branch: skyBranch }, ...limits.verifiedNatalYangTuo];
  const robberyMingTaiSuiNatalShaDoubleGuardCandidate = all([
    taiSuiAtRobberyLimit, verifiedRobberyDecadal, verifiedRobberyMinor, any(taiSuiNatalSha.map(guardsTaiSui)),
  ]);
  const robberyMingTaiSuiNatalShaDoubleGuardWitness = robberyMingTaiSuiNatalShaDoubleGuardCandidate === true ? {
    robberyBranch, annualBranch, annualRelation: robbery.annual,
    guards: taiSuiNatalSha.filter(row => guardsTaiSui(row) === true),
  } : undefined;
  return { ready: true, profile: quanshuKongJieLimitPolicy.profile, limitPlacementProof: quanshuLimitPlacementProof,
    sourceSkyReady: skyBranch !== undefined, sourceRobberyReady: robberyBranch !== undefined, sourceDecadal,
    lunarYear, annualBranch, decadalBranch, minorBranch,
    skyBranch, robberyBranch, sky, robbery, robberyLimits, robberyVerifiedLimitScopes,
    sharedPalace, splitLimits, pairedSha, annualShaPositions, annualOfficial, boshiOfficial,
    knownLocalPrincipals, independentSupport, skySupportLimits,
    skyAllThreeAtSeat, skyCoSeatedAssistantCandidate, skyCoSeatedAssistantWitness,
    skyCoSeatedNobleCandidate, skyCoSeatedNobleWitness,
    skyCoSeatedMingAuxiliaryNobleCandidate, skyCoSeatedMingAuxiliaryNobleWitness,
    skySupportBirthAnchorProof: ziweiBirthAnchorVerified === true ? quanshuZiweiBirthAnchorProof : undefined,
    skyOpposedDoubleLimitNamedSupportCandidate, skyOpposedDoubleLimitNamedSupportWitness,
    pairedVoidsCandidate: any([sharedPalace, splitLimits]),
    voidsBothActualLimitsGuardCandidate, voidsSeparateActualLimitsGuardCandidate,
    voidsZiweiMaoYouSplitTrineCandidate, voidsZiweiMaoYouSplitTrineWitness,
    voidPairRelation, voidAspectLimitsCandidate: any(voidAspectPaths.map(row => row.candidate)),
    voidAspectWitnesses: voidAspectPaths.filter(row => row.candidate),
    voidMingFixedFourShaCandidate: any(voidMingFixedFourSha.map(row => row.candidate)),
    voidMingFixedFourShaWitnesses: voidMingFixedFourSha.filter(row => row.candidate === true),
    jielanFireBellProfile, voidJielanFourShaCandidate: any(voidJielanFourSha.map(row => row.candidate)),
    voidJielanFourShaWitnesses: voidJielanFourSha.filter(row => row.candidate === true),
    robberyShaCandidate: all([robberyVerifiedLimit, any(annualShaPositions.map(row => inArea(row.relation)))]),
    taiSuiNamedSha, robberyTaiSuiShaCandidate: all([taiSuiAtRobberyLimit, any(natalYangTuo.map(guardsTaiSui))]),
    taiSuiFireBellEnvoy, robberyTaiSuiFireBellEnvoyCandidate: all([taiSuiAtRobberyLimit, any(fireBellEnvoy.map(guardsTaiSui))]),
    robberyTaiSuiSkyCandidate: all([taiSuiAtRobberyLimit, sameBranch(skyBranch, annualBranch)]),
    quanshuFixedFireBellProfile, taiSuiQuanshuFixedFireBell,
    robberyTaiSuiQuanshuFixedFireBellCandidate: all([taiSuiAtRobberyLimit, taiSuiQuanshuFixedFireBell.length > 0]),
    robberyMingTaiSuiFixedFireBellDoubleGuardCandidate,
    robberyMingTaiSuiNatalShaDoubleGuardCandidate, robberyMingTaiSuiNatalShaDoubleGuardWitness,
    robberyAnnualOfficialCandidate: all([robberyVerifiedLimit, inArea(annualOfficial.relation)]),
    robberyFourFlyingOfficialDoubleGuardCandidate,
    robberyBoshiOfficialCandidate: all([robberyVerifiedLimit, inArea(boshiOfficial.relation)]),
    mingBoshiOfficialProfile: quanshuKongJieLimitPolicy.mingBoshiOfficial,
    robberyMingBoshiOfficialGuardCandidate, robberyMingBoshiOfficialScopes,
    skySupportCandidate, skyPartnerSupportCandidate: any(partnerSkySupport.map(row => row.candidate)),
    skyPartnerSupportWitnesses: partnerSkySupport.filter(row => row.candidate),
    lucunSupport, skyLuSupportCandidate, skyPartnerLuSupportCandidate: any(partnerSkyLuSupport.map(row => row.candidate)),
    skyPartnerLuSupportWitnesses: partnerSkyLuSupport.filter(row => row.candidate),
  } as const;
}
