import assert from 'node:assert/strict';
import { register } from 'node:module';
import { test } from 'node:test';
import catalog from './structured-report.fixture.mjs';

register('data:text/javascript,' + encodeURIComponent(`
  export function resolve(specifier, context, next) {
    if (context.parentURL?.includes('/synastry/') && specifier.startsWith('.')
      && !['.ts', '.mjs', '.json'].some((suffix) => specifier.endsWith(suffix))) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  }`), import.meta.url);
const { compareCharts, hasUnknownBirthTime, comparisonRulesVersion } = await import('./compare.ts');
const { buildRelationshipReport } = await import('./relationship-report.ts');
const { prepareSynastrySummary } = await import('./summary.ts');
const { createInterpretationRepository, retrieveInterpretations, searchInterpretationAliases } = await import('./interpretation.ts');
const { adaptInterpretationFacts } = await import('./interpretation-fact-adapter.ts');
const { buildInterpretationContext, validateInterpretationOutput } = await import('./interpretation-context.ts');
const { validateCombinationCatalog, matchCombinations } = await import('./interpretation-combinations.ts');

const atomsCatalog = { version: catalog.version, sources: catalog.sources };
const variantsCatalog = catalog.variants;
const combinationsCatalog = catalog.combinations;

function reviewed(item, overrides = {}) {
  return { ...item, chartRulesets: ['fixture-v1'], reviewStatus: 'approved',
    review: { reviewer: 'Test fixture', date: '2020-01-01', reference: 'Synthetic rule' }, ...overrides };
}

function repository(...entries) {
  const atoms = [];
  const variants = [];
  for (const { theme, polarity, scenes, ...atom } of entries) {
    atoms.push(atom);
    for (const [relationshipType, scene] of Object.entries(scenes)) {
      variants.push({ ...scene, id: atom.id + ':' + relationshipType, knowledgeId: atom.id,
        relationshipType, theme, polarity, practicalGuidance: [], limitations: [], conditions: [], exclusions: [],
        sourceIds: atom.sourceIds, reviewStatus: atom.reviewStatus, review: atom.review, version: atom.version });
    }
  }
  return createInterpretationRepository({ ...catalog, atoms, variants });
}

const version = { engineName: 'fixture', engineVersion: '1', rulesetVersion: 'fixture-v1' };
const complete = { ...version, status: 'complete' };
const unavailable = { ...version, status: 'unavailable', reason: 'ambiguous_time' };
const western = { ...complete, zodiac: 'tropical', houseSystem: 'whole-sign' };
const pillar = (position, stem, branch) => ({ position, stem, branch, hiddenStems: null, shenSha: [], shenShaComplete: true });
const palace = (name, earthlyBranch, majorStars = []) => ({ name, earthlyBranch, majorStars, minorStars: [], adjectiveStars: [] });
const a = {
  mode: 'account_owner',
  chart: {
    calculatedAt: '2020-01-01T00:00:00Z', snapshotId: 'owner-archive',
    bazi: { ...complete, pillars: [pillar('day', '甲', '子'), pillar('hour', '己', '未')] },
    ziwei: { ...complete, lifePalaceBranch: '子', bodyPalaceBranch: '丑',
      palaces: [palace('命宫', '子', [{ name: '天机', mutagen: '禄' }]), palace('财帛', '丑')] },
    western: { ...western, ascendant: 0, positions: [{ planet: 'Sun', longitude: 359 }] },
  },
};
const b = {
  mode: 'manual_subject',
  chart: {
    calculatedAt: '2020-01-02T00:00:00Z',
    bazi: { ...complete, pillars: [pillar('day', '丙', '丑'), pillar('hour', '庚', '午')] },
    ziwei: { ...complete, lifePalaceBranch: '丑', bodyPalaceBranch: '子',
      palaces: [palace('官禄', '子'), palace('命宫', '丑')] },
    western: { ...western, ascendant: 30, positions: [{ planet: 'Sun', longitude: 1 }] },
  },
};

test('compares three systems with source positions, direction and wraparound angles', () => {
  const { sections: [bazi, ziwei, stars] } = compareCharts(a, b);
  assert.ok(bazi.evidence.some(({ rule, direction }) => rule === 'day-stem-elements' && direction === 'a_to_b'));
  assert.deepEqual(bazi.evidence.filter(({ rule }) => rule === 'relative-ten-god')
    .map(({ direction, facts }) => [direction, facts.observed, facts.reference]),
  [['a_to_b', '甲', '丙'], ['b_to_a', '丙', '甲']]);
  assert.ok(bazi.evidence.some(({ rule }) => rule === 'branch-union'));
  assert.ok(bazi.evidence.some(({ rule }) => rule === 'branch-opposition'));
  assert.ok(ziwei.evidence.some(({ rule, sources }) =>
    rule === 'ziwei-transformation-by-branch' && sources[1] === 'B 官禄 · 子'));
  assert.ok(stars.evidence.some(({ observation }) => observation === '同名天体角距 2.00°'));
  assert.ok(stars.evidence.some(({ direction, sources }) => direction === 'a_to_b' && sources[1] === 'B 第 11 宫'));
});

test('prepares complete comparison facts for AI even when no library entry matches', () => {
  const comparison = compareCharts(a, b);
  const report = buildRelationshipReport(comparison, repository());
  const body = prepareSynastrySummary(comparison);
  assert.deepEqual(Object.keys(body).sort(), ['facts', 'rulesVersion']);
  assert.equal(body.rulesVersion, comparisonRulesVersion);
  assert.deepEqual(new Set(body.facts.map(({ system }) => system)), new Set(['bazi', 'ziwei', 'western']));
  assert.ok(body.facts.some(({ rule, facts }) => rule === 'branch-union' && facts.aBranch === '子' && facts.bBranch === '丑'));
  assert.deepEqual(body.facts.map(({ system, rule, direction, sources, observation, facts }) =>
    ({ system, rule, direction, sources, observation, facts })),
  report.facts.map(({ system, rule, direction, sources, observation, facts }) =>
    ({ system, rule, direction, sources, observation, facts })));
  assert.doesNotMatch(JSON.stringify(body), /owner-archive|2020-01-0[12]/u);
});

test('uses only confirmed fields when an exact birth time is unavailable', () => {
  const partial = { ...b, chart: { ...b.chart,
    bazi: { ...complete, status: 'partial', pillars: [pillar('day', '丙', '丑'), pillar('hour', null, null)] },
    ziwei: unavailable,
    western: { ...western, status: 'partial', positions: [{ planet: 'Sun', signIndex: 0 }] },
  } };
  assert.equal(hasUnknownBirthTime(partial.chart), true);
  assert.equal(hasUnknownBirthTime({ ...a.chart, timeKnown: false }), true);
  assert.equal(hasUnknownBirthTime(b.chart), false);
  assert.equal(hasUnknownBirthTime({ ...b.chart, ziwei: { ...unavailable, reason: 'not_calculated' } }), false);
  const { sections: [bazi, ziwei, stars] } = compareCharts(a, partial);
  assert.ok(bazi.limitation);
  assert.ok(bazi.evidence.filter(({ scope }) => scope !== 'intra').every(({ sources }) => !sources[1].includes('时柱')));
  assert.ok(ziwei.evidence.every(({ direction }) => direction === 'self_a'));
  assert.ok(ziwei.limitation);
  assert.deepEqual(stars.evidence.map(({ rule }) => rule), ['western-signs']);
});

test('keeps the account owner and the manually entered subject distinct', () => {
  assert.throws(() => compareCharts(a, a), /本人盘面及一份对方盘面/);
  const report = compareCharts(a, b);
  assert.equal(report.a.mode, 'account_owner');
  assert.equal(report.b.mode, 'manual_subject');
  const manual = compareCharts({ mode: 'manual_subject', chart: a.chart }, b);
  assert.equal(manual.a.mode, 'manual_subject');
  assert.throws(() => compareCharts({ ...b }, b), /分别选择/);
});

test('uses inclusive orb boundaries and keeps exact angles and both source coordinates', () => {
  const chart = (longitude) => ({ ...b.chart, western: {
    ...b.chart.western, positions: [{ planet: 'Mercury', longitude }],
  } });
  const first = { ...a, chart: chart(359) };
  const atBoundary = compareCharts(first, { ...b, chart: chart(63) }).sections[2].evidence
    .find(({ rule }) => rule === 'western-cross-aspect');
  assert.deepEqual(atBoundary.facts, {
    aPlanet: 'Mercury', bPlanet: 'Mercury', aLongitude: 359, bLongitude: 63,
    degrees: 64, deviation: 4, angle: 60, orb: 4,
  });
  assert.ok(!compareCharts(first, { ...b, chart: chart(63.01) }).sections[2].evidence
    .some(({ rule }) => rule === 'western-cross-aspect'));
});

test('preserves independent BaZi combinations, cross-chart provenance and strength conditions', () => {
  const full = (values) => ({ ...complete, pillars: values.map(([stem, branch, hidden], index) => ({
    ...pillar(['year', 'month', 'day', 'hour'][index], stem, branch), hiddenStems: [...hidden],
  })) });
  const left = full([['庚', '申', '庚壬戊'], ['癸', '卯', '乙'], ['甲', '子', '癸'], ['戊', '辰', '戊乙癸']]);
  left.pillars[3].shenSha.push({ name: '华盖', sourcePillars: ['year', 'day'] });
  const right = full([['戊', '辰', '戊乙癸'], ['丙', '午', '丁己'], ['己', '未', '己丁乙'], ['庚', '午', '丁己']]);
  const compare = (aChart, bChart) => compareCharts({ ...a, chart: { ...a.chart, bazi: aChart } },
    { ...b, chart: { ...b.chart, bazi: bChart } }).sections[0];
  const section = compare(left, right);
  const dayPair = section.evidence.filter(({ facts }) => facts?.aPosition === 'day' && facts.bPosition === 'day');
  assert.ok(dayPair.some(({ rule }) => rule === 'branch-harm'));
  const five = dayPair.find(({ rule }) => rule === 'stem-combination');
  assert.equal(five.facts.combinationElement, '土');
  assert.equal(five.facts.aMonthRelation, 'peer');
  const strength = section.evidence.find(({ rule }) => rule === 'day-master-strength-context').facts;
  assert.equal(strength.aRootCount, 2);
  assert.equal(strength.aMainQiRoots, 1);
  assert.equal(strength.aVisibleSupportCount, 1);
  assert.equal(strength.aRootPositions, 'month:1,hour:2');
  assert.ok(section.evidence.some(({ rule, direction, facts }) =>
    rule === 'cross-pillar-ten-god' && direction === 'a_to_b' && facts.position === 'month' && facts.layer === 'hidden'));
  const triple = section.evidence.find(({ rule, facts }) => rule === 'branch-group' && facts.combination === '申子辰');
  assert.equal(triple.facts.bPositions, 'year');
  assert.equal(triple.facts.formation, 'also_natal');
  assert.ok(section.evidence.some(({ rule, direction, facts }) => rule === 'cross-branch-natal-marker'
    && direction === 'a_to_b' && facts.name === '华盖' && facts.sourcePosition === 'hour' && facts.targetPosition === 'year'));
  const withoutThird = full([['丁', '巳', '丙庚戊'], ['丙', '午', '丁己'], ['己', '未', '己丁乙'], ['庚', '午', '丁己']]);
  assert.ok(!compare(left, withoutThird).evidence.some(({ rule, facts }) => rule === 'branch-group' && facts.combination === '申子辰'));
  const withoutRoots = { ...right, pillars: right.pillars.map((item) => ({ ...item, hiddenStems: null })) };
  const limited = compare(left, withoutRoots);
  assert.ok(limited.unavailableRules.includes('day-master-strength-context'));
  assert.ok(!limited.evidence.some(({ rule }) => rule === 'day-master-strength-context'));
  assert.ok(!('aRootCount' in limited.evidence.find(({ rule }) => rule === 'stem-combination').facts));
});

test('calculates strength only from complete known pillars and keeps the actual rank of partial hidden stems', () => {
  const full = (chart) => ({ ...chart, bazi: { ...complete, pillars: [
    { ...pillar('year', '庚', '申'), hiddenStems: ['庚', '壬', '戊'] },
    { ...pillar('month', '庚', '寅'), hiddenStems: ['甲', '丙', '戊'] },
    { ...pillar('day', '甲', '子'), hiddenStems: ['癸'] },
    { ...pillar('hour', '戊', '辰'), hiddenStems: ['戊', '乙', '癸'] },
  ] } });
  const owner = { ...a, chart: full(a.chart) };
  const target = full(b.chart);
  const request = (chart) => prepareSynastrySummary(compareCharts(owner, { ...b, chart }));
  const original = request(target).facts.find(({ rule }) => rule === 'day-master-strength-context');
  assert.equal(original.facts.bMonthMainStem, '甲');
  assert.equal(original.facts.bRootPositions, 'month:1,hour:2');
  assert.equal(original.facts.bRootCount, 2);
  assert.equal(original.facts.bVisibleSupportCount, 0);
  const changeMonth = (hiddenStems) => ({ ...target, bazi: { ...target.bazi, pillars: target.bazi.pillars.map((item) =>
    item.position === 'month' ? { ...item, hiddenStems } : item) } });
  const reordered = request(changeMonth(['戊', '丙', '甲']));
  assert.deepEqual(reordered.facts.find(({ rule }) => rule === 'day-master-strength-context'), original);
  const partial = request(changeMonth(['丙', '戊']));
  assert.ok(!partial.facts.some(({ rule, direction }) => rule === 'day-master-strength-context'
    || rule === 'bazi-natal-strength-context' && direction === 'self_b'));
  assert.ok(partial.facts.some(({ rule, direction, facts }) => rule === 'cross-pillar-ten-god' && direction === 'b_to_a'
    && facts.position === 'month' && facts.observed === '丙' && facts.layer === 'hidden' && facts.rank === 2));
  assert.ok(partial.facts.filter(({ rule, direction }) => rule === 'bazi-natal-element-count' && direction === 'self_b')
    .every(({ facts }) => facts.hiddenComplete === 0));
});

test('matches both Ziwei sectors and configured flights without treating old snapshots as full coverage', () => {
  const twelve = '子丑寅卯辰巳午未申酉戌亥';
  const source = [...twelve].map((branch, index) => palace(index === 0 ? '命宫' : '原宫'+index, branch));
  const target = [...twelve].map((branch, index) => palace(({0:'父母',4:'夫妻',6:'官禄',8:'命宫'})[index] ?? '对宫'+index, branch));
  for (const [index, name] of [[6, '太阳'], [1, '廉贞'], [2, '破军'], [3, '武曲']]) source[index].majorStars.push({ name });
  const compare = (palaces) => compareCharts(
    { ...a, chart: { ...a.chart, ziwei: { ...a.chart.ziwei, palaces } } },
    { ...b, chart: { ...b.chart, ziwei: { ...b.chart.ziwei, palaces: target } } },
  );
  const old = compare(source);
  const oldZiwei = old.sections[1];
  assert.equal(oldZiwei.evidence.filter(({ rule }) => rule === 'ziwei-cross-palace-sector').length, 96);
  assert.ok(oldZiwei.evidence.some(({ rule, direction, facts }) => rule === 'ziwei-cross-palace-sector'
    && direction === 'a_to_b' && facts.source === '命宫' && facts.target === '夫妻' && facts.offset === 4));
  assert.ok(oldZiwei.unavailableRules.includes('ziwei-palace-stem-flight-overlay'));
  const flight = catalog.entries.find(({ id }) => id === 'ZIWEI-PALACE-STEM-CAREER-FLIGHT');
  const fixtures = repository(reviewed(flight));
  assert.equal(buildRelationshipReport(old, fixtures).relationships[3].coverage, 'insufficient_data');
  assert.ok(!oldZiwei.evidence.some(({ rule }) => rule === flight.factRule));
  const configured = source.map((item, index) => index === 0 ? { ...item, heavenlyStem: '甲',
    stemTransformations: [
      { marker: '禄', star: '廉贞' }, { marker: '权', star: '破军' }, { marker: '科', star: '武曲' }, { marker: '忌', star: '太阳' },
    ],
  } : item);
  const result = compare(configured);
  const landing = result.sections[1].evidence.find(({ rule, facts }) => rule === flight.factRule && facts.marker === '忌');
  assert.equal(landing.direction, 'a_to_b');
  assert.equal(landing.facts.nativeLanding, '原宫6');
  assert.equal(landing.facts.target, '官禄');
  assert.equal(buildRelationshipReport(result, fixtures).relationships[3].neutral[0].knowledge.id, flight.id);
});

test('constructs both Ziwei sector facts from unique palace coordinates', () => {
  const target = { ...b, chart: { ...b.chart, ziwei: { ...b.chart.ziwei, palaces: [
    palace('官禄', '子'), palace('财帛', '子'), palace('迁移', '午'), palace('命宫', '丑'),
    palace('兄弟', '寅'), palace('兄弟', '亥'),
  ] } } };
  const { facts } = prepareSynastrySummary(compareCharts(a, target));
  const cross = facts.filter(({ rule, direction, facts: fields }) => rule === 'ziwei-cross-palace-sector'
    && direction === 'a_to_b' && fields.source === '命宫');
  assert.deepEqual(cross.map(({ facts: fields }) => [fields.target, fields.sourceBranch, fields.targetBranch, fields.offset, fields.relation]),
    [['迁移', '子', '午', 6, '对宫']]);
  assert.ok(!facts.some(({ rule, direction, facts: fields }) => rule === 'ziwei-palace-by-branch'
    && direction === 'a_to_b' && fields.source === '命宫'));
  const natal = facts.filter(({ rule, direction }) => rule === 'ziwei-natal-palace' && direction === 'self_b');
  assert.deepEqual(natal.map(({ facts: fields }) => fields.branch), ['午', '丑']);
});

test('emits Western angle and aspect records only from finite, unambiguous coordinates', () => {
  const chart = (subject, positions) => ({ ...subject, chart: { ...subject.chart, western: { ...subject.chart.western,
    rulesetVersion: 'tropical-whole-sign-v1', positions } } });
  const left = chart(a, [
    { planet: 'Sun', longitude: 0 }, { planet: 'Sun', longitude: 360 }, { planet: 'Moon', longitude: -1 },
    { planet: 'Mars', longitude: NaN }, { planet: 'Mercury', longitude: 45 }, { planet: 'Mercury', longitude: 90 },
  ]);
  const right = chart(b, [
    { planet: 'Sun', longitude: 90 }, { planet: 'Moon', longitude: 1 }, { planet: 'Mars', longitude: 3 }, { planet: 'Mercury', longitude: 6 },
  ]);
  const request = prepareSynastrySummary(compareCharts(left, right));
  assert.deepEqual(JSON.parse(JSON.stringify(request)), request);
  const angles = request.facts.filter(({ rule }) => rule === 'western-matching-planet-angle');
  assert.deepEqual(angles.map(({ facts }) => [facts.planet, facts.aLongitude, facts.bLongitude, facts.degrees]),
    [['Sun', 0, 90, 90], ['Moon', 359, 1, 2]]);
  const cross = request.facts.filter(({ rule }) => rule === 'western-cross-aspect');
  const square = cross.find(({ facts }) => facts.aPlanet === 'Sun' && facts.bPlanet === 'Sun');
  assert.deepEqual(square.facts, { aPlanet: 'Sun', bPlanet: 'Sun', aLongitude: 0, bLongitude: 90,
    angle: 90, degrees: 90, deviation: 0, orb: 5 });
  assert.match(square.observation, /四分相/u);
  const conjunction = cross.find(({ facts }) => facts.aPlanet === 'Moon' && facts.bPlanet === 'Moon');
  assert.equal(conjunction.facts.angle, 0);
  assert.equal(conjunction.facts.deviation, 2);
  assert.ok(cross.every(({ facts }) => facts.aPlanet !== 'Mars' && facts.aPlanet !== 'Mercury'));
});

test('links Western axes and traditional house rulers using exact coordinates', () => {
  const aPositions = { Sun: 356, Moon: 270, Mercury: 20, Venus: 170, Mars: 359, Jupiter: 40, Saturn: 60, Uranus: 75, Neptune: 130, Pluto: 180 };
  const bPositions = { ...aPositions, Mercury: 50 };
  const aWestern = { ...western, ascendant: 0, midheaven: 274,
    positions: Object.entries(aPositions).map(([planet, longitude]) => ({ planet, longitude })) };
  const bWestern = { ...western, ascendant: 350, midheaven: 90,
    positions: Object.entries(bPositions).map(([planet, longitude]) => ({ planet, longitude })) };
  const compare = (target) => compareCharts({ ...a, chart: { ...a.chart, western: aWestern } },
    { ...b, chart: { ...b.chart, western: target } }).sections[2];
  const stars = compare(bWestern);
  const find = (rule, matches) => stars.evidence.find((item) => item.rule === rule && matches(item.facts, item.direction));
  assert.equal(find('western-planet-to-axis', (facts, direction) =>
    direction === 'a_to_b' && facts.planet === 'Venus' && facts.axis === 'DSC').facts.axisLongitude, 170);
  assert.equal(find('western-planet-to-axis', (facts, direction) =>
    direction === 'a_to_b' && facts.planet === 'Moon' && facts.axis === 'IC').facts.axisLongitude, 270);
  assert.equal(find('western-planet-to-axis', (facts, direction) =>
    direction === 'a_to_b' && facts.planet === 'Sun' && facts.axis === 'ASC').facts.deviation, 6);
  assert.equal(find('western-axis-aspect', ({ aAxis, bAxis }) => aAxis === 'MC' && bAxis === 'MC').facts.degrees, 176);
  assert.equal(find('western-house-ruler-overlay', (facts, direction) => direction === 'a_to_b' && facts.house === 7).facts.targetHouse, 7);
  const seventhRulers = find('western-ruler-to-ruler', ({ aHouse, bHouse }) => aHouse === 7 && bHouse === 7).facts;
  assert.deepEqual([seventhRulers.aRuler, seventhRulers.bRuler, seventhRulers.angle], ['Venus', 'Mercury', 120]);
  const lackingMC = compare({ ...bWestern, midheaven: undefined });
  assert.ok(lackingMC.unavailableRules.includes('western-planet-to-axis'));
  assert.ok(!lackingMC.evidence.some(({ rule, direction, facts }) =>
    rule === 'western-planet-to-axis' && direction === 'a_to_b' && ['MC', 'IC'].includes(facts.axis)));
  const draft = retrieveInterpretations({ factId: 'axis-fixture', rule: 'western-planet-to-axis', system: 'western',
    direction: 'a_to_b', ruleVersion: comparisonRulesVersion, chartRulesets: ['tropical-whole-sign-v1', 'tropical-whole-sign-v1'],
    parameters: find('western-planet-to-axis', (facts, direction) =>
      direction === 'a_to_b' && facts.planet === 'Venus' && facts.axis === 'DSC').facts,
    requestedRelationships: ['romance'] },
  repository(catalog.entries.find(({ id }) => id === 'WEST-VENUS-DSC-CONJUNCTION')));
  assert.ok(draft.traces.some(({ knowledgeId, status }) => knowledgeId === 'WEST-VENUS-DSC-CONJUNCTION' && status === 'pending_review'));
});

test('preserves support and friction together with deduplication and chart references', () => {
  const left = { ...a, chart: { ...a.chart, western: { ...a.chart.western, positions: [
    { planet: 'Moon', longitude: 0 }, { planet: 'Venus', longitude: 0 },
  ] } } };
  const right = { ...b, chart: { ...b.chart, western: { ...b.chart.western, positions: [
    { planet: 'Moon', longitude: 180 }, { planet: 'Mars', longitude: 60 },
  ] } } };
  const result = compareCharts(left, right);
  result.sections[0].evidence.push(...result.sections[0].evidence);
  const union = catalog.entries.find(({ id }) => id === 'BAZI-DAY-BRANCH-UNION');
  const fixtures = repository(...catalog.entries.map((item) => reviewed(item,
    item.id === 'WEST-MOON-OPPOSITION' ? { theme: union.theme } : {})));
  const report = buildRelationshipReport(result, fixtures);
  assert.deepEqual(report, buildRelationshipReport(result, fixtures));
  assert.deepEqual(report.relationships.map(({ type }) => type), ['family', 'friendship', 'romance', 'collaboration']);
  const romance = report.relationships.find(({ type }) => type === 'romance');
  assert.equal(romance.positive.status, 'present');
  assert.equal(romance.negative.status, 'present');
  assert.equal(romance.positive.items.filter(({ rule }) => rule === 'branch-union').length, 1);
  const [friction] = romance.negative.items;
  assert.equal(friction.chartRefs.a.snapshotId, 'owner-archive');
  assert.equal(friction.chartRefs.b.calculatedAt, b.chart.calculatedAt);
  assert.equal(friction.ruleVersion, result.rulesVersion);
  assert.equal(friction.facts.angle, 180);
  assert.equal(friction.knowledge.id, 'WEST-MOON-OPPOSITION');
  assert.ok(friction.references.every(({ title }) => title));
  assert.ok(report.facts.some(({ id }) => id === friction.factId));
  const theme = romance.themes.find(({ themeId }) => themeId === union.theme);
  assert.equal(theme.crossSystemAgreement, 'divergent');
  assert.ok(theme.supportiveIds.length > 0 && theme.challengingIds.includes(friction.id));
  assert.ok(report.relationships.find(({ type }) => type === 'friendship').negative.status === 'insufficient_data');
});

test('distinguishes coverage gaps from an enabled rule with no matches', () => {
  const names = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const chart = (longitude) => ({ ...b.chart, western: {
    ...b.chart.western, positions: names.map((planet) => ({ planet, longitude })),
  } });
  const moon = catalog.entries.find(({ id }) => id === 'WEST-MOON-OPPOSITION');
  const fixtures = repository(reviewed(moon), reviewed(moon, { id: 'TEST-SUPPORT', polarity: 'supportive' }));
  const comparison = compareCharts({ ...a, chart: chart(0) }, { ...b, chart: chart(30) });
  const uncovered = buildRelationshipReport(comparison, fixtures).relationships[0];
  assert.ok(uncovered.gaps.uncoveredFactIds.length > 0);
  assert.equal(uncovered.positive.status, 'insufficient_data');
  assert.equal(uncovered.negative.status, 'insufficient_data');
  const scoped = { ...comparison, sections: comparison.sections.map((section) => ({
    ...section, evidence: section.evidence.filter(({ rule }) => rule === moon.factRule),
  })) };
  const family = buildRelationshipReport(scoped, fixtures).relationships[0];
  assert.equal(family.coverage, 'complete');
  assert.equal(family.positive.status, 'none_found');
  assert.equal(family.negative.status, 'none_found');
  const unsupported = { ...b, chart: { ...b.chart, western: { ...chart(30).western, rulesetVersion: 'older-policy' } } };
  const limited = buildRelationshipReport(compareCharts(a, unsupported), fixtures);
  assert.equal(limited.coverage.western, 'unavailable');
  assert.equal(limited.relationships[0].negative.status, 'insufficient_data');
});

const query = {
  factId: 'western-1', rule: 'western-cross-aspect', system: 'western', direction: 'mutual',
  ruleVersion: 'synastry-facts-v2', chartRulesets: ['fixture-v1', 'fixture-v1'],
  parameters: { aPlanet: 'Mercury', bPlanet: 'Mercury', angle: 90, degrees: 95, deviation: 5, orb: 5 },
  requestedRelationships: ['family', 'friendship', 'romance', 'collaboration'],
};

test('filters school and review status and routes only approved scene-specific matches', () => {
  const mercury = catalog.entries.find(({ id }) => id === 'WEST-MERCURY-SQUARE');
  const fixtures = repository(reviewed(mercury), reviewed(mercury, { id: 'SECOND' }),
    reviewed(mercury, { id: 'IN-REVIEW', reviewStatus: 'in_review' }),
    reviewed(mercury, { id: 'OLD', reviewStatus: 'deprecated' }),
    reviewed(mercury, { id: 'OTHER-SCHOOL', chartRulesets: ['other'] }));
  const result = retrieveInterpretations(query, fixtures);
  assert.deepEqual(result.matches.map(({ trace }) => [trace.relationship, trace.knowledgeId]),
    [['friendship', mercury.id], ['friendship', 'SECOND'], ['collaboration', mercury.id], ['collaboration', 'SECOND']]);
  assert.notEqual(result.matches[0].scene.interpretation, result.matches[2].scene.interpretation);
  for (const status of ['pending_review', 'deprecated', 'incompatible_version', 'unsupported_relationship']) {
    assert.ok(result.traces.some((trace) => trace.status === status));
  }
  const wrong = retrieveInterpretations({ ...query, system: 'ziwei' }, fixtures);
  assert.ok(wrong.traces.every(({ status }) => status === 'no_knowledge_entry'));
});

test('rejects malformed catalogs and separates excluded, missing and out-of-orb facts', () => {
  const mercury = catalog.entries.find(({ id }) => id === 'WEST-MERCURY-SQUARE');
  assert.throws(() => repository(reviewed(mercury, { review: undefined })), TypeError);
  assert.throws(() => repository(reviewed(mercury, {
    review: { reviewer: 'Test fixture', date: '2020-02-31', reference: 'Invalid date' },
  })), TypeError);
  assert.throws(() => repository(mercury, mercury), TypeError);
  assert.throws(() => repository({ ...mercury, sourceIds: ['UNKNOWN'] }), TypeError);
  assert.throws(() => repository({ ...mercury, theme: 'made-up' }), TypeError);
  assert.throws(() => repository({ ...mercury, factRule: 'mock-rule' }), /Unknown interpretation fact type/);
  assert.throws(() => repository({ ...mercury, conditions: [...mercury.conditions,
    { id: 'TYPO', field: 'facts.orbital', operator: 'exists', required: true, description: 'Typo' },
  ] }), /Unknown condition field facts.orbital in WEST-MERCURY-SQUARE/);
  const fixtures = repository(reviewed(mercury, { exclusions: [{ id: 'test-exclusion', field: 'facts.angle',
    operator: 'eq', expected: 90, required: true, description: 'Synthetic report exclusion' }] }));
  const byParameters = (parameters, repo) => retrieveInterpretations({ ...query,
    parameters, requestedRelationships: ['friendship'] }, repo).traces[0];
  assert.equal(byParameters(query.parameters, fixtures).status, 'condition_not_met');
  const unexcluded = repository(reviewed(mercury));
  assert.equal(byParameters({ ...query.parameters, deviation: 5.1 }, unexcluded).status, 'condition_not_met');
  const { orb, ...missing } = query.parameters;
  assert.equal(byParameters(missing, unexcluded).status, 'insufficient_fact_data');
});

test('keeps structured fact IDs stable under section and parameter reordering', () => {
  const comparison = compareCharts(a, b);
  const facts = adaptInterpretationFacts(comparison);
  const reordered = { ...comparison, sections: [...comparison.sections].reverse().map((section) => ({
    ...section, evidence: [...section.evidence].reverse().map((evidence) => ({ ...evidence,
      facts: evidence.facts && Object.fromEntries(Object.entries(evidence.facts).reverse()) })),
  })) };
  assert.deepEqual(adaptInterpretationFacts(reordered).map(({ id }) => id).sort(), facts.map(({ id }) => id).sort());
  const dayMatch = facts.find(({ rule, facts }) => rule === 'branch-union' && facts.aPosition === 'day' && facts.bPosition === 'day');
  assert.match(dayMatch.id, /^bazi:branch-union:[0-9a-f]{16}$/);
  assert.equal(dayMatch.chartRefs.a.snapshotId, 'owner-archive');
  assert.equal(dayMatch.chartRefs.b.calculatedAt, b.chart.calculatedAt);
});

test('keeps alias recall separate from exact patterns and structured conditions', () => {
  const mercury = catalog.entries.find(({ id }) => id === 'WEST-MERCURY-SQUARE');
  const fixtures = repository(reviewed(mercury));
  assert.deepEqual(searchInterpretationAliases('  Ｍｅｒｃｕｒｙ   SQUARE Mercury  ', fixtures), [{
    knowledgeId: mercury.id, factTypeId: 'western:western-cross-aspect', reviewStatus: 'approved',
  }]);
  const matched = retrieveInterpretations({ ...query, requestedRelationships: ['friendship'] }, fixtures);
  assert.equal(matched.matches[0].trace.factPatternId, 'western:western-cross-aspect:Mercury:Mercury:90');
  assert.equal(matched.matches[0].trace.selector, 'fact_pattern');
  const different = retrieveInterpretations({ ...query, requestedRelationships: ['friendship'],
    alias: '四分相', parameters: { ...query.parameters, bPlanet: 'Mars' } }, fixtures);
  assert.deepEqual(different.matches, []);
  assert.equal(different.traces[0].status, 'no_knowledge_entry');
  const { aPlanet, ...missing } = query.parameters;
  assert.equal(retrieveInterpretations({ ...query, requestedRelationships: ['friendship'], parameters: missing }, fixtures)
    .traces[0].status, 'insufficient_fact_data');
});

test('preserves matching supportive evidence from two systems without inventing the other polarity', () => {
  const authored = catalog.entries.find(({ id }) => id === 'BAZI-DAY-BRANCH-UNION');
  const sextile = catalog.entries.find(({ id }) => id === 'WEST-VENUS-MARS-SEXTILE');
  const left = { ...a, chart: { ...a.chart, western: {
    ...western, positions: [{ planet: 'Venus', longitude: 0 }],
  } } };
  const right = { ...b, chart: { ...b.chart, western: {
    ...western, positions: [{ planet: 'Mars', longitude: 60 }],
  } } };
  const report = buildRelationshipReport(compareCharts(left, right),
    repository(reviewed(authored), reviewed(sextile, { theme: authored.theme })));
  const romance = report.relationships.find(({ type }) => type === 'romance');
  assert.equal(romance.positive.status, 'present');
  assert.equal(romance.negative.status, 'insufficient_data');
  assert.equal(romance.negative.items.length, 0);
  assert.equal(romance.themes.find(({ themeId }) => themeId === authored.theme).crossSystemAgreement, 'convergent');
});

test('packages only approved results for the selected relationship and suppresses full chart references', () => {
  const left = { ...a, chart: { ...a.chart, western: { ...western, positions: [
    { planet: 'Mercury', longitude: 0 }, { planet: 'Moon', longitude: 0 },
  ] } } };
  const right = { ...b, chart: { ...b.chart, western: { ...western, positions: [
    { planet: 'Mercury', longitude: 90 }, { planet: 'Moon', longitude: 180 },
  ] } } };
  const chosen = ['WEST-MERCURY-SQUARE', 'BAZI-DAY-BRANCH-UNION', 'WEST-MOON-OPPOSITION'];
  const entries = chosen.map((id) => catalog.entries.find((item) => item.id === id));
  const figures = compareCharts(left, right);
  const report = buildRelationshipReport(figures, repository(...entries.map((item) => reviewed(item))));
  const romance = buildInterpretationContext(report, 'romance');
  assert.equal(romance.groups.supportive.status, 'present');
  assert.equal(romance.groups.challenging.status, 'present');
  assert.ok(romance.results.every((result) => result.relationshipType === 'romance'
    && result.reviewStatus === 'approved' && result.matchStatus === 'matched' && result.conditionResults.length
    && result.sourceRefs.length && result.reasoningSteps.length));
  assert.ok(romance.groups.challenging.resultIds.every((id) => romance.results.some((result) => result.resultId === id)));
  assert.equal(romance.results.some((result) => result.knowledgeId === 'WEST-MERCURY-SQUARE'), false);
  assert.ok(!JSON.stringify(romance).includes('owner-archive'));
  assert.ok(!JSON.stringify(romance).includes('calculatedAt'));
  assert.equal(report.interpretations.find((result) => result.resultId === romance.results[0].resultId)
    .chartRefs.a.snapshotId, 'owner-archive');
  for (const type of ['family', 'friendship', 'collaboration']) {
    const context = buildInterpretationContext(report, type);
    assert.equal(context.groups.supportive.status, 'insufficient_data');
    assert.equal(context.groups.challenging.status, 'present');
    assert.ok(context.results.every((result) => result.relationshipType === type));
  }
  assert.deepEqual(buildInterpretationContext(buildRelationshipReport(figures, repository(...entries)), 'romance').results, []);
});

test('preserves draft traces and raw facts separately from published interpretation', () => {
  const actual = buildRelationshipReport(compareCharts(a, b), repository(...catalog.entries));
  assert.equal(actual.evidence.length, 0);
  assert.ok(actual.facts.some(({ rule }) => rule === 'ziwei-transformation-by-branch'));
  assert.ok(actual.relationships.every(({ positive, negative }) =>
    positive.status === 'insufficient_data' && negative.status === 'insufficient_data'));
  const draft = retrieveInterpretations(query, repository(reviewed(
    catalog.entries.find(({ id }) => id === 'WEST-MERCURY-SQUARE'), { reviewStatus: 'draft' })));
  assert.equal(draft.matches.length, 0);
  const hit = draft.traces.find(({ status }) => status === 'pending_review');
  assert.equal(hit.factId, query.factId);
  assert.equal(hit.knowledgeId, 'WEST-MERCURY-SQUARE');
  assert.ok(hit.conditions.some(({ field, actual, expected, status }) =>
    field === 'facts.angle' && actual === 90 && expected === 90 && status === 'passed'));
});

test('gates variants independently and traces version, school, theme and scene conditions', () => {
  const { theme, polarity, scenes, ...atom } = catalog.entries.find(({ id }) => id === 'WEST-MERCURY-SQUARE');
  const [friendship, collaboration] = variantsCatalog.filter(({ knowledgeId }) => knowledgeId === atom.id);
  const restricted = { ...reviewed(friendship), conditions: [{
    id: 'friendship-limit', field: 'facts.deviation', operator: 'lte',
    expected: 4, required: true, description: 'Use a narrower test limit',
  }] };
  const fixtures = createInterpretationRepository({ ...atomsCatalog, atoms: [reviewed(atom)], variants: [restricted, collaboration] });
  assert.deepEqual(retrieveInterpretations({ ...query, requestedRelationships: ['friendship', 'collaboration'] }, fixtures)
    .traces.map(({ status }) => status), ['condition_not_met', 'pending_review']);
  const allowed = { ...query, requestedRelationships: ['friendship'], parameters: { ...query.parameters, deviation: 4 } };
  const selected = retrieveInterpretations(allowed, fixtures).matches[0];
  assert.equal(selected.trace.variantId, friendship.id);
  assert.equal(selected.trace.variantVersion, friendship.version);
  assert.equal(retrieveInterpretations({ ...allowed, requestedThemes: ['values'] }, fixtures).traces[0].status, 'unsupported_theme');
  assert.equal(retrieveInterpretations({ ...allowed, requestedSchools: ['alternative'] }, fixtures).traces[0].status, 'unsupported_school');
  assert.throws(() => createInterpretationRepository({ ...atomsCatalog, atoms: [atom], variants: [friendship, friendship] }), /duplicate/);
  assert.throws(() => createInterpretationRepository({ ...atomsCatalog, atoms: [], variants: [friendship] }), /variant/);
});

test('ranks exact fact IDs above reusable selectors without merging school conflicts', () => {
  const fact = adaptInterpretationFacts(compareCharts(a, b)).find(({ rule, facts }) =>
    rule === 'branch-union' && facts.aPosition === 'day' && facts.bPosition === 'day');
  const seed = catalog.entries.find(({ id }) => id === 'BAZI-DAY-BRANCH-UNION');
  const fixtures = repository(reviewed(seed), reviewed(seed, {
    id: 'TEST-OTHER-SCHOOL', schoolId: 'test-alternative', factIds: [fact.id], polarity: 'challenging',
  }));
  const input = { factId: fact.id, system: fact.system, rule: fact.rule, parameters: fact.facts, direction: fact.direction,
    ruleVersion: fact.ruleVersion, chartRulesets: ['fixture-v1', 'fixture-v1'], requestedRelationships: ['romance'] };
  const matches = retrieveInterpretations(input, fixtures).matches;
  assert.deepEqual(matches.map(({ scene, trace }) => [scene.polarity, trace.selector]),
    [['challenging', 'fact_id'], ['supportive', 'fact_type']]);
  assert.deepEqual(retrieveInterpretations({ ...input, factId: 'other-instance' }, fixtures)
    .matches.map(({ knowledge }) => knowledge.id), [seed.id]);
  assert.deepEqual(retrieveInterpretations({ ...input, requestedSchools: ['test-alternative'] }, fixtures)
    .matches.map(({ knowledge }) => knowledge.id), ['TEST-OTHER-SCHOOL']);
});

test('applies only approved combinations with all prerequisites and preserves positive and negative evidence', () => {
  const rule = combinationsCatalog.rules.find(({ id }) => id === 'CROSS-BRANCH-UNION-MOON-OPPOSITION');
  const entries = rule.requiredKnowledgeIds.map((id) => catalog.entries.find((entry) => entry.id === id));
  const fixtures = repository(...entries.map((item) => reviewed(item)));
  const left = { ...a, chart: { ...a.chart, western: { ...western, positions: [{ planet: 'Moon', longitude: 0 }] } } };
  const right = { ...b, chart: { ...b.chart, western: { ...western, positions: [{ planet: 'Moon', longitude: 180 }] } } };
  const comparison = compareCharts(left, right);
  const reportWithoutCombinations = buildRelationshipReport(comparison, fixtures);
  assert.deepEqual(buildInterpretationContext(reportWithoutCombinations, 'romance').combinations, []);

  const approved = validateCombinationCatalog({ ...combinationsCatalog, rules: [reviewed({ ...rule, conditions: ['same_direction'] })] }, fixtures);
  const report = buildRelationshipReport(comparison, fixtures, approved);
  assert.deepEqual(report.evidence, reportWithoutCombinations.evidence);
  const context = buildInterpretationContext(report, 'romance');
  const [combination] = context.combinations;
  assert.equal(combination.interaction, 'contradicts');
  assert.equal(combination.factIds.length, 2);
  assert.equal(combination.sourceRefs.length, 2);
  assert.equal(context.results.some(({ polarity }) => polarity === 'supportive'), true);
  assert.equal(context.results.some(({ polarity }) => polarity === 'challenging'), true);
  assert.deepEqual(buildInterpretationContext(report, 'family').combinations, []);
  const factsById = new Map(report.facts.map((item) => [item.id,
    item.id === combination.factIds[0] ? { ...item, direction: 'a_to_b' } : item]));
  assert.deepEqual(matchCombinations('romance', report.interpretations, factsById, fixtures, approved), []);
  const missing = compareCharts(left, { ...right, chart: { ...right.chart, western: { ...western, positions: [] } } });
  assert.deepEqual(buildInterpretationContext(buildRelationshipReport(missing, fixtures, approved), 'romance').combinations, []);
  assert.throws(() => validateCombinationCatalog({ ...approved, rules: [{ ...rule, requiredKnowledgeIds: [entries[0].id, 'missing'] }] }, fixtures), /Invalid/);

  const claim = { text: '双方的节奏与情绪观察均有依据。', evidenceIds: combination.evidenceIds,
    factIds: combination.factIds, combinationIds: [combination.combinationId] };
  assert.deepEqual(validateInterpretationOutput({ relationshipType: 'romance', claims: [claim] }, context), { valid: true, errors: [] });
  const check = (claims) => validateInterpretationOutput({ relationshipType: 'romance', claims }, context).errors;
  assert.ok(check([]).some((error) => error.startsWith('omitted_challenging')));
  assert.ok(check([{ ...claim, evidenceIds: ['fictional-id'] }]).includes('unknown_evidence:0'));
  assert.ok(check([{ ...claim, factIds: ['fictional-fact'] }]).includes('invalid_fact_reference:0'));
  assert.ok(check([{ ...claim, combinationIds: ['fictional-combination'] }]).includes('invalid_combination_reference:0'));
  assert.ok(check([{ ...claim, statementWithoutReferences: 'Extra claim' }]).includes('invalid_claim:0'));
  assert.equal(validateInterpretationOutput({ relationshipType: 'romance', claims: [claim], summary: 'Extra claim' }, context).valid, false);
  assert.equal(validateInterpretationOutput({ relationshipType: 'family', claims: [claim] }, context).valid, false);
});
