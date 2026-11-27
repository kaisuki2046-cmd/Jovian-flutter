import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyProfessionSource, lillyProfessionDispositionProfile } from './lilly-profession-sources.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-sole-and-pairs-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-sole-and-pairs-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-168-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-profession-p${String(number).padStart(3, '0')}-001`;
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const parse = (confirmedFacts, { timeKnown = true, chartScope = 'natal' } = {}) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, tradition: 'Christian Astrology',
  confirmedFacts, chartScope,
}], { timeKnown })[0];
const context = query => chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (number, query) => explainClaim(idOf(number), 'western', context(query), query.tradition, catalog);
const sampleFor = n => witnesses.find(item => item.proofs.some(proof => proof.id === idOf(n)));
const derive = (q, requested = []) => claimChartContext('western', context(q), requested,
  (sign, degree) => catalog.lillyDignityCells(sign, degree));
const proofFacts = detail => [detail.matchedConditions.required, ...detail.matchedConditions.alternatives].flat();
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');

test('all sole Mars, node and mixed profession rules travel through SQLite, explanation and reporting', () => {
  const expected = new Map();
  for (const number of [52, 53, 54, 63, 66, 69, 70]) {
    const id = idOf(number), row = catalog.get(id);
    assert.equal(row.compiler, lillyProfessionDispositionProfile);
    assert.equal(row.remainingAlternatives, 1);
    const revised = structuredClone(row.claim);
    revised.evidence.context += ' 修订本';
    assert.equal(compileLillyProfessionSource(revised).reason, 'source_review_required');
    for (const input of row.inputs) {
      assert.ok(new Set([...input.required, ...input.anyOf.flat()].map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(id + ':' + hash(input), input);
    }
  }
  assert.equal(expected.size, 10);
  assert.equal(witnesses.length, 9);
  const seen = new Set();
  for (const sample of witnesses) {
    const q = parse(rawOf(sample));
    const reported = lookup([q]);
    const hits = reported.flatMap(({ personality, events }) => [...personality, ...events]);
    const materials = buildReportMaterials(reported);
    const inputs = sample.proofs.map(({ id, inputDigest }) => expected.get(id + ':' + inputDigest));
    assert.ok(inputs.every(Boolean));
    const derived = derive(q, inputs.flatMap(input => [...input.required, ...input.anyOf.flat()]));
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest;
      assert.ok(expected.has(key) && !seen.has(key), key);
      const input = expected.get(key);
      const match = evaluateRule(input, 'natal', derived);
      assert.equal(match.matched, true, key);
      const detail = explainClaim(id, 'western', context(q), q.tradition, catalog);
      assert.equal(detail.matched, true, key);
      assert.match(detail.calculationNote, /卷三第/u);
      assert.ok(hits.some(row => row.id === id), key);
      assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), key);
      for (const fact of input.required) assert.ok(materials.includes(factText(fact)), key);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the three Mars grades require independently proven sole selection and remain distinct', () => {
  const grades = [52, 53, 54];
  for (const grade of grades) {
    const raw = rawOf(sampleFor(grade));
    const q = parse(raw);
    assert.deepEqual(grades.filter(other => explain(other, q).matched), [grade]);
    assert.equal(explain(grade, parse(raw, { timeKnown: false })).matched, false);
  }
  const strong = rawOf(sampleFor(52));
  assert.equal(explain(52, parse(strong.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Saturn'))).matched, false);
  const pair = rawOf(sampleFor(66));
  const spoof = { kind: 'western_lilly_profession_sole', planet: 'Mars' };
  const parsed = parse([...pair, spoof]);
  const selections = derive(parsed).present.filter(fact => fact.kind === 'western_lilly_profession_selected');
  assert.ok(selections.some(fact => fact.planet === 'Mercury') && selections.some(fact => fact.planet === 'Mars'));
  assert.equal(derive(parsed).present.some(fact => fact.kind === spoof.kind), false);
  assert.ok(grades.every(grade => explain(grade, parsed).matched === false));
});

test('Jupiter needs the measured north node and an exact connection to the same career planet', () => {
  const cases = witnesses.filter(sample => sample.proofs.some(proof => proof.id === idOf(63)));
  for (const sample of cases) {
    const raw = rawOf(sample), node = raw.find(fact => fact.kind === 'western_true_node_longitude');
    const jupiter = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Jupiter');
    assert.equal(Math.floor(jupiter.longitude), Math.floor(node.longitude));
    const match = explain(63, parse(raw));
    assert.equal(match.matched, true);
    const proof = proofFacts(match);
    const planet = proof.find(fact => fact.kind === 'western_lilly_profession_selected').planet;
    assert.ok(proof.some(fact => fact.kind === 'western_lilly_partile_aspect' && fact.aspect === 'trine'
      && [fact.first, fact.second].includes(planet.toLowerCase())));
    assert.equal(explain(63, parse(raw.filter(fact => fact !== node))).matched, false);
    const south = { ...node, longitude: (node.longitude + 180) % 360 };
    assert.equal(explain(63, parse(raw.map(fact => fact === node ? south : fact))).matched, false);
    assert.equal(explain(63, parse([...raw, south])).matched, false);
    assert.equal(explain(63, parse(raw, { chartScope: 'annual' })).matched, false);
  }
});

test('the double-weak and triple-conjunction patterns keep all participants and orbital evidence', () => {
  const raw = rawOf(sampleFor(70));
  const detail = explain(70, parse(raw));
  assert.equal(detail.matched, true);
  for (const group of detail.matchedConditions.alternatives) {
    const weaknesses = group.filter(fact => fact.kind === 'western_lilly_dignity');
    assert.deepEqual(new Set(weaknesses.map(fact => fact.planet)), new Set(['Mars', 'Venus']));
    const contacts = group.filter(fact => fact.kind === 'western_lilly_aspect');
    assert.equal(contacts.length, 2);
    assert.equal(new Set(contacts.map(fact => fact.table)).size, 1);
  }
  assert.equal(explain(70, parse(raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Saturn'))).matched, false);
  const conjunction = rawOf(sampleFor(69));
  const match = explain(69, parse(conjunction));
  assert.equal(match.matched, true);
  assert.equal(match.matchedConditions.required.filter(fact => fact.kind === 'western_lilly_aspect' && fact.aspect === 'conjunction').length, 3);
  assert.equal(explain(69, parse(conjunction.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Moon'))).matched, false);
});
