import assert from 'node:assert/strict';
import fs, { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { createClaimsCatalog, claimChartContext, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { lillySolarProfile, lillyMotionProfile } from './lilly-solar-motion.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-25-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-25-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const rawFacts = witness => [...chartFacts.western(calculateWestern(Date.parse(witness.date), witness)), { kind: 'natal_gender', gender: witness.gender }];
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const longitude = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const daily = (planet, signedDegrees) => ({ kind: 'planet_daily_motion', planet, signedDegrees });
const motion = value => ({ kind: 'planet_motion', planet: 'Mercury', motion: value });
const cusps = offset => [{ kind: 'western_profile_system', profile: 'regiomontanus' }, ...Array.from({ length: 12 }, (_, i) => ({
  kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: (offset + i * 30) % 360,
}))];
const ids = {
  mines: 'astro-lilly-v3-mines-p001-001', allSlow: 'astro-lilly-v3-general-fortune-p006-001', fifth: 'astro-lilly-v3-children-p037-001',
  burn: 'astro-lilly-v3-wit-p022-001', slow: 'astro-lilly-v3-wit-p027-001', retroBeams: 'astro-lilly-v3-wit-p030-001',
};
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twenty-five-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twenty-five-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}

test('all 37 new solar and speed alternatives reach SQLite, explanation and report material from native births', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), report = createReportLookup(directory);
  assert.equal(batch.wholeEntries, 9); assert.equal(batch.extended.length, 1); assert.equal(batch.newAlternativeCount, 37);
  assert.equal(native.targetAlternatives, 37); assert.deepEqual(native.missing, []);
  const expected = [...batch.changes, ...batch.extended].flatMap(row => row.addedInputDigests.map(hash => row.id + ':' + hash)), seen = new Set();
  for (const witness of native.witnesses) {
    assert.ok(Number(witness.date.slice(0, 4)) >= 1900, 'all final witnesses also lie inside the current frontend date range');
    const raw = rawFacts(witness), parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const required = witness.proofs.flatMap(proof => catalog.get(proof.id).inputs.flatMap(input => input.required));
    const chart = claimChartContext('western', chartContext('western', parsed[0].confirmedFacts, [], 'natal'), required, (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const hits = lookupInterpretations(directory, parsed[0]), material = buildReportMaterials(report(parsed));
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id), input = row.inputs.find(input => digest(input) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true);
      for (const fact of input.required) assert.equal(evaluateRule(input, 'natal', chartContext('western', chart.present.filter(other => JSON.stringify(other) !== JSON.stringify(fact)), [], 'natal')).matched, false);
      assert.ok(hits.some(hit => hit.id === proof.id), proof.id);
      assert.equal(explainClaim(proof.id, 'western', chartContext('western', raw, [], 'natal'), undefined, catalog).matched, true);
      assert.ok(material.includes(row.claim.evidence.original_text), proof.id);
      assert.deepEqual(row.claim, sources.find(source => source.id === proof.id));
      seen.add(proof.id + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('all seven slow bodies is an AND; a missing, conflicting or fast measurement cannot be replaced by one slow planet', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === ids.allSlow);
  const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const base = [tropical, ...cusps(0), ...bodies.map(body => daily(body, 0.001))]; assert.equal(matches(base), true);
  for (const body of bodies) {
    const without = base.filter(f => f.planet !== body);
    assert.equal(matches(without), false); assert.equal(matches([...without, daily(body, 20)]), false);
    assert.equal(matches([...base, daily(body, 20)]), false);
  }
  assert.equal(matches([tropical, ...cusps(0), daily('Mercury', 0.001)]), false);
});

test('mining predicates retain the same Saturn, actual fourth-house role, dignity, direction, speed and friendly configuration', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === ids.mines);
  const witness = native.witnesses.find(w => w.proofs.some(p => p.id === ids.mines)); const base = rawFacts(witness); assert.equal(matches(base), true);
  assert.equal(matches([...base.filter(f => !(f.kind === 'planet_daily_motion' && f.planet === 'Saturn')), daily('Saturn', 0.001)]), false);
  assert.equal(matches(base.filter(f => !(f.kind === 'planet_daily_motion' && f.planet === 'Saturn'))), false);
  assert.equal(matches([...base.filter(f => !(f.kind === 'planet_motion' && f.planet === 'Saturn')), { kind: 'planet_motion', planet: 'Saturn', motion: 'retrograde' }]), false);
  assert.equal(matches(base.filter(f => !['Jupiter', 'Venus'].includes(f.planet))), false);
  assert.equal(matches(base.filter(f => !f.kind.startsWith('western_profile_'))), false);
});

test('the fifth ruler must itself be combust, same-sign burning differs from beams, and cazimi does not send the burn warning', context => {
  const directory = temporary(context), matches = (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id);
  // Gemini fifth cusp at 60° has Mercury as ruler; nearby Mars cannot substitute.
  const house = [tropical, ...cusps(300), longitude('Sun', 10), longitude('Mercury', 12), longitude('Mars', 80)];
  assert.equal(matches(ids.fifth, house), true);
  assert.equal(matches(ids.fifth, [...house.filter(f => f.planet !== 'Mercury'), longitude('Mercury', 80), longitude('Mars', 12)]), false);
  assert.equal(matches(ids.burn, [tropical, longitude('Sun', 29), longitude('Mercury', 31)]), true, 'beams remain valid across the sign boundary');
  assert.equal(matches(ids.burn, [tropical, longitude('Sun', 10), longitude('Mercury', 10.1)]), false, 'documented cazimi precedence is not double-counted as a harmful burn');
  assert.equal(matches(ids.retroBeams, [tropical, longitude('Sun', 10), longitude('Mercury', 22), motion('retrograde')]), true);
  assert.equal(matches(ids.retroBeams, [tropical, longitude('Sun', 10), longitude('Mercury', 22), motion('direct')]), false);
});

test('the former Mercury retrograde OR branch is preserved while the independent slow branch completes the partial source', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === ids.slow);
  assert.equal(matches([tropical, motion('retrograde')]), true);
  assert.equal(matches([tropical, motion('direct'), daily('Mercury', 0.1)]), true);
  assert.equal(matches([tropical, motion('direct'), daily('Mercury', 1.5)]), false);
  const catalog = catalogForDirectory(directory), row = catalog.get(ids.slow); assert.equal(row.remainingAlternatives, 0);
  assert.ok(!pendingClaimConditions({ catalog }).some(row => row.id === ids.slow));
});

test('untrusted derived flags and absence declarations cannot replace raw data, and unknown time withholds the new measurements', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory);
  const fake = { kind: 'western_lilly_solar_state', selector: 'mercury', condition: 'combust', matches: true, profile: lillySolarProfile };
  const raw = [tropical, longitude('Sun', 10), longitude('Mercury', 80), fake];
  assert.ok(!lookupInterpretations(directory, query(raw)).some(hit => hit.id === ids.burn));
  assert.equal(explainClaim(ids.burn, 'western', chartContext('western', raw, [{ ...fake, matches: false }], 'natal'), undefined, catalog).matched, false);
  const [parsed] = parseChartQueries([{ ...query(raw), confirmedAbsentFacts: [{ ...fake, matches: false }] }]);
  assert.ok(!parsed.confirmedFacts.some(f => f.kind === fake.kind)); assert.ok(!parsed.confirmedAbsentFacts.some(f => f.kind === fake.kind));
  for (const witness of native.witnesses) {
    const [unknown] = parseChartQueries([query(rawFacts(witness))], { timeKnown: false });
    const hits = lookupInterpretations(directory, unknown);
    for (const proof of witness.proofs) {
      if (proof.id !== ids.slow) assert.ok(!hits.some(hit => hit.id === proof.id));
    }
  }
});

test('source fingerprints and mapping audits retain complete conditions while the old Mercury partial pending item closes', context => {
  const catalog = catalogForDirectory(temporary(context)), mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  for (const row of [...batch.changes, ...batch.extended]) {
    const mapping = mappings.get(row.id); assert.equal(mapping.status, 'indexed'); assert.equal(mapping.remainingAlternatives, 0);
  }
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousQueryableCompiledUnchanged, 2783); assert.equal(batch.previousQueryableInputsPreserved, 2784);
});

test('fresh SQLite resolves speed and solar rules with source JSON blocked and sends readable evidence to a model double', async context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure();
  const witness = native.witnesses.find(w => w.proofs.some(p => p.id === ids.allSlow)); assert.ok(witness);
  const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); };
  syncBuiltinESMExports();
  try { const fresh = createClaimsCatalog({ directory }), hits = lookupInterpretations(directory, query(rawFacts(witness)), fresh); assert.ok(hits.some(hit => hit.id === ids.allSlow)); }
  finally { fs.readFileSync = original; syncBuiltinESMExports(); }
  const actual = createReportLookup(directory); let calls = 0;
  const lookup = queries => actual(queries).map(row => ({ ...row, personality: row.personality.filter(hit => hit.id === ids.burn), events: row.events.filter(hit => hit.id === ids.burn) }));
  const result = await generateReport({ chartQueries: parseChartQueries([query([tropical, longitude('Sun', 10), longitude('Mercury', 14)])]) }, {
    lookup, signal: new AbortController().signal,
    complete: async request => { calls++; assert.match(request.materials, /水星/u); assert.match(request.materials, /燃烧|光束/u); assert.match(request.materials, /推定/u);
      assert.ok(!request.materials.includes(lillySolarProfile)); assert.ok(!request.materials.includes(lillyMotionProfile)); return '模型替身报告'; },
  }); assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
