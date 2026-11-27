import { LunarUtil } from 'lunar-javascript';
import { analyzeBaZi } from '../../control/bazi-analysis.ts';
import { baziNoblemanBranches, baziPillars, baziStemPhase, describeBaZiPillars, detailsFromKnownBaZiPillars, isBaZiPillar } from '../../control/charts.ts';
import { baziClassicalStructureFacts } from './bazi-classical-structures.mjs';
import { yuanhaiPillarGroupFacts } from './yuanhai-natal-passages.mjs';
import { shenfengReviewedFacts } from './bazi-shenfeng-reviewed.mjs';

const skyVirtueByMonth = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲',
  申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
const moonVirtueByTrine = { 寅午戌: '丙', 亥卯未: '甲', 申子辰: '壬', 巳酉丑: '庚' };
const virtueAndTalentByTrine = {
  寅午戌: ['丙丁', '戊癸'], 申子辰: ['壬癸戊己', '丙辛甲己'], 巳酉丑: ['庚辛', '乙庚'], 亥卯未: ['甲乙', '丁壬'],
};
const earthlyBranches = '子丑寅卯辰巳午未申酉戌亥';
const principalTerms = ['大寒', '雨水', '春分', '谷雨', '小满', '夏至', '大暑', '处暑', '秋分', '霜降', '小雪', '冬至'];
const heavenlyStems = '甲乙丙丁戊己庚辛壬癸';
const lonerTargets = { 寅卯辰: ['巳', '丑'], 巳午未: ['申', '辰'], 申酉戌: ['亥', '未'], 亥子丑: ['寅', '戌'] };
const robberyByYearTrine = { 申子辰: '巳', 寅午戌: '亥', 巳酉丑: '寅', 亥卯未: '申' };
const lostSpiritByYearTrine = { 申子辰: '亥', 寅午戌: '巳', 巳酉丑: '申', 亥卯未: '寅' };
const yangBlade = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };
const nayinGrowthStarts = { 木: '亥', 火: '寅', 土: '申', 金: '巳', 水: '申' };
const yearSealVault = { 金: '乙丑', 木: '癸未', 火: '甲戌', 水: '壬辰', 土: '丙辰' };
const controlledElement = { 木: '土', 火: '金', 土: '水', 金: '木', 水: '火' };
const generatedElement = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
const branchElements = '水土木木土火火土金金土水';
const vigorousPhases = ['长生', '临官', '帝旺'];
export const calculatedClaimShenSha = ['空亡', '桃花', '天德', '月德', '孤辰', '寡宿', '阳刃', '劫煞', '亡神', '官符', '元辰', '勾神', '绞神', '天罗', '地网', '丧门', '吊客'];
export const verifiedNatalShenSha = ['天乙贵人', '文昌贵人', '禄神', '驿马', '将星', '华盖'];
export const genderedClaimShenSha = ['元辰', '勾神', '绞神'];
export const tenGodStrengthGroups = {
  财星: ['正财', '偏财'], 官星: ['正官'], 官杀: ['正官', '七杀'], 七杀: ['七杀'],
  正财: ['正财'], 偏财: ['偏财'], 印星: ['正印', '偏印'], 比劫: ['比肩', '劫财'],
  食神: ['食神'], 伤官: ['伤官'], 食伤: ['食神', '伤官'],
};
const measuredTenGodGroups = {
  官星: tenGodStrengthGroups.官星, 财星: tenGodStrengthGroups.财星,
  印星: tenGodStrengthGroups.印星, 伤官: tenGodStrengthGroups.伤官, 劫财: ['劫财'],
};

function nayinPhase(element, branch) {
  const distance = earthlyBranches.indexOf(branch) - earthlyBranches.indexOf(nayinGrowthStarts[element]);
  return LunarUtil.CHANG_SHENG[(distance + 12) % 12];
}

export function analyzeConfirmedBaZi(facts) {
  const pillars = {};
  for (const position of baziPillars) {
    const candidates = new Set(facts.filter((fact) => fact.kind === 'pillar' && fact.position === position).map(({ ganZhi }) => ganZhi));
    const [value] = candidates;
    if (candidates.size !== 1 || !isBaZiPillar(value)) return null;
    pillars[position] = value;
  }
  return analyzeBaZi(describeBaZiPillars(pillars));
}

export function baziDayMasterStrengthConsensus(facts) {
  // Unknown time can still yield a stable assessment. Enumerate all twelve
  // legal hour pillars for the confirmed day; never invent a single birth hour.
  if (facts.some(fact => fact.kind === 'pillar' && fact.position === 'hour')) return [];
  const pillars = {};
  for (const position of ['year', 'month', 'day']) {
    const values = new Set(facts.filter(fact => fact.kind === 'pillar' && fact.position === position).map(fact => fact.ganZhi));
    if (values.size !== 1 || !isBaZiPillar([...values][0])) return [];
    pillars[position] = [...values][0];
  }
  const startStem = (heavenlyStems.indexOf(pillars.day[0]) % 5) * 2;
  const results = new Set([...earthlyBranches].map((branch, index) => {
    const hour = heavenlyStems[(startStem + index) % 10] + branch;
    return analyzeBaZi(describeBaZiPillars({ ...pillars, hour })).L2.assessments.dayMasterStrength.result;
  }));
  return results.size === 1 ? [{ kind: 'day_master_strength', result: [...results][0], profile: 'monthly-weighted-strength-v1' }] : [];
}

function distinctNobleBranches(stems, branches) {
  if (!stems.length) return true;
  const supporting = baziNoblemanBranches(stems[0]);
  return branches.some((branch, index) => supporting.includes(branch) &&
    distinctNobleBranches(stems.slice(1), branches.filter((_, other) => index !== other)));
}

function floatingShaPalace(year, month, hour, previousQi) {
  // 《三命通会》卷二安命法从子逆起正月，生时顺推至卯。按《命理探源》，过中气用次月。
  const monthIndex = principalTerms.indexOf(previousQi);
  const monthBranchIndex = earthlyBranches.indexOf(month);
  const monthsSinceQi = (monthBranchIndex - monthIndex + 12) % 12;
  if (monthIndex < 0 || (monthsSinceQi !== 1 && monthsSinceQi !== 2)) return null;
  const lifeBranch = (3 - monthIndex - earthlyBranches.indexOf(hour) + 24) % 12;
  // 《五行精纪》浮沉从戌逆数到生年，由命宫逆布十二宫。财帛第二，田宅第四。
  const starBranch = (10 - earthlyBranches.indexOf(year) + 12) % 12;
  const palaceOffset = (lifeBranch - starBranch + 12) % 12;
  if (palaceOffset === 1) return '财帛宫';
  if (palaceOffset === 3) return '田宅宫';
  return null;
}

export function baziClaimFacts({ L1, L2 }, gender, fetalMonth, previousQi) {
  const month = L1.monthCommand.branch.name;
  const yearPillar = L1.pillars[0];
  const [, , dayPillar, hourPillar] = L1.pillars;
  const hasFortuneStar = (hits) => hits.some(({ name }) => ['天乙贵人', '禄神', '驿马'].includes(name));
  const fetalStars = fetalMonth ? detailsFromKnownBaZiPillars({ year: yearPillar.ganZhi, day: dayPillar.ganZhi, month: fetalMonth }, 'month').shenSha : [];
  const favorsMonthAndFetalMonth = hasFortuneStar(L1.pillars[1].shenSha) && hasFortuneStar(fetalStars)
    && !hasFortuneStar(dayPillar.shenSha) && !hasFortuneStar(hourPillar.shenSha);
  const year = yearPillar.branch.name;
  const floatingSha = floatingShaPalace(year, month, hourPillar.branch.name, previousQi);
  const yearIndex = earthlyBranches.indexOf(year);
  const fromYear = (steps) => earthlyBranches[(yearIndex + steps + 12) % 12];
  const yearIsYang = heavenlyStems.indexOf(yearPillar.stem.name) % 2 === 0;
  const direction = gender ? (yearIsYang === (gender === '男') ? 1 : -1) : 0;
  const skyVirtue = skyVirtueByMonth[month];
  const moonVirtue = Object.entries(moonVirtueByTrine).find(([group]) => group.includes(month))?.[1];
  const hasSkyVirtue = L1.pillars.some(({ stem, branch }) => stem.name === skyVirtue || branch.name === skyVirtue);
  const hasMoonVirtue = L1.pillars.some(({ stem }) => stem.name === moonVirtue);
  const [loner, widow] = Object.entries(lonerTargets).find(([group]) => group.includes(year))[1];
  const robbery = Object.entries(robberyByYearTrine).find(([group]) => group.includes(year))[1];
  const lostSpirit = Object.entries(lostSpiritByYearTrine).find(([group]) => group.includes(year))[1];
  const blade = yangBlade[L1.dayMaster.stem.name];
  const luIndex = [...earthlyBranches].findIndex((branch) => baziStemPhase(yearPillar.stem.name, branch) === '临官');
  const carriageBranch = earthlyBranches[(luIndex + 2) % 12];
  const { fiveElementStrength, dayMasterStrength, climate } = L2.assessments;
  const pointsForTenGods = members => fiveElementStrength.contributions.reduce((sum, contribution) =>
    sum + (members.includes(contribution.tenGod) ? contribution.points : 0), 0);
  const stemGeneration = L1.pillars.slice(1).every((pillar, index) =>
    generatedElement[L1.pillars[index].stem.element] === pillar.stem.element);
  const indirectSealInGeneratingPillar = L1.pillars.some(({ stem, branch, tenGod, hiddenStems }) =>
    (tenGod === '偏印' || hiddenStems[0].tenGod === '偏印')
    && (generatedElement[stem.element] === branch.element || generatedElement[branch.element] === stem.element));
  const killingPoints = fiveElementStrength.contributions.filter(({ tenGod }) => tenGod === '七杀')
    .reduce((total, { points }) => total + points, 0);
  const balancedKilling = Math.min(killingPoints, dayMasterStrength.supportScore) * 5 >= dayMasterStrength.total
    && Math.abs(killingPoints - dayMasterStrength.supportScore) * 10 <= dayMasterStrength.total;
  const stemPlacementCounts = [...heavenlyStems].flatMap(stem => {
    const visible = L1.pillars.filter(pillar => pillar.position !== 'day' && pillar.stem.name === stem);
    const hidden = L1.pillars.filter(pillar => pillar.hiddenStems.some(hiddenStem => hiddenStem.name === stem));
    const present = new Set([...L1.pillars.filter(pillar => pillar.stem.name === stem), ...hidden]);
    return Object.entries({
      visible: visible.length, hidden: hidden.length, any: present.size,
      non_day: [...present].filter(pillar => pillar.position !== 'day').length,
    }).map(([placement, count]) => ({ kind: 'bazi_stem_placement_count', stem, placement, count }));
  });
  const seasonalBalance = fiveElementStrength.elements.find(({ element }) => element === L1.dayMaster.stem.element);
  const nayinElements = L1.pillars.map(({ ganZhi }) => LunarUtil.NAYIN[ganZhi].at(-1));
  const threeWealth = [yearPillar.stem.element, yearPillar.branch.element, nayinElements[0]]
    .map((element) => controlledElement[element]);
  const shenShaNames = new Set(L1.pillars.flatMap(({ shenSha }) => shenSha.map(({ name }) => name)));
  const horsePositions = new Set(L1.pillars.filter(({ shenSha }) => shenSha.some(({ name }) => name === '驿马'))
    .map(({ position }) => position));
  const completeBranchRelations = L2.stemBranchRelations.branches.filter(({ state }) => state === 'complete');
  const academyWithHorses = nayinPhase(nayinElements[0], dayPillar.branch.name) === '长生'
    && completeBranchRelations.some(({ type, positions }) => type === '六冲' && positions.every((position) => horsePositions.has(position)))
    && completeBranchRelations.some(({ type, positions }) => type === '六合' && positions.some((position) => horsePositions.has(position)));
  const stemUnions = L2.stemBranchRelations.stems.filter(({ combination }) => combination === '五合');
  const exposedOfficers = L1.pillars.filter(({ position, tenGod }) => position !== 'day' && tenGod === '正官');
  const unionSeats = new Set([
    ...stemUnions,
    ...completeBranchRelations.filter(({ type }) => type === '六合'),
  ].map(({ positions }) => positions.join(':')));
  const contestsStemUnion = L1.pillars.some(({ position }) => stemUnions.filter(({ positions }) => positions.includes(position)).length >= 2);
  const hasNatalPeachBlossom = L1.pillars.some(({ shenSha }) => shenSha.some(({ name, sourcePillars }) =>
    name === '桃花' && sourcePillars.includes('year')));
  const hasShenShaAndHarmony = ['禄神', '驿马', '天乙贵人'].every((name) => shenShaNames.has(name))
    && L2.stemBranchRelations.branches.some(({ type, state }) => type === '六合' && state === 'complete');
  const harmCount = L2.stemBranchRelations.branches.filter(({ type, state }) => type === '六害' && state === 'complete').length;
  const natalNayin = nayinElements[0];
  const natalBranches = L1.pillars.map(({ branch }) => branch.name);
  // 《三命通会》以年柱顺五辰为宅，逆五辰为田。起位沿六十甲子同时移干、支。
  const home = fromYear(5);
  const field = fromYear(-5);
  const homeStem = heavenlyStems[(heavenlyStems.indexOf(yearPillar.stem.name) + 5) % 10];
  const homeNayin = LunarUtil.NAYIN[homeStem + home].at(-1);
  const yearVoid = LunarUtil.getXunKong(yearPillar.ganZhi);
  const yearNobles = baziNoblemanBranches(yearPillar.stem.name);
  const fieldElement = branchElements[earthlyBranches.indexOf(field)];
  const fieldSeason = fiveElementStrength.elements.find(({ element }) => element === fieldElement)?.season;
  const dayNayin = nayinElements[2];
  const stemElements = L1.pillars.map(({ stem }) => stem.element);
  const woodFireEarthHitByClash = [0, 1].some(start => {
    if (stemElements.slice(start, start + 3).join('') !== '木火土') return false;
    const outside = L1.pillars[start === 0 ? 3 : 0].position;
    return completeBranchRelations.some(({ type, positions }) => type === '六冲' && positions.includes(outside));
  });
  const twoMetalTwoWood = (values) => values.every((element) => element === '金' || element === '木')
    && values.filter((element) => element === '金').length === 2;
  const yearNayinInMonth = nayinPhase(natalNayin, month);
  const dayNayinInHour = nayinPhase(nayinElements[2], hourPillar.branch.name);
  const decliningPhases = ['衰', '病', '死', '墓', '绝'];
  const skyNet = natalNayin === '火' && [...'戌亥'].every((branch) => natalBranches.includes(branch));
  const earthNet = ['水', '土'].includes(natalNayin) && [...'辰巳'].every((branch) => natalBranches.includes(branch));
  const schoolHasNayinCounter = nayinElements.some((element) => controlledElement[element] === natalNayin);
  const balanceScores = new Map(fiveElementStrength.elements.map(({ element, score }) => [element, score]));
  const metal = balanceScores.get('金');
  const fire = balanceScores.get('火');
  const wood = balanceScores.get('木');
  const water = balanceScores.get('水');
  const { total } = dayMasterStrength;
  const wealthPoints = pointsForTenGods(tenGodStrengthGroups.财星);
  const officerPoints = pointsForTenGods(tenGodStrengthGroups.官星);
  const supportAndWealthOfficerEven = wealthPoints > 0 && officerPoints > 0
    && dayMasterStrength.result === '相对均衡'
    && Math.abs(dayMasterStrength.supportScore - wealthPoints - officerPoints) * 10 <= total;
  const peerGods = ['比肩', '劫财'];
  const bothPeerGodsHidden = peerGods.every(name =>
    L1.pillars.some(({ hiddenStems }) => hiddenStems.some(({ tenGod }) => tenGod === name)));
  const peerVisible = L1.pillars.some(({ position, tenGod }) => position !== 'day' && peerGods.includes(tenGod));
  const strongDamp = climate.moisture === '偏湿' && metal > 0 && water > fire * 2
    && (water + metal) * 2 > total;
  const strongDry = climate.moisture === '偏燥' && wood > 0 && fire > water * 2
    && (fire + wood) * 2 > total;
  const metalWaterDominance = metal > 0 && water > 0 && (metal + water) * 2 > total;
  const nobleStemStart = (heavenlyStems.indexOf(yearPillar.stem.name) % 5) * 2 + 2;
  const noblePlacement = L1.pillars.slice(2).some(({ position, stem, branch, shenSha }) => {
    const fromTiger = (earthlyBranches.indexOf(branch.name) - 2 + 12) % 12;
    return stem.name === heavenlyStems[(nobleStemStart + fromTiger) % 10]
      && shenSha.some(({ name, sourcePillars }) => name === '天乙贵人' && sourcePillars.includes('year'))
      && !shenSha.some(({ name }) => name === '空亡')
      && !L2.stemBranchRelations.branches.some(({ type, positions, state }) =>
        state === 'complete' && ['六冲', '相破', '六害', '自刑', '相刑', '三刑'].includes(type) && positions.includes(position));
  });
  const [, [virtueStems, talentStems]] = Object.entries(virtueAndTalentByTrine).find(([group]) => group.includes(month));
  const virtuePairs = L1.pillars.filter(({ stem }) => virtueStems.includes(stem.name))
    .flatMap((virtue) => L1.pillars.filter(({ stem, position }) => talentStems.includes(stem.name) && position !== virtue.position)
      .map((talent) => [virtue, talent]));
  const isProtected = ({ position, stem }) => !L1.pillars.some((other) =>
    other.position !== position && controlledElement[other.stem.element] === stem.element)
    && !L2.stemBranchRelations.branches.some(({ type, positions, state }) =>
      state === 'complete' && ['六冲', '相破'].includes(type) && positions.includes(position));
  const yearHorseControlsMonth = L1.pillars.some(({ branch, shenSha }) =>
    controlledElement[branch.element] === L1.monthCommand.branch.element
    && shenSha.some(({ name, sourcePillars }) => name === '驿马' && sourcePillars.includes('year')));
  const youngerBranchGroup = completeBranchRelations.some(({ type, positions }) =>
    ['三合', '三会'].includes(type) && positions.length === 3 && !positions.includes('year'));
  const isolatedYear = youngerBranchGroup
    && !completeBranchRelations.some(({ positions }) => positions.includes('year'))
    && !stemUnions.some(({ positions }) => positions.includes('year'))
    && !L1.pillars.slice(1).some(({ stem }) => stem.element === yearPillar.stem.element);
  const outputGods = ['食神', '伤官'];
  const outputHasAnchor = outputGods.includes(L1.monthCommand.hiddenStems[0].tenGod)
    || L1.pillars.some(({ position, tenGod }) => position !== 'day' && outputGods.includes(tenGod));
  const hasStrongUnsupportedOutput = dayMasterStrength.supportScore * 3 < dayMasterStrength.total
    && outputGods.includes(L1.monthCommand.hiddenStems[0]?.tenGod)
    && [yearPillar, hourPillar].every(({ tenGod }) => outputGods.includes(tenGod));
  const distinguishedPairs = ['金土', '火木', '水木'].filter((pair) => [...pair].every((element) =>
    fiveElementStrength.elements.some((item) => item.element === element && ['旺', '相'].includes(item.season))
    && L1.pillars.some(({ stem }) => stem.element === element)
    && L1.pillars.some(({ hiddenStems }) => hiddenStems.some((hidden) => hidden.element === element))));
  const hourIsSixVoid = [...yearVoid].some((branch) =>
    earthlyBranches[(earthlyBranches.indexOf(branch) + 6) % 12] === hourPillar.branch.name);
  const yearThreeElementsAreSeasonal = [yearPillar.stem.element, yearPillar.branch.element, natalNayin]
    .every((element) => fiveElementStrength.elements.some((item) => item.element === element && ['旺', '相'].includes(item.season)));
  const dayStem = L1.dayMaster.stem.name;
  const dayLuIndex = [...earthlyBranches].findIndex((branch) => baziStemPhase(dayStem, branch) === '临官');
  const branchBeforeLu = earthlyBranches[(luIndex + 11) % 12];
  const afflictedBeforeLu = luIndex >= 0 && luIndex === dayLuIndex && L1.pillars.some(({ branch, shenSha }) =>
    branch.name === branchBeforeLu && (branchBeforeLu === loner || branchBeforeLu === widow
      || shenSha.some(({ name }) => name === '空亡')));
  const dayElement = L1.dayMaster.stem.element;
  const noDaySupport = !L1.pillars.some(({ position, stem, hiddenStems }) =>
    (position !== 'day' && (stem.element === dayElement || generatedElement[stem.element] === dayElement))
    || hiddenStems.some(({ element }) => element === dayElement || generatedElement[element] === dayElement));
  const controllingStems = L1.pillars.filter(({ tenGod }) => ['正官', '七杀', '正财', '偏财'].includes(tenGod));
  const noRootsAndAfflicted = noDaySupport && controllingStems.length > 0 && L1.pillars.every(({ stem }) =>
    !L1.pillars.some(({ hiddenStems }) => hiddenStems.some(({ element }) => element === stem.element)))
    && completeBranchRelations.some(({ type, positions }) =>
      ['六冲', '三刑', '相刑', '自刑'].includes(type) && positions.includes('day'));
  const officers = L1.tenGodIndex.find(({ name }) => name === '正官');
  const officerStem = [...officers.exposed, ...officers.hidden][0]?.stem;
  const horsesAtDayGrowth = L1.pillars.filter(({ position, branch }) => horsePositions.has(position)
    && vigorousPhases.includes(baziStemPhase(dayStem, branch.name)));
  const horseAtOfficerGrowth = officerStem && L1.pillars.some(({ position, branch }) =>
    horsePositions.has(position) && vigorousPhases.includes(baziStemPhase(officerStem, branch.name)));
  const laterWealthOrOfficerGrows = ['正财', '偏财', '正官'].some((name) => {
    const occurrence = L1.tenGodIndex.find((item) => item.name === name);
    const earlyStem = occurrence.exposed.find(({ position }) => position === 'year' || position === 'month')?.stem;
    if (!earlyStem || !occurrence.hidden.some(({ position }) => position === 'day' || position === 'hour')) return false;
    const isLatePhase = (pillar) => vigorousPhases.includes(baziStemPhase(earlyStem, pillar.branch.name));
    return L1.pillars.slice(0, 2).every(({ branch, shenSha }) => ['沐浴', '绝'].includes(baziStemPhase(earlyStem, branch.name))
      || shenSha.some(({ name }) => name === '空亡'))
      && isLatePhase(dayPillar) && isLatePhase(hourPillar);
  });
  return [
    ...(hasSkyVirtue || hasMoonVirtue ? [{ kind: 'bazi_natal_configuration', name: '天月德至少一项' }] : []),
    ...baziClassicalStructureFacts({ L1, L2 }, hasSkyVirtue && hasMoonVirtue),
    ...(floatingSha ? [{ kind: 'bazi_natal_configuration', name: '浮沉煞落' + floatingSha }] : []),
    ...(favorsMonthAndFetalMonth ? [{ kind: 'bazi_natal_configuration', name: '月胎禄马贵而日时不见' }] : []),
    ...(isolatedYear ? [{ kind: 'bazi_natal_configuration', name: '月日时成局而年柱孤立' }] : []),
    ...(hasStrongUnsupportedOutput ? [{ kind: 'bazi_natal_configuration', name: '食伤聚而日主无依' }] : []),
    ...distinguishedPairs.map((pair) => ({ kind: 'bazi_natal_configuration', name: pair + '乘月令秀气' })),
    ...(hourIsSixVoid ? [{ kind: 'bazi_natal_configuration', name: '时支临年旬六虚' }] : []),
    ...(Math.min(water, fire) * 4 >= dayMasterStrength.total && Math.abs(water - fire) * 10 <= dayMasterStrength.total
      ? [{ kind: 'bazi_natal_configuration', name: '水火相停' }] : []),
    ...(yearThreeElementsAreSeasonal ? [{ kind: 'bazi_natal_configuration', name: '年柱干支纳音俱得月令旺相' }] : []),
    ...(noRootsAndAfflicted ? [{ kind: 'bazi_natal_configuration', name: '日主与所透财官俱无根且逢刑冲' }] : []),
    ...(afflictedBeforeLu ? [{ kind: 'bazi_natal_configuration', name: '年日禄后同支逢空孤' }] : []),
    ...(horsesAtDayGrowth.length >= 2 ? [{ kind: 'bazi_natal_configuration', name: '至少两处驿马临日主生旺' }] : []),
    ...(horsesAtDayGrowth.length || horseAtOfficerGrowth ? [{ kind: 'bazi_natal_configuration', name: '驿马临日主生旺或官星生旺' }] : []),
    ...(laterWealthOrOfficerGrows ? [{ kind: 'bazi_natal_configuration', name: '年月财官败绝空亡而日时得生旺' }] : []),
    ...(new Set(L1.pillars.map(({ branch }) => branch.element)).size === 1 && new Set(nayinElements).size === 1
      ? [{ kind: 'bazi_natal_configuration', name: '地支本气同类且四柱纳音比和' }] : []),
    ...(academyWithHorses ? [{ kind: 'bazi_natal_configuration', name: '生年纳音日坐长生且驿马一冲一合' }] : []),
    ...(contestsStemUnion && hasNatalPeachBlossom
      ? [{ kind: 'bazi_natal_configuration', name: '同一干争合且见年支咸池' }] : []),
    ...(yearVoid.includes(home) && robbery === home
      ? [{ kind: 'bazi_natal_configuration', name: '宅位年旬空且逢年劫煞' }] : []),
    ...(yearNobles.includes(field) && ['旺', '相'].includes(fieldSeason) && !yearVoid.includes(field)
      ? [{ kind: 'bazi_natal_configuration', name: '田位本气旺相且逢年天乙' }] : []),
    ...(yearVoid.includes(field)
      ? [{ kind: 'bazi_natal_configuration', name: '田位落年旬空' }] : []),
    ...(natalBranches.slice(1).includes(fromYear(11)) && !yearNobles.includes(home)
      && !baziNoblemanBranches(dayPillar.stem.name).includes(home)
      && dayNayin !== homeNayin && generatedElement[homeNayin] !== dayNayin
      ? [{ kind: 'bazi_natal_configuration', name: '原局冲岁前宅位且宅不扶日纳音' }] : []),
    ...(dayNayin === controlledElement[natalNayin] && vigorousPhases.includes(nayinPhase(dayNayin, dayPillar.branch.name))
      ? [{ kind: 'bazi_natal_configuration', name: '日坐年纳音之财且入生旺' }] : []),
    ...['金', '水'].filter((element) => vigorousPhases.includes(nayinPhase(element, hourPillar.branch.name)))
      .map((element) => ({ kind: 'bazi_natal_configuration', name: '时支乘' + element + '生旺' })),
    ...(twoMetalTwoWood(stemElements) ? [{ kind: 'bazi_natal_configuration', name: '四干各两金两木' }] : []),
    ...(twoMetalTwoWood(stemElements) && twoMetalTwoWood(nayinElements)
      ? [{ kind: 'bazi_natal_configuration', name: '四干四纳音各两金两木' }] : []),
    ...(Math.min(metal, wood) * 4 >= dayMasterStrength.total && Math.abs(metal - wood) * 10 <= dayMasterStrength.total
      ? [{ kind: 'bazi_natal_configuration', name: '金木相停' }] : []),
    ...(L1.pillars.slice(0, 2).every(({ stem, hiddenStems }) => [stem, ...hiddenStems]
      .every(({ element }) => element !== '火' && element !== '土'))
      ? [{ kind: 'bazi_natal_configuration', name: '年干月干及年月藏干无火土' }] : []),
    ...(natalNayin === nayinElements[2] && L1.pillars.slice(1).some(({ ganZhi }) => ganZhi === yearSealVault[natalNayin])
      ? [{ kind: 'bazi_natal_configuration', name: '年日同纳音五行且见本家正印' }] : []),
    ...(yearNayinInMonth === '帝旺' && decliningPhases.includes(dayNayinInHour)
      ? [{ kind: 'bazi_natal_configuration', name: '年纳音乘月旺且胜日纳音' }] : []),
    ...(dayNayinInHour === '帝旺' && decliningPhases.includes(yearNayinInMonth)
      ? [{ kind: 'bazi_natal_configuration', name: '日纳音乘时旺且胜年纳音' }] : []),
    ...(L1.pillars.filter(({ branch }) => branch.element === '土').length === 1
      ? [{ kind: 'bazi_natal_configuration', name: '四支恰一支本气为土' }] : []),
    ...(distinctNobleBranches(L1.pillars.map(({ stem }) => stem.name), natalBranches)
      ? [{ kind: 'bazi_natal_configuration', name: '四干各临天乙贵支' }] : []),
    ...(yearHorseControlsMonth ? [{ kind: 'bazi_natal_configuration', name: '年马克月支' }] : []),
    ...(threeWealth.every((element) => L1.elements.present.includes(element))
      ? [{ kind: 'bazi_natal_configuration', name: '禄命身三财齐' }] : []),
    ...(dayMasterStrength.supportScore * 5 >= dayMasterStrength.total * 2
      && dayMasterStrength.supportScore * 5 <= dayMasterStrength.total * 3
      ? [{ kind: 'bazi_natal_configuration', name: '日主支援四至六成' }] : []),
    ...(balancedKilling ? [{ kind: 'bazi_natal_configuration', name: '日主支援与七杀力量相近' }] : []),
    ...(stemGeneration ? [{ kind: 'bazi_natal_configuration', name: '四柱明干顺位相生' }] : []),
    ...(woodFireEarthHitByClash ? [{ kind: 'bazi_natal_configuration', name: '木火土三干顺生而外支冲入' }] : []),
    ...(strongDamp ? [{ kind: 'bazi_natal_configuration', name: '湿土月金水过半且水量大于火量两倍' }] : []),
    ...(strongDry ? [{ kind: 'bazi_natal_configuration', name: '燥土月木火过半且火量大于水量两倍' }] : []),
    ...(metalWaterDominance ? [{ kind: 'bazi_natal_configuration', name: '金水合量过半' }] : []),
    ...(supportAndWealthOfficerEven ? [{ kind: 'bazi_natal_configuration', name: '日主支援与财官合量相近' }] : []),
    ...(bothPeerGodsHidden && peerVisible
      ? [{ kind: 'bazi_natal_configuration', name: '比肩劫财俱藏且至少一类透干' }] : []),
    ...(L1.pillars.every(({ stem }) => stem.polarity === '阴')
      ? [{ kind: 'bazi_natal_configuration', name: '四柱纯阴' }] : []),
    ...(exposedOfficers.length === 1 ? [{ kind: 'bazi_natal_configuration', name: '原局只透一位正官' }] : []),
    ...(!outputHasAnchor ? [{ kind: 'bazi_natal_configuration', name: '食伤均未透且非月令本气' }] : []),
    ...(unionSeats.size >= 2 ? [{ kind: 'bazi_natal_configuration', name: '原局两组以上干支合' }] : []),
    ...(indirectSealInGeneratingPillar
      ? [{ kind: 'bazi_natal_configuration', name: '偏印所在柱干支本气相生' }] : []),
    ...(hasShenShaAndHarmony ? [{ kind: 'bazi_natal_configuration', name: '禄马贵人俱见且有六合' }] : []),
    ...(horsePositions.size === 0 ? [{ kind: 'bazi_natal_configuration', name: '四柱无驿马' }] : []),
    ...(harmCount >= 2 ? [{ kind: 'bazi_natal_configuration', name: '原局六害多见' }] : []),
    ...(Math.min(metal, fire) * 4 >= dayMasterStrength.total && Math.abs(metal - fire) * 10 <= dayMasterStrength.total
      ? [{ kind: 'bazi_natal_configuration', name: '金火相停' }] : []),
    ...(metal * 10 >= dayMasterStrength.total * 3 && wood * 4 >= dayMasterStrength.total
      && [...balanceScores.values()].filter((score) => score >= metal).length === 1
      ? [{ kind: 'bazi_natal_configuration', name: '木盛金繁' }] : []),
    ...(noblePlacement ? [{ kind: 'bazi_natal_configuration', name: '五虎遁天乙入庙' }] : []),
    ...(luIndex >= 0 && L1.pillars.slice(1).some(({ branch }) => branch.name === carriageBranch)
      ? [{ kind: 'bazi_natal_configuration', name: '年干禄前二辰见金舆' }] : []),
    ...(virtuePairs.some((pair) => pair.every(isProtected)) ? [{ kind: 'bazi_natal_configuration', name: '德秀无冲破克' }] : []),
    ...(virtuePairs.some((pair) => pair.every(({ position }) => ['day', 'hour'].includes(position)))
      ? [{ kind: 'bazi_natal_configuration', name: '日时德秀俱见' }] : []),
    ...(baziStemPhase(dayPillar.stem.name, hourPillar.branch.name) === '临官'
      && baziStemPhase(hourPillar.stem.name, dayPillar.branch.name) === '临官'
      ? [{ kind: 'bazi_natal_configuration', name: '日时互换禄' }] : []),
    ...(nayinElements.filter((element) => element === '金').length === 3 && nayinElements.includes('木')
      ? [{ kind: 'bazi_natal_configuration', name: '四柱纳音三金一木' }] : []),
    { kind: 'bazi_day_master_season', season: seasonalBalance.season },
    { kind: 'day_master_strength', result: dayMasterStrength.result, profile: dayMasterStrength.method },
    ...fiveElementStrength.elements.flatMap(({ element, score, season }) => {
      const growing = ['旺', '相'].includes(season);
      const bands = [];
      if (score > 0 && score * 5 < dayMasterStrength.total) bands.push('少量');
      if (growing && score * 10 >= dayMasterStrength.total * 3) bands.push('旺');
      if (!growing && score > 0 && score * 10 < dayMasterStrength.total) bands.push('弱');
      if (score * 2 > dayMasterStrength.total) bands.push('过盛');
      return bands.map((band) => ({ kind: 'bazi_element_balance', element, band, profile: 'weighted-element-balance-v1' }));
    }),
    ...L1.elements.present.map((element) => ({ kind: 'bazi_natal_element', element })),
    ...yuanhaiPillarGroupFacts(L1, L2.stemBranchRelations.branches, blade),
    ...shenfengReviewedFacts(L1.pillars, L2),
    ...stemPlacementCounts,
    ...Object.entries(tenGodStrengthGroups).flatMap(([group, members]) => {
      const evidence = fiveElementStrength.contributions.filter(({ tenGod }) => members.includes(tenGod));
      const monthMain = evidence.some(({ position, origin }) => position === 'month' && origin === '本气');
      const rooted = evidence.some(({ origin }) => origin !== 'stem');
      const anchored = monthMain || evidence.some(({ origin }) => origin === 'stem');
      const points = evidence.reduce((total, { points }) => total + points, 0);
      if (!rooted || !anchored) return [];
      const levels = [];
      if (points * 5 >= total) levels.push('旺');
      if (points * 2 > total) levels.push('过盛');
      return levels.map((strength) =>
        ({ kind: 'bazi_ten_god_strength', group, profile: 'anchored-weighted-ten-god-v1', strength }));
    }),
    ...Object.entries(measuredTenGodGroups).flatMap(([group, members]) => {
      const points = pointsForTenGods(members);
      return points > 0 && points * 10 < total
        ? [{ kind: 'bazi_ten_god_strength', group, profile: 'weighted-ten-god-share-v1', strength: '少量' }] : [];
    }),
    ...L1.pillars.flatMap(({ position, stem, branch, shenSha, hiddenStems }, index) => {
      const nayin = nayinElements[index];
      const phase = nayinPhase(nayin, branch.name);
      const school = position !== 'year' && nayin === natalNayin && !schoolHasNayinCounter
        ? { 长生: '真学堂', 临官: '真词馆' }[phase] : null;
      const names = [
        ...shenSha.filter(({ name }) => name === '空亡' || name === '桃花' || verifiedNatalShenSha.includes(name)).map(({ name }) => name),
        ...(stem.name === skyVirtue || branch.name === skyVirtue ? ['天德'] : []),
        ...(stem.name === moonVirtue ? ['月德'] : []),
        ...(branch.name === loner ? ['孤辰'] : []),
        ...(branch.name === widow ? ['寡宿'] : []),
        ...(branch.name === blade ? ['阳刃'] : []),
        ...(branch.name === robbery ? ['劫煞'] : []),
        ...(branch.name === lostSpirit ? ['亡神'] : []),
        ...(branch.name === fromYear(5) && ['day', 'hour'].includes(position) ? ['官符'] : []),
        ...(branch.name === fromYear(2) ? ['丧门'] : []),
        ...(branch.name === fromYear(-2) ? ['吊客'] : []),
        ...(direction && branch.name === fromYear(6 + direction) ? ['元辰'] : []),
        ...(direction && branch.name === fromYear(3 * direction) ? ['勾神'] : []),
        ...(direction && branch.name === fromYear(-3 * direction) ? ['绞神'] : []),
        ...(skyNet && '戌亥'.includes(branch.name) ? ['天罗'] : []),
        ...(earthNet && '辰巳'.includes(branch.name) ? ['地网'] : []),
      ];
      return [{ kind: 'bazi_nayin_phase', position, phase },
        ...(school ? [{ kind: 'bazi_nayin_school', position, school }] : []),
        { kind: 'bazi_own_stem_phase', position, phase: baziStemPhase(stem.name, branch.name) },
        ...hiddenStems.flatMap(({ name, tenGod }) => [
          { kind: 'bazi_hidden_god_phase', position, tenGod, phase: baziStemPhase(name, branch.name), anchor: 'host' },
          { kind: 'bazi_hidden_god_phase', position, tenGod, phase: baziStemPhase(name, month), anchor: 'month' },
        ]),
        ...names.map((name) => ({ kind: 'shen_sha', position, name }))];
    }),
    ...L2.tenGodStructures.filter(({ formation }) => formation.supported).map(({ name }) =>
      ({ kind: 'bazi_ten_god_structure', name })),
    ...L2.stemBranchRelations.branches.filter(({ state, positions }) => state === 'complete' && positions.length === 2)
      .map(({ type, positions: [first, second] }) => ({ kind: 'bazi_branch_relation', relation: type, first, second })),
    ...L2.stemBranchRelations.branches.filter(({ type, state }) => ['三刑', '三合'].includes(type) && state === 'complete')
      .flatMap(({ type, positions }) => positions.flatMap((first, index) => positions.slice(index + 1)
        .map((second) => ({ kind: 'bazi_branch_relation', relation: type, first, second })))),
    ...L1.pillars.flatMap((first, index) => L1.pillars.slice(index + 1).filter((second) =>
      LunarUtil.getXunKong(first.ganZhi).includes(second.branch.name) && LunarUtil.getXunKong(second.ganZhi).includes(first.branch.name))
      .map((second) => ({ kind: 'bazi_branch_relation', relation: '互换空亡', first: first.position, second: second.position }))),
    ...L2.stemBranchRelations.stems.filter((pair) => pair.transformation?.supported).flatMap((pair) => {
      const dayIndex = pair.positions.indexOf('day');
      return [
        { kind: 'bazi_stem_transformation', pair: pair.stems.join(''), element: pair.traditionalElement },
        ...(dayIndex === -1 ? [] : [{ kind: 'bazi_day_stem_transformation', stem: pair.stems[dayIndex],
          partner: pair.stems[1 - dayIndex], element: pair.traditionalElement }]),
      ];
    }),
    ...L2.stemBranchRelations.stems.filter(({ combination }) => combination === '五合').map(({ positions: [first, second] }) =>
      ({ kind: 'bazi_stem_combination', first, second })),
    ...[...L1.tenGodIndex.map(({ name }) => [name, [name]]), ...Object.entries(tenGodStrengthGroups).filter(([, members]) => members.length > 1)]
      .map(([tenGod, members]) => ({ kind: 'bazi_ten_god_count', tenGod, count: new Set(L1.tenGodIndex
        .filter(({ name }) => members.includes(name)).flatMap(({ exposed, hidden }) => [...exposed, ...hidden].map(({ position }) => position))).size })),
    { kind: 'bazi_month_pattern', name: L2.assessments.patterns.candidate, result: L2.assessments.patterns.result },
  ];
}
