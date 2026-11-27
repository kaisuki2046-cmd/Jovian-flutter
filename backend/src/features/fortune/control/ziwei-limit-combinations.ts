import { quanshuZiweiBirthAnchor } from './ziwei-birth-major-anchor';
import { readQuanshuBodyNatal } from './ziwei-body-limits';
import { quanshuFireBellCondition } from './ziwei-firebell';
import { quanshuFireBellAnchors, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import { quanshuDecadalVerification, quanshuLifeBureau, quanshuLimitPlacementProof } from './ziwei-growth-stages';
import { quanshuBrightness, quanshuMinorLimit, quanshuPalaceRelation, quanshuTransformations, quanshuVerifiedMajorPositions, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuAuxiliaryPositions } from './ziwei-source-support';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Frame = { lunarYear: number; yearIndex: number; decadalIndex?: number; minorIndex?: number };
type Condition = boolean | undefined;
type Relation = ReturnType<typeof quanshuPalaceRelation> | undefined;
const branches = '子丑寅卯辰巳午未申酉戌亥';
const stems = '甲乙丙丁戊己庚辛壬癸';
const namedMajors = ['贪狼', '破军', '巨门', '廉贞'];
const branchOfYear = (year: number) => branches[((year - 4) % 12 + 12) % 12];
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;

export const quanshuLimitCombinationPolicy = {
  profile: 'quanshu-limit-combinations-v1',
  yangTuo: 'named-natal-co-seat-with-at-least-one-active-limit-seated',
  fireBell: 'verified-product-archive-one-companion-at-a-time',
  tuoHelpers: 'natal-tuo-trine-to-life-or-body-with-a-verified-helper-pair-and-limit-guard',
  yangQuan: 'natal-yang-and-qisha-with-a-verified-natal-or-year-quan-recipient-at-one-limit',
  mingXingQiuSha: 'quanshu-nanyangtang-blade-prison-kill-v1',
  tanHao: 'tanlang-and-pojun-at-separate-trine-seats-with-year-and-limit-guards',
  fourMajors: 'same-named-star-seated-in-one-limit-visible-to-both-and-to-body-or-life',
  splitMajors: 'distinct-named-majors-guarding-or-opposing-their-own-limit-with-separate-life-and-body-contacts',
  scope: 'one-candidate-and-half-open-natal-lunar-year-limit-intersection',
} as const;

export function quanshuLimitCombinations(natal: Natal, frame: Frame) {
  const basis = readQuanshuNatal(natal);
  if (basis.status !== 'ready' || !Number.isInteger(frame.lunarYear) || frame.lunarYear < Math.max(basis.birthYear, 1) || frame.lunarYear > 9998
    || natal.rawDates.chineseDate.yearly[1] !== branchOfYear(basis.birthYear)) return { ready: false } as const;
  const annual = natal.palaces.find(row => row.index === frame.yearIndex);
  const decade = natal.palaces.find(row => row.index === frame.decadalIndex);
  const minor = natal.palaces.find(row => row.index === frame.minorIndex);
  if (!annual || annual.earthlyBranch !== branchOfYear(frame.lunarYear)
    || (frame.decadalIndex !== undefined && !decade) || (frame.minorIndex !== undefined && !minor)) return { ready: false } as const;
  const { earthlyBranch: annualBranch } = annual;
  const { verifiedLifeBureau } = quanshuLifeBureau(natal, basis);
  const sourceDecadal = quanshuDecadalVerification(natal, basis, decade, frame.lunarYear, verifiedLifeBureau);
  const sourceMinor = quanshuMinorLimit(natal.rawDates.chineseDate.yearly[1], natal.gender, frame.lunarYear - basis.birthYear + 1);
  const sourceMinorVerified = minor !== undefined && minor.earthlyBranch === sourceMinor?.branch;
  const decadalBranch = sourceDecadal?.verified === true ? sourceDecadal.branch : undefined;
  const minorBranch = sourceMinorVerified ? sourceMinor?.branch : undefined;
  const body = readQuanshuBodyNatal(natal);
  const bodyBranch = body.ready ? body.bodyBranch : undefined;
  const relation = (focus?: string, target?: string): Relation => focus && target ? quanshuPalaceRelation(focus, target) : undefined;
  const atSeat = (contact: Relation) => contact === undefined ? undefined : contact === '守';
  const sees = (contact: Relation) => contact === undefined ? undefined : contact !== '其他';
  const aspect = (contact: Relation) => contact === undefined ? undefined : contact === '冲' || contact === '三合';
  const limitRelations = (branch?: string) => ({
    decadalRelation: relation(decadalBranch, branch), minorRelation: relation(minorBranch, branch),
  } as const);
  const limitGuard = (branch?: string) => {
    const limits = limitRelations(branch);
    return any([atSeat(limits.decadalRelation), atSeat(limits.minorRelation)]);
  };
  const archive = new Map<string, { branch: string; layer: 'majorStars' | 'minorStars' | 'adjectiveStars' } | undefined>();
  for (const palace of natal.palaces) for (const layer of ['majorStars', 'minorStars', 'adjectiveStars'] as const) {
    for (const { name } of palace[layer]) archive.set(name, archive.has(name) ? undefined : { branch: palace.earthlyBranch, layer });
  }
  const archiveMajor = (star: string) => {
    const row = archive.get(star);
    return row?.layer === 'majorStars' ? row.branch : undefined;
  };
  const verifiedMajors = quanshuVerifiedMajorPositions(archiveMajor);
  const position = (star: string) => verifiedMajors.get(star);
  const expectedZiwei = quanshuZiweiBirthAnchor(natal, verifiedLifeBureau);
  const birthAnchored = expectedZiwei !== undefined && expectedZiwei === position('紫微') ? true : undefined;
  const fireBell = quanshuFireBellCondition(natal, annual.index, annual.index, frame.lunarYear, 'yearly');
  const starPairs = [
    { primary: '陀罗', companion: '太阳' }, { primary: '陀罗', companion: '太阴' },
    { primary: '擎羊', companion: '贪狼' }, { primary: '陀罗', companion: '贪狼' },
    { primary: '擎羊', companion: '巨门' },
    ...['擎羊', '陀罗'].flatMap(primary => ['火星', '铃星'].map(companion => ({ primary, companion }))),
  ].map(pair => {
    const primaryBranch = pair.primary === '擎羊' ? basis.qingyangBranch : basis.tuoluoBranch;
    const archiveFireBell = ['火星', '铃星'].includes(pair.companion);
    const companionBranch = archiveFireBell
      ? fireBell.ready ? fireBell.archivedFireBell.find(row => row.star === pair.companion)?.branch : undefined
      : position(pair.companion);
    const sameSeat = companionBranch === undefined ? undefined : primaryBranch === companionBranch;
    const limits = limitRelations(primaryBranch);
    return { ...pair, primaryBranch, companionBranch, sameSeat, archiveFireBell, ...limits,
      candidate: all([sameSeat, any([atSeat(limits.decadalRelation), atSeat(limits.minorRelation)])]) };
  });
  const verifiedDoubleGuardPair = (primary: string, companion: string) => {
    const pair = starPairs.find(row => row.primary === primary && row.companion === companion);
    const archived = archive.get(primary);
    const verifiedPrimary = archived?.layer === 'minorStars' && archived.branch === pair?.primaryBranch ? true : undefined;
    const candidate = all([birthAnchored, verifiedPrimary, pair?.sameSeat, atSeat(pair?.decadalRelation), atSeat(pair?.minorRelation)]);
    return { candidate, witness: candidate === true ? pair : undefined };
  };
  const mingBladeDark = verifiedDoubleGuardPair('擎羊', '巨门');
  const mingTuoTanlang = verifiedDoubleGuardPair('陀罗', '贪狼');
  const mingBladePeach = verifiedDoubleGuardPair('擎羊', '贪狼');
  const majorContacts = namedMajors.map(star => {
    const branch = position(star);
    const limits = limitRelations(branch);
    const lifeRelation = relation(basis.lifeBranch, branch), bodyRelation = relation(bodyBranch, branch);
    return { star, branch, grade: branch ? quanshuBrightness(star, branch) : undefined, lifeRelation, bodyRelation, ...limits,
      candidate: body.ready ? all([any([atSeat(limits.decadalRelation), atSeat(limits.minorRelation)]),
        sees(limits.decadalRelation), sees(limits.minorRelation), any([sees(lifeRelation), sees(bodyRelation)])]) : undefined } as const;
  });
  const fallenDoubleGuard = (row: typeof majorContacts[number]) => all([
    birthAnchored, row.candidate, row.grade === undefined ? undefined : row.grade === '陷',
    atSeat(row.decadalRelation), atSeat(row.minorRelation), aspect(row.lifeRelation), aspect(row.bodyRelation),
    bodyBranch === undefined ? undefined : bodyBranch !== basis.lifeBranch,
  ]);
  const jumen = majorContacts.find(row => row.star === '巨门')!;
  const fallenJumenDoubleGuardCandidate = fallenDoubleGuard(jumen);
  const tanPoLian = majorContacts.filter(row => row.star !== '巨门').map(row => ({ row, candidate: fallenDoubleGuard(row) }));
  const fallenTanPoLianDoubleGuardCandidate = any(tanPoLian.map(row => row.candidate));
  const fallenTanPoLianDoubleGuardWitnesses = tanPoLian.filter(row => row.candidate === true).map(row => row.row);

  const { qingyangBranch, tuoluoBranch } = basis;
  const mingFixedFireBell = quanshuFireBellAnchors(natal.rawDates.chineseDate.yearly[1]).engineNamedAnchors;
  const mingFixedBladeFireBellPairs = [{ primary: '擎羊', primaryBranch: qingyangBranch }, { primary: '陀罗', primaryBranch: tuoluoBranch }]
    .flatMap(({ primary, primaryBranch }) => mingFixedFireBell.map(({ star: companion, branch: companionBranch }) => {
      const sameSeat = primaryBranch === companionBranch;
      return { primary, primaryBranch, companion, companionBranch, sameSeat, ...limitRelations(primaryBranch),
        candidate: all([sameSeat, limitGuard(primaryBranch)]) };
    }));
  const mingFixedDoubleGuards = mingFixedBladeFireBellPairs.map(pair => {
    const blade = archive.get(pair.primary);
    const verifiedBlade = blade?.layer === 'minorStars' && blade.branch === pair.primaryBranch ? true : undefined;
    const confirmed = all([pair.sameSeat, verifiedBlade, atSeat(pair.decadalRelation), atSeat(pair.minorRelation)]);
    return { pair, confirmed };
  });
  const tuoLife = relation(tuoluoBranch, basis.lifeBranch), tuoBody = relation(tuoluoBranch, bodyBranch);
  const trine = (contact: Relation) => contact === undefined ? undefined : contact === '三合';
  const opposed = (contact: Relation) => contact === undefined ? undefined : contact === '冲';
  const auxiliary = quanshuAuxiliaryPositions(basis.birthMonth, basis.birthHour, basis.birthStem);
  const auxiliaryGroups = [['文昌', '文曲'], ['左辅', '右弼']].map(pair => {
    const stars = pair.map(star => {
      const archived = archive.get(star);
      const expected = auxiliary.named.find(row => row.star === star)?.branch;
      const branch = archived?.layer === 'minorStars' && archived.branch === expected ? archived.branch : undefined;
      return { star, branch, relation: relation(tuoluoBranch, branch) } as const;
    });
    return { stars, candidate: all([limitGuard(tuoluoBranch), any([trine(tuoLife), trine(tuoBody)]),
      ...stars.map(row => sees(row.relation))]) };
  });

  const annualStem = stems[((frame.lunarYear - 4) % 10 + 10) % 10];
  const qishaBranch = position('七杀');
  const mingXingQiuShaCandidate = all([limitGuard(qingyangBranch), atSeat(relation(qingyangBranch, qishaBranch)),
    atSeat(relation(qingyangBranch, position('廉贞')))]);
  const mingXingQiuShaWitness = mingXingQiuShaCandidate === true ? {
    branch: qingyangBranch,
    guardScopes: [...(decadalBranch === qingyangBranch ? ['decadal'] : []), ...(minorBranch === qingyangBranch ? ['minor'] : [])],
  } : undefined;
  const quanShaGroups = [{ layer: 'natal', stem: basis.birthStem }, { layer: 'yearly', stem: annualStem }].map(({ layer, stem }) => {
    const star = quanshuTransformations(stem).find(row => row.kind === '权')!.star;
    const branch = position(star);
    return { layer, stem, star, branch, candidate: all([limitGuard(qingyangBranch), atSeat(relation(qingyangBranch, qishaBranch)),
      atSeat(relation(qingyangBranch, branch))]) };
  });

  const tanlang = position('贪狼'), pojun = position('破军');
  const tanHaoGroups = [{ annualStar: '贪狼', yearSeat: tanlang, limitStar: '破军', limitSeat: pojun },
    { annualStar: '破军', yearSeat: pojun, limitStar: '贪狼', limitSeat: tanlang }].map(row => ({ ...row,
    ...limitRelations(row.limitSeat), candidate: all([atSeat(relation(annualBranch, row.yearSeat)),
      trine(relation(row.yearSeat, row.limitSeat)), limitGuard(row.limitSeat)]) }));

  const distinctBody = bodyBranch === undefined ? undefined : bodyBranch !== basis.lifeBranch;
  const splitMajorPairs = majorContacts.flatMap(decadal => majorContacts.filter(minor => minor.star !== decadal.star).map(minor => {
    const contact = relation(decadal.branch, minor.branch);
    const bothGuard = all([atSeat(decadal.decadalRelation), atSeat(minor.minorRelation)]);
    const bothOppose = all([opposed(decadal.decadalRelation), opposed(minor.minorRelation)]);
    return { decadal, minor, contact, bothGuard, bothOppose, candidate: all([distinctBody, any([bothGuard, bothOppose]),
      any([trine(contact), opposed(contact)]),
      any([all([sees(decadal.lifeRelation), sees(minor.bodyRelation)]), all([sees(decadal.bodyRelation), sees(minor.lifeRelation)])])]) };
  }));
  return { ready: true, profile: quanshuLimitCombinationPolicy.profile, lunarYear: frame.lunarYear, annualBranch,
    quanshuFixedFireBellProfile, mingFixedBladeFireBellPairs: mingFixedBladeFireBellPairs.filter(row => row.candidate === true),
    mingFixedBladeFireBellCandidate: any(mingFixedBladeFireBellPairs.map(row => row.candidate)),
    mingFixedBladeFireBellDoubleGuardCandidate: any(mingFixedDoubleGuards.map(row => row.confirmed)),
    mingFixedBladeFireBellDoubleGuardWitnesses: mingFixedDoubleGuards.filter(row => row.confirmed === true).map(row => row.pair),
    decadalBranch, minorBranch, sourceDecadal, sourceMinorVerified, limitPlacementProof: quanshuLimitPlacementProof,
    lifeBranch: basis.lifeBranch, bodyBranch, starPairs, majorContacts,
    mingBladeDarkDoubleGuardCandidate: mingBladeDark.candidate, mingBladeDarkDoubleGuardWitness: mingBladeDark.witness,
    mingTuoTanlangDoubleGuardCandidate: mingTuoTanlang.candidate, mingTuoTanlangDoubleGuardWitness: mingTuoTanlang.witness,
    mingBladePeachDoubleGuardCandidate: mingBladePeach.candidate, mingBladePeachDoubleGuardWitness: mingBladePeach.witness,
    fallenJumenDoubleGuardCandidate, fallenJumenDoubleGuardWitness: fallenJumenDoubleGuardCandidate === true ? jumen : undefined,
    fallenTanPoLianDoubleGuardCandidate, fallenTanPoLianDoubleGuardWitnesses,
    tuoluoBranch, tuoLife, tuoBody, auxiliaryGroups: auxiliaryGroups.filter(row => row.candidate === true),
    qingyangBranch, quanShaGroups: quanShaGroups.filter(row => row.candidate === true),
    mingXingQiuShaProfile: quanshuLimitCombinationPolicy.mingXingQiuSha, mingXingQiuShaCandidate, mingXingQiuShaWitness,
    tanHaoGroups: tanHaoGroups.filter(row => row.candidate === true), splitMajorPairs: splitMajorPairs.filter(row => row.candidate === true),
    yangTuoCandidate: any(starPairs.map(row => row.candidate)),
    tuoHelperPairCandidate: any(auxiliaryGroups.map(row => row.candidate)),
    yangQuanShaCandidate: any(quanShaGroups.map(row => row.candidate)),
    tanHaoAnnualCandidate: any(tanHaoGroups.map(row => row.candidate)),
    fourMajorsCandidate: any(majorContacts.map(row => row.candidate)),
    splitMajorPairCandidate: any(splitMajorPairs.map(row => row.candidate)) } as const;
}
