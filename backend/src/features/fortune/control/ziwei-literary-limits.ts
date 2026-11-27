import { quanshuZiweiBirthAnchor, quanshuZiweiBirthAnchorProof } from './ziwei-birth-major-anchor';
import { quanshuBrightness, quanshuLuYangTuo, quanshuMajorStarNames, quanshuPalaceRelation, quanshuVerifiedMajorPositions, readQuanshuNatal } from './ziwei-quanshu';
import { quanshuHorseBranch } from './ziwei-firebell';
import { quanshuDecadalVerification, quanshuLifeBureau, quanshuLimitPlacementProof } from './ziwei-growth-stages';
import type { quanshuTransformLimits } from './ziwei-transform-limits';

type Natal = Parameters<typeof readQuanshuNatal>[0];
type TransformLimits = ReturnType<typeof quanshuTransformLimits>;
type MovingPalace = { branch: string; movingStarIds?: readonly string[] };
type Condition = boolean | undefined;
type Relation = string | undefined;
const stems = '甲乙丙丁戊己庚辛壬癸';
const branches = '子丑寅卯辰巳午未申酉戌亥';
const visible = ['守', '冲', '三合'];
const verifiedMingKeChangStems = new Set(['甲', '乙', '丁', '戊', '己', '辛', '壬', '癸']);
const jielanAnnualChangBranches = '巳午申酉申酉亥子寅卯';
const any = (values: Condition[]) => values.includes(true) ? true : values.includes(undefined) ? undefined : false;
const all = (values: Condition[]) => values.includes(false) ? false : values.includes(undefined) ? undefined : true;
const relation = (focus?: string, target?: string): Relation => focus && target ? quanshuPalaceRelation(focus, target) : undefined;
const inArea = (contact: Relation) => contact === undefined ? undefined : visible.includes(contact);
const atSeat = (contact: Relation) => contact === undefined ? undefined : contact === '守';
const atTrine = (contact: Relation) => contact === undefined ? undefined : contact === '三合';
const atAspect = (contact: Relation) => contact === undefined ? undefined : ['冲', '三合'].includes(contact);
const twoTrines = (contacts: Relation[]): Condition => {
  const matched = contacts.filter(contact => atTrine(contact) === true).length;
  if (matched >= 2) return true;
  return matched + contacts.filter(contact => contact === undefined).length >= 2 ? undefined : false;
};

export const quanshuLiteraryLimitsPolicy = {
  profile: 'quanshu-literary-limits-v1',
  limitEncounterProof: 'quanshu-literary-verified-limit-witnesses-v1',
  scope: 'one-natal-candidate-and-native-lunar-year-decadal-minor-intersection',
  chang: 'independently-verified-natal-chang-in-three-scope-areas',
  changLimits: 'verified-native-lunar-year-decadal-range-and-source-minor-palace',
  changExclusion: 'listed-fallen-natal-chang-guarding-an-active-limit-with-named-sha-and-a-located-taboo-recipient',
  changNanyangGrades: 'nanyang-volume-three-wenchang-full-four-groups',
  changTrineExclusion: 'fallen-chang-guards-while-a-named-sha-and-a-taboo-recipient-share-one-trinal-palace',
  ke: 'ke-guards-and-chang-visible-or-chang-guards-and-ke-aspects-with-a-distinct-recipient',
  keMajorBirthAnchor: quanshuZiweiBirthAnchorProof,
  keSharedAspect: 'distinct-ke-recipient-and-verified-chang-share-one-opposed-or-trinal-palace-to-the-actual-limit',
  keSplitAspect: 'distinct-ke-recipient-and-verified-chang-aspect-the-same-actual-limit-from-different-palaces',
  keSiblingLimits: 'quanshu-nanyangtang-natal-ke-chang-sibling-limit-v1',
  keMingNatalDoubleGuard: 'quanshu-nanyangtang-natal-ke-chang-double-guard-v1',
  keMingGeng: 'quanshu-nanyangtang-geng-tiantong-ke-at-chang-v1',
  keMingGengSharedLimitAspect: 'verified-common-limits-guard-chang-or-ming-geng-tiantong-while-the-other-opposes-or-trines',
  movingChangQu: 'iztro-2.6.5-yearly-names-checked-against-ten-stem-coordinate-table',
  jielanAnnualChang: 'jielan-annual-chang-by-year-stem-v1',
  movingAssistants: 'both-moving-stars-visible-to-natal-life-and-one-guarding-a-limit-with-zuofu-and-youbi-in-its-trines',
  movingNamedTrines: 'two-distinct-named-natal-stars-or-two-verified-birth-stem-recipients-trine-the-same-limit',
  movingMixedNamedTrines: 'one-named-natal-ally-and-one-distinct-natal-ke-quan-lu-recipient-trine-the-same-verified-limit',
  movingTaiZuo: 'birth-day-forward-from-zuofu-backward-from-youbi-with-unique-archive-cross-check',
  movingSourceSeats: 'volume-one-si-you-on-the-verified-moving-pair-at-life-and-limit',
  movingBothLimitsTrine: 'both-verified-limits-share-a-seat-trined-by-the-moving-pair-sun-and-distinct-annual-hualu',
  lu: 'annual-lucun-and-annual-stem-hualu-kept-distinct',
  horse: 'verified-natal-horse-seated-with-companions-in-one-limit-or-lu-chang-at-horse-limit-with-zi-fu-visible-to-other-limit',
  horseDoubleGuardAgreement: 'both-verified-limits-and-all-five-named-stars-co-seated-with-two-independent-moving-chang-tables-agreeing',
  lumingChang: 'zhongyiming-suibi-luming-annual-chang-v1',
} as const;

export function quanshuLumingChangBranch(annualStem: string) {
  const index = annualStem.length === 1 ? stems.indexOf(annualStem) : -1;
  // 鐘義明《紫微隨筆・亨集》〈天馬篇〉注一的禄命法。
  return index < 0 ? undefined : '巳午申酉申酉戌亥子丑'[index];
}

function movingChangQu(stem: string, palaces: readonly MovingPalace[]) {
  const index = stem.length === 1 ? stems.indexOf(stem) : -1;
  // 《捷览》另有流昌十干表；王亭之中州派图三十一甲、乙分列归档引擎所用的流昌与流曲表。
  return [{ star: '流昌', expected: jielanAnnualChangBranches[index] }, { star: '流曲', expected: '酉申午巳午巳卯寅子亥'[index] }]
    .map(row => {
      const positions = palaces.flatMap(palace => palace.movingStarIds?.filter(star => star === row.star).map(() => palace.branch) ?? []);
      return { star: row.star, branch: positions.length === 1 && positions[0] === row.expected ? row.expected : undefined };
    });
}

export function quanshuLiteraryLimits(natal: Natal, transformed: TransformLimits, yearlyPalaces: readonly MovingPalace[]) {
  if (!transformed.ready) return { ready: false } as const;
  const { lunarYear, annualStem, annualBranch, decadalBranch, minorBranch } = transformed;
  const [firstLimit] = transformed.seats;
  const chang = firstLimit?.helpers.find(row => row.star === '文昌')?.branch;
  const changGrade = chang ? quanshuBrightness('文昌', chang) : undefined;
  const changNanyangGrade = chang === undefined ? undefined
    : '寅午戌'.includes(chang) ? '陷' : '申子辰'.includes(chang) ? '地' : '巳酉丑'.includes(chang) ? '庙' : '利';
  const verifiedMinor = transformed.sourceMinor?.verified === true ? true : undefined;
  const decadalPalace = natal.palaces.find(palace => palace.earthlyBranch === decadalBranch);
  const basis = readQuanshuNatal(natal);
  const verifiedLifeBureau = basis.status === 'ready' ? quanshuLifeBureau(natal, basis).verifiedLifeBureau : undefined;
  const sourceDecadal = basis.status === 'ready' ? quanshuDecadalVerification(natal, basis, decadalPalace, lunarYear, verifiedLifeBureau) : undefined;
  const archive = new Map<string, { branch: string; layer: 'majorStars' | 'minorStars' | 'adjectiveStars' } | undefined>();
  for (const palace of natal.palaces) for (const layer of ['majorStars', 'minorStars', 'adjectiveStars'] as const) {
    for (const { name } of palace[layer]) archive.set(name, archive.has(name) ? undefined : { branch: palace.earthlyBranch, layer });
  }
  const archivedAtLayer = (star: string, layer: 'majorStars' | 'minorStars' | 'adjectiveStars') => {
    const placement = archive.get(star);
    return placement?.layer === layer ? placement.branch : undefined;
  };
  const sourceMajors = quanshuVerifiedMajorPositions(star => archivedAtLayer(star, 'majorStars'));
  const expectedZiwei = quanshuZiweiBirthAnchor(natal, verifiedLifeBureau);
  const locatedZiwei = sourceMajors.get('紫微');
  const keMajorBirthAnchorVerified = expectedZiwei && locatedZiwei ? expectedZiwei === locatedZiwei : undefined;
  const verifiedKeRecipient = <T extends { star: string; branch?: string }>(recipient: T | undefined) => {
    if (recipient && quanshuMajorStarNames.includes(recipient.star) && keMajorBirthAnchorVerified !== true) {
      return { ...recipient, branch: undefined, relation: undefined };
    }
    return recipient;
  };
  const verifiedDecadal = sourceDecadal?.verified === true ? true : undefined;
  const verifiedLayer = (layer: string) => (layer !== 'decadal' || verifiedDecadal === true)
    && (layer !== 'minor' || verifiedMinor === true);
  const changContacts = { yearly: relation(annualBranch, chang), decadal: relation(verifiedDecadal === true ? decadalBranch : undefined, chang),
    minor: relation(verifiedMinor === true ? minorBranch : undefined, chang) } as const;
  const verifiedDoubleChangGuard = all([verifiedMinor, atSeat(changContacts.decadal), atSeat(changContacts.minor)]);
  const natalTransform = firstLimit?.groups.find(group => group.layer === 'natal');
  const natalKe = verifiedKeRecipient(natalTransform?.stars.find(row => row.kind === '科'));
  const keChangVerifiedDoubleGuard = all([verifiedDoubleChangGuard, natalKe === undefined ? undefined : natalKe.star !== '文昌',
    atSeat(relation(chang, natalKe?.branch))]);
  // These natal recipients agree in the Ming tables and the existing source profile.
  const sourceKeAtChang = all([natalTransform?.stem === undefined ? undefined : verifiedMingKeChangStems.has(natalTransform.stem),
    natalKe === undefined ? undefined : natalKe.star !== '文昌', atSeat(relation(chang, natalKe?.branch))]);
  const limitContacts = [changContacts.decadal, changContacts.minor];
  const siblingLimit = (keAtChang: Condition, aspect: '冲' | '三合') => all([keAtChang, verifiedMinor, any(limitContacts.map(atSeat)),
    any(limitContacts.map(contact => contact === undefined ? undefined : contact === aspect))]);
  const keChangVerifiedOpposedLimit = siblingLimit(sourceKeAtChang, '冲');
  const keChangVerifiedTrineLimit = siblingLimit(sourceKeAtChang, '三合');
  const keChangVerifiedSiblingWitness = keChangVerifiedOpposedLimit || keChangVerifiedTrineLimit ? {
    stem: natalTransform?.stem, star: natalKe?.star, branch: chang,
    decadal: { branch: decadalBranch, relation: changContacts.decadal },
    minor: { branch: minorBranch, relation: changContacts.minor },
  } : undefined;
  // 南阳堂本卷三「庚日武同相」的科为天同。兼容表的庚科仍独立保存。
  const gengStem = natalTransform?.stem === undefined ? undefined : natalTransform.stem === '庚';
  const mingGengKeBranch = gengStem === true && keMajorBirthAnchorVerified === true ? sourceMajors.get('天同') : undefined;
  const mingGengKeAtChang = all([gengStem, atSeat(relation(chang, mingGengKeBranch))]);
  // A distinct natal Ke recipient and natal Chang share both verified limits.
  const keChangMingNatalDoubleGuard = all([verifiedDoubleChangGuard, any([sourceKeAtChang, mingGengKeAtChang])]);
  const mingNatalKeBranch = gengStem === true ? mingGengKeBranch : natalKe?.branch;
  const mingNatalKeAspect = relation(chang, mingNatalKeBranch);
  const hasDistinctMingNatalKe = natalTransform?.stem === undefined ? undefined
    : gengStem === true || verifiedMingKeChangStems.has(natalTransform.stem);
  const keChangMingNatalDoubleGuardWithKeAspect = all([verifiedDoubleChangGuard, hasDistinctMingNatalKe,
    atAspect(mingNatalKeAspect)]);
  const keChangMingNatalDoubleGuardWithKeAspectWitness = keChangMingNatalDoubleGuardWithKeAspect === true
    ? { stem: natalTransform?.stem, star: gengStem ? '天同' : natalKe?.star,
      branch: mingNatalKeBranch, relation: mingNatalKeAspect } : undefined;
  const keChangMingGengDoubleGuard = all([verifiedDoubleChangGuard, mingGengKeAtChang]);
  const keChangMingGengOpposedLimit = siblingLimit(mingGengKeAtChang, '冲');
  const keChangMingGengTrineLimit = siblingLimit(mingGengKeAtChang, '三合');
  const keChangMingGengWitness = any([keChangMingGengDoubleGuard, keChangMingGengOpposedLimit, keChangMingGengTrineLimit]) === true
    ? { stem: '庚', star: '天同', branch: mingGengKeBranch,
      decadal: { branch: decadalBranch, relation: changContacts.decadal },
      minor: { branch: minorBranch, relation: changContacts.minor } } : undefined;
  const verifiedCommonLimit = verifiedDecadal && verifiedMinor ? atSeat(relation(decadalBranch, minorBranch)) : undefined;
  const mingNatalKeLimitRelation = relation(verifiedDecadal ? decadalBranch : undefined, mingNatalKeBranch);
  const keChangMingNatalKeAtDoubleGuardWithChangAspect = all([verifiedCommonLimit, hasDistinctMingNatalKe,
    atSeat(mingNatalKeLimitRelation), atAspect(changContacts.decadal)]);
  const keChangMingNatalKeAtDoubleGuardWithChangAspectWitness = keChangMingNatalKeAtDoubleGuardWithChangAspect === true
    ? { stem: natalTransform?.stem, star: gengStem ? '天同' : natalKe?.star,
      branch: mingNatalKeBranch, changBranch: chang, changRelation: changContacts.decadal } : undefined;
  const mingGengKeLimitRelation = relation(verifiedDecadal ? decadalBranch : undefined, mingGengKeBranch);
  const keChangMingGengSharedLimitAspect = all([gengStem, verifiedCommonLimit, any([
    all([atSeat(changContacts.decadal), atAspect(mingGengKeLimitRelation)]),
    all([atSeat(mingGengKeLimitRelation), atAspect(changContacts.decadal)]),
  ])]);
  const keChangMingGengSharedLimitAspectWitness = keChangMingGengSharedLimitAspect === true ? {
    branch: decadalBranch, chang: { branch: chang, relation: changContacts.decadal },
    ke: { stem: '庚', star: '天同', branch: mingGengKeBranch, relation: mingGengKeLimitRelation },
  } : undefined;
  const sun = sourceMajors.get('太阳'), moon = sourceMajors.get('太阴'), archivedHorse = archivedAtLayer('天马', 'minorStars');
  const horse = archivedHorse === quanshuHorseBranch(natal.rawDates.chineseDate.yearly[1]) ? archivedHorse : undefined;
  const natalStem = firstLimit?.groups.find(group => group.layer === 'natal')?.stem;
  const sourceLu = natalStem ? quanshuLuYangTuo(natalStem).lucunBranch : undefined;
  const nativeLu = sourceLu === archivedAtLayer('禄存', 'minorStars') ? sourceLu : undefined;
  const horseMajors = ['紫微', '天府'].map(star => ({
    star, branch: keMajorBirthAnchorVerified === true ? sourceMajors.get(star) : undefined,
  }));
  const dynamic = movingChangQu(annualStem, yearlyPalaces);
  const [annualChang, annualQu] = dynamic;
  const lumingChang = quanshuLumingChangBranch(annualStem);
  const movingAtSourceSeats = dynamic.every(row => row.branch !== undefined)
    ? ['巳酉', '酉巳'].includes(dynamic.map(row => row.branch).join('')) : undefined;
  const lifeBranch = basis.status === 'ready' ? basis.lifeBranch : undefined;
  const movingAtLife = all(dynamic.map(row => inArea(relation(lifeBranch, row.branch))));
  const changAtLifeWithQu = all([atSeat(relation(lifeBranch, annualChang.branch)), movingAtLife]);
  const annualLuRecipient = firstLimit?.groups.find(group => group.layer === 'yearly')?.stars.find(row => row.kind === '禄');
  const lu = [{ kind: '禄存', star: '禄存', branch: quanshuLuYangTuo(annualStem).lucunBranch },
    { kind: '化禄', star: annualLuRecipient?.star, branch: annualLuRecipient?.branch }];
  const birthDay = natal.rawDates.lunarDate.lunarDay;
  const sourceTaiZuo = ([['三台', '左辅', 1], ['八座', '右弼', -1]] as const).map(([star, start, direction]) => {
    const anchor = firstLimit?.helpers.find(row => row.star === start)?.branch;
    const expected = anchor && Number.isInteger(birthDay) && birthDay >= 1 && birthDay <= 30
      ? branches[(branches.indexOf(anchor) + direction * (birthDay - 1) + 36) % 12] : undefined;
    return { star, branch: expected === archivedAtLayer(star, 'adjectiveStars') ? expected : undefined };
  });
  const limits = transformed.seats.filter(seat => verifiedLayer(seat.layer)).map(seat => {
    const changRelation = relation(seat.branch, chang);
    const ke = seat.groups.map(group => {
      const recipient = verifiedLayer(group.layer) ? verifiedKeRecipient(group.stars.find(row => row.kind === '科')) : undefined;
      const sameStar = recipient ? recipient.star === '文昌' : undefined;
      const distinct = sameStar === undefined ? undefined : !sameStar;
      const contact = recipient?.relation;
      const samePalace = recipient?.branch && chang ? recipient.branch === chang : undefined;
      return { layer: group.layer, stem: group.stem, recipient: recipient?.star, branch: recipient?.branch,
        relation: contact, sameStar,
        candidate: all([distinct, atSeat(contact), inArea(changRelation)]),
        aspectCandidate: all([distinct, atSeat(changRelation), atAspect(contact)]),
        sharedAspectCandidate: all([distinct, samePalace, atAspect(changRelation)]),
        splitAspectCandidate: all([distinct, samePalace === undefined ? undefined : !samePalace,
          atAspect(changRelation), atAspect(contact)]) };
    });
    const changSha = seat.hazards.filter(row => ['擎羊', '陀罗', '归档火星', '归档铃星'].includes(row.star));
    const fixedChangSha = transformed.quanshuFixedFireBell.map(row => ({ ...row, relation: relation(seat.branch, row.branch) }));
    const changJi = seat.groups.map(group => {
      const recipient = verifiedLayer(group.layer) ? group.stars.find(row => row.kind === '忌') : undefined;
      return { layer: group.layer, stem: group.stem, star: recipient?.star, branch: recipient?.branch, relation: recipient?.relation } as const;
    });
    const directSha = (contact: Relation) => contact === undefined ? undefined : ['守', '冲'].includes(contact);
    const fallenChangGuards = all([changGrade === undefined ? undefined : changGrade === '陷', atSeat(changRelation)]);
    const changAdverse = all([fallenChangGuards,
      any(changSha.map(row => directSha(row.relation))), any(changJi.map(row => inArea(row.relation)))]);
    const trineShaJi = changJi.map(ji => {
      const shared = changSha.map(sha => sha.branch === undefined || ji.branch === undefined ? undefined : sha.branch === ji.branch);
      return { ...ji, sha: changSha.filter((_, i) => shared[i] === true).map(sha => sha.star),
        candidate: all([atTrine(ji.relation), any(shared)]) };
    });
    const changTrineShaJi = all([fallenChangGuards, any(trineShaJi.map(row => row.candidate))]);
    const sourceFallenChangGuards = all([changNanyangGrade === undefined ? undefined : changNanyangGrade === '陷', atSeat(changRelation)]);
    const changQuanshuFixedAdverse = all([sourceFallenChangGuards, any(fixedChangSha.map(row => directSha(row.relation))),
      any(changJi.map(row => inArea(row.relation)))]);
    const fixedTrineShaJi = changJi.map(ji => {
      const sha = ji.branch ? fixedChangSha.find(row => row.branch === ji.branch) : undefined;
      return { ...ji, sha: sha?.star, candidate: all([atTrine(ji.relation), ji.branch === undefined ? undefined : sha !== undefined]) };
    });
    const changQuanshuFixedTrineShaJi = all([sourceFallenChangGuards, any(fixedTrineShaJi.map(row => row.candidate))]);
    const moving = dynamic.map(row => ({ ...row, relation: relation(seat.branch, row.branch) } as const));
    const movingAtLimit = all([...moving.map(row => inArea(row.relation)), any(moving.map(row => atSeat(row.relation)))]);
    const assistants = seat.supportPairs.find(pair => pair.label === '左辅右弼')!.stars;
    const assistantTrine = all(assistants.map(star => atTrine(star.relation)));
    const nobles = seat.supportPairs.find(pair => pair.label === '魁钺组')!.stars;
    const namedSupport = [...assistants, ...nobles,
      ...[...sourceTaiZuo, { star: '太阳', branch: sun }, { star: '太阴', branch: moon }, { star: '天马', branch: horse }]
        .map(row => ({ ...row, relation: relation(seat.branch, row.branch) }))];
    const natalTransforms = seat.groups.find(group => group.layer === 'natal')?.stars.filter(row => row.kind !== '忌') ?? [];
    const movingAtLifeAndLimit = all([movingAtLife, movingAtLimit]);
    const namedTrines = twoTrines(namedSupport.map(row => row.relation));
    const movingNamedTrinesCandidate = all([movingAtLifeAndLimit, namedTrines]);
    const movingLifeAndCommonMinorTrines = all([seat.layer === 'minor',
      atSeat(relation(annualBranch, seat.branch)), changAtLifeWithQu, namedTrines]);
    const movingNatalTransformCandidate = all([movingAtLifeAndLimit, natalTransforms.length === 3
      ? twoTrines(natalTransforms.map(row => row.relation)) : undefined]);
    const mixedNamedTrines = namedSupport.flatMap(support => natalTransforms.filter(recipient => recipient.star !== support.star)
      .map(recipient => ({ support, recipient, candidate: all([atTrine(support.relation), atTrine(recipient.relation)]) })));
    const movingMixedNamedTrines = all([movingAtLifeAndLimit,
      natalTransforms.length === 3 ? any(mixedNamedTrines.map(row => row.candidate)) : undefined]);
    const sunRelation = relation(seat.branch, sun);
    const annualLu = lu.map(row => ({ ...row, relation: relation(seat.branch, row.branch) } as const));
    const horseSupport = [{ star: '本命禄存', branch: nativeLu }, ...horseMajors]
      .map(row => ({ ...row, relation: relation(seat.branch, row.branch) } as const));
    const productChangRelation = relation(seat.branch, annualChang.branch);
    const horseCompanions = [...horseSupport, { ...annualChang, relation: productChangRelation }];
    const horseRelation = relation(seat.branch, horse);
    const horseWithSupport = all([atSeat(horseRelation), ...horseSupport.map(row => inArea(row.relation))]);
    const lumingChangRelation = relation(seat.branch, lumingChang);
    return { layer: seat.layer, branch: seat.branch, changRelation, ke, changAdverse, changTrineShaJi,
      changQuanshuFixedAdverse, changQuanshuFixedTrineShaJi,
      changQuanshuFixedSha: changQuanshuFixedAdverse === true ? fixedChangSha.filter(row => directSha(row.relation)) : [],
      changQuanshuFixedJi: changQuanshuFixedAdverse === true ? changJi.filter(row => inArea(row.relation)) : [],
      changQuanshuFixedTrineWitnesses: changQuanshuFixedTrineShaJi === true ? fixedTrineShaJi.filter(row => row.candidate === true) : [],
      changTrineShaJiWitnesses: changTrineShaJi === true ? trineShaJi.filter(row => row.candidate === true) : [],
      changSha: changAdverse === true ? changSha.filter(row => directSha(row.relation)) : [],
      changJi: changAdverse === true ? changJi.filter(row => inArea(row.relation)) : [],
      moving, sunRelation, annualLu, horseRelation, horseCompanions, lumingChangRelation,
      horseCandidate: all([horseWithSupport, inArea(productChangRelation)]),
      lumingHorseCandidate: all([horseWithSupport, inArea(lumingChangRelation)]),
      movingCandidate: all([movingAtLimit, atTrine(sunRelation),
        any(annualLu.map(row => row.relation === undefined ? undefined : ['冲', '三合'].includes(row.relation)))]),
      movingAssistantCandidate: all([movingAtLifeAndLimit, assistantTrine]),
      movingNamedTrinesCandidate, movingNatalTransformCandidate, movingMixedNamedTrines,
      mixedNamedTrineWitness: movingMixedNamedTrines === true ? {
        layer: seat.layer, branch: seat.branch, lifeBranch, moving, natalStem,
        pairs: mixedNamedTrines.filter(row => row.candidate === true).map(({ support, recipient }) => ({ support, recipient })),
      } : undefined,
      movingLifeAndCommonMinorTrines,
      commonMinorTrineWitness: movingLifeAndCommonMinorTrines === true ? {
        lifeBranch, commonBranch: seat.branch,
        moving: dynamic.map(row => ({ ...row, relation: relation(lifeBranch, row.branch) })),
        trines: namedSupport.filter(row => row.relation === '三合'),
      } : undefined,
      movingSourceSeatsCandidate: all([movingAtLifeAndLimit, movingAtSourceSeats]),
      namedSupportTrines: movingNamedTrinesCandidate === true ? namedSupport.filter(row => row.relation === '三合') : [],
      natalTransformTrines: movingNatalTransformCandidate === true ? natalTransforms.filter(row => row.relation === '三合') : [],
      natalTransformStem: movingNatalTransformCandidate === true ? natalStem : undefined,
      assistants: assistantTrine === true ? assistants : [] };
  });
  const horseSplit = limits.flatMap(horseLimit => limits.filter(peer => peer.layer !== horseLimit.layer).map(peer => {
    const luAtHorse = horseLimit.horseCompanions.find(row => row.star === '本命禄存');
    const productChang = horseLimit.horseCompanions.find(row => row.star === '流昌');
    const ziAndFu = peer.horseCompanions.filter(row => ['紫微', '天府'].includes(row.star));
    const shared = all([horseLimit.branch !== peer.branch, atSeat(horseLimit.horseRelation), inArea(peer.horseRelation),
      inArea(luAtHorse?.relation), ...ziAndFu.map(row => inArea(row.relation))]);
    return { horseLayer: horseLimit.layer, peerLayer: peer.layer,
      candidate: all([shared, inArea(productChang?.relation)]),
      lumingCandidate: all([shared, inArea(horseLimit.lumingChangRelation)]) };
  }));
  const decadal = limits.find(row => row.layer === 'decadal');
  const commonMinor = limits.find(row => row.layer === 'minor');
  const annualHuaLu = decadal?.annualLu.find(row => row.kind === '化禄');
  const sharedLimit = decadal && commonMinor && decadal.branch === commonMinor.branch;
  const sameAnnualChang = annualChang.branch === undefined || lumingChang === undefined ? undefined : annualChang.branch === lumingChang;
  const annualChangAgreement = sameAnnualChang === undefined ? undefined
    : { annualStem, jielanBranch: annualChang.branch, lumingBranch: lumingChang, agrees: sameAnnualChang };
  const companionsAtSharedLimit = decadal?.horseCompanions.map(row => atSeat(row.relation)) ?? [];
  const horseChangJielanDoubleGuardCandidate = all([sharedLimit, atSeat(decadal?.horseRelation),
    ...companionsAtSharedLimit]);
  const horseChangJielanDoubleGuardWitness = horseChangJielanDoubleGuardCandidate === true && decadal ? {
    branch: decadal.branch, annualStem,
    stars: [{ star: '本命天马', branch: horse, relation: '守' }, ...decadal.horseCompanions],
  } : undefined;
  const horseChangDoubleGuardAgreementCandidate = all([horseChangJielanDoubleGuardCandidate, sameAnnualChang]);
  const horseChangDoubleGuardAgreementWitness = horseChangDoubleGuardAgreementCandidate === true ? horseChangJielanDoubleGuardWitness : undefined;
  const horseLuAtSharedLimit = decadal?.horseCompanions.find(row => row.star === '本命禄存');
  const ziAtHorseLimit = decadal?.horseCompanions.find(row => row.star === '紫微');
  const fuAtHorseLimit = decadal?.horseCompanions.find(row => row.star === '天府');
  const horseLuChangAtSharedLimit = all([sharedLimit, sameAnnualChang, atSeat(decadal?.horseRelation),
    atSeat(horseLuAtSharedLimit?.relation), atSeat(relation(decadal?.branch, annualChang.branch))]);
  const distinctZiFu = ziAtHorseLimit?.branch === undefined || fuAtHorseLimit?.branch === undefined ? undefined
    : ziAtHorseLimit.branch !== fuAtHorseLimit.branch;
  const horseChangZiFuTrineDoubleGuardCandidate = all([horseLuChangAtSharedLimit,
    atTrine(ziAtHorseLimit?.relation), atTrine(fuAtHorseLimit?.relation), distinctZiFu]);
  const horseChangZiFuTrineDoubleGuardWitness = horseChangZiFuTrineDoubleGuardCandidate === true && decadal ? {
    branch: decadal.branch, annualStem,
    stars: [{ star: '本命天马', branch: horse, relation: '守' }, ...decadal.horseCompanions], annualChangAgreement,
  } : undefined;
  const ziFuOpposition = [ziAtHorseLimit, fuAtHorseLimit].map(row => row?.relation === undefined ? undefined : row.relation === '冲');
  const horseChangZiFuOpposedDoubleGuardCandidate = all([horseLuChangAtSharedLimit, ...ziFuOpposition]);
  const horseChangZiFuOpposedDoubleGuardWitness = horseChangZiFuOpposedDoubleGuardCandidate === true && decadal ? {
    branch: decadal.branch, annualStem,
    stars: [{ star: '本命天马', branch: horse, relation: '守' }, ...decadal.horseCompanions], annualChangAgreement,
  } : undefined;
  // Zhong's footnote to the Horse passage gives Luming Chang as its own placement method.
  const agreedHorseGuard = [horseChangDoubleGuardAgreementCandidate, horseChangZiFuTrineDoubleGuardCandidate,
    horseChangZiFuOpposedDoubleGuardCandidate].includes(true);
  const horseChangLumingDoubleGuardCandidate = all([sharedLimit, decadal?.lumingHorseCandidate, !agreedHorseGuard]);
  const horseChangLumingDoubleGuardWitness = horseChangLumingDoubleGuardCandidate === true && decadal ? {
    branch: decadal.branch, annualStem,
    stars: [{ star: '本命天马', branch: horse, relation: '守' }, ...decadal.horseCompanions.filter(row => row.star !== '流昌'),
      { star: '禄命流昌', branch: lumingChang, relation: decadal.lumingChangRelation }],
  } : undefined;
  const distinctMovingSeats = annualChang.branch === undefined || annualQu.branch === undefined
    ? undefined : annualChang.branch !== annualQu.branch;
  const distinctSunAndHuaLu = annualHuaLu?.star === undefined ? undefined : annualHuaLu.star !== '太阳';
  const movingChangQuBothLimitsTrineCandidate = all([sharedLimit, distinctMovingSeats, movingAtLife, atTrine(decadal?.sunRelation),
    distinctSunAndHuaLu, atTrine(annualHuaLu?.relation), ...(decadal?.moving.map(row => atTrine(row.relation)) ?? [])]);
  const movingChangQuSharedLimitsGuardLife = all([sharedLimit, atSeat(relation(lifeBranch, decadal?.branch))]);
  const movingChangQuAnnualHuaLuTrineConfirmed = all([movingChangQuBothLimitsTrineCandidate, sameAnnualChang,
    movingChangQuSharedLimitsGuardLife]);
  const movingChangQuBothLimitsTrineWitness = movingChangQuBothLimitsTrineCandidate === true && decadal ? {
    branch: decadal.branch, lifeBranch, annualStem, moving: decadal.moving,
    sun: { star: '太阳', branch: sun, relation: decadal.sunRelation }, annualLu: annualHuaLu,
    annualChangAgreement,
  } : undefined;
  const eitherLimit = (select: (limit: typeof limits[number]) => Condition) => any([
    decadal && select(decadal), commonMinor && select(commonMinor),
  ]);
  return { ready: true, profile: quanshuLiteraryLimitsPolicy.profile, lunarYear, annualStem, annualBranch, decadalBranch, minorBranch,
    sourceDecadal, limitPlacementProof: quanshuLimitPlacementProof,
    limitEncounterProof: quanshuLiteraryLimitsPolicy.limitEncounterProof,
    sourceMinor: transformed.sourceMinor, chang, changGrade, changNanyangGrade, changContacts, sun, horse, limits, lifeBranch,
    horseSplit: horseSplit.filter(row => row.candidate === true).map(({ horseLayer, peerLayer }) => ({ horseLayer, peerLayer, candidate: true })),
    lumingChangProfile: quanshuLiteraryLimitsPolicy.lumingChang, lumingChang,
    lumingHorseSplit: horseSplit.filter(row => row.lumingCandidate === true).map(({ horseLayer, peerLayer }) => ({ horseLayer, peerLayer })),
    changThreeLayersCandidate: all(Object.values(changContacts).map(inArea)),
    changVerifiedTripleGuard: all([verifiedDoubleChangGuard, atSeat(changContacts.yearly)]),
    keMajorBirthAnchorProof: quanshuLiteraryLimitsPolicy.keMajorBirthAnchor, keMajorBirthAnchorVerified,
    keChangVerifiedDoubleGuard, keChangVerifiedWitness: keChangVerifiedDoubleGuard === true ? natalKe : undefined,
    keChangMingNatalDoubleGuard, keChangMingNatalDoubleGuardProfile: quanshuLiteraryLimitsPolicy.keMingNatalDoubleGuard,
    keChangMingNatalDoubleGuardWithKeAspect, keChangMingNatalDoubleGuardWithKeAspectWitness,
    keChangMingNatalKeAtDoubleGuardWithChangAspect, keChangMingNatalKeAtDoubleGuardWithChangAspectWitness,
    keChangVerifiedSiblingLimitProfile: quanshuLiteraryLimitsPolicy.keSiblingLimits,
    keChangVerifiedOpposedLimit, keChangVerifiedTrineLimit, keChangVerifiedSiblingWitness,
    keChangMingGengProfile: quanshuLiteraryLimitsPolicy.keMingGeng,
    keChangMingGengDoubleGuard, keChangMingGengOpposedLimit, keChangMingGengTrineLimit, keChangMingGengWitness,
    keChangMingGengSharedLimitAspect, keChangMingGengSharedLimitAspectWitness,
    quanshuFixedFireBellProfile: transformed.quanshuFixedFireBellProfile,
    changQuanshuFixedAdverseCandidate: eitherLimit(seat => seat.changQuanshuFixedAdverse),
    changQuanshuFixedTrineShaJiCandidate: eitherLimit(seat => seat.changQuanshuFixedTrineShaJi),
    changAdverseCandidate: eitherLimit(seat => seat.changAdverse),
    changTrineShaJiCandidate: eitherLimit(seat => seat.changTrineShaJi),
    keChangCandidate: eitherLimit(limit => any(limit.ke.map(row => row.candidate))),
    keChangAspectCandidate: eitherLimit(limit => any(limit.ke.map(row => row.aspectCandidate))),
    keChangSharedAspectCandidate: eitherLimit(limit => any(limit.ke.map(row => row.sharedAspectCandidate))),
    keChangSplitAspectCandidate: eitherLimit(limit => any(limit.ke.map(row => row.splitAspectCandidate))),
    movingChangQuCandidate: eitherLimit(row => row.movingCandidate),
    movingChangQuAssistantCandidate: eitherLimit(row => row.movingAssistantCandidate),
    movingChangQuNamedTrinesCandidate: eitherLimit(row => row.movingNamedTrinesCandidate),
    movingChangQuMixedNamedTrinesCandidate: eitherLimit(row => row.movingMixedNamedTrines),
    movingChangQuMixedNamedTrinesWitness: [decadal, commonMinor].flatMap(row => row?.mixedNamedTrineWitness ? [row.mixedNamedTrineWitness] : []),
    jielanAnnualChangProfile: quanshuLiteraryLimitsPolicy.jielanAnnualChang,
    movingChangQuLifeAndCommonMinorTrinesCandidate: commonMinor?.movingLifeAndCommonMinorTrines,
    movingChangQuCommonMinorTrineWitness: commonMinor?.commonMinorTrineWitness,
    movingChangQuBothLimitsTrineCandidate, movingChangQuBothLimitsTrineWitness, movingChangQuSharedLimitsGuardLife,
    movingChangQuAnnualHuaLuTrineConfirmed,
    movingChangQuNatalTransformCandidate: eitherLimit(row => row.movingNatalTransformCandidate),
    movingChangQuSourceSeatsCandidate: eitherLimit(row => row.movingSourceSeatsCandidate),
    horseChangJielanDoubleGuardCandidate, horseChangJielanDoubleGuardWitness,
    horseChangDoubleGuardAgreementCandidate, horseChangDoubleGuardAgreementWitness,
    horseChangZiFuTrineDoubleGuardCandidate, horseChangZiFuTrineDoubleGuardWitness,
    horseChangZiFuOpposedDoubleGuardCandidate, horseChangZiFuOpposedDoubleGuardWitness,
    horseChangLumingDoubleGuardCandidate, horseChangLumingDoubleGuardWitness,
    horseChangCandidate: eitherLimit(row => row.horseCandidate),
    horseChangSplitCandidate: horseSplit.length ? any(horseSplit.map(row => row.candidate)) : undefined,
    lumingHorseChangCandidate: eitherLimit(row => row.lumingHorseCandidate),
    lumingHorseChangSplitCandidate: horseSplit.length ? any(horseSplit.map(row => row.lumingCandidate)) : undefined } as const;
}
