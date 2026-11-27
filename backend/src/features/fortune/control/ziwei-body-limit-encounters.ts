import { quanshuZiweiBirthAnchorProof } from './ziwei-birth-major-anchor';
import { readQuanshuBodyNatal } from './ziwei-body-limits';
import { quanshuFourFlying } from './ziwei-kongjie';
import type { quanshuLimitBranches } from './ziwei-limit-branches';
import { quanshuBrightness, quanshuLuYangTuo, quanshuPalaceRelation, quanshuTianxingCondition, quanshuTransformations, quanshuVerifiedMajorPositions } from './ziwei-quanshu';

type Natal = Parameters<typeof readQuanshuBodyNatal>[0];
type Limits = ReturnType<typeof quanshuLimitBranches>;
type Condition = boolean | undefined;
type Relation = ReturnType<typeof quanshuPalaceRelation> | undefined;
const all = (states: Condition[]) => states.includes(false) ? false : states.includes(undefined) ? undefined : true;
const any = (states: Condition[]) => states.includes(true) ? true : states.includes(undefined) ? undefined : false;
const invert = (value: Condition) => value === undefined ? undefined : !value;
const relation = (from?: string, to?: string): Relation => from && to ? quanshuPalaceRelation(from, to) : undefined;
const guarded = (value: Relation) => value === undefined ? undefined : value === '守';
const visible = (value: Relation) => value === undefined ? undefined : ['守', '冲', '三合'].includes(value);
const isRelation = (value: Relation, expected: Relation) => value === undefined ? undefined : value === expected;
const jielanFlowSha = { 寅午戌: '亥子丑', 亥卯未: '申酉戌', 申子辰: '巳午未', 巳酉丑: '寅卯辰' };

export const quanshuBodyLimitEncounterPolicy = {
  profile: 'quanshu-tanlang-qisha-limit-encounters-v1',
  bodyLife: 'two-active-limits-with-a-guard-and-a-separate-verified-life-body-assignment',
  bodyLifeAspects: 'distinct-active-limits-assign-one-trine-and-one-opposition-to-verified-life-and-body',
  flowingSha: 'volume-three-annual-blade-and-tuo-positions-separate-from-natal-overlap',
  jielanFlowSha: 'jielan-four-annual-directional-sha-groups-v1',
  annualTiger: 'volume-two-yearly-white-tiger-in-the-actual-qisha-limit-seat',
  imperialLu: 'ziwei-and-four-labelled-lu-coordinate-candidates',
  tanlang: 'actual-limit-guard-plus-verified-tianxing-and-one-taboo-layer',
} as const;

export function jielanFlowShaBranches(annualBranch: string) {
  const group = annualBranch.length === 1 && Object.entries(jielanFlowSha).find(([branches]) => branches.includes(annualBranch));
  return group ? [...group[1]] : undefined;
}

export function quanshuBodyLimitEncounters(natal: Natal, yearIndex: number, limits: Limits) {
  if (!limits.ready) return { ready: false } as const;
  const { lunarYear, annualBranch, birthStem, natalLucunBranch, principalPositions } = limits;
  const decadalBranch = limits.sourceDecadal?.verified === true ? limits.sourceDecadal.branch : undefined;
  const minorBranch = limits.sourceMinor?.verified === true ? limits.sourceMinor.branch : undefined;
  const annualStem = '甲乙丙丁戊己庚辛壬癸'[(lunarYear + 6) % 10];
  const annualLuYangTuo = quanshuLuYangTuo(annualStem), natalLuYangTuo = quanshuLuYangTuo(birthStem);
  const principal = (star: string) => principalPositions.find(row => row.star === star)?.branch;
  const verifiedMajors = quanshuVerifiedMajorPositions(star => {
    const branch = principal(star);
    return natal.palaces.find(palace => palace.earthlyBranch === branch)?.majorStars.some(row => row.name === star)
      ? branch : undefined;
  });
  const locate = (star: string) => verifiedMajors.has(star) ? verifiedMajors.get(star) : principal(star);
  const target = (branch?: string) => ({ branch, annual: relation(branch, annualBranch),
    decadal: relation(branch, decadalBranch), minor: relation(branch, minorBranch) } as const);
  const limitGuard = (row: ReturnType<typeof target>) => any([guarded(row.decadal), guarded(row.minor)]);
  const transformation = (stem: string, kind: '忌' | '禄') => {
    const star = quanshuTransformations(stem).find(row => row.kind === kind)!.star;
    return { star, branch: locate(star) };
  };

  const tanlang = target(locate('贪狼'));
  const tanlangGuarded = limitGuard(tanlang);
  const tianxing = quanshuTianxingCondition(natal, yearIndex);
  const tianxingBranch = tianxing.ready ? tianxing.tianxingBranch : undefined;
  const tanlangXing = relation(tanlang.branch, tianxingBranch);
  const taboos = [
    { label: '生年干化忌', ...transformation(birthStem, '忌') },
    { label: '流年干化忌候选', ...transformation(annualStem, '忌') },
  ].map(row => ({ ...row, relation: relation(tanlang.branch, row.branch) } as const));
  const tanlangXingAtLimit = all([tanlangGuarded, visible(tanlangXing)]);
  const natalTaboo = taboos[0];
  const nativeYangTuo = limits.verifiedNatalYangTuo.map(row => ({ ...row, relation: relation(tanlang.branch, row.branch) } as const));
  const [nativeYang] = nativeYangTuo;
  const tanlangMingNatalYangJiAspectCandidate = all([tanlangGuarded,
    tanlang.branch === undefined ? undefined : ['巳', '亥'].includes(tanlang.branch),
    natalTaboo.branch === undefined || nativeYang.branch === undefined ? undefined : natalTaboo.branch === nativeYang.branch,
    nativeYang.relation === undefined ? undefined : ['冲', '三合'].includes(nativeYang.relation)]);
  const tanlangMingNatalYangJiAspectWitness = tanlangMingNatalYangJiAspectCandidate === true
    ? { tanlangBranch: tanlang.branch, birthStem, yangBranch: nativeYang.branch, tabooStar: natalTaboo.star, relation: nativeYang.relation }
    : undefined;
  // The Ming Yang/Tuo chapter calls Yang Xing and Tuo Ji separately from the ten-stem transformation table.
  const tanlangMingXingJiAliasesCandidate = all([tanlangGuarded, ...nativeYangTuo.map(row => visible(row.relation))]);
  const tanlangMingXingJiAliasesWitness = tanlangMingXingJiAliasesCandidate === true
    ? { branch: tanlang.branch, yangTuo: nativeYangTuo } : undefined;
  // 明刊贪狼章既明列巳亥陷，又说陷地加羊陀、忌星，分别核三颗的实际见位。
  const tanlangMingNatalYangTuoJiCandidate = all([tanlangGuarded,
    tanlang.branch === undefined ? undefined : ['巳', '亥'].includes(tanlang.branch),
    ...nativeYangTuo.map(row => visible(row.relation)), visible(natalTaboo.relation)]);
  const tanlangMingNatalYangTuoJiWitness = tanlangMingNatalYangTuoJiCandidate === true
    ? { branch: tanlang.branch, birthStem, yangTuo: nativeYangTuo, taboo: natalTaboo }
    : undefined;

  const qisha = target(locate('七杀'));
  const qishaGrade = qisha.branch ? quanshuBrightness('七杀', qisha.branch) : undefined;
  const qishaGuarded = limitGuard(qisha);
  const bodyNatal = readQuanshuBodyNatal(natal);
  const life = target(bodyNatal.ready ? bodyNatal.lifeBranch : undefined);
  const body = target(bodyNatal.ready ? bodyNatal.bodyBranch : undefined);
  const lifeBodySame = life.branch === undefined || body.branch === undefined ? undefined : life.branch === body.branch;
  const qishaLife = relation(qisha.branch, life.branch), qishaBody = relation(qisha.branch, body.branch);
  const limitsAttend = (decadal: Relation, minor: Relation) => all([visible(decadal), visible(minor),
    any([guarded(decadal), guarded(minor)])]);
  const qishaAtLifeOrBody = any([guarded(qishaLife), guarded(qishaBody)]);
  const qishaBodyLife = all([qishaAtLifeOrBody,
    any([limitsAttend(life.decadal, body.minor), limitsAttend(body.decadal, life.minor)])]);
  const lifeTarget = { label: '命宫', ...life }, bodyTarget = { label: '身宫', ...body };
  const sharedTarget = { label: '身命同宫', ...life };
  const aspectPairs = lifeBodySame === true ? [[sharedTarget, sharedTarget]] as const
    : [[lifeTarget, bodyTarget], [bodyTarget, lifeTarget]] as const;
  const bodyLifeAspects = aspectPairs.map(([decadalTarget, minorTarget]) => {
    const decadalRelation = decadalTarget.decadal, minorRelation = minorTarget.minor;
    return {
      decadal: { target: decadalTarget.label, targetBranch: decadalTarget.branch, branch: decadalBranch, relation: decadalRelation },
      minor: { target: minorTarget.label, targetBranch: minorTarget.branch, branch: minorBranch, relation: minorRelation },
      candidate: any([
        all([isRelation(decadalRelation, '三合'), isRelation(minorRelation, '冲')]),
        all([isRelation(decadalRelation, '冲'), isRelation(minorRelation, '三合')]),
      ]),
    };
  });
  const distinctLimits = decadalBranch === undefined || minorBranch === undefined ? undefined : decadalBranch !== minorBranch;
  const qishaBodyLifeAspectCandidate = all([qishaAtLifeOrBody, distinctLimits, any(bodyLifeAspects.map(row => row.candidate))]);
  const ziweiBranch = locate('紫微');
  const qishaZiwei = relation(qisha.branch, ziweiBranch);
  const verifiedNatalLucun = natal.palaces.find(palace => palace.earthlyBranch === natalLucunBranch)
    ?.minorStars.some(star => star.name === '禄存') ? natalLucunBranch : undefined;
  const lu = [
    { label: '本命禄存', star: '禄存', branch: verifiedNatalLucun },
    { label: '流年禄存', star: '禄存', branch: annualLuYangTuo.lucunBranch },
    { label: '生年干化禄', ...transformation(birthStem, '禄') },
    { label: '流年干化禄候选', ...transformation(annualStem, '禄') },
  ].map(row => ({ ...row, relation: relation(qisha.branch, row.branch) } as const));
  const imperialLu = all([visible(qishaZiwei), any(lu.map(row => visible(row.relation)))]);
  const qishaImperialLuBodyLifeConflictCandidate = all([qishaGuarded, qishaBodyLifeAspectCandidate,
    guarded(qishaZiwei), guarded(relation(qisha.branch, verifiedNatalLucun))]);
  const qishaImperialLuBodyLifeConflictWitness = qishaImperialLuBodyLifeConflictCandidate === true ? {
    branch: qisha.branch, ziweiBranch, lucunBranch: verifiedNatalLucun,
    limits: bodyLifeAspects.filter(row => row.candidate === true),
  } : undefined;
  const flowSha = [
    { star: '流年擎羊', branch: annualLuYangTuo.qingyangBranch, natalBranch: natalLuYangTuo.qingyangBranch },
    { star: '流年陀罗', branch: annualLuYangTuo.tuoluoBranch, natalBranch: natalLuYangTuo.tuoluoBranch },
  ].map(row => ({ ...row, relation: relation(qisha.branch, row.branch), repeatsNatal: row.branch === row.natalBranch } as const));
  const flowShaSeen = any(flowSha.map(row => visible(row.relation)));
  const jielanShaBranches = jielanFlowShaBranches(annualBranch);
  const jielanShaAtMinor = jielanShaBranches && minorBranch ? jielanShaBranches.includes(minorBranch) : undefined;
  const qishaJielanMinorFlowShaCandidate = all([guarded(qisha.minor), jielanShaAtMinor]);
  const knownBodyLifeSha = [
    ...limits.adverse.filter(group => ['羊陀', '古空劫', '伤使'].includes(group.name)).flatMap(group => group.stars),
    ...limits.jielanFireBell,
  ].map(({ star, branch }) => ({ star, branch, bodyRelation: relation(body.branch, branch), lifeRelation: relation(life.branch, branch) } as const));
  const qishaBodyLifeJielanMinorShaCandidate = all([qishaJielanMinorFlowShaCandidate,
    any([qishaBodyLife, qishaBodyLifeAspectCandidate]),
    any(knownBodyLifeSha.map(row => guarded(row.bodyRelation))),
    any(knownBodyLifeSha.map(row => isRelation(row.lifeRelation, '三合')))]);
  const qishaBodyLifeJielanMinorShaWitness = qishaBodyLifeJielanMinorShaCandidate === true ? {
    minorBranch, bodyBranch: body.branch, lifeBranch: life.branch,
    bodyGuards: knownBodyLifeSha.filter(row => row.bodyRelation === '守'),
    lifeTrines: knownBodyLifeSha.filter(row => row.lifeRelation === '三合'),
  } : undefined;
  const jielanCompanion = (star: '火星' | '铃星') => {
    const branch = limits.jielanFireBell.find(row => row.star === star)?.branch;
    return all([qishaBodyLifeJielanMinorShaCandidate, qishaBodyLifeAspectCandidate,
      guarded(qishaBody), guarded(relation(body.branch, branch)), isRelation(relation(life.branch, branch), '三合')]);
  };
  const qishaBodyLifeJielanBellCandidate = jielanCompanion('铃星');
  const qishaBirthPosition = limits.birthAnchoredMajorBranches.七杀;
  const qishaBirthVerified = qishaBirthPosition === undefined || qisha.branch === undefined
    ? undefined : qishaBirthPosition === qisha.branch;
  const qishaBodyLifeJielanFireCandidate = all([jielanCompanion('火星'), qishaBirthVerified]);
  const tigerBranch = quanshuFourFlying(lunarYear).placements.find(row => row.name === '白虎')!.branch;
  const annualTiger = { branch: tigerBranch, relation: relation(qisha.branch, tigerBranch) } as const;
  const annualTigerAtQisha = guarded(annualTiger.relation);

  return { ready: true, profile: quanshuBodyLimitEncounterPolicy.profile, lunarYear, annualStem,
    tanlang, tianxingBranch, tianxingPlacementProof: tianxing.ready ? tianxing.tianxingPlacementProof : undefined, tanlangXing, taboos,
    tanlangNatalXingJiCandidate: all([tanlangXingAtLimit, visible(taboos[0].relation)]),
    tanlangYearXingJiCandidate: all([tanlangXingAtLimit, visible(taboos[1].relation)]),
    tanlangMingNatalYangJiAspectCandidate, tanlangMingNatalYangJiAspectWitness,
    tanlangMingNatalYangTuoJiCandidate, tanlangMingNatalYangTuoJiWitness,
    tanlangMingXingJiAliasesCandidate, tanlangMingXingJiAliasesWitness,
    qisha, qishaGrade, life, body, lifeBodySame, qishaLife, qishaBody, ziweiBranch, qishaZiwei, lu, flowSha, annualTiger,
    qishaSeparateBodyLifeCandidate: all([qishaBodyLife, invert(lifeBodySame)]),
    qishaSharedBodyLifeCandidate: all([qishaBodyLife, lifeBodySame]),
    qishaBodyLifeAspectCandidate,
    qishaBodyLifeAspectWitnesses: qishaBodyLifeAspectCandidate === true ? bodyLifeAspects.filter(row => row.candidate === true) : [],
    qishaBodyLifeRepeatCandidate: all([qishaBodyLife, any(flowSha.map(row => all([row.repeatsNatal, visible(row.relation)])))]),
    qishaBodyLifeJielanMinorShaCandidate, qishaBodyLifeJielanMinorShaWitness,
    qishaBodyLifeJielanBellCandidate, qishaBodyLifeJielanFireCandidate,
    qishaBirthAnchorProof: qishaBirthVerified === true ? quanshuZiweiBirthAnchorProof : undefined,
    qishaPlainLimitCandidate: all([qishaGuarded, invert(any([imperialLu, flowShaSeen, annualTigerAtQisha]))]),
    qishaImperialLuCandidate: all([qishaGuarded, imperialLu]),
    qishaImperialLuBodyLifeConflictCandidate, qishaImperialLuBodyLifeConflictWitness,
    qishaFlowShaCandidate: all([qishaGuarded, flowShaSeen]),
    jielanFlowShaProfile: quanshuBodyLimitEncounterPolicy.jielanFlowSha, jielanShaBranches, qishaJielanMinorFlowShaCandidate,
    qishaAnnualTigerGuardCandidate: all([qishaGuarded, annualTigerAtQisha]),
  } as const;
}
