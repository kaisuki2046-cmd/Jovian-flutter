import assert from 'node:assert/strict';
import fs, { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
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
import { lillySignClassProfile } from './lilly-sign-classes.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-24-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-24-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const countsId = 'astro-lilly-v3-women-marriage-p016-001', dispositorId = 'astro-lilly-v3-women-marriage-p018-001';
const rawFacts = witness => [...chartFacts.western(calculateWestern(Date.parse(witness.date), witness)), { kind: 'natal_gender', gender: witness.gender }];
const longitude = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const gender = value => ({ kind: 'natal_gender', gender: value });
const cusps = offset => [{ kind: 'western_profile_system', profile: 'regiomontanus' }, ...Array.from({ length: 12 }, (_, i) => ({
  kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: (offset + i * 30) % 360,
}))];
const synthetic = (...positions) => [{ kind: 'western_zodiac', zodiac: 'tropical' }, ...cusps(240), gender('女'), ...positions];
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twenty-four-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twenty-four-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}

test('all 35 new sign-class alternatives reach actual SQLite, explanations and report materials from native births', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), report = createReportLookup(directory);
  assert.equal(batch.wholeEntries, 15); assert.equal(batch.branchEntries, 0); assert.equal(batch.newAlternativeCount, 35);
  assert.equal(native.targetAlternatives, 35); assert.deepEqual(native.missing, []);
  const expected = batch.changes.flatMap(row => row.inputs.map(input => row.id + ':' + input.digest)), seen = new Set();
  for (const witness of native.witnesses) {
    const raw = rawFacts(witness), parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const chart = claimChartContext('western', chartContext('western', parsed[0].confirmedFacts, [], 'natal'), [], (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const hits = lookupInterpretations(directory, parsed[0]), material = buildReportMaterials(report(parsed));
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id), input = row.inputs.find(input => digest(input) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true);
      assert.ok(hits.some(hit => hit.id === proof.id), proof.id);
      assert.equal(explainClaim(proof.id, 'western', chartContext('western', raw, [], 'natal'), undefined, catalog).matched, true);
      assert.ok(material.includes(row.claim.evidence.original_text)); assert.deepEqual(row.claim, sources.find(source => source.id === proof.id));
      seen.add(proof.id + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('the three common-sign conditions require all three objects but allow different individual signs', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === countsId);
  // Seventh cusp Gemini, its Mercury in Virgo, Sun in Pisces: three distinct
  // signs, all in the source's common class.
  const facts = synthetic(longitude('Mercury', 150), longitude('Sun', 330)); assert.equal(matches(facts), true);
  for (const planet of ['Mercury', 'Sun']) {
    assert.equal(matches(facts.filter(f => f.planet !== planet)), false);
    assert.equal(matches([...facts.filter(f => f.planet !== planet), longitude(planet, 120)]), false);
  }
  const wrongCusp = [{ kind: 'western_zodiac', zodiac: 'tropical' }, ...cusps(210), gender('女'), longitude('Mars', 150), longitude('Sun', 330)];
  assert.equal(matches(wrongCusp), false, 'two common planets cannot substitute for a non-common seventh cusp');
});

test('Venus and her own traditional dispositor must each satisfy common-or-tropic; movable Aries is not tropic', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === dispositorId);
  assert.equal(matches(synthetic(longitude('Venus', 90), longitude('Moon', 60))), true); // tropic/common
  assert.equal(matches(synthetic(longitude('Venus', 90), longitude('Moon', 270))), true); // tropic/tropic
  assert.equal(matches(synthetic(longitude('Venus', 60), longitude('Mercury', 330))), true); // common/common
  assert.equal(matches(synthetic(longitude('Venus', 60), longitude('Mercury', 90))), true); // common/tropic
  assert.equal(matches(synthetic(longitude('Venus', 0), longitude('Mars', 60))), false);
  assert.equal(matches(synthetic(longitude('Venus', 60), longitude('Mercury', 0))), false);
  assert.equal(matches(synthetic(longitude('Venus', 90))), false);
  assert.equal(matches(synthetic(longitude('Venus', 90), longitude('Jupiter', 60))), false, 'another common planet cannot replace the Moon');
});

test('historical gender and unknown birth-time requirements remain in force for the new groups', context => {
  const directory = temporary(context);
  const gendered = batch.changes.filter(row => /women-marriage|concord/u.test(row.id));
  for (const row of gendered) {
    const witness = native.witnesses.find(w => w.proofs.some(p => p.id === row.id)), raw = rawFacts(witness);
    const withoutGender = raw.filter(f => f.kind !== 'natal_gender');
    for (const facts of [withoutGender, [...withoutGender, gender(witness.gender === '男' ? '女' : '男')], [...raw, gender(witness.gender === '男' ? '女' : '男')]]) {
      const parsed = parseChartQueries([query(facts)]); assert.ok(parsed);
      assert.ok(!lookupInterpretations(directory, parsed[0]).some(hit => hit.id === row.id));
    }
  }
  const ids = new Set(batch.changes.map(row => row.id));
  for (const witness of native.witnesses.slice(0, 3)) {
    const [parsed] = parseChartQueries([query(rawFacts(witness))], { timeKnown: false });
    assert.ok(!lookupInterpretations(directory, parsed).some(hit => ids.has(hit.id)), 'original historical house profile or profession prerequisites cannot be guessed');
  }
});

test('supplied derived positives or absences cannot replace recomputation or turn unknown positions into class evidence', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory);
  const fake = { kind: 'western_lilly_sign_class', selector: 'venus', classification: 'common', matches: true, profile: lillySignClassProfile };
  const facts = [{ kind: 'western_zodiac', zodiac: 'tropical' }, ...cusps(0), gender('男'), longitude('Venus', 0), fake];
  const id = 'astro-lilly-v3-concord-p015-001';
  assert.ok(!lookupInterpretations(directory, query(facts)).some(hit => hit.id === id));
  assert.equal(explainClaim(id, 'western', chartContext('western', facts, [], 'natal'), undefined, catalog).matched, false);
  const [parsed] = parseChartQueries([{ ...query(facts), confirmedAbsentFacts: [{ ...fake, matches: false }] }]); assert.ok(parsed);
  assert.ok(!parsed.confirmedFacts.some(f => f.kind === 'western_lilly_sign_class'));
  assert.ok(!parsed.confirmedAbsentFacts.some(f => f.kind === 'western_lilly_sign_class'));
  const unknown = facts.filter(f => f.kind !== 'planet_longitude');
  assert.ok(!lookupInterpretations(directory, query(unknown)).some(hit => hit.id === id));
  const conflict = [...facts.filter(f => f.kind !== 'western_lilly_sign_class'), { kind: 'planet_sign', planet: 'Venus', sign: '双子座' }];
  assert.ok(!lookupInterpretations(directory, query(conflict)).some(hit => hit.id === id));
});

test('mapping audits retain the source groups, actual three-member expansions, source hashes and unresolved neighbouring methods', context => {
  const catalog = catalogForDirectory(temporary(context)), mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  for (const row of batch.changes) {
    const mapping = mappings.get(row.id); assert.equal(mapping.status, 'indexed'); assert.equal(mapping.remainingAlternatives, 0);
    assert.ok(mapping.sourceConditions.include.flat().every(condition => condition.mappedFact || condition.expandedGroups?.every(group => group.every(Boolean))));
  }
  const pending = pendingClaimConditions({ catalog });
  for (const row of batch.changes) assert.ok(!pending.some(item => item.id === row.id));
  for (const id of ['astro-lilly-v3-profession-p059-001', 'astro-lilly-v3-profession-p060-001', 'astro-lilly-v3-profession-p061-001']) {
    assert.ok(pending.some(item => item.id === id && item.status === 'indexed'));
  }
  assert.ok(!pending.some(item => item.id === 'astro-ptolemy-v1-chapter-8-p009-001'));
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousQueryableCompiledUnchanged, 2769);
});

test('fresh SQLite runtime resolves the new sign classes and Venus domicile with source JSON access blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure();
  const witness = native.witnesses.find(w => w.proofs.some(p => p.id === dispositorId)); assert.ok(witness);
  const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); };
  syncBuiltinESMExports();
  try { const fresh = createClaimsCatalog({ directory }), hits = lookupInterpretations(directory, query(rawFacts(witness)), fresh);
    for (const proof of witness.proofs) assert.ok(hits.some(hit => hit.id === proof.id));
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('the real report lookup sends Chinese classified-object evidence to a model double without internal profile names', async context => {
  const directory = temporary(context), actual = createReportLookup(directory); let calls = 0;
  const lookup = queries => actual(queries).map(row => ({ ...row, personality: row.personality.filter(hit => hit.id === countsId), events: row.events.filter(hit => hit.id === countsId) }));
  const result = await generateReport({ chartQueries: parseChartQueries([query(synthetic(longitude('Mercury', 150), longitude('Sun', 330)))]) }, {
    lookup, signal: new AbortController().signal,
    complete: async request => { calls++; assert.match(request.materials, /第7宫头/u); assert.match(request.materials, /第7宫主/u);
      assert.match(request.materials, /太阳/u); assert.match(request.materials, /变动座/u); assert.ok(!request.materials.includes(lillySignClassProfile));
      return '模型替身报告'; },
  }); assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
