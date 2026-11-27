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
import { lillyAspectAngles, lillyPartileDistance } from './lilly-aspects.mjs';
import { lillyFortune } from './lilly-fortune.mjs';
import { compileLillyWealthDuration, lillyWealthDurationProfile } from './lilly-wealth-duration.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-wealth-duration-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-wealth-duration-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const { witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-176-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-wealth-duration-p${String(number).padStart(3, '0')}-001`;
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const query = (raw, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition: 'Christian Astrology',
}], { timeKnown })[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, raw, timeKnown = true) => {
  const q = query(raw, timeKnown);
  return explainClaim(idOf(number), 'western', context(q), q.tradition, catalog);
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proofFacts = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const planetLongitude = (raw, planet) => raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === planet)?.longitude;

function sampleFor(number, predicate) {
  const id = idOf(number), groups = new Map(catalog.get(id).inputs.map(input => [digest(input), input]));
  return witnesses.find(sample => sample.proofs.some(proof => proof.id === id && predicate(groups.get(proof.inputDigest))));
}

test('the nine wealth durability groups reach SQLite, explanations and reports from native charts', () => {
  const expected = new Map();
  for (const id of [8, 9, 10, 20].map(idOf)) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyWealthDurationProfile, id);
    assert.equal(row.remainingAlternatives, 1, id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 校订本';
    assert.equal(compileLillyWealthDuration(changed).reason, 'source_review_required');
    for (const input of row.inputs) expected.set(id + ':' + digest(input), input);
  }
  assert.equal(expected.size, 9);
  assert.equal(witnesses.length, 9);
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    assert.ok(Number.isInteger(date.getTime() / 60000));
    const q = query(rawOf(sample));
    const chart = claimChartContext('western', context(q), [], (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const references = lookup([q]), materials = buildReportMaterials(references);
    const hits = references.flatMap(({ personality, events }) => [...personality, ...events]);
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      const evaluated = evaluateRule(input, 'natal', chart);
      assert.equal(evaluated.matched, true, key);
      const result = explainClaim(id, 'western', context(q), q.tradition, catalog);
      assert.equal(result.matched, true, key);
      assert.ok(hits.some(hit => hit.id === id), key);
      assert.ok(materials.includes(result.claim.evidence.original_text), key);
      for (const fact of [evaluated.conditions.required, ...evaluated.conditions.alternatives].flat()) {
        assert.ok(materials.includes(factText(fact)), key + ':' + factText(fact));
      }
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('each fixed star is projected to the verified Fortune or its own traditional ruler', () => {
  for (const [number, star] of [[8, 'oculus_taurus'], [9, 'cor_scorpii'], [10, 'caput_algol']]) {
    for (const lot of [true, false]) {
      const sample = sampleFor(number, input => input.required.some(fact => fact.target === 'lot') === lot);
      const raw = rawOf(sample), fortune = lillyFortune(raw);
      const mark = raw.find(fact => fact.kind === 'western_fixed_star_longitude' && fact.star === star);
      const target = lot ? 'lot' : fortune.ruler;
      const longitude = lot ? fortune.longitude : planetLongitude(raw, target);
      assert.equal(lillyPartileDistance(mark.longitude, longitude), 0);
      const detail = explain(number, raw);
      assert.ok(proofFacts(detail).some(fact => fact.kind === 'western_lilly_wealth_star_contact' && fact.star === star && fact.target === target));
      const forged = { kind: 'western_lilly_wealth_star_contact', star, target };
      assert.equal(explain(number, [...raw.filter(fact => fact !== mark), forged]).matched, false);
      assert.equal(explain(number, [...raw, { ...mark, longitude: (mark.longitude + 1) % 360 }]).matched, false);
      assert.equal(explain(number, raw, false).matched, false);
      if (!lot) assert.equal(explain(number, raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== target)).matched, false);
    }
  }
});

test('the cross-page combination actually links second-house placement, combustion and Fortune pressure', () => {
  const raw = rawOf(sampleFor(20, () => true));
  const detail = explain(20, raw);
  const [pressure] = proofFacts(detail).filter(fact => fact.kind === 'western_lilly_wealth_lot_pressure');
  const fortune = lillyFortune(raw);
  assert.equal(lillyPartileDistance(planetLongitude(raw, pressure.planet), fortune.longitude), lillyAspectAngles[pressure.aspect]);
  assert.ok(proofFacts(detail).some(fact => fact.kind === 'western_lilly_solar_state' && fact.selector === 'house_2_ruler' && fact.condition === 'combust'));
  assert.equal(explain(20, raw.filter(fact => fact.kind !== 'planet_longitude' || !['Mars', 'Saturn'].includes(fact.planet))).matched, false);
  assert.equal(explain(20, raw.filter(fact => fact.kind !== 'western_profile_cusp_longitude' || fact.house !== 2)).matched, false);
});
