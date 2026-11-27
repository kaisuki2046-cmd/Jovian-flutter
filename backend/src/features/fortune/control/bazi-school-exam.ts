import { baziElementRelation, baziInteractions, baziLiuHePartner, baziNatalVoidSources, describeBaZiPillar, smthLuNextBranch } from './bazi-calculation';
import { lunarAtBeijing } from './fortune-calendar';

const stems = '甲乙丙丁戊己庚辛壬癸';
const officerPositions = '申申亥亥寅寅巳巳亥亥';
const yangNobles = '未申酉亥丑子丑寅卯巳';
const yinNobles = '丑子亥酉未申未午巳卯';
const nayinSeals: Readonly<Record<string, string>> = { 金: '乙丑', 木: '癸未', 火: '甲戌', 水: '壬辰', 土: '丙辰' };
const nayinLinguan: Readonly<Record<string, string>> = { 金: '申', 木: '寅', 火: '巳', 水: '亥', 土: '亥' };
type Natal = { utc: string; year: string; month: string; day: string; hour?: string };

// The cited Chen Xilie passage names these three birth-branch groups.
const nobleStemGroups = [
  { branches: '丑未', stems: '甲戊庚' }, { branches: '子申', stems: '乙己' }, { branches: '酉亥', stems: '丙丁' },
];

export const baziSchoolExamPolicy = {
  profile: 'smth-school-exam-atomic-v1',
  month: 'same-month-and-year-pair-combination-or-same-direction-generation',
  officer: 'officer-linguan-from-school-chapter-year-and-day-bases-separated',
  noble: 'tongxuan-two-tables-with-birth-solstice-as-one-attested-reading',
  seal: 'volume3-full-pillar-nayin-storehouse-and-day-stem-ten-god-separated',
  review: 'smth-school-exam-documented-positions-v4',
} as const;

export function schoolExamNobleSeason(birthAt: number) {
  if (!Number.isFinite(birthAt)) return undefined;
  const lunar = lunarAtBeijing(birthAt);
  const terms = (lunar as typeof lunar & { getJieQiTable(): Record<string, { toYmdHms(): string }> }).getJieQiTable();
  const starts = [
    ...['冬至', 'DONG_ZHI'].map(key => ({ key, season: '阳贵' as const })),
    ...['夏至', 'XIA_ZHI'].map(key => ({ key, season: '阴贵' as const })),
  ].flatMap(({ key, season }) => {
    const term = terms[key]?.toYmdHms();
    const start = term ? Date.parse(term.replace(' ', 'T') + '+08:00') : NaN;
    return Number.isFinite(start) && start <= birthAt ? [{ season, start }] : [];
  });
  return starts.sort((a, b) => b.start - a.start)[0];
}

export function smthTianyiBranches(stem: string, season?: '阳贵' | '阴贵') {
  const index = stems.indexOf(stem);
  const yangBranch = yangNobles[index], yinBranch = yinNobles[index];
  const chosenNobleBranch = season === '阳贵' ? yangBranch : season === '阴贵' ? yinBranch : undefined;
  return { yangBranch, yinBranch, chosenNobleBranch };
}

export function baziSchoolExamContext(natal: Natal, timeKnown: boolean, annualPillar: string, luckPillar?: string) {
  const dayStem = natal.day[0], natalYearStem = natal.year[0], year = describeBaZiPillar(annualPillar, dayStem);
  const sourceMonth = describeBaZiPillar(natal.month);
  const compared = baziInteractions([{ id: 'month', pillar: natal.month }, { id: 'annual', pillar: annualPillar }]);
  const monthRelations = compared.pairs.map(pair => pair.kind);
  const jointMonthCombination = monthRelations.includes('天干五合') && monthRelations.includes('六合');
  const jointMonthOpposition = monthRelations.includes('天干四冲') && monthRelations.includes('六冲');
  const monthBranchFriction = monthRelations.filter(kind => ['相刑', '六冲', '六害', '六破'].includes(kind));
  const stemRelation = compared.elemental.find(row => row.part === 'stem')?.kind;
  const branchRelation = compared.elemental.find(row => row.part === 'branch')?.kind;
  const verifiedMonthBranchCombination = monthRelations.includes('六合') && !jointMonthCombination
    && monthBranchFriction.length === 0 && !monthRelations.includes('天干四冲')
    && (stemRelation === '同五行' || stemRelation === '前生后' || stemRelation === '后生前');
  const isolatedMonthStemCombination = monthRelations.includes('天干五合') && !jointMonthCombination
    && !monthRelations.includes('天干四冲') && monthBranchFriction.length === 0;
  const verifiedMonthStemCombination = isolatedMonthStemCombination && branchRelation === '同五行';
  const verifiedMonthStemCombinationWithBranchGeneration = isolatedMonthStemCombination
    && (branchRelation === '前生后' || branchRelation === '后生前');
  const monthGenerationDirection = stemRelation !== branchRelation ? undefined
    : stemRelation === '前生后' ? 'month-to-annual' : stemRelation === '后生前' ? 'annual-to-month' : undefined;
  const monthPairAssessment = jointMonthCombination
    ? monthBranchFriction.length ? 'combination-with-friction' : 'stem-branch-combination'
    : jointMonthOpposition ? 'stem-branch-opposition'
      : monthGenerationDirection ? monthBranchFriction.length ? 'generation-with-friction' : 'same-direction-generation' : undefined;
  const monthHarmonyCandidate = jointMonthCombination || verifiedMonthBranchCombination || verifiedMonthStemCombination
    || verifiedMonthStemCombinationWithBranchGeneration || monthPairAssessment === 'same-direction-generation'
    ? true : jointMonthOpposition ? false : undefined;
  const monthNayinRelation = baziElementRelation(sourceMonth.naYin?.slice(-1) ?? '', year.naYin?.slice(-1) ?? '');
  const corroboratedMonthGeneration = monthPairAssessment === 'same-direction-generation' && monthNayinRelation === stemRelation;

  const birthNayin = describeBaZiPillar(natal.year).naYin;
  const birthNayinElement = birthNayin?.slice(-1) ?? '';
  const sealPillar = nayinSeals[birthNayinElement];
  const nayinStorehouseSeal = sealPillar === undefined ? undefined : annualPillar === sealPillar;
  const nayinSealVoidSources = nayinStorehouseSeal ? baziNatalVoidSources(natal, year.branch) : [];
  const nayinSealVoidBoth = nayinSealVoidSources.length === 2;
  const sealPartner = nayinSealVoidSources.length ? baziLiuHePartner(year.branch) : undefined;
  const nayinSealVoidCombinations = sealPartner ? (['year', 'month', 'day', 'hour'] as const).flatMap(position => {
    const pillar = position === 'hour' && !timeKnown ? undefined : natal[position];
    return pillar && pillar[1] === sealPartner ? [{ position, pillar }] : [];
  }) : [];
  // 承接〈论正印〉的「最忌刑衝破害」，逐柱核该岁库印本身是否受损。
  const nayinSealNatalDamage = nayinStorehouseSeal ? (['year', 'month', 'day', 'hour'] as const).flatMap(position => {
    const pillar = position === 'hour' && !timeKnown ? undefined : natal[position];
    return pillar ? baziInteractions([{ id: position, pillar }, { id: 'annual', pillar: annualPillar }]).pairs
      .filter(pair => ['相刑', '六冲', '六破', '六害'].includes(pair.kind))
      .map(pair => ({ kind: pair.kind, position, natalPillar: pillar, annualPillar, branches: pair.values })) : [];
  }) : [];
  // 原文直接排除的年命同纳音自刑仍按原口径处理，其他实损先阻止确认。
  const sealPunishment = nayinSealNatalDamage.find(pair => pair.position === 'year' && pair.kind === '相刑');
  const nayinSealSameElementPunishment = sealPunishment
    ? { birthPillar: natal.year, annualPillar, branches: sealPunishment.branches, element: birthNayinElement } : undefined;
  const nayinSealNamedPunishment = sealPunishment && natal.year === '庚戌' && annualPillar === '乙丑'
    ? { birthPillar: natal.year, annualPillar, branches: sealPunishment.branches } : undefined;
  const dayStemSeal = year.tenGod === '正印';
  const season = timeKnown ? schoolExamNobleSeason(Date.parse(natal.utc)) : undefined;
  const bases = ([['year', natalYearStem], ['day', dayStem]] as const).map(([basis, stem]) => {
    const index = stems.indexOf(stem);
    const officerBranch = officerPositions[index], { luBranch } = smthLuNextBranch(stem);
    const { yangBranch, yinBranch, chosenNobleBranch } = smthTianyiBranches(stem, season?.season);
    const nobleContact = chosenNobleBranch ? year.branch === chosenNobleBranch : undefined;
    const branchLu = year.branch === luBranch;
    const seal = basis === 'year' ? nayinStorehouseSeal && !nayinSealVoidBoth && !nayinSealSameElementPunishment : dayStemSeal;
    const supports = [
      ...(seal === true ? ['正印'] : []),
      ...(nobleContact === true ? ['天乙'] : []),
      ...(branchLu ? ['禄'] : []),
    ];
    return { basis, stem, officerBranch, luBranch, yangBranch, yinBranch, chosenNobleBranch, nobleContact, branchLu, supports,
      officerContact: luckPillar ? luckPillar[1] === officerBranch : undefined };
  });
  const birthBranch = natal.year[1];
  // Volumes three and ten give these explicit reverse-direction examples.
  // Apply only their named birth-branch / arriving-stem pairs.
  const documentedSupports = [
    ...('丑未'.includes(birthBranch) && '甲戊庚'.includes(year.stem) ? ['正天乙原例'] : []),
    ...(birthBranch === '寅' && year.stem === '甲' ? ['本家禄原例'] : []),
  ];
  // 本家祿 checks the birth-year branch against the arriving stem's Lu,
  // separately from checking the birth-year stem against the arriving branch.
  const annualStemLuBranch = smthLuNextBranch(year.stem).luBranch;
  const annualFamilyLu = birthBranch === annualStemLuBranch;
  const nobleGroup = nobleStemGroups.find(group => group.branches.includes(birthBranch) && group.stems.includes(year.stem));
  const natalNobleMembers = nobleGroup && timeKnown && natal.hour ? (['month', 'day', 'hour'] as const).flatMap(position => {
    const pillar = natal[position];
    return pillar && nobleGroup.stems.includes(pillar[0]) ? [{ position, stem: pillar[0] }] : [];
  }) : undefined;
  const distinctNatalStems = new Set(natalNobleMembers?.map(row => row.stem));
  const annualNobleGroup = nobleGroup && natalNobleMembers ? {
    requiredStemPool: nobleGroup.stems, natalMembers: natalNobleMembers,
    natalGroupComplete: distinctNatalStems.size >= 2,
    annualCompletesGroup: distinctNatalStems.size === 1 && !distinctNatalStems.has(year.stem),
  } : undefined;
  const otherFamilyLu = annualFamilyLu && !documentedSupports.includes('本家禄原例');
  const completesNobleGroup = annualNobleGroup?.annualCompletesGroup === true;
  const luckNayin = luckPillar ? describeBaZiPillar(luckPillar).naYin : undefined;
  const linguanBranch = nayinLinguan[birthNayinElement];
  const yearSupports = [...bases[0].supports, ...documentedSupports,
    ...(otherFamilyLu ? ['本家禄'] : []), ...(completesNobleGroup ? ['岁干补齐天乙干组'] : [])];
  const nayinOffice = luckPillar && linguanBranch ? {
    linguanBranch, luckNayin,
    sameElement: luckNayin?.slice(-1) === birthNayinElement,
    matchesBranch: luckPillar[1] === linguanBranch,
    supports: yearSupports,
  } : undefined;
  const corroboratedYearOffice = luckPillar ? bases[0].officerContact === true
    && nayinOffice?.sameElement === true && nayinOffice.matchesBranch : undefined;
  const corroboratedNayinSealAtOffice = luckPillar ? corroboratedYearOffice === true && nayinStorehouseSeal === true
    && timeKnown && Boolean(natal.hour) && nayinSealVoidSources.length === 0 && nayinSealNatalDamage.length === 0 : undefined;
  const corroboratedFamilyLuAtOffice = luckPillar ? corroboratedYearOffice === true && annualFamilyLu : undefined;
  const corroboratedNobleAtOffice = luckPillar ? corroboratedYearOffice === true && bases[0].nobleContact === true
    && completesNobleGroup : undefined;
  const stemOfficeSupport = bases.some(row => row.officerContact && row.supports.length > 0);
  const examSupportRoutes = luckPillar ? [
    ...(stemOfficeSupport ? ['stem-office'] : []),
    ...(bases[0].officerContact && documentedSupports.length ? ['documented-year-support'] : []),
    ...(bases[0].officerContact && otherFamilyLu ? ['annual-family-lu'] : []),
    ...(bases[0].officerContact && completesNobleGroup && !documentedSupports.includes('正天乙原例') ? ['annual-noble-group'] : []),
    ...(nayinOffice?.sameElement && nayinOffice.matchesBranch && yearSupports.length ? ['nayin-office'] : []),
  ] : undefined;
  return { profile: baziSchoolExamPolicy.profile, examReviewProfile: baziSchoolExamPolicy.review,
    annualPillar, natalMonth: natal.month, birthBranch, birthNayin, annualNayin: year.naYin,
    monthNayin: sourceMonth.naYin, monthRelations, monthElements: compared.elemental, monthNayinRelation, corroboratedMonthGeneration,
    monthHarmonyCandidate, jointMonthCombination, jointMonthOpposition, verifiedMonthBranchCombination, verifiedMonthStemCombination,
    verifiedMonthStemCombinationWithBranchGeneration,
    monthPairAssessment, monthBranchFriction, monthGenerationDirection,
    sealPillar, nayinStorehouseSeal, nayinSealVoidSources, nayinSealVoidBoth, nayinSealVoidCombinations, nayinSealNamedPunishment,
    nayinSealSameElementPunishment, nayinSealNatalDamage,
    dayStemSeal, annualStemTenGod: year.tenGod, season: season?.season, seasonStart: season ? new Date(season.start).toISOString() : undefined,
    luckPillar, confirmed: luckPillar ? true : undefined, bases,
    documentedSupports, annualStemLuBranch, annualFamilyLu, annualNobleGroup, nayinOffice, corroboratedNayinSealAtOffice,
    corroboratedFamilyLuAtOffice, corroboratedNobleAtOffice, examSupportRoutes,
    examSupportCandidate: examSupportRoutes ? examSupportRoutes.length > 0 : undefined,
  };
}
