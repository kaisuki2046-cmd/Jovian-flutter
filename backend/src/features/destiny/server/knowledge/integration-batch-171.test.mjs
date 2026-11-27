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
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyFamilySource, lillyFamilyProfile } from './lilly-family.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-family-estate-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-family-estate-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const { witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-171-witnesses.json', import.meta.url)));
const originals = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-family-p${String(number).padStart(3, '0')}-001`;
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const sampleFor = number => rawOf(witnesses.find(sample => sample.proofs.some(proof => proof.id === idOf(number))));
const query = (confirmedFacts, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts, tradition: 'Christian Astrology',
}], { timeKnown })[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, q) => explainClaim(idOf(number), 'western', context(q), q.tradition, catalog);
const observed = q => claimChartContext('western', context(q), [], (sign, degree) => catalog.lillyDignityCells(sign, degree));
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const withoutLongitude = (raw, planet) => raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== planet);
const matchedFacts = detail => [detail.matchedConditions.required, ...detail.matchedConditions.alternatives].flat();

test('every reviewed family and estate group matches a native chart through SQLite, explanation and report materials', () => {
  const expected = new Map();
  for (const number of [12, 13, 14, 15, 17, 30, 31, 32, 34, 65]) {
    const id = idOf(number), row = catalog.get(id);
    assert.equal(row.compiler, lillyFamilyProfile);
    assert.equal(row.remainingAlternatives, 1);
    const changed = structuredClone(originals.find(claim => claim.id === id));
    changed.evidence.context += ' 校订本';
    assert.equal(compileLillyFamilySource(changed).reason, 'source_review_required');
    for (const input of row.inputs) {
      assert.ok(new Set([...input.required, ...input.anyOf.flat()].map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(id + ':' + digest(input), input);
    }
  }
  assert.equal(expected.size, 21);
  assert.equal(witnesses.length, 13);
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    const q = query(rawOf(sample)), chart = observed(q);
    const references = lookup([q]), materials = buildReportMaterials(references);
    const hits = references.flatMap(({ personality, events }) => [...personality, ...events]);
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      const result = evaluateRule(input, 'natal', chart);
      assert.equal(result.matched, true, key);
      const detail = explainClaim(id, 'western', context(q), q.tradition, catalog);
      assert.equal(detail.matched, true, key);
      assert.ok(hits.some(row => row.id === id), key);
      assert.match(detail.calculationNote, /莉莉卷三/u);
      assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), key);
      for (const fact of [result.conditions.required, ...result.conditions.alternatives].flat()) {
        assert.ok(materials.includes(factText(fact)), key + ':' + factText(fact));
      }
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the father background uses the reviewed clause while SQLite retains the imported source', () => {
  const number = 17, id = idOf(number), raw = sampleFor(number), q = query(raw);
  const original = originals.find(claim => claim.id === id);
  const stored = catalog.inventory().find(row => row.claim.id === id);
  assert.deepEqual(stored.claim, original);
  assert.equal(stored.lookup.revisedEvidence, true);
  const corrected = compileLillyFamilySource(original).reviewedOriginalText;
  const detail = explain(number, q);
  assert.equal(detail.claim.evidence.original_text, corrected);
  assert.match(corrected, /Father.*good Parents/u);
  const material = buildReportMaterials(lookup([q]).map(report => ({ ...report, personality: [], events: report.events.filter(row => row.id === id) })));
  assert.ok(material.includes(corrected));
  assert.ok(!material.includes(original.evidence.original_text));
  assert.equal(explain(number, query(raw.filter(fact => fact.kind !== 'western_true_node_longitude'))).matched, false);
  assert.equal(explain(number, query(withoutLongitude(raw, 'Moon'))).matched, false);
});

test('all-member comparisons and the fourth-house co-occupancy require observed bodies', () => {
  const blocked = sampleFor(12), blockedDetail = explain(12, query(blocked));
  assert.ok(blockedDetail.matchedConditions.required.some(fact => fact.kind === 'western_lilly_family_role' && fact.parent === 'father'));
  assert.equal(explain(12, query(withoutLongitude(blocked, 'Mars'))).matched, false);
  assert.equal(explain(12, query(blocked, false)).matched, false);

  const mixed = sampleFor(13), leader = matchedFacts(explain(13, query(mixed)))
    .find(fact => fact.kind === 'western_lilly_family_fourth_priority');
  assert.ok(leader && matchedFacts(explain(13, query(mixed))).some(fact => fact.kind === 'western_lilly_planet_house'
    && fact.house === 4 && fact.planet === leader.planet));
  assert.equal(explain(13, query([...withoutLongitude(mixed, leader.planet), leader])).matched, false);

  const joint = sampleFor(34), proof = matchedFacts(explain(34, query(joint)));
  const fifth = proof.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 5);
  assert.deepEqual(new Set(proof.filter(fact => fact.kind === 'western_lilly_planet_house' && fact.house === 4)
    .map(fact => fact.planet)), new Set(['Mars', 'Saturn', fifth.planet]));
  assert.equal(explain(34, query(withoutLongitude(joint, fifth.planet))).matched, false);
});

test('estate strengthening preserves its participating benefic and missing data cannot prove an absence', () => {
  const estateSamples = witnesses.filter(sample => sample.proofs.some(proof => proof.id === idOf(30))).map(rawOf);
  const night = estateSamples.find(raw => raw.some(fact => fact.kind === 'western_sect' && fact.sect === 'night'));
  assert.ok(night);
  const evidence = matchedFacts(explain(30, query(night))).filter(fact => fact.kind === 'western_lilly_family_estate_support');
  assert.ok(evidence.length && evidence.every(fact => fact.sect === 'night' && ['Venus', 'Jupiter'].includes(fact.planet)));
  for (const light of ['Saturn', 'Moon']) assert.equal(explain(30, query([...withoutLongitude(night, light), ...evidence])).matched, false);

  for (const number of [31, 32]) {
    const raw = sampleFor(number), q = query(raw);
    const assessment = matchedFacts(explain(number, q)).find(fact => fact.kind === 'western_lilly_family_assessment');
    for (const planet of ['Jupiter', 'Venus']) {
      assert.equal(explain(number, query([...withoutLongitude(raw, planet), assessment])).matched, false);
    }
    assert.equal(explain(number === 31 ? 32 : 31, q).matched, false);
    const target = number === 31 ? 'Sun' : 'Saturn';
    const longitude = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === target).longitude;
    const intervening = raw.filter(fact => fact.planet !== 'Jupiter' || !['planet_longitude', 'planet_sign'].includes(fact.kind));
    assert.equal(explain(number, query([...intervening,
      { kind: 'planet_longitude', planet: 'Jupiter', longitude: (longitude + 60) % 360 }])).matched, false);
  }
});
