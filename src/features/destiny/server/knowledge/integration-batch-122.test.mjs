import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, zodiacNames } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyPrefermentSource, lillyPrefermentProfile } from './lilly-preferment.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-122-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-preferment-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-preferment-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-preferment-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const key = (id, input) => id + ':' + createHash('sha256').update(JSON.stringify(input)).digest('hex');
const nativeFacts = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const sampleFor = number => fixture.witnesses.find(({ proofs }) => proofs.some(({ id }) => id === prefix + number + '-001'));
const natalFacts = number => nativeFacts(sampleFor(number));

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

test('every reviewed preferment condition group is reachable through a native chart and SQLite report lookup', () => {
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
      const derived = claimChartContext('western', observed, input.required);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, proof);
      const hit = matched.find(row => row.id === id);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', observed, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.match(detail.calculationNote, /莉莉名望篇/u);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('whole-degree cusp contact cannot be replaced by a five-degree house assignment or a supplied assertion', () => {
  const facts = natalFacts('029');
  const original = facts.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Moon');
  const asc = facts.find(fact => fact.kind === 'western_profile_cusp_longitude' && fact.house === 1);
  const nearby = original.longitude + (original.longitude + 1.1 < 60 ? 1.1 : -1.1);
  const changed = facts.map(fact => fact === original ? { ...fact, longitude: nearby } : fact);
  const cuspContact = { kind: 'western_lilly_preferment_cusp', planet: 'Moon', house: 1 };
  const calculated = claimChartContext('western', context(query([...changed, cuspContact])));
  assert.equal(Math.floor(original.longitude), Math.floor(asc.longitude));
  assert.notEqual(Math.floor(nearby), Math.floor(asc.longitude));
  assert.ok(calculated.present.some(fact => fact.kind === 'western_lilly_planet_house' && fact.planet === 'Moon' && fact.house === 1));
  assertNoMatch('029', [...changed, cuspContact]);
  assertNoMatch('029', facts.filter(fact => !(fact.kind === 'western_profile_cusp_longitude' && fact.house === 12)));
  assertNoMatch('029', facts, false);
});

test('a three-body trine requires all three exact rays and cannot borrow a contradictory sign', () => {
  const facts = natalFacts('025');
  const moon = facts.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Moon');
  const shifted = moon.longitude + (moon.longitude % 30 < 27 ? 2 : -2);
  const changed = facts.map(fact => fact === moon ? { ...fact, longitude: shifted } : fact);
  const forged = { kind: 'western_lilly_partile_aspect', first: 'moon', second: 'sun', aspect: 'trine' };
  assert.equal(explain('025', facts).matched, true);
  assertNoMatch('025', [...changed, forged]);
  assertNoMatch('025', [...facts, { kind: 'planet_sign', planet: 'Moon', sign: zodiacNames[(Math.floor(moon.longitude / 30) + 1) % 12] }]);
  assertNoMatch('025', facts, false);
});

test('cadency requires all seven bodies and a conjunction must occupy the same angle', () => {
  const cadent = natalFacts('050');
  assert.equal(explain('050', cadent).matched, true);
  const missingSaturn = cadent.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Saturn');
  assertNoMatch('050', [...missingSaturn, { kind: 'western_lilly_preferment_all_cadent' }]);
  const sample = sampleFor('058');
  const sameSkyShiftedHorizon = nativeFacts({ ...sample, longitude: sample.longitude + 15 });
  assert.equal(explain('058', nativeFacts(sample)).matched, true);
  assertNoMatch('058', sameSkyShiftedHorizon);
});
