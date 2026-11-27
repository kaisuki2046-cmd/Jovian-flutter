import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyTravelProfile } from './lilly-travel.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const { place, witnesses, sourceRecords, alternatives } =
  JSON.parse(readFileSync(new URL('./claims/integration-batch-68-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory(), lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const idOf = suffix => 'astro-lilly-v3-travel-' + suffix + '-001';
const raw = instant => chartFacts.western(calculateWestern(Date.parse(instant), place));
const hits = refs => refs.flatMap(ref => [...ref.events, ...ref.personality]);
const reviewedIds = new Set(witnesses.flatMap(witness => witness.proofs.map(proof => proof.id)));

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

const explanationsFor = ({ confirmedFacts, confirmedAbsentFacts }) =>
  id => explainClaim(id, 'western', chartContext('western', confirmedFacts, confirmedAbsentFacts), undefined, catalog);

test('every reviewed travel alternative reaches SQLite, explanation and report evidence from native positions', () => {
  assert.equal(reviewedIds.size, sourceRecords);
  assert.equal(sourceRecords, 25);
  const expected = new Set();
  for (const id of reviewedIds) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyTravelProfile);
    assert.equal(row.remainingAlternatives, 0);
    for (const input of row.inputs) expected.add(id + ':' + digest(input));
    const edited = structuredClone(row.claim);
    edited.evidence.context += ' alternate evidence';
    assert.equal(compileWesternClaim(edited).reason, 'source_review_required');
  }
  assert.equal(expected.size, alternatives);
  const seen = new Set();
  for (const { instant, proofs } of witnesses) {
    const parsed = query(raw(instant));
    const refs = lookup(parsed), found = hits(refs);
    const explain = explanationsFor(parsed[0]), materials = buildReportMaterials(refs);
    for (const { id, inputDigest } of proofs) {
      const row = catalog.get(id);
      const alternative = row.inputs.find(input => digest(input) === inputDigest);
      assert.ok(alternative, id);
      const actual = found.find(hit => hit.id === id);
      assert.ok(actual, id);
      const proof = explain(id);
      assert.ok(proof.matched, id);
      const groups = proof.matchedConditions.alternatives.length
        ? proof.matchedConditions.alternatives : [proof.matchedConditions.required];
      assert.ok(groups.some(required => JSON.stringify(required) === JSON.stringify(alternative.required)), id);
      assert.match(proof.calculationNote, /远行章/u);
      assert.ok(materials.includes(row.claim.evidence.original_text), id);
      seen.add(id + ':' + inputDigest);
    }
    assert.doesNotMatch(materials, /western_lilly_travel/u);
  }
  assert.deepEqual(seen, expected);
});

test('the travel gate uses confirmed chart facts and transport requires a strict majority', () => {
  const withoutTestimony = query(raw('1959-12-26T00:15:00.000Z'));
  assert.ok(!hits(lookup(withoutTestimony)).some(hit => reviewedIds.has(hit.id)));
  const facts = raw('1924-01-01T08:15:00.000Z');
  const ids = new Set(hits(lookup(query(facts))).map(hit => hit.id));
  assert.ok(ids.has(idOf('p006')));
  assert.ok(!ids.has(idOf('followup-p017')) && !ids.has(idOf('followup-p018')));
  const direction = idOf('followup-p007');
  const witnessFacts = raw('1924-03-04T12:15:00.000Z');
  const reference = explanationsFor(query(witnessFacts)[0])(direction);
  assert.ok(reference.matched);
  assert.ok(reference.matchedConditions.required.filter(fact => fact.kind === 'western_lilly_travel')
    .every(fact => fact.table === 'main'));
  assert.deepEqual(reference.matchedConditions.alternatives, []);
  const incomplete = witnessFacts.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Moon');
  const forged = reference.matchedConditions.required.filter(fact => fact.kind === 'western_lilly_travel');
  for (const parsed of [query([...incomplete, ...forged]), query(witnessFacts, false)]) {
    assert.equal(explanationsFor(parsed[0])(direction).matched, false);
    assert.ok(!hits(lookup(parsed)).some(hit => hit.id === direction));
  }
});
