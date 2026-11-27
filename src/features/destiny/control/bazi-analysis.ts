import { LunarUtil } from 'lunar-javascript';
import type { describeBaZiPillars } from './charts';

type Chart = ReturnType<typeof describeBaZiPillars>;
type Position = 'year' | 'month' | 'day' | 'hour';
type Element = '木' | '火' | '土' | '金' | '水';
const positions = ['year', 'month', 'day', 'hour'] as const;
const elements = ['木', '火', '土', '金', '水'] as const;
const earth = '子丑寅卯辰巳午未申酉戌亥';
const heaven = '甲乙丙丁戊己庚辛壬癸';
const tenGodNames = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
const stemIds = ['jia', 'yi', 'bing', 'ding', 'wu', 'ji', 'geng', 'xin', 'ren', 'gui'];
const branchIds = ['zi', 'chou', 'yin', 'mao', 'chen', 'si', 'wu', 'wei', 'shen', 'you', 'xu', 'hai'];
const branchElements: readonly Element[] = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];
const evaluated = 'evaluated' as const;
export const baziAnalysisVersion = 'natal-l1-l2-v2';

function properties(name: string, kind: 'stem' | 'branch') {
  const idx = (kind === 'stem' ? heaven : earth).indexOf(name);
  return {
    id: kind + ':' + (kind === 'stem' ? stemIds[idx] : branchIds[idx]),
    name,
    element: kind === 'stem' ? elements[Math.floor(idx / 2)] : branchElements[idx],
    polarity: idx % 2 === 0 ? '阳' : '阴',
  };
}

function elementRelation(from: Element, to: Element) {
  const distance = (elements.indexOf(to) - elements.indexOf(from) + elements.length) % elements.length;
  return (['同类', '生', '克', '被克', '被生'] as const)[distance];
}

function countElements(values: readonly Element[]) {
  const counts: Record<Element, number> = { 木: 0, 火: 0, 土: 0, 金: 0, 水: 0 };
  for (const value of values) counts[value]++;
  return counts;
}

function pillarFacts(chart: Chart, position: Position) {
  const ganZhi = chart[position];
  const stem = properties(ganZhi[0], 'stem');
  const branch = properties(ganZhi[1], 'branch');
  const legacyHiddenStems = chart.tenGods[position].hiddenStems;
  // L1 follows the specification's 巳 order and leaves the engine's legacy order intact.
  const hiddenStems = branch.name === '巳'
    ? [...legacyHiddenStems].sort((a, b) => '丙戊庚'.indexOf(a.stem) - '丙戊庚'.indexOf(b.stem))
    : legacyHiddenStems;
  return {
    position, ganZhi, stem, branch, tenGod: chart.tenGods[position].heavenlyStem,
    hiddenStems: hiddenStems.map(({ stem, tenGod }, index) => ({
      ...properties(stem, 'stem'), position, branch: branch.name, tenGod,
      order: index + 1, role: (['本气', '中气', '余气'] as const)[index],
    })),
    shenSha: chart.shenSha[position],
  };
}

type PillarFact = ReturnType<typeof pillarFacts>;
function tenGodIndex(pillars: PillarFact[]) {
  return tenGodNames.map((name) => {
    const exposed = pillars.filter((p) => p.tenGod === name).map((p) => ({
      position: p.position, ganZhi: p.ganZhi, stem: p.stem.name, element: p.stem.element,
    }));
    const hidden = pillars.flatMap((p) => p.hiddenStems.filter((s) => s.tenGod === name).map((s) => ({
      position: p.position, ganZhi: p.ganZhi, stem: s.name, element: s.element, branch: s.branch, role: s.role,
    })));
    return { name, count: exposed.length + hidden.length, exposed, hidden };
  });
}

function buildL1(chart: Chart) {
  const pillars = positions.map((position) => pillarFacts(chart, position));
  const [, month, day] = pillars;
  const branchIndex = earth.indexOf(month.branch.name);
  return {
    status: evaluated,
    pillars,
    dayMaster: { position: day.position, stem: day.stem, seat: day.branch },
    tenGodIndex: tenGodIndex(pillars),
    elements: {
      stems: countElements(pillars.map((p) => p.stem.element)),
      branches: countElements(pillars.map((p) => p.branch.element)),
      hiddenStems: countElements(pillars.flatMap((p) => p.hiddenStems.map((s) => s.element))),
      byPillar: pillars.map((p) => ({
        position: p.position, stem: p.stem.element, branch: p.branch.element,
        hiddenStems: countElements(p.hiddenStems.map((s) => s.element)),
      })),
      present: elements.filter((element) => pillars.some((p) =>
        p.stem.element === element || p.branch.element === element || p.hiddenStems.some((s) => s.element === element))),
    },
    monthCommand: {
      position: month.position, branch: month.branch, hiddenStems: month.hiddenStems,
      season: (['春', '夏', '秋', '冬'] as const)[Math.floor(((branchIndex + 10) % 12) / 3)],
      elementRelations: elements.map((element) => ({ element, relation: elementRelation(month.branch.element, element) })),
    },
  };
}

const stemCombinations = new Map<string, Element>([['甲己', '土'], ['乙庚', '金'], ['丙辛', '水'], ['丁壬', '木'], ['戊癸', '火']]);
const branchPairs = [
  ['六合', ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未']],
  ['六冲', ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥']],
  ['六害', ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌']],
  ['相破', ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌']],
  ['相刑', ['子卯']],
] as const;
const branchGroups = [
  ['三合', ['申子辰', '亥卯未', '寅午戌', '巳酉丑']],
  ['三会', ['寅卯辰', '巳午未', '申酉戌', '亥子丑']],
  ['三刑', ['寅巳申', '丑戌未']],
] as const;
type BranchRelation = { type: string; pattern: string; state: 'complete' | 'partial'; positions: Position[]; missing: string[] };
type StemRelation = {
  positions: [Position, Position];
  stems: [string, string];
  relation: ReturnType<typeof elementRelation>;
  combination?: '五合';
  traditionalElement?: Element;
};

function stemBranchRelations(pillars: PillarFact[]) {
  const stems: StemRelation[] = [];
  const branches: BranchRelation[] = [];
  for (const [index, first] of pillars.entries()) {
    for (const second of pillars.slice(index + 1)) {
      const a = first.stem.name, b = second.stem.name;
      const combinationElement = stemCombinations.get(a + b) ?? stemCombinations.get(b + a);
      stems.push({
        positions: [first.position, second.position], stems: [a, b],
        relation: elementRelation(first.stem.element, second.stem.element),
        ...(combinationElement && { combination: '五合', traditionalElement: combinationElement }),
      });

      const c = first.branch.name, d = second.branch.name;
      const pair = [first.position, second.position];
      for (const [type, patterns] of branchPairs) {
        const pattern = patterns.find((p) => p === c + d || p === d + c);
        if (pattern) branches.push({ type, pattern, state: 'complete', positions: pair, missing: [] });
      }
      if (c === d && '辰午酉亥'.includes(c)) {
        branches.push({ type: '自刑', pattern: c + d, state: 'complete', positions: pair, missing: [] });
      }
    }
  }
  for (const [type, patterns] of branchGroups) {
    for (const pattern of patterns) {
      const matching = pillars.filter((p) => pattern.includes(p.branch.name));
      const names = new Set(matching.map((p) => p.branch.name));
      if (names.size < 2) continue;
      const missing = [...pattern].filter((branch) => !names.has(branch));
      branches.push({ type, pattern, state: missing.length ? 'partial' : 'complete', positions: matching.map((p) => p.position), missing });
    }
  }
  const tensions = branches.flatMap((first, index) => {
    if (first.state !== 'complete' || !['六合', '三合', '三会'].includes(first.type)) return [];
    return branches.flatMap((second, otherIndex) => {
      if (second.state !== 'complete' || !['六冲', '六害', '相破', '相刑', '自刑', '三刑'].includes(second.type)) return [];
      const sharedPositions = first.positions.filter((p) => second.positions.includes(p));
      return sharedPositions.length ? [{
        relations: [index, otherIndex], sharedPositions,
        resolution: { status: evaluated, method: 'shared-pillar-v1',
          result: second.type === '六冲' ? '合局见冲' : '关系并见' },
      }] : [];
    });
  });
  const stemDetails = stems.map((pair) => {
    if (!pair.traditionalElement) return pair;
    const [first, second] = pair.positions;
    const target = pair.traditionalElement;
    const evidence = {
      adjacent: positions.indexOf(second) - positions.indexOf(first) === 1,
      monthSupports: elementRelation(pillars[1].branch.element, target) === '同类',
      roots: pillars.filter((p) => p.hiddenStems.some((s) => s.element === target)).map((p) => p.position),
      competingPairs: stems.filter((other) => other !== pair && other.combination
        && other.positions.some((p) => pair.positions.includes(p))).map((other) => other.positions),
      clashes: branches.filter((b) => b.type === '六冲' && b.positions.some((p) => p === 'month' || pair.positions.includes(p))),
    };
    const supported = evidence.adjacent && evidence.monthSupports && evidence.roots.length > 0
      && !evidence.competingPairs.length && !evidence.clashes.length;
    return { ...pair, transformation: { status: evaluated, method: 'adjacent-month-root-v1',
      result: supported ? '支持合化候选' : '有合而化气条件不足', supported, evidence } };
  });
  return { status: evaluated, stems: stemDetails, branches, tensions };
}

function strengthAssessments(l1: ReturnType<typeof buildL1>) {
  const month = l1.monthCommand.branch.element;
  const day = l1.dayMaster.stem.element;
  const seasonal = { 同类: 5, 生: 4, 被生: 3, 被克: 2, 克: 1 };
  const contributions = l1.pillars.flatMap((p) => [
    ...(p.position === 'day' ? [] : [{ position: p.position, stem: p.stem.name,
      element: p.stem.element, tenGod: p.tenGod, origin: 'stem', weight: 4 }]),
    ...p.hiddenStems.map((s) => ({ position: p.position, stem: s.name, element: s.element,
      tenGod: s.tenGod, origin: s.role, weight: (4 - s.order) * (p.position === 'month' ? 2 : 1) })),
  ]).map((entry) => ({ ...entry, points: entry.weight * seasonal[elementRelation(month, entry.element)] }));
  const score = (key: 'element' | 'tenGod', value: string) =>
    contributions.filter((entry) => entry[key] === value).reduce((total, entry) => total + entry.points, 0);
  const points = elements.map((element) => ({ element, score: score('element', element),
    season: (['旺', '相', '休', '囚', '死'] as const)[5 - seasonal[elementRelation(month, element)]] }));
  const total = points.reduce((sum, el) => sum + el.score, 0);
  const dominant = Math.max(...points.map(({ score }) => score));
  const uniqueDominant = points.filter(({ score }) => score === dominant).length === 1;
  const temperamentIndicators = points.flatMap(({ element, score, season }) => {
    if (score * 2 > total) return [{ element, classification: '太过' }];
    if (uniqueDominant && score === dominant && (season === '旺' || season === '相')) return [{ element, classification: '旺相' }];
    if (element !== day || score * 5 >= total || season === '旺' || season === '相') return [];
    return [{ element, classification: '不及' }, ...((season === '休' || season === '囚') ? [{ element, classification: '休囚' }] : [])];
  });
  const supportive = points.filter(({ element }) => ['同类', '被生'].includes(elementRelation(day, element)));
  const supportScore = supportive.reduce((sum, el) => sum + el.score, 0);
  const share = supportScore * 100 / total;
  const method = 'monthly-weighted-strength-v1';
  return {
    dayMasterStrength: { status: evaluated, method, result: share >= 55 ? '偏强' : share <= 45 ? '偏弱' : '相对均衡',
      dayElement: day, monthElement: month, monthRelation: elementRelation(day, month),
      supportScore, total, supportPercent: Math.round(share * 100) / 100,
      supportElements: supportive.map(({ element }) => element) },
    fiveElementStrength: { status: evaluated, method, elements: points, contributions,
      temperament: { method: 'element-weighted-temperament-v1', indicators: temperamentIndicators } },
    tenGodStrength: { status: evaluated, method,
      scores: tenGodNames.map((name) => ({ name, score: score('tenGod', name) })) },
  };
}

const monthPatterns: Record<string, string> = {
  比肩: '月令比肩', 劫财: '月劫', 食神: '食神格', 伤官: '伤官格',
  偏财: '偏财格', 正财: '正财格', 七杀: '七杀格', 正官: '正官格', 偏印: '偏印格', 正印: '正印格',
};

function assessChart(l1: ReturnType<typeof buildL1>, relations: ReturnType<typeof stemBranchRelations>,
  structures: { id: string; formation: { supported: boolean } }[]) {
  const strength = strengthAssessments(l1);
  const day = l1.dayMaster.stem.element;
  const { branch, hiddenStems, season } = l1.monthCommand;
  const visible = l1.pillars.filter((p) => p.position !== 'day').map((p) => p.stem.name);
  const primary = ('辰戌丑未'.includes(branch.name) && hiddenStems.find((h) => visible.includes(h.name))) || hiddenStems[0];
  const supported = (id: string) => structures.some((s) => s.id === id && s.formation.supported);
  const fit: Partial<Record<string, string>> = {
    食神: 'output-generates-wealth',
    伤官: 'hurting-officer-generates-wealth', 偏财: 'wealth-generates-officer', 正财: 'wealth-generates-officer',
    七杀: 'killing-generates-seal', 正官: 'officer-generates-seal',
    偏印: 'seal-supports-day-master', 正印: 'seal-supports-day-master',
  };
  const helper = fit[primary.tenGod];
  const helpers = helper ? [helper] : [];
  if (primary.tenGod === '七杀') helpers.push('food-controls-killing');
  const breakers = primary.tenGod === '正官' ? ['hurting-officer-controls-officer', 'officer-and-killing']
    : ['偏印', '正印'].includes(primary.tenGod) ? ['wealth-controls-seal'] : [];
  const assistance = helpers.filter(supported);
  const interference = breakers.filter(supported);
  const patterns = {
    status: evaluated, method: 'month-command-pattern-screen-v1',
    candidate: primary.tenGod === '比肩' && l1.pillars[1].shenSha.some(({ name }) => name === '禄神')
      ? '建禄' : monthPatterns[primary.tenGod],
    result: interference.length ? '见干扰' : assistance.length ? '见配合' : '待配合',
    evidence: { monthBranch: branch.name, selected: primary, exposed: visible.includes(primary.name), assistance, interference },
    specialCandidates: {
      专旺: strength.dayMasterStrength.supportPercent >= 80 && l1.pillars.filter((p) => p.hiddenStems[0].element === day).length >= 3,
      从势: strength.dayMasterStrength.supportPercent <= 15 && !l1.pillars.some((p) => p.hiddenStems.some((s) => s.element === day)),
      化气: relations.stems.some((pair) => 'transformation' in pair && pair.transformation?.supported && pair.positions.includes('day')),
    },
  };
  const { elements: rankedElements } = strength.fiveElementStrength;
  const sorted = [...rankedElements].sort((a, b) => b.score - a.score);
  const total = strength.dayMasterStrength.total;
  const fire = sorted.find(({ element }) => element === '火')!.score;
  const water = sorted.find(({ element }) => element === '水')!.score;
  const temperature = season === '冬' && water > fire ? '偏寒' : season === '夏' && fire > water ? '偏热' : '冷热未触发';
  const moisture = '未戌'.includes(branch.name) && fire > water ? '偏燥'
    : '辰丑'.includes(branch.name) && water > fire ? '偏湿' : '燥湿未触发';
  const climate = { status: evaluated, method: 'season-fire-water-v1', temperature, moisture,
    evidence: { season, monthBranch: branch.name, fire, water } };
  const balancing = strength.dayMasterStrength.result === '偏弱' ? elements.filter((e) => ['被生', '同类'].includes(elementRelation(day, e)))
    : strength.dayMasterStrength.result === '偏强' ? elements.filter((e) => ['生', '克', '被克'].includes(elementRelation(day, e))) : [];
  const mediation = { status: evaluated, method: 'prominent-control-bridge-v1',
    pairs: sorted.filter((a) => a.score * 5 >= total).flatMap((from) => sorted
      .filter((to) => to.score * 5 >= total && elementRelation(from.element, to.element) === '克')
      .map((to) => ({ from, to, bridge: elements.find((e) => elementRelation(from.element, e) === '生'
        && elementRelation(e, to.element) === '生')! }))) };
  const dominant = sorted[0].score * 5 >= total * 2 ? sorted[0] : null;
  const remedy = { status: evaluated, method: 'dominance-control-v1', dominant,
    candidates: dominant ? elements.filter((e) => elementRelation(e, dominant.element) === '克') : [] };
  const option = (method: string, candidates: readonly Element[]) => ({ status: evaluated, method, candidates: [...new Set(candidates)] });
  const climateCandidates: Element[] = [];
  if (temperature === '偏寒' || moisture === '偏湿') climateCandidates.push('火');
  if (temperature === '偏热' || moisture === '偏燥') climateCandidates.push('水');
  return { ...strength, patterns, climate, mediation, remedy,
    usefulGod: {
      monthPattern: option(patterns.method, [primary.element]),
      balancing: option(strength.dayMasterStrength.method, balancing),
      climate: option(climate.method, climateCandidates),
      remedy: option(remedy.method, remedy.candidates),
      mediation: option(mediation.method, mediation.pairs.map(({ bridge }) => bridge)),
    },
  };
}

const wealth = ['偏财', '正财'];
const seal = ['偏印', '正印'];
const output = ['食神', '伤官'];
const combinationRules = [
  { id: 'output-generates-wealth', name: '食伤生财', from: output, to: wealth, relation: '生' },
  { id: 'hurting-officer-generates-wealth', name: '伤官生财', from: ['伤官'], to: wealth, relation: '生' },
  { id: 'officer-generates-seal', name: '官印相生', from: ['正官'], to: seal, relation: '生' },
  { id: 'killing-generates-seal', name: '杀印相生', from: ['七杀'], to: seal, relation: '生' },
  { id: 'wealth-generates-officer', name: '财官相生', from: wealth, to: ['正官'], relation: '生' },
  { id: 'hurting-officer-controls-officer', name: '伤官见官', from: ['伤官'], to: ['正官'], relation: '克' },
  { id: 'officer-and-killing', name: '官杀混杂', from: ['正官'], to: ['七杀'], relation: '同类' },
  { id: 'wealth-controls-seal', name: '财星破印', from: wealth, to: seal, relation: '克' },
  { id: 'partial-seal-controls-food', name: '枭印夺食', from: ['偏印'], to: ['食神'], relation: '克' },
  { id: 'food-controls-killing', name: '食神制杀', from: ['食神'], to: ['七杀'], relation: '克' },
  { id: 'seal-supports-day-master', name: '印绶护身', from: seal, to: ['日主'], relation: '生' },
];

function buildL2(l1: ReturnType<typeof buildL1>, chart: Chart) {
  const { dayMaster, pillars, tenGodIndex } = l1;
  const [, , day] = pillars;
  const evidenceFor = (names: string[]) => tenGodIndex
    .filter((god) => names.includes(god.name))
    .flatMap(({ name, exposed, hidden }) => [
      ...exposed.map((occurrence) => ({ ...occurrence, tenGod: name, origin: 'stem' })),
      ...hidden.map((occurrence) => ({ ...occurrence, tenGod: name, origin: 'hidden_stem' })),
    ]);
  const relations = stemBranchRelations(pillars);
  const tenGodStructures = combinationRules.map(({ id, name, from, to, relation }) => {
    const sources = evidenceFor(from);
    const targets = to.includes('日主')
      ? [{ position: day.position, ganZhi: day.ganZhi, stem: day.stem.name, element: day.stem.element, tenGod: '日主', origin: 'stem' }]
      : evidenceFor(to);
    const anchored = (value: { origin: string; position: Position; stem: string }) =>
      value.origin === 'stem' || (value.position === 'month' && value.stem === l1.monthCommand.hiddenStems[0].name);
    const pairs = sources.flatMap((a, sourceIndex) => targets.flatMap((b, targetIndex) => {
      if (elementRelation(a.element, b.element) !== relation) return [];
      return [{ sourceIndex, targetIndex, anchored: anchored(a) && anchored(b) }];
    }));
    const supported = pairs.some((pair) => pair.anchored);
    return { id, name, status: evaluated, candidate: pairs.length > 0, relation, required: { from, to },
      evidence: { from: sources, to: targets }, formation: { status: evaluated, method: 'visible-or-month-main-v1',
        supported, result: supported ? '具备结构条件' : pairs.length ? '仅见组合线索' : '缺少组合条件', pairs } };
  });
  const hourPair = (pair: { positions: Position[] }) => pair.positions.length === 2
    && pair.positions.includes('day') && pair.positions.includes('hour');
  return {
    localStructures: {
      status: evaluated,
      daySeat: { dayStem: day.stem.name, dayBranch: day.branch.name, hiddenStems: day.hiddenStems,
        hasWealth: day.hiddenStems.some((s) => wealth.includes(s.tenGod)),
        hasSeal: day.hiddenStems.some((s) => seal.includes(s.tenGod)) },
      exposed: pillars.filter((p) => p.position !== 'day')
        .map((p) => ({ position: p.position, stem: p.stem.name, tenGod: p.tenGod })),
      roots: pillars.flatMap((p) => p.hiddenStems.filter((s) => s.element === dayMaster.stem.element)
        .map((s) => ({ ...s, match: s.name === dayMaster.stem.name ? 'same_stem' : 'same_element' }))),
    },
    tenGodStructures,
    stemBranchRelations: relations,
    assessments: assessChart(l1, relations, tenGodStructures),
    specialStructures: {
      shenSha: { status: evaluated, version: chart.shenShaRulesetVersion, byPillar: chart.shenSha },
      shenShaCombinations: { status: evaluated, method: 'same-pillar-shensha-v1',
        matches: pillars.filter((p) => p.shenSha.length > 1)
          .map(({ position, ganZhi, shenSha }) => ({ position, ganZhi, shenSha })) },
      naYin: { status: evaluated, method: 'sexagenary-nayin-v1',
        byPillar: pillars.map(({ position, ganZhi }) => ({ position, ganZhi, name: LunarUtil.NAYIN[ganZhi] ?? null })) },
      dayHourCombinations: { status: evaluated, method: 'natal-day-hour-pair-v1', day: chart.day, hour: chart.hour,
        stems: relations.stems.filter(hourPair), branches: relations.branches.filter(hourPair) },
    },
  };
}

export function analyzeBaZi(chart: Chart) {
  const L1 = buildL1(chart);
  const L2 = buildL2(L1, chart);
  const { year, month, day, hour } = chart;
  return { method: 'bazi', scope: 'natal', calculationVersion: baziAnalysisVersion, pillars: { year, month, day, hour }, L1, L2 };
}
