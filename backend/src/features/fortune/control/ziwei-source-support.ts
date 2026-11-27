import type { DestinyChartSnapshot } from '../../destiny';
import { quanshuBirthAnchoredMajorPositions } from './ziwei-birth-major-anchor';
import { jielanDignityProfile, jielanFallenAt, quanshuBrightness, quanshuLuYangTuo, quanshuMinorLimit, readQuanshuNatal } from './ziwei-quanshu';
import { jielanFireBellProfile, quanshuFixedFireBellProfile, readQuanshuArchivedFireBell } from './ziwei-firebell-positions';
import { quanshuDecadalVerification, quanshuLifeBureau } from './ziwei-growth-stages';
import type { quanshuLimitBranches } from './ziwei-limit-branches';

type Natal = DestinyChartSnapshot['ziwei']['rawResult'][number];
const branches = '子丑寅卯辰巳午未申酉戌亥', stems = '甲乙丙丁戊己庚辛壬癸';
const mod = (value: number) => (value % 12 + 12) % 12;
const major = ['紫微', '天机', '太阳', '武曲', '天同', '廉贞', '天府', '太阴', '贪狼', '巨门', '天相', '天梁', '七杀', '破军'];
const all = (palace: Natal['palaces'][number]) => [...palace.majorStars, ...palace.minorStars, ...palace.adjectiveStars];
export const quanshuSupportPolicy = {
  profile: 'quanshu-auxiliary-limits-atomic-v1',
  auxiliary: 'hour-xu-reverse-chang-chen-forward-qu;month-chen-forward-fu-xu-reverse-bi',
  nobles: 'source-unordered-pair-bing-ding-hai-xu-not-default-hai-you',
  rabbitGlyph: 'source-mian-read-as-zodiac-rabbit-mao-explicit-reading',
  relationships: 'same-opposite-trine-adjacent-separate-no-rescue-score',
  namedLimitSupport: 'property-sun-ziwei-tianliang-wenqu-with-source-specific-companions',
  propertySunSplitLimits: 'two-limits-aspect-the-property-sun-from-separate-seats-guarded-by-fu-and-bi',
  propertySunPlacement: 'quanshu-nanyangtang-property-sun-two-source-limits-v1',
  twoLimitGuard: 'quanshu-two-source-recomputed-limit-guards-v2',
  ziweiTrinePairs: 'named-fu-xiang-fu-bi-or-chang-qu-both-trine-the-same-actual-ziwei-guarded-limit',
  wenquPairedLimits: 'one-limit-guards-verified-wenqu-and-the-other-guards-an-aspecting-tong-with-both-assistants',
  namedAuxiliaryLayer: 'quanshu-named-auxiliary-layer-v1',
  calendar: 'native-lunar-new-year-and-civil-midnight',
} as const;

export function quanshuAuxiliaryPositions(birthMonth: number, birthHour: string, birthStem: string) {
  if (!Number.isInteger(birthMonth) || birthMonth < 1 || birthMonth > 12 || birthHour.length !== 1 || !branches.includes(birthHour)
    || birthStem.length !== 1 || !stems.includes(birthStem)) throw new RangeError('Invalid source auxiliary basis');
  const hour = branches.indexOf(birthHour), month = birthMonth - 1;
  const named = [{ star: '文昌', branch: branches[mod(10 - hour)] }, { star: '文曲', branch: branches[mod(4 + hour)] },
    { star: '左辅', branch: branches[mod(4 + month)] }, { star: '右弼', branch: branches[mod(10 - month)] }];
  // This verse gives pairs, not a reliable name-to-position ordering. Its 免
  // glyph is explicitly read as zodiac 兔 (卯), rather than silently corrected.
  const noblePair = [...['丑未', '子申', '亥戌', '亥戌', '丑未', '子申', '丑未', '寅午', '卯巳', '卯巳'][stems.indexOf(birthStem)]];
  return { named, noblePair };
}

export function readQuanshuSupportNatal(natal: Natal) {
  const basis = readQuanshuNatal(natal);
  if (basis.status !== 'ready') return { ready: false, reason: basis.status } as const;
  const { birthMonth, birthHour } = basis;
  const calculated = quanshuAuxiliaryPositions(birthMonth, birthHour, basis.birthStem);
  const placements = (star: string) => natal.palaces.flatMap(p => all(p).filter(s => s.name === star).map(() => p.earthlyBranch));
  for (const row of calculated.named) {
    const actual = placements(row.star);
    if (actual.length !== 1 || actual[0] !== row.branch) return { ready: false, reason: 'inconsistent_source_auxiliary', star: row.star } as const;
  }
  const majors = major.flatMap(star => placements(star).map(branch => ({ star, branch })));
  if (major.some(star => majors.filter(row => row.star === star).length !== 1)) return { ready: false, reason: 'incomplete_major_positions' } as const;
  const archivedNobles = ['天魁', '天钺'].map(star => ({ star, branches: placements(star) }));
  const archiveKnown = archivedNobles.every(row => row.branches.length === 1);
  const nobleArchiveBranches = archiveKnown ? archivedNobles.map(row => row.branches[0]) : undefined;
  const nobleArchiveState = !nobleArchiveBranches ? 'unavailable'
    : [...nobleArchiveBranches].sort().join() === [...calculated.noblePair].sort().join() ? 'same_pair' : 'different_pair';
  const sourcePositions = [...majors, ...calculated.named, ...calculated.noblePair.map(branch => ({ star: '魁钺组', branch })),
    { star: '禄存', branch: basis.lucunBranch }, { star: '擎羊', branch: basis.qingyangBranch }, { star: '陀罗', branch: basis.tuoluoBranch }];
  return { ready: true, natalBasis: basis, birthStem: basis.birthStem, birthMonth, birthHour, sourcePositions,
    noblePair: calculated.noblePair, nobleArchiveBranches, nobleArchiveState,
    sourceAuxiliaryQualities: calculated.named.map(row => ({ ...row, grade: quanshuBrightness(row.star, row.branch) })) } as const;
}

const relation = (focus: string, target: string) => {
  const distance = mod(branches.indexOf(target) - branches.indexOf(focus));
  return distance === 0 ? '守' : distance === 6 ? '冲' : distance === 4 || distance === 8 ? '三合' : distance === 1 || distance === 11 ? '邻宫' : '其他';
};

const visible = ['守', '冲', '三合'];
const assistants = ['左辅', '右弼'];
const literaryAssistants = [...assistants, '文昌', '文曲'];
const allKnown = (checks: (boolean | undefined)[]) => checks.includes(false) ? false : checks.includes(undefined) ? undefined : true;
type Contact = { star: string; branch?: string; relation?: string };
const exactRelation = (rows: Contact[], expected: string) => rows.map(row =>
  row.relation === undefined ? undefined : row.relation === expected);
const tianliangChapterGrade = (branch?: string) => branch === undefined ? undefined
  : '子午卯辰戌丑未寅'.includes(branch) ? '庙' : branch === '酉' ? '地' : branch === '申' ? '陷' : undefined;

function mingTianliangGroups(branch: string | undefined, helpers: Contact[], namedSha?: Contact[]) {
  const grade = tianliangChapterGrade(branch);
  const clearNamedSha = namedSha?.length === 4
    ? allKnown(namedSha.map(row => row.relation === undefined ? undefined : !visible.includes(row.relation))) : undefined;
  const anchor = [grade === undefined ? undefined : grade === '庙', clearNamedSha];
  const assistantBranch = helpers[0].branch;
  const trines = allKnown(exactRelation(helpers, '三合'));
  const trine = allKnown([...anchor, trines === true ? helpers.every(row => row.branch === assistantBranch) : trines]);
  const guardOrTrine = allKnown(helpers.map(row => row.relation === undefined ? undefined : ['守', '三合'].includes(row.relation)));
  const distributed = allKnown([...anchor, guardOrTrine === true ? new Set(helpers.map(row => row.branch)).size > 1 : guardOrTrine]);
  return { clearNamedSha, clearTemple: allKnown(anchor), atSeat: allKnown([...anchor, ...exactRelation(helpers, '守')]), trine, distributed,
    trineWitness: trine === true ? { tianliangBranch: branch, assistantBranch, assistants: helpers, namedSha } : undefined,
    distributedWitness: distributed === true ? { tianliangBranch: branch, assistants: helpers, namedSha } : undefined };
}

function mingWenquGroups(branch: string | undefined, tongBranch: string | undefined, atWenqu: Contact[], atTong: Contact[]) {
  const tongRelation = branch === undefined || tongBranch === undefined ? undefined : relation(branch, tongBranch);
  const tongAt = (expected: string) => tongRelation === undefined ? undefined : tongRelation === expected;
  const trine = allKnown([tongAt('三合'), ...exactRelation(atTong, '守')]);
  const seatedTongTrineAssistants = allKnown([tongAt('守'), ...exactRelation(atTong, '三合')]);
  const atSeat = allKnown([tongAt('守'), ...exactRelation(atWenqu, '守')]);
  const togetherInTrine = allKnown([
    tongRelation === undefined ? undefined : ['守', '三合'].includes(tongRelation),
    ...atTong.map(row => row.relation === undefined ? undefined : ['守', '三合'].includes(row.relation)),
  ]);
  const distributed = togetherInTrine !== true ? togetherInTrine : ![atSeat, trine, seatedTongTrineAssistants].includes(true);
  return { atSeat, trine, seatedTongTrineAssistants, distributed,
    distributedWitness: distributed === true ? { wenquBranch: branch, tongBranch, assistants: atTong } : undefined,
    trineWitness: trine === true ? { wenquBranch: branch, tongBranch, assistants: atTong } : undefined,
    seatedTongTrineAssistantsWitness: seatedTongTrineAssistants === true
      ? { wenquBranch: branch, tongBranch, assistants: atTong } : undefined };
}

export function quanshuMingGroupsFromVerifiedLimits(limits: Extract<ReturnType<typeof quanshuLimitBranches>, { ready: true }>) {
  const liangBranch = limits.verifiedTianliangBranch, tongBranch = limits.verifiedMajorBranches['天同'];
  const auxiliary = (star: string) => limits.principalPositions.find(row => row.star === star)?.branch;
  const wenquBranch = auxiliary('文曲');
  const contacts = (focus: string | undefined, positions: { star: string; branch?: string }[]) => positions.map(({ star, branch }) => ({
    star, branch, relation: focus === undefined || branch === undefined ? undefined : relation(focus, branch),
  }));
  const at = (focus: string | undefined, names: string[]) => contacts(focus, names.map(star => ({ star, branch: auxiliary(star) })));
  // The complete-catalog gate is separate. These two source clauses use only their named, independently verified stars.
  return {
    tianliang: mingTianliangGroups(liangBranch, at(liangBranch, literaryAssistants),
      contacts(liangBranch, [...limits.verifiedNatalYangTuo, ...limits.quanshuFixedFireBell])),
    wenqu: mingWenquGroups(wenquBranch, tongBranch, at(wenquBranch, assistants), at(tongBranch, assistants)),
  };
}

function namedLimitSupport(basis: Extract<ReturnType<typeof readQuanshuSupportNatal>, { ready: true }>, natal: Natal,
  focus: Natal['palaces'][number], scope: 'decadal' | 'minor', lunarYear: number, other?: Natal['palaces'][number]) {
  const at = (name: string) => basis.sourcePositions.find(row => row.star === name)!.branch;
  const atAuxiliary = (star: string) => {
    const branch = at(star);
    return natal.palaces.find(palace => palace.earthlyBranch === branch)?.minorStars.some(row => row.name === star)
      ? branch : undefined;
  };
  const auxiliaryContacts = (focus: string | undefined, stars: string[]) => stars.map(star => {
    const branch = atAuxiliary(star);
    return { star, branch, relation: focus === undefined || branch === undefined ? undefined : relation(focus, branch) };
  });
  const confirmedVisible = (rows: { relation?: string }[]) => allKnown(rows.map(row => row.relation === undefined ? undefined : visible.includes(row.relation)));
  const someGuard = (rows: { relation?: string }[]) => rows.some(row => row.relation === '守') ? true
    : rows.some(row => row.relation === undefined) ? undefined : false;
  const birthYear = natal.rawDates.lunarDate.lunarYear, birthYearBranch = branches[mod(birthYear - 4)];
  const sourceMinor = natal.rawDates.chineseDate.yearly[1] === birthYearBranch
    ? quanshuMinorLimit(birthYearBranch, natal.gender, lunarYear - birthYear + 1) : undefined;
  const archiveMinor = scope === 'minor' ? focus : other;
  const archiveDecadal = scope === 'decadal' ? focus : other;
  const sourceMinorVerified = archiveMinor && sourceMinor ? archiveMinor.earthlyBranch === sourceMinor.branch : undefined;
  const { verifiedLifeBureau } = quanshuLifeBureau(natal, basis.natalBasis);
  const sourceDecadal = quanshuDecadalVerification(natal, basis.natalBasis, archiveDecadal, lunarYear, verifiedLifeBureau);
  const verifiedFocus = scope === 'minor' && sourceMinorVerified !== true ? undefined : focus;
  const verifiedOther = scope === 'decadal' && sourceMinorVerified !== true ? undefined : other;
  const atLimit = (branch: string) => verifiedFocus && verifiedFocus.earthlyBranch === branch;
  const doubleGuard = (branch: string) => allKnown([
    sourceDecadal?.verified === true ? sourceDecadal.branch === branch : undefined,
    sourceMinorVerified === true ? sourceMinor?.branch === branch : undefined,
  ]);
  const { positions: verifiedMajors, ziweiBirthAnchorVerified } = quanshuBirthAnchoredMajorPositions(natal, verifiedLifeBureau, star => {
    const branch = at(star);
    return natal.palaces.find(row => row.earthlyBranch === branch)?.majorStars.some(row => row.name === star) ? branch : undefined;
  });
  const majorContacts = (focus: string, stars: string[]) => stars.map(star => {
    const branch = verifiedMajors.get(star);
    return { star, branch, relation: branch === undefined ? undefined : relation(focus, branch) };
  });
  const bothAuxiliaryGuard = (branch: string) => allKnown(auxiliaryContacts(branch, assistants).map(row =>
    row.relation === undefined ? undefined : row.relation === '守'));

  const sunBranch = at('太阳');
  const sunPalace = natal.palaces.find(row => row.earthlyBranch === sunBranch)!;
  const propertySeat = sunPalace.index !== (basis.natalBasis.lifeIndex + 3) % 12 ? false
    : sunPalace.name === '田宅' ? true : undefined;
  const verifiedSun = verifiedMajors.get('太阳');
  const sunAssistants = auxiliaryContacts(verifiedSun, assistants);
  const verifiedDecadalBranch = sourceDecadal?.verified === true ? sourceDecadal.branch : undefined;
  const verifiedMinorBranch = sourceMinorVerified === true ? sourceMinor?.branch : undefined;
  const ownSunLimit = scope === 'decadal' ? verifiedDecadalBranch : verifiedMinorBranch;
  const otherSunLimit = scope === 'decadal' ? verifiedMinorBranch : verifiedDecadalBranch;
  const ownSunRelation = verifiedSun && ownSunLimit ? relation(verifiedSun, ownSunLimit) : undefined;
  const otherSunRelation = verifiedSun && otherSunLimit ? relation(verifiedSun, otherSunLimit) : undefined;
  const sunBothLimitsMeet = allKnown([propertySeat, confirmedVisible([
    ...sunAssistants, { relation: ownSunRelation }, { relation: otherSunRelation },
  ])]);
  const ownAssistant = ownSunLimit ? sunAssistants.find(row => row.branch === ownSunLimit) : undefined;
  const otherAssistant = otherSunLimit ? sunAssistants.find(row => row.branch === otherSunLimit) : undefined;
  const splitAssistants = ownAssistant && otherAssistant && ownAssistant.star !== otherAssistant.star ? [
    { scope, star: ownAssistant.star, branch: ownAssistant.branch },
    { scope: scope === 'decadal' ? 'minor' : 'decadal', star: otherAssistant.star, branch: otherAssistant.branch },
  ] : undefined;
  const sunGuarded = [ownSunRelation, otherSunRelation].includes('守');
  const splitAssistedCandidate = sunBothLimitsMeet && !sunGuarded && splitAssistants !== undefined;
  const [sunLucun] = auxiliaryContacts(verifiedSun, ['禄存']);
  const [sunMoon] = majorContacts(sunBranch, ['太阴']);
  const moonGrade = sunMoon.branch && quanshuBrightness('太阴', sunMoon.branch);
  const sunGrade = quanshuBrightness('太阳', sunBranch);
  const bright = (grade?: string) => grade === undefined ? undefined : grade === '庙' || grade === '旺';
  // The property verse gives Fu and Bi first. The question names Lucun and a bright Moon as supporting stars.
  const mingNamedSupport = allKnown([sunBothLimitsMeet, bright(sunGrade), bright(moonGrade), confirmedVisible([sunLucun, sunMoon])]);
  const mingNamedSupportCandidate = allKnown([mingNamedSupport, doubleGuard(sunBranch)]);
  const partnerTrine = ownSunRelation === undefined || otherSunRelation === undefined ? undefined
    : ownSunRelation === '守' && otherSunRelation === '三合' || ownSunRelation === '三合' && otherSunRelation === '守';
  const differentAssistantsAtLimits = sunAssistants.some(row => row.branch === undefined) ? undefined : splitAssistants !== undefined;
  const mingNamedPartnerGuardCandidate = allKnown([mingNamedSupport, partnerTrine, differentAssistantsAtLimits]);
  const propertySun = { branch: sunBranch, natalName: sunPalace.name, grade: sunGrade,
    decadalRelation: scope === 'decadal' ? ownSunRelation : otherSunRelation,
    minorRelation: scope === 'minor' ? ownSunRelation : otherSunRelation, assistants: sunAssistants,
    candidate: sunBothLimitsMeet && sunGuarded, splitAssistedCandidate,
    doubleFuBiGuard: allKnown([propertySeat, verifiedSun === undefined ? undefined : true,
      bothAuxiliaryGuard(sunBranch), doubleGuard(sunBranch)]),
    mingNamedSupportCandidate, mingNamedPartnerGuardCandidate,
    mingNamedSupportWitness: mingNamedSupportCandidate === true || mingNamedPartnerGuardCandidate === true ? { branch: sunBranch, sunGrade,
      decadalBranch: verifiedDecadalBranch, minorBranch: verifiedMinorBranch, assistants: sunAssistants,
      lucun: sunLucun, moon: { ...sunMoon, grade: moonGrade } } : undefined,
    splitAssistants: splitAssistedCandidate === true ? splitAssistants : undefined };

  const ziweiBranch = at('紫微');
  const verifiedZiwei = verifiedMajors.get('紫微');
  const ziweiLimitBranch = scope === 'decadal' ? verifiedDecadalBranch : verifiedMinorBranch;
  const ziweiAtLimit = verifiedZiwei && ziweiLimitBranch ? verifiedZiwei === ziweiLimitBranch : undefined;
  const ziweiAssistants = auxiliaryContacts(verifiedZiwei, assistants);
  const mingFuXiang = majorContacts(ziweiBranch, ['天府', '天相']);
  const ziweiCounter = majorContacts(ziweiBranch, ['七杀', '破军', '贪狼']);
  const candidateTrinePairs = [mingFuXiang, ziweiAssistants, auxiliaryContacts(verifiedZiwei, ['文昌', '文曲'])]
    .map(pair => ({ pair, trines: allKnown(exactRelation(pair, '三合')) }));
  const verifiedTrinePairs = candidateTrinePairs.filter(row => row.trines === true).map(row => row.pair);
  const trinePairCandidate = ziweiAtLimit && (verifiedTrinePairs.length > 0 ? true
    : candidateTrinePairs.some(row => row.trines === undefined) ? undefined : false);
  const knownZiwei = verifiedZiwei === ziweiBranch ? true : undefined;
  const ziweiTwoLimitsWithoutThreeSha = allKnown([knownZiwei, doubleGuard(ziweiBranch),
    ...ziweiCounter.map(row => row.relation === undefined ? undefined : !['守', '三合'].includes(row.relation)),
  ]);
  const mingFuXiangDoubleGuard = allKnown([ziweiTwoLimitsWithoutThreeSha, ...exactRelation(mingFuXiang, '三合')]);
  const [tianfu, tianxiang] = mingFuXiang;
  const ziFuSeat = '寅申'.includes(ziweiBranch);
  const ziXiangSeat = '辰戌'.includes(ziweiBranch);
  // The two editions list these stems alike. Ming 巳 and the three-volume 己 are kept outside this branch.
  const mingFuXiangSeatAndTrineDoubleGuard = allKnown([ziweiTwoLimitsWithoutThreeSha, ziFuSeat || ziXiangSeat,
    (ziFuSeat ? '甲庚丁' : '乙甲庚癸').includes(basis.birthStem),
    ...exactRelation([ziFuSeat ? tianfu : tianxiang], '守'), ...exactRelation([ziFuSeat ? tianxiang : tianfu], '三合'),
  ]);
  const ziwei = { branch: ziweiBranch, assistants: ziweiAssistants, counter: ziweiCounter,
    trinePairs: ziweiAtLimit === true ? verifiedTrinePairs : [],
    grade: quanshuBrightness('紫微', ziweiBranch), atLimit: ziweiAtLimit,
    candidate: ziweiAtLimit && allKnown([confirmedVisible(ziweiAssistants), someGuard(ziweiAssistants)]),
    trinePairCandidate,
    doubleFuBiGuard: allKnown([knownZiwei, bothAuxiliaryGuard(ziweiBranch), doubleGuard(ziweiBranch)]),
    mingFuXiangDoubleGuard,
    mingFuXiangWitness: mingFuXiangDoubleGuard === true ? { branch: ziweiBranch, trines: mingFuXiang, counter: ziweiCounter } : undefined,
    mingFuXiangSeatAndTrineDoubleGuard,
    mingFuXiangSeatAndTrineWitness: mingFuXiangSeatAndTrineDoubleGuard === true ? {
      branch: ziweiBranch, birthStem: basis.birthStem, atSeat: ziFuSeat ? tianfu : tianxiang,
      illuminating: ziFuSeat ? tianxiang : tianfu, counter: ziweiCounter,
    } : undefined,
    threeShaAtLimit: ziweiAtLimit && allKnown(ziweiCounter.map(row => row.relation === undefined ? undefined
      : ['守', '三合'].includes(row.relation))) };

  const liangBranch = at('天梁');
  const liangAtLimit = atLimit(liangBranch);
  const liangAssistants = auxiliaryContacts(liangBranch, literaryAssistants);
  const chapterGrade = tianliangChapterGrade(liangBranch);
  const verseTemple = '子午寅申'.includes(liangBranch) ? true : undefined;
  const liangYangTuo = auxiliaryContacts(liangBranch, ['擎羊', '陀罗']);
  const fireBell = liangAtLimit && readQuanshuArchivedFireBell(natal, natal.rawDates.chineseDate.yearly[1], basis.birthHour);
  const liangCounter = fireBell ? [...liangYangTuo, ...fireBell.verifiedArchivedFireBell.flatMap(({ star, branch }) =>
    branch === undefined ? [] : [{ star: '归档' + star, branch, relation: relation(liangBranch, branch) }])] : undefined;
  const quanshuFixedCounter = fireBell && natal.rawDates.chineseDate.yearly[1] === birthYearBranch
    ? [...liangYangTuo, ...fireBell.quanshuFixedFireBell.map(row => ({ ...row, relation: relation(liangBranch, row.branch) }))]
    : undefined;
  const jielanLiangCounter = fireBell && natal.rawDates.chineseDate.yearly[1] === birthYearBranch
    ? fireBell.jielanFireBell.map(row => ({ ...row, relation: relation(liangBranch, row.branch) })) : undefined;
  const jielanFireBellOpposedTrine = liangAtLimit !== true ? liangAtLimit : jielanLiangCounter
    && jielanLiangCounter.some(row => row.relation === '冲') && jielanLiangCounter.some(row => row.relation === '三合');
  const liangGroups = mingTianliangGroups(liangBranch, liangAssistants, quanshuFixedCounter || undefined);
  const liangTempleTrineGroupAtSeat = allKnown([liangAtLimit, liangGroups.trine]);
  const liangTempleDistributedGroupAtSeat = allKnown([liangAtLimit, liangGroups.distributed]);
  const tianliang = { branch: liangBranch, assistants: liangAssistants, atLimit: liangAtLimit,
    chapterGrade, verseTemple, gradeConflict: verseTemple === true && chapterGrade === '陷',
    summaryGrade: quanshuBrightness('天梁', liangBranch),
    candidate: allKnown([liangAtLimit, confirmedVisible(liangAssistants)]),
    mingClearNamedSha: liangGroups.clearNamedSha,
    mingClearTemple: liangGroups.clearTemple,
    templeSupportAtLimit: allKnown([liangAtLimit, chapterGrade === '庙', someGuard(liangAssistants)]),
    mingTempleGroupAtSeatCandidate: allKnown([liangAtLimit, chapterGrade === '庙', liangGroups.atSeat]),
    mingTempleTrineGroupAtSeatCandidate: liangTempleTrineGroupAtSeat,
    mingTempleTrineGroupWitness: liangTempleTrineGroupAtSeat === true ? liangGroups.trineWitness : undefined,
    mingTempleDistributedGroupAtSeatCandidate: liangTempleDistributedGroupAtSeat,
    mingTempleDistributedGroupWitness: liangTempleDistributedGroupAtSeat === true ? liangGroups.distributedWitness : undefined,
    counter: liangCounter, quanshuFixedCounter,
    jielanFireBellOpposedTrine,
    jielanFireBellWitness: jielanFireBellOpposedTrine === true ? jielanLiangCounter : undefined,
    combinedShaAtLimit: allKnown([liangAtLimit, confirmedVisible(liangYangTuo), liangCounter?.length === 4
      ? allKnown([confirmedVisible(liangCounter), someGuard(liangCounter)]) : undefined]),
    quanshuFixedCombinedShaAtLimit: allKnown([liangAtLimit, confirmedVisible(liangYangTuo), quanshuFixedCounter
      ? allKnown([confirmedVisible(quanshuFixedCounter), someGuard(quanshuFixedCounter)]) : undefined]) };

  const quBranch = at('文曲'), tongBranch = verifiedMajors.get('天同');
  const tongRelation = tongBranch === undefined ? undefined : relation(quBranch, tongBranch);
  const quAssistants = auxiliaryContacts(quBranch, assistants);
  const quCompanions = [...quAssistants, { star: '天同', branch: tongBranch, relation: tongRelation }];
  const tongAssistants = auxiliaryContacts(tongBranch, assistants);
  const quGrade = quanshuBrightness('文曲', quBranch);
  const quChapterGrade = '午戌'.includes(quBranch) ? '陷' : quBranch === '寅' ? '平' : '巳酉丑'.includes(quBranch) ? '庙'
    : '亥卯未'.includes(quBranch) ? '旺' : '地';
  const lianzhen = verifiedMajors.get('廉贞');
  const quCounter = [{ star: '廉贞', branch: lianzhen, relation: lianzhen === undefined ? undefined : relation(quBranch, lianzhen) },
    ...auxiliaryContacts(quBranch, ['陀罗', '擎羊'])];
  const quAtLimit = atLimit(quBranch);
  const atQuLimit = (...checks: (boolean | undefined)[]) => quAtLimit === undefined ? undefined : allKnown([quAtLimit, ...checks]);
  const tongSupport = confirmedVisible(tongAssistants), counterSeen = confirmedVisible(quCounter);
  const quGroups = mingWenquGroups(quBranch, tongBranch, quAssistants, tongAssistants);
  const wenquMingGroupAtSeatCandidate = atQuLimit(quGroups.atSeat);
  const wenquMingTongTrineAtSeatCandidate = atQuLimit(quGroups.trine);
  const wenquMingTongTrineWitness = wenquMingTongTrineAtSeatCandidate === true ? quGroups.trineWitness : undefined;
  const wenquMingSeatedTongTrineAssistantsAtSeatCandidate = atQuLimit(quGroups.seatedTongTrineAssistants);
  const wenquMingDistributedAtSeatCandidate = atQuLimit(quGroups.distributed);
  const changBranch = at('文昌');
  const companionsOnAuxiliaryLayer = ['文昌', '文曲'].every(star => atAuxiliary(star) !== undefined);
  const distinctChangLimit = changBranch !== quBranch;
  const jielanChangQuGuard = atQuLimit(companionsOnAuxiliaryLayer ? true : undefined,
    distinctChangLimit, verifiedOther && verifiedOther.earthlyBranch === changBranch,
    tongRelation === undefined ? undefined : visible.includes(tongRelation), tongSupport);
  const jielanChangQuWitness = jielanChangQuGuard === true ? { wenquBranch: quBranch, wenchangBranch: changBranch,
    wenchangScope: scope === 'minor' ? 'decadal' as const : 'minor' as const, tongBranch, tongRelation, assistants: tongAssistants } : undefined;
  const chapterFallenCounterAtLimit = atQuLimit(quChapterGrade === '陷', counterSeen);
  const { lifeBranch } = basis.natalBasis;
  const lifeStars = [...verifiedMajors].filter(([, branch]) => branch === lifeBranch)
    .map(([star]) => ({ star, branch: lifeBranch, grade: quanshuBrightness(star, lifeBranch) }));
  const lifeWeak = lifeStars.some(row => row.grade !== undefined && row.grade !== '陷') ? false
    : !lifeStars.length || major.some(star => verifiedMajors.get(star) === undefined)
      || lifeStars.some(row => row.grade === undefined) ? undefined : true;
  const chapterFallenWeakLife = allKnown([chapterFallenCounterAtLimit, atAuxiliary('文曲') === undefined ? undefined : true, lifeWeak]);
  const wenqu = { branch: quBranch, tongBranch, tongRelation, grade: quGrade, chapterGrade: quChapterGrade, companions: quCompanions, tongAssistants,
    counter: quCounter, atLimit: quAtLimit, mingGroupAtSeatCandidate: wenquMingGroupAtSeatCandidate,
    mingTongTrineAtSeatCandidate: wenquMingTongTrineAtSeatCandidate, mingTongTrineWitness: wenquMingTongTrineWitness,
    mingSeatedTongTrineAssistantsAtSeatCandidate: wenquMingSeatedTongTrineAssistantsAtSeatCandidate,
    mingSeatedTongTrineAssistantsWitness: wenquMingSeatedTongTrineAssistantsAtSeatCandidate === true
      ? quGroups.seatedTongTrineAssistantsWitness : undefined,
    mingDistributedAtSeatCandidate: wenquMingDistributedAtSeatCandidate,
    mingDistributedWitness: wenquMingDistributedAtSeatCandidate === true ? quGroups.distributedWitness : undefined,
    candidate: atQuLimit(confirmedVisible(quCompanions), tongSupport),
    pairedLimitsCandidate: atQuLimit(tongSupport, tongRelation === undefined ? undefined : ['冲', '三合'].includes(tongRelation),
      verifiedOther && tongBranch !== undefined ? verifiedOther.earthlyBranch === tongBranch : undefined),
    jielanChangQuGuard, jielanChangQuWitness, chapterFallenCounterAtLimit, chapterFallenWeakLife,
    chapterFallenWeakLifeWitness: chapterFallenWeakLife === true ? { lifeBranch, lifeStars, counter: quCounter } : undefined,
    jielanYinFallenCounterAtLimit: atQuLimit(quBranch === '寅', jielanFallenAt('文曲', quBranch), counterSeen),
    fallenCounterAtLimit: atQuLimit(quGrade === '陷', counterSeen) };
  return { propertySun, ziwei, tianliang, wenqu, sourceDecadal, sourceMinorVerified, ziweiBirthAnchorVerified };
}

export function quanshuSupportCondition(natal: Natal, palaceIndex: number, annualIndex: number, lunarYear: number,
  scope: 'decadal' | 'minor' | 'yearly', otherIndex?: number) {
  const basis = readQuanshuSupportNatal(natal), palace = natal.palaces.find(p => p.index === palaceIndex);
  const annual = natal.palaces.find(p => p.index === annualIndex), other = natal.palaces.find(p => p.index === otherIndex);
  if (!basis.ready) return { ready: false, reason: basis.reason } as const;
  if (!palace || !annual || !Number.isInteger(lunarYear) || !['decadal', 'minor', 'yearly'].includes(scope)
    || annual.earthlyBranch !== branches[mod(lunarYear - 4)] || (otherIndex !== undefined && !other)) return { ready: false, reason: 'inconsistent_limit_year_geometry' } as const;
  const around = (branch: string) => [...new Set(basis.sourcePositions.filter(row => visible.includes(relation(branch, row.branch))).map(row => row.star))];
  const related = basis.sourcePositions.map(row => ({ ...row, relation: relation(palace.earthlyBranch, row.branch) }));
  const annualStem = stems[((lunarYear - 4) % 10 + 10) % 10], lucun = quanshuLuYangTuo(annualStem).lucunBranch;
  const decadal = scope === 'decadal' ? palace : other;
  const namedSupport = scope === 'yearly' ? undefined : namedLimitSupport(basis, natal, palace, scope, lunarYear, other);
  return { ready: true, profile: quanshuSupportPolicy.profile, birthStem: basis.birthStem, birthMonth: basis.birthMonth,
    birthHour: basis.birthHour, scope, branch: palace.earthlyBranch, natalName: palace.name, palaceIndex,
    lunarYear, annualStem, annualBranch: annual.earthlyBranch, annualRelation: relation(palace.earthlyBranch, annual.earthlyBranch),
    annualLucunBranch: lucun, annualLucunRelation: relation(palace.earthlyBranch, lucun),
    otherScope: scope === 'decadal' ? 'minor' : 'decadal',
    otherBranch: other?.earthlyBranch, otherSamePalace: other ? other.index === palace.index : undefined,
    otherAtChenXu: other ? '辰戌'.includes(other.earthlyBranch) : undefined,
    sourceLocalStars: related.filter(row => row.relation === '守').map(row => row.star),
    sourceOppositeStars: related.filter(row => row.relation === '冲').map(row => row.star),
    sourceTrineStars: related.filter(row => row.relation === '三合').map(row => row.star),
    sourceAdjacentStars: related.filter(row => row.relation === '邻宫').map(row => row.star),
    sourceAreaStars: around(palace.earthlyBranch), decadalAreaStars: decadal ? around(decadal.earthlyBranch) : undefined,
    sourceAuxiliaryQualities: basis.sourceAuxiliaryQualities, noblePair: basis.noblePair,
    nobleArchiveBranches: basis.nobleArchiveBranches, nobleArchiveState: basis.nobleArchiveState,
    sourceRelations: related, namedSupport, ziweiBirthAnchorVerified: namedSupport?.ziweiBirthAnchorVerified,
    propertySunPlacementProof: quanshuSupportPolicy.propertySunPlacement,
    propertySunCandidate: namedSupport?.propertySun.candidate, propertySunSplitAssistedCandidate: namedSupport?.propertySun.splitAssistedCandidate,
    propertySunMingNamedSupportCandidate: namedSupport?.propertySun.mingNamedSupportCandidate,
    propertySunMingNamedPartnerGuardCandidate: namedSupport?.propertySun.mingNamedPartnerGuardCandidate,
    twoLimitGuardProfile: quanshuSupportPolicy.twoLimitGuard,
    propertySunDoubleFuBiGuard: namedSupport?.propertySun.doubleFuBiGuard, ziweiDoubleFuBiGuard: namedSupport?.ziwei.doubleFuBiGuard,
    ziweiMingFuXiangDoubleGuardCandidate: namedSupport?.ziwei.mingFuXiangDoubleGuard,
    ziweiMingFuXiangSeatAndTrineDoubleGuardCandidate: namedSupport?.ziwei.mingFuXiangSeatAndTrineDoubleGuard,
    ziweiSupportCandidate: namedSupport?.ziwei.candidate,
    ziweiTrinePairCandidate: namedSupport?.ziwei.trinePairCandidate,
    tianliangSupportCandidate: namedSupport?.tianliang.candidate, wenquSupportCandidate: namedSupport?.wenqu.candidate,
    tianliangPlainGuardCandidate: namedSupport?.tianliang.atLimit,
    tianliangTempleSupportCandidate: namedSupport?.tianliang.templeSupportAtLimit,
    tianliangMingTempleGroupAtSeatCandidate: namedSupport?.tianliang.mingTempleGroupAtSeatCandidate,
    tianliangMingTempleTrineGroupAtSeatCandidate: namedSupport?.tianliang.mingTempleTrineGroupAtSeatCandidate,
    tianliangMingTempleTrineGroupWitness: namedSupport?.tianliang.mingTempleTrineGroupWitness,
    tianliangMingTempleDistributedGroupAtSeatCandidate: namedSupport?.tianliang.mingTempleDistributedGroupAtSeatCandidate,
    tianliangMingTempleDistributedGroupWitness: namedSupport?.tianliang.mingTempleDistributedGroupWitness,
    tianliangCombinedShaCandidate: namedSupport?.tianliang.combinedShaAtLimit,
    quanshuFixedFireBellProfile,
    jielanFireBellProfile, jielanDignityProfile,
    tianliangJielanFireBellOpposedTrineCandidate: namedSupport?.tianliang.jielanFireBellOpposedTrine,
    tianliangJielanFireBellWitness: namedSupport?.tianliang.jielanFireBellWitness,
    tianliangQuanshuFixedCombinedShaCandidate: namedSupport?.tianliang.quanshuFixedCombinedShaAtLimit,
    wenquPairedLimitsCandidate: namedSupport?.wenqu.pairedLimitsCandidate,
    wenquMingGroupAtSeatCandidate: namedSupport?.wenqu.mingGroupAtSeatCandidate,
    wenquMingTongTrineAtSeatCandidate: namedSupport?.wenqu.mingTongTrineAtSeatCandidate,
    wenquMingTongTrineWitness: namedSupport?.wenqu.mingTongTrineWitness,
    wenquMingSeatedTongTrineAssistantsAtSeatCandidate: namedSupport?.wenqu.mingSeatedTongTrineAssistantsAtSeatCandidate,
    wenquMingSeatedTongTrineAssistantsWitness: namedSupport?.wenqu.mingSeatedTongTrineAssistantsWitness,
    wenquMingDistributedAtSeatCandidate: namedSupport?.wenqu.mingDistributedAtSeatCandidate,
    wenquMingDistributedWitness: namedSupport?.wenqu.mingDistributedWitness,
    wenquJielanChangQuGuardCandidate: namedSupport?.wenqu.jielanChangQuGuard,
    wenquJielanChangQuGuardWitness: namedSupport?.wenqu.jielanChangQuWitness,
    ziweiThreeShaCandidate: namedSupport?.ziwei.threeShaAtLimit, wenquFallenCandidate: namedSupport?.wenqu.fallenCounterAtLimit,
    wenquChapterFallenCandidate: namedSupport?.wenqu.chapterFallenCounterAtLimit,
    wenquChapterFallenWeakLifeCandidate: namedSupport?.wenqu.chapterFallenWeakLife,
    wenquChapterFallenWeakLifeWitness: namedSupport?.wenqu.chapterFallenWeakLifeWitness,
    wenquJielanYinFallenCandidate: namedSupport?.wenqu.jielanYinFallenCounterAtLimit,
    wenquJielanYinFallenWitness: namedSupport?.wenqu.jielanYinFallenCounterAtLimit === true ? namedSupport.wenqu.counter : undefined,
    calendarPolicy: quanshuSupportPolicy.calendar, geometryOnly: true } as const;
}

type SourceScope = { start: number; end: number; scope: string; lunarYear: number; output: { index: number } };
export function bindQuanshuSupportScopes(scopes: SourceScope[]) {
  return scopes.filter(item => ['decadal', 'minor', 'yearly'].includes(item.scope)).flatMap(focus =>
    scopes.filter(item => item.scope === 'yearly').flatMap(year => {
      const start = Math.max(focus.start, year.start), end = Math.min(focus.end, year.end);
      if (start >= end) return [];
      const partners = scopes.filter(item => item.scope === (focus.scope === 'decadal' ? 'minor' : 'decadal') && item.start < end && start < item.end);
      const cuts = [...new Set([start, end, ...partners.flatMap(item => [Math.max(start, item.start), Math.min(end, item.end)])])].sort((a, b) => a - b);
      return cuts.slice(0, -1).map((from, i) => ({ start: from, end: cuts[i + 1], focus, year,
        other: partners.find(item => item.start <= from && cuts[i + 1] <= item.end) }));
    }));
}
