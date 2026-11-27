import { createHash } from 'node:crypto';
import { baziStemPhase } from '../../control/charts.ts';
import { baziClassicalStructureNames } from './bazi-classical-structures.mjs';
import { normalizeRuleInput } from './matching.mjs';
import { missing as absentStem, pattern as monthDayCases, quantity, shown } from './qtbj-counted-passages.mjs';

export const yuanhaiNatalPassagesProfile = 'yhzp-ji-shan-biyuan-natal-v1';
const positions = ['year', 'month', 'day', 'hour'];
const visible = ['year', 'month', 'hour'];
const wealth = ['正财', '偏财'];
const stem = (position, stem) => ({ kind: 'stem', position, stem });
const branch = (position, branch) => ({ kind: 'branch', position, branch });
const pillar = (position, ganZhi) => ({ kind: 'pillar', position, ganZhi });
const stemGod = (position, tenGod) => ({ kind: 'stem_ten_god', position, tenGod });
const branchGod = (position, tenGod) => ({ kind: 'branch_ten_god', position, tenGod });
const monthMainGod = tenGod => ({ kind: 'branch_main_ten_god', position: 'month', tenGod });
const count = (tenGod, count) => ({ kind: 'bazi_ten_god_count', tenGod, count });
const countOptions = (god, options) => options.map(value => [count(god, value)]);
const anyPresence = god => countOptions(god, [1, 2, 3, 4]);
const ownStemPhase = (position, phase) => ({ kind: 'bazi_own_stem_phase', position, phase });
const withOwnPhase = (position, tenGod, phases) => phases.map(phase => [
  stemGod(position, tenGod), ownStemPhase(position, phase),
]);
const configuration = name => ({ kind: 'bazi_natal_configuration', name });
const woman = { kind: 'natal_gender', gender: '女' };
const man = { kind: 'natal_gender', gender: '男' };
const structure = name => ({ kind: 'bazi_ten_god_structure', name });
const element = element => ({ kind: 'bazi_natal_element', element });
const vigor = group => ({ kind: 'bazi_ten_god_strength', group, strength: '旺', profile: 'anchored-weighted-ten-god-v1' });
const balance = (element, band) => ({ kind: 'bazi_element_balance', element, band, profile: 'weighted-element-balance-v1' });
const temperament = (element, classification) => ({ kind: 'bazi_element_temperament', element, classification,
  profile: 'element-weighted-temperament-v1' });
const masterState = result => ({ kind: 'day_master_strength', result, profile: 'monthly-weighted-strength-v1' });
const strong = masterState('偏强'), weak = masterState('偏弱');
const shen = (position, name) => ({ kind: 'shen_sha', position, name });
const voidAt = position => shen(position, '空亡');
const relation = (relation, first, second) => ({ kind: 'bazi_branch_relation', relation, first, second });
const union = (first, second) => ({ kind: 'bazi_stem_combination', first, second });
const qualifiedPattern = name => ({ kind: 'bazi_month_pattern', name, result: '见配合' });
const hiddenSealAtGrowth = position => ({ kind: 'bazi_hidden_god_phase', position, tenGod: '正印', phase: '长生', anchor: 'host' });
const stemOn = name => visible.map(position => [stem(position, name)]);
const godOn = name => visible.map(position => [stemGod(position, name)]);
const mainGod = (position, tenGod) => ({ kind: 'branch_main_ten_god', position, tenGod });
const distinctPresence = (first, second, seats = positions) => seats.flatMap(position => seats
  .filter(other => other !== position).map(other => [shen(position, first), shen(other, second)]));
const blade = positions.map(position => [shen(position, '阳刃')]);
const pairs = positions.flatMap((first, index) => positions.slice(index + 1).map(second => [first, second]));
const monthClashes = pairs.filter(pair => pair.includes('month')).map(([first, second]) => [relation('六冲', first, second)]);
const hourClashes = pairs.filter(pair => pair.includes('hour')).map(([first, second]) => relation('六冲', first, second));
const dayPairs = pairs.filter(pair => pair.includes('day'));
const dayClashes = dayPairs.map(([first, second]) => relation('六冲', first, second));
const doubleDayClashes = dayClashes.flatMap((first, index) => dayClashes.slice(index + 1).map(second => [first, second]));
const dayHarmonies = dayPairs.flatMap(([first, second]) => ['六合', '三合'].map(kind => relation(kind, first, second)));
const dayWithoutHarms = dayPairs.flatMap(([first, second]) =>
  ['六冲', '六害', '相破', '相刑', '三刑', '自刑'].map(kind => relation(kind, first, second)));
const autumnWinterMonths = [...'申酉戌亥子丑'].map(value => [branch('month', value)]);
const seasonalEarthMonths = [...'辰戌丑未'].map(value => [branch('month', value)]);
const wealthVault = gods => ['year', 'month'].flatMap(position => gods.flatMap(god => withOwnPhase(position, god, ['墓'])));
const growthPhases = ['长生', '临官', '帝旺'];
const punishmentTypes = ['相刑', '三刑', '自刑'];
const allClashesAndBreaks = pairs.flatMap(([a, b]) => ['六冲', '相破'].map(kind => relation(kind, a, b)));
const fireNayinNames = ['炉中火', '山头火', '霹雳火', '山下火', '覆灯火', '天上火'];
const orderedWealthSeal = (first, last) => visible.flatMap((earlier, index) => visible.slice(index + 1).map(later => {
  const remaining = visible.find(position => ![earlier, later].includes(position));
  return {
    required: [structure('财星破印')],
    anyOf: first.flatMap(from => last.map(to => [stemGod(earlier, from), stemGod(later, to)])),
    mustBeAbsent: [...first, ...last].map(god => stemGod(remaining, god)),
  };
}));
const permutationsOfVisibleGods = (gods, seats = visible) => {
  if (!gods.length) return [[]];
  const [first, ...rest] = gods;
  return seats.flatMap(position => permutationsOfVisibleGods(rest, seats.filter(other => other !== position))
    .map(facts => [stemGod(position, first), ...facts]));
};
const wealthWithOfficerAtYearAndHour = wealth.flatMap(god => [
  [stemGod('year', god), stemGod('hour', '正官')],
  [stemGod('year', '正官'), stemGod('hour', god)],
]);
const noHiddenWealth = positions.flatMap(position => wealth.map(god => branchGod(position, god)));
const noHiddenFire = positions.flatMap(position => ['比肩', '劫财'].map(god => branchGod(position, god)));
const metalMonthsWaterDays = ['壬', '癸'].flatMap(day => ['申', '酉'].map(month => [stem('day', day), branch('month', month)]));
const waningPhases = ['衰', '死', '绝'];
const hiddenAtMonthPhase = (tenGod, phase) => positions.map(position =>
  [{ kind: 'bazi_hidden_god_phase', position, tenGod, phase, anchor: 'month' }]);
const outputAndOfficerWane = ['食神', '伤官'].flatMap(god => hiddenAtMonthPhase(god, '死'))
  .flatMap(output => waningPhases.flatMap(phase => hiddenAtMonthPhase('正官', phase).map(officer => [...output, ...officer])));
const stemCycle = '甲乙丙丁戊己庚辛壬癸';
const unseasonalDirectWealth = [...stemCycle].flatMap((day, index) => {
  const offset = ((Math.floor(index / 2) + 2) % 5) * 2;
  const wealth = stemCycle[offset + (index % 2 === 0 ? 1 : 0)];
  return [...'子丑寅卯辰巳午未申酉戌亥'].filter(value => waningPhases.includes(baziStemPhase(wealth, value)))
    .flatMap(value => stemOn(wealth).map(facts => [stem('day', day), branch('month', value), ...facts]));
});
const visibleMetalWater = ['庚', '辛'].flatMap(metal => ['壬', '癸'].flatMap(water =>
  visible.flatMap(first => visible.filter(second => second !== first).map(second => [stem(first, metal), stem(second, water)]))));
const overfullSealMonth = [...stemCycle].flatMap((day, index) => ['正印', '偏印'].map(god =>
  [stem('day', day), balance('木火土金水'[Math.floor(index / 2)], '过盛'), monthMainGod(god)]));
const pairedDayWithHiddenGod = (partner, gods) => [
  [stem('month', partner), union('month', 'day')], [stem('hour', partner), union('day', 'hour')],
].flatMap(facts => positions.flatMap(position => gods.map(god => [...facts, branchGod(position, god)])));

function branchSet(names, seats = positions) {
  if (!names.length) return [[]];
  const [first, ...rest] = names;
  return seats.flatMap((seat, index) => branchSet(rest, seats.filter((_, i) => i !== index))
    .map(group => [branch(seat, first), ...group]));
}

function opposedStems(firstStemSet, secondStemSet, opposingBranches) {
  return pairs.flatMap(([left, right]) => [[left, right], [right, left]].flatMap(([first, second]) =>
    [...firstStemSet].flatMap(firstStem => [...secondStemSet].flatMap(secondStem =>
      opposingBranches.map(([firstBranch, secondBranch]) => [
        stem(first, firstStem), stem(second, secondStem), branch(first, firstBranch), branch(second, secondBranch),
        relation('六冲', left, right),
      ])))));
}

const monthWithoutHarms = positions.filter(position => position !== 'month').flatMap(position => {
  const [first, second] = positions.filter(value => [position, 'month'].includes(value));
  return ['六冲', '六害', '相破', '相刑', '三刑', '自刑'].map(kind => relation(kind, first, second));
});
const absentBranches = names => positions.flatMap(position => [...names].map(value => branch(position, value)));
const absentVisibleGods = (...names) => names.flatMap(name => visible.map(position => stemGod(position, name)));
const hourWithoutHarms = hourClashes.flatMap(({ first, second }) =>
  ['六冲', '六害', '相破', '相刑', '三刑', '自刑'].map(kind => relation(kind, first, second)));
const genPatternExclusions = [
  ...absentBranches('午申巳亥'), ...stemOn('甲').flat(),
  ...absentVisibleGods(...wealth, '正官', '七杀'), ...hourWithoutHarms,
];
const natalHarmonyPairs = pairs.flatMap(([first, second]) => [union(first, second), relation('六合', first, second)]);
const foodControlsKilling = structure('食神制杀');
const qualifiedWealth = vigor('财星');
const yearMonthLoss = '年月见伤官与劫财';
const dayHourLoss = '日时见伤官与劫财';
const yearMonthSupport = '年月见财星、正官与正印';
const dayHourSupport = '日时见财星与正官';
const fourCardinalBranches = '四支子午卯酉俱全';
const alternatingStemNames = '年日同干、月时同干且两干交替';
const clashedOrBrokenLu = '禄神所在柱受冲或相破';
const fourHorseBranches = '四支寅申巳亥俱全';
const goldTrineBranches = '巳酉丑三支齐见';
const sealUnderClash = '正印所在柱受刑或冲';
const sealWithCanopy = '正印与华盖同柱';
const hourWealth = '时干或时支本气见偏财';
const monthWealthWithRobbery = '月财透干且他干透劫财';
const springWoodWithOutput = '春生木日见食伤';
const visibleWealth = '天干透财';
const repeatedBladeWithKilling = '两柱以上阳刃且见七杀';
const bladeWithKilling = '阳刃与七杀俱见';
const sameDayElement = '日干与日支本气同五行';
const officerAcrossYearMonthHour = '月令正官且年月时都见正官并有透干';
const hourKillingControlledByMonth = '时干七杀且月干或月支本气为食神';
const monthKilling = '月支本气七杀';
const hourStemKilling = '时干七杀';
const hourStemIndirectWealth = '时干偏财';
const dayBranchHurtingOfficer = '日支本气伤官';
const repeatedChenOutsideDay = '年、月、时至少两支为辰';
const earthVaults = '辰戌丑未四支俱见';
const fireBranches = '寅午戌或巳午未三支齐见';
const fireTrineBranches = '寅午戌三支齐见';
const woodBranches = '寅卯辰或亥卯未三支齐见';
const woodTrineBranches = '亥卯未三支齐见';
const waterTrineBranches = '申子辰三支齐见';
const waterSeasonBranches = '亥子丑三支齐见';
const repeatedChen = '四支至少两支为辰';
const doubleZiBranches = '四支至少两支为子';
const doubleSiBranches = '四支至少两支为巳';
const repeatedNatalBlade = '日主阳刃实际落于至少两柱';
const clashedOrBrokenWealth = '坐财或透财之柱参与六冲或相破';
const multiplePunishments = '至少两组不同地支柱位成刑';
const repeatedXu = '四支至少两支为戌';
const repeatedWu = '四支至少两支为午';
const noRepeatedBlade = '原局阳刃少于两柱';
const yearDaySameBranch = '年支与日支相同';
const hourKillingRooted = '时干七杀在至少两支通根';
const visibleWealthAndOfficer = '正偏财与正官实透天干';
const wealthAndSeal = '四柱见财星和印星';
const dayAndMonth = god => '日支月令同藏' + god + '与正官';
const exposedIndirectWealthOnVoid = '透干偏财坐空亡';
const hiddenIndirectWealthOnVoid = '支藏偏财落空亡';
const lossGods = [['伤官'], ['劫财']];
const wealthAndOfficer = [wealth, ['正官']];
const branchGroups = [
  ['子午卯酉', fourCardinalBranches], ['寅申巳亥', fourHorseBranches], ['巳酉丑', goldTrineBranches],
  ['辰戌丑未', earthVaults], ['寅午戌', fireBranches], ['巳午未', fireBranches], ['寅午戌', fireTrineBranches],
  ['寅卯辰', woodBranches], ['亥卯未', woodBranches], ['亥卯未', woodTrineBranches],
  ['申子辰', waterTrineBranches], ['亥子丑', waterSeasonBranches],
];

export function yuanhaiPillarGroupFacts({ pillars, tenGodIndex }, branchRelations, bladeBranch) {
  const [yearMonth, dayHour] = [['year', 'month'], ['day', 'hour']].map(seats =>
    new Set(tenGodIndex.filter(({ exposed, hidden }) =>
      [...exposed, ...hidden].some(({ position }) => seats.includes(position))).map(({ name }) => name)));
  const patterns = [
    [yearMonth, yearMonthLoss, lossGods],
    [dayHour, dayHourLoss, lossGods],
    [yearMonth, yearMonthSupport, [...wealthAndOfficer, ['正印']]],
    [dayHour, dayHourSupport, wealthAndOfficer],
  ];
  const facts = patterns.filter(([observed, , groups]) => groups.every(group => group.some(god => observed.has(god))))
    .map(([, label]) => configuration(label));
  const natalBranches = pillars.map(({ branch }) => branch.name);
  for (const [group, name] of branchGroups) {
    if ([...group].every(value => natalBranches.includes(value))) facts.push(configuration(name));
  }
  const inDayAndMonth = god => ['day', 'month'].every(seat =>
    tenGodIndex.find(({ name }) => name === god).hidden.some(({ position }) => position === seat));
  if (inDayAndMonth('正官')) {
    facts.push(...wealth.filter(inDayAndMonth).map(god => configuration(dayAndMonth(god))));
  }
  const voidPillars = pillars.filter(({ shenSha }) => shenSha.some(({ name }) => name === '空亡'));
  if (voidPillars.some(({ tenGod }) => tenGod === '偏财')) facts.push(configuration(exposedIndirectWealthOnVoid));
  if (voidPillars.some(({ hiddenStems }) => hiddenStems.some(({ tenGod }) => tenGod === '偏财'))) {
    facts.push(configuration(hiddenIndirectWealthOnVoid));
  }
  const [year, month, day, hour] = pillars;
  if (year.stem.name === day.stem.name && month.stem.name === hour.stem.name && year.stem.name !== month.stem.name) {
    facts.push(configuration(alternatingStemNames));
  }
  if (branchRelations.some(({ type, state, positions }) => state === 'complete' && ['六冲', '相破'].includes(type)
    && pillars.some(({ position, shenSha }) => positions.includes(position) && shenSha.some(({ name }) => name === '禄神')))) {
    facts.push(configuration(clashedOrBrokenLu));
  }
  const monthMain = month.hiddenStems[0].tenGod;
  const seal = tenGodIndex.find(({ name }) => name === '正印');
  const sealSeats = new Set([...seal.exposed, ...seal.hidden].map(({ position }) => position));
  const officer = tenGodIndex.find(({ name }) => name === '正官');
  const officerSeats = new Set([...officer.exposed, ...officer.hidden].map(({ position }) => position));
  const hasGod = (...names) => tenGodIndex.some(({ name, exposed, hidden }) =>
    names.includes(name) && (exposed.length > 0 || hidden.length > 0));
  const bladeCount = natalBranches.filter(value => value === bladeBranch).length;
  if (bladeCount >= 2) facts.push(configuration(repeatedNatalBlade));
  if (natalBranches.filter(value => value === '子').length >= 2) facts.push(configuration(doubleZiBranches));
  if (natalBranches.filter(value => value === '巳').length >= 2) facts.push(configuration(doubleSiBranches));
  if (branchRelations.some(({ type, state, positions }) => state === 'complete' && ['六冲', '相破'].includes(type)
    && pillars.some(pillar => positions.includes(pillar.position)
      && (wealth.includes(pillar.tenGod) || wealth.includes(pillar.hiddenStems[0].tenGod))))) {
    facts.push(configuration(clashedOrBrokenWealth));
  }
  const punishedPositions = new Set(branchRelations.filter(({ type, state }) =>
    state === 'complete' && punishmentTypes.includes(type))
    .flatMap(({ positions }) => pairs.filter(pair => pair.every(position => positions.includes(position))).map(pair => pair.join('/'))));
  if (punishedPositions.size >= 2) facts.push(configuration(multiplePunishments));
  const hasKilling = hasGod('七杀');
  const otherPillars = [year, month, hour];
  const configurations = [
    [yearDaySameBranch, year.branch.name === day.branch.name],
    [hourKillingRooted, hour.tenGod === '七杀' && pillars.filter(({ hiddenStems }) =>
      hiddenStems.some(({ element }) => element === hour.stem.element)).length >= 2],
    [visibleWealthAndOfficer, otherPillars.some(({ tenGod }) => wealth.includes(tenGod))
      && otherPillars.some(({ tenGod }) => tenGod === '正官')],
    [wealthAndSeal, hasGod(...wealth) && hasGod('正印', '偏印')],
    [repeatedChen, natalBranches.filter(value => value === '辰').length >= 2],
    [repeatedXu, natalBranches.filter(value => value === '戌').length >= 2],
    [repeatedWu, natalBranches.filter(value => value === '午').length >= 2],
    [noRepeatedBlade, bladeCount < 2],
    [sealUnderClash, branchRelations.some(({ type, state, positions }) => state === 'complete'
      && ['六冲', '相刑', '三刑', '自刑'].includes(type) && positions.some(position => sealSeats.has(position)))],
    [sealWithCanopy, pillars.some(({ position, shenSha }) => sealSeats.has(position) && shenSha.some(({ name }) => name === '华盖'))],
    [hourWealth, hour.tenGod === '偏财' || hour.hiddenStems[0].tenGod === '偏财'],
    [monthWealthWithRobbery, wealth.includes(month.tenGod) && pillars.some(({ position, tenGod }) =>
      (position === 'year' || position === 'hour') && tenGod === '劫财')],
    [springWoodWithOutput, day.stem.element === '木' && '寅卯辰'.includes(month.branch.name) && hasGod('食神', '伤官')],
    [visibleWealth, pillars.some(({ tenGod }) => wealth.includes(tenGod))],
    [repeatedBladeWithKilling, bladeCount >= 2 && hasKilling],
    [bladeWithKilling, bladeCount > 0 && hasKilling],
    [sameDayElement, day.stem.element === day.branch.element],
    [officerAcrossYearMonthHour, monthMain === '正官' && officer.exposed.length > 0
      && otherPillars.every(({ position }) => officerSeats.has(position))],
    [hourKillingControlledByMonth, hour.tenGod === '七杀' && [month.tenGod, monthMain].includes('食神')],
    [monthKilling, monthMain === '七杀'],
    [hourStemKilling, hour.tenGod === '七杀'],
    [hourStemIndirectWealth, hour.tenGod === '偏财'],
    [dayBranchHurtingOfficer, day.hiddenStems[0].tenGod === '伤官'],
    [repeatedChenOutsideDay, otherPillars.filter(({ branch }) => branch.name === '辰').length >= 2],
  ];
  facts.push(...configurations.filter(([, present]) => present).map(([name]) => configuration(name)));
  return facts;
}

// Quoted sections retain the actual solar month, pillar placements and
// any source antecedents needed for that individual clause.
const reviewed = new Map([
  ['yhzp-v2-c308-p002-001', ['0776be4093239e1500e8025600714af57d22a0c392e6dd9f8d3a62eaf882ed5d',
    ["若四柱有未字，則午不能去冲矣。", [{
      required: [stem('day', '丙'), count('正官', 0), configuration(repeatedWu)],
      anyOf: visible.map(position => [branch(position, '未')]),
    }]],
  ]],
  ['yhzp-v2-c329-p002-001', ['bfe03aa8b3f38630c349abdf82e647942638dc48a6c845c7e5ed84a88d9d5252',
    ["此格四柱怕見寅午戌三字，則冲壞矣", [{
      required: [stem('day', '庚'), configuration(waterTrineBranches)],
      anyOf: ['year', 'month', 'hour'].flatMap(position => [...'寅午戌'].map(value => [branch(position, value)])),
      mustBeAbsent: [pillar('hour', '丙子'), branch('hour', '申')],
    }]],
  ]],
  ['yhzp-v2-c354-p002-001', ['a2121c49dc0551ee21e7e650704281bfd2f5a95632667577478207e3962f6e66',
    ["多見寅字，則用寅中甲木，暗邀己土爲壬日之官星", [{
      required: [stem('day', '壬'), pillar('hour', '壬寅'), strong],
      anyOf: ['year', 'day'].map(position => [branch(position, '寅')]),
      mustBeAbsent: genPatternExclusions,
    }]],
  ]],
  ['yhzp-v5-c250-p004-001', ['4945859789f196f85d9fa99daffe285c14cca334a9f3bc74a8e067d53db1a814',
    ["如無此破貴無疑", [
      ['丁巳', '丁未', '午子'],
      ['己未', '己巳', '午子'],
      ['戊辰', '戊午', '巳亥'],
      ['癸丑', '癸亥', '子午'],
      ['癸亥', '癸丑', '子午'],
    ].map(([day, hour, virtualAndOpposite]) => ({
      required: [pillar('day', day), pillar('hour', hour), configuration(noRepeatedBlade)],
      mustBeAbsent: [
        ...absentBranches(virtualAndOpposite), branchGod('month', '伤官'), branchGod('month', '正官'),
        stemGod('year', '七杀'), stemGod('month', '七杀'), ...dayWithoutHarms, ...hourWithoutHarms,
      ],
    }))],
  ]],
  ['yhzp-v5-c266-p002-001', ['8d5890f598dd8cf2447471b33886b94aa992dd85af420e4de45b91730fda183b',
    ["壬日寅時爲貴格，此名趨艮福非常", [{
      required: [stem('day', '壬'), pillar('hour', '壬寅'), strong],
      mustBeAbsent: genPatternExclusions,
    }]],
  ]],
  ['yhzp-v5-c422-p007-001', ['b32199c370f5633b9ff852905af7a569993317450414f0fd26ce2d2994a2926a',
    ["官帶桃花福壽長", [{
      required: [woman, count('七杀', 0)],
      anyOf: visible.map(position => [stemGod(position, '正官'), shen(position, '桃花')]),
      mustBeAbsent: natalHarmonyPairs,
    }]],
    ["桃花帶殺少禎祥", [{
      required: [woman, count('正官', 0)],
      anyOf: ['month', 'hour'].map(position => [stemGod(position, '七杀'), shen(position, '桃花')]),
      mustBeAbsent: natalHarmonyPairs,
    }]],
  ]],
  ['yhzp-v2-c230-p004-101', ['3568248ef60f85039a5bcbfaf0d1b9323030c538a0592b39f31bd77cd18f2cc4',
    ['能飽食豐厚', [{
      required: [qualifiedPattern('正印格'), structure('印绶护身')],
      mustBeAbsent: [qualifiedWealth],
    }]],
  ]],
  ['yhzp-v2-c269-p002-001', ['b1881dac014fab82751cf65d22506d36fc154558e716fbee376646457c3e1fa3',
    ['須待有以開其局鑰，方言發福', [
      ['辰', '正官', ['hour']],
      ['辰', '正印', ['hour']],
      ['戌', '正官', ['year', 'hour']],
      ['戌', '正财', ['year', 'hour']],
      ['戌', '正印', ['year', 'hour']],
    ].map(([month, god, seats]) => ({
      required: [branch('month', month), relation('六冲', 'month', 'day'), branchGod('month', god), qualifiedPattern(god + '格')],
      anyOf: seats.map(position => [stemGod(position, god)]),
    }))],
  ]],
  ['yhzp-v2-c395-p002-001', ['6b29edf7047c79110c60bb61388839e99596769d3a4199d930be78e80d942c9e',
    ['此格用日支與時支共拱其財', [{
      required: [pillar('day', '甲寅'), pillar('hour', '甲子'), strong],
      mustBeAbsent: absentBranches('丑酉'),
    }]],
  ]],
  ['yhzp-v3-c016-p002-101', ['ad23295ea6e67481a3a39a7d7c7d236e92eaf901d5c67029c37e46385d7ac7df',
    ['財官並美，爲人怕妻', [[
      man, qualifiedWealth, structure('财官相生'), configuration(visibleWealthAndOfficer), count('七杀', 0),
    ]]],
  ]],
  ['yhzp-v5-c002-p010-001', ['03391112347a7fd309bd78c4466ce2519251444fd1499fd4b4f34e9490ae7966',
    ['格中大怕卯和丁', [{
      required: [stem('day', '甲'), branch('month', '酉'), monthMainGod('正官')],
      anyOf: [
        ...stemOn('丁').map(slot => [...slot, branch('year', '卯'), relation('六冲', 'year', 'month')]),
        ...stemOn('丁').map(slot => [...slot, branch('hour', '卯'), relation('六冲', 'month', 'hour')]),
      ],
    }]],
  ]],
  ['yhzp-v5-c153-p002-001', ['8a746c68123a468e9c8c4a0451ab77630a0bd4ee652304588e0bb0eca05296e6',
    ['假如月上又重見，\n辛苦徒勞百事空', [{
      required: [strong, stemGod('hour', '七杀'), stemGod('month', '七杀'), count('七杀', 2)],
      mustBeAbsent: [
        vigor('七杀'),
        ...hourClashes.flatMap(({ first, second }) =>
          ['六冲', '相刑', '三刑', '自刑'].map(kind => relation(kind, first, second))),
      ],
    }]],
  ]],
  ['yhzp-v5-c187-p006-001', ['5b703682a2c52327ab3c2488b3b228b9d1a72b8ad593ef1bc909384de5ebdadb',
    ['若無官殺拜丹墀', [{
      required: [stem('day', '乙'), pillar('hour', '丙子'), count('官杀', 0)],
      mustBeAbsent: absentBranches('午申酉丑'),
    }]],
  ]],
  ['yhzp-v5-c206-p003-001', ['93ee08a4c9c25d80b3926eea97804294c7935dafdef257b9b3458f3bc0e6874f',
    ['甲臨子字日時全，擬作蟾宮折桂仙', [{
      required: [pillar('day', '甲子'), pillar('hour', '甲子'), count('官杀', 0)],
      mustBeAbsent: absentBranches('丑午'),
    }]],
  ]],
  ['yhzp-v5-c227-p007-001', ['836713624501f7fbed2ddd217096724ef0ad5e655416d84d72f428da017ef704',
    ['若是申時歸祿格', [{
      required: [stem('day', '庚'), configuration(waterTrineBranches), branch('hour', '申'), shen('hour', '禄神')],
      mustBeAbsent: [...absentBranches('寅巳午戌'), ...absentVisibleGods('正官', '七杀')],
    }]],
    ['時逢丙子殺神加', [{
      required: [stem('day', '庚'), configuration(waterTrineBranches), pillar('hour', '丙子'), stemGod('hour', '七杀')],
      mustBeAbsent: [...absentBranches('寅巳午戌'), ...['year', 'month'].flatMap(position =>
        [stemGod(position, '正官'), stemGod(position, '七杀')])],
    }]],
  ]],
  ['yhzp-v5-c302-p006-001', ['055bee50cafb9d1c9488d2fea9fdf33ffba1dcb2205fbbd9d9dd477e15f1fe53',
    ['四柱火來侵尅破，須知名利兩無成', [{
      required: [stem('day', '辛'), configuration(goldTrineBranches), vigor('官杀')],
      anyOf: [...stemOn('丙'), ...stemOn('丁')],
    }]],
  ]],
  ['yhzp-v2-c002-p029-101', ['4471b79db97903ca5db496a46c51b577ac97e1cebe95bfaddc5ee14d114963f7',
    ["見甲木制之，則吉貴也，不宜甲乙木多，若多則太過也", [{
      required: [stem('day','壬'),count('食神',1),count('伤官',0)],
      anyOf: visible.flatMap(first => visible.filter(second=>second!==first)
        .map(second=>[stem(first,'甲'),stem(second,'戊')])),
    }]],
  ]],
  ['yhzp-v2-c002-p045-001', ['557d598311a0339ad29e2818eda8d6071812813ae8b3513c2bfdfc2168e7d170',
    [null, [{ required: [weak, qualifiedWealth], anyOf: [2,3,4].map(value=>[count('财星',value)]) }]],
  ]],
  ['yhzp-v2-c002-p047-001', ['975d43bf979fddcb71146004278c98cac99e71ef7fc79042e9efb612e31e1806',
    ["以殺化權，定顯寒門貴客。", [{ required: [stem('day','丙'),strong,foodControlsKilling], anyOf: stemOn('壬') }]],
  ]],
  ['yhzp-v2-c002-p058-001', ['c61215679669f9c4e94830320b874d76d9ad334993587e35094ff8d4504650cb',
    ["印綬被傷，倘若榮華不久。", [[branchGod('month','正印'),structure('财星破印')]]],
  ]],
  ['yhzp-v2-c002-p060-001', ['f8704e3cedce11a93a720929ad4ebf7518e474694cfc604326609c9587a3f7cf',
    ["有官有印，無破，作廊廟之材。", [...'辰丑未'].map(month => ({
      required: [branch('month',month), branchGod('month','正官'), branchGod('month','正印')],
      mustBeAbsent: [...monthWithoutHarms,...visible.map(position=>stemGod(position,'伤官')),qualifiedWealth],
    }))],
  ]],
  ['yhzp-v2-c002-p075-001', ['6e93dee71b89776afcff4489517e1f75c40c0578eaf81ba3c816246be71bb327',
    ["爲人好殺，羊刃必犯于偏官。", [{ required: [vigor('七杀')], anyOf: blade, mustBeAbsent: positions.map(p=>shen(p,'天乙贵人')) }]],
  ]],
  ['yhzp-v2-c002-p082-001', ['92101d2deb84111afebb45191bd6a9e20859841ad10a35b55bf793fbecc8a875',
    [null, [[qualifiedWealth,strong]]],
  ]],
  ['yhzp-v2-c002-p086-001', ['148ce4285bb46dce5fd6dc78aa0ded29a16da5a88fbfe5e6995e1b3356a15858',
    ["少樂多憂，蓋因日主自弱。", [{ required: [weak], anyOf: ['休','囚','死'].map(season=>[{kind:'bazi_day_master_season',season}]) }]],
  ]],
  ['yhzp-v2-c002-p088-001', ['32920751a0676b70c0eaa29f659e35c73c48546d2898981054de4db99708ffeb',
    ["身强殺淺，假殺爲權。", [{ required:[strong,count('七杀',1)], anyOf:godOn('七杀'),
      mustBeAbsent:positions.map(p=>branchGod(p,'七杀')) }]],
  ]],
  ['yhzp-v2-c002-p122-001', ['0404dc492dbacff6d6105be347d303af597a42280d269d06adebcfa254e0cb0d',
    ["甲逢巳而生旺，定懷中正之心。", [{ required:[stem('day','甲')],
      anyOf:['甲己','己甲'].flatMap(pair=>['旺','过盛'].map(band=>[
        { kind:'bazi_stem_transformation',pair,element:'土' }, balance('土',band),
      ])) }]],
  ]],
  ['yhzp-v2-c002-p131-101', ['2942a2f5dc5843526f2ccb1888987414cd20ca464eea13da4440280fb51beae8',
    ["制，應爲鬼殺化爲權", [{ required:[pillar('day','庚寅'),strong,foodControlsKilling], anyOf:stemOn('丙'),
      mustBeAbsent:[vigor('七杀')] }]],
  ]],
  ['yhzp-v2-c002-p144-101', ['12265c0eee74a13dc79f0cbf2f68804b587eee6b901e08fb742fe340b2528f2f',
    ["獨水三犯庚辛重，金能生水水還同", [...'壬癸'].map(day => ({ required: [stem('day',day),balance('金','旺')],
      anyOf: positions.flatMap(position=>[...'申酉'].map(value=>[branch(position,value)])) }))
      .map(input=>({...input,anyOf:input.anyOf.flatMap(group =>
        [...'庚辛'].flatMap(year=>[...'庚辛'].flatMap(month=>[...'庚辛'].map(hour=>[
          ...group,stem('year',year),stem('month',month),stem('hour',hour),
        ]))))}))],
  ]],
  ['yhzp-v2-c002-p172-101', ['a486736901b680613f36d76eca11ff5d50ae8d423759621df7b66dae3c551817',
    ["若四柱有合，是爲貪合忘官", [{ required:[stem('day','甲'),structure('官杀混杂')],
      anyOf: pairs.filter(pair=>pair.every(p=>p!=='day')).flatMap(([first,second]) =>
        [[first,second],[second,first]].flatMap(([fire,metal])=>pairs.map(([a,b])=>[
          stem(fire,'丙'),stem(metal,'辛'),union(first,second),relation('六合',a,b),
        ]))) }]],
  ]],
  ['yhzp-v2-c002-p181-001', ['ee0747c0063cc4f80d209cd0a6173c74d4b62893323a77141a933c5c608e961c',
    ["柱中七殺全彰，身旺極貧。", [[strong,...visible.map(p=>stemGod(p,'七杀'))]]],
  ]],
  ['yhzp-v2-c002-p202-001', ['f3e3273ad4e7813d6dbb487be46d26d1d70be7534555c1c123ed5138ebc3e133',
    ["金木交差，刑戰，仁義俱無", [{
      required: [element('金'), element('木')], anyOf: opposedStems('庚辛', '甲', [['申', '寅'], ['酉', '卯']]),
    }]],
  ]],
  ['yhzp-v2-c002-p202-002', ['5f2127f1ab246ca813a4dd043054988dfc0bcde66400a4deb68fab1285f356b4',
    ["水火遞互相傷，是非日有", [{
      required: [element('水'), element('火')], anyOf: opposedStems('壬癸', '丙丁', [['子', '午'], ['亥', '巳']]),
    }]],
  ]],
  ['yhzp-v2-c002-p205-001', ['9ff9e9eefa7088746ae7973676c9570643aec9c6c82d8bff6c312d1295ab843c',
    ["木從水養，水盛而木則漂流", [...'甲乙'].map(day=>({ required:[stem('day',day),balance('木','弱')],
      anyOf:['旺','过盛'].map(band=>[balance('水',band)]) }))],
  ]],
  ['yhzp-v4-c025-p004-001', ['43b1cd6436867c1c2d9f3a6e5455fdd02e90c0a493f360785c544bfa22728107',
    ["逢官而看財，見財而富贵", [[structure('财官相生')]]],
  ]],
  ['yhzp-v4-c025-p005-001', ['b42042643b5c55ce266a91a8f932b350c1db9ff5657ec0dc15024932a3b69573',
    [null, [...'壬癸'].map(day=>({ required:[stem('day',day)],anyOf:branchSet('申子辰') }))],
  ]],
  ['yhzp-v4-c025-p005-003', ['30a4369dd2572f4670e5f214b697a2bfdb1f7b55d9a2d42674df019d0bbb7014',
    [null, [...'庚辛'].map(day=>({ required:[stem('day',day)],anyOf:branchSet('巳酉丑') }))],
  ]],
  ['yhzp-v4-c025-p006-001', ['279d56f05010c538e1103a9b7eb891036acb966157b230d21559769988c40b55',
    ["丙丁生於冬月，貴乎戊巳當頭", [...'丙丁'].flatMap(day=>[...'亥子丑'].map(month=>({
      required:[stem('day',day),branch('month',month)],
      anyOf:visible.flatMap(first=>visible.filter(second=>second!==first).map(second=>[stem(first,'戊'),stem(second,'己')])),
    })))],
    ["庚辛産於夏天，妙乎𡈼癸得局", [...'庚辛'].flatMap(day=>[...'巳午未'].map(month=>({
      required:[stem('day',day),branch('month',month)],
      anyOf: ['申子辰', '亥子丑'].flatMap(names => branchSet(names, ['year', 'day', 'hour'])).flatMap(group =>
        [...stemOn('壬'), ...stemOn('癸')].map(shown => [...group, ...shown])),
    })))],
  ]],
  ['yhzp-v4-c025-p007-001', ['f694cdd44c477b3986190b7e107c49b53724bd8101c3232550a3df28fc7b2065',
    ["年月宫星，早年出仕", ['year','month'].map(position=>({
      required:[stemGod(position,'正官')],
      mustBeAbsent:[...visible.map(p=>stemGod(p,'伤官')),...visible.map(p=>stemGod(p,'七杀')),
        ...positions.flatMap(p=>['伤官','七杀'].map(god=>branchGod(p,god)))],
    }))],
    ["日時正貴，晚岁成名", [['癸卯', 'day'], ['丁亥', 'day'], ['癸巳', 'night'], ['丁酉', 'night']].map(([day, sect]) => [
      pillar('day', day), { kind: 'natal_daylight', sect }, shen('hour', '天乙贵人'),
    ])],
  ]],
  ['yhzp-v4-c025-p007-002', ['84e83f35506c2c6a127b2266a97a1be0191f2c344471d1a30222581940405799',
    ["財氣遇長生，肥田萬傾", positions.flatMap(position => wealth.map(tenGod => [
      { kind: 'bazi_hidden_god_phase', position, tenGod, phase: '长生', anchor: 'host' },
    ]))],
  ]],
  ['yhzp-v4-c025-p008-001', ['0f3995b0f231a99416bd2b09d568f793614a03fe419b162433ff1f495d0f610c',
    [null, [{ required:[foodControlsKilling],anyOf:blade }]],
  ]],
  ['yhzp-v4-c025-p009-001', ['54c578f5bfb684485ee18d02f8051fab0247966818c66a8e0f993d7ad7bb1ee0',
    [null, [['癸亥','丑'],['癸丑','亥']].map(([hour,other])=>({
      required:[stem('day','癸'),pillar('hour',hour)],
      anyOf:['year','month','day'].map(position=>[branch(position,other)]),
    }))],
  ]],
  ['yhzp-v4-c025-p010-001', ['1944a1cab40f383e619dd90b56fec7e4fb5302dbb7346ee8df993c09a4bd080b',
    ["傷官逢財而有子", [[structure('伤官生财')]]],
    ["七殺有制亦多兒", [[foodControlsKilling]]],
  ]],
  ['yhzp-v4-c025-p011-001', ['29f5d7393ef43cdd7a68c30fd1295b770e17964df19aebd5e2e7f84097db35e3',
    ["年月財官身旺，公顯父榮", [['year','month'],['month','year']].map(([money,officer])=>({
      required:[strong,stemGod(officer,'正官')],anyOf:wealth.map(god=>[stemGod(money,god)]),
    }))],
  ]],
  ['yhzp-v4-c025-p013-001', ['b91ec81de33791237ef46e29f07749ffc40b7e93a7ea9babc924587127109248',
    ["金剛木弱，行商坐賈之人", [{ required:[balance('木','弱')],anyOf:['旺','过盛'].map(band=>[balance('金',band)]) }]],
  ]],
  ['yhzp-v4-c025-p014-001', ['076f767eb6c8c140ce6d96bf033055b61396181338695e6766d63c50ff849955',
    ["火向春林逢水旺，好去求名", [...'丙丁'].flatMap(day=>[...'寅卯辰'].map(month=>({
      required: [stem('day', day), branch('month', month), vigor('官杀')],
    })))],
    ["土臨季地，見金重，將來出仕", [...'戊己'].flatMap(day=>[...'辰戌丑未'].map(month=>({
      required:[stem('day',day),branch('month',month)],anyOf:['旺','过盛'].map(band=>[balance('金',band)]),
    })))],
  ]],
  ['yhzp-v4-c025-p015-001', ['c4ade286ba842e38cd848a5ef4b6e15a7b995316846789ed150968e3b393b6e1',
    ["專禄帶食傷，權掌閫外", ['甲寅','乙卯','庚申','辛酉'].map(day=>({
      required:[pillar('day',day)],anyOf:['食神','伤官'].flatMap(godOn),
    }))],
  ]],
]);

const dayTransformation = (stem, partner, element) => ({ kind: 'bazi_day_stem_transformation', stem, partner, element });
const abundant = element => ['旺', '过盛'].map(band => [balance(element, band)]);
const root = name => quantity(name, 'hidden', 1);
const combined = (...groups) => groups.reduce((inputs, choices) => inputs.flatMap(input =>
  choices.map(choice => [...input, ...choice])), [[]]);
const dayJiaEarth = dayTransformation('甲', '己', '土');
const dayGengMetal = dayTransformation('庚', '乙', '金');
const dayXinWater = dayTransformation('辛', '丙', '水');
const dayRenWood = dayTransformation('壬', '丁', '木');
const dayWuFire = dayTransformation('戊', '癸', '火');
const dayGuiFire = dayTransformation('癸', '戊', '火');
const noHiddenRoots = stems => [...stems].flatMap(value => quantity(value, 'hidden', 0, 0)[0]);
const monthTableExposed = seasonalEarthMonths.flatMap(([month]) =>
  ['正官', '正印', '偏印', ...wealth].map(tenGod => ({ required: [month,
    { kind: 'bazi_month_pattern', name: tenGod + '格', result: '见配合' }],
    // 辰月正官透在年或时已有盘证，月干透出的备选仍待核。
    anyOf: godOn(tenGod).filter(([fact]) => month.branch !== '辰' || tenGod !== '正官' || fact.position !== 'month'),
  })));
const jiaApproachesHai = {
  required: [stem('day', '甲'), count('财星', 0)],
  anyOf: pairs.filter(pair => !pair.includes('day')).map(pair => pair.map(position => branch(position, '亥'))),
  mustBeAbsent: positions.flatMap(position => ['寅', '巳'].map(value => branch(position, value))),
};

const reviewedDayVirtues = ['甲寅', '庚辰', '壬戌'];
const kuiGangDays = ['庚辰', '庚戌', '戊戌', '壬辰'];
const nonDayKuiGang = visible.flatMap(position => kuiGangDays.map(value => pillar(position, value)));
const heavenlyNobleDayBranches = [...'甲戊庚乙己丙丁壬癸辛'].map((day, index) =>
  [day, ['丑未', '丑未', '丑未', '子申', '子申', '亥酉', '亥酉', '卯巳', '卯巳', '午寅'][index]]);
const daylightNobleDays = [['癸卯', 'day'], ['丁亥', 'day'], ['癸巳', 'night'], ['丁酉', 'night']];
const nayinStage = (position, phase) => ({ kind: 'bazi_nayin_phase', position, phase });
const separateHarmonies = [[['year', 'month'], ['day', 'hour']], [['year', 'day'], ['month', 'hour']],
  [['year', 'hour'], ['month', 'day']]].flatMap(([first, second]) => [
  [union(...first), union(...second)],
  [relation('六合', ...first), relation('六合', ...second)],
]);
const cleanFoodPillars = visible.map(position => ({
  required: [vigor('食神'), stemGod(position, '食神'), count('偏印', 0)],
  anyOf: growthPhases.map(phase => [ownStemPhase(position, phase)]),
  mustBeAbsent: pairs.filter(pair => pair.includes(position)).flatMap(([first, second]) =>
    ['六冲', ...punishmentTypes].map(kind => relation(kind, first, second))),
}));
const visibleStemPairWithHour = (firstStem, secondStem) => pairs
  .filter(([first, second]) => first !== 'day' && second === 'hour')
  .flatMap(([first, second]) => [[firstStem, secondStem], [secondStem, firstStem]].map(([left, right]) =>
    [stem(first, left), stem(second, right), union(first, second)]));
const jiaWithBingAndRen = [[1, 1], [2, 1], [1, 2]].map(([bing, ren]) => [
  stem('day', '甲'), structure('枭印夺食'),
  ...quantity('丙', 'visible', bing, bing)[0], ...quantity('壬', 'visible', ren, ren)[0],
]);
const fireControlledMetalCases = [
  ['甲', '庚', '食神制杀', 2],
  ['甲', '辛', '伤官见官', 1],
  ['乙', '庚', '伤官见官', 1],
].map(([day, metal, relation, maximum]) => ({
  required: [stem('day', day), configuration(fireTrineBranches), structure(relation)],
  anyOf: quantity(metal, 'visible', 1, maximum),
}));

const archLuPairs = [
  ['丁巳', '丁未', '午'], ['己未', '己巳', '午'], ['戊辰', '戊午', '巳'],
  ['癸丑', '癸亥', '子'], ['癸亥', '癸丑', '子'],
];
const archNoblePairs = [['辛丑', '辛卯', '寅'], ['乙未', '乙酉', '申']];
const archPillars = (day, hour) => [pillar('day', day), pillar('hour', hour)];
const archSeatPairs = pairs.filter(pair => pair.includes('day') || pair.includes('hour'));
const archClashes = archSeatPairs.map(([first, second]) => relation('六冲', first, second));
const archHarms = archSeatPairs
  .flatMap(([first, second]) => ['六冲', '六害', '相破', ...punishmentTypes].map(kind => relation(kind, first, second)));
const opposingArchCenter = { 子: '午', 午: '子', 巳: '亥', 寅: '申', 申: '寅' };
const absentArchCenter = center => ['year', 'month'].flatMap(position =>
  [branch(position, center), branch(position, opposingArchCenter[center])]);
const lonelyPhoenixDays = ['甲寅', '辛亥', '丙午', '戊午', '壬子'];
const unequalMarriageDays = ['丙子', '丁丑', '戊寅', '辛卯', '壬辰', '癸巳',
  '丙午', '丁未', '戊申', '辛酉', '壬戌', '癸亥'];
const trueSchool = position => ({ kind: 'bazi_nayin_school', position, school: '真学堂' });
const killingAndDayMasterBalance = configuration('日主支援与七杀力量相近');
const haiFlyingHorse = {
  required: [count('官杀', 0)],
  anyOf: ['辛', '癸'].flatMap(day => branchSet('亥亥').map(seats => [stem('day', day), ...seats])),
  mustBeAbsent: absentBranches('巳寅'),
};

const dayPhase = (position, phase) => ({ kind: 'day_stem_phase', position, phase });
const natalSeason = season => ({ kind: 'bazi_day_master_season', season });
const restOrImprisoned = ['休', '囚'].map(season => [natalSeason(season)]);
const favorableStars = ['天乙贵人', '文昌贵人', '禄神', '天德', '月德'];
const twoFavorableSeats = pairs.flatMap(([first, second]) => favorableStars.flatMap(name =>
  favorableStars.filter(other => other !== name).map(other => [shen(first, name), shen(second, other)])));
const allNatalHarms = pairs.flatMap(([first, second]) =>
  ['六冲', '六害', '相破', ...punishmentTypes].map(kind => relation(kind, first, second)));
const fourStemGeneration = configuration('四柱明干顺位相生');
const indirectSealAcrossSamePillar = configuration('偏印所在柱干支本气相生');
const deathAndExtinction = ['死', '绝'];

const ratNobleForm = {
  required: [stem('day', '乙'), pillar('hour', '丙子'), count('财星', 0), count('官杀', 0)],
  anyOf: quantity('乙', 'visible', 1), mustBeAbsent: hourWithoutHarms,
};
const rootedVisibleWaterInYouMonth = {
  required: [branch('month', '酉'), balance('金', '旺')],
  anyOf: ['庚', '辛'].flatMap((day, dayPolarity) => ['壬', '癸'].flatMap((water, waterPolarity) =>
    visible.flatMap(position => positions.map(root => [
      stem('day', day), stem(position, water), {
        kind: 'hidden_ten_god', position: root, stem: water,
        tenGod: dayPolarity === waterPolarity ? '食神' : '伤官',
      },
    ])))),
  mustBeAbsent: absentVisibleGods('正官', '七杀'),
};
const unbrokenHorses = positions.map(position => ({
  required: [shen(position, '驿马')],
  anyOf: growthPhases.map(phase => [ownStemPhase(position, phase)]),
  mustBeAbsent: [voidAt(position), ...pairs.filter(pair => pair.includes(position))
    .flatMap(([first, second]) => ['六冲', '相破', ...punishmentTypes].map(kind => relation(kind, first, second)))],
}));
const earthlyBranches = '子丑寅卯辰巳午未申酉戌亥';
const wealthStemsByElement = ['戊己', '庚辛', '壬癸', '甲乙', '丙丁'];
const mutualLonerPairs = [['丑', '寅'], ['辰', '巳'], ['未', '申'], ['戌', '亥']];

const reviewedAdditional = new Map([
  ['yhzp-v2-c360-p002-001', ['3c466f1ab640704380bf4d98b23a430c197f6682f4e4e21e75e4e337045ced21',
    ['主人性格温和，有智慧，有禮貌', [{
      required: [configuration(fireTrineBranches)],
      anyOf: ['壬寅', '壬午', '壬戌', '癸巳', '癸未'].flatMap(day =>
        [strong, masterState('相对均衡')].map(strength => [pillar('day', day), strength])),
      mustBeAbsent: [...allClashesAndBreaks, ...pairs.flatMap(([first, second]) =>
        punishmentTypes.map(kind => relation(kind, first, second)))],
    }]],
  ]],
  ['yhzp-v3-c022-p006-001', ['f902f202dcdb069f696b3b0c54255b741be18771416caa03fc0521c5ccbd6e2c',
    ...[['陰差陽錯', unequalMarriageDays], ['孤鸞之日', lonelyPhoenixDays]].map(([text, days]) => [text, [{
      required: [voidAt('hour')],
      anyOf: days.flatMap(day => hourClashes.map(clash => [pillar('day', day), clash])),
    }], { fromContext: true }]),
  ]],
  ['yhzp-v3-c095-p002-101', ['ded22f67ee27641722543296f35ad295836c8623f27c0fd74218849aba5e87b2',
    ['富貴本源之不雜', ['正印', '偏印'].map(god => ({
      required: [strong, monthMainGod(god), qualifiedPattern(god + '格')],
      anyOf: visible.flatMap(position => withOwnPhase(position, god, ['临官', '帝旺'])),
      mustBeAbsent: allNatalHarms,
    }))],
  ]],
  ['yhzp-v3-c134-p001-001', ['85a5b4a0b48bb7acba97b9bc5a2a1107916eb7d4997b1baebf9d97030881163f',
    ['財命有氣，背祿', [[strong, vigor('财星'), structure('伤官见官')]]],
    ['財絶命衰，縱健祿', [{
      required: [weak, dayPhase('month', '临官')],
      anyOf: [...stemCycle].flatMap((day, index) => [...wealthStemsByElement[Math.floor(index / 2)]].flatMap(wealth =>
        [...earthlyBranches].filter(month => baziStemPhase(wealth, month) === '绝' && baziStemPhase(day, month) === '临官')
          .flatMap(month => stemOn(wealth).map(exposed => [stem('day', day), branch('month', month), ...exposed])))),
    }]],
  ]],
  ['yhzp-v3-c151-p003-001', ['a4008e1e39c3adef8267441480fddba88cdc76dc7feb434e15fdc48cdc3fc60a',
    ['金水聰明', [rootedVisibleWaterInYouMonth]],
  ]],
  ['yhzp-v4-c002-p005-001', ['81c6c5b152d9c284be94d731dd716551445128049145572bf9426285b9e1bcca',
    ['無財官而有格局', [ratNobleForm]],
  ]],
  ['yhzp-v4-c053-p005-001', ['d141bb765eb24c3992614c501e4ce68bfecb9d0251c4096c656f79f08ee5219f',
    ['馬道之通', unbrokenHorses],
  ]],
  ['yhzp-v4-c053-p009-001', ['3f7f2b07fe7a148900fa482c2719782016c9f95422fb2cd6a138c16718ccced9',
    ['生時旺氣朝元', [...stemCycle].map(stemName => ({
      required: [stem('hour', stemName)],
      anyOf: [...earthlyBranches].filter(value => baziStemPhase(stemName, value) === '临官')
        .flatMap(value => growthPhases.map(phase => [branch('year', value), ownStemPhase('hour', phase)])),
    }))],
  ]],
  ['yhzp-v4-c081-p029-001', ['c3983b5c813ec4349342c5eabddc3a19358b6b6bd155f36c7086a0d9bca44cb1',
    ['八字連珠，支神有用', [[...positions.map((position, index) => branch(position, '寅辰午申'[index])),
      stem('day', '丙'), monthMainGod('食神'), mainGod('hour', '偏财')]]],
  ]],
  ['yhzp-v5-c466-p012-001', ['7b14bb2638c636bae25d11d41b3b9c7d3a9c4df834117e476924c2c115216484',
    ['孤宿猶嫌於隔角', mutualLonerPairs.flatMap(([grave, corner]) => [
      ['孤辰', grave, corner], ['寡宿', corner, grave],
    ]).map(([name, year, seat]) => ({
      required: [branch('year', year)],
      anyOf: positions.slice(1).map(position => [branch(position, seat), shen(position, name)]),
    }))],
  ]],
  ['yhzp-v3-c020-p002-001', ['e1785e2f96f1d705067eb46d9b4649e2bf96f1e77f56906a771961a40dc00ef4',
    ['官殺得地，而有扶助', [{
      required: [man, masterState('相对均衡'), vigor('官杀')],
      anyOf: ['财官相生', '官印相生', '杀印相生'].flatMap(name =>
        twoFavorableSeats.map(facts => [structure(name), ...facts])),
    }]],
  ]],
  ['yhzp-v3-c022-p002-004', ['8d0afb69767e8c0896d64c2006ce06031e9d31257744db2bbf086cecfc7f5d8d',
    ['官得地，七殺受傷，食神干旺', [{
      required: [woman, vigor('官星'), vigor('食神'), foodControlsKilling,
        configuration(baziClassicalStructureNames.virtuesAndSeal)],
      anyOf: godOn('食神'),
    }]],
  ]],
  ['yhzp-v3-c022-p004-002', ['3fd852ac3f71a7495c37d8d81458606bc140db217eb4e7ddaa210613b47d96d7',
    ['日時空亡', [{
      required: [woman, voidAt('day'), voidAt('hour')],
      anyOf: positions.flatMap(officeSeat => deathAndExtinction.flatMap(phase =>
        distinctPresence('孤辰', '寡宿').flatMap(stars => [...godOn('伤官'), [monthMainGod('伤官')]]
          .map(output => [
            { kind: 'bazi_hidden_god_phase', position: officeSeat, tenGod: '正官', phase, anchor: 'month' },
            ...stars, ...output,
          ])))),
    }]],
  ]],
  ['yhzp-v3-c022-p005-001', ['a8093af052a72c180bbe4a61681f751cc831a4fbf01b3af9c268bf96311c5eb0',
    ['女命只要身弱', [{
      required: [woman, weak, count('七杀', 0), configuration('四柱无驿马')],
      anyOf: positions.map(position => [shen(position, '天乙贵人')]),
      mustBeAbsent: [...allNatalHarms, ...positions.map(position => shen(position, '桃花'))],
    }]],
    ['身强', [{ required: [woman, strong], anyOf: [[vigor('比劫')], [vigor('印星')]] }]],
  ]],
  ['yhzp-v3-c031-p002-001', ['55d9bda1b4209f82c199bb241d97743ca04c5c4541f05804487d91565c001496',
    ['坐祿乘輿', [[woman, dayPhase('day', '临官'), configuration('年干禄前二辰见金舆')]]],
    ['冲身動步', [{
      required: [woman],
      anyOf: dayClashes.flatMap(fact => [fact.first, fact.second].map(position => [fact, shen(position, '驿马')])),
    }]],
  ]],
  ['yhzp-v3-c065-p003-001', ['8b7fd043f9dcb11e5eb6072508ea907994477a2be3a2154d41be1027ce03123c',
    ['偏宜甲向', [{
      required: [{ kind: 'bazi_day_stem_transformation', stem: '乙', partner: '庚', element: '金' }],
      anyOf: stemOn('甲'),
    }]],
  ]],
  ['yhzp-v3-c135-p002-006', ['3fd919b02fcc3cb931da9fd05dd304b298ce03a2af2237ff7fa911529ff6f6ef',
    ['金神貴格，火地奇哉', ['癸酉', '己巳', '乙丑'].map(hour => ({
      required: [stem('day', '甲'), pillar('hour', hour), balance('火', '旺')],
      anyOf: [...'巳午未'].map(month => [branch('month', month)]),
    }))],
  ]],
  ['yhzp-v4-c053-p004-001', ['5a8b373711b7be8717017946809df256d4b0d23f8122bcf898e2c4b24678d325',
    ['五行相生', [[fourStemGeneration]]],
  ]],
  ['yhzp-v4-c175-p004-101', ['7c481f0a9b7b8eda322b6d64eb7d76e0e2e8e3410e02a6d5f9d419cbc3e0d28a',
    ['水木相生', [{
      required: [branch('month', '亥'), structure('财官相生'), structure('官印相生')],
      anyOf: [...'壬癸'].flatMap(water => [...'甲乙'].flatMap(wood =>
        visible.flatMap(position => visible.filter(other => other !== position)
          .map(other => [stem(position, water), stem(other, wood)])))),
    }]],
  ]],
  ['yhzp-v5-c012-p011-001', ['0c0594c4cae20e170acb5637dcb01c25efdb2325b9adb27105be7a5db6eba53c',
    ['上下相生', [[indirectSealAcrossSamePillar]]],
    ['四庫坐財', [{
      required: [indirectSealAcrossSamePillar],
      anyOf: positions.flatMap(position => [...'辰戌丑未'].flatMap(value => wealth.flatMap(god =>
        [[branch(position, value), stemGod(position, god)], [branch(position, value), mainGod(position, god)]]))),
    }]],
  ]],
  ['yhzp-v5-c383-p003-001', ['baa801735f616d2a09dffd7734c30e2f4887c221d65a353a71e1dd4399448cf9',
    ['生時見刑冲', [{
      required: [man],
      anyOf: pairs.filter(pair => pair.includes('hour')).flatMap(([first, second]) =>
        ['六冲', ...punishmentTypes].flatMap(kind => restOrImprisoned
          .flatMap(season => ['正官', '七杀'].flatMap(god => [
            [relation(kind, first, second), ...season, stemGod('hour', god)],
            [relation(kind, first, second), ...season, mainGod('hour', god)],
          ])))),
    }]],
  ]],
  ['yhzp-v5-c434-p004-001', ['53ffb4f3e99ee4244e06a27614c12d8c6758e5dc7c7666847a953509698b32e7',
    ['沐浴凶神', positions.map(position => ({
      required: [nayinStage(position, '沐浴'), shen(position, '桃花')],
      anyOf: [[man], [woman]],
    }))],
  ]],
  ['yhzp-v5-c466-p016-001', ['6c88e4d6c9f6b8b8e1cbe55b8002f2ec55b955d77194995447a20c0987b671dc',
    ['馬劣財微', positions.map(position => ({
      required: [shen(position, '驿马'), count('财星', 1)],
      anyOf: deathAndExtinction.flatMap(phase => [...stemCycle].map((day, index) => [
        dayPhase(position, phase), stem('day', day), balance('土金水木火'[Math.floor(index / 2)], '少量'),
      ])),
    }))],
  ]],
  ['yhzp-v2-c246-p002-001', ['211027f740ac983f5acc832a5b7ba907e85f1d49eaf6806299220356b7a72c7f',
    ['主人財厚食豐', visible.map(position => ({
      required: [strong, vigor('食神'), structure('食伤生财'), count('正官', 0), count('印星', 0)],
      anyOf: wealth.flatMap(god => visible.filter(other => other !== position)
        .map(other => [stemGod(position, god), stemGod(other, '食神')])),
      mustBeAbsent: [...absentVisibleGods('七杀'), ...visible.filter(other => other !== position)
        .flatMap(other => wealth.map(god => stemGod(other, god)))],
    }))],
  ]],
  ['yhzp-v2-c339-p002-001', ['458218fe900f33af1bf04b3c76992dcb5f6f948d0c0520fdc63a448c7d991358',
    ['忌填實', archLuPairs.map(([day, hour, center]) => ({
      required: archPillars(day, hour), anyOf: ['year', 'month'].map(position => [branch(position, center)]),
    }))],
    ['冲了日時拱位', archLuPairs.map(([day, hour, center]) => ({
      required: archPillars(day, hour),
      anyOf: [...archClashes.map(fact => [fact]),
        ...['year', 'month'].map(position => [branch(position, opposingArchCenter[center])])],
    }))],
  ]],
  ['yhzp-v3-c016-p002-006', ['e0f2777465ed156ee2c6e1fa307a3103745bcf3cfc23a5479a6042b7824a3a1c',
    ['孤鸞之日', [{ required: [man], anyOf: lonelyPhoenixDays.map(day => [pillar('day', day)]) }]],
    ['陽錯陰錯', [{ required: [man], anyOf: unequalMarriageDays.map(day => [pillar('day', day)]) }]],
  ]],
  ['yhzp-v3-c123-p002-601', ['0eb4c4980d50fccc22865e8d2e131dee67fee917e6129239264e8ba01f3b7cac',
    ['兩戊合一', [[woman, stem('day', '癸'), stem('month', '戊'), stem('hour', '戊'),
      ...quantity('戊', 'visible', 2, 2)[0], union('month', 'day'), union('day', 'hour')]]],
  ]],
  ['yhzp-v3-c135-p002-103', ['2ed5104c67c7aa41714365cfada5e92dcbec0802fc1828ecb8eff80a121e2a07',
    ['井欄', [{
      required: [stem('day', '庚'), configuration(waterTrineBranches), count('官杀', 0)],
      mustBeAbsent: [element('火')],
    }]],
    ['飛天', [haiFlyingHorse]],
    ['趨艮', [{
      required: [stem('day', '壬'), pillar('hour', '壬寅'), strong],
      mustBeAbsent: genPatternExclusions,
    }]],
  ]],
  ['yhzp-v3-c151-p003-101', ['e5f80585b658815e109505f555cec84df57e0e74e8215648b8102b9d9f942813',
    ['權刃雙題停均', [{
      required: [killingAndDayMasterBalance], anyOf: blade.flatMap(facts => godOn('七杀').map(killing => [...facts, ...killing])),
    }]],
  ]],
  ['yhzp-v4-c040-p003-002', ['8d8faf5765a9cf00e1c908f156b29917ba8f1c2aa219211dbf340b5f3e1df8c5',
    ['三奇忽遇', ['甲戊庚', '乙丙丁', '壬癸辛'].flatMap(sequence =>
      [positions.slice(0, 3), positions.slice(1)].map(seats => seats.map((position, index) => stem(position, sequence[index]))))],
  ]],
  ['yhzp-v4-c047-p004-001', ['cc80e0c2824153bbf95422c600bf617a24ed352cd8f0c19ce6a9080c0ba30808',
    ['坐學堂', ['month', 'day', 'hour'].map(position => [trueSchool(position)])],
  ]],
  ['yhzp-v4-c047-p005-001', ['864174626e207cc5c09bf61d0c894eaa0c274f34c0327faeb97f362b39480024',
    ['孤鸞入命', ['甲寅', '辛亥'].map(day => [pillar('day', day)])],
  ]],
  ['yhzp-v4-c047-p006-001', ['b9b5dbcd9ab64cfab30a8e0d84063d4bafbcc4b63fa79d1dfd2323bf6feadc0f',
    ['妻宫有尅', [['午', '子'], ['巳', '亥'], ['卯', '酉'], ['寅', '申']].map(([day, other]) => ({
      required: [man, branch('day', day)],
      anyOf: dayClashes.map(fact => [fact, branch(fact.first === 'day' ? fact.second : fact.first, other)]),
    }))],
  ]],
  ['yhzp-v4-c053-p002-001', ['bb3669ea7cc9012a464f311c6b79ab475536702496db452693329b29c46e4067',
    ['貴馬會於學堂', ['month', 'day', 'hour'].map(position => [
      trueSchool(position), shen(position, '天乙贵人'), shen(position, '驿马'),
    ])],
  ]],
  ['yhzp-v4-c053-p008-001', ['b9ae9315f5edad225eea6058ad0e192590d91ff6bef1cbd9a667f87b6b595a63',
    ['𡈼子丙午', [archPillars('壬子', '丙午')]],
  ]],
  ['yhzp-v4-c077-p003-001', ['40f0d06689e4cc8fba2b8b595e6e1c7427500ddbb1aa1d07cc23e4b7f2e3aca6',
    ['金白水凊', [rootedVisibleWaterInYouMonth]],
  ]],
  ['yhzp-v5-c250-p014-001', ['136d086e21c779c4721e69768d15e188551ca99d1d495e0f0b0f71cccbbba254',
    ...['㸔來辛丑逢辛卯', '乙未乙酉'].map((text, index) => {
      const [day, hour, center] = archNoblePairs[index];
      return [text, [{
        required: archPillars(day, hour), mustBeAbsent: [...absentArchCenter(center), ...archHarms],
      }]];
    }),
  ]],
  ['yhzp-v5-c466-p008-001', ['ee50f149cebfdcfcfcd67546b002bf9d3d244ba61a82a7622ef0b593638e39ac',
    ['夾祿之鄉', archLuPairs.slice(-2).map(([day, hour, center]) => ({
      required: archPillars(day, hour),
      anyOf: autumnWinterMonths, mustBeAbsent: [...absentArchCenter(center), ...archHarms],
    }))],
  ]],
  ['yhzp-v3-c013-p002-001', ['ce5b031bdc30cc9defb5c136696daa32d13c2676c77f7dd137dc2d5bcc6db720',
    ['再見甲寅字', [{ required: [stem('day', '甲')], anyOf: visible.map(position => [pillar(position, '甲寅')]) }]],
    ['木局全', [[stem('day', '甲'), configuration(woodTrineBranches)]]],
  ]],
  ['yhzp-v3-c013-p002-002', ['4232691e7a3060ff8c3e8fb742ffa31baea68e717bd65c95a54e997bc9f9c0b9',
    ['戊臨生旺', [{
      required: [stem('day', '甲')],
      anyOf: visible.flatMap(position => growthPhases.flatMap(phase => visible.filter(other => other !== position)
        .flatMap(other => ['丙', '丁'].map(fire => [stem(position, '戊'), ownStemPhase(position, phase), stem(other, fire)])))),
    }]],
  ]],
  ['yhzp-v3-c020-p002-002', ['b82b08f9b2e78d07f3803a43bfe2c9e5070aadd45b4284f3ce1f12ed02fc0450',
    ['太過', [[man, { ...vigor('官杀'), strength: '过盛' }]]],
  ]],
  ['yhzp-v3-c063-p002-101', ['c3089bb0578a1bdd38b380823410c10a1f0ea34701f183ea22824cc067373cbd',
    ['化之假者', [['甲', '己'], ['己', '甲']].map(([day, partner]) => ({
      required: [stem('day', day)],
      anyOf: [[stem('month', partner), union('month', 'day')], [stem('hour', partner), union('day', 'hour')]],
      mustBeAbsent: [{ kind: 'bazi_stem_transformation', pair: '甲己', element: '土' }],
    }))],
  ]],
  ['yhzp-v3-c083-p002-001', ['235e3ee5143a97c42964606f47c27e01f489667b8cb856ad7bb2531bf2b8d059',
    ...[['水盛', '水'], ['土多', '土'], ['火多', '火']]
      .map(([text, name]) => [text, [[balance(name, '过盛')]]]),
  ]],
  ['yhzp-v3-c105-p002-001', ['aa9f1fd496801c8979bde10896562f5e97bde928a4d04c3cd7e7e1968f9dabab',
    ['身旺財官損', pairs.map(([first, second]) => ({
      required: [strong, configuration(clashedOrBrokenWealth)],
      anyOf: [first, second].flatMap(position => ['六冲', '相破'].flatMap(kind => [
        [relation(kind, first, second), stemGod(position, '正官')],
        [relation(kind, first, second), mainGod(position, '正官')],
      ])),
    }))],
  ]],
  ['yhzp-v4-c210-p017-101', ['8accbaddbfa98d58a1eb82099e49f35996398a40f95ca3e4c1d0191dc29e1e37',
    ['山頭合虎', [[branch('month', '戌'), configuration(fireTrineBranches)]]],
  ]],
  ['yhzp-v5-c165-p009-001', ['e00a255c20013c1fefbcce163af48fb3ee3f0dc44dac57e3059170ec11b186c9',
    ['無官冲絆', [haiFlyingHorse]],
  ]],
  ['yhzp-v5-c165-p012-001', ['7e02ef0ea5b2666544bd6aace642b422dc01ea94d3c3b9c24504b16809df64e2',
    ['傷官此格宜傷盡', [{
      required: [stem('day', '丁'), configuration(doubleSiBranches), count('官杀', 0)],
      mustBeAbsent: [element('水')],
    }]],
  ]],
  ['yhzp-v5-c214-p003-001', ['ba62de0a29ca70cf748489384d1251d42cb3eab0916e00bfee7e451cec27b6ab',
    ['丑日多見方爲妙', [['辛丑', '丙丁'], ['癸丑', '戊己']].map(([day, officers]) => ({
      required: [pillar('day', day)],
      anyOf: visible.flatMap(position => ['申', '酉'].flatMap(value => visible.filter(other => other !== position)
        .map(other => [branch(position, '丑'), branch(other, value)]))),
      mustBeAbsent: [...absentBranches('巳午'), ...[...officers].flatMap(value => stemOn(value).flat())],
    }))],
  ]],
  ['yhzp-v5-c290-p003-001', ['f1469ea6da53140e3f9f280dae45e2116739c444f0c52ffa4aa690fb65b1e36c',
    ...[['財星得遇', wealth], ['官殺如臨', ['正官', '七杀']]].map(([text, gods]) => [text, [{
      required: [configuration(earthVaults)], anyOf: ['戊', '己'].flatMap(day =>
        gods.flatMap(god => godOn(god).map(presence => [stem('day', day), ...presence]))),
    }]]),
  ]],
  ['yhzp-v5-c333-p010-001', ['48d4c918909c0f3805d7c864410bb4b6c3262929318ea12a8f1b16faf9cb636b',
    ['丙申四柱命中全', [positions.map(position => pillar(position, '丙申'))]],
  ]],
  ['yhzp-v5-c370-p003-001', ['b9f2867d6afe5c9d328c6eac180c7593e7223ead00131327d4c810e6b0a2e39c',
    ['四柱官星如得地', [{
      required: [...positions.map(position => stem(position, '乙')), branch('month', '酉')],
      anyOf: ['year', 'day'].map(position => [
        { kind: 'bazi_hidden_god_phase', position, tenGod: '正官', phase: '长生', anchor: 'host' },
      ]),
    }]],
  ]],
  ['yhzp-v5-c447-p002-001', ['8cbb3e318d76ebdd150e4a98f4f2089175ffb4d7eb2dffb7e727144b485086e0',
    ['祿貴同宫', positions.map(position => ({
      required: [shen(position, '禄神'), shen(position, '天乙贵人')],
      anyOf: ['临官', '帝旺'].map(phase => [{ kind: 'day_stem_phase', position, phase }]),
    }))],
  ]],
  ['yhzp-v1-c153-p002-001', ['b25672f19cd4b3040de179689970b8f19e9697d4a9bf69c7b5e2004d7418ca27',
    ['命中如遇此', heavenlyNobleDayBranches.map(([day, branches]) => ({
      required: [stem('day', day)], anyOf: [...branches].flatMap(value => positions.map(position => [branch(position, value)])),
    }))],
  ]],
  ['yhzp-v1-c189-p004-001', ['72cc1566de4a04128f1f6171a865bde4aa31016848467d369129e023916ed83e',
    ['若遇食神騎禄馬', visible.map(position => ({
      required: [vigor('食神'), stemGod(position, '食神')],
      anyOf: ['禄神', '驿马'].map(name => [shen(position, name)]),
      mustBeAbsent: [voidAt(position), shen(position, '阳刃')],
    }))],
  ]],
  ['yhzp-v1-c300-p002-001', ['b382d8a0c50ccdf8bf98b458c0f6951954b2e4c974c565a4af157386b94de144',
    ['須年月時中有木', [{
      required: [vigor('官杀')],
      anyOf: ['丙', '丁'].flatMap(day => visible.flatMap(position =>
        ['甲', '乙'].flatMap(wood => stemOn(wood).map(facts => [stem('day', day), branch(position, '辰'), ...facts])))),
    }]],
  ]],
  ['yhzp-v1-c313-p013-001', ['f348a02b9d29c6f7d5e1bf80b1debce9db5b02a99d6700818bcb71d0cbcb21c4',
    ['官用財', [{
      required: [monthMainGod('正官'), structure('财官相生')], anyOf: wealth.flatMap(godOn),
    }]],
  ]],
  ['yhzp-v1-c351-p018-001', ['ced25fda06d4be53f28a19054ae26eb7bcb79c509076e0a2ba343cf98963f03a',
    ['辛癸日多逢丑地', [{
      required: [branch('day', '丑')],
      anyOf: ['辛', '癸'].flatMap(day => ['year', 'hour'].flatMap(position =>
        ['子', '巳'].flatMap(extra => visible.filter(other => other !== position)
          .map(other => [stem('day', day), branch(other, '丑'), branch(position, extra)])))),
    }]],
  ]],
  ['yhzp-v1-c351-p030-001', ['1ef8fda4fcd2e777c16952ccd23f4c248b1aa837fec5915bbdac6b01ba5ef511',
    ['無殺女人之命一貴', positions.map(position => ({
      required: [woman, count('七杀', 0), shen(position, '天乙贵人')],
      mustBeAbsent: positions.filter(other => other !== position).map(other => shen(other, '天乙贵人')),
    }))],
  ]],
  ['yhzp-v2-c002-p125-001', ['a6c9fc9b88eb5d4e3bea1d238fdebfec7b615727b5daa3b804359e648aae10c1',
    ['丁遇壬而太過', [{
      required: [stem('day', '丁'), balance('水', '过盛')],
      anyOf: [[stem('month', '壬'), union('month', 'day')], [stem('hour', '壬'), union('day', 'hour')]],
    }]],
  ]],
  ['yhzp-v2-c002-p142-101', ['f959b41206e10a870c3cfa424ddaa762a8720e8d237d947e136bced9b8d82140',
    ['一木叠逢離火位', [{
      required: [weak, balance('火', '过盛'), count('比劫', 0)],
      anyOf: ['甲', '乙'].flatMap(day => pairs.flatMap(([a, b]) => [...'巳午'].flatMap(first =>
        [...'巳午'].map(second => [stem('day', day), branch(a, first), branch(b, second)])))),
    }]],
  ]],
  ['yhzp-v2-c236-p002-001', ['3ce04333ef1f15944a97ace7054a01b72f53ff8e3a2c23a9dd25dda83e828fe9',
    ['財要得時', [[monthMainGod('正财'), vigor('正财')]]],
    ['可以勝任', [{
      required: [strong, vigor('正财'), structure('财官相生')],
      anyOf: countOptions('财星', [3, 4]).flatMap(amount => godOn('正财').map(facts => [...amount, ...facts])),
    }]],
    ['天元一氣羸弱', [{
      required: [weak, vigor('正财')],
      anyOf: countOptions('财星', [3, 4]).flatMap(amount => godOn('正财').map(facts => [...amount, ...facts])),
    }]],
  ]],
  ['yhzp-v2-c236-p003-001', ['66884f45ff9185368d848bd55d86dd087e850ddb1dfa987b6b089af01a78d985',
    ['喜身旺印綬', [{
      required: [strong, vigor('正财'), structure('印绶护身'), count('官杀', 0)],
      anyOf: godOn('正财'),
    }]],
  ]],
  ['yhzp-v2-c244-p002-001', ['f31093f2b345fefffc32a007d4f02b5b27dc68590f9ce59e6ee6ddffb5e12df1',
    ['偏財主人慨康', [{
      required: [qualifiedPattern('偏财格'), vigor('偏财')], anyOf: godOn('偏财'),
    }]],
  ]],
  ['yhzp-v2-c271-p002-001', ['7379ab0eba2339bf3a8aab212b936695a0c1616382c748c1e5798fac1ba3d027',
    ['主人純粹，有仁德', daylightNobleDays.map(([day, sect]) => ({
      required: [pillar('day', day), { kind: 'natal_daylight', sect }, shen('day', '天乙贵人')],
      mustBeAbsent: [...dayWithoutHarms, ...nonDayKuiGang],
    }))],
  ]],
  ['yhzp-v2-c277-p002-001', ['632ec1cca22e3382d9df006c2cd6e6ced9e835ad86e7c65c331d5e3ef2cd62ae',
    ['主人性格聰明，文章輟發', [{
      required: [strong],
      anyOf: kuiGangDays.flatMap(day => visible.flatMap(position => kuiGangDays.map(other =>
        [pillar('day', day), pillar(position, other)]))),
      mustBeAbsent: absentVisibleGods(...wealth, '正官', '七杀'),
    }]],
  ]],
  ['yhzp-v2-c281-p002-001', ['888aaad66c20621cea487e22ebd7aeb998ad7fd3f2b9e1094a90a4c63105bf7b',
    ['要刑冲破害，以開局鑰', hourClashes.map(clash => ({
      required: [clash], anyOf: [...wealth, '正官', '七杀'].map(tenGod =>
        [{ kind: 'bazi_hidden_god_phase', position: 'hour', tenGod, phase: '墓', anchor: 'host' }]),
    }))],
  ]],
  ['yhzp-v2-c304-p002-001', ['ccd30a697b72e16ddff17850b3fd797e5ef9b01837fe6e48e6fae6a8cd20d097',
    ['若四柱中有丁字并午字', [{
      required: [configuration(doubleZiBranches)],
      anyOf: ['庚', '壬'].flatMap(day => stemOn('丁').flatMap(facts =>
        positions.map(position => [stem('day', day), branch(position, '午'), ...facts]))),
    }]],
  ]],
  ['yhzp-v2-c310-p002-001', ['de44a9d9d21b83386f632e2c5a178297e30f197ab95f223a1cdc85404614fd5d',
    ['若四柱中有辰字，則已不能冲矣', [{
      required: [stem('day', '丁'), configuration(doubleSiBranches)],
      anyOf: positions.map(position => [branch(position, '辰')]),
    }]],
    ['有壬字并亥字', [{
      required: [stem('day', '丁'), configuration(doubleSiBranches)],
      anyOf: stemOn('壬').flatMap(facts => positions.map(position => [...facts, branch(position, '亥')])),
    }]],
  ]],
  ['yhzp-v2-c313-p002-101', ['5b03341380d6b379b99029da3a127b162718a245eeb82b1bbdc7edfeadb3163f',
    ['乙二字，及無財官', [ratNobleForm]],
  ]],
  ['yhzp-v3-c002-p002-001', ['2bd90120a4ae91a58adebe323249284e013fd08c7e25679cef70084c25803b19',
    ['印殺見財', [[structure('杀印相生'), structure('财星破印')]]],
  ]],
  ['yhzp-v3-c039-p002-001', ['246db9460fb609cb24e5c46c92c208a4d523d1aab27e002103f6bc30fc1eb54f',
    ['二德坐正財', positions.map(position => ({
      required: [woman, shen(position, '天德'), shen(position, '月德')],
      anyOf: [[stemGod(position, '正财')], [mainGod(position, '正财')]],
    }))],
  ]],
  ['yhzp-v3-c063-p002-001', ['49693acd3bb99f176b8033a306ef38d1fbaecf10803ab49aedbbe69a5053a355',
    ['真者', [['甲','己'], ['己','甲']].map(([stem, partner]) => [
      { kind: 'bazi_day_stem_transformation', stem, partner, element: '土' },
    ])],
  ]],
  ['yhzp-v3-c087-p002-101', ['bff68752c7a82f81ed8d72cc08c87bd69e965fced2c6eb3940d40878a2d6cb5e',
    ['傷官見官', [{
      required: [structure('伤官见官'), vigor('伤官')],
      anyOf: permutationsOfVisibleGods(['伤官', '正官']),
    }]],
  ]],
  ['yhzp-v3-c087-p006-001', ['453f06b3c4383b18a6e3daa36e1ec7411e3f579a1f3a8cfb386a46afe1cacb06',
    ['刑多者', [[configuration(multiplePunishments)]]],
    ['合多者', separateHarmonies],
  ]],
  ['yhzp-v3-c087-p006-101', ['fe7693dc9348c6960a4542ec7c17802ba24a86b01180d280465429292b940ec1',
    ['水潤下', [{
      required: [balance('水', '旺')], anyOf: ['壬', '癸'].flatMap(day => [waterTrineBranches, waterSeasonBranches]
        .map(name => [stem('day', day), configuration(name)])),
      mustBeAbsent: [...stemOn('戊').flat(), ...stemOn('己').flat()],
    }]],
    ['稼穡兮', [{ required: [configuration(earthVaults), strong], anyOf: ['戊','己'].map(day => [stem('day', day)]) }]],
  ]],
  ['yhzp-v3-c123-p002-001', ['78ec465b35d0d16e44bd361422ff247ae07bb8658d9cc4a72ad37a06058760fa',
    ['傷官若論財，帶合', [{
      required: [structure('伤官生财'), qualifiedPattern('伤官格')], anyOf: natalHarmonyPairs.map(fact => [fact]),
    }]],
  ]],
  ['yhzp-v3-c151-p004-002', ['d28446fd4ff813df2ad6d96cc944868c68f0f815a321e1f655e6a88a4610665c',
    ['男多羊刀', [[man, configuration(repeatedNatalBlade)]]],
    ['女犯傷官', [{ required: [woman, vigor('伤官')], anyOf: [[monthMainGod('伤官')], ...godOn('伤官')] }]],
  ]],
  ['yhzp-v4-c002-p006-001', ['9f45f1b2990505289c1cfbf19b73b8fb86d140aa1450029a2d2f600cbc90f6c2',
    ['財官居純粹之位', [{
      required: [structure('财官相生'), count('七杀', 0), count('伤官', 0), count('劫财', 0)],
      anyOf: wealth.flatMap(god => permutationsOfVisibleGods([god, '正官'])),
    }]],
  ]],
  ['yhzp-v4-c002-p007-001', ['8d7f27d57af05797dd96617fb0b1f633fd664b8e5d1a88f43cae79227f799b47',
    ['財星有破', [{
      required: [configuration(clashedOrBrokenWealth)],
      anyOf: pairs.flatMap(([first, second]) => ['六冲', '相破'].flatMap(kind => [first, second].flatMap(position =>
        wealth.flatMap(god => [[relation(kind, first, second), mainGod(position, god)],
          [relation(kind, first, second), stemGod(position, god)]])))),
    }]],
    ['印綬被傷', [[structure('财星破印')]]],
  ]],
  ['yhzp-v4-c053-p006-001', ['6e58aaa7fcd5970532845af3fa9a41943d0f862a90e4aa5e0e225c907d683f28',
    ['遇華蓋孤虚之位', positions.map(position => ({
      required: [shen(position, '华盖')],
      anyOf: ['孤辰', '寡宿', '空亡'].map(name => [shen(position, name)]),
    }))],
  ]],
  ['yhzp-v4-c155-p002-001', ['e43249db29a406346cd2728356523aa4e0a47c6b03ebe8fabe504441cd4c7059',
    ['木庫火鄉', [{
      required: [branch('month', '未'), pillar('day', '丁未')],
      anyOf: branchSet('巳午未').flatMap(branches => ['正官', '七杀'].flatMap(god => godOn(god)
        .map(facts => [...branches, ...facts]))),
    }]],
  ]],
  ['yhzp-v5-c196-p010-001', ['3fc8b124959fe29735441c94524c428a4debc7beaf06de443ad37635dde5c6d6',
    ['食神生旺無刑尅', cleanFoodPillars],
    ['官印更來相協助', cleanFoodPillars.map(group => ({
      ...group, required: [...group.required, structure('官印相生'), structure('印绶护身')],
    }))],
  ]],
  ['yhzp-v5-c349-p007-001', ['f36a54335f9ead16ccf03fce3d8b9e542718dea8a8042bc13355e1586e56374b',
    ['戊癸南方火熖高，勝光時上', [{
      required: [{ kind: 'bazi_day_stem_transformation', stem: '癸', partner: '戊', element: '火' },
        pillar('hour', '戊午'), balance('火', '旺')],
      mustBeAbsent: ['year', 'month'].flatMap(position => ['甲', '乙'].map(god => stem(position, god))),
    }]],
  ]],
  ['yhzp-v5-c383-p005-001', ['5d307c8804faa01b5eb194028b37cb5cb7b1302631a42d0cfcd83ded8631d7c1',
    ['干土食神支又合', [{
      required: [man, stemGod('hour', '七杀'), foodControlsKilling],
      anyOf: godOn('食神').flatMap(facts => pairs.map(([first, second]) => [...facts, relation('六合', first, second)])),
    }]],
  ]],
  ['yhzp-v5-c431-p002-001', ['00ab61d286321ab96e11bb1fea898cc90c385166c04d893f5d8258272c96456a',
    ['時曰重臨', [{
      required: [nayinStage('day', '长生'), nayinStage('hour', '长生')],
      anyOf: ['天乙贵人', '禄神', '文昌贵人'].map(name => [shen('hour', name)]),
    }]],
  ]],
  ['yhzp-v5-c443-p002-001', ['79852c6636f8d98a9ac665289ab13bfe3ce24ca5a1ced9163b66b6a7f72ecf3e',
    ['更得貴人加本位', positions.map(position => [nayinStage(position, '冠带'), shen(position, '天乙贵人')])],
  ]],
  ['yhzp-v5-c455-p003-001', ['0ee12e8ab018debfe8281c4f5ecbdae4b7fcde2806f8936093e25a8efd9ce97a',
    ['人命若還逢墓庫', positions.map(position => [nayinStage(position, '墓')])],
  ]],
  ['yhzp-v3-c146-p001-601', ['ab58632822dce31e4a5055600d41c9ad523933f09467c9cff3baaed8ff5fc6b8',
    ['偏財空而印旺', [{
      required: [vigor('印星')],
      anyOf: [exposedIndirectWealthOnVoid, hiddenIndirectWealthOnVoid].map(name => [configuration(name)]),
    }]],
  ]],
  ['yhzp-v1-c155-p001-001', ['028fe8c3407c0df24823f30119b34b202e7ba13f9659cafa258e2ba7d6192cf8',
    ['六癸之人逢見午', [{ required: [stem('day', '癸')], anyOf: positions.map(position => [branch(position, '午')]) }]],
  ]],
  ['yhzp-v1-c333-p014-001', ['12776bebd3bef7581d9e8c08045e3f68a25a694b93dfc3ecebde339a7e05a23e',
    ['火命生酉戌亥子月', fireNayinNames.map(name => ({
      required: [{ kind: 'pillar_nayin', position: 'year', name }],
      anyOf: [...'酉戌亥子'].map(value => [branch('month', value)]),
    }))],
  ]],
  ['yhzp-v1-c351-p022-001', ['541eaca7dca616a86d4751b84715df218ac5b4c56672658f237cda8b72fd272f',
    ['略有一位正官官殺混雜', [{
      required: [monthMainGod('七杀'), count('正官', 1), structure('官杀混杂')], anyOf: godOn('正官'),
    }]],
  ]],
  ['yhzp-v2-c261-p002-001', ['a0bb5b87e0fd9eef25fc23377077e1bf83f342032ba4846eefea9247c7cf3652',
    ['五陽見五陰爲敗財', [{ required: [man], anyOf: [...'甲丙戊庚壬']
      .flatMap(day => godOn('劫财').map(facts => [stem('day', day), ...facts])) }]],
    ['五陰見五陽爲刼財', [{ required: [man], anyOf: [...'乙丁己辛癸']
      .flatMap(day => godOn('劫财').map(facts => [stem('day', day), ...facts])) }]],
  ]],
  ['yhzp-v2-c358-p002-101', ['3d14c090d6c126d60973866ac004e4af29b60c0a9b02d8602bfbce0460bb25c2',
    ['忌刑冲殺旺', [{
      required: [vigor('七杀')],
      anyOf: ['戊寅', '戊子', '戊申', '己卯', '己亥', '己未'].flatMap(day =>
        [waterTrineBranches, woodTrineBranches].flatMap(name => dayPairs.flatMap(([first, second]) =>
          ['六冲', ...punishmentTypes].map(kind => [pillar('day', day), configuration(name), relation(kind, first, second)])))),
    }]],
  ]],
  ['yhzp-v2-c399-p002-001', ['21af56970f0f56939f241aeeca2f75802e2f5a803adf07d12015e9b5b3dc1223',
    ['兩干連珠格', [[configuration(alternatingStemNames)]]],
  ]],
  ['yhzp-v3-c015-p001-101', ['4e0eb981e01f966053dba27a3ddc7a8e324c29872cd76ee4a99a8b828bfbdfd3',
    ['甲日以癸爲母，遇己丑未', [{
      required: [stem('day', '甲'), structure('财星破印')],
      anyOf: ['丑', '未'].flatMap(value => positions.flatMap(position => stemOn('己')
        .flatMap(first => stemOn('癸').map(second => [branch(position, value), ...first, ...second])))),
    }]],
  ]],
  ['yhzp-v3-c045-p002-004', ['72d6e0074d54739638e7506164129c05a74986fbbce11fb7c68d009f87914b59',
    ['主智是非之心', [[temperament('水', '旺相')]]],
  ]],
  ['yhzp-v3-c045-p002-005', ['800999e3b7d29620414b43f53a2ed35fa32924fc357f660628a34b4d493cbea1',
    ['處事不輕，度量寬厚', [[temperament('土', '旺相')]]],
    ['太過', [[temperament('土', '太过')]]],
  ]],
  ['yhzp-v3-c087-p005-002', ['56b1dc12f8ef1047c164fa40fc36efc4963ddee21212930c296b976263f825e0',
    ['財官印食', [{
      required: [structure('财官相生'), structure('官印相生'), structure('食伤生财')],
      anyOf: [[monthMainGod('食神')], ...godOn('食神')],
    }]],
  ]],
  ['yhzp-v3-c103-p002-001', ['4f70aa339d9328cbfdd4d6a892b9515dd53cf48c993838503453cf19e132535e',
    ['月合通官，柱中遇財，財生官', [{
      required: [monthMainGod('正官'), structure('财官相生')],
      anyOf: pairs.filter(pair => pair.includes('month')).flatMap(([first, second]) => wealth.flatMap(god => godOn(god)
        .map(facts => [relation('六合', first, second), ...facts]))),
    }]],
  ]],
  ['yhzp-v3-c131-p002-003', ['d8dbd5db86386dfe54385915c4687c036112825bbed058319865c8e80c527cd4',
    ['財生官，官生印，印生身', [[structure('财官相生'), structure('官印相生'), structure('印绶护身')]]],
  ]],
  ['yhzp-v3-c131-p002-501', ['a53f818dbd746aaa874cc4a7cce9b933a05470764b94b63c22424ec14db98c05',
    ['祿遭冲破', [{
      anyOf: pairs.flatMap(([first, second]) => [first, second].flatMap(position =>
        ['六冲', '相破'].map(kind => [relation(kind, first, second), shen(position, '禄神')]))),
      required: [configuration(clashedOrBrokenLu)],
    }]],
  ]],
  ['yhzp-v3-c151-p005-002', ['38f0b882e07ad652992df096942d0fff03da6b6053d2c93e8cf3d4b7141e6fba',
    ['兩干不雜', [[configuration(alternatingStemNames)]]],
  ]],
  ['yhzp-v4-c002-p003-001', ['a0dd276261a987997c7168f386db27c5da93410e0b44c0803c9ad155b14a80a8',
    ['年傷身主', ['正官', '七杀'].map(god => [stemGod('year', god)])],
  ]],
  ['yhzp-v4-c002-p005-002', ['19d8bf21eda4b902ecbb51ef1c0fdc717e40a0d597680e1c00c9739087f31242',
    ['兩丁坐南，離而無制', pairs.map(([first, second]) => ({
      required: [stem(first, '丁'), stem(second, '丁')], anyOf: branchSet('巳午未'), mustBeAbsent: [element('水')],
    }))],
  ]],
  ['yhzp-v4-c002-p008-001', ['f039e9a78096a586e370640dd0b15db4f6ff8a4bc3981c56608e1f53523c28fc',
    ['子午卯酉重逢', [[configuration(fourCardinalBranches)]]],
  ]],
  ['yhzp-v4-c081-p022-001', ['7e27cb505b6d93edcdbd830d6c8fac7197400caee6d0aa29c604beef1e6e1d49',
    ['内財後印', orderedWealthSeal(wealth, ['正印', '偏印'])],
    ['先印後財', orderedWealthSeal(['正印', '偏印'], wealth)],
  ]],
  ['yhzp-v4-c081-p039-002', ['f3e787d7281973dd5c4dae4ed6194bbf89f23978f83891533f0c65907e979897',
    ['癸日己亥，殺財透露，地合傷官', [{
      required: [stem('day', '癸'), pillar('month', '己亥')],
      anyOf: ['year', 'hour'].flatMap(position => wealth.flatMap(god => godOn(god).map(facts => [
        branch(position, '寅'), position === 'year' ? relation('六合', 'year', 'month') : relation('六合', 'month', 'hour'), ...facts,
      ]))),
    }]],
  ]],
  ['yhzp-v4-c186-p012-001', ['3efe8c275ad682595b739339ce5053aa8e838356784d08648771314a687c8899',
    ['金多有水', [{
      required: [branch('month', '丑'), vigor('食伤')],
      anyOf: ['戊', '己'].flatMap(day => blade.flatMap(bladeFacts => visibleMetalWater.map(facts => [
        stem('day', day), ...bladeFacts, ...facts,
      ]))),
    }]],
  ]],
  ['yhzp-v5-c012-p004-001', ['1ff940fa19ac76e9f924bc1fa2246eba7d073197bdc8e8bd0db9df2d89d493dc',
    ['干上食神支又合', [{
      required: [foodControlsKilling],
      anyOf: godOn('食神').flatMap(facts => pairs.map(([first, second]) => [...facts, relation('六合', first, second)])),
    }]],
  ]],
  ['yhzp-v5-c053-p002-001', ['2bb3f57acd45ce81aba9e53766250cc6c0bb45d12fca36cd23a4196538bf57a8',
    ['偏財身旺', [{
      required: [strong, vigor('偏财')], anyOf: godOn('偏财'), mustBeAbsent: blade.flat(),
    }]],
    ['若還身弱', [{ required: [weak, vigor('偏财')], anyOf: godOn('偏财') }]],
  ]],
  ['yhzp-v5-c060-p010-001', ['cea2b05315350809bb218d05b7787f7be1f50b9246d5fa6e5dc7da8059c17db0',
    ['食神居先殺居後', [{
      required: [foodControlsKilling],
      anyOf: visible.flatMap((first, index) => visible.slice(index + 1).map(second =>
        [stemGod(first, '食神'), stemGod(second, '七杀')])),
    }]],
  ]],
  ['yhzp-v5-c071-p003-001', ['9003b182cd7fee04889576dc7dad292357fc29a8e1e40af1ab31ce85eec9c166',
    ['火土傷官宜傷盡', [{
      required: [monthMainGod('伤官'), count('官杀', 0)], anyOf: ['丙', '丁'].map(day => [stem('day', day)]),
    }]],
    ['金水傷官要見官', [{
      required: [monthMainGod('伤官')], anyOf: ['庚', '辛'].flatMap(day =>
        godOn('正官').map(facts => [stem('day', day), ...facts])),
    }]],
    ['木火見官官有旺', [{
      required: [vigor('官星'), vigor('伤官'), structure('伤官见官')],
      anyOf: ['甲', '乙'].flatMap(day => permutationsOfVisibleGods(['正官', '伤官'])
        .map(facts => [stem('day', day), ...facts])),
    }]],
    ['惟有水木傷官格，財官兩見', [{
      required: [monthMainGod('伤官'), structure('财官相生')],
      anyOf: ['壬', '癸'].flatMap(day => wealth.flatMap(god => permutationsOfVisibleGods([god, '正官'])
        .map(facts => [stem('day', day), ...facts]))),
    }]],
  ]],
  ['yhzp-v5-c287-p002-001', ['a241ce92e6dd80f54ebd5310339390b1e225967f05571df2c7623961d23e1c4f',
    ['秋月金居一類看，名爲從革', [{
      required: [configuration(goldTrineBranches), balance('金', '旺')],
      anyOf: ['庚', '辛'].flatMap(day => [...'申酉戌'].map(month => [stem('day', day), branch('month', month)])),
      mustBeAbsent: [...stemOn('丙').flat(), ...stemOn('丁').flat(), ...allClashesAndBreaks],
    }]],
  ]],
  ['yhzp-v5-c293-p004-001', ['c3a85ed029d1ff70dfaf4e9df6e7fbaed259642dc7d5b16be7aafc587d83b0a1',
    ['甲乙生人寅卯辰', [{
      required: [balance('木', '旺')],
      anyOf: ['甲', '乙'].flatMap(day => branchSet('寅卯辰').map(facts => [stem('day', day), ...facts])),
    }]],
    ['亥卯未全嫌白帝', [{
      required: [balance('木', '旺')],
      anyOf: ['甲', '乙'].flatMap(day => branchSet('亥卯未').map(facts => [stem('day', day), ...facts])),
      mustBeAbsent: [element('金')],
    }]],
  ]],
  ['yhzp-v5-c298-p004-001', ['65a5d4f3e5dacac780ce993b50da46ebd396317a0ad4fac71d3f8feddd34c26e',
    ['火多炎上去冲天', [{
      required: [configuration(fireBranches), balance('火', '旺')],
      anyOf: ['丙', '丁'].map(day => [stem('day', day)]), mustBeAbsent: [element('水')],
    }]],
  ]],
  ['yhzp-v5-c315-p007-001', ['f519de9341bc24716ca2f09991b557bbd40b4566a4519e6d7e6f6a2db4332fb5',
    ['庚曰全逢寅午戌，天千透出', [{
      required: [stem('day', '庚'), configuration(fireTrineBranches), vigor('七杀')], anyOf: stemOn('丙'),
    }]],
  ]],
  ['yhzp-v5-c349-p014-001', ['da23144f513e46436cd055de34623c20e1a4a19a407cc1da8793eb71b265b096',
    ['喜逢申', [['丙', '辛'], ['辛', '丙']].map(([stem, partner]) => ({
      required: [{ kind: 'bazi_day_stem_transformation', stem, partner, element: '水' }],
      anyOf: positions.map(position => [branch(position, '申')]),
    }))],
  ]],
  ['yhzp-v5-c422-p002-001', ['f5d3f0634699f177a3654bc06f9d199cac80b09a2b51380d33425c26ee413b70',
    ['財官印綬三殺物', [[woman, strong, count('七杀', 0),
      structure('财官相生'), structure('官印相生'), structure('印绶护身')]]],
  ]],
  ['yhzp-v5-c449-p002-001', ['49e48164595712e8104d2f78a78df0c74bc6e7f58eb01e80a2f96b2556fdd9c1',
    ['臨官帝旺雨相逢', positions.map(position => ({
      required: [{ kind: 'day_stem_phase', position, phase: '临官' }],
      anyOf: positions.filter(other => other !== position).map(other =>
        [{ kind: 'day_stem_phase', position: other, phase: '帝旺' }]),
    }))],
  ]],
  ['yhzp-v5-c451-p003-001', ['4addca916e31c6fe4b44eccb4303e3c4ab6e3920a709e7d0bd1afe7f0ab4eb1c',
    ['衰病兩逢兼值死', positions.map(position => ({
      required: [{ kind: 'bazi_nayin_phase', position, phase: '死' }],
      anyOf: positions.filter(first => first !== position).flatMap(first => positions
        .filter(second => ![position, first].includes(second)).map(second => [
          { kind: 'bazi_nayin_phase', position: first, phase: '衰' },
          { kind: 'bazi_nayin_phase', position: second, phase: '病' },
        ])),
    }))],
  ]],
  ['yhzp-v1-c157-p003-001', ['7af81af66d59ec4a4f92d5283f6ab101d8b4a6ee3fe7b71706ccc6a3fdbe084a',
    ['更須貴格相扶合', [{
      required: [qualifiedPattern('正官格'), structure('财官相生')],
      anyOf: [...'庚辛壬癸'].flatMap(day => [...('庚辛'.includes(day) ? '寅亥' : '巳申')].flatMap(value =>
        positions.map(position => [stem('day', day), branch(position, value)]))),
    }]],
  ]],
  ['yhzp-v1-c311-p002-001', ['26f2455e1060f92b6803fdda1796056e7873b3837a5bbb22d3a4495f51b1de62',
    ['冬至之後陽氣已生木乘暖氣', [{
      required: [structure('印绶护身')],
      anyOf: ['甲', '乙'].flatMap(day => [['子', '冬至'], ['丑', '冬至'], ['丑', '大寒']]
        .flatMap(([month, term]) => ['丙', '丁'].flatMap(fire => stemOn(fire)
          .flatMap(facts => quantity(fire, 'hidden', 1).map(root => [
            stem('day', day), branch('month', month), { kind: 'bazi_previous_qi', term }, ...facts, ...root,
          ]))))),
    }]],
  ]],
  ['yhzp-v2-c383-p002-001', ['2ff37258a60376cf8f2108037c8d383671c82788c78c941ec208ab66b7836a85',
    ['身無所托', [{
      required: [man, stem('day', '乙'), branch('month', '戌'), weak, { ...vigor('财星'), strength: '过盛' },
        count('比劫', 0), count('印星', 0)],
      mustBeAbsent: absentVisibleGods('正官', '七杀'),
    }]],
  ]],
  ['yhzp-v3-c105-p005-002', ['a74fa9ffe200d1292147c4d2462e46550754cb0b0d1ce1409ce16a13ffd7d505',
    ['官星若也逢生旺，更得長生旺在時', [{
      required: [man, vigor('官星')],
      anyOf: [...withOwnPhase('hour', '正官', growthPhases), ...growthPhases.map(phase =>
        [{ kind: 'bazi_hidden_god_phase', position: 'hour', tenGod: '正官', phase, anchor: 'host' }])],
    }]],
  ]],
  ['yhzp-v3-c151-p004-003', ['82f74105ba5dfc87a58a08e3f0093448159c9a3df0e2a84b7679e80296a7698e',
    ['去殺留官', [{
      required: [foodControlsKilling], anyOf: permutationsOfVisibleGods(['正官', '七杀', '食神']),
    }]],
    ['去官留殺', [{
      required: [monthMainGod('七杀'), structure('伤官见官')],
      anyOf: permutationsOfVisibleGods(['正官', '伤官']),
      mustBeAbsent: [...absentVisibleGods('食神'), relation('六冲', 'year', 'month')],
    }]],
  ]],
  ['yhzp-v3-c151-p006-001', ['81eb04f784464788cdac3cde4fcbb1698cf42c75ebae4651e361f614b93e0d9f',
    ['從化得從', [
      [configuration(baziClassicalStructureNames.rootlessWealth)],
      [configuration(baziClassicalStructureNames.rootlessKilling)],
    ]],
  ]],
  ['yhzp-v4-c002-p018-001', ['dbab5a5104fefc19cc3a500d5a1ff1e072566a2dd74086e43b0c750aeb679675',
    ['禄旺財豐', [{
      required: [strong, vigor('财星')],
      anyOf: positions.flatMap(position => countOptions('财星', [2, 3, 4]).map(amount => [shen(position, '禄神'), ...amount])),
    }]],
  ]],
  ['yhzp-v4-c140-p002-001', ['b57dc213834c8006e3cb2a3e945546b79c990a8a6370bbf4fee86ac2a81c0940',
    ['殺多金水化', [{
      required: [branch('month', '辰'), vigor('七杀'), foodControlsKilling],
      anyOf: visibleMetalWater.flatMap(facts => countOptions('七杀', [2, 3, 4]).map(amount => [...facts, ...amount])),
    }]],
    ['提剛若用財官印，金水相臨', [{
      required: [branch('month', '辰')],
      anyOf: ['正财格', '偏财格', '正官格', '正印格', '偏印格'].flatMap(name =>
        visibleMetalWater.map(facts => [qualifiedPattern(name), ...facts])),
    }]],
  ]],
  ['yhzp-v4-c158-p002-001', ['1be33af50f6dff14974772a2ae75364f23db2eacd2e540f32a530575427dd159',
    ['火金生旺', [{
      required: [branch('month', '申'), balance('金', '旺')],
      anyOf: ['丙', '丁'].flatMap(fire => visible.flatMap(position => growthPhases.map(phase =>
        [stem(position, fire), ownStemPhase(position, phase)]))),
    }]],
  ]],
  ['yhzp-v5-c024-p009-001', ['2957b540b9aa8858de5b6b1ee1e5e7ffceb4f210971dcdb3ac7978ce0e9da972',
    ['支上咸池干帶合', [{
      required: [vigor('印星')],
      anyOf: countOptions('印星', [2, 3, 4]).flatMap(amount => pairs.flatMap(([first, second]) =>
        positions.map(position => [...amount, union(first, second), shen(position, '桃花')]))),
    }]],
  ]],
  ['yhzp-v5-c024-p018-001', ['6eeaea2e392e112cf0a8c546377a425d2caced17685d40c0c1bf1165474deba7',
    ['印綬不宜身太旺', [{ required: [strong, vigor('印星'), count('官杀', 0)], anyOf: overfullSealMonth }]],
    ['除非元命多官殺', [{ required: [strong, vigor('印星')],
      anyOf: overfullSealMonth.flatMap(facts => countOptions('官杀', [3, 4]).map(amount => [...facts, ...amount])),
    }]],
  ]],
  ['yhzp-v5-c047-p002-001', ['6c59b375c17231ffcf574d870147111b20c491a42d5fce3ececaff978b84f34c',
    ['正財無破乃生官，身旺', [{
      required: [qualifiedPattern('正财格'), strong, structure('财官相生'), count('劫财', 0)],
      anyOf: godOn('正财'), mustBeAbsent: monthWithoutHarms,
    }]],
    ['身弱財多', [{ required: [weak, vigor('财星')], anyOf: countOptions('财星', [3, 4]) }]],
    ['輕財分奪', [{
      required: [strong, vigor('比劫')],
      anyOf: permutationsOfVisibleGods(['正财', '劫财']), mustBeAbsent: noHiddenWealth,
    }]],
  ]],
  ['yhzp-v5-c060-p008-001', ['efaada4d78b667207de803897b8ad5670ff869877821c8630679be2674695e55',
    ['若臨偏印', [{
      required: [stem('day', '甲'), structure('枭印夺食')],
      anyOf: permutationsOfVisibleGods(['食神', '偏印']),
    }]],
  ]],
  ['yhzp-v5-c081-p009-001', ['2dd4a91badfa0c92d17c95f9a6929e7813c2f4a78c36ded73ed6aa7644ab2eef',
    ['羊刃重逢合', [{
      required: [vigor('比劫')],
      anyOf: pairs.flatMap(([first, second]) => pairs.filter(pair => pair.includes(first) || pair.includes(second))
        .map(([left, right]) => [shen(first, '阳刃'), shen(second, '阳刃'), relation('六合', left, right)])),
    }]],
  ]],
  ['yhzp-v5-c117-p008-001', ['3091ddff3938f6c04e56510ee8f147f6610e1e6e196e8a00c2ecab54e42e4170',
    ['更無冲破空刑物', [{
      required: [strong],
      anyOf: reviewedDayVirtues.flatMap(day => visible.flatMap(position =>
        reviewedDayVirtues.map(other => [pillar('day', day), pillar(position, other)]))),
      mustBeAbsent: [...allClashesAndBreaks, ...pairs.flatMap(([a, b]) => punishmentTypes.map(kind => relation(kind, a, b))),
        ...positions.map(voidAt)],
    }]],
  ]],
  ['yhzp-v5-c126-p003-001', ['ca1c02f1c7227f50f1b8652cbe75d74c7786d51a0da7b13af80cd398264a6803',
    ['日加重者', [{
      required: [strong], anyOf: kuiGangDays.flatMap(day => visible.flatMap(position => kuiGangDays.map(other =>
        [pillar('day', day), pillar(position, other)]))),
    }]],
    ['如逢一位冲刑重', kuiGangDays.map(day => ({
      required: [pillar('day', day)], anyOf: doubleDayClashes,
      mustBeAbsent: nonDayKuiGang,
    }))],
  ]],
  ['yhzp-v5-c269-p007-001', ['626e305b3e3b0366e9f0788ef01fe0950cb7c756b9b823ca5cd06f2e5d5d5afd',
    ['勾陳得位會財官，無破無冲', [{
      required: [structure('财官相生')],
      anyOf: ['戊寅', '戊申'].flatMap(day => permutationsOfVisibleGods(['正官', '正财'])
        .map(facts => [pillar('day', day), ...facts])),
      mustBeAbsent: allClashesAndBreaks,
    }]],
  ]],
  ['yhzp-v5-c277-p003-001', ['1d6dfba7868e09cbf37fde32fd8edddcaf1994d0af628c716f8a274be83278ae',
    ['財官兩見始成真。局無冲破', [{
      required: [structure('财官相生')],
      anyOf: ['壬', '癸'].flatMap(day => wealth.flatMap(god => permutationsOfVisibleGods(['正官', god])
        .map(facts => [stem('day', day), ...facts]))),
      mustBeAbsent: allClashesAndBreaks,
    }]],
  ]],
  ['yhzp-v5-c280-p007-001', ['caca6979a7daa88f533f740df7b639f662e72cedfa908b8170165ae2676f218c',
    ['壬癸生臨水局中', [{
      required: [balance('水', '旺')], anyOf: ['壬', '癸'].flatMap(day => [waterTrineBranches, waterSeasonBranches]
        .map(name => [stem('day', day), configuration(name)])),
      mustBeAbsent: [...stemOn('戊').flat(), ...stemOn('己').flat()],
    }]],
  ]],
  ['yhzp-v5-c287-p003-001', ['d8f692cc4117646b02b5af932f95883a2357d0cb6793947a25cc7e0a450b51fa',
    ['四柱火來相混雜', [{
      required: [configuration(goldTrineBranches)],
      anyOf: ['庚', '辛'].flatMap(day => ['丙', '丁'].flatMap(fire => stemOn(fire).map(facts => [stem('day', day), ...facts]))),
    }]],
  ]],
  ['yhzp-v5-c349-p011-001', ['63af158b5436bc6f1d77daa9abc8d481e25fb45186f93eca57cb728d75a31604',
    ['丁壬化木喜逢寅', [['丁', '壬'], ['壬', '丁']].map(([stem, partner]) => ({
      required: [{ kind: 'bazi_day_stem_transformation', stem, partner, element: '木' }],
      anyOf: positions.map(position => [branch(position, '寅')]),
    }))],
  ]],
  ['yhzp-v5-c349-p020-001', ['0a6bbbc71d623b442adace38d9ef430f3c80393b732331953b6ce055c1d4f5c5',
    ['天元戊癸支藏水', [
      { required: [stem('day', '戊')], anyOf: pairedDayWithHiddenGod('癸', wealth) },
      { required: [stem('day', '癸')], anyOf: pairedDayWithHiddenGod('戊', ['比肩', '劫财']) },
    ]],
  ]],
  ['yhzp-v5-c466-p008-002', ['2932c1bf34e5260c48a36f11cbebdef2fe9a6796f37a4d3724627d61c2feb715',
    ['刧財之地', [{ required: [vigor('比劫')], anyOf: godOn('劫财') }]],
  ]],
  ['yhzp-v1-c294-p002-003', ['b443187fdc82b65baeba72c5b9bbc424efca9243baf39c248c99738860bcb626',
    ['月令有用神', ['正官格', '正印格', '偏印格'].map(name => [qualifiedPattern(name)])],
    ['年有用神', [{ required: [structure('官印相生')], anyOf: [
      [stemGod('year', '正官'), monthMainGod('正印')],
      [stemGod('year', '正印'), monthMainGod('正官')],
    ] }]],
    ['時有用福', [{ required: [structure('官印相生')], anyOf: [
      ...withOwnPhase('hour', '正官', growthPhases).map(facts => [...facts, monthMainGod('正印')]),
      ...withOwnPhase('hour', '正印', growthPhases).map(facts => [...facts, monthMainGod('正官')]),
    ] }]],
  ]],
  ['yhzp-v1-c333-p015-001', ['49cb8c2111780df68e8a321d69c0d0857ec1bafb29da2c2307e389465b485ed3',
    ['以日爲妻如在空刑', [{ required: [man, voidAt('day')],
      anyOf: dayPairs.flatMap(([first, second]) => punishmentTypes.map(kind => [relation(kind, first, second)])),
    }]],
  ]],
  ['yhzp-v1-c351-p027-001', ['fbaa83d487f36ec40a3a74adb01b78c0f84e5f95c8aa3317c3dd31c99ec6c25e',
    ['日干旺甚無依', [{ required: [strong, count('财星', 0), count('官杀', 0)],
      anyOf: [...'甲乙丙丁戊己庚辛壬癸'].map((day, index) => [stem('day', day), balance('木火土金水'[Math.floor(index / 2)], '过盛')]),
    }]],
  ]],
  ['yhzp-v1-c351-p032-001', ['f98e7aadbdf0b82266ef87debb9734c7e2ff7aac36bd90b43bbceef40ea91a81',
    ['偏官時遇制伏太過', [[stemGod('hour', '七杀'), foodControlsKilling, count('七杀', 1),
      { ...vigor('食神'), strength: '过盛' }]]],
  ]],
  ['yhzp-v2-c002-p116-101', ['140a703b1722e17aa4b1b1440aaf093d5efeb671d50b704a94aa36e80f93ddf0',
    ['曰主太柔，總遇財官', [[weak, vigor('财星'), vigor('官星'), count('比劫', 0), structure('财官相生')]]],
  ]],
  ['yhzp-v2-c214-p003-101', ['ad217e551307fd91c840c58f14622c0b26a2e20b24b1ffa759d4b73a7e191e8a',
    ['身衰財旺', [{ required: [weak, vigor('财星')], anyOf: wealthWithOfficerAtYearAndHour }]],
    ['身旺財多，財亦旺', [{ required: [strong, vigor('财星')],
      anyOf: wealthWithOfficerAtYearAndHour.flatMap(facts => countOptions('财星', [2, 3, 4]).map(amount => [...facts, ...amount])),
    }]],
  ]],
  ['yhzp-v2-c220-p002-001', ['808af6be4b323d4b0c6d0175f519c7bcb41aaccbffa6b80b298c6f4874ef41c1',
    ['官星多則雜', [{
      required: [stemGod('year', '正官'), stemGod('hour', '正官'), union('year', 'month')],
      mustBeAbsent: absentVisibleGods('七杀'),
    }]],
  ]],
  ['yhzp-v2-c230-p002-001', ['55b65f17e764cb26660640dc7aa334d23c6e652feb44b8a58821de04edbc1b1e',
    ['此印綬之妙者', ['正印', '偏印'].map(god => [monthMainGod(god), vigor('印星'),
      structure('印绶护身'), count('财星', 0)])],
  ]],
  ['yhzp-v3-c018-p002-002', ['566b3affe9986c3abe4ceaf5c28d8217b93dd584b59db583c9d56b9e2bf891c5',
    ['寅月乙木受制', [{ required: [stem('day', '甲'), branch('month', '寅')],
      anyOf: visible.flatMap(position => visible.filter(other => other !== position)
        .map(other => [stem(position, '乙'), stem(other, '辛')])),
    }]],
  ]],
  ['yhzp-v3-c029-p002-001', ['a232efae02db1981a42900b085fe093581573b028edab86876e452c4270a751e',
    ['夫榮子旺', [[woman, vigor('官星'), vigor('食伤')]]],
    ['子死夫哀', [{ required: [woman], anyOf: outputAndOfficerWane,
      mustBeAbsent: [vigor('官星'), vigor('食伤')] }]],
  ]],
  ['yhzp-v3-c029-p002-002', ['c4877da52fec6778e60c48426538e44d0c9b8ae07a5468a2ff621bcd982f99f9',
    ['夫衰身旺', [{ required: [woman, strong, count('正官', 1)],
      anyOf: visible.flatMap(position => withOwnPhase(position, '正官', ['衰', '死', '绝'])),
    }]],
  ]],
  ['yhzp-v3-c095-p004-101', ['468649ad1892aacfa0b2565c8d16b8800ed0f5d2995a5390f98e43244c031b59',
    ['五行身旺，羊刃比肩，俱各争旺', [{
      required: [strong, vigor('比劫')],
      anyOf: blade.flatMap(facts => godOn('比肩').flatMap(peer => [...wealth, '正官', '七杀'].flatMap(godOn)
        .map(outlet => [...facts, ...peer, ...outlet]))),
      mustBeAbsent: [...noHiddenWealth, ...positions.flatMap(position => ['正官', '七杀'].map(god => branchGod(position, god)))],
    }]],
  ]],
  ['yhzp-v3-c105-p003-001', ['1803f4d21db9cc0c29ec59d99ef0cc5feb75ec05cc1bc9e654076271774fbef5',
    ['身居九夏，火土多，相逢水濟', [{
      required: [balance('火', '旺'), balance('土', '旺')],
      anyOf: [...'巳午未'].flatMap(month => ['壬', '癸'].flatMap(water => stemOn(water)
        .flatMap(facts => quantity(water, 'hidden', 1).map(root => [branch('month', month), ...facts, ...root])))),
    }]],
  ]],
  ['yhzp-v3-c105-p006-001', ['61d681873be3092c7dba1975783d839f0f6223d5e5d42d4e53430617028e882b',
    ['女人官旺兼財旺', [[woman, vigor('官星'), vigor('财星'), structure('财官相生')]]],
  ]],
  ['yhzp-v3-c125-p002-001', ['e5d084f024a922dfe07783d51020fc5e955026c34504cc1a450f92346383646d',
    ['日逢貴地見祿馬', [{ required: [shen('day', '天乙贵人')],
      anyOf: positions.flatMap(first => positions.map(second => [shen(first, '禄神'), shen(second, '驿马')])),
    }]],
  ]],
  ['yhzp-v3-c137-p002-001', ['35e64a9278329265633c1a315393aaa50111afa23d3be1edcd4b9b9515483c11',
    ['身旺無依，年冲月令', [[strong, count('财星', 0), count('官杀', 0), relation('六冲', 'year', 'month')]]],
  ]],
  ['yhzp-v3-c146-p002-001', ['d616d1e599924bc0a5420a3d7f4e5b935ba9b3d56919ba803a23308a3ed40dec',
    ['妻星失令', [{ required: [man],
      anyOf: unseasonalDirectWealth, mustBeAbsent: [vigor('正财')],
    }]],
  ]],
  ['yhzp-v4-c002-p011-001', ['e8d3619f741b0ae126aa30b40404ad82781cb4ff80c34878422f6761cabdf521',
    ['財輕身旺', [{ required: [strong, vigor('比劫')],
      anyOf: wealth.flatMap(godOn), mustBeAbsent: noHiddenWealth,
    }]],
  ]],
  ['yhzp-v4-c025-p005-002', ['1b0eb045258d29a0d5a14f58f85d7f878bcf0eb9c8f7427b8b3a489cad5fef0b',
    ['金堅愛水之相涵', [{ required: [balance('金', '旺'), vigor('食伤')],
      anyOf: ['庚', '辛'].flatMap(day => ['食神', '伤官'].flatMap(god => godOn(god).map(facts => [stem('day', day), ...facts]))),
    }]],
  ]],
  ['yhzp-v4-c025-p012-001', ['074645f98b626ec0e2a2be17dd7d4bb2b8e65104a0f5c692771799e46786ee78',
    ['財星得位', [[man, mainGod('day', '正财'), vigor('正财')]]],
  ]],
  ['yhzp-v4-c040-p005-001', ['5a721bd1ff263bb018c1bc41fb993f58e284b79ac822e089c5e8dc6f9c33c193',
    ['土重而無木疏通', [{ required: [balance('土', '过盛')], mustBeAbsent: [element('木')] }]],
    ['金堅而無火鍛煉', [{ required: [balance('金', '旺')], mustBeAbsent: [element('火')] }]],
  ]],
  ['yhzp-v4-c047-p003-001', ['974c4645a721603ad2c35aa38a1a7203572088c4abee44d9d1d13f109f73fec7',
    ['殺印重旺', [[vigor('七杀'), vigor('印星'), structure('杀印相生')]]],
  ]],
  ['yhzp-v4-c053-p006-002', ['b4dcd2b4e784d1516be5a57be022edc28f8a585a22bb3f121ff34406b699bd26',
    ['刼刃', [{ required: [vigor('比劫')], anyOf: blade.flatMap(facts => godOn('劫财').map(gods => [...facts, ...gods])) }]],
  ]],
  ['yhzp-v4-c068-p007-001', ['5541ea9264edc7b8f94f9d0c9075a3fa5bdf3202fb5edfe92b6b352af98cb21b',
    ['官星若遇刼財', [{ required: [monthMainGod('正官')], anyOf: godOn('劫财') }]],
  ]],
  ['yhzp-v4-c077-p004-002', ['a1330df7ca60e259c4316edb73b8ab63c7ff8f42842703675e9cc2b31ce36308',
    ['煞重身輕休道弱，如逢印綬', [[weak, vigor('七杀'), structure('杀印相生'), structure('印绶护身')]]],
  ]],
  ['yhzp-v4-c081-p039-001', ['e794d51ebe0b58cc9211067bde50fea3c6b6927315ad5fc092989835ea0e7f65',
    ['土旺', [{ required: [balance('金', '旺'), vigor('官杀')], anyOf: metalMonthsWaterDays }]],
    ['火旺', [{ required: [balance('金', '旺'), vigor('财星')], anyOf: metalMonthsWaterDays }]],
  ]],
  ['yhzp-v4-c121-p002-002', ['742e04f6e18a769af97bf87d7cc4dcbda8a7c0f898ee4a76ec3d45289dc06d99',
    ['丙火無根，子申金見，無制無生', [{
      required: [stem('day', '丙'), branch('month', '子'), count('印星', 0)],
      anyOf: positions.filter(p => p !== 'month').map(p => [branch(p, '申')]),
      mustBeAbsent: [...noHiddenFire, ...absentVisibleGods('食神', '伤官')],
    }]],
  ]],
  ['yhzp-v1-c333-p016-001', ['78a489cb782bcf85fab5f497756d6e4c7124f5773bd94c8af2a1fdc1665fc405',
    ['臨死絶之鄉', [{ required: [man], anyOf: ['正官', '七杀'].flatMap(god => withOwnPhase('hour', god, ['死', '绝'])) }]],
  ]],
  ['yhzp-v2-c373-p003-002', ['ffef710be0bdb6748226180e586985d3100246d0039dd9165b78660c2eb9f85a',
    ['辰戌丑未俱全，得水爲財，又無木尅', [{
      required: [configuration(earthVaults)],
      anyOf: ['戊', '己'].flatMap(day => ['壬', '癸'].flatMap(name => stemOn(name)
        .map(facts => [stem('day', day), ...facts]))),
      mustBeAbsent: [...stemOn('甲').flat(), ...stemOn('乙').flat()],
    }]],
  ]],
  ['yhzp-v3-c002-p002-002', ['9db18571036cb8d383be2f0e5043e129e25bb9529dc9ff482f20c60a7a8dd725',
    ['見比刼、羊刃', [{
      required: [vigor('比劫')],
      anyOf: blade.flatMap(facts => [...godOn('比肩'), ...godOn('劫财')].map(seen => [...facts, ...seen])),
    }]],
  ]],
  ['yhzp-v3-c002-p002-003', ['7dd3b69da64514f7c179d9f6977c188b66cd26621eae469b5197fd7d164d09b1',
    ['官殺多者', countOptions('官杀', [3, 4])],
  ]],
  ['yhzp-v3-c004-p002-002', ['f17a5578d0bb4c4828561ff87ae822a8432d902392468884560f63ac46392ed8',
    ['乘旺傷官', [[vigor('伤官')]]],
  ]],
  ['yhzp-v3-c018-p002-001', ['dc063b5ab20cfdecf416b7354274e30adc97e01dfa1673c4c3cc726d2e76fa20',
    ['甲乙寅卯旣多', [{
      required: [stem('day', '甲'), balance('木', '旺')],
      anyOf: branchSet('寅卯').flatMap(pair => stemOn('乙').map(seen => [...pair, ...seen])),
    }]],
  ]],
  ['yhzp-v3-c045-p002-001', ['806af25f950e8e634677a75db71a0b85800f321c5bd2b9c703b819edb3b8c495',
    ['木盛', [[temperament('木', '旺相')]]],
    ['太過', [[temperament('木', '太过')]]],
    ['不及', [[temperament('木', '不及')]]],
  ]],
  ['yhzp-v3-c045-p002-002', ['80e5b04d3c2acd041deb0d21e720d3bbdb0935c8fabe2822e7692d7deec771d1',
    ['火曰炎上', [[temperament('火', '旺相')]]],
  ]],
  ['yhzp-v3-c045-p002-003', ['e9ff4a56e5e1ef51a3e8aab9b3e8676744289d86492ff3767f42ca71072848d2',
    ['剛毅何决', [[temperament('金', '旺相')]]],
    ['太過', [[temperament('金', '太过')]]],
    ['不及', [[temperament('金', '不及')]]],
  ]],
  ['yhzp-v3-c087-p004-002', ['44b5ba0dc82103f3f0907bc3612eec3349672af6aae7c67150af70ec3ab2a516',
    ['柱有刼財，比刃多者', [{
      required: [vigor('比劫')],
      anyOf: blade.flatMap(facts => godOn('劫财').flatMap(seen =>
        countOptions('比劫', [3, 4]).map(amount => [...facts, ...seen, ...amount]))),
    }]],
  ]],
  ['yhzp-v3-c087-p005-001', ['aad6bbe4d6fc36e1b9155c6693bcb55f6f72fc2813df178035e06dc30c57470e',
    ['傷官用印，去財', [[monthMainGod('伤官'), structure('印绶护身'), count('财星', 0)]]],
  ]],
  ['yhzp-v3-c105-p004-001', ['7fc79cb312b14a51553be30fb1189c8b0e9ac20588a2b40e150209f797384244',
    ['財星入庫', wealthVault(wealth)],
  ]],
  ['yhzp-v3-c105-p004-101', ['f2fe8630758cb25c077a5d2f32da55e0f9bfa6c1171e88b7505f5a7d559830df',
    ['財星入庫', [{ required: [man], anyOf: wealthVault(['正财']) }]],
  ]],
  ['yhzp-v3-c114-p007-002', ['cd34ada60d83c1bfec61c67d240579fffa2a4371a981da790a3936118c057560',
    ['支中有官無刑破者', positions.map(position => ({
      required: [man, branchGod(position, '正官')],
      mustBeAbsent: pairs.filter(pair => pair.includes(position)).flatMap(([first, second]) =>
        ['六冲', '相破', '相刑', '三刑', '自刑'].map(kind => relation(kind, first, second))),
    }))],
  ]],
  ['yhzp-v3-c135-p002-003', ['c36179115d40ee4eef39a2c4356f8e75f3a6afaf895ab89ae7360b0f8d6c88be',
    ['梟印當權', [[monthMainGod('偏印'), vigor('印星')]]],
  ]],
  ['yhzp-v3-c137-p006-001', ['57b02096735a80289c6e17966b212120035b53cf026c0bcf00b5506ef8343e9b',
    ['身旺者用財', [[qualifiedPattern('伤官格'), strong, structure('伤官生财'), structure('财星破印')]]],
    ['身弱者用印', [[monthMainGod('伤官'), weak, structure('印绶护身'), count('财星', 0)]]],
  ]],
  ['yhzp-v3-c146-p002-002', ['faed59e7ab0eb91cd49a1b6039829e6b054cff70d2e2f047253a55c71486a0cc',
    ['妻入墓', [{ required: [man], anyOf: wealthVault(['正财']) }]],
  ]],
  ['yhzp-v4-c081-p007-001', ['9b3460f4d52aa98b53c49b14752db2a5366bbca44e425677b43162b0e66a2e3f',
    ["身支年同，破蕩祖基", [[configuration(yearDaySameBranch)]]],
  ]],
  ['yhzp-v4-c081-p020-001', ['ee9903fa8ed32e63874718795dcec10a2f956df1b98b050a656e4fd080a82dad',
    ["時殺多根，殺旺不利", [[configuration(hourKillingRooted), vigor('七杀')]]],
  ]],
  ['yhzp-v4-c121-p002-001', ['e60ed9eacccb5e316a5432e8a5cab1939cf42130ae98cba63fbdac1157323c91',
    ["金多則折", monthDayCases('甲', '丑', noHiddenRoots('甲乙'), abundant('金'))],
    ["金多轉貴", monthDayCases('乙', '丑', noHiddenRoots('甲乙'), abundant('金'))],
  ]],
  ['yhzp-v4-c123-p003-001', ['b99d45d379de865779fc99647ea323445c2a3c456b859b5c9d3c26207e3de2a6',
    ["健禄生提月，財官喜透天", [[shen('month', '禄神'), configuration(visibleWealthAndOfficer), qualifiedWealth]]],
  ]],
  ['yhzp-v4-c126-p006-001', ['4c7848d8f83f76cf5b8f6a4506ee9333fed81a0a79e66b47ce51c78fe1ca4a28',
    ["只求木火相生吉", monthDayCases('戊', '寅', [weak, structure('杀印相生')], countOptions('官杀', [2, 3, 4]))],
  ]],
  ['yhzp-v4-c132-p007-001', ['53d8b34fd204dce15621d6f929dcfb8408a8ac85873476baa7a229f254208db4',
    ["庚辛卯月多逢木，日主無根怕旺財", monthDayCases('庚辛', '卯', [qualifiedWealth, ...noHiddenRoots('庚辛')], abundant('木'))],
  ]],
  ['yhzp-v4-c132-p008-001', ['d8d385655affd63c36b164f5de354a71abf06781742a6cdc6f3833220b13ec57',
    ["局中有火返成功", monthDayCases('癸', '卯', [...noHiddenRoots('壬癸'), element('火')])],
  ]],
  ['yhzp-v4-c162-p004-001', ['a4c98fc1f2a54e4aad57c6c6e5cfb82d54cfeb866934232182838a8f10f25e21',
    ["甲乙酉月多官殺，無根日主一生低", monthDayCases('甲乙', '酉', [vigor('官杀'), ...noHiddenRoots('甲乙')], countOptions('官杀', [2, 3, 4]))],
  ]],
  ['yhzp-v4-c162-p006-001', ['c8505c23fd87e3b8b2704d3f9e53f34229a9d4990fbe4092a69d0a8a0658b99e',
    ["秋金酉丑重金旺，除非火煉有聲名", [
      ...monthDayCases('庚', '酉', [balance('金', '旺'), vigor('官杀')], ['year', 'hour'].map(position => [branch(position, '丑')])),
      ...monthDayCases('辛', '酉', [balance('金', '旺'), vigor('官杀')], ['day', 'hour'].map(position => [branch(position, '丑')])),
    ]],
  ]],
  ['yhzp-v4-c168-p003-001', ['cee08e0b5caf38d2a5f550b96cb87ab24d63a12f7df80dae279de867a8c3efef',
    ["木衰金旺怕庚辛", monthDayCases('甲乙', '戌', [balance('木', '弱'), balance('金', '旺')],
      [...stemOn('庚'), [stem('year', '辛')], [stem('hour', '辛')]])],
  ]],
  ['yhzp-v4-c180-p006-001', ['d3fa77ade63c16ff3e4ffba702d3ae87c5c8bc7b0ae8e698d1b248754877e272',
    ["透用財官富九州", [[branch('month', '子'), balance('水', '旺'), configuration(visibleWealthAndOfficer), structure('财官相生')]]],
  ]],
  ['yhzp-v4-c186-p006-001', ['6679100cd62b0fa408d9de7d9b80a71acdcfc0afa1d0e0015279b0330cc0903a',
    ["傷官財旺藏時節", monthDayCases('戊', '丑', [branchGod('month', '伤官'), vigor('伤官'), qualifiedWealth])],
  ]],
  ['yhzp-v5-c136-p005-001', ['6487923f4fc501c84c4266b6d1df483d76eb263e5b517ed1d591d5541d136d64',
    ["干頭透出格爲真", monthTableExposed],
  ]],
  ['yhzp-v5-c147-p002-001', ['e58b743568abc80b3891fc5b4e0f905ddce6a08cc1ef9d8bfd79873afd9ee386',
    ["喜逢財旺兼身旺", [[configuration(hourStemIndirectWealth), count('偏财', 1), qualifiedWealth, strong]]],
  ]],
  ['yhzp-v5-c153-p009-001', ['a5ebf925133c1b6651b96a1f23bc742fb9ec1aa5fd29671d5db0570245debb12',
    ["有財有印多財祿", [[configuration(hourStemKilling), vigor('七杀'), strong, configuration(wealthAndSeal)]]],
  ]],
  ['yhzp-v5-c243-p004-001', ['ab29b40c525f9bb9656337d3391e4e07c4909a0acedba1b7277747e270deda60',
    ["四季秋生無亥字，榮華富貴業尤奇", [{ required: [stem('day', '辛'), pillar('hour', '戊子')],
      anyOf: [...'辰戌丑未申酉'].map(value => [branch('month', value)]),
      mustBeAbsent: positions.map(position => branch(position, '亥')) }]],
  ]],
  ['yhzp-v2-c265-p002-001', ['d12c28399cd3391742597a6361c2e66733c83f6873b3026a9a5da50a31b408ac',
    ["刑中有帶合者是也", pairs.map(([first, second]) => [relation('相刑', first, second), union(first, second)])],
  ]],
  ['yhzp-v2-c356-p002-001', ['9a6a12dd5337b53b3545e50069f05da41147623bd063a79f6cdb70e1e8014efa',
    ["如人以甲日生亥字多者，自然富貴矣", [jiaApproachesHai]],
  ]],
  ['yhzp-v2-c366-p002-001', ['1fe4ae25da79fb7e11aa98e0aadd44dcc93e9667f9c44fa7476be6b7f374eed4',
    ["主人清秀量洪", [waterTrineBranches, waterSeasonBranches].map(name => ({ required: [configuration(name)], anyOf: combined(['壬', '癸'].map(day => [stem('day', day)]), abundant('水')) }))],
  ]],
  ['yhzp-v3-c016-p002-002', ['0cd43fd90a636f036085903ff368c7dc7216caef7bc9b3bd5748876c83a04d3b',
    ["財多身弱，妻反勝夫。", [{ required: [man, weak, qualifiedWealth], anyOf: countOptions('财星', [2, 3, 4]) }]],
  ]],
  ['yhzp-v3-c016-p002-003', ['76914a5892f4394e966e2e95c9fe1e63867037a72bd65f8a44241f471884b93a',
    ["財命有氣，妻妾和順，是得妻力。", [[man, strong, qualifiedWealth]]],
  ]],
  ['yhzp-v3-c045-p002-006', ['419aa1dd0abeaf9a64ff2abc351dee2d2d499b957e530960c1d542667269ac7d',
    ["弱則退縮怕羞。", [[weak]]],
    ["强則妄誕執一", [[strong]]],
  ]],
  ['yhzp-v3-c087-p006-002', ['c8d7e8aa60a731b4f18c934ee238820eae759c926f8f6e513dffdbacb5e301be',
    ["辰多好鬥", [[configuration(repeatedChen)]]],
    ["戍多好訟", [[configuration(repeatedXu)]]],
  ]],
  ['yhzp-v3-c105-p009-001', ['bced4ebd3fc6214fbeee4f7402a81113a24c90755e06f81bf0c8a85bbf7e5ab8',
    ["干支同類併身旺，尅子刑妻破祖田", [[configuration(sameDayElement), strong]]],
  ]],
  ['yhzp-v3-c114-p005-001', ['879b7a878795cc0a08f026346d03e5678df8e6efabc31162dbd4e80e7890758b',
    ["印綬多母衆，或食衆乳，或寄養外人家", [{ required: [vigor('印星')], anyOf: countOptions('正印', [2, 3, 4]) }]],
  ]],
  ['yhzp-v3-c114-p007-001', ['bf24c7124b15ee0f405546fb1a3cde7cc4747b2f871bf839eb2a7ebe123c88d3',
    ["𡈼癸之水盛者，聰明多智", [{ required: [element('水')], anyOf: combined(['壬', '癸'].map(day => [stem('day', day)]), abundant('水')) }]],
  ]],
  ['yhzp-v3-c135-p002-001', ['eacab015d50eda7933ff3cd2d2e13a73c9e37ff4214e10d818a41777e5e51f5f',
    ["性優游而仁慈寬大", [[qualifiedPattern('正官格')]]],
  ]],
  ['yhzp-v3-c135-p002-002', ['cbd2e001453fe37166609cba58d9bf344f2bf459b0b8387f09ee2de21a4dadc7',
    ["情性如虎，急躁如風", [[qualifiedPattern('七杀格')]]],
  ]],
  ['yhzp-v3-c135-p002-101', ['eb870984adada80e354043c1ff3100477cfd2efb94e7ecebba0017e92401313b',
    ["印綬主多智慧", [[qualifiedPattern('正印格')]]],
  ]],
  ['yhzp-v3-c135-p002-102', ['f590bcbd4988d8ac6b3d2d69e563869583208a8913ec15f2e2edc587f8fcfbbb',
    ["食神善能飮食，體厚謳歌", [[qualifiedPattern('食神格')]]],
  ]],
  ['yhzp-v3-c135-p002-104', ['a9371c82715d8678b78601dc890485c9e0442b8c8c9602feba174689f8cfe70b',
    ["六甲趨乾，主仁慈而剛介心平", [jiaApproachesHai]],
  ]],
  ['yhzp-v3-c151-p004-001', ['26f4a7b32c131829443925fd6e1a984921915ae8b9235b30660013547ba01871',
    ["傷官無財可恃，雖巧必貧", [[monthMainGod('伤官'), count('财星', 0)]]],
  ]],
  ['yhzp-v4-c068-p002-001', ['6b594ab3298d48edf15a1b6b1a19c14322cd86a4d8f66f7aa9fda8b3fcf9cf2e',
    ["逢殺而看印，遇印榮華", [[structure('杀印相生'), structure('印绶护身')]]],
  ]],
  ['yhzp-v4-c068-p008-001', ['3312212ffbb208110aac3b60ac8c22a6c698058ea49c315b00d35751943abe25',
    ["殺化爲印，早擢登科", [[structure('杀印相生')]]],
  ]],
  ['yhzp-v4-c068-p008-002', ['79e18822aa6c1eaa5d2cfb5af38282d4cb27f106f623435ad17ac902bb84674e',
    ["財旺生官，少年承業", [[qualifiedWealth, structure('财官相生')]]],
  ]],
  ['yhzp-v5-c002-p002-001', ['abb0893fa00a5d6470588c786626a23b9099b8e1bc3e622525ab139dd28e4e51',
    ["正官須在月中求，無破無傷貴不休", [{ required: [qualifiedPattern('正官格'), monthMainGod('正官'), count('伤官', 0)],
      mustBeAbsent: monthWithoutHarms }]],
  ]],
  ['yhzp-v5-c002-p004-001', ['4739a0b138609e0061566c7b049746ff1b029c4bc6c470c8852d91f960d93a6c',
    ["正官仁德性情純", [[qualifiedPattern('正官格')]]],
  ]],
  ['yhzp-v5-c012-p003-001', ['f8161c23e84985bd2136f9a1641bfc3b1fe12e303d4f8d47cf840148d284cc06',
    ["偏官有制化爲權，垂手登雲發少年", [[foodControlsKilling, strong]]],
  ]],
  ['yhzp-v5-c024-p008-001', ['aa6007e7835e5b2da88610c1b4d5615652a38f3199a4ca10ec0630d32d7c2603',
    ["重重生氣若無官，當作清高技藝看", [{ required: [vigor('印星'), count('官杀', 0)], anyOf: countOptions('正印', [2, 3, 4]) }]],
  ]],
  ['yhzp-v5-c053-p005-001', ['56dec52cab468a0cdf67a7df071b54465b661f5d8add78dabfc9e756d96bc1ac',
    ["凡見偏財遇刼星，田園破盡苦還貧", combined(godOn('偏财'), godOn('劫财')).filter(([first, second]) => first.position !== second.position)],
  ]],
  ['yhzp-v5-c071-p010-001', ['38e390db41a64fccc370dc30fdac9dfc0684952bf1cb793c8b15dcb18f5bde91',
    ["恃己凌人心好勝", [[monthMainGod('伤官'), count('官杀', 0)]]],
  ]],
  ['yhzp-v5-c375-p002-101', ['6a8eec2256225cb4019a500cf931e57409ceb2f0cd32b8f4962a03bd136ce3a1',
    ["比肩羊刃日時逢，若問年齡父道凶。", [[shen('day', '阳刃'), stemGod('hour', '比肩')]]],
  ]],
  ['yhzp-v2-c244-p002-002', ['55e8ee7558a59a1351b226c5aa4e6b1af845583ecbae58a3870979d031632dd7',
    ['反空亡耳。有一於此，官將不成，財將不住',
      [exposedIndirectWealthOnVoid, hiddenIndirectWealthOnVoid].map(name => [configuration(name)])],
  ]],
  ['yhzp-v3-c022-p002-001', ['f01a309001ad5267aaf7bc7f97696cc6462e4563e0eb3a1f5e48f135a48a9f6d',
    [null, [[woman, qualifiedWealth, structure('财官相生')]]],
  ]],
  ['yhzp-v3-c022-p002-002', ['d347af5a4f9b766cff47408f19494ecce8520d3c1ad237585a1287764c5df594',
    [null, [{
      required: [woman],
      anyOf: combined(...['财星', '正官', '正印'].map(anyPresence)),
    }]],
  ]],
  ['yhzp-v3-c087-p003-001', ['c5181f2bb720c0d5749a466bc11ead5c331322afe34092086854a0b599a99b3a',
    [null, [[configuration(yearMonthLoss), configuration(dayHourSupport)]]],
  ]],
  ['yhzp-v3-c087-p003-002', ['d091b7c75cf1e5ced216522c08442b0f6175ffcbd709e1ccab32688c64c3730a',
    [null, [[configuration(yearMonthSupport), configuration(dayHourLoss)]]],
  ]],
  ['yhzp-v3-c105-p002-002', ['5d842897758802e59786cb731c5baff395e95388cce0430a35c4b474196eec34',
    [null, wealth.map(god => [configuration(dayAndMonth(god))])],
  ]],
  ['yhzp-v3-c105-p005-001', ['d1399dc5375e33be33470d6b744863538a12b31c3a46378a1b3b215660571dce',
    [null, [{
      required: [man, count('财星', 0)],
      anyOf: combined(countOptions('官杀', [2, 3, 4]), anyPresence('正官'), anyPresence('七杀')),
    }]],
  ]],
  ['yhzp-v3-c146-p001-001', ['5d06bbb7b6b34ab73cadb050ce2840cd386661475727b4515876e6c138d424dc',
    [null, [[man, relation('六冲', 'year', 'month')]]],
  ]],
  ['yhzp-v3-c146-p001-002', ['2b7413efac3feb599e2cc57df8719479f4848791a029d05a41b40cfd8a4cc91a',
    ['如遇冲破提綱，定主離於祖業。', [{ required: [man], anyOf: monthClashes }]],
    ['再見空亡，三番四廢。', [{ required: [man, voidAt('month')], anyOf: monthClashes }]],
  ]],
  ['yhzp-v3-c146-p002-101', ['eecbc682bdffdab84b404e48b5456cf05565e811370265cd02d678c1d9d75143',
    [null, [{ required: [man], anyOf: countOptions('食神', [2, 3, 4]) }]],
  ]],
  ['yhzp-v4-c081-p012-001', ['ce3a1a77c55b20b04f4fc40ae826be62f277cc61dade73adb1649fa95ddbef2d',
    ['男犯興衰', [[man, configuration(fourCardinalBranches)]]],
    ['女犯孤獨', [[woman, configuration(fourCardinalBranches)]]],
  ]],
  ['yhzp-v3-c065-p002-001', ['241432a6050065de3dc60233c0062bc38189a6d20842de67c8d90f3f979c64d3',
    [null, [{ required: [stem('day', '甲')], anyOf: [
      [stem('month', '己'), union('month', 'day')],
      [stem('hour', '己'), union('day', 'hour')],
    ].flatMap(group => stemOn('乙').filter(([extra]) => extra.position !== group[0].position)
      .map(extra => [...group, ...extra])) }]],
  ]],
  ['yhzp-v3-c065-p002-002', ['0e1391375ed1498e1a75aecbda022c8b9a4d655f4c79f97b190a9e858ea443d3',
    [null, [{ required: [dayJiaEarth], anyOf: shown('戊') }]],
  ]],
  ['yhzp-v3-c065-p004-001', ['6719796c02d5e69814b27fa69e5ec42e5cb1436d4f2ff7b83708de6fc4ae95db',
    ['癸水旺兮田園漂蕩', [{ required: [dayGengMetal],
      anyOf: combined(shown('癸'), root('癸'), abundant('水')) }]],
    ['壬水盛兮財祿增遷', [{ required: [dayGengMetal],
      anyOf: combined(shown('壬'), root('壬'), abundant('水')) }]],
  ]],
  ['yhzp-v3-c065-p005-001', ['f60bfe3163b09aeb8a3da99941a522718f83c473fa236eaa37ffe10725cfabda',
    [null, [{ required: [dayTransformation('丙', '辛', '水')],
      anyOf: ['year', 'hour'].map(position => [pillar(position, '甲午')]) }]],
  ]],
  ['yhzp-v3-c065-p006-001', ['e5d24e6da6028ee2d642b41c8f336999a30089680c63fd53fa7796f7937ab4c1',
    ['富貴榮華，重重見乙', [{ required: [dayXinWater], anyOf: combined(shown('乙'), quantity('乙', 'any', 2)) }]],
    ['傷殘窮迫，疊疊逢丁', [{ required: [dayXinWater], anyOf: combined(shown('丁'), quantity('丁', 'any', 2)) }]],
  ]],
  ['yhzp-v3-c065-p007-001', ['825f038363fbf7817fb52a4e9e6f01f41b9870888ce484e5c95c4a8fea6abcdf',
    [null, [{ required: [dayTransformation('丁', '壬', '木')],
      anyOf: combined(shown('庚'), quantity('庚', 'any', 2)) }]],
  ]],
  ['yhzp-v3-c065-p008-001', ['78484cfbdc8428247df1261575502e00dc4029d3fe235298e01819e5c56bab7a',
    [null, [{ required: [dayRenWood], anyOf: shown('辛') }]],
  ]],
  ['yhzp-v3-c065-p008-002', ['a9928e1d7c4a23e9b0098a9c92320124924cbfdf123e0378ce6f982424204aab',
    [null, [{ required: [dayRenWood], anyOf: shown('癸') }]],
  ]],
  ['yhzp-v3-c065-p009-001', ['1bb72fb02dece0f6c8cd03e1a7a2d84f5d4a29671d4b5dce624b2ed1c5f4ddbe',
    [null, [{ required: [dayWuFire], anyOf: combined(shown('己'), root('己'), abundant('土')) }]],
  ]],
  ['yhzp-v3-c065-p009-002', ['3289a99cb956938e00b3ecf87585661a86c4eaa6e9287a2ef13416011cb5e84a',
    [null, [{ required: [dayGuiFire], anyOf: combined(shown('己'), root('己')) }]],
  ]],
  ['yhzp-v3-c087-p002-002', ['5d4b5cfe924ba1c0f8d478f401fcb65cf08351a9a8e922d471ba5ca7f85d799b',
    ['傷官用財者富', [[structure('伤官生财')]]],
  ]],
  ['yhzp-v3-c087-p004-001', ['06f45ee52fa4ec529aba18f524559949aaf1c84da579cb9636a2ae83586909ca',
    [null, wealth.map(tenGod => [{ kind: 'branch_main_ten_god', position: 'month', tenGod }])],
  ]],
  ['yhzp-v3-c087-p004-003', ['7e4a67d0a9ab80a810e23350cba2550f3e40dadf98ecf48457d4b06f7a61cd80',
    [null, [{ required: [vigor('七杀')], anyOf: combined(godOn('偏印'), [2, 3, 4].map(n => [count('偏印', n)])) }]],
  ]],
  ['yhzp-v3-c135-p002-004', ['77e954187b89e11cf9772e53aa9c7dce7551cb8d58a058e89d4851a1a4ce2486',
    [null, wealth.flatMap(godOn)],
  ]],
  ['yhzp-v3-c135-p002-005', ['c4f2a6d33db96232f8b02f222f60ebd9a1479362b883e25b274deb933ba33621',
    [null, ['庚辰', '壬辰', '戊戌', '庚戌'].map(ganZhi => [pillar('day', ganZhi)])],
  ]],
  ['yhzp-v3-c135-p002-007', ['eedaa8988dfa4583ca7b88a60dda8afa01863e9efa3a0063444138674dbb7c5d',
    [null, [[{ kind: 'bazi_natal_configuration', name: '天德月德俱见且印星实见' }, structure('印绶护身')]]],
  ]],
  ['yhzp-v4-c002-p004-001', ['05b0e12349b7815e426257c554421eda48ecc45527088d7e8bd7361ca995f05c',
    [null, [[strong, foodControlsKilling]]],
  ]],
  ['yhzp-v4-c002-p014-001', ['6b59728959e898b124087fd840c0d8c335a1f7f1ec8db33333b6eaf6d9d9c7c3',
    ['官星七殺落空亡，在九流任虚閒之職', [{ required: [voidAt('month')], anyOf: ['正官格', '七杀格'].map(name => [
      { kind: 'bazi_month_pattern', name, result: '见配合' },
    ]) }]],
  ]],
  ['yhzp-v4-c040-p006-002', ['7c6befed89067a533e5d0ffc0676153bbed6056643517be4261dfdbb0af34028',
    ['日逢空寡，其妻多致生離', [[man, voidAt('day'), shen('day', '寡宿')]]],
  ]],
  ['yhzp-v4-c081-p018-001', ['0be388fe26b6fd8253eadccd7cb1a8a9eb0cde3858e972d9e13f3ffd8e3bbf11',
    [null, [[structure('杀印相生'), structure('印绶护身')]]],
  ]],
  ['yhzp-v3-c004-p002-001', ['b66fbd20c5d5d3bb55f967b539743031f7c5e2005c94eca836e430e731a1178d',
    ["比肩重疊損嚴親", countOptions('比肩', [2, 3, 4])],
  ]],
  ['yhzp-v3-c031-p002-002', ['cbb958a579a505e052983154d5671e9096fd47d61435fe74d50185a5740eea02',
    ["時曰羊刃，本是凶神，旣不利於夫主之宮，兼損壞乎生平之性。", [[woman, shen('day', '阳刃'), shen('hour', '阳刃')]]],
  ]],
  ['yhzp-v3-c039-p002-002', ['a0d82c6dc4c554e50a502f6ccc038c176e2339ed00753e17c41409dca1024ce9',
    ["辰戌若相見，多是淫破人。", [{ required: [woman], anyOf: branchSet('辰戌') }]],
  ]],
  ['yhzp-v3-c105-p004-002', ['fd71806a193bd405549bbc6022992383ab09a49f463eaf89db8ec9c78171f074',
    ["八宇四馬總交馳，身榮勞碌任東西", [[configuration(fourHorseBranches)]]],
  ]],
  ['yhzp-v3-c125-p002-002', ['ed7daaf988daf965b0f3f4afb38e19190f403a26d0bd8e1a71241ff4f7ee05df',
    ["羊刃重重又見殺，大貴登科用", [[configuration(repeatedBladeWithKilling)]]],
  ]],
  ['yhzp-v3-c131-p002-002', ['8a6b8456956d599f9cf84f594bfd82ee0369a766a9d5f910a7ece5a60ecbd0c9',
    ["財壞印者，貧財卸職", [[structure('财星破印')]]],
  ]],
  ['yhzp-v3-c137-p009-001', ['1402c9bdd37e32ba8b58b893431f8c13ac78f877910eda7936e7906054ba13c9',
    ["印旺官生，聲名特逹", [[vigor('印星'), structure('官印相生')]]],
  ]],
  ['yhzp-v3-c151-p005-001', ['a2b16937ee3db99f4b50c8793ffde72299b35543b6c58f42e7aad7c354fb83bc',
    ["歸祿有財而獲福", [{ required: [shen('hour', '禄神')], anyOf: anyPresence('财星') }]],
    ["無財歸祿必須貧", [[shen('hour', '禄神'), count('财星', 0)]]],
  ]],
  ['yhzp-v4-c040-p003-001', ['e4a7d29938f8f6989fb497f3e563e503be258649b7992d46e9a32583bba1d4bb',
    ["印綬逢華，尊居翰苑", [[configuration(sealWithCanopy)]]],
  ]],
  ['yhzp-v4-c047-p004-002', ['dd3af44e09aff393935e5124b1c5de81a15c3c88bee5ec87307fcefa9d171175',
    ["時值偏財，家富又添好業", [[configuration(hourWealth)]]],
  ]],
  ['yhzp-v4-c053-p004-002', ['d1cac94cb21cfb4163cacb21424d21f39bcb07e1f26db8e19de71b75b149e0aa',
    ["印綬在刑冲之内，心亂", [[configuration(sealUnderClash)]]],
  ]],
  ['yhzp-v4-c068-p008-003', ['db4f41c0c2b1468d075c6a189d0fa0ca0ac8731b093adc2303a0fcf7d60baeb2',
    ["月財若透，刼奪，一生貧困", [[configuration(monthWealthWithRobbery)]]],
  ]],
  ['yhzp-v4-c077-p004-001', ['5af98574ab66e0221df3b39d0f320824a5d032c03e475f452d96d8a9ca3585b0',
    ["木生春令逢傷食，田宿文場義理深", [[configuration(springWoodWithOutput)]]],
  ]],
  ['yhzp-v4-c081-p017-001', ['6d6a533e04a8acceee4da62cac7a2281518424cec1ed960fba98c2ba43e3f25e',
    ["若遇財官，反成富貴", [{
      required: [structure('财官相生')],
      anyOf: ['甲辰', '乙巳', '丙申', '丁亥', '戊戌', '庚辰', '辛巳', '壬申', '癸亥'].map(value => [pillar('day', value)]),
    }]],
  ]],
  ['yhzp-v5-c002-p007-001', ['95cd19fed2d89ef90f104e7e78dbefd0abd034cec25496635d7d4de5c242e680',
    ["辛日透丙月逢寅，格中返化發財根", [[stem('day', '辛'), branch('month', '寅'), ...quantity('丙', 'visible', 1, 1)[0]]]],
  ]],
  ['yhzp-v5-c060-p011-001', ['39a842152147d9409bd874e5f210d9041773c810fffc8f1b5bf83c505cab7cc9',
    ["申時戊日食神奇，惟在秋冬福祿齊", [{ required: [stem('day', '戊'), pillar('hour', '庚申')], anyOf: autumnWinterMonths }]],
  ]],
  ['yhzp-v5-c071-p006-001', ['8d5e8f07b775d6a5990d3a56d395fc0dff51db8641e1a68aaf4c1720bc8d2c71',
    ["生在秋冬方秀氣", [{ required: [stem('day', '辛'), pillar('hour', '壬辰')], anyOf: autumnWinterMonths }]],
    ["生於四季主財豊", [{ required: [stem('day', '辛'), pillar('hour', '壬辰')], anyOf: seasonalEarthMonths }]],
  ]],
  ['yhzp-v5-c196-p003-001', ['878698bbd5919b89638d7bd0bafdc95aa2840cc9088eb2196e75cd49e8170212',
    ["日干癸水時庚申，年在秋冬富貴人", [{
      required: [stem('day', '癸'), pillar('hour', '庚申')],
      anyOf: autumnWinterMonths,
      mustBeAbsent: positions.map(position => branch(position, '寅')),
    }]],
  ]],
  ['yhzp-v5-c218-p007-001', ['28210cf8a88b9703ef5c74f988ef5cbd3d70bdfb02dec9a2a2d683ad8ade7ff5',
    ["壬辰日又見辰時，年月辰多最是奇。", [[pillar('day', '壬辰'), pillar('hour', '甲辰'), branch('year', '辰'), branch('month', '辰')]]],
    ["四柱若逢寅位上，發財發福兩相宜", [{
      required: [pillar('day', '壬辰'), pillar('hour', '甲辰')],
      anyOf: [[branch('year', '寅')], [branch('month', '寅')]],
    }]],
  ]],
  ['yhzp-v5-c236-p002-001', ['222077e11e00a665212aa891f787dc73565c1a5f3844444df7cd6e7c2cb5871d',
    ["歸祿逢財名利全，干頭不忌透財源。", [[shen('hour', '禄神'), configuration(visibleWealth)]]],
  ]],
  ['yhzp-v5-c236-p007-001', ['382c46ba3ef5766814c569e76c4c74dc1ef09a948327d74bb8271bcedfd08343',
    ["四柱無冲官不至，少年平步上雲梯", [{
      required: [shen('hour', '禄神'), count('官杀', 0)],
      mustBeAbsent: pairs.map(([first, second]) => relation('六冲', first, second)),
    }]],
  ]],
  ['yhzp-v5-c302-p002-001', ['158b03c67871f47f46e4ca994673c3421c858f16985caddeabadf12c6fc68873',
    ["陰土逢蛇金與牛，名爲福德虢貔貅", [[stem('day', '己'), configuration(goldTrineBranches)]]],
  ]],
  ['yhzp-v5-c302-p003-001', ['80b78c0819494bed323f78122303be575d136a13d028d8e46f133dbf550ed5e0',
    ["更兼名利多成敗，\n破耗荒淫祿不昌。", [[stem('day', '丁'), branch('month', '丑'), configuration(goldTrineBranches)]]],
  ]],
  ['yhzp-v5-c302-p008-001', ['c3589e78335f315ce06b86d9331576699d4545d27db8577cdeb13e6554cbcd9d',
    ["陰木加臨丑酉蛇，生居六月暗咨嗟。爲官得祿難長久，縱有文章不足誇", [[stem('day', '乙'), branch('month', '未'), configuration(goldTrineBranches)]]],
  ]],
  ['yhzp-v5-c333-p007-001', ['fbfed495312a14d842deac66141d4694eaf3dc6d330b73d34bcf2dad28901022',
    ["己巳重逢命裏排，一身天祿暗催來。人中必顯名尊貴，秀奪江山出類才", [positions.map(position => pillar(position, '己巳'))]],
  ]],
  ['yhzp-v5-c333-p011-001', ['bc5e3b691d556cf4047e1d7bf3841e33c1480545bd3ce5e0eb83049593ae8576',
    ["乙酉生居八月天，重重乙酉喜相連。不居左右皆榮顯，更有收成在晚年", [positions.map(position => pillar(position, '乙酉'))]],
  ]],
  ['yhzp-v5-c422-p003-001', ['ee66ffe8d641ffb72ff86a04cbf578af954b5386e246e19a37d56e96ce820b5e',
    ["女命傷官福不真，無財無印守孤貧", [{ required: [woman, count('财星', 0), count('印星', 0)], anyOf: anyPresence('伤官') }]],
  ]],
  ['yhzp-v1-c333-p009-001', ['71a19b31d1a937085e1c03aea91a8e5c25ae76fcce735a27b490d2152bbd4682',
    ["財多主旺則稱意", [{ required: [strong], anyOf: countOptions('财星', [2, 3, 4]) }]],
    ["若干衰則反禍矣", [{ required: [weak], anyOf: countOptions('财星', [2, 3, 4]) }]],
  ]],
  ['yhzp-v1-c333-p010-001', ['b4950761edf07b7b97063e5ed7ce435ecf25a876f101fc2d1c33dab9256b1a1f',
    ["干與支同損財傷妻", [[configuration(sameDayElement)]]],
  ]],
  ['yhzp-v1-c351-p005-001', ['290315124c8fad2c671e111b516004d22c45e4c0900386ace696bf4df54ff89f',
    ["若乃時逢七殺見之未必爲凶月制干强其殺反爲權印", [[strong, configuration(hourKillingControlledByMonth), foodControlsKilling]]],
  ]],
  ['yhzp-v2-c217-p002-001', ['d652faefa802f7cd1579738ce113d7ba20914b1047396eeceaa181ba2fc93fdd',
    ["及于年月時干，皆有官星隱露，恐福渺矣", [[configuration(officerAcrossYearMonthHour)]]],
  ]],
  ['yhzp-v2-c217-p003-001', ['8226b349764a8c06b5238a3a65e02b22d1922076b3a232f77be05a16747ac556',
    ["大率官星須得印綬，身旺則發", [[qualifiedPattern('正官格'), strong, structure('官印相生')]]],
  ]],
  ['yhzp-v2-c225-p002-001', ['536c2dc44d32a10e92cd8b1b0eb9cf92c228d03c65f13554b61f8212c33a2aaf',
    ["多有巨富大貴之人，惟其身旺合殺爲妙", [{
      required: [stem('day', '甲'), strong],
      anyOf: visibleStemPairWithHour('乙', '庚'),
    }]],
  ]],
  ['yhzp-v2-c230-p004-001', ['6b2815c78143022ef6cde6583b077e9217a9654183d7ddc37356aba94559ce42',
    ["先論月氣之後有生氣，必得父毋之力；", [[hiddenSealAtGrowth('month')]]],
    ["年下有生氣，必得祖宗之力；", [[hiddenSealAtGrowth('year')]]],
    ["有時上見之，有生氣，必得子孫之力", [[hiddenSealAtGrowth('hour')]]],
  ]],
  ['yhzp-v2-c230-p005-001', ['667c937f0b3fcd3de0e5946bf5ad287f03e75261ad8188a1779be8298269feef',
    ["如帶印綬，須帶官星，謂之官印兩全，必爲貴命。", [[structure('官印相生')]]],
  ]],
  ['yhzp-v2-c250-p002-001', ['d4224a1a837b8222669e29c72070b02c08c91b08adc8abafa5a524c225a34856',
    ["作事進退悔懶，有始無終，財源屢成屢敗", jiaWithBingAndRen],
  ]],
  ['yhzp-v2-c252-p002-001', ['f9bd80d2e4c8563014af76f244eaf105effcac4b49b0330f86ccb3960405a58e',
    ["傷官主人多才藝，傲物氣高，常以天下之人不如己", [[qualifiedPattern('伤官格')]]],
  ]],
  ['yhzp-v2-c252-p004-001', ['eec50b6d339acd1de6b011d0a85fe648f9b87466a930eb17dbe9ab3c8b102816',
    ["四柱中雖傷盡官星，身雖旺，若無一點財氣，只爲貧薄", [{ required: [strong, count('官杀', 0), count('财星', 0)], anyOf: anyPresence('伤官') }]],
  ]],
  ['yhzp-v2-c252-p006-002', ['838496dff4476103fab027c99f005bf55f33421bacf8f4e2b996f74ae90fbb47',
    ["曰帶傷官，妻妾不完", [[configuration(dayBranchHurtingOfficer)]]],
  ]],
  ['yhzp-v2-c263-p002-001', ['e3f85259b1f45e9bbf126504b515b8a48b5fc57516662ec5deb16e69adb84af5',
    ["刃殺俱全，非常人有之", [[configuration(bladeWithKilling), strong]]],
  ]],
  ['yhzp-v2-c273-p002-001', ['b0993d1eb7cf279c80b6a4d00678bbb2427fc59586638583c14a15d11cbe44de',
    ["大扺日德主人性格慈善", [{
      required: [count('正官', 0)],
      anyOf: reviewedDayVirtues.map(value => [pillar('day', value)]),
      mustBeAbsent: [...dayWithoutHarms, ...nonDayKuiGang, voidAt('day'), qualifiedWealth],
    }]],
  ]],
  ['yhzp-v2-c275-p002-001', ['63e9fe97590962abea30c2285c729e6417129fc92e13321099c6b30ac0435683',
    ["性剛果毅", [{ required: [configuration(bladeWithKilling)], anyOf: ['戊午', '丙午', '壬子'].map(value => [pillar('day', value)]), mustBeAbsent: [...dayWithoutHarms, ...dayHarmonies] }]],
  ]],
  ['yhzp-v2-c277-p002-002', ['fc7012ae07ece8d53080993b11c9d6e5bd1158344ffe9958f7c451234ccd06a0',
    ["倘日獨處冲者大衆，必是小人，刑責不已，窮必徹骨", kuiGangDays.map(value => ({
      required: [pillar('day', value)],
      // For 庚戌 and 壬辰, a clashing hour would itself be another 魁罡.
      anyOf: ['庚戌', '壬辰'].includes(value) ? doubleDayClashes.slice(0, 1) : doubleDayClashes,
      mustBeAbsent: nonDayKuiGang,
    }))],
  ]],
  ['yhzp-v2-c291-p002-001', ['4bd48be6cb34ec10356f650062edb35acdc65a8c807983222662ce13dd85a388',
    ["爲人性重，剛執不屈。", [{ required: [configuration(monthKilling), strong], mustBeAbsent: monthClashes.flat() }]],
  ]],
  ['yhzp-v2-c296-p004-001', ['64d2eff509b0c0f25fc1ea20c4987402f8f4f3ed194a6922bc8cf53617d88d5f',
    ["只要時上一位不要多，而三處不要再見財，𨚫怕冲", [{ required: [configuration(hourStemIndirectWealth), count('财星', 1)], mustBeAbsent: hourClashes }]],
  ]],
  ['yhzp-v2-c301-p002-001', ['ce2a0bdcbdaffb5c489893435de13559c1104be5259ff7d2cf31815a3041fc8f',
    ["夫一位貴者，惟只時上只見一位方爲貴。", [[configuration(hourStemKilling), count('七杀', 1)]]],
    ["或年月日又有，反爲辛苦勞役之人也。", [{ required: [configuration(hourStemKilling)], anyOf: countOptions('七杀', [2, 3, 4]) }]],
  ]],
  ['yhzp-v2-c301-p002-002', ['15e4a95905c6fa62d9910048884529ad81237bf7e023ff66cad20b36202706b3',
    ["時偏官爲人性重，剛執不屈", [[configuration(hourStemKilling)]]],
    ["月偏官多者亦然。", [{ required: [configuration(monthKilling)], anyOf: countOptions('七杀', [2, 3, 4]) }]],
  ]],
  ['yhzp-v2-c326-p002-001', ['be109b8e55f7c50a98e36092d84304768aad08f56999a09ce25f813ee8104d42',
    ["此格以辰多者貴", [[pillar('day', '壬辰'), configuration(repeatedChenOutsideDay)]]],
    ["寅多者富", [[pillar('day', '壬辰'), ...visible.map(position => branch(position, '寅'))]]],
  ]],
  ['yhzp-v2-c363-p002-001', ['77db753dc7890641475ddc1e87b88bf78568a0b4b76070a81831925025605e60',
    ["火爲文明之象", [{ required: [configuration(fireBranches), strong], anyOf: [...'丙丁'].map(value => [stem('day', value)]) }]],
  ]],
  ['yhzp-v2-c373-p003-001', ['e21d4a7c367594488ccb8cfc5be8e77026660e310652b01e3867db9536019ca1',
    ["深有培養之功，主人多信，人品重厚豊肥", [{ required: [configuration(earthVaults)], anyOf: [...'戊己'].map(value => [stem('day', value)]) }]],
  ]],
  ['yhzp-v2-c377-p002-001', ['aacdaae16708aaeb493084d441355e63afabd439bbfb6a745cc62a63bc01d264',
    ["木賴水生，故從其類，主人多仁", [{ required: [configuration(woodBranches), element('水'), absentStem('庚'), absentStem('辛')], anyOf: [...'甲乙'].map(value => [stem('day', value)]) }]],
  ]],
  ['yhzp-v2-c389-p002-001', ['c483575871fe38aa1b131fc7fd9e307294e846598337df546b1876b854ac054a',
    ["若干頭有庚辛，則藉庚辛爲權，火制之爲福", fireControlledMetalCases],
  ]],
  ['yhzp-v2-c391-p002-001', ['cd3f366d6d372020ae15d294f11600f887fd543484d2964456ff56cdefd4ecda',
    ["七殺有制，則祖上曾有要𥋏也", [[stem('day', '甲'), stem('year', '庚'), foodControlsKilling]]],
  ]],
  ['yhzp-v2-c393-p002-001', ['250747da02e063f0354dff7efb1648f09c8640bfe6f220acef9bf293a46f692b',
    ["若財命有氣，則主其人得祖上物業", [{ required: [stem('day', '甲'), strong, qualifiedWealth], anyOf: [...'戊己'].map(value => [stem('year', value)]) }]],
  ]],
  ['yhzp-v3-c015-p001-001', ['fbb898fbbd3734ec261e32157c46440c68de9bede4bf93b9f77bd483916fad04',
    ['如印長生', visible.flatMap(position => withOwnPhase(position, '正印', ['长生']))],
  ]],
  ['yhzp-v3-c016-p002-001', ['adddc0b23aefc61001daf28dc19cc7a60df18d16f7a428ebcf64e5afb46b4290',
    ['日下月下坐財者，主妻多内助，更得妻財', [{
      required: [man],
      anyOf: wealth.flatMap(dayGod => wealth.map(monthGod => [mainGod('day', dayGod), mainGod('month', monthGod)])),
    }]],
  ]],
  ['yhzp-v3-c016-p002-004', ['c97a764fa4d40048b26d8674acea92bc96e29e7af14b31e142404ed9b98959d9',
    ['財衰敗墓絶', [{ required: [man], anyOf: visible.flatMap(position =>
      wealth.flatMap(god => withOwnPhase(position, god, ['衰', '沐浴', '墓', '绝']))) }]],
  ]],
  ['yhzp-v3-c020-p002-003', ['c775fe6c6f6d144d9621d6db02bad11ba324942faab380f5029f460383966028',
    ['若見印綬梟神', [[woman, structure('枭印夺食')]]],
  ]],
  ['yhzp-v3-c022-p003-001', ['3d5543851a94ecca02fe0fa3737937819c5529666c7d9e9738a0c81d5fb214a9',
    ['傷官，主人聰明美貌秀氣。', [{ required: [woman], anyOf: godOn('伤官') }]],
  ]],
  ['yhzp-v3-c022-p004-001', ['91808851c19640895a7725d04aff89816cf0013fe3120fcc40ee1d123a903e20',
    ['七殺正官，只要一位者良', [{
      required: [woman, count('官杀', 1)],
      anyOf: [[count('正官', 1), count('七杀', 0)], [count('七杀', 1), count('正官', 0)]],
    }]],
  ]],
  ['yhzp-v3-c037-p002-001', ['6e57cd9eb5fab5bd25d0fbe3c06e3dea726cf664c9b5d787a16b9fa4fd7904ab',
    ['咸池遇馬', [{ required: [woman], anyOf: distinctPresence('桃花', '驿马') }]],
  ]],
  ['yhzp-v3-c125-p004-001', ['b517fbffa3e3e39ba9423e49a9cab19e10bfe3133c1f397b7f4e6be6ec5feae5',
    ['生逢貴人，值孤寡', positions.map(position => ({
      required: [shen(position, '天乙贵人')],
      anyOf: distinctPresence('孤辰', '寡宿', positions.slice(1)),
    }))],
  ]],
  ['yhzp-v3-c125-p005-101', ['f3fe2acf1a4a11444178019e864b678794c0d238f6e4398c5b2b65b4761848cd',
    ['時遇官星生旺位', withOwnPhase('hour', '正官', ['长生', '帝旺'])],
  ]],
  ['yhzp-v3-c125-p006-001', ['f99c0ff2a53967334c20daaf5b4ba0e351d421b59084a76ffd6e41bad7672244',
    ['官藏煞見，有制伏，亦自煇煌', [{
      required: [foodControlsKilling],
      anyOf: positions.flatMap(position => godOn('七杀').map(([killing]) => [branchGod(position, '正官'), killing])),
      mustBeAbsent: godOn('正官').flat(),
    }]],
  ]],
  ['yhzp-v3-c137-p002-101', ['5c6496ec398e6368a4aeddd79a97a653c9a4619ad099d2775ac1fe9843a3657d',
    ['男逢比刼，傷官', [{
      required: [man],
      anyOf: anyPresence('比劫').flatMap(peer => anyPresence('伤官').map(output => [...peer, ...output])),
    }]],
    ['女犯傷官偏印', [{
      required: [woman],
      anyOf: anyPresence('伤官').flatMap(output => anyPresence('偏印').map(seal => [...output, ...seal])),
    }]],
  ]],
  ['yhzp-v3-c146-p002-003', ['916c1c9334b6a9e7cf76fff64b88acef45a41ef517c992b0bbd9c65612ad3bcf',
    ['比肩逢祿，兄弟名高', ['year', 'month'].map(position => [stemGod(position, '比肩'), shen(position, '禄神')])],
  ]],
]);

export function compileYuanhaiNatalPassages(claim) {
  const additional = reviewedAdditional.get(claim.id);
  const spec = additional ?? reviewed.get(claim.id);
  if (!spec) return undefined;
  const [expected, ...passages] = spec;
  const { source, conditions, evidence } = claim;
  const digest = createHash('sha256').update(JSON.stringify({ source, conditions, evidence })).digest('hex');
  const containsUnverifiedExcerpt = passages.some(([text, , { fromContext = false } = {}]) => {
    const excerptSource = fromContext ? evidence.context : evidence.original_text;
    return text && (typeof excerptSource !== 'string' || !excerptSource.includes(text));
  });
  if (expected !== digest || containsUnverifiedExcerpt) {
    return { reason: 'source_review_required',
      reviewNote: additional ? '本条《渊海子平》的出处、原文或条件已变，须重新核对。'
        : '《渊海子平》继善篇或碧渊赋的出处、原文或条件已变，须重新核对。' };
  }
  const branches = passages.map(([text, groups]) => ({
    text,
    conditionCompiler: yuanhaiNatalPassagesProfile,
    inputs: groups.map(group => normalizeRuleInput('bazi', Array.isArray(group) ? { required: group } : group)),
  }));
  if (!branches[0].text) return { compiler: yuanhaiNatalPassagesProfile, inputs: branches[0].inputs };
  const condition = additional ? '按《渊海子平》本条已核本命条件分句取材' : '按《渊海子平》两篇已核本命条件分句取材';
  return { reason: 'unmapped_condition', condition, branches };
}
