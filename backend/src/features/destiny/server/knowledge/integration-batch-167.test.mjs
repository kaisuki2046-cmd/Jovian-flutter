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

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-profession-dispositions-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-profession-dispositions-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const fixtures = JSON.parse(readFileSync(new URL('./claims/integration-batch-167-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-profession-p${String(number).padStart(3, '0')}-001`;
const rawOf = ({ date, latitude, longitude }) => chartFacts.western(calculateWestern(Date.parse(date), { latitude, longitude }));
const parse = (confirmedFacts, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, tradition: 'Christian Astrology',
  confirmedFacts,
}], { timeKnown })[0];
const context = parsed => chartContext('western', parsed.confirmedFacts, parsed.confirmedAbsentFacts, parsed.chartScope);
const explain = (number, parsed) => explainClaim(idOf(number), 'western', context(parsed), parsed.tradition, catalog);
const sampleFor = number => fixtures.witnesses.find(sample => sample.proofs.some(proof => proof.id === idOf(number)));
const proofs = detail => [detail.matchedConditions.required, ...detail.matchedConditions.alternatives].flat();
const derive = (parsed, requested = []) => claimChartContext('western', context(parsed), requested,
  (sign, degree) => catalog.lillyDignityCells(sign, degree));
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');

test('the reviewed dignity, placement and solar groups reach SQLite, explanation and reporting', () => {
  const ids = [3, 18, 20, 24, 49, 55, 71, 77].map(idOf);
  const expected = new Map();
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyProfessionDispositionProfile);
    assert.equal(row.remainingAlternatives, 1);
    const revised = structuredClone(row.claim);
    revised.conditions.normalized.push('异本条件');
    assert.equal(compileLillyProfessionSource(revised).reason, 'source_review_required');
    for (const input of row.inputs) {
      assert.ok(new Set([...input.required, ...input.anyOf.flat()].map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(id + ':' + hash(input), input);
    }
  }
  assert.equal(expected.size, 18);
  assert.equal(fixtures.witnesses.length, 11);
  const seen = new Set(), solar = new Set();
  for (const sample of fixtures.witnesses) {
    const q = parse(rawOf(sample));
    const reports = lookup([q]);
    const readings = reports.flatMap(({ personality, events }) => [...personality, ...events]);
    const materials = buildReportMaterials(reports);
    const inputs = sample.proofs.map(({ id, inputDigest }) => expected.get(id + ':' + inputDigest));
    assert.ok(inputs.every(Boolean));
    const derived = derive(q, inputs.flatMap(input => [...input.required, ...input.anyOf.flat()]));
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest;
      assert.ok(expected.has(key) && !seen.has(key), key);
      const input = expected.get(key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      const detail = explainClaim(id, 'western', context(q), q.tradition, catalog);
      assert.equal(detail.matched, true, key);
      assert.match(detail.calculationNote, /卷三第/u);
      assert.ok(readings.some(row => row.id === id), key);
      assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), key);
      for (const fact of input.required) assert.ok(materials.includes(factText(fact)), key);
      if (id === idOf(18)) solar.add(input.required.find(fact => fact.kind === 'western_lilly_solar_state').condition);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  assert.deepEqual(solar, new Set(['combust', 'cazimi']));
});

test('clearance requires observed positions and does not accept a supplied absence', () => {
  const raw = rawOf(sampleFor(3));
  const hit = explain(3, parse(raw));
  assert.equal(hit.matched, true);
  const clearance = hit.matchedConditions.required.find(fact => fact.kind === 'western_lilly_profession_condition'
    && fact.condition === 'clear_partile_malefics');
  const longitude = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === clearance.planet).longitude;
  const withoutSaturn = raw.filter(fact => fact.planet !== 'Saturn');
  assert.equal(explain(3, parse([...withoutSaturn, clearance])).matched, false);
  const square = { kind: 'planet_longitude', planet: 'Saturn', longitude: (longitude + 90) % 360 };
  assert.equal(explain(3, parse([...withoutSaturn, square])).matched, false);
  assert.equal(explain(3, parse(raw, false)).matched, false);
});

test('the solar exception and the two Venus-Saturn source branches retain their own triggers', () => {
  const raw = rawOf(fixtures.independentSolar);
  const solar = explain(18, parse(raw));
  assert.equal(solar.matched, true);
  assert.equal(proofs(solar).find(fact => fact.kind === 'western_lilly_solar_state').condition, fixtures.independentSolar.condition);
  assert.equal(proofs(solar).some(fact => fact.kind === 'western_lilly_profession_selected'), false);
  assert.equal(explain(18, parse(raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Sun'))).matched, false);

  const conjunction = parse(rawOf(fixtures.pureConjunction));
  const mixed = explain(49, conjunction);
  assert.equal(mixed.matched, true);
  assert.ok(proofs(mixed).some(fact => fact.kind === 'western_lilly_aspect' && fact.aspect === 'conjunction'));
  assert.equal(explain(77, conjunction).matched, false);
  const ray = explain(77, parse(rawOf(sampleFor(77))));
  assert.equal(ray.matched, true);
  assert.ok(proofs(ray).some(fact => fact.kind === 'western_lilly_aspect' && fact.aspect === 'any'));
});

test('cadent weakness and planetary pairs preserve same-body and same-table evidence', () => {
  const cadentRaw = rawOf(sampleFor(71));
  const cadent = explain(71, parse(cadentRaw));
  const selected = cadent.matchedConditions.required.find(fact => fact.kind === 'western_lilly_profession_selected').planet;
  for (const group of cadent.matchedConditions.alternatives) {
    assert.ok(group.some(fact => fact.kind === 'western_lilly_planet_house' && fact.planet === selected && [3, 6, 9, 12].includes(fact.house)));
    assert.ok(group.some(fact => fact.kind === 'western_lilly_dignity' && fact.planet === selected && ['fall', 'detriment'].includes(fact.dignity)));
    const contacts = group.filter(fact => fact.kind === 'western_lilly_aspect');
    assert.equal(contacts.length, 2);
    assert.equal(new Set(contacts.map(fact => fact.table)).size, 1);
    assert.ok(contacts.every(fact => [fact.first, fact.second].includes(selected.toLowerCase())));
  }
  assert.equal(explain(71, parse(cadentRaw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Saturn'))).matched, false);

  const good = parse(rawOf(sampleFor(20)));
  assert.equal(explain(20, good).matched, true);
  assert.equal(explain(55, good).matched, false);
  const bad = parse(rawOf(sampleFor(55)));
  assert.equal(explain(55, bad).matched, true);
  assert.equal(explain(20, bad).matched, false);
});
