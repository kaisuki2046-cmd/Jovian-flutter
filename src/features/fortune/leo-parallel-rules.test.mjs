import assert from 'node:assert/strict';
import test from 'node:test';
import { Body, Ecliptic, EquatorFromVector, GeoVector, RotateVector, Rotation_EQJ_EQD, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortunePrompt } from './control/fortune-prompt.mjs';

const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { anglesFromFrame } = await import('./control/western-houses.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { evaluateFortuneRules, getFortuneKnowledgeEntry } = await import('./control/knowledge/catalog.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { progressionEpoch } = await import('./control/western-progressions.ts');

const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const now = Date.parse('2026-06-15T00:00:00.000Z');
const nowIso = new Date(now).toISOString();
const cache = new Map();

function submit(birthDate, month, year = 2026) {
  const key = `${birthDate}:${year}:${month ?? 'year'}`;
  if (cache.has(key)) return cache.get(key);
  const birth = new Date(birthDate.includes('T') ? birthDate : `${birthDate}T00:00:00.000Z`);
  const chart = { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: birth.getTime() / 86_400_000 + 2440587.5,
      ...anglesFromFrame(0, 0, 23.44),
      positions: bodies.map(planet => ({ planet,
        longitude: planet === 'Sun' ? SunPosition(birth).elon : Ecliptic(GeoVector(Body[planet], birth, true)).elon })),
    }],
  } };
  const parameters = month
    ? { periodType: 'month', targetPeriod: { year, month }, displayTimezone: 'UTC' }
    : { periodType: 'year', targetPeriod: { year }, displayTimezone: 'UTC' };
  const reference = { snapshotId: `leo-parallel-${key}` };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, { ...reference, chart })));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
  const result = { birth, period: parameters.periodType, run, matches: matchFortuneKnowledge(run).byMethod.western };
  cache.set(key, result);
  return result;
}

function declination(body, date) {
  return EquatorFromVector(RotateVector(Rotation_EQJ_EQD(date), GeoVector(Body[body], date, true))).dec;
}

test('twelve Leo passages use one absolute-declination criterion through production and SQLite', () => {
  const batch = [
    [588, 'p066', 'leo_lunar_condition', '1935-04-16'],
    [608, 'p086', 'leo_lunar_condition', '1965-03-30T12:00:00Z', undefined, 2026, true],
    [628, 'p106', 'leo_progressed_aspect', '1961-11-23T12:00:00Z'],
    [767, 'p245', 'leo_lunar_condition', '1984-09-11', undefined, 2026, true],
    [798, 'p276', 'leo_progressed_aspect', '1935-05-29', undefined, 2026, true],
    [808, 'p286', 'leo_lunar_condition', '1955-03-20'],
    [814, 'p292', 'leo_lunar_condition', '1980-03-04', undefined, 2026, true],
    [824, 'p302', 'leo_lunar_condition', '1965-05-03', undefined, 2026, true],
    [844, 'p322', 'leo_progressed_aspect', '1935-09-05', undefined, 2026, true],
    [598, 'p076', 'leo_progressed_aspect', '1987-05-15'],
    [706, 'p184', 'leo_progressed_aspect', '1984-02-01', 6],
    [788, 'p266', 'leo_progressed_aspect', '1949-07-21', undefined, 2025],
  ];
  const oppositeHemispheres = new Set();
  const submissions = [];
  const modelInputs = new Map();
  for (const [id, passage, type, date, month, year, correctedOutput] of batch) {
    const label = `${id} ${passage}`;
    const select = row => row.knowledgeId.includes(`-leo-1906-interpretation-${passage}-`);
    const findWitness = sample => {
      if (sample.period !== (month ? 'month' : 'year')) return;
      const match = sample.matches.find(select);
      if (match?.status !== 'matched') return;
      return sample.run.facts.find(fact => fact.factType === type && match.sourceFactIds.includes(fact.factId)
        && fact.normalizedPayload.aspectType === 'parallel');
    };
    let sample = submissions.find(findWitness);
    if (!sample) {
      sample = submit(date, month, year);
      submissions.push(sample);
    }
    const witness = findWitness(sample);
    assert.ok(witness, label);
    const p = witness.normalizedPayload;
    assert.equal(p.parallelComparison, 'absolute-declination-north-south-not-required', label);
    assert.equal(p.coordinate, 'equatorial_declination_of_date', label);
    assert.equal(p.allowedOrb, 1, label);
    const midpoint = (Date.parse(witness.activeFrom) + Date.parse(witness.activeTo)) / 2;
    const movingAt = new Date(progressionEpoch(sample.birth.getTime(), midpoint));
    const targetAt = p.targetKind === 'natal' ? sample.birth : movingAt;
    const first = declination(p.progressedBody, movingAt), second = declination(p.natalTargetId, targetAt);
    const delta = Math.abs(Math.abs(first) - Math.abs(second));
    assert.ok(delta <= 1, label);
    if (Math.sign(first) !== Math.sign(second) && delta > 0.25) oppositeHemispheres.add(id);

    const evaluate = changes => evaluateFortuneRules('western', sample.period, [{ ...witness,
      normalizedPayload: { ...p, ...changes } }]).find(select);
    const accepted = evaluate({});
    assert.equal(accepted.required[0].hits.length, 1, label);
    for (const changed of [{ allowedOrb: 0.25 }, { coordinate: 'ecliptic_longitude' },
      { parallelComparison: 'signed-declination' }]) {
      const rejected = evaluate(changed).required[0];
      assert.deepEqual([rejected.hits.length, rejected.unknown], [0, false], label);
    }
    const unknown = evaluate({ parallelComparison: undefined }).required[0];
    assert.deepEqual([unknown.hits.length, unknown.unknown], [0, true], label);
    if (correctedOutput) {
      if (!modelInputs.has(sample)) {
        const { run } = sample;
        const report = interpretFortune(run, requestForFortuneRun(run), 'leo-absolute-declination');
        modelInputs.set(sample, buildFortuneModelContext(run, report).input);
      }
      const input = modelInputs.get(sample);
      const finding = input.sections.flatMap(section => section.findings).find(select);
      assert.ok(finding, label);
      assert.deepEqual(finding.conditions, accepted.sourceConditions, label);
      assert.match(finding.conditions.join('\n'), /两星赤纬取绝对值后相差在一度内/u, label);
      assert.doesNotMatch(finding.conditions.join('\n'), /须核同向赤纬|不得用黄经合相或反平行替代/u, label);
      assert.ok(formatFortunePrompt(input).includes(`命中条件：${finding.conditions.join('；')}`), label);
      assert.ok(getFortuneKnowledgeEntry(accepted.knowledgeId).conditions.normalized.some(line => line.includes('须核同向赤纬')), label);
    }
  }
  for (const id of [798, 598, 706]) assert.ok(oppositeHemispheres.has(id), `${id} passes beyond 0.25° across hemispheres`);
});

// Chapters XI–XII describe these parallels on their own. Chapter VII gives the
// one-degree declination allowance and omits the north/south distinction.
// https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=56
const cases = [
  { passage: 'p322', moving: 'Venus', target: 'Neptune', positive: '1935-09-05', negative: '1940-02-15',
    layers: ['natal'], availableLayers: ['natal'], bandWithoutExact: true },
  { passage: 'p046', moving: 'Mars', target: 'Jupiter', positive: '1940-09-13', negative: '1940-02-15',
    layers: ['natal'], availableLayers: ['natal'], bandWithoutExact: true },
  { passage: 'p276', moving: 'Sun', target: 'Saturn', positive: '1935-05-29', negative: '1940-02-15',
    layers: ['natal', 'progressed'], bandWithoutExact: true },
  { passage: 'p056', moving: 'Mars', target: 'Neptune', positive: '1987-05-15', negative: '1940-08-15', layers: ['natal'] },
  { passage: 'p076', moving: 'Mars', target: 'Uranus', positive: '1987-05-15', negative: '1940-08-15', layers: ['natal'] },
  { passage: 'p096', moving: 'Mercury', target: 'Mars', positive: '1958-10-15', negative: '1940-08-15', layers: ['natal'] },
  { passage: 'p174', moving: 'Moon', target: 'Mercury', positive: '1975-02-01', negative: '1940-02-15', month: 6,
    layers: ['natal', 'progressed'], bandWithoutExact: true },
  { passage: 'p184', moving: 'Moon', target: 'Neptune', positive: '1984-02-01', negative: '1940-02-15', month: 6,
    layers: ['natal', 'progressed'] },
  { passage: 'p194', moving: 'Moon', target: 'Saturn', positive: '1941-12-15', negative: '1940-02-15', month: 6,
    layers: ['natal', 'progressed'] },
  { passage: 'p224', moving: 'Moon', target: 'Venus', positive: '1984-02-01', negative: '1940-02-15', month: 6,
    layers: ['natal', 'progressed'], availableLayers: ['natal'] },
  { passage: 'p342', moving: 'Venus', target: 'Uranus', positive: '1956-10-15', negative: '1940-08-15', layers: ['natal'] },
  { passage: 'p116', moving: 'Mercury', target: 'Saturn', positive: '1937-05-21', negative: '1940-02-15',
    layers: ['natal'], bandWithoutExact: true },
  { passage: 'p126', moving: 'Mercury', target: 'Uranus', positive: '1940-09-13', negative: '1940-02-15',
    layers: ['natal'], bandWithoutExact: true },
  { passage: 'p132', moving: 'Mercury', target: 'Venus', positive: '1940-09-13', negative: '1940-02-15',
    layers: ['natal'], availableLayers: ['natal'], bandWithoutExact: true },
  { passage: 'p312', moving: 'Venus', target: 'Mars', positive: '1937-05-21', negative: '1940-02-15',
    layers: ['natal'], availableLayers: ['natal'], bandWithoutExact: true },
  { passage: 'p332', moving: 'Venus', target: 'Saturn', positive: '1940-09-13', negative: '1940-02-15',
    layers: ['natal'], availableLayers: ['natal'], bandWithoutExact: true },
];

for (const { passage, moving, target, positive, negative, month, layers, availableLayers = ['natal', 'progressed'],
  bandWithoutExact } of cases) {
  test(`${passage} matches the Leo ${moving}–${target} declination parallel in the passage's chart layer`, () => {
    const select = row => row.knowledgeId.includes(`-leo-1906-interpretation-${passage}-`);
    const { birth, period, run, matches } = submit(positive, month);
    const result = matches.find(select);
    assert.equal(result?.status, 'matched');
    assert.deepEqual(result.unresolvedConditions, []);

    const related = run.facts.filter(fact => {
      const data = fact.normalizedPayload;
      return fact.factType === 'leo_progressed_aspect' && data.progressedBody === moving && data.natalTargetId === target
        && data.aspectType === 'parallel' && fact.activeFrom <= nowIso && nowIso < fact.activeTo;
    });
    assert.deepEqual([...new Set(related.map(fact => fact.normalizedPayload.targetKind))].sort(), availableLayers);
    const matched = related.filter(fact => result.sourceFactIds.includes(fact.factId));
    assert.deepEqual([...new Set(matched.map(fact => fact.normalizedPayload.targetKind))].sort(),
      availableLayers.filter(layer => layers.includes(layer)));
    if (bandWithoutExact) {
      assert.ok(!run.facts.some(({ factType, normalizedPayload: data }) => factType === 'leo_progressed_aspect_exact'
        && data.progressedBody === moving && data.natalTargetId === target && data.aspectType === 'parallel'
        && layers.includes(data.targetKind)));
    }

    const currentEpoch = new Date(progressionEpoch(birth.getTime(), now));
    for (const { normalizedPayload: data } of related) {
      const first = declination(moving, currentEpoch);
      const second = declination(target, data.targetKind === 'natal' ? birth : currentEpoch);
      const difference = Math.abs(Math.abs(first) - Math.abs(second));
      assert.notEqual(Math.sign(first), Math.sign(second));
      assert.ok(difference < 1);
      if (layers.includes(data.targetKind)) assert.ok(difference > 0.25);
    }

    const [included] = matched;
    const invalidInputs = [{ allowedOrb: 0.25 }, { coordinate: 'ecliptic_longitude' }];
    if (layers.length === 1) invalidInputs.push({ targetKind: layers[0] === 'natal' ? 'progressed' : 'natal' });
    for (const invalid of invalidInputs) {
      const fact = { ...included, normalizedPayload: { ...included.normalizedPayload, ...invalid } };
      const { required: [check] } = evaluateFortuneRules('western', period, [fact]).find(select);
      assert.equal(check.hits.length, 0);
      assert.equal(check.unknown, false);
    }

    assert.equal(submit(negative, month).matches.find(select)?.status, 'not_matched');
  });
}

test('p245 includes an actual Sun–Mercury parallel with opposite hemispheres', () => {
  const { birth, run, matches } = submit('1984-09-11');
  const match = matches.find(row => row.knowledgeId.includes('-p245-'));
  assert.equal(match.status, 'matched');
  const currentEpoch = new Date(progressionEpoch(birth.getTime(), now));
  const [first, second] = [declination('Sun', currentEpoch), declination('Mercury', birth)];
  const difference = Math.abs(Math.abs(first) - Math.abs(second));
  assert.notEqual(Math.sign(first), Math.sign(second));
  assert.ok(difference > 0.25 && difference < 1);
  assert.ok(run.facts.some(fact => match.sourceFactIds.includes(fact.factId)
    && fact.factType === 'leo_lunar_condition' && fact.activeFrom <= nowIso && nowIso < fact.activeTo
    && fact.normalizedPayload.targetKind === 'natal' && fact.normalizedPayload.aspectType === 'parallel'));
});

test('p214 distinguishes the sustained Moon–Uranus parallel from the adverse-direction premise', () => {
  const { birth, run } = submit('1984-02-01', 6);
  const isParallel = ({ normalizedPayload: p }) => p.progressedBody === 'Moon' && p.natalTargetId === 'Uranus'
    && p.aspectType === 'parallel';
  const bands = run.facts.filter(fact => fact.factType === 'leo_progressed_aspect' && isParallel(fact));
  assert.deepEqual([...new Set(bands.map(fact => fact.normalizedPayload.targetKind))].sort(), ['natal', 'progressed']);
  assert.ok(!run.facts.some(fact => fact.factType === 'leo_progressed_aspect_exact' && isParallel(fact)));

  const epoch = new Date(progressionEpoch(birth.getTime(), now));
  const moon = declination('Moon', epoch);
  for (const { normalizedPayload: p } of bands) {
    const uranus = declination('Uranus', p.targetKind === 'natal' ? birth : epoch);
    assert.equal(p.allowedOrb, 1);
    assert.equal(p.coordinate, 'equatorial_declination_of_date');
    assert.notEqual(Math.sign(moon), Math.sign(uranus));
    const difference = Math.abs(Math.abs(moon) - Math.abs(uranus));
    assert.ok(difference > 0.25 && difference < 1);
  }
  const select = row => row.knowledgeId.includes('-leo-1906-interpretation-p214-');
  assert.deepEqual(evaluateFortuneRules('western', 'month', bands).find(select).required[0].hits, []);
  const result = matchFortuneKnowledge(run).byMethod.western.find(select);
  assert.equal(result.status, 'matched');
  assert.ok(run.facts.some(fact => result.sourceFactIds.includes(fact.factId)
    && isParallel(fact) && fact.normalizedPayload.monthlyLunarQualification === 'base'));
  const absent = submit('1940-05-01', 6);
  assert.ok(!absent.run.facts.some(fact => fact.factType === 'leo_progressed_aspect' && isParallel(fact)));
  assert.equal(absent.matches.find(select).status, 'not_matched');
});
