import assert from 'node:assert/strict';
import fs, { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { createClaimsCatalog, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { shenShaPlacementNames as names } from './bazi-shensha-placements.mjs';
const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-29-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-29-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url)));
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const ids = { wifeHorse: 'yhzp-v3-c131-p002-001', horseVoid: 'yhzp-v3-c131-p002-004', canopyVoid: 'yhzp-v3-c137-p009-002' };
const passageId = 'yhzp-v4-c040-p006-001', positive = '華蓋逢空，偏宜僧道';
const rawFacts = witness => chartFacts.bazi(calculateBaZi(Date.parse(witness.date), Date.parse(witness.localDate)));
const query = confirmedFacts => ({ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts });
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twenty-nine-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twenty-nine-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}

test('all new source conditions reach actual SQLite, explanation and report materials across every native target position', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), report = createReportLookup(directory);
  assert.equal(batch.wholeEntries, 3); assert.equal(batch.branchEntries, 1); assert.equal(native.targetAlternatives, 4); assert.equal(native.coverage.length, 9); assert.deepEqual(native.missing, []);
  const expected = batch.changes.flatMap(row => [...row.inputs.map(input => row.id + ':-1:' + input.digest), ...row.branches.flatMap((b, i) => b.inputs.map(input => row.id + ':' + i + ':' + input.digest))]); const seen = new Set();
  for (const witness of native.witnesses) {
    const raw = rawFacts(witness), parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const hits = lookupInterpretations(directory, parsed[0]); assert.ok(report(parsed).length);
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id), input = (proof.branchIndex === -1 ? row.inputs : row.branches[proof.branchIndex].inputs).find(input => hash(input) === proof.inputDigest); assert.ok(input);
      const hit = hits.find(hit => hit.id === proof.id); assert.ok(hit, proof.id);
      assert.equal(explainClaim(proof.id, 'bazi', chartContext('bazi', raw, [], 'natal'), undefined, catalog).matched, true);
      assert.deepEqual(row.claim, sources.find(source => source.id === proof.id));
      const material = buildReportMaterials([{ topic: '命理', personality: [], events: [hit] }]);
      if (proof.branchIndex === -1) assert.ok(material.includes(row.claim.evidence.original_text));
      else { assert.equal(hit.matchScope, 'passage_branch'); assert.ok(material.includes(positive)); assert.ok(!material.includes('學堂遇貴')); }
      seen.add(proof.id + ':' + proof.branchIndex + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('real cross-pillar counterexamples cannot be joined or overridden by forged positive flags', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory); catalog.ensure();
  for (const [key, index] of Object.entries(native.counterexamples)) {
    const raw = rawFacts(native.witnesses[index]), id = ids[key], flag = { kind: 'bazi_natal_configuration', name: names[key] };
    for (const facts of [raw, [...raw, flag, { kind: 'shen_sha', position: 'hour', name: key === 'canopyVoid' ? '华盖' : '驿马' }, { kind: 'shen_sha', position: 'hour', name: '空亡' }]]) {
      assert.ok(!lookupInterpretations(directory, query(facts)).some(hit => hit.id === id));
      assert.equal(explainClaim(id, 'bazi', chartContext('bazi', facts, [], 'natal'), undefined, catalog).matched, false);
    }
  }
});

test('unknown birth time keeps confirmed year/month/day placements and never manufactures an hour placement', context => {
  const directory = temporary(context);
  for (const key of ['horseVoid', 'canopyVoid']) {
    const witness = native.witnesses.find(w => w.evidence.some(e => e.name === names[key] && e.position === 'hour') && w.evidence.filter(e => e.name === names[key]).length === 1); assert.ok(witness);
    const raw = rawFacts(witness), known = raw.filter(f => f.position !== 'hour');
    assert.ok(lookupInterpretations(directory, query(raw)).some(hit => hit.id === ids[key]));
    const parsed = parseChartQueries([query(known)], { timeKnown: false }); assert.ok(parsed);
    assert.ok(!lookupInterpretations(directory, parsed[0]).some(hit => hit.id === ids[key]));
  }
  for (const key of Object.keys(ids)) {
    const witness = native.witnesses.find(w => w.evidence.some(e => e.name === names[key] && e.position !== 'hour')); assert.ok(witness);
    const known = rawFacts(witness).filter(f => f.position !== 'hour');
    assert.ok(lookupInterpretations(directory, parseChartQueries([query(known)], { timeKnown: false })[0]).some(hit => hit.id === ids[key]));
  }
  const wifeByBranches = [{ kind: 'branch', position: 'year', branch: '子' }, { kind: 'branch', position: 'day', branch: '寅' }];
  const branchHits = lookupInterpretations(directory, query(wifeByBranches));
  assert.ok(branchHits.some(hit => hit.id === ids.wifeHorse));
  assert.ok(!branchHits.some(hit => hit.id === ids.horseVoid), 'known branches cannot supply an unknown sexagenary void');
  const hourWitness = native.witnesses.find(w => w.evidence.some(e => e.name === names.horseVoid && e.position === 'hour')); assert.ok(hourWitness);
  const raw = rawFacts(hourWitness), hourBranch = raw.find(f => f.kind === 'pillar' && f.position === 'hour').ganZhi[1];
  assert.ok(lookupInterpretations(directory, query([...raw.filter(f => f.position !== 'hour'), { kind: 'branch', position: 'hour', branch: hourBranch }])).some(hit => hit.id === ids.horseVoid));
});

test('contradictory coordinates, absent source pillars and other chart scopes do not enable natal source records', context => {
  const directory = temporary(context), witness = native.witnesses.find(w => w.proofs.some(p => p.id === ids.horseVoid)); assert.ok(witness);
  const raw = rawFacts(witness), fake = { kind: 'bazi_natal_configuration', name: names.horseVoid };
  const wrong = [raw.filter(f => !['year', 'day'].includes(f.position)), [...raw, { kind: 'stem', position: 'year', stem: raw.find(f => f.kind === 'pillar' && f.position === 'year').ganZhi[0] === '甲' ? '乙' : '甲' }]];
  for (const facts of wrong) assert.ok(!lookupInterpretations(directory, query([...facts, fake])).some(hit => hit.id === ids.horseVoid));
  assert.ok(!lookupInterpretations(directory, { ...query(raw), chartScope: 'annual' }).some(hit => hit.id === ids.horseVoid));
  const hits = lookupInterpretations(directory, { ...query(raw), confirmedAbsentFacts: [fake] });
  assert.ok(hits.some(hit => hit.id === ids.horseVoid), 'a client-supplied derived absence cannot suppress a recalculated truth');
});

test('audit retains the unproved school quotation, original source digests and every older queryable input', context => {
  const catalog = catalogForDirectory(temporary(context)), mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  assert.ok(pendingClaimConditions({ catalog }).some(row => row.id === passageId && row.status === 'branch_indexed'));
  assert.equal(catalog.get(passageId).inputs, undefined); assert.equal(catalog.get(passageId).branches.length, 1); assert.equal(mappings.get(passageId).branches[0].text, positive);
  for (const id of Object.values(ids)) assert.equal(mappings.get(id).sourceConditions[0].status, 'compiled_source_expression');
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousQueryableCompiledUnchanged, 2808); assert.equal(batch.previousQueryableInputsPreserved, 2808);
});

test('fresh SQLite runtime can query the new placements with all source JSON reads blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure(); const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); }; syncBuiltinESMExports();
  try {
    const fresh = createClaimsCatalog({ directory });
    for (const id of [...Object.values(ids), passageId]) { const witness = native.witnesses.find(w => w.proofs.some(p => p.id === id)); assert.ok(witness); assert.ok(lookupInterpretations(directory, query(rawFacts(witness)), fresh).some(hit => hit.id === id)); }
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('a model double receives the matched original passage and readable limits without the unrelated school conclusion', async context => {
  const directory = temporary(context), actual = createReportLookup(directory), witness = native.witnesses.find(w => w.proofs.some(p => p.id === passageId)); assert.ok(witness); let calls = 0;
  const lookup = queries => actual(queries).map(row => ({ ...row, personality: row.personality.filter(hit => hit.id === passageId), events: row.events.filter(hit => hit.id === passageId) }));
  const result = await generateReport({ chartQueries: parseChartQueries([query(rawFacts(witness))]) }, { lookup, signal: new AbortController().signal,
    complete: async request => { calls++; assert.ok(request.materials.includes(positive)); assert.ok(!request.materials.includes('學堂遇貴')); assert.match(request.materials, /同一柱/u); assert.match(request.materials, /未知时辰/u); assert.match(request.materials, /不代表现实婚姻/u); assert.ok(!request.materials.includes('natal-shensha-v1-source-placements-v1')); return '模型替身报告'; } });
  assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
