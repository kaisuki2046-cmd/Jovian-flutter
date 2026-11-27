import * as lunarEngine from 'lunar-javascript';
import { baziElementRelation, baziInteractions, baziLiuHePartner, baziNatalVoidSources, describeBaZiPillar,
  smthCanopyBranch, smthHeavenVirtueStemRule, smthMoonVirtueRule, smthNaYinPhase } from './bazi-calculation';
import { lunarAtBeijing } from './fortune-calendar';
import { smthLuNextBranch, smthMajorLuckNaYin, smthMajorLuckPolarity, smthNamedMajorLuckExamples,
  smthStemGrowthBranches, smthWaterNaYinLuck } from './bazi-annual-luck';
import { schoolExamNobleSeason, smthTianyiBranches } from './bazi-school-exam';
import { smthHorseSeatReview } from './bazi-smth-horse';
import { smthBirthMonthGeneral } from './bazi-smth-month-duty';

const stems = '甲乙丙丁戊己庚辛壬癸', branches = '子丑寅卯辰巳午未申酉戌亥';
const cycle = Array.from({ length: 60 }, (_, i) => stems[i % 10] + branches[i % 12]);
const natalLayers = ['year', 'month', 'day', 'hour'] as const;
type Natal = Record<typeof natalLayers[number], string> & { utc?: string };
export const baziMinorLuckPolicy = {
  profile: 'smth-minor-luck-alternatives-atomic-v1',
  age: 'beijing-li-chun-birth-year-one-candidate-not-source-calendar-verification',
  variants: ['zuixing-hour-year-direction', 'fixed-bingyin-renshen', 'female-bingshen-opening-reading'],
  selection: 'gender-basis-from-unique-archived-luck-table-no-other-method-inference',
  p245: 'smth-p245-independent-contacts-and-shared-support-v1',
  majorHistory: 'smth-volume-two-p245-major-luck-history-v10',
  horse: 'smth-volume-three-year-horse-types-v2',
  canopy: 'smth-year-canopy-with-natal-noble-flanks-v1',
  nobleCombinations: 'smth-sanmings-tiyao-two-noble-combinations-v1',
  yanNobleCombinations: 'smth-yan-dongsou-named-noble-combination-pillars-v1',
  moonVirtue: 'smth-month-virtue-stem-pair-with-counter-v1',
  heavenVirtue: 'smth-heaven-virtue-stem-pair-month-general-v1',
  directNoble: 'smth-tongxuan-noble-seat-obstructions-v1',
  effects: 'no-usefulness-rescue-or-auspicious-counting',
} as const;

function shift(pillar: string, amount: number) {
  const index = cycle.indexOf(pillar);
  if (index < 0 || !Number.isSafeInteger(amount)) throw new RangeError('Invalid minor-luck cycle input');
  return cycle[((index + amount) % 60 + 60) % 60];
}

// The first place is not the hour itself: the printed Jia-Zi example starts
// Yi-Chou immediately after birth and Bing-Yin in its second ordinal year.
export function smthMinorLuckVariants(natalYear: string, hour: string | undefined, gender: string, ordinal: number) {
  if (!cycle.includes(natalYear) || !['男', '女'].includes(gender) || !Number.isSafeInteger(ordinal) || ordinal < 1) {
    throw new RangeError('Invalid minor-luck basis');
  }
  if (hour !== undefined && !cycle.includes(hour)) throw new RangeError('Invalid minor-luck hour');
  const forward = (stems.indexOf(natalYear[0]) % 2 === 0) === (gender === '男');
  return [
    ...(hour ? [{ variant: 'zuixing-hour-year-direction', direction: forward ? 'forward' : 'backward',
      pillar: shift(hour, (forward ? 1 : -1) * (ordinal % 60)) }] : []),
    { variant: 'fixed-bingyin-renshen', direction: gender === '男' ? 'forward' : 'backward',
      pillar: shift(gender === '男' ? '丙寅' : '壬申', (gender === '男' ? 1 : -1) * ((ordinal - 1) % 60)) },
    ...(gender === '女' ? [{ variant: 'female-bingshen-opening-reading', direction: 'backward',
      pillar: shift('丙申', -((ordinal - 1) % 60)) }] : []),
  ];
}

function liChunYear(instant: number) {
  if (!Number.isSafeInteger(instant) || !Number.isFinite(new Date(instant).getTime())) throw new RangeError('Invalid minor-luck instant');
  const year = new Date(instant + 8 * 3_600_000).getUTCFullYear();
  const pillar = lunarAtBeijing(instant).getYearInGanZhiExact();
  const yearPillar = (y: number) => cycle[((y - 1984) % 60 + 60) % 60];
  const label = pillar === yearPillar(year) ? year : pillar === yearPillar(year - 1) ? year - 1 : undefined;
  if (label === undefined) throw new RangeError('Inconsistent Li-Chun year');
  return { label, pillar };
}

// Declared candidate convention. Birth-year one advances at the exact Li-Chun
// boundary, not January 1, lunar New Year, a birthday, or a luck-stage change.
export function minorLuckOrdinal(birthAt: number, at: number) {
  const birth = liChunYear(birthAt), current = liChunYear(at);
  if (at < birthAt) return undefined;
  return { birthYearLabel: birth.label, yearLabel: current.label, yearPillar: current.pillar,
    ordinal: current.label - birth.label + 1, calendarVerified: false };
}

export function minorLuckCalendarAgreement(birthAt: number, ordinal: number, range: { start: number; end: number }) {
  const lunarYear = lunarAtBeijing(birthAt).getYear() + ordinal - 1;
  const { Lunar } = lunarEngine as typeof lunarEngine & {
    Lunar: { fromYmd(year: number, month: number, day: number): { getSolar(): { toYmd(): string } } };
  };
  const lunarNewYear = (year: number) => Date.parse(Lunar.fromYmd(year, 1, 1).getSolar().toYmd() + 'T00:00:00+08:00');
  const start = Math.max(range.start, lunarNewYear(lunarYear));
  const end = Math.min(range.end, lunarNewYear(lunarYear + 1));
  return start < end ? { start, end } : undefined;
}

// 卷三〈论驿马〉列出的年支分组与各马位天干。类目和发应支是两项条件。
const horseRows = [
  { group: '申子辰', at: '寅', combinesAt: '亥', responseBranches: '亥卯未寅',
    classes: ['正禄文星马', '福星马', '伏马', '破禄马', '截路马'] },
  { group: '寅午戌', at: '申', combinesAt: '巳', responseBranches: '巳酉丑申',
    classes: ['截路空日马', '大败马', '福星伏马', '逢天关马', '大败马'] },
  { group: '巳酉丑', at: '亥', combinesAt: '寅', responseBranches: '申子辰亥',
    classes: ['天德马', '天乙马', '旺禄马', '正禄马', '大败马'] },
  { group: '亥卯未', at: '巳', combinesAt: '申', responseBranches: '寅午戌巳',
    classes: ['正禄马', '旺气马', '九天禄库马', '截路马', '天乙伏马'] },
];
const horseClassesRequiringReview = new Set(['截路空日马', '截路马', '大败马', '破禄马']);

function readHorseClass(row: typeof horseRows[number], pillar: string) {
  if (pillar[1] !== row.at) return undefined;
  const name = row.classes[Math.floor(stems.indexOf(pillar[0]) / 2)];
  // 乙亥在四库本文中另列劣马、绝马。辛巳见贵人的异说也还需独查。
  const supportUnverified = pillar === '乙亥' || horseClassesRequiringReview.has(name);
  return { name, supportUnverified };
}

function stemSupport(stem: string, branch: string, eligibleNoble: boolean) {
  const { birth, peak } = smthStemGrowthBranches(stem);
  return [branch === birth ? '长生' : '', branch === peak ? '帝旺' : '', branch === smthLuNextBranch(stem).luBranch ? '禄' : '',
    eligibleNoble ? '天乙' : ''].filter(Boolean);
}

type EarlierLuckStage = { pillar: string; start: number };

// 卷三〈论劫煞亡神〉用本命年支三合局，〈总论诸神煞〉以煞柱纳音克生年为克身。
const yearJieWangSeats = [
  { branches: '申子辰', jieBranch: '巳', wangBranch: '亥' },
  { branches: '寅午戌', jieBranch: '亥', wangBranch: '巳' },
  { branches: '巳酉丑', jieBranch: '寅', wangBranch: '申' },
  { branches: '亥卯未', jieBranch: '申', wangBranch: '寅' },
];

function smthBathingJieWang(yearPillar: string, yearNaYin: string | undefined,
  actors: readonly { position: 'annual' | 'luck'; pillar: string }[], hasXingOrControl: boolean) {
  const group = yearJieWangSeats.find(row => row.branches.includes(yearPillar[1]));
  if (!group || !yearNaYin) return undefined;

  const { jieBranch, wangBranch } = group;
  const seats = actors.flatMap(actor => {
    const branch = actor.pillar[1];
    const star = branch === jieBranch ? '劫煞' : branch === wangBranch ? '亡神' : undefined;
    if (!star) return [];
    const naYin = describeBaZiPillar(actor.pillar).naYin;
    return [{ ...actor, star, naYin, naYinRelation: baziElementRelation(naYin?.slice(-1) ?? '', yearNaYin.slice(-1)) }];
  });
  return { yearPillar, yearNaYin, jieBranch, wangBranch, seats, hasXingOrControl,
    candidate: hasXingOrControl && seats.some(seat => seat.naYinRelation === '前克后') };
}

export function smthMinorMajorLuckHistory(natal: Natal, annualPillar: string, luckPillar: string,
  earlierStages: EarlierLuckStage[]) {
  const pair = baziInteractions([{ id: 'luck', pillar: luckPillar }, { id: 'annual', pillar: annualPillar }]);
  const clashes = pair.pairs.filter(row => ['相刑', '六冲', '天干四冲', '六破'].includes(row.kind)).map(row => row.kind);
  const controls = pair.elemental.filter(row => row.kind === '前克后' || row.kind === '后克前')
    .map(row => ({ part: row.part, source: row.kind === '前克后' ? 'luck' : 'annual' }));
  const hasContention = clashes.length > 0 || controls.length > 0;
  const naYin = describeBaZiPillar(natal.year).naYin, dayStem = natal.day[0];
  const bases = [
    { basis: 'year-nayin', value: naYin, phase: (pillar: string) => smthNaYinPhase(naYin?.slice(-1) ?? '', pillar[1]) },
    { basis: 'day-stem', value: dayStem, phase: (pillar: string) => describeBaZiPillar(pillar, dayStem).phase },
  ].flatMap(({ basis, value, phase }) => {
    const currentPhase = phase(luckPillar);
    if (!currentPhase) return [];
    const previous = earlierStages.at(-1), previousPhase = previous && phase(previous.pillar);
    const birthStage = earlierStages.findLast(row => phase(row.pillar) === '长生');
    const peakStage = earlierStages.findLast(row => phase(row.pillar) === '帝旺');
    const toEvidence = (stage: EarlierLuckStage) => ({ pillar: stage.pillar, start: new Date(stage.start).toISOString() });
    const birthStatus = currentPhase === '长生' ? 'current-stage' : birthStage ? 'passed' : 'not-reached';
    return [{ basis, value, currentPhase, previousPhase, birthStatus,
      earlierBirth: birthStage && toEvidence(birthStage), earlierPeak: peakStage && toEvidence(peakStage),
      contentionBeforeBirth: hasContention && birthStatus === 'not-reached',
      contentionAtBathingAfterBirth: hasContention && previousPhase === '长生' && currentPhase === '沐浴',
      deathOrExtinctionAfterPeak: Boolean(peakStage) && ['死', '绝'].includes(currentPhase),
    }];
  });
  const weakBases = bases.filter(row => row.contentionBeforeBirth).map(row => row.basis);
  const bathingBases = bases.filter(row => row.previousPhase === '长生' && row.currentPhase === '沐浴').map(row => row.basis);
  const yearStem = natal.year[0], { bladeBranch } = smthLuNextBranch(yearStem);
  const flyingBranch = branches[(branches.indexOf(bladeBranch) + 6) % 12];
  const actors = [{ position: 'annual', pillar: annualPillar }, { position: 'luck', pillar: luckPillar }] as const;
  const bladeSeats = actors.filter(row => row.pillar[1] === bladeBranch);
  const hasXingOrControl = clashes.includes('相刑') || controls.length > 0;
  const bathingBladeReview = bathingBases.length ? { bases: bathingBases, yearStem, bladeBranch, seats: bladeSeats,
    flyingBranch, flyingSeats: actors.filter(row => row.pillar[1] === flyingBranch), hasXingOrControl,
    candidate: bladeSeats.length > 0 && hasXingOrControl } : undefined;
  const bathingJieWangReview = bathingBases.length ? smthBathingJieWang(natal.year, naYin, actors, hasXingOrControl) : undefined;
  const adverseCases = [
    ...(weakBases.length ? ['unreached-birth-contention'] : []),
    ...(bathingBladeReview?.candidate ? ['bathing-blade-contention'] : []),
    ...(bathingJieWangReview?.candidate ? ['bathing-jie-wang-contention'] : []),
  ];
  const majorLuckNaYin = smthMajorLuckNaYin(natal.year, luckPillar);
  const waterNaYinLuck = smthWaterNaYinLuck(natal, luckPillar);
  const namedMajorExamples = smthNamedMajorLuckExamples(natal, luckPillar);
  const namedAdverseExamples = namedMajorExamples.filter(example => example.sourceCase === 'bing-zi-to-ren-yin'
    && example.contacts.includes('天干四冲') && example.stemRelation === '后克前');
  adverseCases.push(...namedAdverseExamples.map(example => example.sourceCase));
  const favorableBases: string[] = [];
  if (majorLuckNaYin?.directionMatches && majorLuckNaYin.relation === '同五行') favorableBases.push('nayin-in-own-direction');
  if (waterNaYinLuck?.chain === 'earth-metal-water') favorableBases.push('earth-metal-water');
  if (waterNaYinLuck?.fireBranchReview?.candidateBases.length) favorableBases.push('water-and-fire-branches');
  for (const example of namedMajorExamples) {
    if (example.sourceCase === 'wu-yin-to-ding-chou' || (example.sourceCase === 'ding-chou-to-ding-wei'
      && example.dingChouWeiException === false)) favorableBases.push(example.sourceCase);
    if (example.sourceCase === 'geng-chen-and-yi-you'
      && example.contacts.includes('天干五合') && example.contacts.includes('六合')
      && example.natalPillarPositions.length === 1 && !example.luckPillarPositions.length
      && !example.yiGengYearYouPositions?.length) favorableBases.push(example.sourceCase);
  }
  const favorableConflict = favorableBases.length > 0
    && (waterNaYinLuck?.chain === 'fire-earth-water' || waterNaYinLuck?.waterLuckReview?.candidate === true);
  return { profile: baziMinorLuckPolicy.majorHistory, bases, clashes, controls, weakBases, bathingBladeReview, bathingJieWangReview, adverseCases,
    favorableBases: favorableConflict ? [] : favorableBases, favorableConflict,
    majorLuckNaYin, majorLuckPolarity: smthMajorLuckPolarity(natal, luckPillar), waterNaYinLuck, namedMajorExamples, namedAdverseExamples };
}

// 〈夹贵夹禄〉的两组夹贵中心与华盖库位重合时，逐一核两侧本命支。
const canopyNobleFlanks = [
  { yearStems: '丙丁', center: '戌', branches: '酉亥' },
  { yearStems: '壬癸', center: '辰', branches: '卯巳' },
];

function smthMinorCanopyContext(natal: Natal, annualPillar: string, minorPillar: string,
  pairs: ReturnType<typeof baziInteractions>['pairs']) {
  const branch = smthCanopyBranch(natal.year[1]);
  if (!branch) return undefined;
  const seats = [{ position: 'annual', pillar: annualPillar }, { position: 'minor', pillar: minorPillar }]
    .filter(row => row.pillar[1] === branch);
  if (!seats.length) return undefined;

  const yearStem = natal.year[0];
  const listed = canopyNobleFlanks.find(row => row.center === branch && row.yearStems.includes(yearStem));
  const flanks = listed && [...listed.branches].map(branch => ({ branch, columns: natalLayers
    .filter(position => natal[position][1] === branch).map(position => ({ position, pillar: natal[position] })) }));
  const voidBases = baziNatalVoidSources(natal, branch).map(row => row.basis);
  const obstructions = seats.flatMap(({ position }) => pairs
    .filter(row => (row.kind === '六冲' || row.kind === '六破') && row.members.includes(position))
    .map(row => ({ position, target: row.members.find(id => id !== position)!, kind: row.kind })));
  const bothAtCanopy = seats.length === 2;
  const candidate = bothAtCanopy && flanks?.every(row => row.columns.length > 0) === true
    && voidBases.length === 0 && obstructions.length === 0;
  return { branch, yearStem, seats, flanks, voidBases, obstructions, bothAtCanopy, candidate };
}

// 〈论天乙贵人〉引《三命提要》从同一干的两个贵位分别取六合支。
function smthMinorNobleCombinations(natal: Natal, annualPillar: string, minorPillar: string) {
  const actors = [{ position: 'annual', pillar: annualPillar }, { position: 'minor', pillar: minorPillar }];
  return (['year', 'day'] as const).flatMap(basis => {
    const stem = natal[basis][0];
    const { yangBranch, yinBranch } = smthTianyiBranches(stem);
    const matches = actors.flatMap(row => {
      const nobleBranch = baziLiuHePartner(row.pillar[1]);
      return nobleBranch && (nobleBranch === yangBranch || nobleBranch === yinBranch) ? [{ ...row, nobleBranch }] : [];
    });
    return matches.length ? [{ basis, stem, matches, distinctPairs: new Set(matches.map(row => row.nobleBranch)).size }] : [];
  });
}

// 〈论天乙贵人〉阎东叟「贵合」例列整柱，和《三命提要》所列六合支分开。
const yanNobleCombinations: Partial<Record<string, readonly string[]>> = {
  甲: ['己丑', '己未'], 戊: ['癸丑', '癸未'], 庚: ['乙丑', '乙未'], 乙: ['庚子', '庚申'],
  己: ['甲子', '甲申'], 丙: ['辛酉', '辛亥'], 丁: ['壬寅', '壬辰'],
};

function smthMinorYanNobleCombinations(natal: Natal,
  actors: { position: string; pillar: string; contacts: { target: string; kind: string }[] }[]) {
  return (['year', 'day'] as const).flatMap(basis => {
    const stem = natal[basis][0], printedPillars = yanNobleCombinations[stem];
    if (!printedPillars) return [];
    const seats = actors.filter(row => printedPillars.includes(row.pillar)).map(({ position, pillar, contacts }) => ({
      position, pillar, voidSources: baziNatalVoidSources(natal, pillar[1]),
      obstructions: contacts.filter(row => row.kind === '六冲' || row.kind === '六破'),
    }));
    if (!seats.length) return [];
    const candidate = new Set(seats.map(row => row.pillar)).size === 2
      && seats.every(row => row.voidSources.length === 0 && row.obstructions.length === 0);
    return [{ basis, stem, printedPillars, seats, candidate }];
  });
}

function smthMinorStemVirtue(monthBranch: string, rule: { stem: string; partner: string; taboo: string } | undefined,
  pillars: { id: string; pillar: string }[]) {
  if (!rule) return undefined;

  const { stem, partner, taboo } = rule;
  const seats = pillars.filter(row => (row.id === 'annual' || row.id === 'minor')
    && (row.pillar[0] === stem || row.pillar[0] === partner));
  if (!seats.length) return undefined;

  const paired = seats.length === 2 && seats[0].pillar[0] !== seats[1].pillar[0];
  const obstructions = pillars.filter(row => row.pillar[0] === taboo);
  return { monthBranch, stem, partner, taboo, seats, paired, obstructions, candidate: paired && !obstructions.length };
}

function smthMinorHeavenVirtue(natal: Natal, pillars: { id: string; pillar: string }[]) {
  const monthBranch = natal.month[1];
  const stemReview = smthMinorStemVirtue(monthBranch, smthHeavenVirtueStemRule(monthBranch), pillars);
  if (!stemReview) return undefined;

  const monthGeneral = stemReview.paired && natal.utc ? smthBirthMonthGeneral(Date.parse(natal.utc), monthBranch) : undefined;
  return { ...stemReview, monthGeneral, candidate: stemReview.candidate && monthGeneral?.matchesHeavenVirtueGeneral === true };
}

// 《协纪辨方书》把四仲月卦合留作方位取法，并另列两边的支位例。
const heavenVirtueDirections = [
  { month: '卯', trigram: '坤', partner: '巽', pairs: ['申巳', '申辰'] },
  { month: '午', trigram: '乾', partner: '艮', pairs: ['寅亥', '寅戌'] },
  { month: '酉', trigram: '艮', partner: '乾', pairs: ['寅亥', '寅戌'] },
  { month: '子', trigram: '巽', partner: '坤', pairs: ['申巳', '申辰'] },
];

function smthMinorHeavenVirtueDirection(monthBranch: string, annualPillar: string, minorPillar: string) {
  const rule = heavenVirtueDirections.find(row => row.month === monthBranch);
  const pairedBranches = rule?.pairs.find(pair => pair === annualPillar[1] + minorPillar[1]
    || pair === minorPillar[1] + annualPillar[1]);
  return rule && pairedBranches ? { monthBranch, trigram: rule.trigram, partner: rule.partner, pairedBranches } : undefined;
}

export function baziMinorLuckContext(natal: Natal, timeKnown: boolean, annualPillar: string, luckPillar: string | undefined,
  variant: ReturnType<typeof smthMinorLuckVariants>[number]) {
  const present = natalLayers.filter(layer => layer !== 'hour' || timeKnown);
  if (![...present.map(layer => natal[layer]), annualPillar, variant.pillar, ...(luckPillar !== undefined ? [luckPillar] : [])].every(p => cycle.includes(p))
    || !baziMinorLuckPolicy.variants.some(value => value === variant.variant) || !['forward', 'backward'].includes(variant.direction)) {
    throw new RangeError('Invalid annual/minor-luck context');
  }
  const pillars = [...present.map(layer => ({ id: 'natal:' + layer, pillar: natal[layer] })),
    ...(luckPillar ? [{ id: 'luck', pillar: luckPillar }] : []),
    { id: 'annual', pillar: annualPillar }, { id: 'minor', pillar: variant.pillar }];
  const relations = baziInteractions(pillars);
  const contacts = (actor: string) => relations.pairs.filter(row => row.members.includes(actor))
    .map(row => ({ target: row.members.find(id => id !== actor)!, kind: row.kind }));
  const annualContacts = contacts('annual'), minorContacts = contacts('minor');
  const harmContacts = (items: typeof annualContacts) => items.filter(row => row.kind === '相刑' || row.kind === '六害');
  const annualHarm = harmContacts(annualContacts), minorHarm = harmContacts(minorContacts);
  const annualHarmTargets = annualHarm.map(row => row.target), minorHarmTargets = minorHarm.map(row => row.target);
  const independent = (items: typeof annualContacts, movingPeer: string) => items.filter(row => row.target !== movingPeer)
    .map(row => ({ ...row, pillar: pillars.find(item => item.id === row.target)!.pillar }));
  const annualIndependent = independent(annualHarm, 'minor'), minorIndependent = independent(minorHarm, 'annual');
  const mutual = annualHarm.filter(row => row.target === 'minor').map(row => row.kind);
  const harmEvidence = { annual: annualIndependent, minor: minorIndependent, mutual };
  // Minor-only and moving-peer contacts cannot settle the disputed punctuation
  // and target in 卷二. Keep them distinguishable from absent geometry.
  const hasIndependentHarm = annualIndependent.length && minorIndependent.length ? true
    : timeKnown && !minorIndependent.length && !mutual.length ? false : undefined;
  const dayLu = smthLuNextBranch(natal.day[0]).luBranch, yearLu = smthLuNextBranch(natal.year[0]).luBranch;
  const yearHorse = horseRows.find(row => row.group.includes(natal.year[1]))!;
  const annualBranch = annualPillar[1], minorBranch = variant.pillar[1];
  const nobleSeason = timeKnown && natal.utc ? schoolExamNobleSeason(Date.parse(natal.utc))?.season : undefined;
  const actors = [{ position: 'annual', pillar: annualPillar, contacts: annualContacts },
    { position: 'minor', pillar: variant.pillar, contacts: minorContacts }];
  const stemReviews = (['year', 'day'] as const).map(basis => {
    const stem = natal[basis][0];
    const { chosenNobleBranch: nobleBranch } = smthTianyiBranches(stem, nobleSeason);
    const sides = actors.map(({ position, pillar, contacts }) => {
      const branch = pillar[1];
      if (branch !== nobleBranch) return { support: stemSupport(stem, branch, false) };

      const voidSources = baziNatalVoidSources(natal, branch);
      const obstructions = contacts.filter(row => row.kind === '六冲' || row.kind === '六破');
      const voidCombinations = voidSources.length ? contacts.filter(row => row.kind === '六合') : [];
      const eligible = !voidSources.length && !obstructions.length;
      return { support: stemSupport(stem, branch, eligible), noble: { position, pillar, voidSources, obstructions, voidCombinations, eligible } };
    });
    const [annual, minor] = sides;
    const seats = sides.flatMap(row => row.noble ? [row.noble] : []);
    const blocked = sides.every(row => row.support.length || row.noble) && sides.some(row => !row.support.length);
    return { basis, stem, nobleBranch, seats, blocked, annual: annual.support, minor: minor.support };
  });
  const commonStemSupport = stemReviews.filter(row => row.annual.length && row.minor.length)
    .map(({ basis, stem, annual, minor }) => ({ basis, stem, annual, minor }));
  const directNobleReview = stemReviews.filter(row => row.seats.length)
    .map(({ basis, stem, nobleBranch, seats }) => ({ basis, stem, nobleBranch, seats }));
  const annualHorseClass = readHorseClass(yearHorse, annualPillar), minorHorseClass = readHorseClass(yearHorse, variant.pillar);
  const stemBranchCombine = [annualBranch, minorBranch].includes(yearHorse.at)
    && [annualBranch, minorBranch].includes(yearHorse.combinesAt)
    && relations.pairs.some(row => row.kind === '天干五合' && row.members.includes('annual') && row.members.includes('minor'));
  const commonHorseSupport = annualHorseClass && minorHorseClass ? 'same_horse_position'
    : annualBranch === yearHorse.combinesAt && minorBranch === yearHorse.combinesAt ? 'both_combine_with_horse'
    : stemBranchCombine ? 'stem_and_branch_combine_with_horse' : undefined;
  const horseSeats = [{ position: 'annual', pillar: annualPillar }, { position: 'minor', pillar: variant.pillar }]
    .filter(row => row.pillar[1] === yearHorse.at).map(row => smthHorseSeatReview(natal, row, relations.pairs));
  const blockedHorseSeats = horseSeats.filter(row => row.progressRestriction
    || (timeKnown && row.voidSources.length > 0 && !row.voidCombinations.length)).map(row => row.position);
  const horseSupports = commonHorseSupport !== undefined && !annualHorseClass?.supportUnverified && !minorHorseClass?.supportUnverified
    && !blockedHorseSeats.length;
  const canopyReview = timeKnown ? smthMinorCanopyContext(natal, annualPillar, variant.pillar, relations.pairs) : undefined;
  const nobleCombinationReview = smthMinorNobleCombinations(natal, annualPillar, variant.pillar);
  const yanNobleCombinationReview = timeKnown && luckPillar ? smthMinorYanNobleCombinations(natal, actors) : undefined;
  const monthBranch = natal.month[1];
  const moonVirtueReview = timeKnown && luckPillar ? smthMinorStemVirtue(monthBranch, smthMoonVirtueRule(monthBranch), pillars) : undefined;
  const heavenVirtueReview = timeKnown && luckPillar ? smthMinorHeavenVirtue(natal, pillars) : undefined;
  const heavenVirtueDirectionReview = timeKnown && luckPillar ? smthMinorHeavenVirtueDirection(monthBranch, annualPillar, variant.pillar) : undefined;
  const detail = (pillar: string) => {
    const computed = describeBaZiPillar(pillar, natal.day[0]);
    return { tenGod: computed.tenGod, mainQiTenGod: computed.hiddenStems[0]?.tenGod, naYin: computed.naYin,
      standardDayPhase: computed.phase, atDayLu: pillar[1] === dayLu, atYearLu: pillar[1] === yearLu,
      atYearHorse: pillar[1] === yearHorse.at };
  };
  return { profile: baziMinorLuckPolicy.profile, variant: variant.variant, direction: variant.direction,
    timeKnown, dayMaster: natal.day[0], annualPillar, minorPillar: variant.pillar, luckPillar, hasMajorLuck: Boolean(luckPillar),
    annual: detail(annualPillar), minor: detail(variant.pillar), dayLuBranch: dayLu, yearLuBranch: yearLu, yearHorseBranch: yearHorse.at,
    yearHorseCombineBranch: yearHorse.combinesAt, harmEvidence, hasIndependentHarm,
    commonStemSupport, commonHorseSupport, nobleSeason, horseProfile: baziMinorLuckPolicy.horse,
    horseEvidence: { annual: annualHorseClass, minor: minorHorseClass, annualAtResponseBranch: yearHorse.responseBranches.includes(annualBranch),
      minorAtResponseBranch: yearHorse.responseBranches.includes(minorBranch), seats: horseSeats, blockedPositions: blockedHorseSeats },
    hasSharedSourceSupport: commonStemSupport.length || horseSupports ? true
      : stemReviews.some(row => row.blocked) || (commonHorseSupport && blockedHorseSeats.length) ? false : undefined,
    directNobleProfile: baziMinorLuckPolicy.directNoble, directNobleReview,
    canopyProfile: timeKnown ? baziMinorLuckPolicy.canopy : undefined,
    canopyReview, hasSharedCanopySupport: timeKnown ? canopyReview?.candidate === true : undefined,
    nobleCombinationProfile: baziMinorLuckPolicy.nobleCombinations,
    nobleCombinationReview, hasSharedNobleCombinationSupport: nobleCombinationReview.some(row => row.distinctPairs === 2),
    yanNobleCombinationProfile: yanNobleCombinationReview ? baziMinorLuckPolicy.yanNobleCombinations : undefined,
    yanNobleCombinationReview, hasSharedYanNobleCombinationSupport: yanNobleCombinationReview?.some(row => row.candidate),
    moonVirtueProfile: timeKnown && luckPillar ? baziMinorLuckPolicy.moonVirtue : undefined,
    moonVirtueReview, hasSharedMoonVirtueSupport: moonVirtueReview?.candidate === true,
    heavenVirtueProfile: timeKnown && luckPillar ? baziMinorLuckPolicy.heavenVirtue : undefined,
    heavenVirtueReview, heavenVirtueDirectionReview, hasSharedHeavenVirtueSupport: heavenVirtueReview?.candidate === true,
    annualContacts, minorContacts, annualHarmTargets, minorHarmTargets,
    jointNatalHarmTargets: [...new Set(annualHarmTargets.filter(id => id.startsWith('natal:') && minorHarmTargets.includes(id)))],
    threePunishments: relations.groups.filter(row => row.kind === '三刑' && row.byBranch.flat().some(id => id === 'annual' || id === 'minor'))
      .map(row => ({ branches: row.values, participants: row.byBranch })),
    sourceEffects: 'unresolved-source-calendar-variant-actors-and-usefulness',
  };
}

export function smthMinorLuckAgreement(readings: ReturnType<typeof baziMinorLuckContext>[],
  history: ReturnType<typeof smthMinorMajorLuckHistory>) {
  const [first, ...others] = readings;
  const ownDirection = history.favorableBases.includes('nayin-in-own-direction');
  const namedFavorable = history.favorableBases.find(basis =>
    ['geng-chen-and-yi-you', 'ding-chou-to-ding-wei', 'wu-yin-to-ding-chou'].includes(basis));
  const sharedHarm = (ownDirection || namedFavorable) && history.adverseCases.length === 0
    ? first.harmEvidence.annual.filter(annual => annual.target.startsWith('natal:')
      && readings.every(row => row.harmEvidence.minor.some(minor => minor.target === annual.target && minor.kind === annual.kind)))
    : [];
  const harm = ownDirection ? sharedHarm : [];
  const namedHarm = !ownDirection && namedFavorable && sharedHarm.length
    ? { sourceCase: namedFavorable, positions: sharedHarm } : undefined;
  const minorOnlyHarm = ownDirection && history.adverseCases.length === 0
    && readings.every(row => !row.harmEvidence.annual.length && !row.harmEvidence.mutual.length)
    ? first.harmEvidence.minor.filter(witness => witness.target.startsWith('natal:')
      && others.every(row => row.harmEvidence.minor.some(other => other.target === witness.target && other.kind === witness.kind)))
    : [];
  const agreesOnWeakLuck = history.weakBases.length === 2 && history.favorableBases.length === 0;
  const common = agreesOnWeakLuck
    ? first.commonStemSupport.flatMap(row => ['禄', '长生', '帝旺'].flatMap(kind =>
      row.annual.includes(kind) && row.minor.includes(kind)
        && others.every(other => other.commonStemSupport.some(support => support.basis === row.basis
          && support.stem === row.stem && support.annual.includes(kind) && support.minor.includes(kind)))
        ? [{ basis: row.basis, stem: row.stem, kind }] : []))
    : [];
  const lu = common.filter(row => row.kind === '禄').map(({ basis, stem }) => ({ basis, stem }));
  const stemGrowth = common.filter(row => row.kind !== '禄');
  const directNoble = agreesOnWeakLuck ? first.directNobleReview.flatMap(({ basis, stem, nobleBranch }) =>
    nobleBranch && readings.every(row => row.directNobleReview.some(review =>
      review.basis === basis && review.stem === stem && review.nobleBranch === nobleBranch
      && review.seats.length === 2 && review.seats.every(seat => seat.eligible)))
      ? [{ basis, stem, branch: nobleBranch }] : []) : [];
  return { harm, lu, ...(namedHarm && { namedHarm }), ...(minorOnlyHarm.length && { minorOnlyHarm }), ...(stemGrowth.length && { stemGrowth }),
    ...(directNoble.length && { directNoble }) };
}
