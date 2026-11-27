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
import { lillyPartileDistance } from './lilly-aspects.mjs';
import { compileLillyFamilySource, lillyFamilyAphorismFact } from './lilly-family.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-edition-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-edition-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const { witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-175-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-family-p${String(number).padStart(3, '0')}-001`;
const ordinary = [33, 35].map(idOf), historical = [47, 48, 49].map(idOf);
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const query = raw => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition: 'Christian Astrology',
}])[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, raw, historicalAphorism = false) => {
  const q = query(raw);
  return explainClaim(idOf(number), 'western', context(q), q.tradition, catalog, { historicalAphorism });
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const inputFacts = input => [...input.required, ...input.anyOf.flat()];
const proofFacts = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const without = (raw, planet) => raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== planet);
const sampleFor = number => witnesses.find(sample => sample.proofs.some(proof => proof.id === idOf(number)));

test('native charts cover every reviewed edition condition through SQLite, explanation and the appropriate report path', () => {
  const expected = new Map();
  for (const id of [...ordinary, ...historical]) {
    const row = catalog.get(id);
    assert.equal(row.matchScope, historical.includes(id) ? 'historical_aphorism' : undefined, id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 校订本';
    assert.equal(compileLillyFamilySource(changed).reason, 'source_review_required');
    for (const input of row.inputs) {
      assert.equal(new Set(inputFacts(input).map(fact => fact.table).filter(Boolean)).size, 1, id);
      expected.set(id + ':' + digest(input), input);
    }
  }
  assert.equal(expected.size, 62);
  assert.equal(witnesses.length, 29);
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    const q = query(rawOf(sample));
    const inputs = sample.proofs.map(({ id, inputDigest }) => expected.get(id + ':' + inputDigest));
    assert.ok(inputs.every(Boolean));
    const chart = claimChartContext('western', context(q), inputs.flatMap(inputFacts),
      (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const selected = chartContext('western', [...chart.present, lillyFamilyAphorismFact]);
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      assert.equal(evaluateRule(input, 'natal', historical.includes(id) ? selected : chart).matched, true, key);
      seen.add(key);
    }
    const reportIds = sample.proofs.filter(proof => ordinary.includes(proof.id)).map(proof => proof.id);
    const references = reportIds.length ? lookup([q]) : [];
    const materials = buildReportMaterials(references);
    const hits = references.flatMap(({ personality, events }) => [...personality, ...events]);
    assert.ok(hits.every(hit => !historical.includes(hit.id)));
    for (const id of new Set(sample.proofs.map(proof => proof.id))) {
      const explicit = historical.includes(id);
      const result = explainClaim(id, 'western', context(q), q.tradition, catalog, { historicalAphorism: explicit });
      assert.equal(result.matched, true, id);
      if (explicit) {
        assert.equal(result.matchScope, 'historical_aphorism', id);
        assert.equal(explainClaim(id, 'western', context(q), q.tradition, catalog).matched, false, id);
      } else {
        assert.ok(hits.some(hit => hit.id === id), id);
        assert.ok(materials.includes(result.claim.evidence.original_text), id);
        const familyEvidence = proofFacts(result).find(fact => fact.kind.startsWith('western_lilly_family_'));
        assert.ok(familyEvidence && materials.includes(factText(familyEvidence)), id);
      }
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('the paternal estate proof uses the printed Sun and Mars and the actual second cusp', () => {
  const raw = rawOf(sampleFor(35));
  const sun = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Sun');
  const mars = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Mars');
  const cusp = raw.find(fact => fact.kind === 'western_profile_cusp_longitude' && fact.house === 2).longitude;
  const ray = lillyPartileDistance(sun.longitude, cusp);
  assert.ok([90, 180].includes(ray));
  assert.equal(lillyPartileDistance(mars.longitude, cusp), ray);
  assert.equal(explain(35, raw).matched, true);
  assert.equal(explain(35, without(raw, 'Moon')).matched, true);
  assert.equal(explain(35, [...without(raw, 'Mars'),
    { kind: 'western_lilly_family_configuration', selector: 'estate_sun_mars_rays_second' }]).matched, false);
  assert.equal(explain(35, raw.filter(fact => fact.kind !== 'western_profile_cusp_longitude' || fact.house !== 2)).matched, false);
});

test('night estate loss keeps the waning Moon, its malefic and the adverse house evidence', () => {
  const raw = rawOf(sampleFor(33));
  const detail = explain(33, raw);
  assert.ok(proofFacts(detail).some(fact => fact.kind === 'western_lilly_solar_state' && fact.condition === 'oriental'));
  assert.equal(explain(33, raw.map(fact => fact.kind === 'western_sect' ? { ...fact, sect: 'day' } : fact)).matched, false);
  assert.equal(explain(33, without(raw, 'Moon')).matched, false);
  assert.equal(explain(33, raw.filter(fact => fact.kind !== 'western_profile_cusp_longitude' || fact.house !== 2)).matched, false);
  for (const number of [41, 56]) assert.equal(catalog.get(idOf(number)).reason, 'source_review_required');
});

test('mother chapter witnesses identify the same placed body and keep the historic text out of reports', () => {
  const raw = rawOf(sampleFor(47)), original = explain(47, raw, true);
  const { required, alternatives } = original.matchedConditions;
  const groups = alternatives.length ? alternatives.map(group => [...required, ...group]) : [required];
  for (const group of groups) {
    const placed = group.find(fact => fact.kind === 'western_lilly_planet_house' && fact.house === 10);
    const contact = group.find(fact => fact.kind === 'western_lilly_aspect');
    assert.deepEqual(new Set([contact.first, contact.second]), new Set(['jupiter', placed.planet.toLowerCase()]));
  }
  const contact = proofFacts(original).find(fact => fact.kind === 'western_lilly_aspect');
  assert.equal(explain(47, [...without(raw, 'Jupiter'), contact], true).matched, false);
  const references = lookup([query([...raw, lillyFamilyAphorismFact])]);
  assert.ok(references.flatMap(({ personality, events }) => [...personality, ...events]).every(hit => !historical.includes(hit.id)));
});
