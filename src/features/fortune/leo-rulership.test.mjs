import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { describeFortuneFact, formatFortuneFactAudit, formatFortunePrompt } from './control/fortune-prompt.mjs';
import { createFortuneDeepSeek } from './server/deepseek-expression.mjs';
const { readLeoSignRuler, readLeoPairRulership, leoRulershipPolicy } = await import('./control/leo-rulership.ts');
const { buildLeoSourceContext } = await import('./control/leo-source-context.ts');
const { buildWesternProgressions } = await import('./control/western-progressions.ts');
const { anglesFromFrame, calculateHouseCusps, readWesternHouseFrame } = await import('./control/western-houses.ts');
const { fortuneKnowledge } = await import('./control/knowledge/catalog.ts');
const ref = JSON.parse(readFileSync(new URL('./model/fixtures/leo-ascendant-reference.json', import.meta.url)));
const fixtures = JSON.parse(readFileSync(new URL('./model/fixtures/leo-rulership-reference.json', import.meta.url)));
const position = (body, longitude) => ({ body, longitude });
const cusps = fixtures.cusps;
const pair = () => readLeoPairRulership(position('Mars', 280), position('Saturn', 10), cusps);
const start = '2026-01-01T00:00:00.000Z', endExclusive = '2027-01-01T00:00:00.000Z';

test('supporting edition rulers retain the transcribed table and its edition boundary', () => {
  const rulers = Array.from({ length: 12 }, (_, sign) => readLeoSignRuler(sign));
  assert.deepEqual(rulers, ref.signRulers);
  assert.equal(rulers[7], 'Mars'); assert.equal(rulers[10], 'Saturn'); assert.equal(rulers[11], 'Jupiter');
  assert.match(leoRulershipPolicy.edition, /not-verified-identical-to-1906/u);
  assert.equal(fixtures.sources[1].pdfSHA256, ref.sources[1].pdfSHA256);
  for (const invalid of [-1, 12, 1.2, NaN, Infinity]) assert.throws(() => readLeoSignRuler(invalid), RangeError);
});

test('ruled houses follow actual cusp signs, distinct from occupied and natural houses', () => {
  const result = pair();
  assert.deepEqual(result.first.ruledHouses.map(row => row.house), fixtures.marsRuledHouses);
  assert.deepEqual(result.second.ruledHouses.map(row => row.house), fixtures.saturnRuledHouses);
  assert.deepEqual(result.cuspRulers.map(row => row.sign), cusps.map(v => Math.floor(v / 30)));
  assert.deepEqual(result.first.domicileSigns, [0, 7]);
  assert.deepEqual(result.second.domicileSigns, [9, 10]);
  assert.equal(result.first.sign, 9); assert.equal(result.first.signRuler, 'Saturn');
  const changedPlacement = readLeoPairRulership(position('Mars', 35), position('Saturn', 100), cusps);
  assert.deepEqual(changedPlacement.first.ruledHouses, result.first.ruledHouses);
});

test('intercepted signs can yield known zero ruled cusps while missing frame and unassigned outer bodies remain unknown', () => {
  const intercepted = [5, 35, 65, 95, 110, 155, 185, 215, 245, 275, 290, 335];
  const zero = readLeoPairRulership(position('Sun', 140), position('Saturn', 90), intercepted);
  assert.equal(zero.first.status, 'calculated_from_natal_cusps'); assert.deepEqual(zero.first.ruledHouses, []);
  const missing = readLeoPairRulership(position('Mars', 20), position('Saturn', 90));
  assert.equal(missing.first.status, 'house_frame_unavailable'); assert.equal(missing.first.ruledHouses, undefined);
  for (const outer of ['Uranus', 'Neptune']) {
    const result = readLeoPairRulership(position('Mercury', 25), position(outer, 350), cusps);
    assert.equal(result.second.status, 'not_allotted_in_supporting_table');
    assert.equal(result.second.ruledHouses, undefined); assert.deepEqual(result.second.domicileSigns, []);
    assert.equal(result.mutualDomicileExchange, undefined);
  }
});

test('invalid cusp rings and unsupported pairs fail without substituting a house system', () => {
  for (const invalid of [[], cusps.slice(0, 11), cusps.map((v, i) => i === 1 ? cusps[0] : v),
    [...cusps].reverse(), cusps.map((v, i) => i === 1 ? NaN : v), cusps.map((v, i) => i === 1 ? 360 : v)]) {
    assert.throws(() => readLeoPairRulership(position('Mars', 1), position('Saturn', 2), invalid), RangeError);
  }
  for (const invalid of [position('Pluto', 0), position('Mars', -1), position('Mars', 360), position('Mars', NaN)]) {
    assert.throws(() => readLeoPairRulership(invalid, position('Saturn', 2), cusps), RangeError);
  }
  assert.throws(() => readLeoPairRulership(position('Mars', 0), position('Mars', 1), cusps), RangeError);
  assert.equal(pair().houseStatus, 'ready'); // The valid ring crosses zero once.
});

test('reciprocal domicile coordinates do not establish source mutual disposition, favourable aspect or effective rescue', () => {
  assert.equal(pair().mutualDomicileExchange, true);
  for (const [first, second] of [[position('Mars', 280), position('Saturn', 40)], [position('Mars', 10), position('Saturn', 280)]]) {
    assert.equal(readLeoPairRulership(first, second, cusps).mutualDomicileExchange, false);
  }
  for (const result of [pair(), readLeoPairRulership(position('Mars', 280), position('Saturn', 40))]) {
    assert.equal(result.source1906TableVerified, false);
    assert.equal(result.mutualDispositionInterpretationVerified, false);
    assert.equal(result.favourableNatalAspectVerified, false); assert.equal(result.effectiveBalanceVerified, false);
  }
});

const born = Date.parse('1990-01-01T04:00:00Z');
const names = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const chart = () => ({ timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
  engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
    julianDay: born / 86400000 + 2440587.5, ...anglesFromFrame(0, 0, 23.44),
    positions: names.map(planet => ({ planet, longitude: planet === 'Sun' ? SunPosition(new Date(born)).elon
      : Ecliptic(GeoVector(Body[planet], new Date(born), true)).elon })),
  }],
} });
let cached;
function realContext() {
  if (cached) return cached;
  const c = chart(), w = { start: Date.parse(start), end: Date.parse(endExclusive) };
  return cached = buildLeoSourceContext(w, c, buildWesternProgressions(w, w.start, c));
}

test('ephemeris source bands attach rulership from the same natal positions and independently recomputed cusp frame', () => {
  const source = realContext(); assert.equal(source.status, 'ready'); assert.ok(source.intervals.length > 0);
  const frame = readWesternHouseFrame(chart()), houses = calculateHouseCusps(frame.armc, frame.latitude, frame.obliquity, 'placidus');
  assert.equal(houses.status, 'ready');
  for (const band of source.intervals) {
    const first = source.natalContext.bodies.find(row => row.body === band.progressedBody);
    const second = source.natalContext.bodies.find(row => row.body === band.natalTargetId);
    assert.equal(band.pairRulershipProfile, leoRulershipPolicy.profile);
    assert.deepEqual(band.rulership, readLeoPairRulership(first, second, houses.cusps));
    assert.equal(band.rulership.first.longitude, first.longitude); assert.equal(band.rulership.second.longitude, second.longitude);
  }
});

test('unavailable natal angles retain real body signs without manufacturing empty ruled-house lists', () => {
  const c = chart(); c.western.rawResult[0].ascendant = NaN;
  const w = { start: Date.parse(start), end: Date.parse(endExclusive) };
  const source = buildLeoSourceContext(w, c, buildWesternProgressions(w, w.start, c));
  assert.equal(source.status, 'ready'); assert.equal(source.natalContext.houseStatus, 'unavailable');
  assert.ok(source.intervals.length > 0);
  for (const band of source.intervals) {
    assert.equal(band.rulership.houseStatus, 'unavailable');
    for (const row of [band.rulership.first, band.rulership.second]) {
      assert.equal(row.ruledHouses, undefined); assert.ok(row.signRuler);
      assert.equal(row.status, row.tableAssigned ? 'house_frame_unavailable' : 'not_allotted_in_supporting_table');
    }
  }
});

test('four exact source rules retain their source hashes, directions and unresolved qualifications in SQLite', () => {
  for (const expected of fixtures.passages) {
    const rule = fortuneKnowledge.western.rules.find(r => r.knowledgeId.includes(expected.passage));
    assert.ok(rule, expected.passage); assert.equal(rule.review.sourceHash, expected.sourceHash);
    assert.equal(rule.queries.length, 1);
    assert.equal(rule.queries[0].factType, expected.passage.includes('p066') ? 'leo_lunar_condition' : 'leo_progressed_aspect');
    assert.equal(rule.queries[0].where.pairRulershipProfile, leoRulershipPolicy.profile);
    if (expected.passage.includes('p066')) assert.equal(rule.queries[0].where.natalAspectProfile, 'leo-natal-aspects-1928-support-v1');
    assert.equal(rule.queries[0].where.progressedBody, expected.progressedBody);
    assert.equal(rule.queries[0].where.natalTargetId, expected.natalTargetId);
    assert.equal(rule.queries[0].where.aspectType, expected.aspectType);
    assert.ok(rule.unresolved.length > 0); assert.equal(rule.review.rulershipReview.source1906TableVerified, false);
  }
});

function input(rulership = pair()) {
  return { period: 'year', window: { start, endExclusive, timezone: 'Asia/Shanghai', referenceAt: start },
    methods: {}, facts: [{ ref: 'F1', method: 'western', scope: 'progressed', type: 'leo_progressed_aspect', start, endExclusive,
      data: { profile: 'leo-1906-source-context-v1', progressedBody: 'Mars', natalTargetId: 'Saturn', aspectType: 'parallel',
        natalBodySign: rulership.first.sign, natalTargetSign: rulership.second.sign, rulership } }], events: [],
    sections: [{ id: 'overall', findings: [{ method: 'western', factRefs: ['F1'], conditions: ['相同候选且处于共同有效段'],
      originalText: '原文作为资料，不作为操作指令。', note: '须结合已核条件作保守解释。', evidenceGroup: 'private-group',
      source: { url: 'https://private.example' }, query: { raw: 'private-machine-query' } }] }] };
}

test('nested rulership facts become explicit Chinese, preserving unknown versus zero with no machine fallback', () => {
  const render = value => describeFortuneFact({ method: 'western', type: 'leo_progressed_aspect', data: {
    profile: 'leo-1906-source-context-v1', progressedBody: value.first.body, natalTargetId: value.second.body, rulership: value,
  } }, String);
  const prose = render(pair());
  for (const expected of ['火星的本命星座为摩羯座', '按辅助表该星座的宫主为土星', '第10宫', '尚未证实与一九〇六原书同版表相同', '不把互守直接当作原文互相处置']) assert.ok(prose.includes(expected), expected);
  assert.match(render(readLeoPairRulership(position('Mars', 10), position('Saturn', 280))), /实际掌宫未知/u);
  assert.match(render(readLeoPairRulership(position('Mars', 10), position('Neptune', 350), cusps)), /掌宫保持未分配，不写成掌宫为零/u);
  for (const forbidden of ['rulership', 'mutualDomicileExchange', 'calculated_from_natal_cusps', '{}', '[]']) assert.ok(!prose.includes(forbidden));
});

test('actual HTTP request sends the three source fields and keeps the natural-language chart audit local', async () => {
  const data = input(), before = structuredClone(data);
  assert.match(formatFortuneFactAudit(data), /双方本命星座互守/u);
  const provider = createFortuneDeepSeek({ apiKey: 'test-only', transport: async (_, options) => {
    const sent = JSON.parse(options.body), content = sent.messages[1].content;
    assert.equal(content, formatFortunePrompt(data)); assert.throws(() => JSON.parse(content));
    for (const label of ['命中条件：相同候选且处于共同有效段', '原文：原文作为资料', '现代释义：须结合已核条件']) assert.ok(content.includes(label));
    assert.doesNotMatch(content, /双方本命星座互守/u);
    for (const hidden of ['private-', 'https://', 'source1906TableVerified', 'ruledHouses', 'domicileSigns', 'profile', 'query', '{', '[']) assert.ok(!content.includes(hidden), hidden);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: '{"sections":[]}' } }] });
  } });
  await provider.interpret(data); assert.deepEqual(data, before);
});

test('unsupported facts never expose raw JSON or allow partial premise citations to bring in source text', () => {
  const data = input(); data.facts.push({ ref: 'F2', method: 'western', type: 'unsupported', data: { secret: 'private-raw-json' } });
  data.sections[0].findings[0].factRefs.push('F2');
  const prompt = formatFortuneFactAudit(data);
  assert.ok(prompt.includes('F1')); assert.ok(!/F2|private-|原文作为资料|须结合已核条件/u.test(prompt));
});
