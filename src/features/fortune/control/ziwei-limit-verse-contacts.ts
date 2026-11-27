import type { quanshuLimitBranches } from './ziwei-limit-branches';
import { jielanFireBellProfile, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import { quanshuBrightness, quanshuIdlePalace, quanshuLuYangTuo, quanshuPalaceRelation, quanshuTransformations } from './ziwei-quanshu';

type Limits = ReturnType<typeof quanshuLimitBranches>;
type Condition = boolean | undefined;
type Relation = ReturnType<typeof quanshuPalaceRelation> | undefined;
const branches = '子丑寅卯辰巳午未申酉戌亥';
const visible = ['守', '冲', '三合'];
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const invert = (value: Condition) => value === undefined ? undefined : !value;
const contact = (focus?: string, target?: string) => focus && target ? quanshuPalaceRelation(focus, target) : undefined;
const is = (actual: Relation, expected: string) => actual === undefined ? undefined : actual === expected;
const inArea = (actual: Relation) => actual === undefined ? undefined : visible.includes(actual);
const inAspect = (actual: Relation) => actual === undefined ? undefined : actual === '冲' || actual === '三合';
const tongGrades = { 庙: '巳亥', 旺: '子申', 陷: '午', 利: '寅', 和平: '卯辰酉戌', 不得地: '丑未' };
// The Nanyang commentary's Sun and Moon ranges intersect the archive's paired
// placements at 酉巳, 亥卯 and 戌辰. The last pair already has a Volume III witness.
const nanyangReversePairs = ['酉巳', '亥卯'];

export const quanshuLimitVerseContactPolicy = {
  profile: 'quanshu-tong-yin-bell-verse-contacts-v1',
  period: 'same-native-year-and-actual-limit-segments',
  tong: 'volume-two-wu-fall-and-separate-natal-and-year-stem-opposition',
  tongVoidJi: 'verified-source-voids-and-independently-located-birth-and-year-stem-ji-recipients-opposing-the-guarded-palace',
  yin: 'volume-three-xu-chen-and-separate-nanyang-commentary-pairs-reachable-in-the-archive',
  yinFlowYangTuo: 'year-stem-yang-tuo-trinal-to-the-same-guarded-reversed-moon',
  yinFixedSplitLimits: 'verified-reverse-moon-at-one-actual-limit-with-separate-nanyang-fire-and-bell-limit-guards',
  bell: 'verified-archive-seat-and-known-named-support',
  bellTanlang: 'actual-bell-limit-with-separate-tanlang-conjunction-and-aspect',
  bellComparison: jielanFireBellProfile,
  bellTemple: 'volume-three-temple-at-actual-limit-with-tanlang-and-wuqu-or-a-full-named-helper-pair',
  bellNamedGroups: 'volume-two-six-named-companions-with-dual-guard-and-separate-temple-helper-groups',
  bellAdditionalAid: 'volume-three-documented-natal-lucun-horse-literary-stars-and-unordered-noble-pair',
  principalSeats: 'nanyang-ziwei-tianfu-axis-and-four-limit-subjects-plus-the-named-bell-and-tianxiang-companions',
  jiXiang: 'volume-one-named-groups-with-volume-three-grades-and-explicit-opposition',
  jiLimitEncounters: 'actual-tianji-guard-or-distinct-aspecting-limits-with-separate-volume-one-support-groups',
  xiangIdleLimits: 'verified-idle-palace-with-an-actual-guard-or-two-distinct-aspecting-limits',
} as const;

export function quanshuLimitVerseContacts(limits: Limits) {
  if (!limits.ready) return { ready: false } as const;
  const { lunarYear, annualBranch, decadalBranch, minorBranch, birthStem, principalPositions, adverse } = limits;
  const verifiedDecadal = limits.sourceDecadal?.verified === true ? limits.sourceDecadal.branch : undefined;
  const verifiedMinor = limits.sourceMinor?.verified === true ? limits.sourceMinor.branch : undefined;
  const principal = (star: string) => principalPositions.find(row => row.star === star)?.branch;
  const archiveMajor = (star: string) => {
    const position = principalPositions.find(row => row.star === star);
    return position && 'majorLayerVerified' in position && position.majorLayerVerified === true ? position.branch : undefined;
  };
  const ziwei = archiveMajor('紫微'), tianfu = archiveMajor('天府');
  const anchorAgreement = ziwei === undefined || tianfu === undefined ? undefined
    : tianfu === branches[(4 - branches.indexOf(ziwei) + 12) % 12];
  const seatProof = (star: string, anchor: '紫微' | '天府', steps: number) => {
    const archiveBranch = archiveMajor(star), anchorBranch = archiveMajor(anchor);
    const expectedBranch = anchorBranch === undefined || anchorAgreement !== true ? undefined
      : branches[(branches.indexOf(anchorBranch) + steps + 12) % 12];
    return { anchor, anchorBranch, archiveBranch, expectedBranch,
      verified: archiveBranch === undefined || expectedBranch === undefined ? undefined : archiveBranch === expectedBranch };
  };
  const luminarySeatProof = (proof: ReturnType<typeof seatProof>, branch?: string) => ({
    ...proof, verified: proof.verified === true && branch === undefined ? undefined : proof.verified,
  });
  // 明刊〈安天府图〉与〈安南北斗诸星诀〉分别核紫府相对轴与两组星序。
  const principalSeatProof = {
    xiang: seatProof('天相', '天府', 4),
    tong: seatProof('天同', '紫微', -5),
    sun: luminarySeatProof(seatProof('太阳', '紫微', -3), limits.verifiedSunBranch),
    yin: luminarySeatProof(seatProof('太阴', '天府', 1), limits.verifiedTaiyinBranch),
    lianzhen: seatProof('廉贞', '紫微', -8),
    pojun: seatProof('破军', '天府', 10),
    wuqu: seatProof('武曲', '紫微', -4),
    tanlang: seatProof('贪狼', '天府', 2),
  };
  const verifiedBranch = ({ verified, archiveBranch }: ReturnType<typeof seatProof>) =>
    verified === true && limits.ziweiBirthAnchorVerified === true ? archiveBranch : undefined;
  const checkedPrincipal = (star: string) => Object.hasOwn(limits.birthAnchoredMajorBranches, star)
    ? limits.birthAnchoredMajorBranches[star] : principal(star);
  const shaPosition = (group: string, star: string) => adverse.find(row => row.name === group)?.stars.find(row => row.star === star)?.branch;
  const sheep = ['擎羊', '陀罗'].map(star => ({ star, branch: shaPosition('羊陀', star) }));
  const annualStem = '甲乙丙丁戊己庚辛壬癸'[((lunarYear - 4) % 10 + 10) % 10];
  const annual = quanshuLuYangTuo(annualStem);
  const annualSheep = [{ star: '流年擎羊', branch: annual.qingyangBranch }, { star: '流年陀罗', branch: annual.tuoluoBranch }];
  const fireBell = ['火星', '铃星'].map(star => ({ star: '归档' + star, branch: shaPosition('归档火铃', star) }));
  const fixedFireBell = limits.quanshuFixedFireBell;
  const toTarget = (branch?: string) => ({ branch, annualRelation: contact(branch, annualBranch),
    decadalRelation: contact(branch, verifiedDecadal), minorRelation: contact(branch, verifiedMinor) } as const);
  const guarded = (row: ReturnType<typeof toTarget>) => any([is(row.decadalRelation, '守'), is(row.minorRelation, '守')]);
  const distinctLimitsAspect = (row: ReturnType<typeof toTarget>) => all([inAspect(row.decadalRelation), inAspect(row.minorRelation),
    verifiedDecadal === undefined || verifiedMinor === undefined ? undefined : verifiedDecadal !== verifiedMinor]);
  const inFocus = (branch: string | undefined, rows: ReadonlyArray<{ star: string; branch?: string }>) => rows.map(row => ({ ...row,
    relation: contact(branch, row.branch) } as const));
  const namedAt = (branch: string | undefined, names: string[]) =>
    inFocus(branch, names.map(star => ({ star, branch: checkedPrincipal(star) })));
  const gradeOf = (star: string, branch?: string) => branch === undefined ? undefined : quanshuBrightness(star, branch);

  const ji = toTarget(principal('天机'));
  const jiGrade = gradeOf('天机', ji.branch);
  const jiQuestionSongTemple = ji.branch === undefined ? undefined : '辰戌子午'.includes(ji.branch);
  const jiSupport = namedAt(ji.branch, ['天梁', '左辅', '右弼', '文昌', '文曲']);
  const [jiLiang] = jiSupport;
  const jiTongChangQu = namedAt(ji.branch, ['天同', '文昌', '文曲']);
  const jiBothLimitsAspect = distinctLimitsAspect(ji);
  const jiEncounter = any([guarded(ji), jiBothLimitsAspect]);
  const jiSha = inFocus(ji.branch, [...sheep, ...fireBell]);
  const jiMingFixedSha = inFocus(ji.branch, [...sheep, ...fixedFireBell]);
  const jiWithFourSha = (contacts: typeof jiSha) => all([jiGrade === undefined ? undefined : jiGrade === '陷',
    ...contacts.map(row => inArea(row.relation)), any(contacts.map(row => is(row.relation, '冲')))]);
  const jiFourSha = jiWithFourSha(jiSha);

  const xiang = toTarget(verifiedBranch(principalSeatProof.xiang));
  const xiangGrade = gradeOf('天相', xiang.branch);
  const xiangSupport = namedAt(xiang.branch, ['左辅', '右弼']);
  const xiangGrowth = xiang.branch === undefined ? undefined : limits.xiangGrowth;
  const xiangIdle = xiang.branch === undefined ? undefined : quanshuIdlePalace('天相', xiang.branch).volumeTwo;
  const xiangIdleBothLimitsAspectCandidate = all([xiangIdle, distinctLimitsAspect(xiang)]);
  const xiangGrowthStage = xiangGrowth === undefined ? undefined : ['长生', '帝旺'].includes(xiangGrowth.phase);
  const xiangLianPo = namedAt(xiang.branch, ['廉贞', '破军']);
  const xiangWuTan = namedAt(xiang.branch, ['武曲', '贪狼']);
  const xiangYangTuo = inFocus(xiang.branch, limits.verifiedNatalYangTuo);
  const xiangFireBell = inFocus(xiang.branch, fireBell);
  const xiangQuanshuFixedFireBell = inFocus(xiang.branch, fixedFireBell);
  const xiangIsFallen = xiangGrade === undefined ? undefined : xiangGrade === '陷';
  const xiangLianPoYangTuo = all([xiangIsFallen, ...xiangLianPo.map(row => is(row.relation, '冲')),
    ...xiangYangTuo.map(row => inArea(row.relation))]);
  const xiangOpposed = all([xiangIsFallen, any(xiangFireBell.map(row => is(row.relation, '冲')))]);
  const xiangQuanshuFixedOpposed = all([xiangIsFallen, any(xiangQuanshuFixedFireBell.map(row => is(row.relation, '冲')))]);
  const xiangMingYang = xiangYangTuo.find(row => row.star === '擎羊');
  const xiangMingYangAtVerifiedLimitCandidate = all([guarded(xiang), is(xiangMingYang?.relation, '守')]);
  const xiangMingYangFireBellCandidate = all([xiangMingYangAtVerifiedLimitCandidate,
    ...xiangQuanshuFixedFireBell.map(row => inArea(row.relation))]);
  const xiangDoubleGuardCandidate = all([is(xiang.decadalRelation, '守'), is(xiang.minorRelation, '守')]);
  const xiangIdleMingClearDoubleGuardCandidate = all([xiangDoubleGuardCandidate, xiangIdle,
    ...xiangYangTuo.map(row => invert(inArea(row.relation))),
    ...xiangQuanshuFixedFireBell.map(row => invert(inArea(row.relation)))]);

  const tong = toTarget(verifiedBranch(principalSeatProof.tong));
  const tongBranch = tong.branch;
  const tongSourceGrade = tongBranch === undefined ? undefined : Object.entries(tongGrades).find(([, branches]) => branches.includes(tongBranch))?.[0];
  const tongFallen = tongSourceGrade === undefined ? undefined : tongSourceGrade === '陷';
  const tongSha = inFocus(tong.branch, [...limits.verifiedNatalYangTuo, ...fireBell]);
  const tongAnnualYangTuo = inFocus(tong.branch, annualSheep);
  const tongOpposed = all([tongFallen, any(tongSha.map(row => is(row.relation, '冲')))]);
  const tongAnnualOpposed = all([tongFallen, any(tongAnnualYangTuo.map(row => is(row.relation, '冲')))]);
  const tongVoids = inFocus(tong.branch, ['古天空', '地劫'].map(star => ({ star, branch: shaPosition('古空劫', star) })));
  const tongVoidsOpposed = all([tongFallen, any(tongVoids.map(row => is(row.relation, '冲')))]);
  const tongTaiSuiDoubleGuard = all([tong.annualRelation, tong.decadalRelation, tong.minorRelation].map(value => is(value, '守')));
  const tongFallenVoidsOpposedAtTaiSuiDoubleGuardCandidate = all([tongVoidsOpposed, tongTaiSuiDoubleGuard]);
  const tongFallenVoidsOpposedAtTaiSuiDoubleGuardWitness = tongFallenVoidsOpposedAtTaiSuiDoubleGuardCandidate === true
    ? { branch: tong.branch, voids: tongVoids.filter(row => is(row.relation, '冲')) } : undefined;
  const tongJi = ([['natal', birthStem], ['yearly', annualStem]] as const).map(([layer, stem]) => {
    const { star } = quanshuTransformations(stem)[3];
    const branch = checkedPrincipal(star);
    return { layer, stem, star, branch, relation: contact(tong.branch, branch) } as const;
  });
  const tongJiOpposed = all([tongFallen, any(tongJi.map(row => is(row.relation, '冲')))]);
  const [tongNatalJi] = tongJi;
  const tongFallenNatalJiOpposedAtTaiSuiDoubleGuardCandidate = all([
    tongFallen, tongTaiSuiDoubleGuard, ['文昌', '文曲'].includes(tongNatalJi.star), is(tongNatalJi.relation, '冲'),
  ]);
  const tongFallenNatalJiOpposedAtTaiSuiDoubleGuardWitness = tongFallenNatalJiOpposedAtTaiSuiDoubleGuardCandidate === true
    ? tongNatalJi : undefined;

  const yin = toTarget(verifiedBranch(principalSeatProof.yin)), sunBranch = verifiedBranch(principalSeatProof.sun);
  const yinPair = sunBranch === undefined || yin.branch === undefined ? undefined : sunBranch + yin.branch;
  const yinReverseSource = yinPair === '戌辰' ? 'volume-three'
    : yinPair && nanyangReversePairs.includes(yinPair) ? 'nanyang-commentary' : undefined;
  const yinReverse = yinPair === undefined ? undefined : yinReverseSource !== undefined;
  const yinFireBell = inFocus(yin.branch, fireBell).map(row => ({ ...row, ...toTarget(row.branch) }));
  const yinFireBellContacts = yinFireBell.map(row => inArea(row.relation));
  const yinQuanshuFixedFireBell = inFocus(yin.branch, fixedFireBell).map(row => ({ ...row, ...toTarget(row.branch) }));
  const yinQuanshuFixedFireBellContacts = yinQuanshuFixedFireBell.map(row => inArea(row.relation));
  const yinDecadalGuard = is(yin.decadalRelation, '守'), yinMinorGuard = is(yin.minorRelation, '守');
  const yinDoubleGuard = all([yinDecadalGuard, yinMinorGuard]);
  const yinSingleGuard = any([all([yinDecadalGuard, invert(yinMinorGuard)]), all([yinMinorGuard, invert(yinDecadalGuard)])]);
  const yinMingClearGuard = all([invert(yinReverse), ...yinQuanshuFixedFireBellContacts.map(invert)]);
  const yinMingSingleGuardWithoutFireBellCandidate = all([yinSingleGuard, yinMingClearGuard]);
  const yinMingSingleGuardWithoutFireBellWitness = yinMingSingleGuardWithoutFireBellCandidate === true ? {
    branch: yin.branch, scope: yinDecadalGuard ? 'decadal' : 'minor', sunBranch,
    fireBell: yinQuanshuFixedFireBell.map(({ star, branch, relation }) => ({ star, branch, relation })),
  } : undefined;
  const yinMingDoubleGuardWithFireBellCandidate = all([yinDoubleGuard,
    ...yinQuanshuFixedFireBellContacts, any(yinQuanshuFixedFireBell.map(row => is(row.relation, '守')))]);
  const yinMingDoubleGuardBothFireBellAspectsCandidate = all([yinDoubleGuard,
    ...yinQuanshuFixedFireBell.map(row => inAspect(row.relation))]);
  const yinMingDoubleGuardBothFireBellAspectsWitness = yinMingDoubleGuardBothFireBellAspectsCandidate === true ? {
    branch: yin.branch, fireBell: yinQuanshuFixedFireBell.map(({ star, branch, relation }) => ({ star, branch, relation })),
  } : undefined;
  const yinYangTuo = inFocus(yin.branch, limits.verifiedNatalYangTuo);
  const yinAnnualYangTuo = inFocus(yin.branch, annualSheep);
  const yinReversedAtLimit = all([guarded(yin), yinReverse]);
  const yinNativeTrine = any(yinYangTuo.map(row => is(row.relation, '三合')));
  const yinVolumeThreeNativeTrineDoubleGuardCandidate = all([yinPair === undefined ? undefined : yinReverseSource === 'volume-three',
    yinDoubleGuard, yinNativeTrine]);
  const yinVolumeThreeNativeTrineDoubleGuardWitness = yinVolumeThreeNativeTrineDoubleGuardCandidate === true
    ? yinYangTuo.find(row => row.relation === '三合') : undefined;
  const [mingFire, mingBell] = yinQuanshuFixedFireBell;
  const fixedSplitLimits = ([['decadal', 'minor'], ['minor', 'decadal']] as const).map(([fireScope, bellScope]) => ({
    candidate: all([yinReversedAtLimit, is(mingFire[`${fireScope}Relation`], '守'), is(mingBell[`${bellScope}Relation`], '守')]),
    witness: { moonBranch: yin.branch, fire: { branch: mingFire.branch, scope: fireScope }, bell: { branch: mingBell.branch, scope: bellScope } },
  }));
  const yinReverseQuanshuFixedSplitLimitsCandidate = any(fixedSplitLimits.map(row => row.candidate));
  const yinReverseQuanshuFixedSplitLimitsWitness = fixedSplitLimits.find(row => row.candidate === true)?.witness;

  const bellConditions = (branch?: string) => {
    const bell = toTarget(branch);
    const [bellTanlang, bellWuqu] = namedAt(branch, ['贪狼', '武曲']);
    const bellPairs = [['紫微', '天府'], ['左辅', '右弼']].map(stars => {
      const members = namedAt(branch, stars);
      return { members, present: all(members.map(row => inArea(row.relation))) };
    });
    const bellSupport = bellPairs.flatMap(row => row.members);
    const bellMeetsTanlang = inArea(bellTanlang.relation);
    const bellMeetsWuqu = inArea(bellWuqu.relation);
    const bellNamedSupport = any([bellMeetsTanlang, bellMeetsWuqu, ...bellSupport.map(row => inArea(row.relation))]);
    const bellSourceGrade = gradeOf('铃星', branch);
    const atLimit = guarded(bell);
    const bellAdditionalAid = [...inFocus(branch, limits.verifiedBellNatalAid), ...namedAt(branch, ['文昌', '文曲'])];
    const hasAdditionalAid = any(bellAdditionalAid.map(row => inArea(row.relation)));
    const withoutNamedSupport = all([atLimit, invert(bellNamedSupport), invert(hasAdditionalAid)]);
    const bellTemple = all([atLimit, bellSourceGrade === undefined ? undefined : bellSourceGrade === '庙']);
    const bellTempleWithTanlang = all([bellTemple, bellMeetsTanlang]);
    const bellTempleHelperGroupsCandidate = all([bellTemple, ...bellPairs.map(row => row.present)]);
    const bellTempleWuTanCandidate = all([bellTempleWithTanlang, bellMeetsWuqu]);
    return { bell, bellTanlang, bellWuqu, bellSupport, bellSourceGrade, bellAdditionalAid,
      bellWithoutNamedSupportCandidate: withoutNamedSupport,
      bellDoubleLimitWithoutNamedSupportCandidate: all([withoutNamedSupport, is(bell.decadalRelation, '守'), is(bell.minorRelation, '守')]),
      bellWithAdditionalAidCandidate: all([atLimit, hasAdditionalAid]),
      bellWithNamedSupportCandidate: all([atLimit, bellNamedSupport]),
      bellTanlangAtLimitCandidate: all([atLimit, is(bellTanlang.relation, '守')]),
      bellTanlangAspectCandidate: all([atLimit, inAspect(bellTanlang.relation)]),
      bellTempleWuTanCandidate,
      bellTempleSupportPairCandidate: all([bellTempleWithTanlang, any(bellPairs.map(row => row.present))]),
      bellTempleHelperGroupsCandidate,
      bellTempleFullSupportCandidate: all([bellTempleWuTanCandidate, bellTempleHelperGroupsCandidate]),
      bellTempleSupportPairs: bellTempleWithTanlang === true ? bellPairs.filter(row => row.present === true).map(row => row.members) : [] };
  };
  const archiveBell = bellConditions(fireBell.find(row => row.star === '归档铃星')?.branch);
  const jielanBell = bellConditions(limits.jielanFireBell?.find(row => row.star === '铃星')?.branch);
  const quanshuFixedBell = bellConditions(limits.quanshuFixedFireBell[1].branch);
  const bellCandidate = (row: ReturnType<typeof bellConditions>) => any([row.bellWithoutNamedSupportCandidate, row.bellTanlangAtLimitCandidate,
    row.bellTanlangAspectCandidate, row.bellTempleWuTanCandidate, row.bellTempleSupportPairCandidate, row.bellTempleHelperGroupsCandidate,
    row.bellWithAdditionalAidCandidate]);
  const jielanBellCandidate = bellCandidate(jielanBell);
  const quanshuFixedBellCandidate = bellCandidate(quanshuFixedBell);

  return { ready: true, profile: quanshuLimitVerseContactPolicy.profile, lunarYear, annualBranch, decadalBranch, minorBranch,
    sourceDecadal: limits.sourceDecadal, principalSeatProof, anchorAgreement,
    starPlacementProof: limits.starPlacementProof, limitPlacementProof: limits.limitPlacementProof,
    ziweiBirthAnchorVerified: limits.ziweiBirthAnchorVerified,
    ji, jiGrade, jiQuestionSongTemple, jiSupport, jiTongChangQu, jiSha, jiBothLimitsAspect,
    jiBaseCandidate: all([guarded(ji), invert(jiFourSha)]),
    jiBothLimitsAspectCandidate: all([jiBothLimitsAspect, invert(jiFourSha)]),
    jiSupportCandidate: all([jiEncounter, ...jiSupport.map(row => inArea(row.relation))]),
    jiLiangTogetherCandidate: all([jiEncounter, is(jiLiang.relation, '守')]),
    jiTongChangQuCandidate: all([jiEncounter, ...jiTongChangQu.map(row => inArea(row.relation))]),
    jiFallenShaCandidate: all([jiEncounter, jiFourSha]),
    jiMingFixedSha, jiMingFixedFourShaCandidate: all([jiEncounter, jiWithFourSha(jiMingFixedSha)]),
    xiang, xiangGrade, xiangGrowth, xiangSupport, xiangLianPo, xiangWuTan, xiangYangTuo, xiangFireBell, xiangQuanshuFixedFireBell,
    xiangDoubleGuardCandidate, xiangIdleMingClearDoubleGuardCandidate,
    xiangIdleSeatCandidate: all([guarded(xiang), xiangIdle]),
    xiangIdleBothLimitsAspectCandidate,
    xiangGrowthAidCandidate: all([guarded(xiang), xiangGrowthStage, ...xiangSupport.map(row => inArea(row.relation))]),
    xiangTempleAidCandidate: all([guarded(xiang), xiangGrade === undefined ? undefined : xiangGrade === '庙',
      ...xiangSupport.map(row => inArea(row.relation))]),
    xiangFallenLianPoYangTuoCandidate: all([guarded(xiang), xiangLianPoYangTuo]),
    xiangFallenOpposedCandidate: all([guarded(xiang), xiangOpposed]),
    xiangFallenQuanshuFixedOpposedCandidate: all([guarded(xiang), xiangQuanshuFixedOpposed]),
    xiangMingYangAtVerifiedLimitCandidate,
    xiangMingYangAtVerifiedLimitWitness: xiangMingYangAtVerifiedLimitCandidate === true ? xiangMingYang : undefined,
    xiangMingYangFireBellCandidate,
    xiangMingYangFireBellWitnesses: xiangMingYangFireBellCandidate === true && xiangMingYang
      ? [xiangMingYang, ...xiangQuanshuFixedFireBell] : [],
    tong, tongSourceGrade, tongSha, tongAnnualYangTuo, tongVoids, tongJi,
    tongSupportCandidate: all([guarded(tong), invert(any([tongOpposed, tongAnnualOpposed, tongVoidsOpposed, tongJiOpposed]))]),
    tongFallenOpposedCandidate: all([guarded(tong), tongOpposed]),
    tongFallenAnnualOpposedCandidate: all([guarded(tong), tongAnnualOpposed]),
    tongFallenAnnualOpposedAtTaiSuiCandidate: all([guarded(tong), is(tong.annualRelation, '守'), tongAnnualOpposed]),
    tongFallenVoidsOpposedCandidate: all([guarded(tong), tongVoidsOpposed]),
    tongFallenVoidsOpposedAtTaiSuiDoubleGuardCandidate, tongFallenVoidsOpposedAtTaiSuiDoubleGuardWitness,
    tongFallenNatalJiOpposedAtTaiSuiDoubleGuardCandidate, tongFallenNatalJiOpposedAtTaiSuiDoubleGuardWitness,
    tongFallenJiOpposedCandidate: all([guarded(tong), tongJiOpposed]),
    yin, sunBranch, yinReverse, yinReverseSource, yinYangTuo, yinAnnualYangTuo, yinFireBell, yinQuanshuFixedFireBell,
    yinAtVerifiedLimitCandidate: guarded(yin),
    yinClearFireBellCandidate: all([guarded(yin), invert(any(yinFireBellContacts))]),
    yinPairedFireBellCandidate: all([guarded(yin), ...yinFireBellContacts]),
    yinSingleFireBellCandidate: all([guarded(yin), any(yinFireBellContacts), invert(all(yinFireBellContacts))]),
    yinQuanshuFixedClearFireBellCandidate: all([guarded(yin), invert(any(yinQuanshuFixedFireBellContacts))]),
    yinQuanshuFixedPairedFireBellCandidate: all([guarded(yin), ...yinQuanshuFixedFireBellContacts]),
    yinMingDoubleGuardWithoutFireBellCandidate: all([yinDoubleGuard, yinMingClearGuard]),
    yinMingSingleGuardWithoutFireBellCandidate, yinMingSingleGuardWithoutFireBellWitness,
    yinMingDoubleGuardWithFireBellCandidate, yinMingDoubleGuardBothFireBellAspectsCandidate, yinMingDoubleGuardBothFireBellAspectsWitness,
    yinReverseYangTuoCandidate: all([yinReversedAtLimit, yinNativeTrine]),
    yinVolumeThreeNativeTrineDoubleGuardCandidate, yinVolumeThreeNativeTrineDoubleGuardWitness,
    yinReverseAnnualYangTuoCandidate: all([yinReversedAtLimit, any(yinAnnualYangTuo.map(row => is(row.relation, '三合')))]),
    yinReverseFireBellCandidate: all([yinReversedAtLimit, any(yinFireBell.map(guarded))]),
    yinReverseQuanshuFixedFireBellCandidate: all([yinReversedAtLimit, any(yinQuanshuFixedFireBell.map(guarded))]),
    yinReverseQuanshuFixedSplitLimitsCandidate, yinReverseQuanshuFixedSplitLimitsWitness,
    ...archiveBell, jielanFireBellProfile, jielanBell, jielanBellCandidate,
    jielanBellWithoutNamedSupportCandidate: jielanBell.bellWithoutNamedSupportCandidate,
    quanshuFixedFireBellProfile, quanshuFixedBell, quanshuFixedBellCandidate,
    quanshuFixedBellWithoutNamedSupportCandidate: quanshuFixedBell.bellWithoutNamedSupportCandidate,
  } as const;
}
