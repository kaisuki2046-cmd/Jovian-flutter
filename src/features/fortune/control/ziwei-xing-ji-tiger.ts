import { readQuanshuBodyNatal } from './ziwei-body-limits';
import { jielanFireBellProfile, quanshuFixedFireBellProfile } from './ziwei-firebell-positions';
import type { quanshuLimitBranches } from './ziwei-limit-branches';
import { quanshuLuYangTuo, quanshuPalaceRelation, quanshuTianxingCondition, quanshuTransformations, quanshuVerifiedMajorPositions, type readQuanshuNatal } from './ziwei-quanshu';
import { quanshuTigerCondition } from './ziwei-tiger-layers';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type Limits = ReturnType<typeof quanshuLimitBranches>;
type Condition = boolean | undefined;
type Relation = ReturnType<typeof quanshuPalaceRelation> | undefined;
const sight = ['守', '冲', '三合'];
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const contact = (from?: string, to?: string) => from && to ? quanshuPalaceRelation(from, to) : undefined;
const atSeat = (value: Relation) => value === undefined ? undefined : value === '守';
const inSight = (value: Relation) => value === undefined ? undefined : sight.includes(value);

export const quanshuXingJiTigerPolicy = {
  profile: 'quanshu-xing-ji-tiger-same-limit-v1',
  moon: 'annual-tiger-at-native-parents-with-annual-sui-contact-and-source-moon-fall',
  moonAspects: 'source-moon-fall-with-tai-sui-guarding-parents-or-with-both-year-positions-in-separate-trines-to-parents',
  moonSameDegree: 'established-annual-parent-moon-contact-with-independently-located-natal-yang-or-tuo-at-moon',
  lianzhen: 'common-actual-limit-tianxing-and-taboo-blade-separated-by-source-layer',
  lianzhenNatalPlacement: 'quanshu-lianzhen-source-xing-ji-blade-layers-v1',
  lianzhenMingGengTaboo: 'quanshu-nanyangtang-geng-tianxiang-ji-lianzhen-v1',
  lianzhenTiger: 'sui-minor-actual-seat-with-two-distinct-diagnostic-tiger-positions',
  qisha: 'verified-life-or-body-subject-with-annual-taboo-and-named-xing-candidates',
  qishaAnnualPair: 'same-year-blade-and-taboo-target-in-one-palace-related-to-native-life-or-body-qisha',
  qishaSupport: 'separate-native-ziwei-tianxiang-lucun-contacts-in-the-same-triggered-year',
  mingQishaLucun: 'quanshu-nanyangtang-qisha-natal-lucun-v1',
  qishaTiger: 'same-natal-qisha-palace-as-year-tiger-product-bell-and-distinct-natal-or-yearly-blade',
  qishaTigerAspect: 'year-tiger-guards-qisha-while-bell-and-one-blade-share-one-opposed-or-trine-palace',
  lifeBody: 'volume-one-female-verse-distinct-native-palaces-and-both-active-limits',
  lifeBodyAdditionalSha: 'verified-natal-source-voids-and-birth-stem-ji-receiving-star-guard-life-or-body',
} as const;

export function quanshuXingJiTiger(natal: Natal, yearIndex: number, limits: Limits) {
  if (!limits.ready) return { ready: false } as const;
  const { lunarYear, annualBranch, decadalBranch, minorBranch, principalPositions, birthStem } = limits;
  const verifiedDecadal = limits.sourceDecadal?.verified === true ? limits.sourceDecadal.branch : undefined;
  const verifiedMinor = limits.sourceMinor?.verified === true ? limits.sourceMinor.branch : undefined;
  const findIndex = (branch?: string) => natal.palaces.find(row => row.earthlyBranch === branch)?.index;
  const tiger = quanshuTigerCondition(natal, yearIndex, yearIndex, lunarYear, 'yearly', findIndex(decadalBranch), findIndex(minorBranch));
  if (!tiger.ready || tiger.annualBranch !== annualBranch) return { ready: false } as const;

  const annualTiger = tiger.fourFlying.find(row => row.name === '白虎')?.branch;
  const natalTiger = tiger.natalTigerProductVerified ? tiger.natalTigerExpected : undefined;
  const bellBranch = tiger.bellProductVerified ? tiger.bellArchiveBranches[0] : undefined;
  const nativeBody = readQuanshuBodyNatal(natal);
  const lifeBranch = tiger.natalLifeBranch, bodyBranch = nativeBody.ready ? nativeBody.bodyBranch : undefined;
  const tianxing = quanshuTianxingCondition(natal, yearIndex);
  const tianxingBranch = tianxing.ready ? tianxing.tianxingBranch : undefined;
  const locate = (star: string) => principalPositions.find(row => row.star === star)?.branch;
  const verifiedMajors = quanshuVerifiedMajorPositions(locate);
  const locateTaboo = (star: string) => verifiedMajors.has(star) ? verifiedMajors.get(star) : locate(star);

  const across = (focus?: string) => ({ annual: contact(focus, annualBranch), decadal: contact(focus, decadalBranch), minor: contact(focus, minorBranch) } as const);
  const branchSite = (star: string) => {
    const branch = locate(star);
    return { star, branch, ...across(branch) } as const;
  };
  const parentMoonVerified = limits.birthAnchoredMajorBranches.太阴 !== undefined;
  const parents = { branch: tiger.parentBranch, moonBranch: parentMoonVerified ? tiger.moon?.branch : undefined,
    moonGrade: parentMoonVerified ? tiger.moon?.answerGrade : undefined,
    moonFallenAtParents: parentMoonVerified ? tiger.parentMoonFallen : undefined,
    taiSui: contact(tiger.parentBranch, annualBranch), annualTiger: contact(tiger.parentBranch, annualTiger) } as const;
  const trine = (value: Relation) => value === undefined ? undefined : value === '三合';
  const parentMoonTigerCandidate = all([parents.moonFallenAtParents, atSeat(parents.annualTiger), trine(parents.taiSui)]);
  const parentMoonSuiGuardTigerTrineCandidate = all([parents.moonFallenAtParents, atSeat(parents.taiSui), trine(parents.annualTiger)]);
  const parentMoonSuiTigerTrinesCandidate = all([parents.moonFallenAtParents, trine(parents.taiSui), trine(parents.annualTiger)]);
  // The Four Flying Tiger and Tai Sui are one trine apart. Their shared visible area is exactly these three positions.
  const parentMoonYearContactsCandidate = any([parentMoonTigerCandidate, parentMoonSuiGuardTigerTrineCandidate, parentMoonSuiTigerTrinesCandidate]);
  const starsInGroup = (name: string) => limits.adverse.find(group => group.name === name)?.stars ?? [];
  const parentMoonAnnualSha = parentMoonYearContactsCandidate === true ? quanshuLuYangTuo(tiger.annualStem) : undefined;
  const atParents = ({ star, branch }: { star: string; branch?: string }) => ({ star, branch, relation: contact(parents.branch, branch) }) as const;
  const parentMoonYangTuo = parentMoonAnnualSha ? { natal: starsInGroup('羊陀').map(atParents), yearly: [
    { star: '流年擎羊', branch: parentMoonAnnualSha.qingyangBranch }, { star: '流年陀罗', branch: parentMoonAnnualSha.tuoluoBranch },
  ].map(atParents) } : undefined;
  const parentMoonNatalSameSeatCandidate = all([parentMoonYearContactsCandidate,
    parentMoonYangTuo && any(parentMoonYangTuo.natal.map(row => atSeat(row.relation)))]);
  const lianzhen = branchSite('廉贞'), verifiedQisha = limits.birthAnchoredMajorBranches.七杀;
  const qisha = { star: '七杀', branch: verifiedQisha, ...across(verifiedQisha) } as const;
  const tianxingAtLianzhen = contact(lianzhen.branch, tianxingBranch), tianxingAtQisha = contact(qisha.branch, tianxingBranch);
  const lianGuarded = any([atSeat(contact(lianzhen.branch, verifiedDecadal)), atSeat(contact(lianzhen.branch, verifiedMinor))]);
  const layers = tiger.yang.map(blade => {
    const stem = blade.layer === 'natal' ? birthStem : tiger.annualStem;
    const tabooStar = quanshuTransformations(stem).find(row => row.kind === '忌')?.star;
    const tabooBranch = tabooStar ? locateTaboo(tabooStar) : undefined;
    const lianBlade = contact(lianzhen.branch, blade.branch), lianTaboo = contact(lianzhen.branch, tabooBranch);
    return { layer: blade.layer, stem, bladeBranch: blade.branch, tabooStar, tabooBranch, lianBlade, lianTaboo,
      qishaBlade: contact(qisha.branch, blade.branch), qishaTaboo: contact(qisha.branch, tabooBranch),
      lianzhenXingJiBladeCandidate: all([lianGuarded, inSight(tianxingAtLianzhen), inSight(lianBlade), inSight(lianTaboo)]) } as const;
  });
  const yearly = layers.find(row => row.layer === 'yearly');
  const natalLayer = layers.find(row => row.layer === 'natal');
  const verifiedLianzhen = limits.verifiedLianzhenBranch;
  const bladePlacement = natal.palaces.find(row => row.earthlyBranch === natalLayer?.bladeBranch);
  const verifiedNatalBlade = bladePlacement?.minorStars.some(row => row.name === '擎羊') ? bladePlacement.earthlyBranch : undefined;
  const natalTabooStar = natalLayer?.tabooStar;
  const verifiedNatalTaboo = natalTabooStar === undefined ? undefined
    : Object.hasOwn(limits.verifiedMajorBranches, natalTabooStar) ? limits.verifiedMajorBranches[natalTabooStar] : locate(natalTabooStar);
  // 明刊四化诀「庚日武同相」，以天相受忌；录文的庚干天同另留。
  const mingGengTabooBranch = limits.verifiedMajorBranches.天相;
  const mingLianGuarded = any([atSeat(contact(verifiedLianzhen, verifiedDecadal)), atSeat(contact(verifiedLianzhen, verifiedMinor))]);
  const mingGengXingJi = [
    { layer: 'natal', stem: birthStem, bladeBranch: limits.verifiedNatalYangTuo.find(row => row.star === '擎羊')?.branch },
    { layer: 'yearly', stem: tiger.annualStem, bladeBranch: yearly?.bladeBranch },
  ].map(({ layer, stem, bladeBranch }) => {
    const tianxing = contact(verifiedLianzhen, tianxingBranch), blade = contact(verifiedLianzhen, bladeBranch);
    const taboo = contact(verifiedLianzhen, mingGengTabooBranch);
    return { layer, stem, branch: verifiedLianzhen, tianxing: { branch: tianxingBranch, relation: tianxing },
      blade: { branch: bladeBranch, relation: blade }, taboo: { star: '天相', branch: mingGengTabooBranch, relation: taboo },
      candidate: all([stem === '庚', mingLianGuarded, inSight(tianxing), inSight(blade), inSight(taboo)]) };
  });
  const [mingGengNatal, mingGengYearly] = mingGengXingJi;
  const lianzhenDoubleGuardWithTianxing = all([atSeat(contact(verifiedLianzhen, verifiedDecadal)),
    atSeat(contact(verifiedLianzhen, verifiedMinor)), atSeat(contact(verifiedLianzhen, tianxingBranch))]);
  const lianzhenNatalDoubleGuardCandidate = all([lianzhenDoubleGuardWithTianxing,
    atSeat(contact(verifiedLianzhen, verifiedNatalTaboo)), atSeat(contact(verifiedLianzhen, verifiedNatalBlade))]);
  const mingGengNatalOpposition = contact(verifiedLianzhen, limits.birthAnchoredMajorBranches.天相);
  const lianzhenMingGengNatalTabooOpposedDoubleGuardCandidate = all([lianzhenDoubleGuardWithTianxing,
    birthStem === '庚', atSeat(contact(verifiedLianzhen, mingGengNatal.blade.branch)),
    mingGengNatalOpposition === undefined ? undefined : mingGengNatalOpposition === '冲']);
  const lianzhenNatalDoubleGuardWitness = lianzhenNatalDoubleGuardCandidate === true ? {
    branch: verifiedLianzhen, birthStem, tabooStar: natalTabooStar, tianxingBranch, bladeBranch: verifiedNatalBlade,
  } : undefined;
  const lianzhenYearSelfJiBladeDoubleGuardCandidate = all([lianzhenDoubleGuardWithTianxing,
    yearly?.stem === undefined ? undefined : yearly.stem === '丙' && yearly.tabooStar === '廉贞',
    atSeat(contact(verifiedLianzhen, yearly?.tabooBranch)), atSeat(contact(verifiedLianzhen, yearly?.bladeBranch))]);
  const lianzhenYearSelfJiBladeDoubleGuardWitness = lianzhenYearSelfJiBladeDoubleGuardCandidate === true ? {
    branch: verifiedLianzhen, annualStem: yearly?.stem, tabooStar: yearly?.tabooStar, tabooBranch: yearly?.tabooBranch,
    tianxingBranch, bladeBranch: yearly?.bladeBranch,
  } : undefined;
  const yearlyWenqu = yearly?.stem === '己' && yearly.tabooStar === '文曲' ? locate('文曲') : undefined;
  const lianzhenYearWenquBladeAtBothLimits = all([lianzhenDoubleGuardWithTianxing,
    yearly?.stem === undefined ? undefined : yearly.stem === '己' && yearly.tabooStar === '文曲',
    atSeat(contact(verifiedLianzhen, yearly?.bladeBranch))]);
  const lianzhenYearWenquRelation = contact(verifiedLianzhen, yearlyWenqu);
  const lianzhenYearWenquWitness = { branch: verifiedLianzhen, annualStem: yearly?.stem, tabooStar: yearly?.tabooStar,
    tabooBranch: yearlyWenqu, tianxingBranch, bladeBranch: yearly?.bladeBranch };
  const lianzhenYearWenquJiBladeDoubleGuardCandidate = all([
    lianzhenYearWenquBladeAtBothLimits, atSeat(lianzhenYearWenquRelation),
  ]);
  const lianzhenYearWenquJiBladeDoubleGuardWitness = lianzhenYearWenquJiBladeDoubleGuardCandidate === true
    ? lianzhenYearWenquWitness : undefined;
  const lianzhenYearWenquJiOpposedDoubleGuardCandidate = all([lianzhenYearWenquBladeAtBothLimits,
    lianzhenYearWenquRelation === undefined ? undefined : lianzhenYearWenquRelation === '冲']);
  const lianzhenYearWenquJiOpposedDoubleGuardWitness = lianzhenYearWenquJiOpposedDoubleGuardCandidate === true
    ? { ...lianzhenYearWenquWitness, tabooRelation: '冲' as const } : undefined;
  const lianzhenNatalSelfJiAnnualBladeCandidate = all([lianGuarded, birthStem === '丙', atSeat(tianxingAtLianzhen),
    natalLayer?.tabooStar === undefined ? undefined : natalLayer.tabooStar === '廉贞', atSeat(natalLayer?.lianTaboo),
    yearly?.lianBlade === undefined ? undefined : yearly.lianBlade === '冲']);
  const lianzhenNatalSelfJiAnnualBladeWitness = lianzhenNatalSelfJiAnnualBladeCandidate === true ? {
    branch: lianzhen.branch, birthStem, tabooStar: natalLayer?.tabooStar, tabooBranch: natalLayer?.tabooBranch,
    tianxingBranch, annualStem: yearly?.stem, annualBladeBranch: yearly?.bladeBranch,
  } : undefined;
  const qishaAtLife = atSeat(contact(qisha.branch, lifeBranch)), qishaAtBody = atSeat(contact(qisha.branch, bodyBranch));
  const qishaSubject = tiger.principalSeatProof.qisha.verified === true ? any([qishaAtLife, qishaAtBody]) : undefined;
  const qishaAnnualTrigger = all([qishaSubject, inSight(qisha.annual), inSight(yearly?.qishaTaboo)]);
  const qishaSamePalaceAnnualJiBladeCandidate = all([qishaSubject, inSight(yearly?.qishaTaboo),
    atSeat(contact(yearly?.bladeBranch, yearly?.tabooBranch))]);
  const natalLucunBranch = limits.verifiedBellNatalAid.find(row => row.star === '禄存')?.branch;
  const support = [{ star: '紫微', branch: limits.verifiedMajorBranches.紫微 },
    { star: '天相', branch: limits.verifiedMajorBranches.天相 },
    { star: '本命禄存', branch: natalLucunBranch }]
    .map(row => ({ ...row, ...across(row.branch), qishaRelation: contact(qisha.branch, row.branch) } as const));
  const qishaTianxingJiCandidate = all([qishaAnnualTrigger, inSight(tianxingAtQisha)]);
  const qishaAnnualBladeJiCandidate = all([qishaAnnualTrigger, inSight(yearly?.qishaBlade)]);
  const qishaXingJiCandidate = any([qishaTianxingJiCandidate, qishaAnnualBladeJiCandidate, qishaSamePalaceAnnualJiBladeCandidate]);
  const qishaSupportSeen = any(support.map(row => inSight(row.qishaRelation)));
  const qishaSupportState = qishaSupportSeen === undefined ? 'unverified' : qishaSupportSeen ? 'seen' : 'outside';
  const qishaXingJiEvidence = qishaXingJiCandidate === true ? qishaSupportState
    : qishaXingJiCandidate === false ? 'no-trigger' : undefined;
  // 明刊卷五点名禄存；分别核太岁实守与另宫，忌刃都须由同一流年发出并实冲。
  // 庚干的通行本天同忌与明刊天相忌分开，现有通行本分支仍独立计算。
  const mingTabooAgreement = yearly && (yearly.stem === '庚' ? undefined : true);
  const mingTabooStar = yearly?.tabooStar;
  const mingTabooBranch = mingTabooStar === undefined ? undefined
    : Object.hasOwn(limits.verifiedMajorBranches, mingTabooStar) ? limits.verifiedMajorBranches[mingTabooStar] : locate(mingTabooStar);
  const mingTabooRelation = contact(qisha.branch, mingTabooBranch);
  const mingQishaNatalLucunWithAnnualOpposition = all([mingTabooAgreement, qishaSamePalaceAnnualJiBladeCandidate,
    mingTabooRelation === undefined ? undefined : mingTabooRelation === '冲',
    atSeat(contact(mingTabooBranch, yearly?.bladeBranch)), atSeat(contact(qisha.branch, natalLucunBranch))]);
  const taiSuiGuardsQisha = atSeat(qisha.annual);
  const mingQishaNatalLucunSameSeatCandidate = all([mingQishaNatalLucunWithAnnualOpposition, taiSuiGuardsQisha]);
  const mingQishaNatalLucunOffTaiSuiCandidate = all([mingQishaNatalLucunWithAnnualOpposition,
    taiSuiGuardsQisha === undefined ? undefined : !taiSuiGuardsQisha]);
  const mingQishaNatalLucunSeat = {
    branch: qisha.branch, birthStem, annualStem: yearly?.stem, tabooStar: yearly?.tabooStar,
    tabooBranch: yearly?.tabooBranch, bladeBranch: yearly?.bladeBranch,
  };
  const mingQishaNatalLucunWitness = mingQishaNatalLucunSameSeatCandidate === true ? mingQishaNatalLucunSeat : undefined;
  const mingQishaNatalLucunOffTaiSuiWitness = mingQishaNatalLucunOffTaiSuiCandidate === true ? {
    ...mingQishaNatalLucunSeat, annualBranch, annualRelation: qisha.annual,
  } : undefined;
  const localContacts = (row: { star: string; branch?: string; stem?: string }) => ({ ...row,
    lifeContact: contact(lifeBranch, row.branch), bodyContact: contact(bodyBranch, row.branch),
  } as const);
  const nativeBlades = starsInGroup('羊陀').map(({ star, branch }) => localContacts({ star, branch }));
  const nativeSha = [...nativeBlades, ...starsInGroup('归档火铃').map(({ star, branch }) => localContacts({ star: '归档' + star, branch }))];
  const nativeAdditionalSha = starsInGroup('古空劫').map(({ star, branch }) => localContacts({ star, branch }));
  if (natalLayer?.tabooStar) nativeAdditionalSha.push(localContacts({ star: natalLayer.tabooStar, branch: natalLayer.tabooBranch, stem: birthStem }));
  const acrossVerifiedLimits = (focus?: string) => ({ ...across(focus), minor: contact(focus, verifiedMinor) } as const);
  const lifeContact = acrossVerifiedLimits(lifeBranch), bodyContact = acrossVerifiedLimits(bodyBranch);
  const pairedLimitVisits = (lifeDecadal: Relation, bodyDecadal: Relation) => any([
    all([atSeat(lifeDecadal), inSight(bodyContact.minor)]), all([inSight(lifeDecadal), atSeat(bodyContact.minor)]),
    all([atSeat(bodyDecadal), inSight(lifeContact.minor)]), all([inSight(bodyDecadal), atSeat(lifeContact.minor)]),
  ]);
  const femaleSourceFrame = natal.gender === '女' ? true : natal.gender === '男' ? false : undefined;
  const separateLifeAndBody = bodyBranch === undefined ? undefined : lifeBranch !== bodyBranch;
  const lifeBodyLimits = all([femaleSourceFrame, separateLifeAndBody, pairedLimitVisits(lifeContact.decadal, bodyContact.decadal)]);
  const guardsBothPalaces = (rows: typeof nativeSha) => all([
    any(rows.map(row => atSeat(row.lifeContact))), any(rows.map(row => atSeat(row.bodyContact))),
  ]);
  const lifeBodyShaCandidate = all([lifeBodyLimits, guardsBothPalaces(nativeSha)]);
  const lifeBodyAdditionalShaCandidate = all([lifeBodyLimits, guardsBothPalaces([...nativeSha, ...nativeAdditionalSha]),
    any(nativeAdditionalSha.map(row => any([atSeat(row.lifeContact), atSeat(row.bodyContact)])))]);
  const lifeBodyMingFixedFireBell = limits.quanshuFixedFireBell.map(localContacts);
  const lifeBodyMingFixedShaCandidate = all([lifeBodyLimits,
    guardsBothPalaces([...nativeBlades, ...nativeAdditionalSha, ...lifeBodyMingFixedFireBell]),
    any(lifeBodyMingFixedFireBell.map(row => any([atSeat(row.lifeContact), atSeat(row.bodyContact)])))]);
  const lifeBodyMingFixedPairVerified = all([femaleSourceFrame, separateLifeAndBody, guardsBothPalaces(lifeBodyMingFixedFireBell),
    pairedLimitVisits(contact(lifeBranch, verifiedDecadal), contact(bodyBranch, verifiedDecadal))]);

  const qishaTiger = contact(qisha.branch, annualTiger);
  const qishaBellConditions = (branch?: string) => {
    const relation = contact(qisha.branch, branch);
    const atSeatWithTiger = all([atSeat(qishaTiger), atSeat(relation)]);
    const aspectWithTiger = all([atSeat(qishaTiger), relation === undefined ? undefined : ['冲', '三合'].includes(relation)]);
    return { branch, relation,
      natalBladeAtSeat: all([atSeatWithTiger, atSeat(natalLayer?.qishaBlade)]),
      annualBladeAtSeat: all([atSeatWithTiger, atSeat(yearly?.qishaBlade)]),
      natalBladeAtAspect: all([aspectWithTiger, atSeat(contact(branch, natalLayer?.bladeBranch))]),
      annualBladeAtAspect: all([aspectWithTiger, atSeat(contact(branch, yearly?.bladeBranch))]) };
  };
  const archiveBell = qishaBellConditions(bellBranch);
  const jielanBell = qishaBellConditions(limits.jielanFireBell?.find(row => row.star === '铃星')?.branch);
  const quanshuFixedBell = qishaBellConditions(limits.quanshuFixedFireBell[1].branch);
  const qishaJielanBellTigerCandidate = any([jielanBell.natalBladeAtSeat, jielanBell.annualBladeAtSeat,
    jielanBell.natalBladeAtAspect, jielanBell.annualBladeAtAspect]);
  const qishaQuanshuFixedBellTigerCandidate = any([quanshuFixedBell.natalBladeAtSeat, quanshuFixedBell.annualBladeAtSeat,
    quanshuFixedBell.natalBladeAtAspect, quanshuFixedBell.annualBladeAtAspect]);
  const lianzhenAnnualTiger = contact(lianzhen.branch, annualTiger), lianzhenNatalTiger = contact(lianzhen.branch, natalTiger);
  return { ready: true, profile: quanshuXingJiTigerPolicy.profile, lunarYear, annualBranch, decadalBranch, minorBranch,
    principalSeatProof: tiger.principalSeatProof, ziweiBirthAnchorVerified: limits.ziweiBirthAnchorVerified,
    parents, lianzhen, qisha, layers, tianxingBranch, tianxingPlacementProof: tianxing.ready ? tianxing.tianxingPlacementProof : undefined,
    tianxingAtLianzhen, tianxingAtQisha, annualTiger, natalTiger, bellBranch,
    lifeBranch, bodyBranch, lifeContact, bodyContact, nativeSha, nativeAdditionalSha, lifeBodyShaCandidate, lifeBodyAdditionalShaCandidate,
    lifeBodyMingFixedFireBell, lifeBodyMingFixedShaCandidate, lifeBodyMingFixedPairVerified,
    qishaAtLife, qishaAtBody, qishaTiger, qishaBell: archiveBell.relation, support, lianzhenAnnualTiger, lianzhenNatalTiger,
    parentMoonTigerCandidate, parentMoonSuiGuardTigerTrineCandidate, parentMoonSuiTigerTrinesCandidate, parentMoonYearContactsCandidate,
    parentMoonNatalSameSeatCandidate,
    parentMoonEvidence: parentMoonYearContactsCandidate === true ? { volume2Grade: tiger.moon?.volume2Grade, volume3Grade: tiger.moon?.volume3Grade,
      calendar: tiger.parentMoonCalendar, yangTuo: parentMoonYangTuo } : undefined,
    lianzhenNatalXingJiBladeCandidate: natalLayer?.lianzhenXingJiBladeCandidate,
    lianzhenYearXingJiBladeCandidate: yearly?.lianzhenXingJiBladeCandidate,
    lianzhenNatalPlacementProof: quanshuXingJiTigerPolicy.lianzhenNatalPlacement,
    lianzhenMingGengTabooProfile: quanshuXingJiTigerPolicy.lianzhenMingGengTaboo,
    lianzhenMingGengNatalXingJiBladeCandidate: mingGengNatal.candidate,
    lianzhenMingGengNatalTabooOpposedDoubleGuardCandidate,
    lianzhenMingGengYearXingJiBladeCandidate: mingGengYearly.candidate,
    lianzhenMingGengXingJiWitnesses: mingGengXingJi.filter(row => row.candidate === true),
    lianzhenNatalDoubleGuardCandidate, lianzhenNatalDoubleGuardWitness,
    lianzhenYearSelfJiBladeDoubleGuardCandidate, lianzhenYearSelfJiBladeDoubleGuardWitness,
    lianzhenYearWenquJiBladeDoubleGuardCandidate, lianzhenYearWenquJiBladeDoubleGuardWitness,
    lianzhenYearWenquJiOpposedDoubleGuardCandidate, lianzhenYearWenquJiOpposedDoubleGuardWitness,
    lianzhenNatalSelfJiAnnualBladeCandidate, lianzhenNatalSelfJiAnnualBladeWitness,
    lianzhenAtSuiMinor: tiger.lianzhenAnnualTigerTrineCandidate,
    qishaTianxingJiCandidate, qishaAnnualBladeJiCandidate, qishaSamePalaceAnnualJiBladeCandidate,
    qishaXingJiEvidence, mingQishaLucunPolicy: quanshuXingJiTigerPolicy.mingQishaLucun,
    mingQishaNatalLucunSameSeatCandidate, mingQishaNatalLucunWitness,
    mingQishaNatalLucunOffTaiSuiCandidate, mingQishaNatalLucunOffTaiSuiWitness,
    qishaNatalBladeTigerCandidate: archiveBell.natalBladeAtSeat,
    qishaYearBladeTigerCandidate: archiveBell.annualBladeAtSeat,
    qishaNatalBladeAspectTigerCandidate: archiveBell.natalBladeAtAspect,
    qishaYearBladeAspectTigerCandidate: archiveBell.annualBladeAtAspect,
    jielanFireBellProfile, jielanBell, qishaJielanBellTigerCandidate,
    quanshuFixedFireBellProfile, quanshuFixedBell, qishaQuanshuFixedBellTigerCandidate,
    qishaQuanshuFixedNatalBladeTigerCandidate: quanshuFixedBell.natalBladeAtSeat,
  } as const;
}
