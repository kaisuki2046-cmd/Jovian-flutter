import type { quanshuBodyLimitEncounters } from './ziwei-body-limit-encounters';
import { archivedFireBellPlacementProof, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import type { quanshuLimitTiming } from './ziwei-limit-timing';
import { quanshuLimitBranchesPolicy, type quanshuLimitBranches } from './ziwei-limit-branches';
import type { quanshuLimitVerseContacts } from './ziwei-limit-verse-contacts';
import type { quanshuSolarWuPoLimits } from './ziwei-solar-wu-po-limits';
import { quanshuSupportPolicy, type quanshuMingGroupsFromVerifiedLimits, type quanshuSupportCondition } from './ziwei-source-support';
import { quanshuTransformLimitPolicy, type quanshuTransformLimits } from './ziwei-transform-limits';
import { quanshuXingJiTigerPolicy, type quanshuXingJiTiger } from './ziwei-xing-ji-tiger';

type Timing = ReturnType<typeof quanshuLimitTiming>[number]['data'];
type Star = Timing['verifiedStarTimings'][number]['star'];
type GuardScope = Timing['halves'][number]['scope'];
type State = boolean | undefined;
type Ready<T> = Extract<T, { ready: true }>;
type Wu = Ready<ReturnType<typeof quanshuSolarWuPoLimits>>;
type Body = Ready<ReturnType<typeof quanshuBodyLimitEncounters>>;
type Verse = Ready<ReturnType<typeof quanshuLimitVerseContacts>>;
type Xing = ReturnType<typeof quanshuXingJiTiger>;
type Support = ReturnType<typeof quanshuSupportCondition>;
type Transforms = ReturnType<typeof quanshuTransformLimits>;
type Branches = Ready<ReturnType<typeof quanshuLimitBranches>>;

export const quanshuTimedLimitProfile = 'quanshu-north-south-limit-binding-v1';
export const quanshuTimedLimitFactType = 'quanshu_timed_limit_condition';
const verifiedLimit = (timing: Timing, scope: GuardScope) => scope === 'minor'
  ? timing.sourceMinorVerified === true : timing.sourceDecadalVerified === true;

function bindStar(timing: Timing, star: Star, branch?: string, scope?: GuardScope) {
  const phase = timing.verifiedStarTimings.find(row => row.star === star)!;
  const verified = branch === undefined || phase.branch === undefined ? undefined : branch === phase.branch;
  const active = timing.halves.filter(seat => phase.activeScopes.includes(seat.scope) && seat.branch === branch
    && (scope === undefined || seat.scope === scope));
  const selectedSeat = scope && timing.halves.find(seat => seat.scope === scope);
  const needsLimitVerification = scope !== undefined && !verifiedLimit(timing, scope);
  const scopedKnown = selectedSeat && selectedSeat.branch !== undefined
    && (selectedSeat.branch !== phase.branch || selectedSeat.half !== undefined);
  const activeInSourceHalf = needsLimitVerification ? undefined : verified !== true ? verified : active.length > 0 ? true
    : scope ? scopedKnown ? false : undefined : phase.candidate;
  return { star, branch, starGroup: phase.group, activeInSourceHalf, guardScopes: active.map(row => row.scope) };
}

function namedCondition(timing: Timing, binding: Omit<ReturnType<typeof bindStar>, 'star'> & { star: Star | '铃星' },
  sourceFactType: string, sourceProfile: string,
  candidates: Record<string, State | string>) {
  return { profile: quanshuTimedLimitProfile, ready: true, lunarYear: timing.lunarYear, sourceFactType, sourceProfile,
    limitPlacementProof: timing.limitPlacementProof, starPlacementProof: timing.starPlacementProof,
    ...binding, ...candidates };
}

function unverifiedCondition(timing: Timing, binding: ReturnType<typeof bindStar>, sourceFactType: string, sourceProfile: string) {
  // A missing source still owns this star and scope. Unrelated timed facts do not disprove it.
  return { ...namedCondition(timing, binding, sourceFactType, sourceProfile, {}), ready: undefined };
}

function verifiedDoubleGuard(binding: ReturnType<typeof bindStar>, candidate: State): State {
  if (candidate !== true) return candidate;
  return binding.activeInSourceHalf === undefined ? undefined : binding.guardScopes.length === 2;
}

export function quanshuTimedWu(timing: Timing, context: Wu) {
  const binding = bindStar(timing, '武曲', context.wu.branch);
  const activeChecks = context.wuQuanScopeCandidates.filter(row => binding.guardScopes.includes(row.scope));
  const checks = activeChecks.map(row => row.candidate);
  const quanInActiveScope = checks.includes(true) ? true : checks.includes(undefined) ? undefined : false;
  const natalChecks = activeChecks.map(row => row.natalQuan);
  const natalQuanInActiveScope = binding.activeInSourceHalf !== true ? binding.activeInSourceHalf
    : natalChecks.includes(true) ? true : natalChecks.includes(undefined) || natalChecks.length === 0 ? undefined : false;
  const natalQuanWithLiteraryAid = [natalQuanInActiveScope, context.wuMingTempleChangQuCandidate];
  const wuNatalQuanMingChangQuAtActiveLimitCandidate = natalQuanWithLiteraryAid.includes(false) ? false
    : natalQuanWithLiteraryAid.includes(undefined) ? undefined : true;
  const quanIfActive = (prior: State) => binding.activeInSourceHalf !== true || prior === false ? prior
    : quanInActiveScope === true ? prior : quanInActiveScope;
  const opposed = verifiedDoubleGuard(binding, context.wuTempleMingChangFuBiOpposedDoubleGuardCandidate);
  return { ...namedCondition(timing, binding, 'quanshu_solar_wu_po_limits', context.profile, {
    starPlacementProof: context.starPlacementProof,
    wuTempleAtVerifiedLimitCandidate: context.wuTempleAtVerifiedLimitCandidate,
    wuTempleChangFlankedCandidate: context.wuTempleChangFlankedCandidate,
    wuTemplePlainCandidate: context.wuTemplePlainCandidate,
    wuTempleChangCandidate: context.wuTempleChangCandidate,
    wuTempleChangNeighborCandidate: context.wuTempleChangNeighborCandidate,
    wuTempleChangAssistantsCandidate: context.wuTempleChangAssistantsCandidate,
    wuTempleMingChangFuBiDoubleGuardCandidate: verifiedDoubleGuard(binding, context.wuTempleMingChangFuBiDoubleGuardCandidate),
    wuTempleMingChangFuBiOpposedDoubleGuardCandidate: opposed,
    wuQuanAtLimitCandidate: quanIfActive(context.wuQuanAtLimitCandidate),
    wuNatalQuanAtActiveLimitCandidate: natalQuanInActiveScope,
    namedAuxiliaryLayerProof: quanshuSupportPolicy.namedAuxiliaryLayer,
    wuNatalQuanMingChangQuAtActiveLimitCandidate,
    wuQuanAssistedCandidate: quanIfActive(context.wuQuanAssistedCandidate),
  }), wuTempleMingChangFuBiOpposedDoubleGuardWitness: opposed === true ? context.wuTempleMingChangFuBiOpposedDoubleGuardWitness : undefined,
  wuNatalQuanMingChangQuWitness: wuNatalQuanMingChangQuAtActiveLimitCandidate === true ? {
    branch: context.wu.branch, stem: '庚', assistants: context.wuLiteraryPair,
  } : undefined };
}

export function quanshuTimedPo(timing: Timing, context: Wu) {
  const binding = bindStar(timing, '破军', context.po.branch);
  const distinctTrine = verifiedDoubleGuard(binding, context.poTempleMingChangTwoNoblesDistinctTrineDoubleGuardCandidate);
  return { ...namedCondition(timing, binding, 'quanshu_solar_wu_po_limits', context.profile, {
    starPlacementProof: context.starPlacementProof,
    archivedFireBellPlacementProof,
    poTempleAtVerifiedLimitCandidate: context.poTempleAtVerifiedLimitCandidate,
    poTempleBothNoblesCandidate: context.poTempleBothNoblesCandidate,
    poTempleJoinedSupportCandidate: context.poTempleJoinedSupportCandidate,
    poTempleSupportCandidate: context.poTempleSupportCandidate,
    poTemplePlainCandidate: context.poTemplePlainCandidate,
    quanshuFixedFireBellProfile: context.quanshuFixedFireBellProfile,
    poTempleMingNamedShaClearCandidate: context.poTempleMingNamedShaClearCandidate,
    poTempleMingJoinedSupportCandidate: context.poTempleMingJoinedSupportCandidate,
    poMingJoinedNoblePlacementProof: context.poMingJoinedNoblePlacementProof,
    poTempleMingJoinedBothNoblesCandidate: context.poTempleMingJoinedBothNoblesCandidate,
    poTempleMingChangTwoNoblesDistinctTrineDoubleGuardCandidate: distinctTrine,
    poFallenMingBladeFireBellCandidate: context.poFallenMingBladeFireBellCandidate,
  }), poChang: context.poChang, poNobles: context.poNobles, poHazards: context.poHazards,
  poTempleMingHazards: binding.activeInSourceHalf === true && context.poTempleAtVerifiedLimitCandidate === true
    ? context.poTempleMingHazards : undefined,
  poTempleMingChangTwoNoblesDistinctTrineDoubleGuardWitness: distinctTrine === true
    ? context.poTempleMingChangTwoNoblesDistinctTrineDoubleGuardWitness : undefined,
  poFallenMingBladeFireBellWitness: binding.activeInSourceHalf === true ? context.poFallenMingBladeFireBellWitness : undefined };
}

export function quanshuTimedTempleChangQu(timing: Timing, context: Branches) {
  if (!['己', '辛', '壬'].includes(context.birthStem)) return [];
  const sharedGuards = context.changQu.flatMap(({ star, branch, templeBothLimitsMeet, decadalRelation, minorRelation }) => {
    if ((star !== '文昌' && star !== '文曲') || templeBothLimitsMeet !== true
      || decadalRelation !== '守' || minorRelation !== '守') return [];
    const binding = bindStar(timing, star, branch);
    if (binding.guardScopes.length !== 2) return [];
    const candidate = star === '文昌' ? 'wenchangTempleDoubleGuardCandidate' : 'wenquTempleDoubleGuardCandidate';
    return [namedCondition(timing, binding, 'quanshu_limit_branches', quanshuLimitBranchesPolicy.profile,
      { [candidate]: true })];
  });
  const [chang, qu] = context.changQu;
  if (chang.grade !== '庙' || qu.grade !== '庙' || chang.branch === qu.branch) return sharedGuards;
  const southern = bindStar(timing, '文昌', chang.branch), northern = bindStar(timing, '文曲', qu.branch);
  const [changScope] = southern.guardScopes, [quScope] = northern.guardScopes;
  if (changScope === undefined || quScope === undefined || changScope === quScope) return sharedGuards;
  return [...sharedGuards, { profile: quanshuTimedLimitProfile, ready: true, lunarYear: timing.lunarYear,
    sourceFactType: 'quanshu_limit_branches', sourceProfile: quanshuLimitBranchesPolicy.profile,
    limitPlacementProof: timing.limitPlacementProof, activeInSourceHalf: true,
    templeChangQuSplitDoubleGuardCandidate: true,
    templeChangQuSplitDoubleGuardWitness: { birthStem: context.birthStem, chang: { branch: chang.branch, scope: changScope },
      qu: { branch: qu.branch, scope: quScope } } }];
}

export function quanshuTimedTianji(timing: Timing, context: Transforms) {
  const source = 'quanshu_transform_limits';
  if (!context.ready) {
    const branch = timing.verifiedStarTimings.find(row => row.star === '天机')?.branch;
    return unverifiedCondition(timing, bindStar(timing, '天机', branch), source, quanshuTransformLimitPolicy.profile);
  }
  const binding = bindStar(timing, '天机', context.seats[0]?.tianji.branch);
  const groups = context.seats.filter(seat => seat.branch === binding.branch && binding.guardScopes.some(scope => scope === seat.layer))
    .map(seat => ({ scope: seat.layer, group: seat.groups.find(group => group.layer === 'natal') }));
  const any = (states: State[]) => states.includes(true) ? true
    : states.length === 0 || states.includes(undefined) ? undefined : false;
  const support = (states: State[]) => binding.activeInSourceHalf === true ? any(states) : binding.activeInSourceHalf;
  const verifiedTianji = timing.verifiedStarTimings.find(row => row.star === '天机')?.branch;
  const aspectSeats = (['decadal', 'minor'] as const).map(scope => {
    const seat = context.seats.find(row => row.layer === scope);
    const limit = timing.halves.find(row => row.scope === scope);
    return verifiedLimit(timing, scope) && seat?.branch === limit?.branch
      && verifiedTianji !== undefined && seat?.tianji.branch === verifiedTianji
      && (scope !== 'minor' || context.sourceMinor?.verified === true) ? seat : undefined;
  });
  // The Ming verse first names Tianji reflecting the limit, then strengthens the case with Yang, Tuo and Jumen.
  const tianjiPlainOppositionCandidate = any(aspectSeats.map(seat => seat?.tianji.relation === undefined
    ? undefined : seat.tianji.relation === '冲'));
  const tianjiPlainOppositionWitnesses = aspectSeats.flatMap(seat => seat?.tianji.relation === '冲'
    ? [{ scope: seat.layer, branch: seat.branch, tianjiBranch: seat.tianji.branch }] : []);
  const tianjiNatalShaOpposedCandidate = any(aspectSeats.map(seat => seat?.tianji.relation === undefined
    ? undefined : seat.tianji.relation === '冲' ? seat.tianjiNatalYangTuo : false));
  const [decade, minor] = aspectSeats;
  const knownNonTrine = aspectSeats.some(seat => seat?.tianji.relation !== undefined && seat.tianji.relation !== '三合');
  const tianjiDualTrineLimitCandidate = knownNonTrine ? false
    : decade?.tianji.relation === '三合' && minor?.tianji.relation === '三合' ? decade.branch !== minor.branch : undefined;
  const tianjiDualTrineLimitWitness = tianjiDualTrineLimitCandidate === true && decade && minor
    ? { tianjiBranch: verifiedTianji, decadalBranch: decade.branch, minorBranch: minor.branch } : undefined;
  const tianjiSupportWitnesses = groups.flatMap(({ scope, group }) => {
    if (!group || (group.tianjiSanHua !== true && group.tianjiLucunKeQuan !== true)) return [];
    return [{ scope, stem: group.stem, stars: group.stars.filter(row => row.kind === '科' || row.kind === '权'
      || row.kind === '禄' && group.tianjiSanHua === true),
      lucun: group.tianjiLucunKeQuan === true ? group.tianjiLucun : undefined }];
  });
  const tianjiAspectWitnesses = aspectSeats.flatMap(seat => {
    if (!seat) return [];
    const layers = [
      { layer: 'natal', matches: seat.tianjiNatalYangTuo, names: ['擎羊', '陀罗'] },
      { layer: 'yearly', matches: seat.tianjiYearYangTuo, names: ['流年擎羊', '流年陀罗'] },
    ];
    return layers.filter(row => row.matches === true).map(({ layer, names }) => ({
      scope: seat.layer, branch: seat.branch, layer, tianji: seat.tianji, jumen: seat.jumen,
      sha: seat.hazards.filter(row => names.includes(row.star)),
    }));
  });
  return { ...namedCondition(timing, binding, source, context.profile, {
    tianjiNatalSanHuaCandidate: support(groups.map(row => row.group?.tianjiSanHua)),
    tianjiNatalLucunKeQuanCandidate: support(groups.map(row => row.group?.tianjiLucunKeQuan)),
    // The recorded compatibility table uses Taiyin Ke for Geng, while the Ming edition uses Tiantong.
    tianjiMingNatalLucunKeQuanDoubleGuardCandidate: verifiedDoubleGuard(binding,
      support(groups.map(({ group }) => group?.stem === '庚' ? false : group?.tianjiLucunKeQuan))),
    tianjiNatalLucunPlacementProof: context.tianjiNatalLucunPlacementProof,
    tianjiShaAspectCandidate: any(aspectSeats.map(seat => seat && any([seat.tianjiNatalYangTuo, seat.tianjiYearYangTuo]))),
    tianjiPlainOppositionCandidate, tianjiNatalShaOpposedCandidate, tianjiDualTrineLimitCandidate,
  }), tianjiSupportWitnesses, tianjiAspectWitnesses, tianjiPlainOppositionWitnesses, tianjiDualTrineLimitWitness };
}

export function quanshuTimedBody(timing: Timing, context: Body) {
  const source = 'quanshu_body_limit_encounters', profile = context.profile;
  const tanlang = bindStar(timing, '贪狼', context.tanlang.branch);
  const tanlangXingJiChecks = [
    context.tanlangNatalXingJiCandidate,
    context.tanlangMingNatalYangTuoJiCandidate,
    bindStar(timing, '贪狼', context.tanlang.branch, 'decadal').activeInSourceHalf,
    bindStar(timing, '贪狼', context.tanlang.branch, 'minor').activeInSourceHalf,
  ];
  const tanlangMingDoubleGuardXingJiCandidate = tanlangXingJiChecks.includes(false) ? false
    : tanlangXingJiChecks.includes(undefined) ? undefined : true;
  const tanlangMingDoubleGuardXingJiWitness = tanlangMingDoubleGuardXingJiCandidate === true && context.tanlangMingNatalYangTuoJiWitness ? {
    ...context.tanlangMingNatalYangTuoJiWitness,
    tianxing: { star: '天刑', branch: context.tianxingBranch, relation: context.tanlangXing },
  } : undefined;
  const qisha = bindStar(timing, '七杀', context.qisha.branch);
  const qishaMinor = bindStar(timing, '七杀', context.qisha.branch, 'minor');
  const qishaJielanMinorFlowShaCandidate = context.qishaJielanMinorFlowShaCandidate === true
    ? qishaMinor.activeInSourceHalf : context.qishaJielanMinorFlowShaCandidate;
  return [
    { ...namedCondition(timing, tanlang, source, profile, {
      tianxingPlacementProof: context.tianxingPlacementProof,
      tanlangNatalXingJiCandidate: context.tanlangNatalXingJiCandidate,
      tanlangYearXingJiCandidate: context.tanlangYearXingJiCandidate,
      tanlangMingNatalYangJiAspectCandidate: context.tanlangMingNatalYangJiAspectCandidate,
      tanlangMingNatalYangTuoJiCandidate: context.tanlangMingNatalYangTuoJiCandidate,
      tanlangMingXingJiAliasesCandidate: context.tanlangMingXingJiAliasesCandidate,
      tanlangMingDoubleGuardXingJiCandidate,
    }), tanlangMingNatalYangJiAspectWitness: tanlang.activeInSourceHalf === true ? context.tanlangMingNatalYangJiAspectWitness : undefined,
    tanlangMingNatalYangTuoJiWitness: tanlang.activeInSourceHalf === true ? context.tanlangMingNatalYangTuoJiWitness : undefined,
    tanlangMingXingJiAliasesWitness: tanlang.activeInSourceHalf === true ? context.tanlangMingXingJiAliasesWitness : undefined,
    tanlangMingDoubleGuardXingJiWitness },
    { ...namedCondition(timing, qisha, source, profile, {
      qishaPlainLimitCandidate: qishaJielanMinorFlowShaCandidate === true ? false : context.qishaPlainLimitCandidate,
      qishaImperialLuCandidate: context.qishaImperialLuBodyLifeConflictCandidate === true ? false : context.qishaImperialLuCandidate,
      qishaImperialLuBodyLifeConflictCandidate: context.qishaImperialLuBodyLifeConflictCandidate,
      qishaFlowShaCandidate: context.qishaFlowShaCandidate,
      qishaAnnualTigerGuardCandidate: context.qishaAnnualTigerGuardCandidate,
      jielanFlowShaProfile: context.jielanFlowShaProfile,
      qishaJielanMinorFlowShaCandidate,
    }), jielanShaBranches: qishaJielanMinorFlowShaCandidate === true ? context.jielanShaBranches : undefined,
    qishaImperialLuBodyLifeConflictWitness: qisha.activeInSourceHalf === true ? context.qishaImperialLuBodyLifeConflictWitness : undefined },
  ];
}

export function quanshuTimedTong(timing: Timing, context: Verse) {
  const binding = bindStar(timing, '天同', context.tong.branch);
  const voidsOpposed = verifiedDoubleGuard(binding, context.tongFallenVoidsOpposedAtTaiSuiDoubleGuardCandidate);
  const natalJiOpposed = verifiedDoubleGuard(binding, context.tongFallenNatalJiOpposedAtTaiSuiDoubleGuardCandidate);
  return { ...namedCondition(timing, binding, 'quanshu_limit_verse_contacts', context.profile, {
    archivedFireBellPlacementProof,
    tongSupportCandidate: context.tongSupportCandidate,
    tongFallenOpposedCandidate: context.tongFallenOpposedCandidate,
    tongFallenAnnualOpposedCandidate: context.tongFallenAnnualOpposedCandidate,
    tongFallenAnnualOpposedAtTaiSuiCandidate: context.tongFallenAnnualOpposedAtTaiSuiCandidate,
    tongFallenVoidsOpposedCandidate: context.tongFallenVoidsOpposedCandidate,
    tongFallenVoidsOpposedAtTaiSuiDoubleGuardCandidate: voidsOpposed,
    tongFallenNatalJiOpposedAtTaiSuiDoubleGuardCandidate: natalJiOpposed,
    tongFallenJiOpposedCandidate: context.tongFallenJiOpposedCandidate,
  }), tongFallenVoidsOpposedAtTaiSuiDoubleGuardWitness: voidsOpposed === true
    ? context.tongFallenVoidsOpposedAtTaiSuiDoubleGuardWitness : undefined,
    tongFallenNatalJiOpposedAtTaiSuiDoubleGuardWitness: natalJiOpposed === true
      ? context.tongFallenNatalJiOpposedAtTaiSuiDoubleGuardWitness : undefined };
}

export function quanshuTimedBell(timing: Timing, context: Verse) {
  const editions = [['archive', context], ['jielan', context.jielanBell], ['nanyang', context.quanshuFixedBell]] as const;
  const principalAidVerified = timing.ziweiBirthAnchorVerified === true;
  const visible = (row: { relation?: string }) => row.relation === '守' || row.relation === '冲' || row.relation === '三合';
  const cases = editions.map(([edition, verse]) => {
    const { branch } = verse.bell;
    const guards = timing.halves.map(seat => {
      const active = !verifiedLimit(timing, seat.scope) || branch === undefined || seat.branch === undefined ? undefined
        : branch !== seat.branch ? false : seat.half === undefined ? undefined : seat.half === 'second';
      return { scope: seat.scope, active };
    });
    const guardScopes = guards.filter(row => row.active === true).map(row => row.scope);
    const activeInSourceHalf = guardScopes.length > 0 ? true : guards.some(row => row.active === undefined) ? undefined : false;
    const doubleGuard = guards.some(row => row.active === false) ? false : guardScopes.length === 2 ? true : undefined;
    const inActiveWindow = (candidate: State) => candidate === false || activeInSourceHalf === false ? false
      : candidate === true && activeInSourceHalf === true ? true : undefined;
    const namedAid = (principalAidVerified ? [verse.bellTanlang, verse.bellWuqu, ...verse.bellSupport]
      : verse.bellSupport.filter(row => row.star === '左辅' || row.star === '右弼')).filter(visible);
    const namedAidPresent = namedAid.length > 0 ? true : principalAidVerified ? verse.bellWithNamedSupportCandidate : undefined;
    const withoutNamedSupport = inActiveWindow(namedAid.length > 0 || verse.bellAdditionalAid.some(visible)
      ? false : principalAidVerified ? verse.bellWithoutNamedSupportCandidate : undefined);
    const tanlangSamePalaceCandidate = inActiveWindow(principalAidVerified ? verse.bellTanlangAtLimitCandidate : undefined);
    const templeFullNamedSupportCandidate = inActiveWindow(principalAidVerified ? verse.bellTempleFullSupportCandidate : undefined);
    const support = tanlangSamePalaceCandidate === true || templeFullNamedSupportCandidate === true ? {
      edition, branch, guardScopes,
      tanlang: tanlangSamePalaceCandidate === true ? verse.bellTanlang : undefined,
      templeNamedSupport: templeFullNamedSupportCandidate === true ? namedAid : undefined,
    } : undefined;
    return { window: { edition, branch, guardScopes, activeInSourceHalf, withoutNamedSupport,
      tanlangSamePalaceCandidate, templeFullNamedSupportCandidate }, doubleGuard, namedAid, namedAidPresent, support };
  });
  const states = cases.map(row => row.window);
  const [archive, jielan, nanyang] = states;
  const fixed = cases[2];
  const quanshuFixedBellDoubleGuardWithNamedAidCandidate = fixed.doubleGuard === false || fixed.namedAidPresent === false
    ? false : fixed.doubleGuard === true && fixed.namedAidPresent === true ? true : undefined;
  const bellMingDoubleGuardAidWitness = quanshuFixedBellDoubleGuardWithNamedAidCandidate === true ? {
    branch: nanyang.branch, assists: fixed.namedAid,
  } : undefined;
  const literaryPositions = context.quanshuFixedBell.bellAdditionalAid.filter(row => row.star === '文昌' || row.star === '文曲');
  const literaryAid = literaryPositions.filter(visible);
  const literaryAidPresent = literaryAid.length > 0 ? true
    : literaryPositions.some(row => row.relation === undefined) ? undefined : false;
  const quanshuFixedBellDoubleGuardWithLiteraryAidCandidate = fixed.doubleGuard === false
    || fixed.namedAidPresent === true || literaryAidPresent === false ? false
    : fixed.doubleGuard === true && literaryAidPresent === true ? true : undefined;
  const bellMingDoubleGuardLiteraryAidWitness = quanshuFixedBellDoubleGuardWithLiteraryAidCandidate === true
    ? { branch: nanyang.branch, assists: literaryAid } : undefined;
  const active = states.filter(row => row.activeInSourceHalf === true);
  const binding = { star: '铃星' as const, starGroup: '南斗' as const,
    activeInSourceHalf: active.length > 0 ? true : states.some(row => row.activeInSourceHalf === undefined) ? undefined : false,
    branch: undefined, guardScopes: [...new Set(active.flatMap(row => row.guardScopes))] };
  return { ...namedCondition(timing, binding, 'quanshu_limit_verse_contacts', context.profile, {
    jielanFireBellProfile: context.jielanFireBellProfile,
    quanshuFixedFireBellProfile: context.quanshuFixedFireBellProfile,
    bellWithoutNamedSupportCandidate: archive.withoutNamedSupport,
    jielanBellWithoutNamedSupportCandidate: jielan.withoutNamedSupport,
    quanshuFixedBellWithoutNamedSupportCandidate: nanyang.withoutNamedSupport,
    quanshuFixedBellTanlangSamePalaceCandidate: nanyang.tanlangSamePalaceCandidate,
    quanshuFixedBellTempleFullSupportCandidate: nanyang.templeFullNamedSupportCandidate,
    quanshuFixedBellDoubleGuardWithNamedAidCandidate, quanshuFixedBellDoubleGuardWithLiteraryAidCandidate,
  }), bellLimitWindows: states, bellPositiveSupportWitnesses: cases.flatMap(row => row.support ? [row.support] : []),
  bellMingDoubleGuardAidWitness, bellMingDoubleGuardLiteraryAidWitness };
}

export function quanshuTimedLianzhen(timing: Timing, context: Xing) {
  const source = 'quanshu_xing_ji_tiger';
  if (!context.ready) {
    const branch = timing.verifiedStarTimings.find(row => row.star === '廉贞')?.branch;
    return unverifiedCondition(timing, bindStar(timing, '廉贞', branch), source, quanshuXingJiTigerPolicy.profile);
  }
  const binding = bindStar(timing, '廉贞', context.lianzhen.branch);
  const doubleGuardInSourceHalf = verifiedDoubleGuard(binding, context.lianzhenNatalDoubleGuardCandidate);
  const yearlyDoubleGuard = verifiedDoubleGuard(binding, context.lianzhenYearSelfJiBladeDoubleGuardCandidate);
  const wenquDoubleGuard = verifiedDoubleGuard(binding, context.lianzhenYearWenquJiBladeDoubleGuardCandidate);
  const wenquOpposed = verifiedDoubleGuard(binding, context.lianzhenYearWenquJiOpposedDoubleGuardCandidate);
  return { ...namedCondition(timing, binding, source, context.profile, {
    tianxingPlacementProof: context.tianxingPlacementProof,
    lianzhenNatalPlacementProof: context.lianzhenNatalPlacementProof,
    lianzhenNatalXingJiBladeCandidate: context.lianzhenNatalXingJiBladeCandidate,
    lianzhenYearXingJiBladeCandidate: context.lianzhenYearXingJiBladeCandidate,
    lianzhenNatalSelfJiAnnualBladeCandidate: context.lianzhenNatalSelfJiAnnualBladeCandidate,
    lianzhenMingGengTabooProfile: context.lianzhenMingGengTabooProfile,
    lianzhenMingGengNatalXingJiBladeCandidate: context.lianzhenMingGengNatalXingJiBladeCandidate,
    lianzhenMingGengNatalTabooOpposedDoubleGuardCandidate: verifiedDoubleGuard(binding,
      context.lianzhenMingGengNatalTabooOpposedDoubleGuardCandidate),
    lianzhenMingGengYearXingJiBladeCandidate: context.lianzhenMingGengYearXingJiBladeCandidate,
    lianzhenNatalDoubleGuardActiveCandidate: doubleGuardInSourceHalf,
    lianzhenYearSelfJiBladeDoubleGuardCandidate: yearlyDoubleGuard,
    lianzhenYearWenquJiBladeDoubleGuardCandidate: wenquDoubleGuard,
    lianzhenYearWenquJiOpposedDoubleGuardCandidate: wenquOpposed,
  }), lianzhenNatalDoubleGuardWitness: doubleGuardInSourceHalf === true ? context.lianzhenNatalDoubleGuardWitness : undefined,
    lianzhenYearSelfJiBladeDoubleGuardWitness: yearlyDoubleGuard === true ? context.lianzhenYearSelfJiBladeDoubleGuardWitness : undefined,
    lianzhenYearWenquJiBladeDoubleGuardWitness: wenquDoubleGuard === true ? context.lianzhenYearWenquJiBladeDoubleGuardWitness : undefined,
    lianzhenYearWenquJiOpposedDoubleGuardWitness: wenquOpposed === true ? context.lianzhenYearWenquJiOpposedDoubleGuardWitness : undefined,
  lianzhenNatalSelfJiAnnualBladeWitness: binding.activeInSourceHalf === true
      ? context.lianzhenNatalSelfJiAnnualBladeWitness : undefined,
    lianzhenMingGengXingJiWitnesses: binding.activeInSourceHalf === true ? context.lianzhenMingGengXingJiWitnesses : [] };
}

export function quanshuTimedSupport(timing: Timing, context: Support, scope: GuardScope, branch: string,
  independentlyVerified?: ReturnType<typeof quanshuMingGroupsFromVerifiedLimits>) {
  const source = 'quanshu_support_condition', profile = quanshuSupportPolicy.profile;
  const liang = bindStar(timing, '天梁', branch, scope), qu = bindStar(timing, '文曲', branch, scope);
  const tongVerified = timing.verifiedStarTimings.find(row => row.star === '天同')?.branch !== undefined;
  const withVerifiedTong = (candidate: State) => tongVerified ? candidate : undefined;
  const otherScope = scope === 'minor' ? 'decadal' : 'minor';
  const changBranch = timing.verifiedStarTimings.find(row => row.star === '文昌')?.branch;
  const chang = bindStar(timing, '文昌', changBranch, otherScope);
  const splitChangQuChecks = [qu.activeInSourceHalf, chang.activeInSourceHalf,
    changBranch === undefined ? undefined : changBranch !== branch];
  const wenquJielanChangQuSplitActiveCandidate = splitChangQuChecks.includes(false) ? false
    : splitChangQuChecks.includes(undefined) ? undefined : true;
  const jielanSplit = {
    wenquJielanChangQuSplitActiveCandidate,
    wenquJielanChangQuSplitActiveWitness: wenquJielanChangQuSplitActiveCandidate === true ? {
      wenqu: { branch, scope }, wenchang: { branch: changBranch, scope: otherScope },
    } : undefined,
  };
  const doubleGuard = (binding: typeof qu, sourceCondition: State) => {
    const companion = bindStar(timing, binding.star, branch, otherScope);
    const checks = [binding.activeInSourceHalf, companion.activeInSourceHalf, sourceCondition];
    return checks.includes(false) ? false : checks.includes(undefined) ? undefined : true;
  };
  const wenquPlainDoubleGuardCandidate = doubleGuard(qu, ['巳', '酉', '丑'].includes(branch));
  const wenquBrightMingDoubleGuardCandidate = doubleGuard(qu, ['卯', '亥', '未'].includes(branch));
  const liangClearTemple = independentlyVerified ? independentlyVerified.tianliang.clearTemple
    : context.ready ? context.namedSupport?.tianliang.mingClearTemple : undefined;
  const tianliangPlainMingClearDoubleGuardCandidate = doubleGuard(liang, liangClearTemple);
  const liangClearNamedSha = independentlyVerified ? independentlyVerified.tianliang.clearNamedSha
    : context.ready ? context.namedSupport?.tianliang.mingClearNamedSha : undefined;
  const tianliangPlainMingClearGuardCandidate = liang.activeInSourceHalf !== true ? liang.activeInSourceHalf
    : tianliangPlainMingClearDoubleGuardCandidate === true ? false : liangClearNamedSha;
  const liangDistributed = doubleGuard(liang, context.ready ? context.tianliangMingTempleDistributedGroupAtSeatCandidate
    : independentlyVerified?.tianliang.distributed);
  const quSeatedTong = doubleGuard(qu, withVerifiedTong(context.ready ? context.wenquMingSeatedTongTrineAssistantsAtSeatCandidate
    : independentlyVerified?.wenqu.seatedTongTrineAssistants));
  const quDistributed = doubleGuard(qu, withVerifiedTong(context.ready ? context.wenquMingDistributedAtSeatCandidate
    : independentlyVerified?.wenqu.distributed));
  if (!context.ready || !verifiedLimit(timing, scope)) {
    const missingCompanion = !context.ready && ['inconsistent_source_auxiliary', 'incomplete_major_positions'].includes(context.reason);
    if (missingCompanion && independentlyVerified && verifiedLimit(timing, scope)) {
      const { wenqu, tianliang } = independentlyVerified;
      const other = timing.halves.find(row => row.scope === otherScope);
      const paired = (candidate: State, half: 'first' | 'second') => candidate === false ? false
        : !verifiedLimit(timing, otherScope) || other?.branch === undefined || other.half === undefined ? undefined
          : other.branch !== branch || other.half !== half ? false : candidate;
      const liangTrine = paired(tianliang.trine, 'second'), quTrine = paired(withVerifiedTong(wenqu.trine), 'first');
      return [
        liang.activeInSourceHalf === true ? { ...namedCondition(timing, liang, source, profile, {
          namedAuxiliaryLayerProof: quanshuSupportPolicy.namedAuxiliaryLayer,
          quanshuFixedFireBellProfile,
          tianliangPlainGuardCandidate: true,
          tianliangPlainMingClearGuardCandidate,
          tianliangPlainMingClearDoubleGuardCandidate,
          tianliangMingTempleDoubleGuardCandidate: paired(tianliang.atSeat, 'second'),
          tianliangMingTempleTrineDoubleGuardCandidate: liangTrine,
          tianliangMingTempleDistributedDoubleGuardCandidate: liangDistributed,
        }), tianliangMingTempleTrineDoubleGuardWitness: liangTrine === true ? tianliang.trineWitness : undefined,
        tianliangMingTempleDistributedDoubleGuardWitness: liangDistributed === true ? tianliang.distributedWitness : undefined }
          : unverifiedCondition(timing, liang, source, profile),
        qu.activeInSourceHalf === true ? { ...namedCondition(timing, qu, source, profile, {
          namedAuxiliaryLayerProof: quanshuSupportPolicy.namedAuxiliaryLayer,
          wenquPlainGuardCandidate: true,
          wenquPlainDoubleGuardCandidate,
          wenquBrightMingDoubleGuardCandidate,
          wenquMingDoubleGuardCandidate: paired(withVerifiedTong(wenqu.atSeat), 'first'),
          wenquMingTongTrineDoubleGuardCandidate: quTrine,
          wenquMingSeatedTongTrineAssistantsDoubleGuardCandidate: quSeatedTong,
          wenquMingDistributedDoubleGuardCandidate: quDistributed,
        }), ...jielanSplit, wenquMingDistributedDoubleGuardWitness: quDistributed === true ? wenqu.distributedWitness : undefined,
        wenquMingTongTrineDoubleGuardWitness: quTrine === true ? wenqu.trineWitness : undefined,
        wenquMingSeatedTongTrineAssistantsDoubleGuardWitness: quSeatedTong === true ? wenqu.seatedTongTrineAssistantsWitness : undefined }
          : unverifiedCondition(timing, qu, source, profile),
      ];
    }
    const wenqu = missingCompanion && qu.activeInSourceHalf === true
      ? { ...namedCondition(timing, qu, source, profile, { namedAuxiliaryLayerProof: quanshuSupportPolicy.namedAuxiliaryLayer,
        wenquPlainGuardCandidate: true, wenquPlainDoubleGuardCandidate, wenquBrightMingDoubleGuardCandidate }), ...jielanSplit }
      : unverifiedCondition(timing, qu, source, profile);
    const tianliang = missingCompanion && liang.activeInSourceHalf === true
      ? namedCondition(timing, liang, source, profile, { tianliangPlainGuardCandidate: true })
      : unverifiedCondition(timing, liang, source, profile);
    return [tianliang, wenqu];
  }
  const other = timing.halves.find(row => row.scope === context.otherScope);
  const companionSeatVerified = other?.branch === undefined || !verifiedLimit(timing, context.otherScope)
    ? undefined : other.branch === context.otherBranch;
  const pairedAtHalf = (candidate: State, ownActive: State, activeHalf: 'first' | 'second') => {
    if (candidate !== true) return candidate;
    if (companionSeatVerified !== true) return companionSeatVerified;
    if (context.otherBranch !== branch) return false;
    return other?.half === undefined ? undefined : other.half === activeHalf && ownActive;
  };
  const tianliangMingTempleTrineDoubleGuardCandidate = pairedAtHalf(context.tianliangMingTempleTrineGroupAtSeatCandidate, liang.activeInSourceHalf, 'second');
  const wenquMingTongTrineDoubleGuardCandidate = pairedAtHalf(context.wenquMingTongTrineAtSeatCandidate, qu.activeInSourceHalf, 'first');
  return [
    { ...namedCondition(timing, liang, source, profile, {
      archivedFireBellPlacementProof,
      namedAuxiliaryLayerProof: quanshuSupportPolicy.namedAuxiliaryLayer,
      tianliangSupportCandidate: context.tianliangSupportCandidate,
      tianliangPlainGuardCandidate: context.tianliangPlainGuardCandidate,
      tianliangPlainMingClearGuardCandidate,
      tianliangPlainMingClearDoubleGuardCandidate,
      tianliangTempleSupportCandidate: context.tianliangTempleSupportCandidate,
      tianliangMingTempleDoubleGuardCandidate: pairedAtHalf(context.tianliangMingTempleGroupAtSeatCandidate, liang.activeInSourceHalf, 'second'),
      tianliangMingTempleTrineDoubleGuardCandidate,
      tianliangMingTempleDistributedDoubleGuardCandidate: liangDistributed,
      tianliangCombinedShaCandidate: context.tianliangCombinedShaCandidate,
      tianliangQuanshuFixedCombinedShaCandidate: context.tianliangQuanshuFixedCombinedShaCandidate,
      quanshuFixedFireBellProfile: context.quanshuFixedFireBellProfile,
      jielanFireBellProfile: context.jielanFireBellProfile,
      tianliangJielanFireBellOpposedTrineCandidate: context.tianliangJielanFireBellOpposedTrineCandidate,
    }), tianliangJielanFireBellWitness: liang.activeInSourceHalf === true ? context.tianliangJielanFireBellWitness : undefined,
    tianliangMingTempleTrineDoubleGuardWitness: tianliangMingTempleTrineDoubleGuardCandidate === true
      ? context.tianliangMingTempleTrineGroupWitness : undefined,
    tianliangMingTempleDistributedDoubleGuardWitness: liangDistributed === true
      ? context.tianliangMingTempleDistributedGroupWitness : undefined },
    { ...namedCondition(timing, qu, source, profile, {
      namedAuxiliaryLayerProof: quanshuSupportPolicy.namedAuxiliaryLayer,
      wenquPlainGuardCandidate: qu.activeInSourceHalf,
      wenquPlainDoubleGuardCandidate,
      wenquBrightMingDoubleGuardCandidate,
      wenquSupportCandidate: context.wenquSupportCandidate,
      wenquMingDoubleGuardCandidate: pairedAtHalf(context.wenquMingGroupAtSeatCandidate, qu.activeInSourceHalf, 'first'),
      wenquMingTongTrineDoubleGuardCandidate,
      wenquMingSeatedTongTrineAssistantsDoubleGuardCandidate: quSeatedTong,
      wenquMingDistributedDoubleGuardCandidate: quDistributed,
      wenquPairedLimitsCandidate: context.wenquPairedLimitsCandidate === true ? companionSeatVerified : context.wenquPairedLimitsCandidate,
      wenquJielanChangQuGuardCandidate: companionSeatVerified === true ? context.wenquJielanChangQuGuardCandidate : undefined,
      wenquChapterFallenCandidate: context.wenquChapterFallenCandidate,
      wenquChapterFallenWeakLifeCandidate: context.wenquChapterFallenWeakLifeCandidate,
      jielanDignityProfile: context.jielanDignityProfile,
      wenquJielanYinFallenCandidate: context.wenquJielanYinFallenCandidate,
    }), ...jielanSplit, wenquJielanYinFallenWitness: qu.activeInSourceHalf === true ? context.wenquJielanYinFallenWitness : undefined,
    wenquMingTongTrineDoubleGuardWitness: wenquMingTongTrineDoubleGuardCandidate === true ? context.wenquMingTongTrineWitness : undefined,
    wenquMingSeatedTongTrineAssistantsDoubleGuardWitness: quSeatedTong === true
      ? context.wenquMingSeatedTongTrineAssistantsWitness : undefined,
    wenquMingDistributedDoubleGuardWitness: quDistributed === true ? context.wenquMingDistributedWitness : undefined,
    wenquJielanChangQuGuardWitness: qu.activeInSourceHalf === true && companionSeatVerified === true
      ? context.wenquJielanChangQuGuardWitness : undefined,
    wenquChapterFallenWeakLifeWitness: qu.activeInSourceHalf === true ? context.wenquChapterFallenWeakLifeWitness : undefined },
  ];
}
