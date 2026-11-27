import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyPrefermentSource, lillyPrefermentProfile } from './lilly-preferment.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-127-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-preferment-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-tenth-house-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-tenth-house-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const key = (id, input) => id + ':' + createHash('sha256').update(JSON.stringify(input)).digest('hex');
const nativeFacts = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));

function query(confirmedFacts, timeKnown = true) {
  const [parsed] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function context({ confirmedFacts, confirmedAbsentFacts, chartScope }) {
  return chartContext('western', confirmedFacts, confirmedAbsentFacts, chartScope);
}

const hits = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (number, facts) => explainClaim(prefix + number + '-001', 'western', context(query(facts)), undefined, catalog);
const assertNoMatch = (number, facts, timeKnown = true) => {
  const parsed = query(facts, timeKnown);
  const id = prefix + number + '-001';
  assert.equal(explainClaim(id, 'western', context(parsed), undefined, catalog).matched, false, id);
  assert.ok(hits(lookup([parsed])).every(hit => hit.id !== id), id);
};

test('all reviewed tenth-house configurations reach SQLite report lookup from a native chart', () => {
  const ids = new Set(fixture.witnesses.flatMap(({ proofs }) => proofs.map(({ id }) => id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  for (const id of ids) {
    const record = catalog.get(id);
    assert.equal(record.compiler, lillyPrefermentProfile, id);
    for (const input of record.inputs) {
      assert.ok(new Set(input.required.map(fact => fact.table).filter(Boolean)).size <= 1, id);
      expected.set(key(id, input), input);
    }
    const changed = structuredClone(record.claim);
    changed.conditions.original.push('changed');
    assert.equal(compileLillyPrefermentSource(changed).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = query(nativeFacts(sample));
    const observed = context(parsed);
    const references = lookup([parsed]);
    const matched = hits(references);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of sample.proofs) {
      const proof = id + ':' + inputDigest;
      const input = expected.get(proof);
      assert.ok(input, proof);
      const derived = claimChartContext('western', observed, input.required, (sign, degree) => catalog.lillyDignityCells(sign, degree));
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, proof);
      const hit = matched.find(row => row.id === id);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', observed, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.ok(detail.calculationNote, id);
      const evidence = input.required.find(fact => fact.kind.startsWith('western_lilly_preferment_'));
      assert.ok(evidence, proof);
      assert.ok(materials.includes(factText(evidence)), id);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

const base = [
  { kind: 'western_zodiac', zodiac: 'tropical' },
  { kind: 'western_profile_system', profile: 'regiomontanus' },
  ...Array.from({ length: 12 }, (_, index) => ({
    kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: index * 30,
  })),
];
const position = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const stellarLongitude = (star, longitude) => ({ kind: 'western_fixed_star_longitude', profile: westernFixedStarProfile, star, longitude });

test('same-house contact requires the named catalog star and actual longitudes on one degree', () => {
  const chart = [...base, position('Jupiter', 278.3)];
  const full = [...chart, stellarLongitude('arcturus', 278.6)];
  const hit = explain('009', full);
  assert.equal(hit.matched, true);
  assert.deepEqual(hit.matchedConditions.required.find(fact => fact.kind === 'western_lilly_preferment_tenth_star'),
    { kind: 'western_lilly_preferment_tenth_star', star: 'arcturus', planet: 'Jupiter' });
  assertNoMatch('009', [...chart, stellarLongitude('arcturus', 279.1)]);
  assertNoMatch('009', [...chart, stellarLongitude('spica_virgo', 278.6)]);
  assertNoMatch('009', [...full, stellarLongitude('arcturus', 278.9)]);
  assertNoMatch('009', [...base, position('Jupiter', 258.3), stellarLongitude('arcturus', 258.6)]);
  assertNoMatch('009', full, false);
});

test('luminary assistance requires distinct favorable rays and a settled day or night chart', () => {
  const day = { kind: 'western_sect', sect: 'day' };
  const partial = [...base, day, position('Sun', 270.3), position('Mars', 330.3)];
  const full = [...partial, position('Jupiter', 30.3)];
  assert.equal(explain('018', full).matched, true);
  assertNoMatch('018', [...partial, { kind: 'western_lilly_preferment_friendly_support', table: 'main', planet: 'Sun' }]);
  assertNoMatch('018', [...partial, position('Jupiter', 0.3)]);
  assertNoMatch('018', [...full, { kind: 'western_sect', sect: 'night' }]);
  assertNoMatch('018', full.filter(fact => fact !== day));
});

test('support exclusions need known planets and the fire-sign configuration needs verified positions', () => {
  const neg = fixture.witnesses.find(({ proofs }) => proofs.some(({ id }) => id === prefix + '051-001'));
  const native = nativeFacts(neg);
  assert.equal(explain('051', native).matched, true);
  assertNoMatch('051', native.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Venus'));
  const simulated = base.map(fact => fact.kind === 'western_profile_cusp_longitude'
    ? { ...fact, longitude: (fact.longitude + 90) % 360 } : fact);
  const positions = [...simulated, position('Sun', 0.3), position('Mars', 18), position('Jupiter', 125)];
  assert.equal(explain('020', positions).matched, true);
  const missing = positions.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Jupiter');
  assertNoMatch('020', [...missing, { kind: 'planet_sign', planet: 'Jupiter', sign: '狮子座' },
    { kind: 'western_lilly_preferment_sign', planet: 'Jupiter', sign: '狮子座' }]);
});

test('the two citations of the fire Sun and Taurus Moon share matching conditions and one source witness', () => {
  const old = catalog.get(prefix + '124-001');
  const added = catalog.get(prefix + '056-001');
  assert.deepEqual(added.inputs, old.inputs);
  const sample = fixture.witnesses.find(({ proofs }) => proofs.some(({ id }) => id === added.claim.id));
  const facts = nativeFacts(sample);
  for (const number of ['056', '124']) assert.match(explain(number, facts).calculationNote, /只作一项见证/u);
});
