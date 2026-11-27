import type { quanshuLimitBranches } from './ziwei-limit-branches';
import { jielanFireBellProfile, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import { quanshuLuYangTuo, quanshuPalaceRelation } from './ziwei-quanshu';

type LimitBranches = ReturnType<typeof quanshuLimitBranches>;
type Condition = boolean | undefined;
type Relation = ReturnType<typeof quanshuPalaceRelation> | '邻宫' | undefined;
const visible = ['守', '冲', '三合'];
export const quanshuShangShiDiagramBranches = { 天伤: '子辰卯午未', 天使: '丑卯辰酉戌', both: '寅申巳亥' } as const;
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const seatRelation = (focus?: string, target?: string) => focus && target ? quanshuPalaceRelation(focus, target) : undefined;
const seated = (relation: Relation) => relation === undefined ? undefined : relation === '守';
const inArea = (relation: Relation) => relation === undefined ? undefined : visible.includes(relation);
const inAspect = (relation: Relation) => relation === undefined ? undefined : relation === '冲' || relation === '三合';

export const quanshuShangShiLimitPolicy = {
  profile: 'quanshu-shangshi-limit-branches-v2',
  year: 'same-candidate-and-native-lunar-year-limit-intersection',
  mingEnvoyJumenJi: 'quanshu-nanyangtang-envoy-annual-ding-jumen-ji-v1',
  tianshang: 'one-limit-seated-with-verified-annual-contact',
  tianshi: 'annual-and-two-limits-all-seated-at-verified-envoy-palace',
  positions: 'source-bound-shang-shi-relief-pairs-and-labelled-archive-fire',
  mixedRelief: 'one-named-support-guards-and-a-different-source-group-aspects-the-same-palace',
  annualFire: 'annual-yang-and-archive-fire-share-one-palace-with-verified-jumen-and-tianji-contacts',
  fireComparison: jielanFireBellProfile,
  empty: 'absence-only-with-fourteen-major-seats-rechecked-on-the-nanyang-sequence-and-four-source-assistants-plus-lucun',
} as const;

export function quanshuShangShiLimits(limits: LimitBranches) {
  if (!limits.ready) return { ready: false } as const;
  const fire = limits.adverse.find(group => group.name === '归档火铃')?.stars.find(row => row.star === '火星');
  const jielanFire = limits.jielanFireBell?.find(row => row.star === '火星');
  const quanshuFixedFire = limits.quanshuFixedFireBell[0];
  const sheep = limits.verifiedNatalYangTuo.find(row => row.star === '擎羊');
  const annualStem = '甲乙丙丁戊己庚辛壬癸'[(limits.lunarYear + 6) % 10];
  const annualYangTuo = quanshuLuYangTuo(annualStem);
  const annualSheepBranch = annualYangTuo.qingyangBranch;
  const diagramAdverse = [
    ...limits.verifiedNatalYangTuo.map(row => ({ star: row.star, branch: row.branch, layer: '本命' })),
    { star: '擎羊', branch: annualSheepBranch, layer: '流年' },
    { star: '陀罗', branch: annualYangTuo.tuoluoBranch, layer: '流年' },
  ];
  const checkedPosition = (row: { star: string; branch?: string }) => Object.hasOwn(limits.birthAnchoredMajorBranches, row.star)
    ? limits.birthAnchoredMajorBranches[row.star] : row.branch;
  const verifiedNobleBranches = new Set(limits.verifiedBellNatalAid.filter(row => row.star === '魁钺组' && row.branch !== undefined)
    .map(row => row.branch));
  const inventory = [...limits.principalPositions.map(row => ({ ...row, branch: checkedPosition(row) })),
    { star: '本命禄存', branch: limits.verifiedBellNatalAid.find(row => row.star === '禄存')?.branch }];
  const principalInventoryComplete = inventory.every(row => row.branch !== undefined);
  const unverifiedMajorStars = Object.entries(limits.birthAnchoredMajorBranches).filter(([, branch]) => branch === undefined).map(([star]) => star);
  const adverseStars = [{ star: '擎羊', branch: sheep?.branch },
    ...['巨门', '天机'].map(star => ({ star, branch: inventory.find(row => row.star === star)?.branch }))];
  const forAnchor = (star: '天伤' | '天使') => {
    const branch = limits.verifiedShangShi.find(row => row.star === star)?.branch;
    const annualRelation = seatRelation(branch, limits.annualBranch);
    const decadalRelation = seatRelation(branch, limits.sourceDecadal?.verified === true ? limits.sourceDecadal.branch : undefined);
    const minorRelation = seatRelation(branch, limits.sourceMinor?.verified === true ? limits.sourceMinor.branch : undefined);
    const limitAtSeat = [seated(decadalRelation), seated(minorRelation)];
    const arrival = star === '天伤' ? all([inArea(annualRelation), any(limitAtSeat)]) : all([seated(annualRelation), ...limitAtSeat]);
    const localPrincipals = branch ? inventory.filter(row => row.branch === branch).map(row => row.star) : undefined;
    const noLocalPrincipals = localPrincipals?.length ? false : branch && principalInventoryComplete ? true : undefined;
    const relief = limits.relief.map(group => {
      const stars = group.stars.map(row => {
        const verifiedBranch = group.name === '魁钺无序组' && !verifiedNobleBranches.has(row.branch)
          ? undefined : checkedPosition(row);
        return { star: row.star, branch: verifiedBranch, relation: seatRelation(branch, verifiedBranch) } as const;
      });
      return { name: group.name, stars, present: all(stars.map(row => inArea(row.relation))) };
    });
    const reliefStars = relief.flatMap(group => group.stars.map(row => ({ ...row, group: group.name })));
    const imperialPair = relief.find(group => group.name === '紫微天府');
    const auxiliaryPairs = relief.filter(group => group.name !== '紫微天府');
    const twoAuxiliaryPairs = any(auxiliaryPairs.flatMap((first, index) =>
      auxiliaryPairs.slice(index + 1).map(second => all([first.present, second.present]))));
    const mingNamedReliefCandidate = all([seated(annualRelation), ...limitAtSeat, imperialPair?.present,
      imperialPair && any(imperialPair.stars.map(row => seated(row.relation))), twoAuxiliaryPairs]);
    const crossGroupRelief = reliefStars.flatMap(guard => reliefStars.filter(aspect => aspect.group !== guard.group).map(aspect => ({
      guard, aspect, candidate: all([seated(guard.relation), inAspect(aspect.relation)]),
    })));
    const [natalSheep, jumen, tianji] = adverseStars.map(row => ({ ...row, relation: seatRelation(branch, row.branch) } as const));
    const annualSheep = { branch: annualSheepBranch, relation: seatRelation(branch, annualSheepBranch) } as const;
    const checkFire = (label: string, fireBranch?: string) => {
      const fire = { star: label, branch: fireBranch, relation: seatRelation(branch, fireBranch) } as const;
      const required = all([arrival, noLocalPrincipals, inArea(fire.relation), inArea(jumen.relation), inArea(tianji.relation)]);
      const annualSamePalace = fireBranch === undefined ? undefined : fireBranch === annualSheepBranch;
      return { fire, withNatalSheep: all([required, inArea(natalSheep.relation)]), withAnnualSheep: all([required, annualSamePalace]) };
    };
    const archived = checkFire('归档火星', fire?.branch);
    const jielan = checkFire('《捷览》火星', jielanFire?.branch);
    const nanyang = checkFire('南阳堂明刊火星', quanshuFixedFire.branch);
    const xuAdverse = star === '天使' && branch === '戌' ? diagramAdverse.filter(row => row.branch === branch) : [];
    const diagram = branch ? {
      listedForStar: quanshuShangShiDiagramBranches[star].includes(branch),
      sharedLabel: quanshuShangShiDiagramBranches.both.includes(branch),
      haiSidebar: branch === '亥',
      wuBodyBranch: star === '天伤' && branch === '午' ? limits.bodyBranch : undefined,
      wuBodyRelation: star === '天伤' && branch === '午' ? seatRelation(branch, limits.bodyBranch) : undefined,
      xuAdverse,
    } : undefined;
    const xuDiagramCandidate = all([branch === undefined ? undefined : star === '天使' && branch === '戌',
      arrival, any(diagramAdverse.map(row => seated(seatRelation(branch, row.branch))))]);
    return { star, branch, annualRelation, decadalRelation, minorRelation, arrival, localPrincipals, noLocalPrincipals, relief,
      adverse: [natalSheep, archived.fire, jumen, tianji], jielan, nanyang, diagram, xuDiagramCandidate,
      crossGroupReliefWitnesses: arrival === true ? crossGroupRelief.filter(row => row.candidate) : [], annualSheep,
      reliefCandidate: all([arrival, any(relief.map(row => row.present))]),
      mingNamedReliefCandidate,
      crossGroupReliefCandidate: all([arrival, any(crossGroupRelief.map(row => row.candidate))]),
      adverseCandidate: archived.withNatalSheep, annualFirePairCandidate: archived.withAnnualSheep,
      jielanFireCandidate: any([jielan.withNatalSheep, jielan.withAnnualSheep]),
      quanshuFixedFireCandidate: any([nanyang.withNatalSheep, nanyang.withAnnualSheep]) };
  };
  const tianshang = forAnchor('天伤'), tianshi = forAnchor('天使');
  const tianshangTripleGuard = all([tianshang.annualRelation, tianshang.decadalRelation, tianshang.minorRelation]
    .map(relation => relation === undefined ? undefined : relation === '守'));
  const tianshangFire = tianshang.nanyang.fire, tianshangFireRelation = tianshangFire.relation;
  const tianshangDirectFire = tianshangFireRelation === undefined ? undefined : ['守', '冲'].includes(tianshangFireRelation);
  const tianshangMingAnnualFireYangDoubleGuardCandidate = all([
    tianshangTripleGuard, tianshang.nanyang.withAnnualSheep, tianshangDirectFire,
  ]);
  const [tianshangNatalYang, , tianshangJumen, tianshangTianji] = tianshang.adverse;
  const tianshangMingNatalFireYangDoubleGuardCandidate = all([
    tianshangTripleGuard, tianshang.nanyang.withNatalSheep, any([tianshangDirectFire, seated(tianshangNatalYang.relation)]),
  ]);
  const tianshangMingNatalFireYangDoubleGuardWitness = tianshangMingNatalFireYangDoubleGuardCandidate === true ? {
    branch: tianshang.branch, yang: tianshangNatalYang, fire: tianshangFire, jumen: tianshangJumen, tianji: tianshangTianji,
  } : undefined;
  // 南阳堂明刊天使条写「巨忌、羊火」。只核同年丁使巨门受忌的可复算分支。
  const jumen = tianshi.adverse.find(row => row.star === '巨门');
  const tianshiMingAnnualJumenJiCandidate = all([tianshi.arrival, tianshi.noLocalPrincipals,
    annualStem === '丁', inAspect(jumen?.relation), seated(tianshi.annualSheep.relation), inAspect(tianshi.nanyang.fire.relation)]);
  const tianshiMingAnnualJumenJiWitness = tianshiMingAnnualJumenJiCandidate === true ? {
    branch: tianshi.branch, annualStem, jumen, fire: tianshi.nanyang.fire,
    yang: { star: '流年擎羊', ...tianshi.annualSheep },
  } : undefined;
  return { ready: true, profile: quanshuShangShiLimitPolicy.profile, lunarYear: limits.lunarYear,
    ziweiBirthAnchorVerified: limits.ziweiBirthAnchorVerified,
    limitPlacementProof: limits.limitPlacementProof,
    annualBranch: limits.annualBranch, decadalBranch: limits.decadalBranch, minorBranch: limits.minorBranch,
    principalInventoryComplete, unverifiedMajorStars, tianshang, tianshi,
    tianshangReliefCandidate: tianshang.reliefCandidate, tianshangAdverseCandidate: tianshang.adverseCandidate,
    tianshiReliefCandidate: tianshi.reliefCandidate, tianshiAdverseCandidate: tianshi.adverseCandidate,
    tianshangMingNamedReliefCandidate: tianshang.mingNamedReliefCandidate,
    tianshangMingAnnualFireYangDoubleGuardCandidate,
    tianshangMingNatalFireYangDoubleGuardCandidate, tianshangMingNatalFireYangDoubleGuardWitness,
    tianshiMingNamedReliefCandidate: tianshi.mingNamedReliefCandidate,
    tianshangCrossGroupReliefCandidate: tianshang.crossGroupReliefCandidate, tianshangAnnualFirePairCandidate: tianshang.annualFirePairCandidate,
    tianshiCrossGroupReliefCandidate: tianshi.crossGroupReliefCandidate, tianshiAnnualFirePairCandidate: tianshi.annualFirePairCandidate,
    tianshiXuDiagramCandidate: tianshi.xuDiagramCandidate,
    jielanFireBellProfile, tianshangJielanFireCandidate: tianshang.jielanFireCandidate, tianshiJielanFireCandidate: tianshi.jielanFireCandidate,
    quanshuFixedFireBellProfile, tianshangQuanshuFixedFireCandidate: tianshang.quanshuFixedFireCandidate,
    tianshiQuanshuFixedFireCandidate: tianshi.quanshuFixedFireCandidate,
    tianshiMingJumenJiProfile: quanshuShangShiLimitPolicy.mingEnvoyJumenJi,
    tianshiMingAnnualJumenJiCandidate, tianshiMingAnnualJumenJiWitness,
  } as const;
}
