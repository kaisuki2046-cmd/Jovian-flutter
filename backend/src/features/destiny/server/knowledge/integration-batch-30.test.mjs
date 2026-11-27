import assert from 'node:assert/strict';
import fs, { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { createClaimsCatalog, claimChartContext, explainClaim, structuredClaimMappings } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { westernFactsForInput } from './testing/western-fixtures.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-30-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-30-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const rawFacts = witness => [...chartFacts.western(calculateWestern(Date.parse(witness.date), witness)), { kind: 'natal_gender', gender: witness.gender }];
const rulerId = 'astro-lilly-v3-spouse-description-p006-001', occupantId = 'astro-lilly-v3-spouse-description-p004-001';
const fixedId = 'astro-lilly-v3-profession-p031-001', listId = 'astro-lilly-v3-profession-p032-001';
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-thirty-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-thirty-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}

test('all 41 new alternatives reach actual SQL, explanations and report materials from native birth witnesses', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory); catalog.ensure(); const report = createReportLookup(directory);
  assert.equal(batch.wholeEntries, 7); assert.equal(batch.branchEntries, 0); assert.equal(native.targetAlternatives, 41); assert.deepEqual(native.missing, []);
  const expected = batch.changes.flatMap(row => row.inputs.map(input => row.id + ':' + input.digest)), seen = new Set();
  for (const witness of native.witnesses) {
    const raw = rawFacts(witness), parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const chart = claimChartContext('western', chartContext('western', parsed[0].confirmedFacts, [], 'natal'), [], (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const hits = lookupInterpretations(directory, parsed[0]); assert.ok(report(parsed).length);
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id), input = row.inputs.find(input => digest(input) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true); const hit = hits.find(hit => hit.id === proof.id); assert.ok(hit, proof.id);
      assert.equal(explainClaim(proof.id, 'western', chartContext('western', raw, [], 'natal'), undefined, catalog).matched, true);
      assert.deepEqual(row.claim, sources.find(source => source.id === proof.id));
      const material = buildReportMaterials([{ topic: '命理', personality: [], events: [hit] }]); assert.ok(material.includes(row.claim.evidence.original_text)); assert.match(material, /不能借另一星的位置/u);
      seen.add(proof.id + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('the seventh lord and its eighth-house position cannot be assembled from different benefics or supplied derived flags', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory); catalog.ensure();
  for (const input of catalog.get(rulerId).inputs) {
    const raw = westernFactsForInput(input), lord = input.required.find(f => f.kind === 'western_lilly_house_ruler').planet;
    assert.ok(lookupInterpretations(directory, query(raw)).some(hit => hit.id === rulerId));
    const original = raw.find(f => f.kind === 'planet_longitude' && f.planet === lord).longitude, other = lord === 'Jupiter' ? 'Venus' : 'Jupiter';
    const changed = [...raw.filter(f => f.planet !== lord && f.planet !== other), { kind: 'planet_longitude', planet: lord, longitude: (original + 180) % 360 },
      { kind: 'planet_longitude', planet: other, longitude: original }, { kind: 'western_lilly_ruler_house', house: 7, placedIn: 8 }];
    assert.ok(!lookupInterpretations(directory, query(changed)).some(hit => hit.id === rulerId));
    assert.equal(explainClaim(rulerId, 'western', chartContext('western', changed, [], 'natal'), undefined, catalog).matched, false);
  }
});

test('profession sign matching follows an actual selected member, preserves Scorpio and Virgo exceptions, and rejects a tempting non-member', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory); catalog.ensure();
  const raw = [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'western_profile_system', profile: 'regiomontanus' }, { kind: 'western_sect', sect: 'day' },
    ...Array.from({ length: 12 }, (_, i) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: (60 + i * 30) % 360 })),
    ...Object.entries({ Mercury: 80, Venus: 45, Mars: 180, Sun: 60 }).map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude }))];
  const chart = claimChartContext('western', chartContext('western', raw, [], 'natal'), [], (sign, degree) => catalog.lillyDignityCells(sign, degree));
  assert.ok(chart.present.some(f => f.kind === 'western_lilly_profession_ruler' && f.planet === 'Mercury' && f.role === 'member' && f.matches));
  assert.ok(!chart.present.some(f => f.kind === 'western_lilly_profession_ruler' && f.planet === 'Venus' && f.role === 'member' && f.matches));
  const hits = lookupInterpretations(directory, query(raw)); assert.ok(!hits.some(hit => [fixedId, listId].includes(hit.id)));
  const selectedSigns = id => [...new Set(catalog.get(id).inputs.flatMap(i => i.required.filter(f => f.kind === 'planet_sign').map(f => f.sign)))];
  assert.deepEqual(selectedSigns(fixedId).sort(), ['金牛座', '狮子座', '水瓶座'].sort());
  assert.deepEqual(selectedSigns(listId).sort(), ['巨蟹座', '天蝎座', '双鱼座', '金牛座', '摩羯座'].sort());
});

test('historical gender, unknown time, conflicting coordinates and missing house profiles keep their original restrictions', context => {
  const directory = temporary(context);
  for (const id of [rulerId, occupantId]) {
    const raw = rawFacts(native.witnesses.find(w => w.proofs.some(p => p.id === id)));
    for (const gender of [null, '女']) {
      const changed = [...raw.filter(f => f.kind !== 'natal_gender'), ...(gender ? [{ kind: 'natal_gender', gender }] : [])];
      assert.ok(!lookupInterpretations(directory, query(changed)).some(hit => hit.id === id));
    }
  }
  for (const row of batch.changes) {
    const raw = rawFacts(native.witnesses.find(w => w.proofs.some(p => p.id === row.id)));
    const unknownTime = parseChartQueries([query(raw)], { timeKnown: false }); assert.ok(unknownTime);
    assert.ok(!lookupInterpretations(directory, unknownTime[0]).some(hit => hit.id === row.id));
    assert.ok(!lookupInterpretations(directory, query(raw.filter(f => !f.kind.startsWith('western_profile_')))).some(hit => hit.id === row.id));
  }
  const raw = rawFacts(native.witnesses.find(w => w.proofs.some(p => p.id === occupantId)));
  const cusp = raw.find(f => f.kind === 'western_profile_cusp_longitude' && f.house === 7);
  assert.ok(!lookupInterpretations(directory, query([...raw, { ...cusp, longitude: (cusp.longitude + 10) % 360 }])).some(hit => hit.id === occupantId));
});

test('audits expose ordinary primitive conjunctions while all source digests and older queryable snapshots remain preserved', context => {
  const catalog = catalogForDirectory(temporary(context)), mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  for (const row of batch.changes) { assert.equal(mappings.get(row.id).status, 'indexed'); assert.equal(mappings.get(row.id).remainingAlternatives, 0); assert.equal(catalog.get(row.id).remainingAlternatives, 0); }
  const profession = catalog.get(fixedId).inputs;
  assert.ok(profession.every(input => input.required.some(f => f.kind === 'western_lilly_profession_ruler') && input.required.some(f => f.kind === 'planet_sign')));
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousQueryableCompiledUnchanged, 2812); assert.equal(batch.previousQueryableInputsPreserved, 2812);
});

test('fresh runtime queries every new source directly from SQLite with source JSON reads blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure(); const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); }; syncBuiltinESMExports();
  try { const fresh = createClaimsCatalog({ directory });
    for (const row of batch.changes) { const witness = native.witnesses.find(w => w.proofs.some(p => p.id === row.id)); assert.ok(lookupInterpretations(directory, query(rawFacts(witness)), fresh).some(hit => hit.id === row.id)); }
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('a model double consumes the selected-member sign rule through real lookup with readable scope and outcome limits', async context => {
  const directory = temporary(context), actual = createReportLookup(directory), witness = native.witnesses.find(w => w.proofs.some(p => p.id === fixedId)); let calls = 0;
  const lookup = queries => actual(queries).map(row => ({ ...row, personality: row.personality.filter(hit => hit.id === fixedId), events: row.events.filter(hit => hit.id === fixedId) }));
  const result = await generateReport({ chartQueries: parseChartQueries([query(rawFacts(witness))]) }, { lookup, signal: new AbortController().signal,
    complete: async request => { calls++; assert.ok(request.materials.includes('Fixed Signes doe also require Learning')); assert.match(request.materials, /实际成员/u); assert.match(request.materials, /不补处女/u); assert.match(request.materials, /不当作现实结果/u); assert.ok(!request.materials.includes('profiles.lilly.profession.active_significator_sign')); return '模型替身报告'; } });
  assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
