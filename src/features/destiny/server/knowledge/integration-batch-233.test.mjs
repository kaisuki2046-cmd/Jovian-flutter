import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, zodiacNames } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyBookOneAspects, lillyBookOneAspectFacts, lillyBookOneAspectsProfile } from './lilly-book-one-aspects.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-chapter-xix-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const tradition = 'Christian Astrology';
const location = { latitude: 31.23, longitude: 121.47 };
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const idOf = passage => 'astro-lilly-v1-' + passage + '-001';
const numbered = (prefix, i) => prefix + '-p' + String(i).padStart(3, '0');
const aspect = i => numbered('aspects', i);
const table = i => numbered('aspect-table', i);
const degree = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const sign = (planet, index) => ({ kind: 'planet_sign', planet, sign: zodiacNames[index] });
const native = date => chartFacts.western(calculateWestern(Date.parse(date), location));

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  ['2024-03-01T00:00Z', [
    ...Array.from({ length: 9 }, (_, i) => table(i + 1)),
    ...[22, 28, 30, 33, 35, 38, 39, 40, 41, 42].map(aspect),
  ]],
  ['2024-03-10T09:00Z', [aspect(32)]],
  ['2024-03-11T10:00Z', [aspect(43)]],
  ['2024-03-12T11:00Z', [aspect(37)]],
  ['2024-03-23T22:00Z', [aspect(36)]],
  ['2024-10-21T18:00Z', [aspect(20)]],
  ['2026-04-20T12:00Z', [aspect(31)]],
];

function request(confirmedFacts, timeKnown = true, selectedTradition = tradition) {
  const queries = parseChartQueries([{
    method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts, tradition: selectedTradition,
  }], { timeKnown });
  assert.ok(queries);
  const [query] = queries;
  return { queries, chart: chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}

const explain = (passage, raw, timeKnown) =>
  explainClaim(idOf(passage), 'western', request(raw, timeKnown).chart, tradition, catalog, { historicalAphorism: true });

test('all 25 historical source IDs match real charts in SQLite and stay out of ordinary report lookup', () => {
  const ids = new Set(witnesses.flatMap(([, passages]) => passages.map(idOf)));
  assert.equal(ids.size, 25);
  for (const [date, passages] of witnesses) {
    const { chart, queries } = request(native(date));
    const rows = passages.map(passage => catalog.get(idOf(passage)));
    const requested = rows.flatMap(row => row.inputs.flatMap(({ required }) => required));
    const derived = claimChartContext('western', chart, requested, (sign, point) => catalog.lillyDignityCells(sign, point));
    const candidates = catalog.candidates('western', derived.presentKeys, tradition);
    assert.ok(candidates.every(row => !ids.has(row.claim.id)));
    const report = lookup(queries);
    assert.ok(report.flatMap(({ events, personality }) => [...events, ...personality]).every(hit => !ids.has(hit.id)));
    for (const { claim, compiler, inputs, matchScope } of rows) {
      const { id } = claim;
      assert.equal(compiler, lillyBookOneAspectsProfile, id);
      assert.equal(matchScope, 'historical_aphorism', id);
      const changed = structuredClone(claim);
      changed.evidence.context += '异本文字';
      assert.equal(compileLillyBookOneAspects(changed).reason, 'source_review_required', id);
      assert.equal(explainClaim(id, 'western', chart, tradition, catalog).reason, 'historical_aphorism_requires_opt_in', id);
      assert.ok(evaluateRule(inputs[0], 'natal', derived).matched, id);
      const result = explainClaim(id, 'western', chart, tradition, catalog, { historicalAphorism: true });
      assert.ok(result.matched, id);
      assert.ok(result.matchedConditions.required.length > 2, id);
      assert.match(result.calculationNote, /第十九章/u);
      for (const fact of result.matchedConditions.required) assert.doesNotMatch(factText(fact), /undefined|NaN/u, id);
    }
  }
});

test('the table checks every zodiac pairing and returns the direction from the named first planet', () => {
  const band = new Map([[2, [1, 2, 9]], [3, [3, 4, 9]], [4, [5, 6, 9]], [6, [7]], [1, [8]], [5, [8]]]);
  const subjects = Array.from({ length: 9 }, (_, i) => ({ kind: 'western_lilly_book_one_aspect_source', passage: table(i + 1) }));
  for (let a = 0; a < 12; a++) for (let b = 0; b < 12; b++) {
    const distance = Math.abs(a - b);
    const actual = lillyBookOneAspectFacts([tropical, sign('Sun', a), sign('Moon', b)], subjects, [], [])
      .map(({ passage }) => Number(passage.slice(-3)));
    assert.deepEqual(actual, band.get(Math.min(distance, 12 - distance)) ?? [], [a, b].join('/'));
  }
  const raw = [tropical, sign('Saturn', 0), sign('Moon', 10)];
  for (const [passage, first, second, steps] of [[table(1), 'Saturn', 'Moon', 10], [table(2), 'Moon', 'Saturn', 2]]) {
    const result = explain(passage, raw);
    const pair = result.matchedConditions.required.find(f => f.kind === 'western_lilly_book_one_sign_steps');
    assert.deepEqual([pair.first, pair.second, pair.steps], [first, second, steps]);
  }
  assert.equal(explain(table(1), [...raw, degree('Saturn', 35)]).matched, false);
});

test('retrograde application respects each printed orb table and separation starts at six arcminutes', () => {
  const speed = (planet, signedDegrees) => ({ kind: 'planet_hourly_motion', planet, signedDegrees });
  const raw = [tropical, degree('Mercury', 16.1), degree('Mars', 9), speed('Mercury', -0.07), speed('Mars', -0.02)];
  const result = explain(aspect(20), raw);
  const proofs = result.matchedConditions.required.filter(f => f.kind === 'western_lilly_aspect_phase');
  assert.deepEqual(proofs.map(({ first, second, table }) => [first, second, table]), [['mercury', 'mars', 'main']]);

  const separating = longitude => [
    tropical, degree('Jupiter', longitude), degree('Saturn', 10), speed('Jupiter', 0.01), speed('Saturn', 0.005),
  ];
  assert.equal(explain(aspect(22), separating(10.09)).matched, false);
  assert.ok(explain(aspect(22), separating(10.1)).matched);
  assert.equal(explain(aspect(22), separating(9.9)).matched, false);
});

test('historical chart checks require independent confirmed time, motion and solar coordinates', () => {
  const raw = native('2024-03-23T22:00Z');
  assert.ok(explain(aspect(36), raw).matched);
  assert.equal(explain(aspect(36), raw, false).matched, false);
  const retrograde = native('2024-10-21T18:00Z');
  assert.ok(explain(aspect(20), retrograde).matched);
  const noSpeeds = retrograde.filter(f => f.kind !== 'planet_hourly_motion');
  const forgedSource = { kind: 'western_lilly_book_one_aspect_source', passage: aspect(20) };
  assert.equal(explain(aspect(20), [...noSpeeds, forgedSource]).matched, false);
  assert.ok(request([...noSpeeds, forgedSource]).queries[0].confirmedFacts.every(f => f.kind !== forgedSource.kind));

  const sun = degree('Sun', 29.9);
  const near = [tropical, sun, degree('Mercury', 30.1)];
  assert.ok(explain(aspect(32), near).matched);
  assert.equal(explain(aspect(33), [tropical, sun, degree('Mercury', 37.5)]).matched, false);
  assert.ok(explain(aspect(35), [tropical, sun, degree('Mercury', 37.5)]).matched);
  assert.equal(explain(aspect(34), raw).matched, false);
});
