import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim, pendingClaimConditions } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { lillyFortune, lillyFortuneProfile } from './lilly-fortune.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-35-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-35-witnesses.json', import.meta.url)));
const maleId = 'astro-lilly-v3-spouse-origin-p002-001';
const femaleId = 'astro-lilly-v3-women-marriage-p005-001';
const inheritanceId = 'astro-lilly-v3-wealth-means-p005-001';
const witnessId = 'astro-lilly-v3-religion-dreams-p019-001';
const friendlyId = 'astro-lilly-v3-religion-dreams-p020-001';
const maleficId = 'astro-lilly-v3-religion-dreams-p021-001';
const catalog = catalogForDirectory(catalogDirectory);
const fingerprint = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const nativeFacts = witness => [...chartFacts.western(calculateWestern(Date.parse(witness.date), witness)),
  { kind: 'natal_gender', gender: witness.gender }];
const witnessFacts = id => nativeFacts(native.witnesses.find(witness => witness.proofs.some(proof => proof.id === id)));
const has = (id, facts) => lookupInterpretations(catalogDirectory, query(facts)).some(hit => hit.id === id);

function preciseFacts(ascendant, positions) {
  return [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...Array.from({ length: 12 }, (_, i) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus',
      house: i + 1, longitude: (ascendant + 30 * i) % 360 })),
    ...Object.entries(positions).map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude }))];
}

test('Lilly’s printed Fortune example, wraparound and day/night formula agree with precise cusps', () => {
  // Book II pp.143–144: Leo 23°27′ + Virgo 21°18′ − Aries 4°18′.
  const facts = preciseFacts(143.45, { Moon: 171.3, Sun: 4.3, Saturn: 130 });
  for (const sect of ['day', 'night']) {
    const result = lillyFortune([...facts, { kind: 'western_sect', sect }]);
    assert.ok(Math.abs(result.longitude - 310.45) < 1e-9);
    assert.equal(result.ruler, 'Saturn');
  }
  // With ASC 355°, a six-degree forward arc wraps to 1°.
  const wrapped = lillyFortune(preciseFacts(355, { Moon: 3, Sun: 357 }));
  assert.equal(wrapped.longitude, 1);
  assert.equal(wrapped.house, 1);
  assert.equal(lillyFortune(preciseFacts(0, { Moon: 55, Sun: 0 })).house, 3);
  assert.equal(lillyFortune(preciseFacts(0, { Moon: 54.99, Sun: 0 })).house, 2);
});

test('all 56 compiled alternatives reach the real SQLite report and explanation from native charts', () => {
  assert.equal(native.targetAlternatives, 56);
  assert.deepEqual(native.missing, []);
  const lookup = createReportLookup();
  const seen = new Set();
  for (const witness of native.witnesses) {
    const raw = nativeFacts(witness);
    const parsed = parseChartQueries([query(raw)]);
    assert.ok(parsed);
    const references = lookup(parsed);
    const hits = references.flatMap(row => [...row.personality, ...row.events]);
    const materials = buildReportMaterials(references);
    for (const proof of witness.proofs) {
      const hit = hits.find(entry => entry.id === proof.id);
      assert.ok(hit, proof.id);
      const matches = [hit.matchedConditions.required, ...(hit.matchedConditions.alternatives ?? [])];
      const row = catalog.get(proof.id);
      assert.ok(row.inputs.some(input => fingerprint(input) === proof.inputDigest
        && matches.some(required => fingerprint(required) === fingerprint(input.required))), proof.id);
      assert.ok(explainClaim(proof.id, 'western', chartContext('western', raw), undefined, catalog).matched, proof.id);
      assert.ok(materials.includes(hit.claim.evidence.original_text));
      if ([maleId, femaleId, inheritanceId].includes(proof.id)) assert.match(materials, /福点按莉莉卷二第143页/u);
      seen.add(`${proof.id}:${proof.inputDigest}`);
    }
  }
  assert.deepEqual([...seen].sort(), batch.changes.flatMap(row => row.inputs.map(input => `${row.id}:${input.digest}`)).sort());
});

test('marriage branches require explicit sex and raw complete time/longitude evidence', () => {
  const raw = witnessFacts(maleId);
  assert.ok(has(maleId, raw));
  assert.ok(!has(femaleId, raw));
  const genderless = raw.filter(fact => fact.kind !== 'natal_gender');
  assert.ok(!has(maleId, genderless));
  assert.ok(has(femaleId, [...genderless, { kind: 'natal_gender', gender: '女' }]));
  assert.ok(!has(maleId, [...raw, { kind: 'natal_gender', gender: '女' }]));
  const fabricated = { kind: 'western_lilly_fortune_house', selector: 'lot', house: 3, profile: lillyFortuneProfile };
  const moon = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Moon');
  assert.ok(!has(maleId, [...raw.filter(fact => fact !== moon), fabricated]));
  assert.ok(!has(maleId, [...raw, { ...moon, longitude: (moon.longitude + 12) % 360 }]));
  const incompleteCusps = raw.filter(fact => !(fact.kind === 'western_profile_cusp_longitude' && fact.house === 12));
  assert.ok(!has(maleId, [...incompleteCusps, fabricated]));
  const [unknown] = parseChartQueries([query([...raw, fabricated])], { timeKnown: false });
  assert.ok(!lookupInterpretations(catalogDirectory, unknown).some(hit => hit.id === maleId));
});

test('aspects require the actual witness and the actual Fortune ruler', () => {
  // Mercury aspects Jupiter but lies in the second; the Sun is in the
  // third and does not aspect Jupiter or Venus under either table.
  const separate = preciseFacts(0, { Sun: 60, Moon: 100, Mercury: 40, Jupiter: 160, Venus: 75 });
  assert.ok(has(witnessId, separate));
  assert.ok(!has(friendlyId, separate));
  const raw = witnessFacts(inheritanceId);
  const fortune = lillyFortune(raw);
  assert.equal(fortune.rulerHouse, 8);
  assert.ok(has(inheritanceId, raw));
  const place = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === fortune.ruler);
  assert.ok(!has(inheritanceId, [...raw.filter(fact => fact !== place),
    { kind: 'western_lilly_fortune_house', selector: 'ruler', house: 8, profile: lillyFortuneProfile }]));
});

test('seven pending source alternatives remain visible and source edits require review', () => {
  const pending = new Map(pendingClaimConditions({ catalog }).map(row => [row.id, row]));
  for (const [id, remaining] of [[femaleId, 1], [friendlyId, 4], [maleficId, 2]]) {
    assert.equal(catalog.get(id).remainingAlternatives, remaining);
    assert.ok(pending.get(id).reviewNote);
  }
  assert.ok(catalog.get(friendlyId).inputs.every(input => input.required.every(fact =>
    fact.kind !== 'western_lilly_aspect' || !(fact.first === 'sun' && fact.second === 'venus'))));
  const changed = structuredClone(catalog.get(inheritanceId).claim);
  changed.evidence.original_text += ' modified';
  assert.equal(compileWesternClaim(changed).reason, 'source_review_required');
});
