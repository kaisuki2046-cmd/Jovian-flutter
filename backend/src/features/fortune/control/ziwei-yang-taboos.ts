import { quanshuBrightness, quanshuIdlePalace, quanshuLuYangTuo, quanshuMinorLimit, quanshuTransformations, quanshuVerifiedMajorPositions,
  readQuanshuNatal } from './ziwei-quanshu';
import { readQuanshuBodyNatal } from './ziwei-body-limits';
import { readQuanshuSupportNatal } from './ziwei-source-support';
import { quanshuFireBellCondition } from './ziwei-firebell';
import { jielanFireBellProfile, quanshuFireBellAnchors, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import { quanshuDecadalVerification, quanshuLifeBureau, quanshuLimitPlacementProof } from './ziwei-growth-stages';
import { quanshuZiweiBirthAnchor } from './ziwei-birth-major-anchor';
import { quanshuKongJiePositions } from './ziwei-kongjie';
import type { quanshuDoujunCondition } from './ziwei-source-year';

const branches = '子丑寅卯辰巳午未申酉戌亥', mod = (n: number) => (n % 12 + 12) % 12;
const stems = '甲乙丙丁戊己庚辛壬癸';
const natalPalaceNames = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
const relation = (from: string, to: string) => {
  const distance = mod(branches.indexOf(to) - branches.indexOf(from));
  return distance === 0 ? '守' : distance === 6 ? '冲' : [4, 8].includes(distance) ? '三合'
    : [1, 11].includes(distance) ? '邻宫' : '其他';
};
type Condition = boolean | undefined;
const all = (states: Condition[]) => states.includes(false) ? false : states.includes(undefined) ? undefined : true;
const any = (states: Condition[]) => states.includes(true) ? true : states.includes(undefined) ? undefined : false;
export const quanshuYangTabooPolicy = {
  profile: 'quanshu-yang-strength-birth-taboo-v1',
  yang: 'source-birth-stem-placement-and-explicit-volume2-tomb-and-fallen-seats',
  activeLimits: 'same-fragment-net-opposition-and-fallen-yang-with-a-separate-named-co-occupant',
  guardSupport: 'actual-yang-guard-with-separate-tomb-birth-tomb-life-and-named-helpers',
  mingXingAn: 'quanshu-nanyangtang-yang-jumen-limit-v1',
  fallenYangJi: 'source-birth-stem-ji-at-fallen-yang-with-actual-limit-guard-or-opposition',
  fallenYangLimitProof: 'quanshu-fallen-yang-verified-limit-witnesses-v1',
  repeatedYang: 'source-year-stem-yang-and-natal-yang-cooccupied-by-tai-sui-and-an-actual-limit',
  netWeakLife: 'all-verified-life-palace-major-stars-explicitly-fallen-in-volume-three',
  netIdleLife: 'edition-specific-idle-or-fallen-life-majors-without-stronger-volume-three-grades',
  printedTaboo: 'named-natal-support-three-separate-sha-seats-and-a-printed-birth-taboo-witness',
  natalTabooHelp: 'seated-luminaries-source-lucun-and-source-birth-stem-lu-quan-ke-at-life-body-or-career',
  namedTaboo: 'printed-native-stars-guard-active-annual-or-limit-seats-with-tomb-qualification-and-three-sha-layers',
  weakLimits: 'archive-table-weak-palace-or-source-fallen-major-with-separately-supported-strong-palace',
  weakLimitPlacement: 'quanshu-weak-limit-actual-seats-and-star-layers-v1',
  weakLimitNatalPalaceNameProof: 'quanshu-natal-palace-name-order-v1',
  strongDignity: 'explicit-volume3-temple-or-prosperous-support-with-real-life-palace-contact',
  majors: 'unique-compatible-archive-source-volume3-cells-not-whole-chart-strength',
  strength: 'volume2-male-female-palace-name-tables-kept-separate-not-person-classification',
  taboo: 'volume3-twelve-birth-branches-prose-verse-and-contact-gaps-separated',
  interpretation: 'four-tomb-birth-branch-is-candidate-only-no-automatic-rescue-or-disaster',
  calendar: 'native-lunar-new-year-and-civil-midnight',
} as const;

export function quanshuBirthTabooCandidates(birthBranch: string) {
  if (birthBranch.length !== 1 || !branches.includes(birthBranch)) throw new RangeError('Invalid source taboo birth branch');
  const tables: Record<string, { prose: string; verse: string; annual: string; limit?: string; pairs: string[]; stars: string[]; tombYang?: boolean }> = {
    子: { prose: '寅申', verse: '寅申', annual: '', pairs: ['子午'], stars: [] },
    丑: { prose: '丑午', verse: '丑午', annual: '', pairs: [], stars: ['七杀'] },
    寅: { prose: '巳亥', verse: '巳亥', annual: '', pairs: ['卯酉', '寅申'], stars: [] },
    卯: { prose: '巳亥', verse: '巳亥', annual: '', pairs: ['卯酉', '寅申'], stars: [] },
    辰: { prose: '辰戌', verse: '辰', annual: '辰', limit: '辰戌', pairs: [], stars: [] },
    巳: { prose: '巳', verse: '巳', annual: '巳', limit: '巳', pairs: [], stars: [] },
    午: { prose: '丑午', verse: '丑午', annual: '', pairs: [], stars: ['七杀'] },
    未: { prose: '酉戌', verse: '亥酉', annual: '', pairs: [], stars: ['擎羊'], tombYang: true },
    申: { prose: '', verse: '', annual: '寅', pairs: [], stars: ['铃星', '火星'] },
    酉: { prose: '卯', verse: '', annual: '卯', limit: '卯', pairs: [], stars: ['擎羊', '陀罗'] },
    戌: { prose: '戌辰', verse: '巳', annual: '', limit: '戌辰', pairs: ['辰戌'], stars: ['擎羊', '陀罗'] },
    亥: { prose: '', verse: '巳', annual: '', pairs: [], stars: ['擎羊', '陀罗'] },
  };
  const row = tables[birthBranch];
  return { birthBranch, proseBranches: [...row.prose], verseBranches: [...row.verse], explicitAnnualBranches: [...row.annual],
    explicitLimitBranches: [...(row.limit ?? '')],
    oppositionPairs: row.pairs.map(pair => [...pair]), namedStars: row.stars,
    requiresTombYang: row.tombYang === true, weiProseVerseConflict: birthBranch === '未', completeTabooDefinitionVerified: false };
}

export function quanshuPalaceNameGroups(name: string) {
  const maleStrong = ['财帛', '官禄', '福德', '迁移', '田宅'], maleWeak = ['子女', '仆役', '兄弟', '父母'];
  const femaleStrong = ['夫妻', '子女', '财帛', '田宅', '福德'];
  if (!natalPalaceNames.includes(name)) throw new RangeError('Invalid compatible palace name');
  return { name, maleTable: maleStrong.includes(name) ? '强宫' : maleWeak.includes(name) ? '弱宫' : undefined,
    femaleTable: femaleStrong.includes(name) ? '强宫' : '弱宫' };
}

type Args = Parameters<typeof quanshuDoujunCondition>;
export function quanshuYangTabooCondition(...args: Args) {
  const [natal, palaceIndex, annualIndex, lunarYear, scope, decadalIndex, minorIndex] = args;
  const basis = readQuanshuNatal(natal), focus = natal.palaces.find(p => p.index === palaceIndex);
  const annual = natal.palaces.find(p => p.index === annualIndex), decadal = natal.palaces.find(p => p.index === decadalIndex), minor = natal.palaces.find(p => p.index === minorIndex);
  if (basis.status !== 'ready' || !focus || !annual || !Number.isInteger(lunarYear) || lunarYear < 1 || lunarYear > 9998
    || basis.birthYear < 1 || basis.birthYear > lunarYear || !['decadal', 'minor', 'yearly'].includes(scope)) return { ready: false, reason: 'unavailable_yang_taboo_basis' } as const;
  const birthYearBranch = branches[mod(basis.birthYear - 4)], annualBranch = branches[mod(lunarYear - 4)];
  if (natal.rawDates.chineseDate.yearly[1] !== birthYearBranch || annual.earthlyBranch !== annualBranch
    || decadalIndex !== undefined && !decadal || minorIndex !== undefined && !minor
    || scope === 'yearly' && palaceIndex !== annualIndex || scope === 'decadal' && palaceIndex !== decadalIndex
    || scope === 'minor' && palaceIndex !== minorIndex) return { ready: false, reason: 'inconsistent_yang_taboo_geometry' } as const;
  const native = readQuanshuBodyNatal(natal), support = readQuanshuSupportNatal(natal), firebell = quanshuFireBellCondition(...args);
  const at = (branch: string) => ({ focusRelation: relation(focus.earthlyBranch, branch), lifeRelation: relation(basis.lifeBranch, branch),
    bodyRelation: native.ready ? relation(native.bodyBranch, branch) : undefined });
  const gradeRows = native.ready ? native.mainPositions.map(row => ({ ...row, grade: quanshuBrightness(row.star, row.branch), ...at(row.branch) })) : undefined;
  const lifeMajorStars = gradeRows?.filter(row => row.lifeRelation === '守');
  const lifeMajorGradeState = !lifeMajorStars ? 'unverified'
    : !lifeMajorStars.length ? 'empty'
      : lifeMajorStars.some(row => row.grade === undefined) ? 'unverified'
        : lifeMajorStars.every(row => row.grade === '陷') ? 'all-fallen' : 'other-grades';
  const lifeMajorIdleEvidence = lifeMajorStars?.map(({ star, branch, grade }) => ({ star, branch, grade, ...quanshuIdlePalace(star, branch) }));
  const idleLifeCandidate = (edition: 'volumeTwo' | 'mingEdition') => {
    if (!lifeMajorIdleEvidence) return undefined;
    const idleOnly = lifeMajorIdleEvidence.map(row => row.grade === undefined || row.grade === '平' ? row[edition] : false);
    return all([any(idleOnly), ...lifeMajorIdleEvidence.map((row, i) => row.grade === '陷' ? true : idleOnly[i])]);
  };
  const taboo = quanshuBirthTabooCandidates(birthYearBranch), yangBranch = basis.qingyangBranch;
  const yangAtTomb = '辰戌丑未'.includes(yangBranch), birthBranchInTombsCandidate = '辰戌丑未'.includes(birthYearBranch);
  const yangFallen = '子午卯酉'.includes(yangBranch);
  const scopeRelations = [{ scope: 'yearly', palace: annual }, { scope: 'decadal', palace: decadal }, { scope: 'minor', palace: minor }]
    .flatMap(row => row.palace ? [{ scope: row.scope, branch: row.palace.earthlyBranch, natalName: row.palace.name, ...at(row.palace.earthlyBranch),
      yangRelation: relation(row.palace.earthlyBranch, yangBranch), proseCandidate: taboo.proseBranches.includes(row.palace.earthlyBranch),
      verseCandidate: taboo.verseBranches.includes(row.palace.earthlyBranch),
      explicitAnnualCandidate: row.scope === 'yearly' ? taboo.explicitAnnualBranches.includes(row.palace.earthlyBranch) : undefined,
      explicitLimitCandidate: row.scope === 'yearly' ? undefined : taboo.explicitLimitBranches.includes(row.palace.earthlyBranch) }] : []);
  const scopePairCandidates = scopeRelations.flatMap((first, i) => scopeRelations.slice(i + 1).map(second => ({
    firstScope: first.scope, secondScope: second.scope, firstBranch: first.branch, secondBranch: second.branch,
    opposite: relation(first.branch, second.branch) === '冲',
    printedPairCandidate: taboo.oppositionPairs.some(pair => pair.includes(first.branch) && pair.includes(second.branch) && first.branch !== second.branch),
  })));
  const listedStars = [
    { star: '擎羊', branch: yangBranch, coordinateBasis: 'source' }, { star: '陀罗', branch: basis.tuoluoBranch, coordinateBasis: 'source' },
    ...(gradeRows?.filter(row => row.star === '七杀').map(row => ({ star: row.star, branch: row.branch, coordinateBasis: 'compatible-major' })) ?? []),
    ...(firebell.ready ? firebell.archivedFireBell.map(row => ({ ...row, coordinateBasis: 'product-hour' })) : []),
  ].filter(row => taboo.namedStars.includes(row.star)).map(row => ({ ...row, ...at(row.branch) }));
  const groups = (name: string) => {
    try { return quanshuPalaceNameGroups(name); } catch { return undefined; }
  };
  const supportPositions = support.ready ? support.sourcePositions.filter(row =>
    ['紫微', '天府', '文昌', '文曲', '左辅', '右弼', '魁钺组'].includes(row.star)).map(row => ({ ...row, ...at(row.branch) })) : undefined;
  const yearlyEncounters = () => {
    const decadalRelation = decadal ? relation(yangBranch, decadal.earthlyBranch) : undefined;
    const minorRelation = minor ? relation(yangBranch, minor.earthlyBranch) : undefined;
    const equals = (actual: string | undefined, expected: string) => actual === undefined ? undefined : actual === expected;
    const net = '辰戌'.includes(yangBranch);
    const limitOpposed = any([equals(decadalRelation, '冲'), equals(minorRelation, '冲')]);
    const netOpposedLimit = all([net, limitOpposed]);
    const decadalGuard = equals(decadalRelation, '守'), minorGuard = equals(minorRelation, '守');
    const limitGuard = any([decadalGuard, minorGuard]);
    const yangZiChangFuContacts = ['紫微', '文昌', '天府'].map(star => {
      const branch = supportPositions?.find(row => row.star === star)?.branch;
      return { star, branch, relation: branch ? relation(yangBranch, branch) : undefined };
    });
    const namedGuardSupport = all(yangZiChangFuContacts.map(row => row.relation === undefined ? undefined
      : ['守', '冲', '三合'].includes(row.relation)));
    const voids = quanshuKongJiePositions(natal);
    const positions = [
      { star: '陀罗', branch: basis.tuoluoBranch },
      ...['火星', '铃星'].map(star => ({
        star: '归档' + star, branch: firebell.ready ? firebell.archivedFireBell.find(row => row.star === star)?.branch : undefined,
      })),
      { star: '古天空', branch: voids.ready ? voids.skyBranch : undefined },
      { star: '地劫', branch: voids.ready ? voids.robberyBranch : undefined },
    ];
    const additionalSha = positions.map(row => ({ ...row, relation: row.branch ? relation(yangBranch, row.branch) : undefined } as const));
    const fallenWithSha = all([yangFallen, any(additionalSha.map(row => equals(row.relation, '守')))]);
    const mingFireBell = quanshuFireBellAnchors(birthYearBranch).engineNamedAnchors;
    const fallenYangMingFixedSha = mingFireBell.map(row => ({
      ...row, relation: relation(yangBranch, row.branch),
    }));
    const fallenWithMingFixedSha = all([yangFallen, any(fallenYangMingFixedSha.map(row => equals(row.relation, '守')))]);

    const career = natal.palaces.filter(row => row.name === '官禄');
    const supportSeats = [
      { label: '命宫', branch: basis.lifeBranch },
      { label: '身宫', branch: native.ready ? native.bodyBranch : undefined },
      { label: '官禄', branch: career.length === 1 ? career[0].earthlyBranch : undefined },
    ];
    const helpersAtSeats = <Row extends { star: string; branch?: string }>(rows: readonly Row[]) => rows.flatMap(row => {
      if (!row.branch) return [];
      const labels = supportSeats.filter(seat => seat.branch === row.branch).map(seat => seat.label);
      return labels.length ? [{ ...row, branch: row.branch, labels }] : [];
    });
    const natalHelpers = supportPositions && helpersAtSeats(supportPositions.map(({ star, branch }) => ({ star, branch })));
    const majorPosition = (star: string) => gradeRows?.find(row => row.star === star)?.branch;
    const natalTransforms = quanshuTransformations(basis.birthStem);
    const transformPosition = (star: string) => majorPosition(star) ?? supportPositions?.find(row => row.star === star)?.branch;
    const { star: jiStar } = natalTransforms[3];
    const jiBranch = transformPosition(jiStar);
    const fallenYangNatalJi = { stem: basis.birthStem, star: jiStar, branch: jiBranch,
      relation: jiBranch ? relation(yangBranch, jiBranch) : undefined };
    const sourceMinor = quanshuMinorLimit(birthYearBranch, natal.gender, lunarYear - basis.birthYear + 1);
    const verifiedMinor = sourceMinor && minor?.earthlyBranch === sourceMinor.branch ? true : undefined;
    const verifiedMinorPalace = verifiedMinor === true ? minor : undefined;
    const verifiedMinorRelation = verifiedMinor === true ? minorRelation : undefined;
    const sourceDecadal = quanshuDecadalVerification(natal, basis, decadal, lunarYear);
    const verifiedDecadalBranch = sourceDecadal?.verified === true ? sourceDecadal.branch : undefined;
    const verifiedDecadalRelation = verifiedDecadalBranch ? decadalRelation : undefined;
    const verifiedDecadalGuard = equals(verifiedDecadalRelation, '守'), verifiedMinorGuard = equals(verifiedMinorRelation, '守');
    const verifiedDecadalOpposed = equals(verifiedDecadalRelation, '冲'), verifiedMinorOpposed = equals(verifiedMinorRelation, '冲');
    const limitGuardAndOpposition = any([
      all([verifiedDecadalGuard, verifiedMinorOpposed]),
      all([verifiedDecadalOpposed, verifiedMinorGuard]),
    ]);
    const verifiedLimitGuard = any([verifiedDecadalGuard, verifiedMinorGuard]);
    const verifiedLimitOpposed = any([verifiedDecadalOpposed, verifiedMinorOpposed]);
    const natalYangLayerVerified = natal.palaces.find(row => row.earthlyBranch === yangBranch)
      ?.minorStars.some(row => row.name === '擎羊') ? true : undefined;
    const mingBellSameSeat = fallenYangMingFixedSha.find(row => row.star === '铃星');
    const fallenYangMingBellDoubleGuardCandidate = all([yangFallen, natalYangLayerVerified,
      equals(mingBellSameSeat?.relation, '守'), verifiedDecadalGuard, verifiedMinorGuard]);
    // 卷一称刑与暗同行；先查全书的紫府星轴与星序，再核巨门是否实同宫。
    const verifiedMajors = yangFallen && verifiedLimitGuard !== false ? quanshuVerifiedMajorPositions(majorPosition) : undefined;
    const tianfu = verifiedMajors?.get('天府'), jumenBranch = verifiedMajors?.get('巨门');
    const fallenYangMingJumenGuardCandidate = all([yangFallen, verifiedLimitGuard,
      jumenBranch === undefined ? undefined : jumenBranch === yangBranch]);
    const fallenYangMingJumenWitness = fallenYangMingJumenGuardCandidate === true ? {
      yangBranch, jumenBranch, tianfuBranch: tianfu,
      guardScopes: [...(verifiedDecadalGuard === true ? ['decadal'] : []), ...(verifiedMinorGuard === true ? ['minor'] : [])],
    } : undefined;
    const jielanFireBranch = firebell.ready ? firebell.jielanFireBell.find(row => row.star === '火星')?.branch : undefined;
    const jielanFireRelation = jielanFireBranch ? relation(yangBranch, jielanFireBranch) : undefined;
    const sourceVoidContacts = additionalSha.filter(row => row.star === '古天空' || row.star === '地劫');
    const fallenYangJielanFireJiCandidate = all([basis.birthStem === '甲', '卯酉'.includes(yangBranch),
      limitGuardAndOpposition, equals(jielanFireRelation, '冲'), equals(fallenYangNatalJi.relation, '冲'),
      ...sourceVoidContacts.map(row => row.relation === undefined ? undefined : ['守', '冲', '三合'].includes(row.relation))]);
    const fallenYangJielanFireJiWitness = fallenYangJielanFireJiCandidate === true ? {
      yangBranch, decadalBranch: decadal?.earthlyBranch, minorBranch: minor?.earthlyBranch,
      fire: { star: '火星', branch: jielanFireBranch, relation: jielanFireRelation },
      taboo: fallenYangNatalJi, voids: sourceVoidContacts,
    } : undefined;
    const annualStem = stems[((lunarYear - 4) % 10 + 10) % 10];
    const annualYangBranch = quanshuLuYangTuo(annualStem).qingyangBranch;
    const fallenYangAnnualYang = { stem: annualStem, branch: annualYangBranch,
      relation: relation(yangBranch, annualYangBranch), atTaiSui: annualYangBranch === annualBranch };
    const additionalPositions: { star: string; branch?: string; transformation?: string }[] = [
      ...['太阳', '太阴'].map(star => ({ star, branch: majorPosition(star) })),
      { star: '禄存', branch: basis.lucunBranch },
      ...natalTransforms.filter(row => row.kind !== '忌').map(({ star, kind }) => ({
        star, transformation: kind, branch: transformPosition(star),
      })),
    ];
    const natalAdditionalHelpers = helpersAtSeats(additionalPositions);
    const shaPositions = [{ star: '本命擎羊', branch: yangBranch }, ...positions];
    const shaAtScopes = (named: ReadonlyArray<{ star: string; branch?: string }>) =>
      ([['yearly', annualBranch], ['decadal', verifiedDecadalBranch], ['minor', verifiedMinorPalace?.earthlyBranch]] as const)
      .map(([limitScope, branch]) => ({
        scope: limitScope, branch, stars: branch ? named.filter(row => row.branch === branch).map(row => row.star) : [],
        present: any(named.map(row => branch && row.branch ? row.branch === branch : undefined)),
      }));
    const yearSha = shaAtScopes(shaPositions);
    const verifiedScope = (scope: string) => scope === 'yearly'
      || (scope === 'decadal' ? verifiedDecadalBranch !== undefined : verifiedMinor === true);
    const matchingTabooSeats = scopeRelations.filter(row => verifiedScope(row.scope)
      && ((row.proseCandidate && row.verseCandidate) || row.explicitAnnualCandidate === true || row.explicitLimitCandidate === true));
    const matchingTabooPairs = scopePairCandidates.filter(row => row.printedPairCandidate
      && verifiedScope(row.firstScope) && verifiedScope(row.secondScope));
    const printedTaboo = matchingTabooSeats.length > 0 || matchingTabooPairs.length > 0 ? true
      : yearSha.some(row => row.branch === undefined) ? undefined : false;
    const natalSupport = !native.ready || career.length !== 1 ? undefined
      : natalHelpers?.length || natalAdditionalHelpers.length ? true
        : natalHelpers === undefined || additionalPositions.some(row => row.branch === undefined) ? undefined : false;
    // The separate Seven Kill clause follows 午生人 in the printed note.
    const namedTabooGuards = (birthYearBranch === '丑' ? [] : taboo.namedStars).map(star => {
      const position = listedStars.find(row => row.star === star);
      const branch = position?.branch;
      const inRequiredSeat = !taboo.requiresTombYang ? true : branch === undefined ? undefined : '辰戌丑未'.includes(branch);
      const scopes = yearSha.filter(row => branch && row.branch === branch).map(row => row.scope);
      const guarded = all([inRequiredSeat, any(yearSha.map(row => branch && row.branch ? row.branch === branch : undefined))]);
      return { star, branch, coordinateBasis: position?.coordinateBasis, scopes, guarded };
    });
    const namedSevenKill = namedTabooGuards.find(row => row.star === '七杀');
    const namedRouteSha = yearSha.map(row => {
      const namedSevenKillHere = !namedSevenKill ? false : row.branch === undefined || namedSevenKill.branch === undefined
        ? undefined : row.branch === namedSevenKill.branch;
      return any([row.present, namedSevenKillHere]);
    });
    const namedTabooWithThreeShaCandidate = all([natalSupport,
      namedTabooGuards.length ? all(namedTabooGuards.map(row => row.guarded)) : false, all(namedRouteSha)]);
    const mingNamedTaboo = birthYearBranch === '申';
    const mingNamedTabooYearSha = mingNamedTaboo ? shaAtScopes([
      ...shaPositions.filter(row => !row.star.startsWith('归档')), ...mingFireBell,
    ]) : [];
    const mingNamedTabooGuardStates = mingFireBell.map(row => ({ ...row,
      scopes: mingNamedTabooYearSha.filter(scope => scope.branch === row.branch).map(scope => scope.scope),
      guarded: any(mingNamedTabooYearSha.map(scope => scope.branch === undefined ? undefined : scope.branch === row.branch)),
    }));
    const namedMingFixedFireBellTabooCandidate = all([mingNamedTaboo, natalSupport,
      all(mingNamedTabooGuardStates.map(row => row.guarded)), all(mingNamedTabooYearSha.map(row => row.present))]);
    const namedShenTabooAtVerifiedThreeScopes = all([namedMingFixedFireBellTabooCandidate,
      sourceDecadal?.verified === true ? true : undefined, verifiedMinor]);
    const palaceTable = natal.gender === '男' ? 'maleTable' : natal.gender === '女' ? 'femaleTable' : undefined;
    // 明刊〈安十二宫例〉。限位按坐标，宫名从已核命宫另行复算。
    const verifiedNatalPalaceNames = new Map<string, typeof natalPalaceNames[number]>(natal.palaces.flatMap(palace => {
      const name = natalPalaceNames[mod(basis.lifeIndex - palace.index)];
      return palace.name === name ? [[palace.earthlyBranch, name] as const] : [];
    }));
    const strengthMajors = quanshuVerifiedMajorPositions(star => {
      const branch = majorPosition(star);
      return natal.palaces.find(row => row.earthlyBranch === branch)?.majorStars.some(row => row.name === star)
        ? branch : undefined;
    });
    const strengthRoster = supportPositions?.map(row => {
      const branch = strengthMajors.has(row.star) ? strengthMajors.get(row.star)
        : row.star === '魁钺组' || natal.palaces.find(palace => palace.earthlyBranch === row.branch)
          ?.minorStars.some(star => star.name === row.star) ? row.branch : undefined;
      return { ...row, branch };
    });
    const reachesLife = (row: { lifeRelation: string }) => ['守', '冲', '三合'].includes(row.lifeRelation);
    const strongSupportIncomplete = strengthRoster?.some(row => row.branch === undefined
      || reachesLife(row) && !verifiedNatalPalaceNames.has(row.branch)) ?? true;
    const supportedStrongPalaces = strengthRoster?.flatMap(row => {
      const { branch } = row, palace = branch && verifiedNatalPalaceNames.get(branch);
      if (!branch || !palace || !palaceTable || groups(palace)?.[palaceTable] !== '强宫' || !reachesLife(row)) return [];
      return [{ star: row.star, branch, palace, lifeRelation: row.lifeRelation }];
    });
    const strongPalaceSeen = supportedStrongPalaces?.length ? true : !palaceTable || strongSupportIncomplete ? undefined : false;
    const dignityCandidates = strengthRoster?.filter(row => ['紫微', '天府', '文昌', '文曲'].includes(row.star)
      && ['守', '冲', '三合'].includes(row.lifeRelation)).flatMap(({ star, branch, lifeRelation }) =>
        branch === undefined ? [] : [{ star, branch, lifeRelation, grade: quanshuBrightness(star, branch) }]);
    const strongDignitySupports = dignityCandidates?.filter(row => row.grade === '庙' || row.grade === '旺');
    const strongDignitySeen = strongDignitySupports?.length ? true
      : !dignityCandidates || strengthRoster?.some(row => ['紫微', '天府', '文昌', '文曲'].includes(row.star) && row.branch === undefined)
        || dignityCandidates.some(row => row.grade === undefined) ? undefined : false;
    const allMajorSeatsKnown = [...strengthMajors.values()].every(branch => branch !== undefined);
    const verifiedDecadalPalace = sourceDecadal?.verified === true ? decadal : undefined;
    const weakLimits = ([['decadal', verifiedDecadalPalace], ['minor', verifiedMinorPalace]] as const).map(([limitScope, palace]) => {
      const name = palace && verifiedNatalPalaceNames.get(palace.earthlyBranch);
      const palaceGrade = name && palaceTable ? groups(name)?.[palaceTable] : undefined;
      const local = palace && gradeRows ? gradeRows.filter(row =>
        row.branch === palace.earthlyBranch && strengthMajors.get(row.star) === row.branch) : undefined;
      const fallenMajors = local?.filter(row => row.grade === '陷').map(row => row.star);
      return { scope: limitScope, branch: palace?.earthlyBranch, palace: name, palaceGrade,
        weakPalace: palaceGrade === undefined ? undefined : palaceGrade === '弱宫',
        fallenMajors,
        hasFallenMajor: fallenMajors?.length ? true
          : !allMajorSeatsKnown || !local || local.some(row => row.grade === undefined) ? undefined : false };
    });
    const migration = natal.palaces.find(palace => palace.name === '迁移');
    const migrationZiwei = strengthRoster?.find(row => row.star === '紫微');
    const migrationHasBrightZiwei = migration && migrationZiwei?.branch
      ? migrationZiwei.branch === migration.earthlyBranch && migrationZiwei.lifeRelation === '冲'
        && ['庙', '旺'].includes(quanshuBrightness('紫微', migrationZiwei.branch) ?? '')
      : undefined;
    const migrationAssistant = any(['左辅', '右弼'].map(star => {
      const branch = strengthRoster?.find(row => row.star === star)?.branch;
      return branch && migration ? branch === migration.earthlyBranch : undefined;
    }));
    const fallenWeakLimit = any(weakLimits.map(row => all([row.weakPalace, row.hasFallenMajor])));
    const strongMigrationWithFallenWeakLimit = all([palaceTable === 'maleTable',
      migrationHasBrightZiwei, migrationAssistant, fallenWeakLimit]);
    const careerBranch = [...verifiedNatalPalaceNames].find(([, name]) => name === '官禄')?.[0];
    const careerZiFu = all(['紫微', '天府'].map(star => {
      const branch = strengthMajors.get(star);
      const grade = branch && quanshuBrightness(star, branch);
      return branch === undefined || careerBranch === undefined || grade === undefined ? undefined
        : branch === careerBranch && ['庙', '旺'].includes(grade);
    }));
    const careerCandidate = all([palaceTable === 'maleTable', careerZiFu, fallenWeakLimit,
      careerBranch === undefined ? undefined : relation(basis.lifeBranch, careerBranch) === '三合']);
    const strongCareerZiFuWithFallenWeakLimit = careerCandidate !== true ? careerCandidate
      : quanshuZiweiBirthAnchor(natal, quanshuLifeBureau(natal, basis).verifiedLifeBureau) === careerBranch ? true : undefined;
    return {
      decadalYangRelation: decadalRelation, minorYangRelation: minorRelation, additionalSha,
      yangNetOpposedLimitCandidate: netOpposedLimit,
      yangNetVerifiedOpposedLimitCandidate: all([net, verifiedLimitOpposed]),
      yangNetVerifiedAxes: {
        decadalBranch: verifiedDecadalBranch, decadalRelation: verifiedDecadalRelation,
        minorBranch: verifiedMinorPalace?.earthlyBranch, minorRelation: verifiedMinorRelation,
        sourceDecadal, sourceMinor, minorVerified: verifiedMinor,
      },
      limitPlacementProof: quanshuLimitPlacementProof,
      fallenYangLimitProof: quanshuYangTabooPolicy.fallenYangLimitProof,
      yangNetVolumeTwoIdleLifeCandidate: all([netOpposedLimit, idleLifeCandidate('volumeTwo')]),
      yangNetMingIdleLifeCandidate: all([netOpposedLimit, idleLifeCandidate('mingEdition')]),
      yangNetBothOpposed: all([net, equals(decadalRelation, '冲'), equals(minorRelation, '冲')]),
      yangNetAcrossLimits: all([net, limitOpposed, limitGuard]),
      yangNetVerifiedAcrossLimits: all([net, limitGuardAndOpposition]),
      yangNetVerifiedBothOpposed: all([net, verifiedDecadalOpposed, verifiedMinorOpposed]),
      yangTombBirthGuardCandidate: all([limitGuard, birthBranchInTombsCandidate]),
      yangTombLifeGuardCandidate: all([limitGuard, yangAtTomb, basis.lifeBranch === yangBranch]),
      yangZiChangFuGuardCandidate: all([limitGuard, namedGuardSupport]), yangZiChangFuContacts,
      fallenYangGuardShaCandidate: all([fallenWithSha, verifiedLimitGuard]),
      fallenYangOpposedShaCandidate: all([fallenWithSha, verifiedLimitOpposed]),
      quanshuFixedFireBellProfile, fallenYangMingFixedSha,
      fallenYangMingFixedGuardCandidate: all([fallenWithMingFixedSha, verifiedLimitGuard]),
      fallenYangMingFixedOpposedCandidate: all([fallenWithMingFixedSha, verifiedLimitOpposed]),
      fallenYangMingBellDoubleGuardCandidate,
      mingXingAnProfile: quanshuYangTabooPolicy.mingXingAn, fallenYangMingJumenGuardCandidate, fallenYangMingJumenWitness,
      jielanFireBellProfile, fallenYangJielanFireJiCandidate, fallenYangJielanFireJiWitness,
      fallenYangNatalJi, fallenYangAnnualYang,
      fallenYangNatalJiCandidate: all([yangFallen, equals(fallenYangNatalJi.relation, '守'), any([verifiedLimitGuard, verifiedLimitOpposed])]),
      fallenYangRepeatAnnualCandidate: all([yangFallen, equals(fallenYangAnnualYang.relation, '守'), fallenYangAnnualYang.atTaiSui, verifiedLimitGuard]),
      natalHelpers, natalAdditionalHelpers, natalSupport, yearSha, matchingTabooSeats, matchingTabooPairs, namedTabooGuards,
      birthTabooWithThreeShaCandidate: all([natalSupport, all(yearSha.map(row => row.present)), printedTaboo]),
      namedTabooWithThreeShaCandidate,
      namedMingFixedFireBellTabooCandidate, namedShenTabooAtVerifiedThreeScopes, mingNamedTabooYearSha,
      mingNamedTabooGuards: namedMingFixedFireBellTabooCandidate === true ? mingNamedTabooGuardStates : [],
      weakLimitPlacementProof: quanshuYangTabooPolicy.weakLimitPlacement,
      weakLimitNatalPalaceNameProof: quanshuYangTabooPolicy.weakLimitNatalPalaceNameProof,
      palaceTable, supportedStrongPalaces, weakLimits, strongDignitySupports, strongMigrationWithFallenWeakLimit,
      strongCareerZiFuWithFallenWeakLimit,
      strongPalaceWeakLimitCandidate: all([strongPalaceSeen, any(weakLimits.map(row => row.weakPalace))]),
      strongPalaceFallenLimitCandidate: all([strongPalaceSeen, any(weakLimits.map(row => row.hasFallenMajor))]),
      strongDignityWeakLimitCandidate: all([strongDignitySeen, any(weakLimits.map(row => row.weakPalace))]),
      strongDignityFallenLimitCandidate: all([strongDignitySeen, any(weakLimits.map(row => row.hasFallenMajor))]),
    } as const;
  };
  return { ready: true, profile: quanshuYangTabooPolicy.profile, scope, lunarYear, branch: focus.earthlyBranch, natalName: focus.name,
    birthYearBranch, annualBranch, natalLifeBranch: basis.lifeBranch, bodyBranch: native.ready ? native.bodyBranch : undefined,
    yangBranch, yangGrade: yangAtTomb ? '庙' : yangFallen ? '陷' : undefined,
    yangInNet: '辰戌'.includes(yangBranch), yangFallen, ...at(yangBranch),
    netMembers: [...'辰戌'].map(branch => ({ branch, ...at(branch), yangRelation: relation(branch, yangBranch) })),
    birthBranchInTombsCandidate,
    mainPositionsReady: native.ready ? true : undefined, mainPositions: gradeRows,
    lifeMajorStars, lifeMajorGradeState, lifeMajorIdleEvidence, focusMajorStars: gradeRows?.filter(row => row.focusRelation === '守'),
    lifePalaceGroups: groups('命宫'), focusPalaceGroups: groups(focus.name),
    supportReady: support.ready, supportPositions,
    birthTaboo: taboo, scopeRelations, scopePairCandidates, listedTabooStars: listedStars,
    allListedTabooStarsPositioned: taboo.namedStars.every(star => listedStars.some(row => row.star === star)) ? true : undefined,
    sourceFireBellHourVerified: false, encounterRangeVerified: false, wholeChartStrengthVerified: false, geometryOnly: true,
    ...(scope === 'yearly' ? yearlyEncounters() : {}) } as const;
}
