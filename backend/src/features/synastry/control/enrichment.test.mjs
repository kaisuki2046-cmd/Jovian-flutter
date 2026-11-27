import assert from 'node:assert/strict';
import { test } from 'node:test';
import { register } from 'node:module';
import { LunarUtil } from 'lunar-javascript';

register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (context.parentURL?.includes('/synastry/') && specifier.startsWith('.')
      && !['.ts', '.mjs', '.json'].some((suffix) => specifier.endsWith(suffix))) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  }
`), import.meta.url);

const { compareCharts } = await import('./compare.ts');
const { adaptInterpretationFacts } = await import('./interpretation-fact-adapter.ts');
const { assessMethods } = await import('./method-runtime.ts');
const { prepareSynastrySummary } = await import('./summary.ts');
const { collectEntryEvidence } = await import('../server/match-evidence.mjs');
const { openPassageCatalog } = await import('../server/knowledge/claims-sqlite.mjs');
const { compositeMidpoint, enrichWestern } = await import('./western-enrichment.ts');
const { enrichBaZi } = await import('./bazi-enrichment.ts');
const { enrichZiwei } = await import('./ziwei-enrichment.ts');
const { methodLibrary } = await import('./method-knowledge.ts');
const { algorithmDefinitions, algorithmDirections, comparisonDirections, enrichmentVersion } = await import('../model/algorithm-profiles.ts');
const { isConsistentMatchingFact } = await import('../server/matching/fact-integrity.mjs');
const { aspectComparisonEpsilon } = await import('./western-facts.ts');

const pillarPositions = ['year', 'month', 'day', 'hour'];
function bazi(symbols) {
  return { status: 'complete', engineName: 'lunar-javascript', engineVersion: '1.7.8',
    rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1',
    pillars: symbols.map((symbol, index) => ({
      position: pillarPositions[index], stem: symbol[0], branch: symbol[1],
      hiddenStems: LunarUtil.ZHI_HIDE_GAN[symbol[1]], shenSha: [], shenShaComplete: true,
    })) };
}
const aBazi = bazi(['甲申', '庚寅', '甲子', '庚戌']);
const bBazi = bazi(['己辰', '乙卯', '己丑', '乙亥']);

test('year-only symbols and directional day-to-year facts require their own real pillars', () => {
  const a = bazi(['甲子', '丙寅', '戊辰', '庚午']);
  const b = bazi(['乙丑', '丁卯', '己巳', '辛未']);
  const facts = enrichBaZi(a, b);
  const yearA = facts.find(f => f.rule === 'bazi-year-symbols' && f.direction === 'self_a');
  assert.equal(yearA.facts.animal, '鼠');
  assert.equal(yearA.facts.nayin, '海中金');
  const forward = facts.find(f => f.rule === 'bazi-day-to-year' && f.direction === 'a_to_b');
  const reverse = facts.find(f => f.rule === 'bazi-day-to-year' && f.direction === 'b_to_a');
  assert.deepEqual([forward.facts.observed, forward.facts.reference, forward.facts.label], ['戊', '乙', '正财']);
  assert.deepEqual([reverse.facts.observed, reverse.facts.reference, reverse.facts.label], ['己', '甲', '正财']);
  a.pillars.find(p => p.position === 'day').stem = null;
  assert.ok(!enrichBaZi(a, b).some(f => f.rule === 'bazi-day-to-year' && f.direction === 'a_to_b'));
  a.pillars[0].branch = '丑'; // 甲丑 is not a valid sexagenary year.
  assert.ok(!enrichBaZi(a, b).some(f => f.rule === 'bazi-year-symbols' && f.direction === 'self_a'));
});

function western(positions) {
  return { status: 'complete', engineName: 'astronomy-engine', engineVersion: '2.1.19',
    rulesetVersion: 'tropical-whole-sign-v1', zodiac: 'tropical', houseSystem: 'whole-sign',
    ascendant: 0, midheaven: 270, positions: positions.map(([planet, longitude]) => ({ planet, longitude })) };
}
function ziwei(shift) {
  const names = ['命宫', '兄弟', '夫妻', '子女', '财帛', '疾厄', '迁移', '仆役', '官禄', '田宅', '福德', '父母'];
  const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
  return { status: 'complete', engineName: 'iztro', engineVersion: '2.6.5',
    rulesetVersion: 'standard-new-year-leap-split-late-zi-current-v1',
    lifePalaceBranch: branches[shift], bodyPalaceBranch: branches[(shift + 1) % 12],
    palaces: names.map((name, index) => ({ name, earthlyBranch: branches[(index + shift) % 12],
      majorStars: [{ name: index === 0 ? '天机' : '星' + index, ...(index === 0 ? { mutagen: '禄' } : {}) }],
      minorStars: [], adjectiveStars: [] })) };
}

test('empty-palace context, neighbouring stars and self-transformation preserve native positions and distinct origins', () => {
  const chart = ziwei(0);
  chart.palaces[0].heavenlyStem = '甲';
  chart.palaces[0].stemTransformations = [{ marker: '禄', star: '天机' }, { marker: '权', star: '星1' },
    { marker: '科', star: '星2' }, { marker: '忌', star: '星3' }];
  chart.palaces[3].majorStars = [];
  const input = { bazi: aBazi, ziwei: chart };
  const before = JSON.stringify(chart);
  const run = () => enrichZiwei(input, { bazi: { status: 'unavailable' }, ziwei: { status: 'unavailable' } });
  const facts = run();
  const empty = facts.find(f => f.rule === 'ziwei-empty-palace-context');
  assert.deepEqual([empty.facts.sourceBranch, empty.facts.targetBranch, empty.facts.targetMajorStars], ['卯', '酉', '星9']);
  const neighbours = facts.find(f => f.rule === 'ziwei-adjacent-palace-context' && f.facts.branch === '子');
  assert.deepEqual([neighbours.facts.previousBranch, neighbours.facts.nextBranch], ['亥', '丑']);
  const self = facts.filter(f => f.rule === 'ziwei-palace-self-transformation');
  assert.equal(self.length, 1);
  assert.equal(self[0].facts.star, '天机');
  assert.equal(self[0].direction, 'self_a');
  const coexist = facts.find(f => f.rule === 'ziwei-native-self-transformation-coexistence');
  assert.deepEqual([coexist.facts.natalMarker, coexist.facts.flightMarker], ['禄', '禄']);
  assert.equal(JSON.stringify(chart), before);
  chart.palaces[1].majorStars.push({ name: '天机' });
  assert.ok(!run().some(f => f.rule === 'ziwei-palace-self-transformation'));
  chart.palaces[0].stemTransformations.pop();
  assert.ok(!run().some(f => f.rule === 'ziwei-palace-self-transformation'));
});

test('all 28 algorithm mappings reject every missing required field and incompatible direction', () => {
  assert.equal(algorithmDefinitions.length, 28);
  for (const definition of algorithmDefinitions) {
    const parameters = Object.fromEntries(definition.fields.split(' ').map(field => [field, '已计算']));
    if (definition.rule === 'ziwei-natal-palace') {
      Object.assign(parameters, { person: 'A', palace: '命宫', branch: '子',
        majorStars: '紫微', minorStars: '', adjectiveStars: '', lifePalace: 1, bodyPalace: 0 });
    }
    if (definition.rule === 'ziwei-natal-sector') {
      Object.assign(parameters, { person: 'A', source: '命宫', target: '命宫', sourceBranch: '子', targetBranch: '子',
        offset: 0, relation: '同支', sourceStars: '紫微', targetStars: '紫微' });
    }
    const aspectPairs = [['deviation', 'orb'], ['nativeDeviation', 'nativeOrb'], ['crossDeviation', 'crossOrb']]
      .filter(([deviation, orb]) => definition.fields.split(' ').includes(deviation) && definition.fields.split(' ').includes(orb));
    for (const [deviation, orb] of aspectPairs) { parameters[deviation] = 2; parameters[orb] = 5; }
    const directions = algorithmDirections(definition);
    const query = { system: definition.system, rule: definition.rule, direction: directions[0], parameters };
    const hit = ({ parameters, ...shape }) => isConsistentMatchingFact({ ...shape, facts: parameters });
    for (const direction of directions) {
      const side = direction === 'self_b' && parameters.person === 'A' ? { ...parameters, person: 'B' } : parameters;
      assert.ok(hit({ ...query, direction, parameters: side }), definition.rule + ':' + direction);
    }
    for (const direction of comparisonDirections.filter(d => !directions.includes(d))) {
      assert.ok(!hit({ ...query, direction }), definition.rule + ':invalid-direction:' + direction);
    }
    for (const [deviation, orb] of aspectPairs) {
      assert.ok(hit({ ...query, parameters: { ...parameters, [deviation]: 5 } }), definition.rule + ':inclusive-orb');
      assert.ok(hit({ ...query, parameters: { ...parameters, [deviation]: 5 + aspectComparisonEpsilon / 2 } }), definition.rule + ':floating-boundary');
      assert.ok(!hit({ ...query, parameters: { ...parameters, [deviation]: 5 + aspectComparisonEpsilon * 2 } }), definition.rule + ':outside-floating-boundary');
      assert.ok(!hit({ ...query, parameters: { ...parameters, [deviation]: 5.01 } }), definition.rule + ':beyond-orb');
      assert.ok(!hit({ ...query, parameters: { ...parameters, [deviation]: -1 } }), definition.rule + ':negative-deviation');
      assert.ok(!hit({ ...query, parameters: { ...parameters, [orb]: -1 } }), definition.rule + ':negative-orb');
      assert.ok(!hit({ ...query, parameters: { ...parameters, [orb]: '5' } }), definition.rule + ':non-numeric-orb');
    }
    for (const field of definition.requiredFields.split(' ')) {
      const missing = { ...parameters };
      delete missing[field];
      assert.ok(!hit({ ...query, parameters: missing }), definition.rule + ':' + field);
    }
    for (const field of definition.fields.split(' ').filter(field => !definition.requiredFields.split(' ').includes(field))) {
      const optionalAbsent = { ...parameters };
      delete optionalAbsent[field];
      assert.ok(hit({ ...query, parameters: optionalAbsent }), definition.rule + ':optional:' + field);
    }
  }
});

test('keeps natal hidden elements and cross-chart member provenance without mutating charts', () => {
  const before = JSON.stringify([aBazi, bBazi]);
  const facts = enrichBaZi(aBazi, bBazi);
  const fire = facts.find(({ rule, facts }) => rule === 'bazi-natal-element-count' && facts.person === 'A' && facts.element === '火');
  assert.equal(fire.facts.visibleCount, 0);
  assert.ok(fire.facts.hiddenCount > 0);
  assert.equal(fire.facts.hiddenComplete, 1);
  assert.ok(facts.some(({ rule, facts }) => rule === 'bazi-stem-competition' && facts.members.includes('A:') && facts.members.includes('B:')));
  assert.equal(JSON.stringify([aBazi, bBazi]), before);
  const archA = bazi(['庚申', '乙卯', '甲寅', '乙丑']);
  const archB = bazi(['戊辰', '丁巳', '辛酉', '己未']);
  assert.ok(enrichBaZi(archA, archB).some(({ rule, facts }) => rule === 'bazi-branch-arch' && facts.missingBranch === '子'));
  archB.pillars[1].branch = '子';
  assert.ok(!enrichBaZi(archA, archB).some(({ rule, facts }) => rule === 'bazi-branch-arch' && facts.missingBranch === '子'));
});

test('handles circular composite coordinates and stops derived contacts for ambiguous midpoints', () => {
  assert.equal(compositeMidpoint(350, 10).longitude, 0);
  assert.deepEqual(compositeMidpoint(350, 10), compositeMidpoint(10, 350));
  assert.deepEqual(compositeMidpoint(0, 180), compositeMidpoint(180, 0));
  assert.equal(compositeMidpoint(0, 180).status, 'ambiguous');
  assert.equal(compositeMidpoint(0, 180).alternateLongitude, 270);
  const facts = enrichWestern(western([['Sun', 0], ['Moon', 120]]), western([['Sun', 180], ['Moon', 120]]));
  assert.ok(facts.some(({ rule, facts }) => rule === 'western-composite-midpoint' && facts.planet === 'Sun' && facts.status === 'ambiguous'));
  assert.ok(!facts.some(({ rule, facts }) => rule === 'western-composite-aspect' && [facts.first, facts.second].includes('Sun')));
  assert.ok(!facts.some(({ rule, facts }) => rule === 'western-composite-natal-aspect' && facts.compositePlanet === 'Sun'));
});

test('normal comparison routes enriched facts to knowledge, methods and the full AI request', () => {
  const a = { mode: 'manual_subject', chart: { calculatedAt: '2020-01-01T00:00:00Z',
    bazi: aBazi, ziwei: ziwei(0), western: western([['Sun', 350], ['Moon', 110], ['Mercury', 80], ['Venus', 65]]) } };
  const b = { mode: 'manual_subject', chart: { calculatedAt: '2020-01-02T00:00:00Z',
    bazi: bBazi, ziwei: ziwei(1), western: western([['Sun', 10], ['Moon', 130], ['Mercury', 95], ['Venus', 115]]) } };
  a.chart.birthContext = { precision: 'minute', birthInstant: '1994-09-08T07:06:00.000Z',
    latitude: 37.1234567, longitude: 112.2345678, timeZone: 'Asia/Shanghai', clockVersion: 'gregory-iana-intl-v1' };
  Object.assign(a.chart.ziwei.palaces[0].majorStars[0], {
    brightness: '旺', brightnessProfile: 'fixture-profile', mutagenOrigin: 'birth_year',
  });
  const comparison = compareCharts(a, b);
  const facts = adaptInterpretationFacts(comparison);
  const methods = assessMethods(facts);
  const enriched = facts.filter(({ ruleVersion }) => ruleVersion === enrichmentVersion);
  assert.ok(enriched.length > 100);
  assert.equal(methods.length, 98);
  assert.equal(methods.find(({ methodId }) => methodId === 'WA-M21').status, 'not_implemented');
  assert.equal(methods.find(({ methodId }) => methodId === 'WA-M17').status, 'partial_facts_available');
  const body = prepareSynastrySummary(comparison);
  assert.deepEqual(Object.keys(body).sort(), ['facts', 'rulesVersion']);
  assert.ok(body.facts.length >= facts.length);
  assert.ok(body.facts.some(({ rule, direction }) => rule === 'western-composite-midpoint' && direction === 'whole'));
  assert.ok(body.facts.some(({ rule, direction }) => rule === 'ziwei-natal-palace' && direction === 'self_b'));
  assert.doesNotMatch(JSON.stringify(body), /snapshotId|calculatedAt|birthContext|birthInstant|1994-09-08|37\.1234567|112\.2345678|Asia\/Shanghai|fixture-profile/);
  assert.ok(body.facts.some(({ direction, facts }) => direction === 'self_a' && facts.starBrightness === '天机（旺）'));
  assert.ok(body.facts.some(({ direction, facts }) => direction === 'self_a' && facts.mutagenOrigin === 'birth_year'));
  assert.ok(!body.facts.some(({ direction, facts }) => direction === 'self_b' && (facts.starBrightness || facts.mutagenOrigin)));
  const knowledge = openPassageCatalog(':memory:');
  try {
    const evidence = collectEntryEvidence(JSON.parse(JSON.stringify(body)), knowledge);
    assert.equal(evidence.chartFacts.length, facts.length);
    const chartIds = new Set(evidence.chartFacts.map(({ id }) => id));
    assert.ok(evidence.chartFacts.some(({ rule }) => rule === 'western-luminary-sign-aspect'));
    assert.ok(evidence.hits.every(({ id, proofs }) =>
      knowledge.getClaim(id)?.originalText && proofs.every(({ factId }) => chartIds.has(factId))));
    const partial = { ...b, chart: { ...b.chart,
      bazi: { ...b.chart.bazi, status: 'partial', pillars: b.chart.bazi.pillars.filter(({ position }) => position !== 'hour') },
      ziwei: { ...b.chart.ziwei, status: 'unavailable', reason: 'ambiguous_time' },
      western: { ...b.chart.western, status: 'partial', positions: [{ planet: 'Sun', signIndex: 0 }] },
    } };
    const limited = collectEntryEvidence(prepareSynastrySummary(compareCharts(a, partial)), knowledge);
    assert.ok(limited.chartFacts.some(({ rule }) => rule === 'western-signs'));
    assert.ok(limited.chartFacts.some(({ rule }) => rule === 'relative-ten-god'));
    assert.ok(!limited.chartFacts.some(({ rule }) => rule === 'day-master-strength-context' || rule === 'western-cross-aspect'));
  } finally {
    knowledge.close();
  }
  const branchToPalace = facts.find(({ rule, direction }) => rule === 'ziwei-birth-year-overlay' && direction === 'a_to_b');
  assert.equal(branchToPalace.facts.yearBranch, '申');
  assert.equal(branchToPalace.facts.target, '仆役');
  const sector = facts.find(({ rule, direction, facts }) =>
    rule === 'ziwei-natal-sector' && direction === 'self_a' && facts.source === '命宫' && facts.offset === 4);
  assert.equal(sector.facts.targetBranch, '辰');
  assert.ok(facts.some(({ rule, facts }) => rule === 'cross-pillar-ten-god' && facts.position === 'day' && facts.layer === 'visible'));
  for (const fact of enriched) {
    assert.ok(algorithmDefinitions.some(({ system, rule }) => system === fact.system && rule === fact.rule));
    assert.ok(fact.methodRefs.every((id) => methodLibrary.methodLibrary.methods.some(({ methodId }) => methodId === id)));
  }
});
