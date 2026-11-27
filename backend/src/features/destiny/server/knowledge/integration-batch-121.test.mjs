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
import { compileLillyProfessionSource, lillyProfessionSelectionProfile, lillyProfessionSourcesProfile } from './lilly-profession-sources.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-121-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-profession-';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-profession-selection-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-profession-selection-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const key = (id, input) => id + ':' + hash(input);
const nativeFacts = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));

function query(confirmedFacts, timeKnown = true) {
  const [parsed] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context({ confirmedFacts, confirmedAbsentFacts, chartScope }) {
  return chartContext('western', confirmedFacts, confirmedAbsentFacts, chartScope);
}
const refs = parsed => lookup([parsed]).flatMap(ref => [...ref.personality, ...ref.events]);
const explain = (n, facts) => explainClaim(prefix + n, 'western', context(query(facts)), undefined, catalog);
const sampleFor = n => fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === prefix + n));

test('all reviewed career selection and dignity groups reach SQLite, explanation and reports', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, id.includes('-method-') ? lillyProfessionSelectionProfile : lillyProfessionSourcesProfile, id);
    for (const input of row.inputs) {
      // This fixture covers the original third-step selection.
      if (id.endsWith('-method-p005-001') && !input.required.some(fact => fact.step === 3)) continue;
      const all = [...input.required, ...input.anyOf.flat()];
      assert.ok(new Set(all.map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(key(id, input), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.original_text += ' changed';
    assert.equal(compileLillyProfessionSource(changed).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = query(nativeFacts(sample)), observed = context(parsed);
    const reference = lookup([parsed]);
    const hits = reference.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(reference);
    for (const { id, inputDigest } of sample.proofs) {
      const proof = id + ':' + inputDigest, input = expected.get(proof);
      assert.ok(input, proof);
      const hit = hits.find(row => row.id === id);
      const requests = [...input.required, ...input.anyOf.flat()];
      const chart = claimChartContext('western', observed, requests, (sign, degree) => catalog.lillyDignityCells(sign, degree));
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, proof);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', observed, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.match(detail.calculationNote, /职业选星|职业篇由前两步/u);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  assert.ok(refs(query(nativeFacts(fixture.witnesses[0]), false)).every(row => !ids.has(row.id)));
});

test('the third selection step does not replace unknown earlier conditions or rank three partile candidates', () => {
  const coordinates = { Sun: 20, Moon: 100.8, Mercury: 10.2, Venus: 40.3, Mars: 220.4 };
  const facts = [
    { kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'western_sect', sect: 'day' },
    { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...Array.from({ length: 12 }, (_, index) => ({
      kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: index * 30,
    })),
    ...Object.entries(coordinates).map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude })),
  ];
  const chart = claimChartContext('western', context(query(facts)), [], (sign, degree) => catalog.lillyDignityCells(sign, degree));
  const stage = chart.present.filter(fact => fact.kind === 'western_lilly_profession_step' && fact.step === 3);
  assert.deepEqual(new Set(stage.map(({ planet }) => planet)), new Set(['Mercury', 'Venus', 'Mars']));
  assert.ok(stage.every(({ state }) => state === 'candidate'));
  assert.equal(explain('method-p017-001', facts).matched, true);
  assert.equal(explain('method-p005-001', facts).matched, false);

  const incomplete = facts.filter(fact => fact.planet !== 'Mercury');
  const forged = { kind: 'western_lilly_profession_partile_comparison' };
  assert.equal(explain('method-p017-001', [...incomplete, forged]).matched, false);
  assert.ok(refs(query([...incomplete, forged])).every(hit => hit.id !== prefix + 'method-p017-001'));
});

test('a confirmed third-step selection remains distinct from first-two membership and later source alternatives', () => {
  const id = 'method-p005-001', facts = nativeFacts(sampleFor(id));
  const detail = explain(id, facts);
  assert.equal(catalog.get(prefix + id).remainingAlternatives, undefined);
  const choice = detail.matchedConditions.required.find(fact => fact.kind === 'western_lilly_profession_step');
  assert.equal(choice.state, 'selected');
  assert.match(factText(choice), /第3步.*唯一照月候选/u);
  const incomplete = facts.filter(fact => fact.kind !== 'planet_longitude' ||
    !['Venus', 'Mercury', 'Mars'].includes(fact.planet) || fact.planet === choice.planet);
  assert.equal(explain(id, incomplete).matched, false);
  const chart = claimChartContext('western', context(query(facts)), [], (sign, degree) => catalog.lillyDignityCells(sign, degree));
  assert.ok(!chart.present.some(fact => fact.kind === 'western_lilly_profession_ruler'));
});

test('direct Mercury cazimi comes from the ephemeris, while Saturn must witness the qualifying configuration', () => {
  const solarId = 'p015-001';
  const cazimi = nativeFacts(fixture.cazimi);
  const result = explain(solarId, cazimi);
  assert.equal(result.matched, true);
  assert.ok(result.matchedConditions.alternatives.some(group => group.some(fact => fact.condition === 'cazimi')));
  const conflicting = [...cazimi, { kind: 'planet_motion', planet: 'Mercury', motion: 'retrograde' }];
  assert.equal(explain(solarId, conflicting).matched, false);

  const saturnId = 'p042-001', joined = nativeFacts(sampleFor(saturnId));
  assert.equal(explain(saturnId, joined).matched, true);
  const withoutSaturn = joined.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Saturn');
  assert.equal(explain('p041-001', withoutSaturn).matched, true);
  assert.equal(explain(saturnId, withoutSaturn).matched, false);
});

test('Venus occupies a dignity belonging to the Sun in the source direction', () => {
  const id = 'p050-001', facts = nativeFacts(sampleFor(id));
  const match = explain(id, facts);
  assert.equal(match.matched, true);
  const receptions = match.matchedConditions.alternatives.flat().filter(fact => fact.kind === 'western_lilly_reception');
  assert.ok(receptions.length);
  assert.ok(receptions.every(fact => fact.first === 'sun' && fact.second === 'venus' && fact.matches));
});
