import { quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import { quanshuMajorPlacementProof, type quanshuLimitBranches } from './ziwei-limit-branches';
import { quanshuPalaceRelation } from './ziwei-quanshu';
import type { quanshuTransformLimits } from './ziwei-transform-limits';
import { quanshuVerseSeat } from './ziwei-verse-seats';

type Limits = ReturnType<typeof quanshuLimitBranches>;
type Transformations = ReturnType<typeof quanshuTransformLimits>;
type Condition = boolean | undefined;
type Relation = ReturnType<typeof quanshuPalaceRelation> | '邻宫' | undefined;
const branches = '子丑寅卯辰巳午未申酉戌亥';
const area = ['守', '冲', '三合'];
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const invert = (value: Condition) => value === undefined ? undefined : !value;
const at = (value: Relation, positions: string[]) => value === undefined ? undefined : positions.includes(value);

function flanked(focus?: string, first?: string, second?: string): Condition {
  if (!focus || !first || !second) return undefined;
  if (contact(focus, first) !== '邻宫' || contact(focus, second) !== '邻宫') return false;
  return first !== second;
}

function contact(focus?: string, target?: string): Relation {
  if (!focus || !target) return undefined;
  const distance = Math.abs(branches.indexOf(focus) - branches.indexOf(target));
  return distance === 1 || distance === 11 ? '邻宫' : quanshuPalaceRelation(focus, target);
}

export const quanshuSolarWuPoPolicy = {
  profile: 'quanshu-solar-wu-po-limit-branches-v1',
  starPlacementProof: quanshuMajorPlacementProof,
  sun: 'explicit-verse-fall-sha-and-separate-source-taboo-emitter-witnesses',
  sunTwoLimitAspect: 'two-distinct-actual-limits-aspect-the-same-sun-with-separate-sha-and-taboo-screening',
  dark: 'yuchan-weishen-phase-with-ju-men-and-separate-yang-tuo-fire-bell',
  wuqu: 'temple-with-separate-chang-contact-and-assistant-geometry',
  wuquChangAssistants: 'temple-limit-with-wenchang-in-sight-and-both-assistants-in-sight-of-wenchang',
  wuquQuan: 'same-limit-seat-and-same-frame-quan-recipient-with-separate-emitting-stems',
  pojun: 'temple-verified-chang-noble-and-named-sha-check',
  pojunChangNoble: 'wenchang-and-one-source-noble-share-a-palace-in-sight-of-temple-pojun',
  pojunPlain: 'temple-guard-with-verified-absence-of-named-sha-and-a-known-incomplete-companion-group',
} as const;

export function quanshuSolarWuPoLimits(limits: Limits, transformations: Transformations) {
  if (!limits.ready) return { ready: false } as const;
  const { lunarYear, annualBranch, decadalBranch, minorBranch, principalPositions, adverse } = limits;
  const verifiedDecadal = limits.sourceDecadal?.verified === true ? limits.sourceDecadal.branch : undefined;
  const verifiedMinor = limits.sourceMinor?.verified === true ? limits.sourceMinor.branch : undefined;
  const locate = (star: string) => ({ star, branch: principalPositions.find(row => row.star === star)?.branch });
  const sha = (name: string, stars: string[]) => {
    const rows = adverse.find(group => group.name === name)?.stars;
    return stars.map(star => ({ star: name === '归档火铃' ? '归档' + star : star, branch: rows?.find(row => row.star === star)?.branch }));
  };
  const sheep = sha('羊陀', ['擎羊', '陀罗']), fireBell = sha('归档火铃', ['火星', '铃星']);
  const subject = (star: string, branch: string | undefined, minorSeat: string | undefined, decadalSeat: string | undefined) => {
    const annualRelation = contact(branch, annualBranch), decadalRelation = contact(branch, decadalSeat), minorRelation = contact(branch, minorSeat);
    return { ...(branch ? quanshuVerseSeat(star, branch) : undefined), star, branch, annualRelation, decadalRelation, minorRelation,
      guarded: any([at(decadalRelation, ['守']), at(minorRelation, ['守'])]) } as const;
  };
  const positions = (branch: string | undefined, rows: ReadonlyArray<{ star: string; branch?: string }>) => rows.map(row => ({ ...row,
    relation: contact(branch, row.branch) } as const));
  const present = (rows: { relation: Relation }[]) => any(rows.map(row => at(row.relation, area)));

  const sun = subject('太阳', limits.birthAnchoredMajorBranches.太阳, verifiedMinor, verifiedDecadal);
  const sunAspectedByBothLimits = all([
    verifiedDecadal && verifiedMinor ? verifiedDecadal !== verifiedMinor : undefined,
    at(sun.decadalRelation, ['冲', '三合']), at(sun.minorRelation, ['冲', '三合']),
  ]);
  const matchingTransformations = transformations.ready && transformations.lunarYear === lunarYear
    && transformations.annualBranch === annualBranch && transformations.decadalBranch === decadalBranch && transformations.minorBranch === minorBranch;
  const solarGroups = matchingTransformations && (sun.guarded || sunAspectedByBothLimits)
    ? transformations.seats[0]?.groups : undefined;
  // The emitters and verified recipient positions are shared by all seats in this frame.
  // Measure the recipient against the Sun's own palace even when neither limit occupies it.
  const sunTaboos = solarGroups?.map(group => {
    const ji = group.stars.find(row => row.kind === '忌');
    return { layer: group.layer, stem: group.stem, star: ji?.star, branch: ji?.branch, relation: contact(sun.branch, ji?.branch) } as const;
  }) ?? [];
  const sunHazards = positions(sun.branch, [...sheep, ...fireBell]);
  const sunMingFixedHazards = positions(sun.branch, [...sheep, ...limits.quanshuFixedFireBell]);
  const sunHasHazard = present(sunHazards);
  const sunFallenWithSha = all([sun.verseGrade === undefined ? undefined : sun.verseGrade === '陷', sunHasHazard]);
  const sunTaboo = any(['natal', 'yearly', 'decadal', 'minor'].map(layer => at(sunTaboos.find(row => row.layer === layer)?.relation, area)));
  const sunTabooWithSha = all([sunTaboo, sunHasHazard]);
  const sunEncounter = any([sun.guarded, sunAspectedByBothLimits]);
  const sunMingFixedHasHazard = present(sunMingFixedHazards);
  const sunMingFixedFallenSha = all([sun.verseGrade === undefined ? undefined : sun.verseGrade === '陷', sunMingFixedHasHazard]);
  const sunMingFixedTabooSha = all([sunTaboo, sunMingFixedHasHazard]);
  const sunMingFixedClear = all([invert(sunMingFixedFallenSha), invert(sunMingFixedTabooSha)]);
  const sunMingNamedHazards = positions(sun.branch, [
    ...limits.verifiedNatalYangTuo, ...limits.quanshuFixedFireBell, ...sha('古空劫', ['古天空', '地劫']),
    ...['天伤', '天使'].map(star => ({ star, branch: limits.verifiedShangShi.find(row => row.star === star)?.branch })),
  ]);
  const sunMingBrightDoubleGuardCandidate = all([
    at(sun.decadalRelation, ['守']), at(sun.minorRelation, ['守']),
    sun.verseGrade === undefined ? undefined : ['庙', '旺'].includes(sun.verseGrade),
    invert(present(sunMingNamedHazards)), invert(sunTaboo),
  ]);
  const sunMingBrightDoubleGuardWitness = sunMingBrightDoubleGuardCandidate === true ? {
    branch: sun.branch, grade: sun.verseGrade, hazards: sunMingNamedHazards, taboos: sunTaboos,
  } : undefined;
  const sunTabooShaSharedPalaces = sunEncounter === true ? sunTaboos.flatMap(taboo => area.includes(taboo.relation ?? '')
    ? sunHazards.filter(sha => sha.branch === taboo.branch).map(sha => ({ ...taboo, sha: sha.star })) : []) : [];
  const sunConditionsClear = all([invert(sunFallenWithSha), invert(sunTabooWithSha)]);
  const sunDarkWitness = positions(sun.branch, [{ star: '巨门', branch: limits.birthAnchoredMajorBranches.巨门 }])[0];
  const sunMingDimPairDoubleGuard = all([sun.solarPhase === undefined ? undefined : sun.solarPhase === '偏垣',
    at(sunDarkWitness.relation, ['守']), at(sun.decadalRelation, ['守']), at(sun.minorRelation, ['守'])]);
  const sunDarkVerifiedYangTuo = positions(sun.branch, limits.verifiedNatalYangTuo);
  const sunDarkBase = all([sun.guarded, sun.solarPhase === undefined ? undefined : sun.solarPhase === '偏垣',
    at(sunDarkWitness.relation, area), present(sunDarkVerifiedYangTuo)]);
  const sunDarkCandidate = all([sunDarkBase, present(positions(sun.branch, fireBell))]);
  const sunDarkQuanshuFixedFireBell = positions(sun.branch, limits.quanshuFixedFireBell);
  const sunDarkQuanshuFixedCandidate = all([sunDarkBase, present(sunDarkQuanshuFixedFireBell)]);
  const [darkFire, darkBell] = sunDarkQuanshuFixedFireBell;
  // 明刊本章列未申为偏垣。巨门与该段太阳同宫时只落申，定宫火星可从寅冲入，定宫铃星不在守冲三合内。
  const sunDarkMingDoubleGuardCandidate = all([sunMingDimPairDoubleGuard, present(sunDarkVerifiedYangTuo),
    at(darkFire.relation, ['冲']), invert(at(darkBell.relation, area))]);
  const sunDarkMingDoubleGuardWitness = sunDarkMingDoubleGuardCandidate === true ? {
    branch: sun.branch, jumen: sunDarkWitness, fire: darkFire, bell: darkBell,
    yangTuo: sunDarkVerifiedYangTuo.filter(row => at(row.relation, area)),
  } : undefined;

  const wu = subject('武曲', limits.verifiedWuquBranch, verifiedMinor, verifiedDecadal);
  const chang = locate('文昌');
  const wuChang = positions(wu.branch, [chang])[0];
  const wuLiteraryPair = [wuChang, positions(wu.branch, [locate('文曲')])[0]];
  const wuAssistants = positions(wu.branch, ['左辅', '右弼'].map(locate))
    .map(row => ({ ...row, changRelation: contact(chang.branch, row.branch) } as const));
  const wuTemple = all([wu.guarded, wu.verseGrade === undefined ? undefined : wu.verseGrade === '庙']);
  const wuMingTempleChangQuCandidate = all([wuTemple, ...wuLiteraryPair.map(row => at(row.relation, ['守']))]);
  const wuChangContact = at(wuChang.relation, area);
  const wuChangNeighbor = at(wuChang.relation, ['邻宫']);
  const wuChangAssistants = all([wuChangContact, ...wuAssistants.map(row => at(row.changRelation, area))]);
  const wuTempleMingCoSeatedCompanionsAtDoubleGuard = all([wuTemple,
    at(wu.decadalRelation, ['守']), at(wu.minorRelation, ['守']),
    ...wuAssistants.map(row => at(row.changRelation, ['守']))]);
  const wuTempleMingChangFuBiDoubleGuardCandidate = all([wuTempleMingCoSeatedCompanionsAtDoubleGuard, at(wuChang.relation, ['守'])]);
  const wuTempleMingChangFuBiOpposedDoubleGuardCandidate = all([wuTempleMingCoSeatedCompanionsAtDoubleGuard, at(wuChang.relation, ['冲'])]);
  const wuTempleMingChangFuBiOpposedDoubleGuardWitness = wuTempleMingChangFuBiOpposedDoubleGuardCandidate === true
    ? { wuBranch: wu.branch, chang: wuChang, assistants: wuAssistants } : undefined;
  const wuTempleChangFlankedCandidate = all([wuTemple, wuChangContact,
    flanked(chang.branch, wuAssistants[0].branch, wuAssistants[1].branch)]);
  const wuQuanChecks = matchingTransformations ? transformations.seats.filter(seat => seat.branch === wu.branch
    && (seat.layer === 'minor' ? verifiedMinor : verifiedDecadal) === seat.branch)
    .flatMap(seat => seat.groups.map(group => {
      const quan = group.stars.find(row => row.kind === '权');
      const candidate = group.layer === 'decadal' && verifiedDecadal === undefined ? undefined
        : quan && all([quan.star === '武曲', at(contact(seat.branch, quan.branch), ['守'])]);
      return { scope: seat.layer, layer: group.layer, stem: group.stem, branch: quan?.branch, candidate };
    })) : [];
  const wuQuanAtLimitCandidate = all([wu.guarded, wuQuanChecks.length ? any(wuQuanChecks.map(row => row.candidate)) : undefined]);
  const wuQuanWitnesses = wuQuanChecks.filter(row => row.candidate === true).map(({ scope, layer, stem, branch }) => ({ scope, layer, stem, branch }));
  const wuQuanScopeCandidates = (['decadal', 'minor'] as const).map(scope => {
    const checks = wuQuanChecks.filter(row => row.scope === scope);
    const natal = checks.find(row => row.layer === 'natal');
    const natalQuan = natal?.stem === undefined ? undefined : natal.stem === '庚' && natal.candidate;
    return { scope, candidate: checks.length ? any(checks.map(row => row.candidate)) : undefined, natalQuan };
  });
  const wuQuanAssistedCandidate = all([wuQuanAtLimitCandidate, ...wuAssistants.map(row => at(row.relation, area))]);

  const po = subject('破军', limits.verifiedPojunBranch, verifiedMinor, verifiedDecadal);
  const poChang = positions(po.branch, [chang])[0];
  const poNobles = positions(po.branch, limits.verifiedBellNatalAid.filter(row => row.star === '魁钺组'))
    .map(row => ({ ...row, changRelation: contact(chang.branch, row.branch) } as const));
  const poBlades = positions(po.branch, limits.verifiedNatalYangTuo);
  const poHazards = [...poBlades, ...positions(po.branch, fireBell)];
  const poTemple = all([po.guarded, po.verseGrade === undefined ? undefined : po.verseGrade === '庙']);
  const poCompanions = all([at(poChang.relation, area), present(poNobles)]);
  const poJoinedNoble = any(poNobles.map(row => all([at(row.relation, area), at(row.changRelation, ['守'])])));
  const poBothNobles = all([at(poChang.relation, area), ...poNobles.map(row => at(row.relation, area))]);
  const poHasHazard = present(poHazards);
  const poLianzhen = positions(po.branch, [{ star: '廉贞', branch: limits.verifiedLianzhenBranch }])[0];
  const poMingFireBell = positions(po.branch, limits.quanshuFixedFireBell);
  const poTempleMingHazards = [...poBlades, ...poMingFireBell];
  const poTempleMingNamedShaClearCandidate = all([poTemple, invert(present(poTempleMingHazards))]);
  const poMingJoinedNoblePlacementProof = poJoinedNoble === true ? 'quanshu-ming-chang-noble-auxiliary-layer-v1' : undefined;
  const poTempleMingJoinedSupportCandidate = all([poTempleMingNamedShaClearCandidate, poJoinedNoble]);
  const poTempleMingJoinedBothNoblesCandidate = all([poTempleMingJoinedSupportCandidate,
    ...poNobles.map(row => at(row.relation, area))]);
  const poTempleMingChangTwoNoblesDistinctTrineDoubleGuardCandidate = all([poTempleMingNamedShaClearCandidate,
    at(po.decadalRelation, ['守']), at(po.minorRelation, ['守']), at(poChang.relation, ['三合']),
    ...poNobles.map(row => all([at(row.relation, ['守', '三合']), at(row.changRelation, ['三合'])]))]);
  const poTempleMingChangTwoNoblesDistinctTrineDoubleGuardWitness = poTempleMingChangTwoNoblesDistinctTrineDoubleGuardCandidate === true
    ? { poBranch: po.branch, chang: poChang, nobles: poNobles } : undefined;
  const poFallenMingBladeFireBellCandidate = all([po.guarded, po.verseGrade === undefined ? undefined : po.verseGrade === '陷',
    at(poLianzhen.relation, ['守']), any(poBlades.map(row => at(row.relation, ['守']))),
    any(poMingFireBell.map(row => at(row.relation, ['守'])))]);
  const poFallenMingBladeFireBellWitness = poFallenMingBladeFireBellCandidate === true ? {
    branch: po.branch, grade: '陷',
    coGuards: [poLianzhen, ...poBlades, ...poMingFireBell].filter(row => row.relation === '守').map(({ star, branch }) => ({ star, branch })),
  } : undefined;

  return { ready: true, profile: quanshuSolarWuPoPolicy.profile, lunarYear, annualBranch, decadalBranch, minorBranch,
    starPlacementProof: limits.starPlacementProof, limitPlacementProof: limits.limitPlacementProof,
    ziweiBirthAnchorVerified: limits.ziweiBirthAnchorVerified,
    sourceDecadal: limits.sourceDecadal, sourceMinor: limits.sourceMinor,
    sun, sunTaboos, sunHazards, sunDarkWitness, sunDarkCandidate, sunTabooShaSharedPalaces,
    quanshuFixedFireBellProfile, sunDarkQuanshuFixedFireBell, sunDarkQuanshuFixedCandidate,
    sunMingDimPairDoubleGuard, sunDarkMingDoubleGuardCandidate, sunDarkMingDoubleGuardWitness,
    sunHarmoniousCandidate: all([sun.guarded, sunConditionsClear]),
    sunTwoLimitAspectCandidate: all([sunAspectedByBothLimits, sunConditionsClear]),
    sunFallenShaCandidate: all([sunEncounter, sunFallenWithSha]), sunTabooShaCandidate: all([sunEncounter, sunTabooWithSha]),
    sunMingFixedHazards,
    sunMingBrightDoubleGuardCandidate, sunMingBrightDoubleGuardWitness,
    sunMingFixedHarmoniousCandidate: all([sun.guarded, sunMingFixedClear]),
    sunMingFixedTwoLimitAspectCandidate: all([sunAspectedByBothLimits, sunMingFixedClear]),
    sunMingFixedFallenShaCandidate: all([sunEncounter, sunMingFixedFallenSha]),
    sunMingFixedTabooShaCandidate: all([sunEncounter, sunMingFixedTabooSha]),
    wu, wuChang, wuAssistants, wuTempleAtVerifiedLimitCandidate: wuTemple,
    wuTempleChangCandidate: all([wuTemple, wuChangContact]),
    wuTempleChangNeighborCandidate: all([wuTemple, wuChangNeighbor]),
    wuTemplePlainCandidate: all([wuTemple, invert(any([wuChangContact, wuChangNeighbor]))]),
    wuTempleChangAssistantsCandidate: all([wuTemple, wuChangAssistants]), wuTempleChangFlankedCandidate,
    wuTempleMingChangFuBiDoubleGuardCandidate,
    wuTempleMingChangFuBiOpposedDoubleGuardCandidate, wuTempleMingChangFuBiOpposedDoubleGuardWitness,
    wuMingTempleChangQuCandidate, wuLiteraryPair,
    wuQuanAtLimitCandidate, wuQuanWitnesses, wuQuanScopeCandidates, wuQuanAssistedCandidate,
    po, poChang, poNobles, poHazards, poTempleAtVerifiedLimitCandidate: poTemple,
    poTemplePlainCandidate: all([poTemple, invert(poCompanions), invert(poHasHazard)]),
    poTempleSupportCandidate: all([poTemple, poCompanions, invert(poHasHazard)]),
    poTempleJoinedSupportCandidate: all([poTemple, poJoinedNoble, invert(poHasHazard)]),
    poTempleBothNoblesCandidate: all([poTemple, poBothNobles, invert(poHasHazard)]),
    poTempleAdverseCandidate: all([poTemple, poHasHazard]),
    poTempleMingNamedShaClearCandidate, poTempleMingJoinedSupportCandidate, poTempleMingJoinedBothNoblesCandidate,
    poTempleMingChangTwoNoblesDistinctTrineDoubleGuardCandidate, poTempleMingChangTwoNoblesDistinctTrineDoubleGuardWitness,
    poMingJoinedNoblePlacementProof, poTempleMingHazards,
    poFallenMingBladeFireBellCandidate, poFallenMingBladeFireBellWitness,
  } as const;
}
