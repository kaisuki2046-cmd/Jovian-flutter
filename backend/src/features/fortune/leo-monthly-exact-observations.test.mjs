import assert from 'node:assert/strict';
import test from 'node:test';
import { Body, Ecliptic, GeoVector, SunPosition } from 'astronomy-engine';
import './server/knowledge/runtime.mjs';
import { formatFortunePrompt } from './control/fortune-prompt.mjs';

const { bindClientFortuneRun, readClientFactTime } = await import('./server/client-facts.mjs');
const { anglesFromFrame } = await import('./control/western-houses.ts');
const { buildFortuneFactSubmission } = await import('./control/fortune-fact-submission.ts');
const { interpretFortune, requestForFortuneRun } = await import('./control/fortune-interpretation.ts');
const { buildFortuneModelContext } = await import('./control/fortune-model-context.ts');
const { getFortuneKnowledgeEntry } = await import('./control/knowledge/catalog.ts');
const { matchFortuneKnowledge } = await import('./control/knowledge/match.ts');
const { progressionEpoch } = await import('./control/western-progressions.ts');

const planets = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

function longitude(planet, instant) {
  const date = new Date(instant);
  return planet === 'Sun' ? SunPosition(date).elon : Ecliptic(GeoVector(Body[planet], date, true)).elon;
}

function submit(birth, month) {
  const chart = { timeKnown: true, bazi: { rawResult: [] }, ziwei: { rawResult: [] }, western: {
    engineName: 'astronomy-engine', engineVersion: '2.1.19', rulesetVersion: 'tropical-whole-sign-v1', rawResult: [{
      julianDay: birth / 86_400_000 + 2440587.5,
      ...anglesFromFrame(0, 0, 23.44),
      positions: planets.map(planet => ({ planet, longitude: longitude(planet, birth) })),
    }],
  } };
  const parameters = { periodType: 'month', targetPeriod: { year: 2026, month }, displayTimezone: 'UTC' };
  const now = Date.UTC(2026, month - 1, 15);
  const reference = { snapshotId: `leo-lunar-exact-${birth}-${month}` };
  const batch = JSON.parse(JSON.stringify(buildFortuneFactSubmission(parameters, now, { ...reference, chart })));
  const run = bindClientFortuneRun(parameters, batch, readClientFactTime(parameters, batch, now), reference.snapshotId, reference);
  return { run, matches: matchFortuneKnowledge(run).byMethod.western };
}

// Leo, Chapter XI, pp. 113–115 (PDF): a lunar contact alone indicates a
// tendency. Material effects depend on solar or mutual directions of like kind.
// https://www.astro.nu/wp-content/uploads/The-Progressed-Horoscope-Alan-Leo.pdf#page=114
const groups = [
  { birthDate: '1955-11-01', month: 7, rows: [
    { passage: 'p167', target: 'Mercury', aspect: 'semisquare', angle: 45, layers: ['progressed'] },
    { passage: 'p186', target: 'Saturn', aspect: 'semisextile', angle: 30, layers: ['natal'], matchesPreviousMonth: true },
    { passage: 'p197', target: 'Sun', aspect: 'semisquare', angle: 45, layers: ['natal'], matchesPreviousMonth: true },
    { passage: 'p216', target: 'Venus', aspect: 'semisextile', angle: 30, layers: ['natal'] },
  ] },
  { birthDate: '1985-08-15', month: 8, rows: [
    { passage: 'p173', target: 'Mercury', aspect: 'opposition', angle: 180, layers: ['natal'] },
    { passage: 'p177', target: 'Neptune', aspect: 'semisquare', angle: 45, layers: ['natal', 'progressed'] },
  ] },
  { birthDate: '1996-04-15', month: 7, rows: [
    { passage: 'p179', target: 'Neptune', aspect: 'square', angle: 90, layers: ['natal', 'progressed'] },
    { passage: 'p218', target: 'Venus', aspect: 'sextile', angle: 60, layers: ['progressed'] },
  ] },
  { birthDate: '1984-12-15', month: 2, rows: [
    { passage: 'p156', target: 'Mars', aspect: 'semisextile', angle: 30, layers: ['natal'] },
    { passage: 'p215', target: 'Venus', aspect: 'conjunction', angle: 0, layers: ['progressed'] },
    { passage: 'p217', target: 'Venus', aspect: 'semisquare', angle: 45, layers: ['natal'] },
  ] },
  { birthDate: '1975-04-15', month: 4, rows: [
    { passage: 'p145', target: 'Jupiter', aspect: 'conjunction', angle: 0, layers: ['progressed'] },
    { passage: 'p157', target: 'Mars', aspect: 'semisquare', angle: 45, layers: ['natal'] },
  ] },
  { birthDate: '1996-11-01', month: 4, rows: [
    { passage: 'p171', target: 'Mercury', aspect: 'sesquiquadrate', angle: 135, layers: ['progressed'] },
    { passage: 'p200', target: 'Sun', aspect: 'trine', angle: 120, layers: ['progressed'] },
    { passage: 'p219', target: 'Venus', aspect: 'square', angle: 90, layers: ['progressed'] },
  ] },
  { birthDate: '1945-01-15', month: 7, rows: [
    { passage: 'p195', target: 'Sun', aspect: 'conjunction', angle: 0, layers: ['natal'] },
    { passage: 'p211', target: 'Uranus', aspect: 'sesquiquadrate', angle: 135, layers: ['natal', 'progressed'] },
  ] },
  { birthDate: '1982-02-05', birthTime: '23:10:00', month: 4, rows: [
    { passage: 'p190', target: 'Saturn', aspect: 'trine', angle: 120, layers: ['progressed'] },
  ] },
  { birthDate: '1990-07-15', month: 9, rows: [
    { passage: 'p146', target: 'Jupiter', aspect: 'semisextile', angle: 30, layers: ['natal'] },
    { passage: 'p166', target: 'Mercury', aspect: 'semisextile', angle: 30, layers: ['progressed'] },
    { passage: 'p192', target: 'Saturn', aspect: 'quincunx', angle: 150, layers: ['natal'] },
    { passage: 'p196', target: 'Sun', aspect: 'semisextile', angle: 30, layers: ['natal'] },
  ] },
  { birthDate: '1962-08-01', month: 11, rows: [
    { passage: 'p149', target: 'Jupiter', aspect: 'square', angle: 90, layers: ['natal'] },
    { passage: 'p170', target: 'Mercury', aspect: 'trine', angle: 120, layers: ['natal'] },
    { passage: 'p176', target: 'Neptune', aspect: 'semisextile', angle: 30, layers: ['natal'] },
    { passage: 'p198', target: 'Sun', aspect: 'sextile', angle: 60, layers: ['progressed'] },
  ] },
  { birthDate: '2003-06-01', month: 10, rows: [
    { passage: 'p158', target: 'Mars', aspect: 'sextile', angle: 60, layers: ['progressed'] },
    { passage: 'p188', target: 'Saturn', aspect: 'sextile', angle: 60, layers: ['progressed'] },
    { passage: 'p208', target: 'Uranus', aspect: 'sextile', angle: 60, layers: ['natal', 'progressed'] },
  ] },
  { birthDate: '1961-11-01', month: 3, rows: [
    { passage: 'p147', target: 'Jupiter', aspect: 'semisquare', angle: 45, layers: ['natal'] },
    { passage: 'p187', target: 'Saturn', aspect: 'semisquare', angle: 45, layers: ['progressed'] },
  ] },
  { birthDate: '1994-09-01', month: 8, rows: [
    { passage: 'p148', target: 'Jupiter', aspect: 'sextile', angle: 60, layers: ['natal'] },
    { passage: 'p193', target: 'Saturn', aspect: 'opposition', angle: 180, layers: ['natal'] },
  ] },
  { birthDate: '1964-10-01', month: 11, rows: [
    { passage: 'p153', target: 'Jupiter', aspect: 'opposition', angle: 180, layers: ['progressed'] },
    { passage: 'p175', target: 'Neptune', aspect: 'conjunction', angle: 0, layers: ['progressed'] },
  ] },
  { birthDate: '1943-08-01', month: 4, rows: [
    { passage: 'p159', target: 'Mars', aspect: 'square', angle: 90, layers: ['natal'] },
    { passage: 'p168', target: 'Mercury', aspect: 'sextile', angle: 60, layers: ['progressed'] },
  ] },
  { birthDate: '1979-08-15', month: 11, rows: [
    { passage: 'p162', target: 'Mars', aspect: 'quincunx', angle: 150, layers: ['natal'] },
    { passage: 'p163', target: 'Mars', aspect: 'opposition', angle: 180, layers: ['progressed'] },
  ] },
  { birthDate: '1945-02-01', month: 5, rows: [
    { passage: 'p172', target: 'Mercury', aspect: 'quincunx', angle: 150, layers: ['progressed'] },
    { passage: 'p201', target: 'Sun', aspect: 'sesquiquadrate', angle: 135, layers: ['progressed'] },
  ] },
  { birthDate: '1943-02-01', month: 2, rows: [
    { passage: 'p155', target: 'Mars', aspect: 'conjunction', angle: 0, layers: ['natal'] },
  ] },
  { birthDate: '1940-07-15', month: 9, rows: [
    { passage: 'p180', target: 'Neptune', aspect: 'trine', angle: 120, layers: ['progressed'] },
    { passage: 'p210', target: 'Uranus', aspect: 'trine', angle: 120, layers: ['natal', 'progressed'], matchesPreviousMonth: true },
  ] },
  { birthDate: '1954-01-15', month: 9, rows: [
    { passage: 'p152', target: 'Jupiter', aspect: 'quincunx', angle: 150, layers: ['progressed'] },
    { passage: 'p213', target: 'Uranus', aspect: 'opposition', angle: 180, layers: ['progressed'] },
  ] },
  { birthDate: '1975-11-01', month: 3, rows: [
    { passage: 'p185', target: 'Saturn', aspect: 'conjunction', angle: 0, layers: ['natal'], matchesPreviousMonth: true },
    { passage: 'p209', target: 'Uranus', aspect: 'square', angle: 90, layers: ['natal'] },
  ] },
  { birthDate: '1943-01-15', month: 8, rows: [
    { passage: 'p205', target: 'Uranus', aspect: 'conjunction', angle: 0, layers: ['progressed'], matchesPreviousMonth: true },
  ] },
  { birthDate: '1941-01-01', month: 2, rows: [
    { passage: 'p160', target: 'Mars', aspect: 'trine', angle: 120, layers: ['natal'], matchesPreviousMonth: true },
    { passage: 'p183', target: 'Neptune', aspect: 'opposition', angle: 180, layers: ['natal'] },
  ] },
  { birthDate: '1940-05-01', month: 9, rows: [
    { passage: 'p206', target: 'Uranus', aspect: 'semisextile', angle: 30, layers: ['natal'] },
  ] },
  { birthDate: '1946-04-01', month: 9, rows: [
    { passage: 'p151', target: 'Jupiter', aspect: 'sesquiquadrate', angle: 135, layers: ['progressed'] },
    { passage: 'p191', target: 'Saturn', aspect: 'sesquiquadrate', angle: 135, layers: ['natal'] },
  ] },
  { birthDate: '1943-02-15', month: 10, rows: [
    { passage: 'p207', target: 'Uranus', aspect: 'semisquare', angle: 45, layers: ['progressed'] },
  ] },
  { birthDate: '1935-01-01', month: 3, rows: [
    { passage: 'p150', target: 'Jupiter', aspect: 'trine', angle: 120, layers: ['progressed'], matchesPreviousMonth: true },
  ] },
  { birthDate: '1943-04-01', month: 5, rows: [
    { passage: 'p169', target: 'Mercury', aspect: 'square', angle: 90, layers: ['progressed'] },
    { passage: 'p189', target: 'Saturn', aspect: 'square', angle: 90, layers: ['natal'] },
  ] },
];

for (const { birthDate, birthTime = '00:00:00', month, rows } of groups) {
  test(`Leo lunar exact observations match only in the month of the exact contact (${birthDate}, month ${month})`, () => {
    const birth = Date.parse(`${birthDate}T${birthTime}.000Z`);
    const selectedMonth = submit(birth, month);
    const previousMonth = submit(birth, month - 1);
    const modelPrompts = new Map([selectedMonth, previousMonth].map(({ run }) => {
      const report = interpretFortune(run, requestForFortuneRun(run), 'leo-exact-observation');
      return [run, formatFortunePrompt(buildFortuneModelContext(run, report).input)];
    }));

    for (const { passage, target, aspect, angle, layers, matchesPreviousMonth } of rows) {
      const [positive, nearMiss] = matchesPreviousMonth ? [previousMonth, selectedMonth] : [selectedMonth, previousMonth];
      const isRule = rule => rule.knowledgeId.includes(`-leo-1906-interpretation-${passage}-`);
      const isAspect = ({ normalizedPayload: data }) => data.progressedBody === 'Moon' && data.natalTargetId === target
        && data.aspectType === aspect && data.coordinate === 'ecliptic_longitude';
      const match = positive.matches.find(isRule);
      assert.equal(match?.status, 'matched', passage);
      assert.deepEqual(match.unresolvedConditions, []);
      const meaning = getFortuneKnowledgeEntry(match.knowledgeId).interpretation.classical_meaning;
      assert.ok(modelPrompts.get(positive.run).includes(meaning), passage);
      assert.ok(!modelPrompts.get(nearMiss.run).includes(meaning), passage);
      const facts = positive.run.facts.filter(fact => match.sourceFactIds.includes(fact.factId));
      assert.deepEqual(facts.map(fact => fact.normalizedPayload.targetKind).sort(), layers);

      for (const fact of facts) {
        assert.equal(fact.factType, 'leo_lunar_exact_observation');
        assert.ok(isAspect(fact));
        assert.equal(fact.normalizedPayload.observed, true);
        assert.equal(fact.activeFrom, fact.exactInstant);
        assert.equal(Date.parse(fact.activeTo) - Date.parse(fact.activeFrom), 1_000);
        assert.ok(match.windows.some(window => window.start === fact.activeFrom && window.endExclusive === fact.activeTo));
        const epoch = progressionEpoch(birth, Date.parse(fact.exactInstant));
        const targetEpoch = fact.normalizedPayload.targetKind === 'natal' ? birth : epoch;
        const separation = Math.abs((longitude('Moon', epoch) - longitude(target, targetEpoch) + 540) % 360 - 180);
        assert.ok(Math.abs(separation - angle) < 0.00001, passage);
      }

      assert.ok(nearMiss.run.facts.some(fact => fact.factType === 'leo_progressed_aspect' && isAspect(fact)), passage);
      assert.ok(!nearMiss.run.facts.some(fact => fact.factType === 'leo_lunar_exact_observation' && isAspect(fact)), passage);
      assert.equal(nearMiss.matches.find(isRule)?.status, 'not_matched', passage);
    }
  });
}
