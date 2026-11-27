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
import { lillyAspect } from './lilly-aspects.mjs';
import { compileLillyProfessionSource, lillyProfessionWitnessProfile } from './lilly-profession-sources.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-profession-witnesses-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-profession-witnesses-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const fixtures = JSON.parse(readFileSync(new URL('./claims/integration-batch-166-witnesses.json', import.meta.url)));
const idOf = number => 'astro-lilly-v3-profession-p' + String(number).padStart(3, '0') + '-001';
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const parse = (confirmedFacts, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
  tradition: 'Christian Astrology', confirmedFacts,
}], { timeKnown })[0];
const context = parsed => chartContext('western', parsed.confirmedFacts, parsed.confirmedAbsentFacts, parsed.chartScope);
const explain = (number, parsed) => explainClaim(idOf(number), 'western', context(parsed), parsed.tradition, catalog);
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const derivation = (parsed, requested = []) => claimChartContext('western', context(parsed), requested,
  (sign, degree) => catalog.lillyDignityCells(sign, degree));

test('all reviewed professional modifier groups reach SQLite, the individual explanation and the report', () => {
  const ids = [1, 33, 34, 35, 36, 37, 72, 73, 74].map(idOf);
  const expected = new Map();
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyProfessionWitnessProfile);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileLillyProfessionSource(changed).reason, 'source_review_required');
    for (const input of row.inputs) {
      assert.ok(new Set([...input.required, ...input.anyOf.flat()].map(fact => fact.table).filter(Boolean)).size <= 1);
      expected.set(id + ':' + hash(input), input);
    }
  }
  assert.equal(expected.size, 28);
  assert.equal(fixtures.witnesses.length, 21);
  const seen = new Set();
  for (const sample of fixtures.witnesses) {
    const parsed = parse(rawOf(sample));
    const report = lookup([parsed]);
    const readings = report.flatMap(({ personality, events }) => [...personality, ...events]);
    const materials = buildReportMaterials(report);
    const inputs = sample.proofs.map(({ id, inputDigest }) => expected.get(id + ':' + inputDigest));
    assert.ok(inputs.every(Boolean));
    const chart = derivation(parsed, inputs.flatMap(input => [...input.required, ...input.anyOf.flat()]));
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest;
      assert.ok(expected.has(key) && !seen.has(key), key);
      const input = expected.get(key);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, key);
      const match = explainClaim(id, 'western', context(parsed), parsed.tradition, catalog);
      assert.equal(match.matched, true, key);
      assert.ok(readings.some(row => row.id === id), key);
      assert.match(match.calculationNote, /卷三第(?:626|632)页/u);
      assert.ok(materials.includes(catalog.get(id).claim.evidence.original_text), key);
      for (const fact of input.required.filter(item => item.kind === 'western_lilly_profession_selected')) {
        assert.ok(materials.includes(factText(fact)), key);
      }
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('a nearby trine cannot supply the precise transfer and Saturn needs an actual corresponding-degree contact', () => {
  const sample = fixtures.witnesses.find(item => item.proofs.some(proof => proof.id === idOf(1)));
  const raw = rawOf(sample);
  const hit = explain(1, parse(raw));
  assert.equal(hit.matched, true);
  assert.ok(hit.matchedConditions.alternatives.flat().some(fact => fact.kind === 'western_lilly_planet_house' && fact.planet === 'Mars'));
  const mars = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Mars');
  const mercury = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Mercury');
  const shifted = mars.longitude + (mars.longitude % 30 < 15 ? 2 : -2);
  assert.equal(lillyAspect(shifted, mercury.longitude, 'mars', 'mercury', 'trine', 'other'), true);
  const nearby = parse(raw.map(fact => fact === mars ? { ...mars, longitude: shifted } : fact));
  assert.ok(derivation(nearby).present.some(fact => fact.kind === 'western_lilly_profession_selected' && fact.planet === 'Mercury'));
  assert.equal(explain(1, nearby).matched, false);
  assert.equal(explain(1, parse(raw, false)).matched, false);

  assert.equal(fixtures.modes.length, 3);
  for (const sample of fixtures.modes) {
    const parsed = parse(rawOf(sample));
    const detail = explain(35, parsed);
    assert.ok(detail.matchedConditions.alternatives.flat().some(fact => fact.kind === 'western_lilly_partile_aspect'
      && fact.aspect === sample.aspect), sample.aspect);
  }
});

test('two malefics must target one confirmed career planet and a proven later selection can serve as that planet', () => {
  const recipients = detail => new Set([detail.matchedConditions.required, ...detail.matchedConditions.alternatives].flat()
    .filter(fact => fact.kind === 'western_lilly_profession_selected').map(fact => fact.planet));
  const split = parse(rawOf(fixtures.splitMalefics));
  const saturn = recipients(explain(72, split)), mars = recipients(explain(73, split));
  assert.ok(saturn.size && mars.size && [...saturn].every(planet => !mars.has(planet)));
  assert.equal(explain(74, split).matched, false);
  assert.equal(lookup([split]).flatMap(({ personality, events }) => [...personality, ...events]).some(hit => hit.id === idOf(74)), false);
  const jointSample = fixtures.witnesses.find(item => item.proofs.some(proof => proof.id === idOf(74)));
  const jointRaw = rawOf(jointSample);
  assert.equal(explain(74, parse(jointRaw)).matched, true);
  const lackingSaturn = jointRaw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Saturn');
  assert.equal(explain(74, parse(lackingSaturn)).matched, false);

  const laterRaw = rawOf(fixtures.laterChoice);
  const later = parse(laterRaw);
  const chart = derivation(later);
  const choice = chart.present.find(fact => fact.kind === 'western_lilly_profession_step' && fact.state === 'selected' && fact.step >= 3);
  const result = explainClaim(fixtures.laterChoice.id, 'western', context(later), later.tradition, catalog);
  assert.ok(recipients(result).has(choice.planet));
  const missing = laterRaw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Moon');
  const forged = parse([...missing, { kind: 'western_lilly_profession_selected', planet: choice.planet }]);
  assert.equal(explainClaim(fixtures.laterChoice.id, 'western', context(forged), forged.tradition, catalog).matched, false);
});
