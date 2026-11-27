import { quanshuBodyLifePositions } from './ziwei-body-limits';
import { quanshuZiweiBirthAnchor } from './ziwei-birth-major-anchor';
import { quanshuHorseBranch } from './ziwei-firebell';
import { quanshuFixedFireBellProfile, readQuanshuArchivedFireBell } from './ziwei-firebell-positions';
import { quanshuDecadalVerification, quanshuGrowthAtBranch, quanshuLifeBureau, quanshuLimitPlacementProof } from './ziwei-growth-stages';
import { quanshuKongJiePositions } from './ziwei-kongjie';
import { quanshuBrightness, quanshuMajorStarNames, quanshuMinorLimit, quanshuPalaceRelation,
  quanshuVerifiedMajorPositions, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuAuxiliaryPositions } from './ziwei-source-support';
import { quanshuShangShiPalaces } from './ziwei-source-year';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Frame = { lunarYear: number; yearIndex: number; decadalIndex?: number; minorIndex?: number };
type Condition = boolean | undefined;
const branches = '子丑寅卯辰巳午未申酉戌亥';
const visible = ['守', '冲', '三合'];
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const yearBranch = (year: number) => branches[((year - 4) % 12 + 12) % 12];

export const quanshuMajorPlacementProof = 'quanshu-nanyangtang-major-layer-v1';

export const quanshuLimitBranchesPolicy = {
  profile: 'quanshu-limit-branches-v1',
  year: 'same-candidate-native-lunar-year-and-actual-decadal-minor-intersection',
  relief: 'named-pairs-or-individual-guards-in-decadal-limit-with-separate-opposed-seat-witnesses',
  crossGroupRelief: 'different-named-helper-groups-each-aspect-the-actual-decadal-seat-during-tai-sui-opposition',
  adverse: 'named-pairs-or-individual-guards-in-the-actual-opposed-seat',
  annualAdverse: 'named-star-seated-with-tai-sui-when-it-actually-opposes-a-limit',
  annualTrine: 'listed-volume-two-adverse-star-trines-tai-sui-during-an-actual-limit-opposition',
  annualQisha: 'tai-sui-opposes-the-verified-native-qisha-seat-and-the-limit-that-occupies-it',
  annualOpposition: 'quanshu-nanyangtang-verified-limit-opposition-v1',
  chenXuLife: 'shared-xin-ren-years-natal-wenchang-wenqu-guard-life-and-distinct-verified-chen-and-xu-limits',
  temple: 'verified-temple-star-at-the-other-limit-or-reached-by-both-limits-with-guard-or-distinct-aspects',
  qishaTianfu: 'unique-native-seven-kill-guarding-a-real-limit-with-actual-opposed-tianfu-and-separate-partner-limit',
  qishaAdverse: 'unique-native-seven-kill-and-a-verified-yang-tuo-or-archive-fire-bell-guard-the-same-active-limit',
} as const;

function contact(focus?: string, target?: string) {
  if (!focus || !target) return undefined;
  const relation = quanshuPalaceRelation(focus, target);
  const distance = Math.abs(branches.indexOf(focus) - branches.indexOf(target));
  return relation === '其他' && (distance === 1 || distance === 11) ? '邻宫' : relation;
}
const inArea = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : visible.includes(relation);
const seated = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : relation === '守';
const inAspect = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : ['冲', '三合'].includes(relation);

export function quanshuLimitBranches(natal: Natal, frame: Frame) {
  const basis = readQuanshuNatal(natal);
  const annual = natal.palaces.find(row => row.index === frame.yearIndex);
  const decadal = natal.palaces.find(row => row.index === frame.decadalIndex);
  const minor = natal.palaces.find(row => row.index === frame.minorIndex);
  if (basis.status !== 'ready' || !Number.isInteger(frame.lunarYear) || frame.lunarYear < Math.max(1, basis.birthYear) || frame.lunarYear > 9998
    || natal.rawDates.chineseDate.yearly[1] !== yearBranch(basis.birthYear) || !annual || annual.earthlyBranch !== yearBranch(frame.lunarYear)
    || (frame.decadalIndex !== undefined && !decadal) || (frame.minorIndex !== undefined && !minor)) return { ready: false } as const;
  const annualBranch = annual.earthlyBranch;
  const decadalBranch = decadal?.earthlyBranch, minorBranch = minor?.earthlyBranch;
  const nominalAge = frame.lunarYear - basis.birthYear + 1;
  const { verifiedLifeBureau } = quanshuLifeBureau(natal, basis);
  const sourceDecadal = quanshuDecadalVerification(natal, basis, decadal, frame.lunarYear, verifiedLifeBureau);
  const verifiedDecadalBranch = sourceDecadal?.verified === true ? sourceDecadal.branch : undefined;
  const sourceMinorLimit = quanshuMinorLimit(natal.rawDates.chineseDate.yearly[1], natal.gender, nominalAge);
  const sourceMinor = sourceMinorLimit && { ...sourceMinorLimit, verified: minor ? sourceMinorLimit.branch === minorBranch : undefined };
  const verifiedMinorBranch = sourceMinor?.verified === true ? sourceMinor.branch : undefined;
  const expectedBody = quanshuBodyLifePositions(basis.birthMonth, basis.birthHour).bodyBranch;
  const bodySeats = natal.palaces.filter(row => row.isBodyPalace === true);
  const bodyBranch = bodySeats.length === 1 && bodySeats[0].earthlyBranch === expectedBody
    && natal.earthlyBranchOfBodyPalace === expectedBody ? expectedBody : undefined;
  const limitRelations = (branch?: string) => ({ decadalRelation: contact(verifiedDecadalBranch, branch),
    minorRelation: contact(verifiedMinorBranch, branch) } as const);
  const yearContacts = { decadalRelation: contact(decadalBranch, annualBranch), minorRelation: contact(minorBranch, annualBranch) } as const;
  const opposed = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : relation === '冲';
  const verifiedYearContacts = limitRelations(annualBranch);
  const decadalOpposed = opposed(verifiedYearContacts.decadalRelation), verifiedMinorOpposed = opposed(verifiedYearContacts.minorRelation);
  const anyVerifiedOpposed = any([decadalOpposed, verifiedMinorOpposed]);

  const auxiliary = quanshuAuxiliaryPositions(basis.birthMonth, basis.birthHour, basis.birthStem);
  const archiveBranch = (name: string) => {
    const positions = natal.palaces.flatMap(palace => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars]
      .filter(star => star.name === name).map(() => palace.earthlyBranch));
    return positions.length === 1 ? positions[0] : undefined;
  };
  const archivedAuxiliaryBranch = (name: string) => {
    const branch = archiveBranch(name);
    return natal.palaces.find(row => row.earthlyBranch === branch)?.minorStars.some(row => row.name === name) ? branch : undefined;
  };
  const verifiedAuxiliary = auxiliary.named.map(({ star, branch }) => ({ star,
    branch: archivedAuxiliaryBranch(star) === branch ? branch : undefined }));
  const verifiedNatalYangTuo = [{ star: '擎羊', branch: basis.qingyangBranch }, { star: '陀罗', branch: basis.tuoluoBranch }]
    .map(({ star, branch }) => ({ star, branch: archivedAuxiliaryBranch(star) === branch ? branch : undefined }));
  const sourceHorse = quanshuHorseBranch(natal.rawDates.chineseDate.yearly[1]);
  const natalHorseBranch = archiveBranch('天马') === sourceHorse ? sourceHorse : undefined;
  const archivedNobles = ['天魁', '天钺'].map(archivedAuxiliaryBranch);
  const verifiedNobles = auxiliary.noblePair.map(branch => ({ star: '魁钺组',
    branch: archivedNobles.filter(candidate => candidate === branch).length === 1 ? branch : undefined }));
  const verifiedBellNatalAid = [
    { star: '禄存', branch: archivedAuxiliaryBranch('禄存') === basis.lucunBranch ? basis.lucunBranch : undefined },
    { star: '天马', branch: archivedAuxiliaryBranch('天马') === sourceHorse ? sourceHorse : undefined },
    ...verifiedNobles,
  ];
  const archivedMajors = quanshuMajorStarNames.map(star => {
    const branch = archiveBranch(star);
    const majorLayerVerified = natal.palaces.find(row => row.earthlyBranch === branch)?.majorStars.some(row => row.name === star);
    return { star, branch, majorLayerVerified };
  });
  const principalPositions = [...archivedMajors, ...verifiedAuxiliary];
  const verifiedMajors = quanshuVerifiedMajorPositions(star => {
    const position = archivedMajors.find(row => row.star === star);
    return position?.majorLayerVerified === true ? position.branch : undefined;
  });
  const expectedZiwei = quanshuZiweiBirthAnchor(natal, verifiedLifeBureau), archivedZiwei = verifiedMajors.get('紫微');
  const ziweiBirthAnchorVerified = expectedZiwei === undefined || archivedZiwei === undefined ? undefined : expectedZiwei === archivedZiwei;
  const anchoredMajor = (star: string) => ziweiBirthAnchorVerified === true ? verifiedMajors.get(star) : undefined;
  const birthAnchoredMajorBranches = Object.fromEntries(quanshuMajorStarNames.map(star => [star, anchoredMajor(star)]));
  const xiangBranch = principalPositions.find(row => row.star === '天相')?.branch;
  const xiangGrowth = xiangBranch && verifiedLifeBureau ? quanshuGrowthAtBranch(verifiedLifeBureau, natal.gender, xiangBranch) : undefined;
  const locateAuxiliary = (star: string) => ({ star, branch: verifiedAuxiliary.find(row => row.star === star)?.branch });
  const relief = [
    { name: '紫微天府', stars: ['紫微', '天府'].map(star => ({ star, branch: anchoredMajor(star) })) },
    { name: '文昌文曲', stars: ['文昌', '文曲'].map(locateAuxiliary) },
    { name: '左辅右弼', stars: ['左辅', '右弼'].map(locateAuxiliary) },
    { name: '魁钺无序组', stars: auxiliary.noblePair.map(branch => ({ star: '魁钺组', branch })) },
  ].map(group => {
    const stars = group.stars.map(row => ({ ...row, ...limitRelations(row.branch) }));
    return { ...group, stars, decadalPair: all(stars.map(row => inArea(row.decadalRelation))) };
  });
  const decadalReliefAspects = relief.map(({ name, stars }) => ({ name,
    stars: stars.filter(row => inAspect(row.decadalRelation) === true),
    present: any(stars.map(row => inAspect(row.decadalRelation))) }));
  const crossGroupRelief = any(decadalReliefAspects.flatMap((first, index) =>
    decadalReliefAspects.slice(index + 1).map(second => all([first.present, second.present]))));
  const fireBell = readQuanshuArchivedFireBell(natal, natal.rawDates.chineseDate.yearly[1], natal.rawDates.chineseDate.hourly[1]);
  const voids = quanshuKongJiePositions(natal);
  const skyBranch = voids.ready ? voids.skyBranch : 'verifiedSkyBranch' in voids ? voids.verifiedSkyBranch : undefined;
  const robberyBranch = voids.ready ? voids.robberyBranch : 'verifiedRobberyBranch' in voids ? voids.verifiedRobberyBranch : undefined;
  const shangShi = quanshuShangShiPalaces(basis.lifeIndex).map(({ star, name, index }) => {
    const palace = natal.palaces.find(row => row.index === index);
    const branch = palace?.name === name && archiveBranch(star) === palace.earthlyBranch ? palace.earthlyBranch : undefined;
    const verifiedBranch = palace?.adjectiveStars.some(row => row.name === star) ? branch : undefined;
    return { star, branch, verifiedBranch };
  });
  const verifiedShangShi = shangShi.map(({ star, verifiedBranch }) => ({ star, branch: verifiedBranch }));
  const shangShiPairKnown = shangShi.every(row => row.branch !== undefined);
  const locateAdverseGroup = ({ name, stars: positions }: { name: string; stars: ReadonlyArray<{ star: string; branch?: string }> }) => {
    const stars = positions.map(row => ({ ...row, ...limitRelations(row.branch) }));
    return { name, stars, decadalPair: all([decadalOpposed, ...stars.map(row => inArea(row.decadalRelation))]),
      minorPair: verifiedMinorBranch === undefined ? undefined
        : all([verifiedMinorOpposed, ...stars.map(row => inArea(row.minorRelation))]) };
  };
  const adverse = [
    { name: '羊陀', stars: [{ star: '擎羊', branch: basis.qingyangBranch }, { star: '陀罗', branch: basis.tuoluoBranch }] },
    { name: '归档火铃', stars: fireBell.verifiedArchivedFireBell },
    { name: '古空劫', stars: [{ star: '古天空', branch: skyBranch }, { star: '地劫', branch: robberyBranch }] },
    { name: '伤使', stars: shangShi.map(({ star, branch }) => ({ star, branch: shangShiPairKnown ? branch : undefined })) },
  ].map(locateAdverseGroup);
  const annualOppositionAdverse = adverse.map(group => {
    if (group.name === '羊陀') return locateAdverseGroup({ name: group.name, stars: verifiedNatalYangTuo });
    if (group.name === '伤使') return locateAdverseGroup({ name: group.name, stars: verifiedShangShi });
    return group;
  });

  const helperPositions = relief.flatMap(group => group.stars);
  const adversePositions = (groups: typeof adverse) => groups.flatMap(group => group.stars.map(row => ({
    ...row, star: group.name === '归档火铃' ? '归档' + row.star : row.star,
  })));
  const oppositionAdversePositions = adversePositions(annualOppositionAdverse);
  const annualAdverseGuards = oppositionAdversePositions.filter(row => row.branch === annualBranch).map(row => row.star);
  const annualAdverseGuard = any(oppositionAdversePositions.map(row => row.branch === undefined ? undefined : row.branch === annualBranch));
  const annualAdverseContacts = oppositionAdversePositions.map(({ star, branch }) => ({ star, branch, relation: contact(annualBranch, branch) }));
  const annualTrineAdverse = any(annualAdverseContacts.map(row => row.relation === undefined ? undefined : row.relation === '三合'));
  const annualMingFixedSha = fireBell.quanshuFixedFireBell.map(({ star, branch }) => ({
    star, branch, annualRelation: contact(annualBranch, branch), ...limitRelations(branch),
  }));
  const annualMingFixedOppositionShaCandidate = any([
    all([decadalOpposed, any(annualMingFixedSha.map(row => seated(row.decadalRelation)))]),
    all([verifiedMinorOpposed, any(annualMingFixedSha.map(row => seated(row.minorRelation)))]),
    all([anyVerifiedOpposed, any(annualMingFixedSha.map(row => row.annualRelation === '守' || row.annualRelation === '三合'))]),
  ]);
  const seatEvidence = ([
    { scope: 'decadal', branch: verifiedDecadalBranch, opposed: decadalOpposed, field: 'decadalRelation' },
    { scope: 'minor', branch: verifiedMinorBranch, opposed: verifiedMinorOpposed, field: 'minorRelation' },
  ] as const).map(({ scope, branch, opposed, field }) => {
    const relation = (row: ReturnType<typeof limitRelations>) => branch === undefined ? undefined : row[field];
    const helperRelations = helperPositions.map(relation);
    const adverseRelations = oppositionAdversePositions.map(relation);
    return {
      scope, branch, opposed,
      helperGuards: helperPositions.filter(row => relation(row) === '守').map(row => row.star),
      adverseGuards: oppositionAdversePositions.filter(row => relation(row) === '守').map(row => row.star),
      hasHelperGuard: any(helperRelations.map(seated)),
      hasOpposedAdverseGuard: all([opposed, any(adverseRelations.map(seated))]),
      opposedCounts: opposed === true ? {
        visibleHelpers: helperRelations.filter(inArea).length,
        unresolvedHelpers: helperRelations.filter(relation => relation === undefined).length,
        visibleAdverse: adverseRelations.filter(inArea).length,
        unresolvedAdverse: adverseRelations.filter(relation => relation === undefined).length,
      } : undefined,
    };
  });

  const atChenXu = (branch?: string) => branch === undefined ? undefined : ['辰', '戌'].includes(branch);
  const decadalAtChenXu = atChenXu(verifiedDecadalBranch), minorAtChenXu = atChenXu(verifiedMinorBranch);
  const eitherAtChenXu = any([decadalAtChenXu, minorAtChenXu]);
  const distinctLimits = verifiedDecadalBranch === undefined || verifiedMinorBranch === undefined
    ? undefined : verifiedDecadalBranch !== verifiedMinorBranch;
  const birthYearClause = ['己', '辛', '壬'].includes(basis.birthStem);
  const changQu = ['文昌', '文曲'].map(star => {
    const { branch } = locateAuxiliary(star);
    const relations = limitRelations(branch);
    const grade = branch ? quanshuBrightness(star, branch) : undefined;
    const atTemple = branch === undefined ? undefined : grade === '庙';
    const bothLimitsContact = all([inArea(relations.decadalRelation), inArea(relations.minorRelation)]);
    const atOtherLimit = (meets: typeof seated) => any([
      all([decadalAtChenXu, meets(relations.minorRelation)]),
      all([minorAtChenXu, meets(relations.decadalRelation)]),
    ]);
    return { star, branch, grade, ...relations,
      atChenXuLimit: any([all([decadalAtChenXu, inArea(relations.decadalRelation)]), all([minorAtChenXu, inArea(relations.minorRelation)])]),
      bothLimitsMeet: all([eitherAtChenXu, bothLimitsContact]),
      templeAtOtherLimit: all([atTemple, atOtherLimit(seated)]),
      templeAspectAtOtherLimit: all([atTemple, atOtherLimit(inAspect)]),
      templeBothLimitsMeet: all([atTemple, bothLimitsContact,
        any([seated(relations.decadalRelation), seated(relations.minorRelation), distinctLimits])]) };
  });
  const [chang, qu] = changQu;
  const zhouChangQuCoSeat = all([birthYearClause, seated(contact(chang.branch, qu.branch))]);
  const zhouChangQuTempleLifeDoubleGuardCandidate = all([
    zhouChangQuCoSeat,
    chang.grade === undefined ? undefined : chang.grade === '庙',
    qu.grade === undefined ? undefined : qu.grade === '庙',
    atChenXu(basis.lifeBranch),
    seated(contact(basis.lifeBranch, verifiedDecadalBranch)),
    seated(contact(basis.lifeBranch, annualBranch)),
  ]);
  const zhouTempleExceptionAbsent = zhouChangQuTempleLifeDoubleGuardCandidate === undefined
    ? undefined : !zhouChangQuTempleLifeDoubleGuardCandidate;
  const zhouChangQuChenXuDecadalCandidate = all([zhouChangQuCoSeat, decadalAtChenXu, zhouTempleExceptionAbsent]);
  const zhouChangQuChenXuAnnualCandidate = all([zhouChangQuCoSeat, atChenXu(annualBranch), zhouTempleExceptionAbsent]);
  const natalChangQuLifeWithChenXuLimits = all([decadalAtChenXu, minorAtChenXu, distinctLimits,
    seated(contact(basis.lifeBranch, chang.branch)), seated(contact(basis.lifeBranch, qu.branch))]);
  // Only Xin and Ren are common to the Ming and three-volume readings.
  const mingChenXuNatalChangQuLifeCandidate = all([['辛', '壬'].includes(basis.birthStem), natalChangQuLifeWithChenXuLimits]);
  const threeVolumeJiChenXuNatalChangQuLifeCandidate = all([basis.birthStem === '己', natalChangQuLifeWithChenXuLimits]);
  const chenXuNatalChangQuLifeWitness = natalChangQuLifeWithChenXuLimits === true ? {
    birthStem: basis.birthStem, lifeBranch: basis.lifeBranch, stars: [chang, qu].map(({ star, branch }) => ({ star, branch })),
    decadalBranch: verifiedDecadalBranch, minorBranch: verifiedMinorBranch,
  } : undefined;
  const sharedStarAtBoth = any(changQu.map(row => row.bothLimitsMeet));
  const splitStarContacts = any([
    all([inArea(chang.decadalRelation), inArea(qu.minorRelation)]),
    all([inArea(qu.decadalRelation), inArea(chang.minorRelation)]),
  ]);
  const annualQishaBranch = anchoredMajor('七杀');
  const qishaBranch = principalPositions.find(row => row.star === '七杀')?.branch;
  const tianfuBranch = principalPositions.find(row => row.star === '天府')?.branch;
  const qishaTianfuRelation = contact(qishaBranch, tianfuBranch);
  const qishaLimits = ([['decadal', decadalBranch], ['minor', minorBranch]] as const).map(([scope, branch]) => ({
    scope, branch, qishaRelation: contact(branch, qishaBranch), tianfuRelation: contact(branch, tianfuBranch),
  } as const));
  const qishaGuardsLimit = any(qishaLimits.map(row => seated(row.qishaRelation)));
  const qishaTianfuAtLimitCandidate = all([opposed(qishaTianfuRelation), qishaGuardsLimit]);
  const qishaTianfuBothLimitsCandidate = all([qishaTianfuAtLimitCandidate, ...qishaLimits.map(row => inArea(row.qishaRelation))]);
  const qishaAdverseContacts = adversePositions(adverse).filter(row => ['擎羊', '陀罗', '归档火星', '归档铃星'].includes(row.star))
    .map(({ star, branch }) => ({ star, branch, relation: contact(qishaBranch, branch) } as const));
  const qishaAdverseAtLimitCandidate = all([qishaGuardsLimit, any(qishaAdverseContacts.map(row => seated(row.relation)))]);
  const annualOpposedDecadalFullReliefCandidate = all([decadalOpposed, ...relief.map(row => row.decadalPair)]);
  const annualOpposedDecadalVerifiedFullReliefCandidate = all([annualOpposedDecadalFullReliefCandidate,
    ...verifiedNobles.map(row => inArea(limitRelations(row.branch).decadalRelation))]);
  return { ready: true, profile: quanshuLimitBranchesPolicy.profile, lunarYear: frame.lunarYear,
    annualBranch, decadalBranch, minorBranch, bodyBranch, yearContacts, relief, adverse, seatEvidence, birthStem: basis.birthStem,
    principalPositions, verifiedMajorBranches: Object.fromEntries(verifiedMajors), birthAnchoredMajorBranches, ziweiBirthAnchorVerified,
    verifiedTianliangBranch: verifiedMajors.get('天梁'),
    verifiedWuquBranch: verifiedMajors.get('武曲'), verifiedPojunBranch: verifiedMajors.get('破军'),
    verifiedLianzhenBranch: verifiedMajors.get('廉贞'),
    verifiedSunBranch: verifiedMajors.get('太阳'), verifiedTaiyinBranch: verifiedMajors.get('太阴'),
    verifiedJumenBranch: verifiedMajors.get('巨门'), starPlacementProof: quanshuMajorPlacementProof,
    xiangGrowth, natalLucunBranch: basis.lucunBranch, natalHorseBranch, verifiedNatalYangTuo, verifiedBellNatalAid, verifiedShangShi,
    jielanFireBell: fireBell.jielanFireBell,
    quanshuFixedFireBell: fireBell.quanshuFixedFireBell,
    quanshuFixedFireBellProfile, annualMingFixedSha, annualMingFixedOppositionShaCandidate,
    annualOppositionProfile: quanshuLimitBranchesPolicy.annualOpposition, sourceDecadal, sourceMinor, limitPlacementProof: quanshuLimitPlacementProof,
    annualDoubleVerifiedOppositionCandidate: all([decadalOpposed, verifiedMinorOpposed]),
    decadalAtChenXu, minorAtChenXu, changQu,
    annualReliefCandidate: all([anyVerifiedOpposed, any(relief.map(row => row.decadalPair))]),
    annualOpposedDecadalFullReliefCandidate, annualOpposedDecadalVerifiedFullReliefCandidate,
    annualCrossGroupReliefCandidate: all([anyVerifiedOpposed, crossGroupRelief]),
    annualCrossGroupReliefWitnesses: decadalReliefAspects.filter(row => row.present === true),
    annualOppositionAdverse, annualAdverseCandidate: any(annualOppositionAdverse.flatMap(row => [row.decadalPair, row.minorPair])),
    annualSeatedReliefCandidate: all([anyVerifiedOpposed, seatEvidence[0].hasHelperGuard]),
    annualSeatedAdverseCandidate: any(seatEvidence.map(row => row.hasOpposedAdverseGuard)),
    annualOpposedGuardCandidate: all([anyVerifiedOpposed, annualAdverseGuard]),
    annualAdverseGuards,
    annualTrineAdverseCandidate: all([anyVerifiedOpposed, annualTrineAdverse]),
    annualTrineAdverseWitnesses: annualAdverseContacts.filter(row => row.relation === '三合'),
    annualOpposedQishaCandidate: all([anyVerifiedOpposed, opposed(contact(annualBranch, annualQishaBranch))]),
    annualQishaBranch,
    chenXuChangQuCandidate: all([birthYearClause, any(changQu.map(row => row.atChenXuLimit))]),
    chenXuBothLimitsCandidate: all([birthYearClause, sharedStarAtBoth]),
    chenXuSplitChangQuCandidate: all([birthYearClause, eitherAtChenXu, splitStarContacts,
      sharedStarAtBoth === undefined ? undefined : !sharedStarAtBoth]),
    chenXuTempleCandidate: all([birthYearClause, any(changQu.map(row => row.templeAtOtherLimit))]),
    chenXuTempleAspectCandidate: all([birthYearClause, any(changQu.map(row => row.templeAspectAtOtherLimit))]),
    templeChangQuBothLimitsCandidate: all([birthYearClause, any(changQu.map(row => row.templeBothLimitsMeet))]),
    zhouChangQuChenXuDecadalCandidate, zhouChangQuChenXuAnnualCandidate, zhouChangQuTempleLifeDoubleGuardCandidate,
    mingChenXuNatalChangQuLifeCandidate,
    mingChenXuNatalChangQuLifeWitness: mingChenXuNatalChangQuLifeCandidate === true ? chenXuNatalChangQuLifeWitness : undefined,
    threeVolumeJiChenXuNatalChangQuLifeCandidate,
    threeVolumeJiChenXuNatalChangQuLifeWitness: threeVolumeJiChenXuNatalChangQuLifeCandidate === true ? chenXuNatalChangQuLifeWitness : undefined,
    qishaTianfuAtLimitCandidate, qishaTianfuBothLimitsCandidate,
    qishaAdverseAtLimitCandidate, qishaAdverseGuards: qishaAdverseContacts.filter(row => row.relation === '守'),
    qishaTianfu: { qishaBranch, tianfuBranch, relation: qishaTianfuRelation, limits: qishaLimits,
      qishaGrade: qishaBranch && quanshuBrightness('七杀', qishaBranch),
      tianfuGrade: tianfuBranch && quanshuBrightness('天府', tianfuBranch) },
  } as const;
}
