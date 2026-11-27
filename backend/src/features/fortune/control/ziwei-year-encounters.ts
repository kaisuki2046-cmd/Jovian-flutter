import { buildQuanshuDoujunMonths } from './ziwei-doujun-months';
import { quanshuZiweiBirthAnchor, verifiedLunarBirthDay } from './ziwei-birth-major-anchor';
import { quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import { quanshuLimitPlacementProof } from './ziwei-growth-stages';
import { quanshuFourFlying } from './ziwei-kongjie';
import type { quanshuLimitBranches } from './ziwei-limit-branches';
import { quanshuLuYangTuo, quanshuPalaceRelation, quanshuTransformations, type readQuanshuNatal } from './ziwei-quanshu';
import { quanshuDoujunCondition, quanshuVerifiedKuXu, quanshuYearPolicy } from './ziwei-source-year';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Limits = ReturnType<typeof quanshuLimitBranches>;
type Months = ReturnType<typeof buildQuanshuDoujunMonths>;
type Window = { start: number; end: number };
type Condition = boolean | undefined;
type Position = { star: string; branch?: string; expectedBranch?: string };
type YearOpening = { lunarYear: number; annualBranch: string; decadalBranch?: string; minorBranch?: string };
const branches = '子丑寅卯辰巳午未申酉戌亥';
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const invert = (value: Condition) => value === undefined ? undefined : !value;
const sameSeat = (a?: string, b?: string) => a === undefined || b === undefined ? undefined : a === b;
const contact = (a?: string, b?: string) => a && b ? quanshuPalaceRelation(a, b) : undefined;
const isAspect = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : ['冲', '三合'].includes(relation);
const isOpposed = (relation: ReturnType<typeof contact>) => relation === undefined ? undefined : relation === '冲';
const seenHere = (rows: Position[], branch?: string) => any(rows.map(row =>
  branch !== undefined && row.expectedBranch !== undefined && row.expectedBranch !== branch
    ? false : sameSeat(row.branch, branch)));
const atPalace = (rows: Position[], branch?: string) => branch
  ? rows.filter(row => row.branch === branch).map(({ star, branch }) => ({ star, branch })) : [];

export const quanshuYearEncountersPolicy = {
  profile: 'quanshu-cry-void-doujun-year-encounters-v1',
  cryVoid: 'verified-birth-cry-void-at-real-limits-and-explicit-seat-or-lu-branches',
  cryVoidAspects: 'one-verified-native-star-guards-a-limit-and-the-other-opposes-or-trines-that-or-the-distinct-partner-limit',
  cryVoidLuAspects: 'a-verified-native-star-guards-a-limit-and-each-lu-layer-is-tested-separately-for-opposition-or-trine',
  cryingMourning: 'source-natal-cry-and-yearly-four-flying-mourning-conjoin-at-the-native-cry-seat',
  cryingMourningLimit: 'one-star-guards-the-actual-limit-and-the-other-opposes-or-trines-that-seat',
  cryingMourningSplit: 'verified-native-cry-and-yearly-mourning-guard-distinct-active-limits-in-one-lunar-year-slice',
  cryingMourningNanyang: 'quanshu-nanyangtang-cry-mourning-cases-v1',
  cryingMourningQuanji: 'quanji-taixuan-tianzhang-life-and-six-harmony-cry-v1',
  doujun: 'three-layer-local-named-support-with-no-known-local-sha-and-first-month-sha',
  doujunAnnualYangTuo: 'separate-verified-annual-yang-tuo-at-opening-and-at-the-actual-month-palace',
  doujunNamedStarLayer: 'quanshu-doujun-verified-natal-named-layers-v1',
  time: 'confirm-first-month-at-lunar-midnight-and-all-three-opening-seats-before-carrying-into-a-clipped-window',
  monthReview: 'quanshu-doujun-year-month-review-v1',
} as const;

function quanjiLifeCryMourning(natal: Natal, birthYearBranch: string, mourningBranch?: string) {
  const birth = natal.rawDates.lunarDate;
  if (birth.isLeap || verifiedLunarBirthDay(natal) === undefined) return undefined;
  const branchAt = (index: number) => branches[(index % 12 + 12) % 12];
  // 《全集》子起正月逆安天杖，由天杖起生时顺数至卯安命。
  const tianzhangIndex = 1 - birth.lunarMonth;
  const birthHourIndex = branches.indexOf(natal.rawDates.chineseDate.hourly[1]);
  const lifeBranch = branchAt(tianzhangIndex + branches.indexOf('卯') - birthHourIndex);
  // 同书以生年支的六合宫安天哭，流年丧门仍为顺排第三位。
  const cryBranch = branchAt(1 - branches.indexOf(birthYearBranch));
  return { tianzhangBranch: branchAt(tianzhangIndex), lifeBranch, cryBranch, mourningBranch,
    cryRelation: contact(lifeBranch, cryBranch), mourningRelation: contact(lifeBranch, mourningBranch) } as const;
}

export function quanshuYearEncounters(natal: Natal, limits: Limits, window: Window, months: Months,
  readYearOpening?: (at: number) => YearOpening | undefined, birthTimeKnown = false) {
  if (!limits.ready) return { ready: false } as const;
  const { lunarYear, annualBranch, decadalBranch, minorBranch, birthStem, natalLucunBranch, verifiedMajorBranches, relief, adverse } = limits;
  const verifiedDecadal = limits.sourceDecadal?.verified === true ? limits.sourceDecadal.branch : undefined;
  const verifiedMinor = limits.sourceMinor?.verified === true ? limits.sourceMinor.branch : undefined;
  const annualStem = '甲乙丙丁戊己庚辛壬癸'[(lunarYear + 6) % 10];
  const verifiedNatalLucun = limits.verifiedBellNatalAid.find(row => row.star === '禄存')?.branch;
  const luStar = (stem: string) => quanshuTransformations(stem).find(row => row.kind === '禄')!.star;
  const natalLuStar = luStar(birthStem), annualLuStar = luStar(annualStem);
  const annualLuYangTuo = quanshuLuYangTuo(annualStem);
  const lu = [
    { label: '本命禄存', star: '禄存', branch: verifiedNatalLucun },
    { label: '流年禄存', star: '禄存', branch: annualLuYangTuo.lucunBranch },
    { label: '生年干化禄', star: natalLuStar, branch: limits.birthAnchoredMajorBranches[natalLuStar] },
    { label: '流年干化禄候选', star: annualLuStar, branch: limits.birthAnchoredMajorBranches[annualLuStar] },
  ];
  const scopeContacts = (branch?: string) => ({ annual: contact(branch, annualBranch),
    decadal: contact(branch, verifiedDecadal), minor: contact(branch, verifiedMinor) } as const);
  const annualFourFlying = quanshuFourFlying(lunarYear).placements;
  const mourningBranch = annualFourFlying.find(row => row.name === '丧门')?.branch;
  const birthYearBranch = natal.rawDates.chineseDate.yearly[1];
  const cries = quanshuVerifiedKuXu(natal, birthYearBranch).map(row => {
    const branch = row.verified ? row.branch : undefined;
    const guarded = any([sameSeat(branch, verifiedDecadal), sameSeat(branch, verifiedMinor)]);
    const luContacts = lu.map(entry => ({ ...entry, relation: contact(branch, entry.branch), atSeat: sameSeat(branch, entry.branch) } as const));
    return { star: row.star, branch, ...scopeContacts(branch), guarded, luContacts,
      exception: all([guarded, branch === undefined ? undefined : '丑卯申'.includes(branch)]),
      guardedLu: all([guarded, any(luContacts.map(entry => entry.atSeat))]),
      guardedLuAspect: all([guarded, any(luContacts.map(entry => isAspect(entry.relation)))]) };
  });
  const [cry, voidStar] = cries;
  const cryVoidDoubleGuards = cries.map(row => ({ star: row.star, branch: row.branch,
    candidate: all([row.exception, sameSeat(row.branch, verifiedDecadal), sameSeat(row.branch, verifiedMinor)]) }));
  const cryVoidNativeLuExceptionGuards = cryVoidDoubleGuards.map(row => ({ ...row,
    candidate: all([row.candidate, sameSeat(row.branch, verifiedNatalLucun)]) }));
  const cryVoidNativeLuExceptionDoubleGuardCandidate = any(cryVoidNativeLuExceptionGuards.map(row => row.candidate));
  const confirmedCryVoid = cryVoidNativeLuExceptionGuards.find(row => row.candidate === true);
  const cryVoidNativeLuExceptionDoubleGuardWitness = confirmedCryVoid
    && { star: confirmedCryVoid.star, branch: confirmedCryVoid.branch, nativeLucun: verifiedNatalLucun };
  const cryVoidNamedPalaceGuards = cryVoidDoubleGuards.map(row => ({ ...row,
    candidate: all([row.candidate, invert(sameSeat(row.branch, natalLucunBranch))]) }));
  const cryVoidNamedPalaceDoubleGuardCandidate = any(cryVoidNamedPalaceGuards.map(row => row.candidate));
  const confirmedNamedPalace = cryVoidNamedPalaceGuards.find(row => row.candidate === true);
  const cryVoidNamedPalaceDoubleGuardWitness = confirmedNamedPalace
    && { star: confirmedNamedPalace.star, branch: confirmedNamedPalace.branch };
  const cryVoidExceptionCandidate = any(cries.map(row => row.exception));
  const cryVoidNativeLuAtVerifiedLimitCandidate = all([
    any(cries.map(row => all([row.exception, sameSeat(row.branch, verifiedNatalLucun)]))),
    cryVoidNativeLuExceptionDoubleGuardCandidate !== true,
  ]);
  const cryVoidNamedPalaceAtVerifiedLimitCandidate = all([cryVoidExceptionCandidate,
    cryVoidNativeLuExceptionDoubleGuardCandidate !== true, cryVoidNamedPalaceDoubleGuardCandidate !== true,
    cryVoidNativeLuAtVerifiedLimitCandidate !== true]);
  const coLocated = sameSeat(cry.branch, voidStar.branch);
  const cryVoidMinorCoGuardCandidate = all([coLocated, sameSeat(cry.branch, verifiedMinor)]);
  const cryVoidBothStarsDoubleGuardCandidate = all([cryVoidMinorCoGuardCandidate, sameSeat(cry.branch, verifiedDecadal)]);
  const cryVoidBothStarsDoubleGuardWitness = cryVoidBothStarsDoubleGuardCandidate === true
    ? { branch: cry.branch, stars: [cry.star, voidStar.star] } : undefined;
  const bothVoidStarsAtLimits = all([cry.guarded, voidStar.guarded]);
  const cryVoidSplitCandidate = all([invert(coLocated), bothVoidStarsAtLimits]);
  const decadeIndex = verifiedDecadal === undefined ? undefined : branches.indexOf(verifiedDecadal);
  const decadeNeighbors = decadeIndex === undefined ? undefined
    : [branches.at(decadeIndex - 1), branches[(decadeIndex + 1) % branches.length]];
  const cryVoidDadeFlankedDecadalCandidate = all([invert(coLocated), ...cries.map(({ branch }) =>
    branch === undefined || decadeNeighbors === undefined ? undefined : decadeNeighbors.includes(branch))]);
  const cryVoidDadeFlankedDecadalWitness = cryVoidDadeFlankedDecadalCandidate === true ? {
    decadalBranch: verifiedDecadal, flanks: cries.map(({ star, branch }) => ({ star, branch })),
  } : undefined;
  const limitSeats = [['decadal', verifiedDecadal], ['minor', verifiedMinor]] as const;
  const cryVoidLimitContacts = limitSeats.flatMap(([guardScope, guardBranch]) =>
    limitSeats.flatMap(([aspectScope, aspectBranch]) => [[cry, voidStar], [voidStar, cry]].map(([guard, aspect]) => ({
      guardScope, guardBranch, guardStar: guard.star, aspectScope, aspectLimitBranch: aspectBranch,
      aspectStar: aspect.star, aspectBranch: aspect.branch, aspectRelation: aspect[aspectScope],
      candidate: all([sameSeat(guard.branch, guardBranch), isAspect(aspect[aspectScope]),
        guardScope === aspectScope ? true : invert(sameSeat(guardBranch, aspectBranch))]),
    }))));
  const cryMourningCandidate = sameSeat(cry.branch, mourningBranch);
  const cryMourningMinorCoGuardCandidate = all([cryMourningCandidate, sameSeat(cry.branch, verifiedMinor)]);
  const cryMourningAnnualCoGuardCandidate = all([cryMourningCandidate, cryMourningMinorCoGuardCandidate !== true]);
  const cryMourningLimitContacts = limitSeats.map(([scope, branch]) => {
    const cryRelation = contact(branch, cry.branch), mourningRelation = contact(branch, mourningBranch);
    const candidate = any([
      all([sameSeat(branch, cry.branch), isAspect(mourningRelation)]),
      all([sameSeat(branch, mourningBranch), isAspect(cryRelation)]),
    ]);
    return { scope, branch, cryRelation, mourningRelation, candidate };
  });
  const minorCryRelation = contact(verifiedMinor, cry.branch), minorMourningRelation = contact(verifiedMinor, mourningBranch);
  const cryMourningNanyangMinorCandidate = all([sameSeat(verifiedMinor, mourningBranch), isOpposed(minorCryRelation)]);
  const life = natal.palaces.find(row => row.name === '命宫')?.earthlyBranch;
  const lifeCryRelation = contact(life, cry.branch), lifeMourningRelation = contact(life, mourningBranch);
  const cryMourningNanyangLifeCandidate = all([sameSeat(life, cry.branch), isOpposed(lifeMourningRelation)]);
  const quanjiLife = birthTimeKnown ? quanjiLifeCryMourning(natal, birthYearBranch, mourningBranch) : undefined;
  const cryMourningQuanjiLifeAspectCandidate = all([isAspect(quanjiLife?.cryRelation), isAspect(quanjiLife?.mourningRelation)]);
  const cryMourningNanyangWitnesses = [
    ...(cryMourningNanyangMinorCandidate === true ? [{ scope: 'minor', branch: verifiedMinor,
      cryRelation: minorCryRelation, mourningRelation: minorMourningRelation }] : []),
    ...(cryMourningNanyangLifeCandidate === true ? [{ scope: 'natal', branch: life,
      cryRelation: lifeCryRelation, mourningRelation: lifeMourningRelation }] : []),
  ];
  const splitGuards = limitSeats.map(([cryScope, crySeat], index) => {
    const [mourningScope, mourningSeat] = limitSeats[1 - index];
    return { cryScope, crySeat, mourningScope, mourningSeat,
      candidate: all([invert(cryMourningCandidate), sameSeat(cry.branch, crySeat), sameSeat(mourningBranch, mourningSeat)]) };
  });
  const dadeFourFlying = annualFourFlying.filter(row => ['丧门', '吊客', '白虎'].includes(row.name))
    .map(({ name: star, branch }) => ({ star, branch, relation: contact(voidStar.branch, branch) }));
  const cryMourningDadeSplitFourFlyingCandidate = all([
    cryVoidSplitCandidate, sameSeat(voidStar.branch, mourningBranch), isAspect(contact(cry.branch, mourningBranch)),
    ...dadeFourFlying.map(({ relation }) => relation === undefined ? undefined : ['守', '冲', '三合'].includes(relation)),
  ]);
  const cryMourningDadeSplitFourFlyingWitness = cryMourningDadeSplitFourFlyingCandidate === true ? {
    cry: { branch: cry.branch, scope: cry.branch === verifiedDecadal ? 'decadal' as const : 'minor' as const },
    voidStar: { branch: voidStar.branch, scope: voidStar.branch === verifiedDecadal ? 'decadal' as const : 'minor' as const },
    fourFlying: dadeFourFlying,
  } : undefined;

  // The independently verified decade already checked the archive's life bureau against its birth pillar.
  const expectedZiwei = quanshuZiweiBirthAnchor(natal, verifiedDecadal === undefined ? undefined : natal.fiveElementsClass);
  const archivedZiwei = verifiedMajorBranches['紫微'];
  const ziweiBirthAnchorVerified = expectedZiwei === undefined || archivedZiwei === undefined ? undefined : expectedZiwei === archivedZiwei;
  const namedSupport = relief.flatMap(group => group.name === '魁钺无序组'
    ? limits.verifiedBellNatalAid.filter(row => row.star === '魁钺组')
    : group.stars.map(row => ({ star: row.star,
      branch: group.name === '紫微天府' && ziweiBirthAnchorVerified !== true ? undefined : row.branch })));
  const namedSha = adverse.flatMap(group => group.stars.map(row => ({
    star: group.name === '归档火铃' ? '归档' + row.star : row.star,
    branch: group.name === '羊陀' ? limits.verifiedNatalYangTuo.find(star => star.star === row.star)?.branch
      : group.name === '伤使' ? limits.verifiedShangShi.find(star => star.star === row.star)?.branch : row.branch,
    expectedBranch: group.name === '羊陀' || group.name === '伤使' ? row.branch : undefined,
  })));
  const mingNamedSha = [...namedSha.filter(row => !row.star.startsWith('归档')), ...limits.quanshuFixedFireBell];
  const annualSha = [
    { star: '流年擎羊', branch: annualLuYangTuo.qingyangBranch },
    { star: '流年陀罗', branch: annualLuYangTuo.tuoluoBranch },
  ];
  const conditionsAt = (label: string, branch?: string) => ({
    label, branch, support: atPalace(namedSupport, branch), sha: atPalace(namedSha, branch), mingSha: atPalace(mingNamedSha, branch),
    favorable: all([seenHere(namedSupport, branch), invert(seenHere(namedSha, branch))]),
    mingFavorable: all([seenHere(namedSupport, branch), invert(seenHere(mingNamedSha, branch))]),
  });
  const yearLayers = [conditionsAt('太岁', annualBranch), conditionsAt('大限', verifiedDecadal), conditionsAt('小限', verifiedMinor)];
  const yearSupportCandidate = all(yearLayers.map(row => row.favorable));
  const index = (branch?: string) => natal.palaces.find(row => row.earthlyBranch === branch)?.index;
  const annualIndex = index(annualBranch);
  const doujun = annualIndex === undefined ? undefined
    : quanshuDoujunCondition(natal, annualIndex, annualIndex, lunarYear, 'yearly', index(verifiedDecadal), index(verifiedMinor));
  const firstInstant = doujun?.ready ? Date.parse(doujun.yearStart) : undefined;
  const includesFirstInstant = firstInstant === undefined ? undefined : window.start <= firstInstant && firstInstant < window.end;
  const startedEarlier = firstInstant !== undefined && firstInstant < window.start;
  const yearOpening = startedEarlier ? readYearOpening?.(firstInstant) : undefined;
  const openingSeatsMatch = startedEarlier
    ? yearOpening && all([yearOpening.lunarYear === lunarYear, sameSeat(yearOpening.annualBranch, annualBranch),
      sameSeat(yearOpening.decadalBranch, verifiedDecadal), sameSeat(yearOpening.minorBranch, verifiedMinor)])
    : all([includesFirstInstant, verifiedDecadal && verifiedMinor ? true : undefined]);
  let firstMonth: Months[number] | undefined;
  if ((includesFirstInstant === true || openingSeatsMatch === true) && firstInstant !== undefined) {
    firstMonth = startedEarlier
      ? buildQuanshuDoujunMonths({ start: firstInstant, end: firstInstant + 1 }, natal)[0]
      : months.find(row => row.data.lunarYear === lunarYear && row.data.lunarMonth === 1 && !row.data.leap && row.start === firstInstant);
  }
  const doujunBranch = doujun?.ready ? doujun.doujunBranch : undefined;
  const verifiedMonth = doujun?.ready && firstMonth?.data.ready && firstMonth.data.branch === doujunBranch
    && firstMonth.data.doujunBranch === doujunBranch && firstMonth.data.annualBranch === annualBranch
    && firstMonth.data.birthMonthBasis === doujun.birthMonthBasis && firstMonth.data.birthMonth === doujun.birthMonth
    && Date.parse(firstMonth.data.nativeStart) === firstInstant ? firstMonth.data : undefined;
  const doujunSha = atPalace(namedSha, doujunBranch);
  const mingDoujunSha = atPalace(mingNamedSha, doujunBranch);
  const doujunAnnualSha = atPalace(annualSha, doujunBranch);
  const openingCandidate = all([yearSupportCandidate, openingSeatsMatch, verifiedMonth ? true : undefined]);
  const doujunYearContrastCandidate = all([openingCandidate, seenHere(namedSha, doujunBranch)]);
  const doujunYearAnnualShaCandidate = all([openingCandidate, seenHere(annualSha, doujunBranch),
    ...yearLayers.map(row => invert(seenHere(annualSha, row.branch)))]);
  const mingYearSupportCandidate = all(yearLayers.map(row => row.mingFavorable));
  const mingOpeningCandidate = all([mingYearSupportCandidate, openingSeatsMatch, verifiedMonth ? true : undefined]);
  const doujunMingYearContrastCandidate = all([mingOpeningCandidate, seenHere(mingNamedSha, doujunBranch)]);
  const doujunMingYearAnnualShaCandidate = all([mingOpeningCandidate, seenHere(annualSha, doujunBranch),
    ...yearLayers.map(row => invert(seenHere(annualSha, row.branch)))]);
  const monthlyReviews = verifiedMonth ? months.flatMap(({ start, end, data }) => {
    const at = Math.max(start, window.start), until = Math.min(end, window.end);
    if (!data.ready || data.lunarYear !== lunarYear || data.doujunBranch !== doujunBranch
      || data.birthMonthBasis !== verifiedMonth.birthMonthBasis || data.birthMonth !== verifiedMonth.birthMonth
      || data.annualBranch !== annualBranch || at >= until) return [];
    const shaGuard = seenHere(namedSha, data.branch);
    const mingShaGuard = seenHere(mingNamedSha, data.branch);
    const annualShaGuard = seenHere(annualSha, data.branch);
    return [{ start: at, end: until, data: { profile: quanshuYearEncountersPolicy.monthReview, lunarYear,
      limitPlacementProof: quanshuLimitPlacementProof,
      doujunNamedStarLayerProof: quanshuYearEncountersPolicy.doujunNamedStarLayer,
      lunarMonth: data.lunarMonth, branch: data.branch, palaceIndex: data.palaceIndex,
      birthMonth: data.birthMonth, birthMonthBasis: data.birthMonthBasis, birthLeapMonth: data.birthLeapMonth,
      nativeStart: data.nativeStart, nativeEnd: data.nativeEnd,
      support: atPalace(namedSupport, data.branch), sha: atPalace(namedSha, data.branch),
      annualSha: atPalace(annualSha, data.branch), shaGuard, annualShaGuard,
      quanshuFixedFireBellProfile, mingSha: atPalace(mingNamedSha, data.branch), mingShaGuard,
      natalShaReviewCandidate: all([doujunYearContrastCandidate, shaGuard]),
      annualShaReviewCandidate: all([doujunYearAnnualShaCandidate, annualShaGuard]),
      mingNatalShaReviewCandidate: all([doujunMingYearContrastCandidate, mingShaGuard]),
      mingAnnualShaReviewCandidate: all([doujunMingYearAnnualShaCandidate, annualShaGuard]) } }];
  }) : [];
  return { ready: true, profile: quanshuYearEncountersPolicy.profile, lunarYear, annualBranch, decadalBranch, minorBranch,
    limitPlacementProof: quanshuLimitPlacementProof, sourceDecadal: limits.sourceDecadal,
    doujunNamedStarLayerProof: quanshuYearEncountersPolicy.doujunNamedStarLayer,
    kuXuPlacementProof: quanshuYearPolicy.kuXuPlacement,
    cries, mourningBranch, mourningAtLimits: scopeContacts(mourningBranch), cryMourningCandidate, cryMourningLimitContacts,
    cryMourningMinorCoGuardCandidate, cryMourningAnnualCoGuardCandidate,
    cryMourningLimitAspectCandidate: any(cryMourningLimitContacts.map(row => row.candidate)),
    cryMourningNanyangProfile: quanshuYearEncountersPolicy.cryingMourningNanyang,
    cryMourningNanyangMinorCandidate, cryMourningNanyangLifeCandidate, cryMourningNanyangWitnesses,
    cryMourningQuanjiProfile: quanjiLife ? quanshuYearEncountersPolicy.cryingMourningQuanji : undefined,
    cryMourningQuanjiLifeAspectCandidate,
    cryMourningQuanjiLifeWitness: cryMourningQuanjiLifeAspectCandidate === true ? quanjiLife : undefined,
    cryMourningSplitLimitsCandidate: any(splitGuards.map(row => row.candidate)),
    cryMourningSplitGuards: splitGuards.filter(row => row.candidate === true),
    cryMourningDadeSplitFourFlyingCandidate, cryMourningDadeSplitFourFlyingWitness,
    cryVoidTogetherCandidate: all([coLocated, bothVoidStarsAtLimits]), cryVoidSplitCandidate,
    cryVoidDadeFlankedDecadalCandidate, cryVoidDadeFlankedDecadalWitness,
    cryVoidMinorCoGuardCandidate, cryVoidBothStarsDoubleGuardCandidate, cryVoidBothStarsDoubleGuardWitness,
    cryVoidLimitWitnesses: cryVoidLimitContacts.filter(row => row.candidate === true),
    cryVoidSameLimitAspectCandidate: any(cryVoidLimitContacts.filter(row => row.guardScope === row.aspectScope).map(row => row.candidate)),
    cryVoidOtherLimitAspectCandidate: any(cryVoidLimitContacts.filter(row => row.guardScope !== row.aspectScope).map(row => row.candidate)),
    cryVoidExceptionCandidate, cryVoidLuCandidate: any(cries.map(row => row.guardedLu)),
    cryVoidLuAspectCandidate: any(cries.map(row => row.guardedLuAspect)),
    cryVoidNativeLuExceptionDoubleGuardCandidate, cryVoidNativeLuExceptionDoubleGuardWitness,
    cryVoidNamedPalaceDoubleGuardCandidate, cryVoidNamedPalaceDoubleGuardWitness,
    cryVoidNativeLuAtVerifiedLimitCandidate, cryVoidNamedPalaceAtVerifiedLimitCandidate,
    yearLayers, yearSupportCandidate, doujunBranch, doujunSha, doujunAnnualSha, includesFirstInstant, openingSeatsMatch, yearOpening,
    ziweiBirthAnchorVerified,
    birthMonth: verifiedMonth?.birthMonth, birthMonthBasis: verifiedMonth?.birthMonthBasis, birthLeapMonth: verifiedMonth?.birthLeapMonth,
    firstMonth: verifiedMonth && { start: verifiedMonth.nativeStart, end: verifiedMonth.nativeEnd },
    doujunYearContrastCandidate, doujunYearAnnualShaCandidate,
    quanshuFixedFireBellProfile, mingYearSupportCandidate, mingDoujunSha, doujunMingYearContrastCandidate, doujunMingYearAnnualShaCandidate,
    monthlyReviews,
  } as const;
}
