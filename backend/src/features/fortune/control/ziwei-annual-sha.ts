import { jielanFlowShaBranches, quanshuBodyLimitEncounterPolicy } from './ziwei-body-limit-encounters';
import { quanshuFireBellCondition } from './ziwei-firebell';
import { quanshuFireBellAnchors, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import type { quanshuLimitBranches } from './ziwei-limit-branches';
import { quanshuFourFlying } from './ziwei-kongjie';
import { jielanDignityProfile, jielanFallenAt, quanshuBrightness, quanshuPalaceRelation, quanshuVerifiedMajorPositions,
  type quanshuAnnualContext } from './ziwei-quanshu';

type Natal = Parameters<typeof quanshuAnnualContext>[0];
type Annual = ReturnType<typeof quanshuAnnualContext>;
type Limits = ReturnType<typeof quanshuLimitBranches>;
type Condition = boolean | undefined;
const branches = '子丑寅卯辰巳午未申酉戌亥';
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;

export const quanshuAnnualShaPolicy = {
  profile: 'quanshu-annual-sha-source-v1',
  migration: 'si-wu-source-fire-seats-natal-and-product-annual-separate',
  migrationRepeat: 'natal-and-annual-same-named-sha-repeat-at-qisha-in-the-same-migration-trine',
  nativeBladePlacement: 'quanshu-verified-native-blade-minor-layer-v1',
  sha: 'source-annual-yang-tuo-and-four-flying-white-tiger-with-archive-and-jielan-bell-branches',
  guardedPojunTiger: 'four-flying-white-tiger-guards-the-same-active-limit-as-pojun',
  relief: 'specific-pojun-tianliang-and-lucun-positions-with-unresolved-control',
  reliefPlacement: 'quanshu-native-minor-lucun-v1',
  scope: 'one-natal-candidate-and-native-lunar-year',
} as const;

function contact(focus?: string, target?: string) {
  if (!focus || !target) return undefined;
  const relation = quanshuPalaceRelation(focus, target);
  const distance = Math.abs(branches.indexOf(target) - branches.indexOf(focus));
  return relation === '其他' && (distance === 1 || distance === 11) ? '邻宫' : relation;
}
const samePalace = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : relation === '守';
const inArea = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : ['守', '冲', '三合'].includes(relation);
const trine = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : relation === '三合';

export function quanshuAnnualSha(natal: Natal, annual: Annual, yearBranch: string, annualMigrationBranch?: string, limits?: Limits) {
  if (!annual.ready || !Number.isInteger(annual.lunarYear) || annual.lunarYear < Math.max(1, annual.birthYear) || annual.lunarYear > 9998
    || annual.birthYear < 1) return { ready: false } as const;
  const { lunarYear, lifeBranch, migrationBranch, annualStem } = annual;
  const year = quanshuFourFlying(lunarYear);
  const yearSeat = natal.palaces.find(row => row.earthlyBranch === yearBranch);
  if (!yearSeat || yearBranch !== year.yearBranch || natal.rawDates?.chineseDate?.yearly?.[1] !== quanshuFourFlying(annual.birthYear).yearBranch) {
    return { ready: false } as const;
  }
  const archived = new Map<string, string | undefined>();
  for (const palace of natal.palaces) {
    for (const row of palace.majorStars) archived.set(row.name, archived.has(row.name) ? undefined : palace.earthlyBranch);
    for (const row of [...palace.minorStars, ...palace.adjectiveStars]) archived.set(row.name, undefined);
  }
  const majors = quanshuVerifiedMajorPositions(star => archived.get(star));
  const unverifiedMajorStars = ['贪狼', '破军', '巨门', '七杀', '天梁'].filter(star => majors.get(star) === undefined);
  const sameYearLimits = limits?.ready && limits.lunarYear === lunarYear && limits.annualBranch === yearBranch ? limits : undefined;
  const verifiedDecadal = sameYearLimits?.sourceDecadal?.verified === true ? sameYearLimits.sourceDecadal.branch : undefined;
  const verifiedMinor = sameYearLimits?.sourceMinor?.verified === true ? sameYearLimits.sourceMinor.branch : undefined;
  const position = (star: string) => majors.get(star);
  const tanlang = position('贪狼'), pojun = position('破军'), jumen = position('巨门'), qisha = position('七杀');
  // The annual basis has already checked uniqueness and the calculated branch.
  // A named native blade in another archive layer cannot attest 同宮.
  const nativeMinor = (star: string, branch: string) => natal.palaces.find(row => row.earthlyBranch === branch
    && row.minorStars.some(entry => entry.name === star))?.earthlyBranch;
  const flowing = [
    { star: '擎羊', branch: annual.annualQingyangBranch, sourceBranch: annual.qingyangBranch },
    { star: '陀罗', branch: annual.annualTuoluoBranch, sourceBranch: annual.tuoluoBranch },
  ].map(({ star, branch, sourceBranch }) => {
    const natalBranch = nativeMinor(star, sourceBranch);
    return { star, branch, natalBranch, repeatsNatal: branch !== sourceBranch ? false : natalBranch === undefined ? undefined : true };
  });
  const whiteTiger = year.placements.find(row => row.name === '白虎')!.branch;
  const annualMigration = annualMigrationBranch?.length === 1 && branches.includes(annualMigrationBranch)
    && contact(yearBranch, annualMigrationBranch) === '冲' ? annualMigrationBranch : undefined;
  const migrations = [{ layer: 'natal', branch: migrationBranch }, { layer: 'yearly', branch: annualMigration }].map(anchor => {
    const fireSeat = anchor.branch === undefined ? undefined : ['巳', '午'].includes(anchor.branch);
    const tanlangRelation = contact(anchor.branch, tanlang), pojunRelation = contact(anchor.branch, pojun);
    const annualSha = flowing.map(star => ({ ...star, migrationRelation: contact(anchor.branch, star.branch),
      pojunRelation: contact(pojun, star.branch), qishaRelation: contact(qisha, star.branch) } as const));
    const annualOverlap = any(annualSha.flatMap(star => [samePalace(star.migrationRelation), samePalace(star.pojunRelation)]));
    const repeatedSha = annualSha.filter(star => star.repeatsNatal && star.qishaRelation === '守'
      && star.migrationRelation === '三合' && star.pojunRelation === '三合');
    const repeatsAtQisha = any(annualSha.map(star => all([star.repeatsNatal, samePalace(star.qishaRelation),
      trine(star.migrationRelation), trine(star.pojunRelation)])));
    const tanlangPojunShaRepeat = all([samePalace(tanlangRelation), trine(pojunRelation), repeatsAtQisha]);
    return { ...anchor, fireSeat, tanlang, pojun, jumen, qisha, tanlangRelation, pojunRelation,
      jumenRelation: contact(anchor.branch, jumen), qishaRelation: contact(anchor.branch, qisha), annualSha,
      candidate: all([fireSeat, samePalace(tanlangRelation), inArea(pojunRelation), annualOverlap]),
      repeatedShaCandidate: all([fireSeat, tanlangPojunShaRepeat]), tanlangPojunShaRepeat,
      repeatedSha };
  });
  const migrationSharedShaRepeat = all([
    annualMigration === undefined ? undefined : migrationBranch === annualMigration,
    ...migrations.map(row => row.tanlangPojunShaRepeat),
    any(flowing.map(row => all([row.repeatsNatal, row.branch === yearBranch]))),
  ]);
  const migrationSharedFireShaRepeat = all([migrationSharedShaRepeat, ...migrations.map(row => row.fireSeat)]);
  const migrationSharedMingEarthShaRepeat = all([migrationSharedShaRepeat, ['辰', '戌', '丑', '未'].includes(migrationBranch)]);
  const pojunArea = contact(yearBranch, pojun);
  const pojunSha = flowing.map(row => ({ ...row, relation: contact(pojun, row.branch) } as const));
  const tigerRelation = contact(pojun, whiteTiger);
  const guardingLimits = ([
    { scope: 'decadal', branch: verifiedDecadal }, { scope: 'minor', branch: verifiedMinor },
  ] as const).map(row => ({ scope: row.scope,
    relation: contact(pojun, row.branch) } as const));
  const tigerAtPojunLimitCandidate = all([inArea(pojunArea), samePalace(tigerRelation),
    any(guardingLimits.map(row => samePalace(row.relation)))]);
  const nativeLucun = nativeMinor('禄存', annual.lucunBranch);
  const relief = [
    { star: '天梁', layer: 'natal', branch: position('天梁') },
    { star: '禄存', layer: 'natal', branch: nativeLucun },
    { star: '禄存', layer: 'yearly', branch: annual.annualLucunBranch },
  ].map(row => ({ ...row, relation: contact(pojun, row.branch) } as const));
  const namedReliefInArea = any(relief.map(row => inArea(row.relation)));
  const pojunCase = { branch: pojun, annualRelation: pojunArea, grade: pojun ? quanshuBrightness('破军', pojun) : undefined,
    annualTiger: { branch: whiteTiger, relation: tigerRelation },
    guardingLimits: guardingLimits.filter(row => row.relation === '守').map(row => row.scope),
    annualSha: pojunSha, relief, namedReliefInArea,
    candidate: all([inArea(pojunArea), any(pojunSha.map(row => samePalace(row.relation)))]) };
  const pojunAtGuardedAnnualSha = all([pojunCase.candidate, any(guardingLimits.map(row => samePalace(row.relation)))]);
  // Wang names Gui births. A Gui calendar year is separately computable and does not attest natal relief.
  const pojunWangNativeHuaLuSupport = all([pojunAtGuardedAnnualSha, annual.birthStem === '癸']);
  const pojunYearlyHuaLuContact = all([pojunAtGuardedAnnualSha, annualStem === '癸']);
  const jielanFlowShaGroup = jielanFlowShaBranches(yearBranch);
  const knownNamedReliefOutside = namedReliefInArea === undefined ? undefined : !namedReliefInArea;
  const pojunJielanMinorFlowShaCandidate = all([jielanFallenAt('破军', pojun),
    samePalace(contact(pojun, verifiedMinor)), inArea(pojunArea),
    jielanFlowShaGroup && verifiedMinor ? jielanFlowShaGroup.includes(verifiedMinor) : undefined, knownNamedReliefOutside]);
  const firebell = quanshuFireBellCondition(natal, yearSeat.index, yearSeat.index, lunarYear, 'yearly');
  const bell = firebell.ready ? firebell.archivedFireBell.find(row => row.star === '铃星')?.branch : undefined;
  const nativeYang = flowing[0].natalBranch;
  const yangAtLife = annual.qingyangBranch !== lifeBranch ? false : samePalace(contact(lifeBranch, nativeYang));
  const bellTigerCase = { lifeBranch, bell, nativeYang, whiteTiger,
    candidate: all([yangAtLife, whiteTiger === lifeBranch, bell === undefined ? undefined : bell === lifeBranch]) };
  const jielanBellTigerCandidate = firebell.ready ? all([yangAtLife, whiteTiger === lifeBranch, firebell.jielanBellAtLife]) : undefined;
  // The Ming placement uses the verified birth-year branch, independent of the
  // product's hour-moved Bell and Fire archives.
  const mingBell = quanshuFireBellAnchors(natal.rawDates.chineseDate.yearly[1]).engineNamedAnchors[1].branch;
  const quanshuFixedBellTigerCase = { lifeBranch, bell: mingBell, nativeYang, whiteTiger,
    candidate: all([yangAtLife, whiteTiger === lifeBranch, mingBell === lifeBranch]) };
  const fixedBellTigerZiweiGuard = quanshuFixedBellTigerCase.candidate === true
    ? samePalace(contact(lifeBranch, position('紫微'))) : undefined;
  return { ready: true, profile: quanshuAnnualShaPolicy.profile, lunarYear, yearBranch, annualStem, migrations, pojunCase, bellTigerCase,
    limitPlacementProof: sameYearLimits?.limitPlacementProof,
    reliefPlacementProof: quanshuAnnualShaPolicy.reliefPlacement,
    annualShaBladePlacementProof: quanshuAnnualShaPolicy.nativeBladePlacement,
    unverifiedMajorStars,
    jielanFireBellProfile: firebell.ready ? firebell.jielanFireBellProfile : undefined, jielanBellTigerCandidate,
    quanshuFixedFireBellProfile, quanshuFixedBellTigerCase, quanshuFixedBellTigerCandidate: quanshuFixedBellTigerCase.candidate,
    fixedBellTigerZiweiGuard,
    migrationFireCandidate: any(migrations.map(row => row.candidate)),
    migrationFireShaRepeatCandidate: any(migrations.map(row => row.repeatedShaCandidate)),
    migrationSharedFireShaRepeat, migrationSharedMingEarthShaRepeat,
    yearlyShaCandidate: any([pojunCase.candidate, bellTigerCase.candidate]), tigerAtPojunLimitCandidate,
    pojunWangNativeHuaLuSupport, pojunYearlyHuaLuContact,
    pojunWangNativeHuaLuWitness: pojunWangNativeHuaLuSupport === true ? {
      branch: pojun, birthStem: annual.birthStem, guardingLimits: pojunCase.guardingLimits,
      annualSha: pojunSha.filter(row => row.relation === '守').map(({ star, branch }) => ({ star, branch })),
    } : undefined,
    jielanFlowShaProfile: quanshuBodyLimitEncounterPolicy.jielanFlowSha, jielanDignityProfile,
    pojunJielanMinorFlowShaCandidate,
    pojunJielanMinorFlowShaWitness: pojunJielanMinorFlowShaCandidate === true ? {
      minorBranch: verifiedMinor, branches: jielanFlowShaGroup, grade: '陷', annualRelation: pojunArea, relief: pojunCase.relief,
    } : undefined,
    effectiveControl: 'unresolved' } as const;
}
