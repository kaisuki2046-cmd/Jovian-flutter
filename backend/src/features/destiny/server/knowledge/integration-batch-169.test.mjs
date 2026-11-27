import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyProfessionSource, lillyProfessionDispositionProfile } from './lilly-profession-sources.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-profession-contributors-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-profession-contributors-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-169-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-profession-p${String(number).padStart(3, '0')}-001`;
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const parse = (confirmedFacts, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts, tradition: 'Christian Astrology',
}], { timeKnown })[0];
const context = query => chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (number, query) => explainClaim(idOf(number), 'western', context(query), query.tradition, catalog);
const derive = (q, requested = []) => claimChartContext('western', context(q), requested,
  (sign, degree) => catalog.lillyDignityCells(sign, degree));
const sampleFor = n => fixture.witnesses.find(item => item.proofs.some(proof => proof.id === idOf(n)));
const ruleFacts = input => [...input.required, ...input.anyOf.flat()];
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proofFacts = detail => [detail.matchedConditions.required, ...detail.matchedConditions.alternatives].flat();
const without = (raw, planet) => raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== planet);

test('all multi-planet and relative aspect groups match native charts in the accepted birth-date range', () => {
  const expected = new Map();
  for (const n of [59, 60, 61, 62, 75]) {
    const id = idOf(n), row = catalog.get(id);
    assert.equal(row.compiler, lillyProfessionDispositionProfile);
    assert.equal(row.remainingAlternatives, 1);
    const edited = structuredClone(row.claim);
    edited.evidence.context += ' 校订本';
    assert.equal(compileLillyProfessionSource(edited).reason, 'source_review_required');
    for (const input of row.inputs) {
      assert.ok(new Set(ruleFacts(input).map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(id + ':' + hash(input), input);
    }
  }
  assert.equal(expected.size, 15);
  assert.equal(fixture.witnesses.length, 10);
  const seen = new Set(), houses = new Set();
  for (const sample of fixture.witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    const q = parse(rawOf(sample)), reported = lookup([q]), materials = buildReportMaterials(reported);
    const hits = reported.flatMap(({ personality, events }) => [...personality, ...events]);
    const inputs = sample.proofs.map(({ id, inputDigest }) => expected.get(id + ':' + inputDigest));
    assert.ok(inputs.every(Boolean));
    const derived = derive(q, inputs.flatMap(ruleFacts));
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      const match = evaluateRule(input, 'natal', derived);
      assert.equal(match.matched, true, key);
      const explanation = explainClaim(id, 'western', context(q), q.tradition, catalog);
      assert.equal(explanation.matched, true, key);
      assert.ok(hits.some(row => row.id === id), key);
      assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), key);
      for (const fact of match.conditions.required) {
        if (fact.kind === 'western_lilly_planet_house') houses.add(fact.house);
        assert.ok(materials.includes(factText(fact)), key);
      }
      assert.ok(match.conditions.alternatives.some(group => group.every(fact => materials.includes(factText(fact)))), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  assert.deepEqual(houses, new Set([3, 5, 9, 11, 12]));
});

test('a triple conjunction in an eligible house needs real career evidence for Mercury and Venus', () => {
  const { house } = fixture.noCareerBasis;
  const number = house === 9 ? 60 : house === 12 ? 61 : 59;
  const raw = rawOf(fixture.noCareerBasis);
  const q = parse(raw);
  const input = catalog.get(idOf(number)).inputs.find(row => row.required.some(fact => fact.house === house));
  const chart = derive(q, ruleFacts(input));
  assert.equal(evaluateRule({ ...input, anyOf: [] }, 'natal', chart).matched, true);
  assert.equal(explain(number, q).matched, false);
  const spoofed = ['Mercury', 'Venus'].map(planet => ({ kind: 'western_lilly_profession_selected', planet }));
  assert.equal(explain(number, parse([...raw, ...spoofed])).matched, false);
  const positive = rawOf(sampleFor(number));
  assert.equal(explain(number, parse(positive)).matched, true);
  assert.equal(explain(number, parse(without(positive, 'Jupiter'))).matched, false);
  assert.equal(explain(number, parse(positive, false)).matched, false);
});

test('the application report receives the independent Jupiter and Moon contacts', async () => {
  const raw = rawOf(sampleFor(62)), q = parse(raw);
  const detail = explain(62, q);
  assert.equal(detail.matched, true);
  for (const group of detail.matchedConditions.alternatives) {
    const relations = group.filter(fact => fact.kind === 'western_lilly_aspect');
    assert.equal(relations.length, 4);
    assert.equal(new Set(relations.map(fact => fact.table)).size, 1);
    for (const witness of ['jupiter', 'moon']) {
      for (const planet of ['mercury', 'venus']) {
        assert.ok(relations.some(({ first, second }) => [first, second].includes(witness) && [first, second].includes(planet)));
      }
    }
  }
  assert.equal(explain(62, parse(without(raw, 'Moon'))).matched, false);
  const report = await generateReport({ chartQueries: [q] }, { lookup, signal: new AbortController().signal,
    complete: async request => {
      assert.ok(request.materials.includes(catalog.get(idOf(62)).claim.evidence.original_text));
      assert.match(request.materials, /分别核木星、月亮各与水星及金星/u);
      return '报表测试通过';
    } });
  assert.equal(report.report, '报表测试通过');
});

test('the aspect comparison has two distinct exact witnesses on the same profession planet', () => {
  const detail = explain(75, parse(rawOf(sampleFor(75))));
  assert.equal(detail.matched, true);
  assert.match(detail.calculationNote, /三合在这两个见证中优先/u);
  const selected = proofFacts(detail).find(fact => fact.kind === 'western_lilly_profession_selected').planet.toLowerCase();
  const group = detail.matchedConditions.alternatives[0].filter(fact => fact.kind === 'western_lilly_partile_aspect');
  assert.deepEqual(new Set(group.map(fact => fact.aspect)), new Set(['trine', 'sextile']));
  assert.ok(group.every(({ first, second }) => [first, second].includes(selected)));
  assert.equal(new Set(group.map(({ first, second }) => [first, second].find(planet => planet !== selected))).size, 2);
});
