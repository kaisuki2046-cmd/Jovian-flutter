import { baziColumnRoles, baziElementRelation, baziInteractions, baziStemControls, baziStemFeeds, describeBaZiPillar, smthHorseBranch,
  smthLuNextBranch, smthNaYinPhase } from './bazi-calculation';
import { schoolExamNobleSeason, smthTianyiBranches } from './bazi-school-exam';
import { smthHorseSeatReview } from './bazi-smth-horse';
import { smthMonthDuty } from './bazi-smth-month-duty';

export { smthLuNextBranch } from './bazi-calculation';

const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const sourceStemBirthBranches = '亥午寅酉寅酉巳子申卯';
type Natal = { year: string; month: string; day: string; hour: string };
const layers = ['year', 'month', 'day', 'hour'] as const;
export const baziAnnualLuckPolicy = {
  profile: 'smth-annual-luck-atomic-v1',
  selection: 'archived-table-recomputed-sect2-v1',
  calendar: 'beijing-li-chun-year-and-exact-confirmed-luck-transition',
  blade: 'volume3-lu-next-branch-year-and-day-bases-kept-separate',
  stemExceptions: 'volume2-stem-exceptions-volume5-one-killer-and-volume10-branch-wealth-v1',
  officerControls: 'smth-volume-two-officer-control-positions-v1',
  wealthReview: 'smth-volume-two-luck-wealth-roots-and-contacts-v1',
  taiSui: 'smth-volume2-tai-sui-participants-v7',
  foundation: 'smth-volume2-natal-foundation-luck-v6',
  outcome: 'no-strength-usefulness-rescue-or-branch-priority-inference',
} as const;

function validPillar(value: string) {
  return typeof value === 'string' && value.length === 2 && stems.includes(value[0]) && branches.includes(value[1])
    && stems.indexOf(value[0]) % 2 === branches.indexOf(value[1]) % 2;
}
// One stated reading of 卷二〈论天干阴阳生死〉, with the source's
// yang-forward / yin-backward sequence and the twelve-stage order.
export function smthStemGrowthBranches(stem: string) {
  const index = stems.indexOf(stem);
  if (stem.length !== 1 || index < 0) throw new RangeError('Invalid source stem');
  const birth = sourceStemBirthBranches[index];
  const forward = index % 2 === 0;
  return { birth, peak: branches[(branches.indexOf(birth) + (forward ? 4 : 8)) % 12] };
}

const wealth = (god: string | undefined) => god === '正财' || god === '偏财';
const wealthOfficerSeal = ['正财', '偏财', '正官', '正印', '偏印'];
const control = ['前克后', '后克前'];
const branchContention = ['六冲', '相刑', '六破', '六害'];
const contention = ['天干四冲', ...branchContention];
const jiaBladeHeads: Partial<Record<string, '财' | '鬼'>> = { 己卯: '财', 辛卯: '鬼' };
const jiaBladeTruePillars: Readonly<Record<string, readonly string[]>> = { sanming: ['乙卯', '丁卯'], jingji: ['丁卯'] };
// 《五行精纪》卷二十四单列十干真羊刃干头，与同篇的年干禄前刃支合看。
const jingjiTrueBladeStems: Readonly<Record<string, string>> = {
  甲: '丁', 乙: '庚', 丙: '甲', 丁: '丁', 戊: '戊', 己: '辛', 庚: '乙', 辛: '戊', 壬: '壬', 癸: '乙',
};
const repeatYearStemGenerationPatterns: Partial<Record<string, string>> = {
  '前生后/前生后': 'both-feed-year',
  '后生前/后生前': 'year-feeds-both',
  '前生后/后生前': 'day-feeds-year-feeds-luck',
  '后生前/前生后': 'luck-feeds-year-feeds-day',
};

// 卷三分别载禄前羊刃、甲干真偏例及子平五阳干取法。
function smthCoincidentBlades(natal: Pick<Natal, 'year' | 'day'>, pillar: string) {
  return (['year', 'day'] as const).flatMap(basis => {
    const stem = natal[basis][0];
    const { luBranch, bladeBranch } = smthLuNextBranch(stem);
    if (pillar[1] !== bladeBranch) return [];
    const jiaType = stem === '甲' ? jiaBladeTruePillars.sanming.includes(pillar) ? 'true_blade' : 'secondary_blade' : undefined;
    const jiaHead = stem === '甲' ? jiaBladeHeads[pillar] : undefined;
    const ziPingDayBlade = basis === 'day' ? '甲丙戊庚壬'.includes(stem) : undefined;
    return [{ basis, stem, luBranch, bladeBranch, jiaType, jiaHead, ziPingDayBlade }];
  });
}

type TaiSuiNatal = Pick<Natal, 'year' | 'day'> & Partial<Pick<Natal, 'month' | 'hour'>> & { utc?: string };

function smthCoincidentBladeReview(natal: Natal, annual: string, blade: ReturnType<typeof smthCoincidentBlades>[number]) {
  const columns = layers.map(position => ({ position, pillar: natal[position] }));
  const natalBladeHolders = columns.filter(row => row.pillar[1] === blade.bladeBranch);
  const natalLuHolders = columns.filter(row => row.pillar[1] === blade.luBranch);
  const exposed = columns.flatMap(({ position, pillar }) => baziColumnRoles(position, pillar, blade.stem))
    .filter(row => row.placement === 'stem');
  const seals = exposed.filter(row => row.god === '正印' || row.god === '偏印');
  const officerSealLinks = exposed.filter(row => row.god === '正官')
    .flatMap(officer => seals.filter(seal => baziStemFeeds(officer.stem, seal.stem)).map(seal => ({ officer, seal })));
  const jiaYearSources = blade.basis === 'year' && blade.stem === '甲'
    ? Object.entries(jiaBladeTruePillars).map(([edition, truePillars]) => ({
      edition, annualTrue: truePillars.includes(annual),
      natalTrueHolders: natalBladeHolders.filter(row => truePillars.includes(row.pillar)),
    })) : undefined;
  const jingjiYearBlade = blade.basis === 'year' && blade.stem !== '甲' ? {
    truePillar: jingjiTrueBladeStems[blade.stem] + blade.bladeBranch,
    annualTrue: annual[0] === jingjiTrueBladeStems[blade.stem],
    natalTrueHolders: natalBladeHolders.filter(row => row.pillar[0] === jingjiTrueBladeStems[blade.stem]),
  } : undefined;
  const repeatedWithLu = natalBladeHolders.length > 0 && natalLuHolders.length > 0;
  return { basis: blade.basis, stem: blade.stem, natalBladeHolders, natalLuHolders, repeatedWithLu,
    officerSealLinks, repeatedWithLuAndOfficerSeal: repeatedWithLu && officerSealLinks.length > 0, jiaYearSources, jingjiYearBlade };
}

// 卷一列出的整柱例外：五行到长生支，遇该整柱仍受制。
const naYinRestrictedBirths: Readonly<Record<string, string>> = { 土: '庚申', 水: '戊申', 火: '甲寅', 金: '乙巳', 木: '辛亥' };

function smthHorseExchangeNaYin(yearPillar: string, luckPillar: string) {
  const atOpposite = (pillar: string, oppositePillar: string) => {
    const naYin = describeBaZiPillar(pillar).naYin;
    if (!naYin) return undefined;
    const element = naYin.slice(-1);
    const phase = smthNaYinPhase(element, oppositePillar[1]);
    if (!phase) return undefined;
    return { naYin, element, oppositePillar, phase,
      restrictedBirth: phase === '长生' && naYinRestrictedBirths[element] === oppositePillar };
  };
  const annual = atOpposite(yearPillar, luckPillar), luck = atOpposite(luckPillar, yearPillar);
  if (!annual || !luck) return undefined;
  const growthPositions = ([['annual', annual], ['luck', luck]] as const)
    .filter(([, row]) => !row.restrictedBirth && ['长生', '临官', '帝旺'].includes(row.phase))
    .map(([position]) => position);
  return { annual, luck, relation: baziElementRelation(annual.element, luck.element), growthPositions };
}

function smthTaiSuiExchanges(natal: TaiSuiNatal, yearPillar: string, luckPillar: string) {
  const annualBranch = yearPillar[1], luckBranch = luckPillar[1];
  const exchange = (annualTarget: string, luckTarget: string) => {
    const luckAtAnnualTarget = luckBranch === annualTarget, annualAtLuckTarget = annualBranch === luckTarget;
    return { annualTarget, luckTarget, luckAtAnnualTarget, annualAtLuckTarget,
      mutual: annualBranch !== luckBranch && luckAtAnnualTarget && annualAtLuckTarget };
  };
  const lu = exchange(smthLuNextBranch(yearPillar[0]).luBranch, smthLuNextBranch(luckPillar[0]).luBranch);
  const horse = exchange(smthHorseBranch(annualBranch)!, smthHorseBranch(luckBranch)!);
  const nobleSeason = natal.utc ? schoolExamNobleSeason(Date.parse(natal.utc))?.season : undefined;
  const nobles = nobleSeason && (['year', 'day'] as const).map(basis => {
    const stem = natal[basis][0];
    const { chosenNobleBranch: branch } = smthTianyiBranches(stem, nobleSeason);
    const positions = [{ position: 'annual', branch: annualBranch }, { position: 'luck', branch: luckBranch }]
      .filter(row => row.branch === branch).map(row => row.position);
    return { basis, stem, branch, positions };
  });
  const moving = [{ id: 'annual', pillar: yearPillar }, { id: 'luck', pillar: luckPillar }];
  const seated = moving.filter(row => row.id === 'annual' ? horse.annualAtLuckTarget : horse.luckAtAnnualTarget);
  const natalColumns = layers.flatMap(basis => natal[basis] ? [{ id: 'natal:' + basis, pillar: natal[basis] }] : []);
  const pairs = seated.length ? baziInteractions([...natalColumns, ...moving]).pairs : [];
  const seats = seated.map(({ id: position, pillar }) => ({
    ...smthHorseSeatReview(natal, { position, pillar }, pairs),
    luBases: (['year', 'day'] as const).filter(basis => smthLuNextBranch(natal[basis][0]).luBranch === pillar[1]),
    nobleBases: nobles?.filter(row => row.positions.includes(position)).map(row => row.basis),
  }));
  return { lu, horse: { ...horse, naYin: horse.mutual ? smthHorseExchangeNaYin(yearPillar, luckPillar) : undefined },
    nobleSeason, nobles, horseSeats: seats };
}

// 卷二〈论太岁〉 distinguishes the gods on the coinciding pillar and
// compares the annual pillar with the current luck and day separately.
export function baziSmthTaiSuiContext(natal: TaiSuiNatal, yearPillar: string, luckPillar: string) {
  const coincidentBlades = yearPillar === luckPillar ? smthCoincidentBlades(natal, yearPillar) : undefined;
  const fullNatal = natal.month && natal.hour ? { year: natal.year, month: natal.month, day: natal.day, hour: natal.hour } : undefined;
  const coincidentBladeReview = fullNatal && coincidentBlades?.map(blade => smthCoincidentBladeReview(fullNatal, yearPillar, blade));
  const coincidentRoles = yearPillar === luckPillar
    ? baziColumnRoles('annual', yearPillar, natal.day[0]).flatMap(({ stem, god, placement }) => {
      if (!god) return [];
      const kind = god === '七杀' ? '七杀' : wealthOfficerSeal.includes(god) ? '财官印' : undefined;
      return kind ? [{ stem, god, placement, kind }] : [];
    }) : undefined;
  const visibleCoincidentRole = coincidentRoles?.find(row => row.placement === 'stem');
  const coincidentSharedBasisRole = visibleCoincidentRole && natal.year[0] === natal.day[0]
    && !coincidentBlades?.length && coincidentRoles?.every(row => row.kind === visibleCoincidentRole.kind)
    ? visibleCoincidentRole.kind : undefined;
  const participants = [{ id: 'day', pillar: natal.day }, { id: 'luck', pillar: luckPillar }];
  const repeated = yearPillar === natal.year
    ? baziInteractions([...participants, { id: 'annual', pillar: yearPillar }]) : undefined;
  const repeatYearContacts = repeated && participants.map(({ id: position, pillar }) => {
    const relations = repeated.elemental.filter(row => row.from === position && row.to === 'annual');
    const contacts = repeated.pairs.filter(row => row.members[0] === position && row.members[1] === 'annual');
    return { position, pillar, stemRelation: relations.find(row => row.part === 'stem')?.kind,
      branchRelation: relations.find(row => row.part === 'branch')?.kind,
      contacts: contacts.map(row => row.kind) };
  });
  const repeatYearPunishments = repeated?.groups.filter(row => row.kind === '三刑');
  const repeatYearComparedPositions = repeatYearContacts?.filter(row => row.stemRelation && row.branchRelation).map(row => row.position);
  const compared = repeatYearComparedPositions?.length === 2 ? repeatYearContacts : undefined;
  const contentious = compared?.filter(row => control.includes(row.stemRelation ?? '') || control.includes(row.branchRelation ?? '')
    || row.contacts.some(contact => contention.includes(contact)));
  const repeatYearContentionPositions = contentious?.map(row => row.position);
  const repeatYearCombinationContentionPositions = contentious?.filter(row => row.contacts.includes('六合')
    || row.contacts.includes('天干五合')).map(row => row.position);
  const repeatYearFullPillarCombinations = compared?.filter(row => row.contacts.includes('天干五合') && row.contacts.includes('六合'));
  const day = compared?.find(row => row.position === 'day');
  const luck = compared?.find(row => row.position === 'luck');
  const repeatYearVerifiedLuckPillarCombination = day && luck ? repeatYearFullPillarCombinations?.includes(luck) === true
    && day.stemRelation === day.branchRelation && ['前生后', '后生前'].includes(day.stemRelation ?? '')
    && !repeatYearContentionPositions?.includes('day') && !control.includes(luck.branchRelation ?? '')
    && !luck.contacts.some(contact => contention.includes(contact)) && repeatYearPunishments?.length === 0 : undefined;
  const repeatYearStemGeneration = day && luck
    ? repeatYearStemGenerationPatterns[`${day.stemRelation}/${luck.stemRelation}`] ?? 'not-both-generating' : undefined;
  const directedControls = (row: NonNullable<typeof day>) => (['stem', 'branch'] as const).flatMap(part => {
    const relation = part === 'stem' ? row.stemRelation : row.branchRelation;
    if (relation === '前克后') return [{ part, source: row.position }];
    if (relation === '后克前') return [{ part, source: 'annual' }];
    return [];
  });
  const repeatYearLuckClashControls = luck?.contacts.includes('六冲') ? directedControls(luck) : undefined;
  const repeatYearCompoundContention = compared?.flatMap(row => {
    const frictions = row.contacts.filter(contact => branchContention.includes(contact));
    const controls = directedControls(row);
    return frictions.length && controls.length ? [{ position: row.position, pillar: row.pillar, frictions, controls }] : [];
  });
  const repeatYearMutualContentionAt = repeatYearCompoundContention?.filter(row =>
    row.controls.some(control => control.source === 'annual') && row.controls.some(control => control.source === row.position))
    .map(row => row.position);
  // The source's exception requires the double clash to have already been
  // present. The luck pillar can recreate it only when it repeats the natal hour.
  const isDoubleClash = (row: typeof day) => row?.contacts.includes('天干四冲') && row.contacts.includes('六冲');
  const repeatYearNatalLuckStrikeWitness = fullNatal && luck && luck.pillar === fullNatal.hour && isDoubleClash(luck)
    ? { natalYear: fullNatal.year, natalHour: fullNatal.hour, luck: luck.pillar, contacts: luck.contacts } : undefined;
  const repeatYearNatalRepeatedStrikeAt = compared && [
    ...(isDoubleClash(day) ? ['day'] : []),
    ...(repeatYearNatalLuckStrikeWitness ? ['luck'] : []),
  ];
  const repeatYearUnqualifiedMutualContentionAt = repeatYearMutualContentionAt?.filter(position =>
    !repeatYearNatalRepeatedStrikeAt?.includes(position));
  const uncontentiousGeneration = day && luck
    ? contentious?.length === 0 && repeatYearPunishments?.length === 0
      && repeatYearStemGeneration !== 'not-both-generating'
    : undefined;
  const repeatYearCompatibleCandidate = uncontentiousGeneration === undefined
    ? undefined : uncontentiousGeneration && luck?.stemRelation === luck?.branchRelation;
  const repeatYearCombinationCandidate = uncontentiousGeneration === undefined
    ? undefined : uncontentiousGeneration && luck?.contacts.includes('六合') === true;
  const repeatYearExchanges = repeated ? smthTaiSuiExchanges(natal, yearPillar, luckPillar) : undefined;
  const repeatYearMutualLuCandidate = compared && repeatYearExchanges?.lu.mutual === true
    && contentious?.length === 0 && repeatYearPunishments?.length === 0;
  const repeatYearVerifiedNobleLuHorsePositions = fullNatal && repeatYearExchanges?.nobleSeason
    ? repeatYearExchanges.horseSeats.filter(seat => seat.luBases.length && seat.nobleBases?.length
      && !seat.voidSources.length && !seat.progressRestriction && !seat.breakContacts.length).map(seat => seat.position)
    : undefined;
  return { taiSuiProfile: baziAnnualLuckPolicy.taiSui, coincidentRoles, coincidentSharedBasisRole,
    coincidentRoleGroups: coincidentRoles && [...new Set(coincidentRoles.map(row => row.kind))],
    coincidentBlades, coincidentBladeBases: coincidentBlades?.map(row => row.basis), coincidentBladeReview,
    repeatYearContacts, repeatYearComparedPositions, repeatYearContentionPositions, repeatYearCompatibleCandidate,
    repeatYearCombinationCandidate, repeatYearCombinationContentionPositions, repeatYearFullPillarCombinations,
    repeatYearVerifiedLuckPillarCombination,
    repeatYearPunishments, repeatYearStemGeneration, repeatYearLuckClashControls, repeatYearCompoundContention, repeatYearMutualContentionAt,
    repeatYearNatalRepeatedStrikeAt, repeatYearNatalLuckStrikeWitness, repeatYearUnqualifiedMutualContentionAt,
    repeatYearExchanges, repeatYearMutualLuCandidate, repeatYearVerifiedNobleLuHorsePositions,
  };
}

// Volume two lists the order 旺、相、休、囚、死 for each season,
// including its separate sixth-month rule. This is distinct from 十二宫.
const seasonalPowers = [
  { months: '寅卯辰', order: '木火水金土' }, { months: '巳午', order: '火土木水金' },
  { months: '未', order: '土金火木水' }, { months: '申酉戌', order: '金水土火木' },
  { months: '亥子丑', order: '水木金土火' },
];

export function smthSeasonalPowers(monthBranch: string) {
  const order = seasonalPowers.find(row => row.months.includes(monthBranch))?.order ?? '';
  return [...order].map((element, index) => ({ element, power: '旺相休囚死'[index] }));
}

const majorLuckDirections = [
  { element: '木', direction: '东', branches: '寅卯辰' },
  { element: '火', direction: '南', branches: '巳午未' },
  { element: '金', direction: '西', branches: '申酉戌' },
  { element: '水', direction: '北', branches: '亥子丑' },
];
const southwest = { element: '土', direction: '西南', branches: '未申' };

const smthLuckYangBranches = '子丑寅卯辰巳';

// 〈论大运〉在这段按子至巳、午至亥分阴阳。
export function smthMajorLuckPolarity(natal: Natal, luckPillar: string) {
  if (!validPillar(luckPillar) || !layers.every(position => validPillar(natal[position]))) return undefined;

  const yangPositions = layers.filter(position => smthLuckYangBranches.includes(natal[position][1]));
  const yinPositions = layers.filter(position => !yangPositions.includes(position));
  const luckBranch = luckPillar[1];
  const luckHalf = smthLuckYangBranches.includes(luckBranch) ? 'yang' : 'yin';
  const natalMajority = yangPositions.length === yinPositions.length ? 'even'
    : yangPositions.length > yinPositions.length ? 'yang' : 'yin';
  const condition = natalMajority === 'even' ? 'even'
    : natalMajority === luckHalf ? 'same-half'
      : luckHalf === 'yang' ? 'yin-into-yang' : 'yang-into-yin';
  return { yangPositions, yinPositions, luckBranch, luckHalf, natalMajority, condition };
}

// 〈属象〉定四方三支。《协纪辨方书》二十四山的未、申另列为坤位对照。
export function smthMajorLuckNaYin(yearPillar: string, luckPillar: string) {
  const yearNaYin = describeBaZiPillar(yearPillar).naYin;
  const { naYin: luckNaYin, branch: luckBranch } = describeBaZiPillar(luckPillar);
  if (!yearNaYin || !luckNaYin) return undefined;

  const yearElement = yearNaYin.slice(-1), luckElement = luckNaYin.slice(-1);
  const cardinal = majorLuckDirections.find(row => row.branches.includes(luckBranch));
  const expected = yearElement === '土' ? southwest : majorLuckDirections.find(row => row.element === yearElement);
  if (!cardinal || !expected) return undefined;

  return { yearPillar, yearNaYin, luckPillar, luckNaYin, luckBranch,
    cardinalDirection: cardinal.direction, inSouthwest: southwest.branches.includes(luckBranch),
    expectedDirection: expected.direction, directionMatches: expected.branches.includes(luckBranch),
    relation: baziElementRelation(yearElement, luckElement),
  };
}

const majorLuckExamples: ReadonlyArray<{ sourceCase: string; natalPillar: string; luckPillar: string;
  bases: readonly ('year' | 'month')[] }> = [
  { sourceCase: 'ding-chou-to-ding-wei', natalPillar: '丁丑', luckPillar: '丁未', bases: ['year'] },
  { sourceCase: 'wu-yin-to-ding-chou', natalPillar: '戊寅', luckPillar: '丁丑', bases: ['year'] },
  { sourceCase: 'geng-chen-and-yi-you', natalPillar: '庚辰', luckPillar: '乙酉', bases: ['year', 'month'] },
  { sourceCase: 'geng-chen-and-yi-you', natalPillar: '乙酉', luckPillar: '庚辰', bases: ['year', 'month'] },
  { sourceCase: 'jia-shen-to-bing-yin', natalPillar: '甲申', luckPillar: '丙寅', bases: ['year'] },
  { sourceCase: 'bing-xu-to-xin-mao', natalPillar: '丙戌', luckPillar: '辛卯', bases: ['year'] },
  { sourceCase: 'bing-zi-to-ren-yin', natalPillar: '丙子', luckPillar: '壬寅', bases: ['year'] },
];

export function smthNamedMajorLuckExamples(natal: Natal, luckPillar: string) {
  return majorLuckExamples.flatMap(example => {
    if (example.luckPillar !== luckPillar) return [];
    const matchedBases = example.bases.filter(position => natal[position] === example.natalPillar);
    if (!matchedBases.length) return [];

    const natalPillarPositions = layers.filter(position => natal[position] === example.natalPillar);
    const luckPillarPositions = layers.filter(position => natal[position] === luckPillar);
    const pair = baziInteractions([{ id: 'natal', pillar: example.natalPillar }, { id: 'luck', pillar: luckPillar }]);
    const isGengYiPair = example.sourceCase === 'geng-chen-and-yi-you';
    return [{
      sourceCase: example.sourceCase, natalPillar: example.natalPillar, luckPillar, matchedBases, natalPillarPositions, luckPillarPositions,
      contacts: pair.pairs.map(row => row.kind),
      stemRelation: pair.elemental.find(row => row.part === 'stem')?.kind,
      dingChouWeiException: example.sourceCase === 'ding-chou-to-ding-wei' ? luckPillarPositions.length > 0 : undefined,
      yiGengYearYouPositions: isGengYiPair && '乙庚'.includes(natal.year[0])
        ? layers.filter(position => natal[position][1] === '酉') : undefined,
    }];
  });
}

// 卷二〈论大运〉的水命示例。三合成员、纳音与普通干支五行分别留证。
export function smthWaterNaYinLuck(natal: Natal, luckPillar: string) {
  const yearNaYin = describeBaZiPillar(natal.year).naYin;
  if (!yearNaYin?.endsWith('水')) return undefined;
  const luckNaYin = describeBaZiPillar(luckPillar).naYin, luckElement = luckNaYin?.slice(-1);
  const required = luckElement === '火' ? '土' : luckElement === '土' ? '金' : undefined;
  const fireBranches = '寅午戌', luckBranch = luckPillar[1];
  const inFireBranches = fireBranches.includes(luckBranch);
  if (!required && !inFireBranches && luckElement !== '水') return undefined;

  const columns = layers.map(position => ({ position, ...describeBaZiPillar(natal[position]) }));
  const natalNaYin = (element: string) => columns.filter(row => row.naYin?.endsWith(element))
    .map(({ position, pillar, naYin }) => ({ position, pillar, naYin }));
  const matchingNaYin = required ? natalNaYin(required) : [];
  const stemPositions = required ? columns.filter(row => row.stemElement === required).map(row => row.position) : [];
  const branchPositions = required ? columns.filter(row => row.branchElement === required).map(row => row.position) : [];
  const chain = !matchingNaYin.length ? undefined
    : luckElement === '火' ? 'fire-earth-water' : 'earth-metal-water';
  const natalFire = inFireBranches || luckElement === '水' ? natalNaYin('火') : [];
  const natalMembers = inFireBranches ? [...fireBranches].map(branch => ({
    branch, positions: columns.filter(row => row.branch === branch).map(row => row.position),
  })) : undefined;
  const fireBranchReview = natalMembers ? {
    luckBranch, natalFire, natalMembers,
    candidateBases: [
      ...(natalMembers.every(row => row.positions.length) ? ['natal-fire-branches'] : []),
      ...(natalFire.length ? ['natal-fire-nayin'] : []),
    ],
  } : undefined;
  const natalMetal = luckElement === '水' ? natalNaYin('金') : undefined;
  const waterLuckReview = natalMetal ? { natalFire, natalMetal, candidate: natalFire.length > 0 && natalMetal.length > 0 } : undefined;
  return { yearPillar: natal.year, yearNaYin, luckPillar, luckNaYin, required, matchingNaYin, stemPositions, branchPositions, chain,
    fireBranchReview, waterLuckReview };
}

export function baziSmthFoundation(natal: Natal & { utc: string }, luckPillar: string) {
  const dayStem = natal.day[0];
  const pillars = layers.map(position => ({ position, ...describeBaZiPillar(natal[position], dayStem) }));
  const monthBranch = pillars[1].branch;
  const monthDuty = smthMonthDuty(Date.parse(natal.utc), monthBranch, dayStem);
  const season = smthSeasonalPowers(monthBranch);
  const luck = describeBaZiPillar(luckPillar, dayStem);
  const columns = pillars.map(row => ({
    position: row.position, pillar: row.pillar, stemElement: row.stemElement, branchElement: row.branchElement,
    hiddenStems: row.hiddenStems.map(hidden => hidden.stem), dayStemPhase: row.phase,
  }));
  const rootPositions = pillars.flatMap(row => row.hiddenStems.some(hidden => hidden.element === pillars[2].stemElement)
    ? [{ position: row.position, pillar: row.pillar, sameStem: row.hiddenStems.some(hidden => hidden.stem === dayStem) }] : []);
  const links = baziInteractions([...columns.map(row => ({ id: row.position, pillar: row.pillar })), { id: 'luck', pillar: luckPillar }]);
  const branchComparisons = links.elemental.filter(row => row.part === 'branch' && row.to === 'luck').map(row => ({
    position: row.from, relation: row.kind,
    contacts: links.pairs.filter(pair => pair.members[0] === row.from && pair.members[1] === 'luck'
      && !pair.kind.startsWith('天干') && pair.kind !== '同柱')
      .map(pair => pair.kind),
  }));
  const majorLuckNaYin = smthMajorLuckNaYin(natal.year, luckPillar);
  const majorLuckPolarity = smthMajorLuckPolarity(natal, luckPillar);
  const waterNaYinLuck = smthWaterNaYinLuck(natal, luckPillar);
  return { foundationProfile: baziAnnualLuckPolicy.foundation, monthDutyProfile: monthDuty?.profile,
    majorLuckNaYinRelation: majorLuckNaYin?.relation, majorLuckPolarityCondition: majorLuckPolarity?.condition,
    foundationWaterNaYinChain: waterNaYinLuck?.chain,
    foundationWaterFireBranchBases: waterNaYinLuck?.fireBranchReview?.candidateBases ?? [],
    foundationWaterMetalFireInWaterLuck: waterNaYinLuck?.waterLuckReview?.candidate ?? false,
    foundation: {
    columns, monthBranch, monthDuty, season, rootPositions, branchComparisons, luckPhase: luck.phase,
    luckBranchElement: luck.branchElement, luckHiddenStems: luck.hiddenStems.map(hidden => hidden.stem),
    majorLuckNaYin,
    majorLuckPolarity,
    waterNaYinLuck,
    namedMajorExamples: smthNamedMajorLuckExamples(natal, luckPillar),
  } };
}

type StemRole = { layer: typeof layers[number]; stem: string; tenGod?: string; placement: string };
type DescribedPillar = ReturnType<typeof describeBaZiPillar>;

function smthOfficerControls(natal: Natal & { utc?: string }, luck: DescribedPillar, killers: StemRole[],
  controls: StemRole[], exposed: StemRole[]) {
  if (luck.tenGod !== '正官') return {};
  const food = controls.filter(row => row.tenGod === '食神');
  const monthHasControl = food.some(row => row.layer === 'month' && row.placement !== '天干')
    && food.some(row => row.layer !== 'month' && row.placement === '天干');
  const monthHasSecondaryKiller = killers.some(row => row.layer === 'month' && row.placement === '支非本气');
  const duty = natal.utc && (monthHasControl || monthHasSecondaryKiller)
    ? smthMonthDuty(Date.parse(natal.utc), natal.month[1], natal.day[0]) : undefined;
  const onMonthDuty = (row: StemRole) => row.layer === 'month' && row.placement !== '天干' && row.stem === duty?.slot?.stem;
  const targets = killers.filter(row => row.placement !== '支非本气' || onMonthDuty(row));
  const singleKiller = new Set(killers.map(row => row.layer)).size === 1 && targets.length > 0;
  const activePaths = singleKiller ? controls.filter(row => row.placement !== '支非本气' || onMonthDuty(row)).flatMap(row => {
    const reached = targets.filter(killer => baziStemControls(row.stem, killer.stem));
    if (!reached.length) return [];
    const controllingSeals = exposed.filter(seal => seal.tenGod === '偏印' && baziStemControls(seal.stem, row.stem));
    const combinesOfficer = row.placement === '天干'
      && baziInteractions([{ id: row.layer, pillar: natal[row.layer] }, { id: 'luck', pillar: luck.pillar }])
        .pairs.some(pair => pair.kind === '天干五合');
    return [{ ...row, targets: reached, controllingSeals, combinesOfficer }];
  }) : [];
  const foodPaths = activePaths.filter(row => row.tenGod === '食神');
  const exposedFood = foodPaths.filter(row => row.placement === '天干');
  const exposedHurt = activePaths.filter(row => row.tenGod === '伤官' && row.placement === '天干');
  const mixedExposedControls = exposedFood.length && exposedHurt.length
    && exposedFood.some(food => exposedHurt.some(hurt => hurt.layer !== food.layer && food.targets.some(target => hurt.targets.includes(target))))
    ? [...exposedFood, ...exposedHurt] : [];
  const monthFood = foodPaths.find(onMonthDuty);
  const monthFoodOnDuty = Boolean(monthFood && exposedFood.some(row => row.layer !== 'month'));
  const monthResidualKillerOnDuty = singleKiller && targets.every(row => row.placement === '支非本气' && onMonthDuty(row));
  let officerControlPattern: string | undefined;
  if (exposedFood.length >= 2) {
    officerControlPattern = monthResidualKillerOnDuty ? 'separate-exposed-food-to-month-residual-killer' : 'separate-exposed-food';
  } else if (monthFoodOnDuty) {
    officerControlPattern = monthFood?.placement === '支非本气' ? 'exposed-food-and-month-residual-duty' : 'exposed-food-and-month-duty';
  } else if (mixedExposedControls.length) {
    officerControlPattern = 'mixed-exposed-food-hurt';
  }
  const recordedPaths = foodPaths.filter(row => row.placement !== '支非本气'
    || row === monthFood && officerControlPattern === 'exposed-food-and-month-residual-duty');
  const clearExposedControls = exposedFood.filter(row => !row.combinesOfficer && !row.controllingSeals.length);
  const namedHourKillerControls = clearExposedControls.filter(row =>
    row.targets.some(target => target.layer === 'hour' && target.placement === '天干'));
  const soleKiller = killers.length === 1 ? killers[0] : undefined;
  const hasSoleMainQiKillerWithSeparateFoodControls = soleKiller?.placement === '支本气'
    && monthFood?.placement === '支本气' && !monthFood.controllingSeals.length
    && monthFood.targets.includes(soleKiller)
    && clearExposedControls.some(row => row.layer !== 'month' && row.targets.includes(soleKiller));
  const hasSoleMonthDutyKillerWithSeparateFoodControls = soleKiller?.placement === '支非本气' && onMonthDuty(soleKiller)
    && clearExposedControls.filter(row => row.targets.includes(soleKiller)).length >= 2;
  // 卷五专禄要制 verifies water controls of the hour's Bing. Ren can still
  // combine with the arriving Ding officer, so this only verifies the natal paths.
  const hasDedicatedLuSiKillerWithWaterControls = natal.day[0] === '庚' && natal.hour[1] === '巳'
    && soleKiller?.layer === 'hour' && soleKiller.stem === '丙' && soleKiller.placement === '支本气'
    && ['壬', '癸'].every(stem => mixedExposedControls.some(row => row.stem === stem && !row.controllingSeals.length));
  return {
    officerControlProfile: baziAnnualLuckPolicy.officerControls, officerControlPattern,
    hasNamedHourKillerWithSeparateControls: namedHourKillerControls.length >= 2,
    hasSoleNonHourExposedKillerWithSeparateControls: soleKiller?.placement === '天干' && soleKiller.layer !== 'hour'
      ? clearExposedControls.filter(row => row.targets.includes(soleKiller)).length >= 2 : false,
    hasSoleMainQiKillerWithSeparateFoodControls, hasSoleMonthDutyKillerWithSeparateFoodControls,
    hasDedicatedLuSiKillerWithWaterControls,
    officerControlEvidence: singleKiller ? { foodPaths: recordedPaths, mixedExposedControls,
      monthFoodOnDuty: monthFoodOnDuty && monthFood !== undefined && recordedPaths.includes(monthFood), monthResidualKillerOnDuty,
      monthDutyStem: duty?.slot?.stem, monthDutyDay: duty?.elapsedDay } : undefined,
  };
}

function smthLuckWealth(natal: Natal, year: DescribedPillar, luck: DescribedPillar,
  roots: (StemRole & { sameStem: boolean })[], exposed: StemRole[]) {
  if (!wealth(luck.tenGod)) return {};
  const actors = [...exposed, { layer: 'annual', stem: year.stem, tenGod: year.tenGod, placement: '天干' }];
  const columns = [...layers.map(layer => ({ id: layer, pillar: natal[layer] })),
    { id: 'annual', pillar: year.pillar }, { id: 'luck', pillar: luck.pillar }];
  const { pairs, elemental } = baziInteractions(columns);
  const arrivals = new Set(['annual', 'luck']);
  const rootPositions = roots.map(root => ({
    ...root,
    contacts: pairs.filter(pair => pair.members[0] === root.layer && arrivals.has(pair.members[1])
      && ['六合', '六冲', '六害', '六破', '相刑'].includes(pair.kind))
      .map(pair => ({ actor: pair.members[1], kind: pair.kind, branches: pair.values })),
  }));
  const wealthRootStatus = rootPositions.some(row => row.sameStem && row.placement === '支本气') ? 'exact-main'
    : rootPositions.some(row => row.sameStem) ? 'exact-hidden' : rootPositions.length ? 'same-element-only' : 'no-natal-root';
  const contacts = actors.flatMap(actor => {
    const kind = elemental.find(row => row.part === 'stem' && row.from === actor.layer && row.to === 'luck')?.kind;
    const feeds = kind === '前生后' && (actor.tenGod === '食神' || actor.tenGod === '伤官');
    const controls = kind === '前克后' && (actor.tenGod === '比肩' || actor.tenGod === '劫财');
    const combines = pairs.some(row => row.kind === '天干五合' && row.members[0] === actor.layer && row.members[1] === 'luck');
    return feeds || controls || combines ? [{ ...actor, feeds, controls, combines }] : [];
  });
  return { wealthReviewProfile: baziAnnualLuckPolicy.wealthReview, wealthRootStatus,
    luckWealthEvidence: { rootPositions, contacts } };
}

function stemExceptionEvidence(natal: Natal & { utc?: string }, timeKnown: boolean, year: DescribedPillar, luck: DescribedPillar,
  reviewSource: boolean) {
  const native = layers.filter(layer => layer !== 'hour' || timeKnown)
    .map(layer => ({ layer, ...describeBaZiPillar(natal[layer], natal.day[0]) }));
  const exposed = native.filter(p => p.layer !== 'day')
    .map(p => ({ layer: p.layer, stem: p.stem, tenGod: p.tenGod, placement: '天干' }));
  const hidden = native.flatMap(p => p.hiddenStems.map((h, index) => ({
    layer: p.layer, stem: h.stem, tenGod: h.tenGod, placement: index === 0 ? '支本气' : '支非本气',
  })));
  const roles = [...exposed, ...hidden];
  const killers = roles.filter(row => row.tenGod === '七杀');
  const controlStems = roles.filter(row => row.tenGod === '食神' || row.tenGod === '伤官');
  const foodStemColumns = controlStems.filter(row => row.tenGod === '食神' && row.placement === '天干')
    .map(row => row.layer);
  const killerColumns = new Set(killers.map(row => row.layer));
  const killerCombinations = baziInteractions(native.map(p => ({ id: p.layer, pillar: p.pillar }))).pairs
    .filter(pair => pair.kind === '天干五合'
      && killers.some(target => target.placement === '天干' && pair.members.includes(target.layer)))
    .map(pair => ({ columns: pair.members, stems: pair.values }));
  // Volume five describes one killer with restraints in two or three places.
  // Count only visible food stems here. Other control paths stay undetermined.
  const singleKillerControlColumns = timeKnown && killerColumns.size === 1
    && killers.some(row => row.placement !== '支非本气') && foodStemColumns.length >= 2 ? foodStemColumns : undefined;
  const mainWealth = wealth(luck.hiddenStems[0]?.tenGod);
  const hiddenWealth = luck.hiddenStems.some(row => wealth(row.tenGod));
  const natalWealthRoots = wealth(luck.tenGod)
    ? hidden.filter(row => wealth(row.tenGod)).map(row => ({ ...row, sameStem: row.stem === luck.stem })) : undefined;

  return {
    stemExceptionProfile: baziAnnualLuckPolicy.stemExceptions,
    ...(timeKnown && reviewSource ? smthOfficerControls(natal, luck, killers,
      controlStems.filter(row => row.placement === '天干' || (row.tenGod === '食神' && row.layer === 'month')),
      exposed) : {}),
    ...(timeKnown && reviewSource && natalWealthRoots ? smthLuckWealth(natal, year, luck, natalWealthRoots, exposed) : {}),
    luckBranchWealthAbsent: mainWealth ? false : hiddenWealth ? undefined : true,
    natalWealthRoots,
    natalKillerPresent: killers.length ? true : timeKnown ? false : undefined,
    natalKillerPositions: killers,
    natalOutputPositions: killers.length ? controlStems : undefined,
    natalKillerCombinations: killers.length ? killerCombinations : undefined,
    singleKillerControlColumns,
    singleKillerMultipleFoodControls: singleKillerControlColumns ? true : undefined,
  };
}

// Same candidate and same actual year/luck intersection. No matching together
// an unrelated annual fact and a luck stage from another effective interval.
export function baziAnnualLuckContext(natal: Natal & { utc?: string }, timeKnown: boolean, yearPillar: string, luckPillar: string,
  reviewSource = false) {
  if (![natal.year, natal.month, natal.day, ...(timeKnown ? [natal.hour] : []), yearPillar, luckPillar].every(validPillar)) {
    throw new RangeError('Invalid annual/luck pillars');
  }
  const dayMaster = natal.day[0], year = describeBaZiPillar(yearPillar, dayMaster), luck = describeBaZiPillar(luckPillar, dayMaster);
  const dayBasis = smthLuNextBranch(dayMaster), yearBasis = smthLuNextBranch(natal.year[0]);
  const natalLayers = layers.filter(layer => layer !== 'hour' || timeKnown);
  const positions = (branch: string) => natalLayers.filter(layer => natal[layer][1] === branch);
  return { profile: baziAnnualLuckPolicy.profile, dayMaster, timeKnown,
    natalYear: natal.year, natalMonth: natal.month, natalDay: natal.day, ...(timeKnown ? { natalHour: natal.hour } : {}),
    yearPillar, luckPillar, samePillar: yearPillar === luckPillar,
    sameStem: year.stem === luck.stem, sameBranch: year.branch === luck.branch,
    yearRepeatsNatalYear: yearPillar === natal.year,
    yearTenGod: year.tenGod, yearMainQiTenGod: year.hiddenStems[0]?.tenGod,
    yearHiddenTenGods: year.hiddenStems.map(s => s.tenGod),
    luckTenGod: luck.tenGod, luckMainQiTenGod: luck.hiddenStems[0]?.tenGod,
    luckHiddenTenGods: luck.hiddenStems.map(s => s.tenGod),
    luckStemWealth: wealth(luck.tenGod), luckMainQiWealth: wealth(luck.hiddenStems[0]?.tenGod),
    luckAnyHiddenWealth: luck.hiddenStems.some(s => wealth(s.tenGod)),
    ...stemExceptionEvidence(natal, timeKnown, year, luck, reviewSource),
    dayLuBranch: dayBasis.luBranch, monthBuiltLu: natal.month[1] === dayBasis.luBranch,
    dayBasisBladeBranch: dayBasis.bladeBranch, yearBasisBladeBranch: yearBasis.bladeBranch,
    yearAtDayBasisBlade: year.branch === dayBasis.bladeBranch, luckAtDayBasisBlade: luck.branch === dayBasis.bladeBranch,
    yearAtYearBasisBlade: year.branch === yearBasis.bladeBranch, luckAtYearBasisBlade: luck.branch === yearBasis.bladeBranch,
    natalDayBasisBladePositions: positions(dayBasis.bladeBranch), natalYearBasisBladePositions: positions(yearBasis.bladeBranch),
    bladeBasisAgrees: dayBasis.bladeBranch === yearBasis.bladeBranch,
    yearLuckRelations: baziInteractions([{ id: 'year', pillar: yearPillar }, { id: 'luck', pillar: luckPillar }]).pairs.map(p => p.kind),
    bladeEffect: 'unresolved-source-basis-and-restraint',
  } as const;
}
