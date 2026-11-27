import assert from 'node:assert/strict';
import fs, { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { compileClaimSources, createClaimsCatalog, claimChartContext, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-22-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-22-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const query = confirmedFacts => ({ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts });
const occurrenceId = 'yhzp-v3-c087-p002-001', femaleId = 'yhzp-v3-c022-p003-002', hourId = 'yhzp-v5-c147-p005-001';
const rawFacts = w => [...chartFacts.bazi(calculateBaZi(Date.parse(w.date), Date.parse(w.localDate))), { kind: 'natal_gender', gender: w.gender }];
const god = (kind, position, tenGod) => ({ kind, position, tenGod });
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twenty-two-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twenty-two-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}
function fixture(context, claims) {
  const directory = temporary(context), sourceDirectory = join(directory, 'sources'); mkdirSync(sourceDirectory);
  for (const method of ['bazi', 'ziwei', 'western']) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(method === 'bazi' ? claims : []));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  return sourceDirectory;
}

test('all 148 whole and passage alternatives reach SQLite, explanations and report quotations from real native births', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), report = createReportLookup(directory);
  assert.equal(batch.wholeEntries, 5); assert.equal(batch.branchEntries, 2);
  assert.equal(batch.wholeAlternatives, 101); assert.equal(batch.passageAlternatives, 47);
  assert.equal(native.targetAlternatives, 148); assert.deepEqual(native.missing, []);
  const expected = batch.changes.flatMap(row => [...row.inputs.map(input => row.id + ':-1:' + input.digest),
    ...row.branches.flatMap((branch, i) => branch.inputDigests.map(hash => row.id + ':' + i + ':' + hash))]); const seen = new Set();
  for (const witness of native.witnesses) {
    assert.equal(Date.parse(witness.localDate) - Date.parse(witness.date), witness.timezoneOffsetHours * 3600000);
    const raw = rawFacts(witness); const parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const chart = claimChartContext('bazi', chartContext('bazi', parsed[0].confirmedFacts, [], 'natal'));
    const hits = lookupInterpretations(directory, parsed[0]); const material = buildReportMaterials(report(parsed));
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id);
      const input = (proof.branchIndex === -1 ? row.inputs : row.branches[proof.branchIndex].inputs).find(input => digest(input) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true);
      const hit = hits.find(hit => hit.id === proof.id); assert.ok(hit, proof.id);
      assert.equal(explainClaim(proof.id, 'bazi', chartContext('bazi', raw, [], 'natal'), undefined, catalog).matched, true);
      const quotation = proof.branchIndex === -1 ? row.claim.evidence.original_text : row.branches[proof.branchIndex].text;
      assert.ok(material.includes(quotation)); assert.deepEqual(row.claim, sources.find(source => source.id === proof.id));
      if (proof.branchIndex !== -1) { assert.equal(hit.matchScope, 'passage_branch'); assert.ok(hit.matchedBranches.some(branch => branch.text === quotation)); }
      seen.add(proof.id + ':' + proof.branchIndex + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('explicit natal occurrence accepts a native hidden-stem witness even when the anchored L2 structure is unsupported', context => {
  const directory = temporary(context); const raw = rawFacts(native.extraWitnesses.unanchored);
  const chart = claimChartContext('bazi', chartContext('bazi', raw, [], 'natal'));
  assert.ok(!chart.present.some(f => f.kind === 'bazi_ten_god_structure' && f.name === '伤官见官'));
  const hits = lookupInterpretations(directory, query(raw));
  for (const id of [occurrenceId, femaleId]) assert.ok(hits.some(hit => hit.id === id));
  assert.match(hits.find(hit => hit.id === occurrenceId).calculationNote, /不额外添加两者都透干或都为月令本气/u);
  const [unknownTime] = parseChartQueries([query(raw)], { timeKnown: false });
  assert.ok(lookupInterpretations(directory, unknownTime).some(hit => hit.id === occurrenceId), 'confirmed year/month/day occurrences survive unknown hour');
  const femaleOnly = input => lookupInterpretations(directory, query(input)).some(hit => hit.id === femaleId);
  const withoutGender = raw.filter(f => f.kind !== 'natal_gender');
  assert.equal(femaleOnly(withoutGender), false); assert.equal(femaleOnly([...withoutGender, { kind: 'natal_gender', gender: '男' }]), false);
  assert.equal(femaleOnly([...raw, { kind: 'natal_gender', gender: '男' }]), false);
});

test('killing is not a substitute for officer; hour-branch wealth is not hour-stem wealth; unknown hour cannot satisfy fixed time', context => {
  const directory = temporary(context); const matches = (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id);
  const female = { kind: 'natal_gender', gender: '女' };
  assert.equal(matches(femaleId, [female, god('stem_ten_god', 'year', '伤官'), god('branch_ten_god', 'month', '七杀')]), false);
  assert.equal(matches(femaleId, [female, { kind: 'bazi_ten_god_structure', name: '伤官见官' }]), false);
  const negative = rawFacts(native.extraWitnesses.hiddenHourWealth);
  assert.ok(negative.some(f => f.kind === 'branch_ten_god' && f.position === 'hour' && f.tenGod === '偏财'));
  assert.ok(!negative.some(f => f.kind === 'stem_ten_god' && f.position === 'hour' && f.tenGod === '偏财'));
  assert.equal(matches(hourId, negative), false);
  for (const id of [hourId, 'yhzp-v5-c094-p003-001', 'zpzq-v1-c021-p007-001']) {
    const witness = native.witnesses.find(w => w.proofs.some(proof => proof.id === id)); assert.ok(witness);
    const [unknown] = parseChartQueries([query(rawFacts(witness))], { timeKnown: false });
    assert.ok(!lookupInterpretations(directory, unknown).some(hit => hit.id === id));
  }
});

test('independent hidden-wealth quotation withholds unmatched officer and fame conclusions and does not invent non-exposure', context => {
  const directory = temporary(context);
  const raw = [god('branch_ten_god', 'day', '正财')];
  const id = 'yhzp-v3-c105-p002-101'; const hit = lookupInterpretations(directory, query(raw)).find(hit => hit.id === id); assert.ok(hit);
  assert.deepEqual(hit.matchedBranches.map(branch => branch.text), ['財要藏，藏則豊厚']);
  const material = buildReportMaterials([{ topic: '事业', personality: [], events: [hit] }]);
  assert.ok(!material.includes('官喜露')); assert.ok(!material.includes('名振鄉邦')); assert.match(material, /藏不自动等于未透/u);
  const mixed = [god('stem_ten_god', 'year', '正官'), god('branch_ten_god', 'month', '七杀'), god('stem_ten_god', 'hour', '七杀')];
  const bothVisibleAndHidden = lookupInterpretations(directory, query(mixed)).find(hit => hit.id === 'yhzp-v1-c313-p005-001'); assert.ok(bothVisibleAndHidden);
  assert.ok(bothVisibleAndHidden.matchedBranches.some(branch => branch.text === '露官藏殺方\n爲福'));
});

test('fixed source signatures protect the exact-pillar example and each independent quotation from source changes', context => {
  for (const id of ['yhzp-v1-c313-p005-001', 'yhzp-v3-c105-p002-101', 'zpzq-v1-c021-p007-001']) {
    const changed = structuredClone(sources.find(row => row.id === id)); changed.conditions.normalized.push('另须未定义的条件');
    const [row] = compileClaimSources(fixture(context, [changed]));
    assert.equal(row.inputs, undefined); assert.deepEqual(row.branches, []);
    assert.ok(['source_review_required', 'unmapped_condition'].includes(row.reason));
  }
  const catalog = catalogForDirectory(temporary(context)); const row = catalog.get('zpzq-v1-c021-p007-001');
  assert.equal(row.inputs.length, 1);
  for (const fact of [{ kind: 'stem', position: 'day', stem: '辛' }, { kind: 'branch', position: 'month', branch: '申' },
    { kind: 'stem', position: 'year', stem: '壬' }, { kind: 'stem', position: 'month', stem: '戊' }, { kind: 'stem', position: 'hour', stem: '丙' }]) assert.ok(row.inputs[0].required.some(f => JSON.stringify(f) === JSON.stringify(fact)));
});

test('mapping audits retain the actual new DNF, all source fingerprints and the previous gendered visible-god OR', context => {
  const catalog = catalogForDirectory(temporary(context));
  const mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  for (const id of [femaleId, occurrenceId, 'zpzq-v1-c021-p007-001']) {
    assert.ok(mappings.get(id).sourceConditions.every(row => row.status !== 'unresolved'));
    assert.equal(mappings.get(id).inputs.length, catalog.get(id).inputs.length);
  }
  const old = catalog.get('yhzp-v3-c031-p002-003'); assert.equal(old.inputs.length, 6, 'existing female 比肩/劫财 visible OR remains intact');
  assert.ok(old.inputs.every(input => input.required.some(f => f.kind === 'natal_gender' && f.gender === '女')));
  const pending = pendingClaimConditions({ catalog });
  for (const row of batch.changes) assert.equal(pending.some(item => item.id === row.id), row.status === 'branch_indexed');
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousQueryableCompiledUnchanged, 2756);
});

test('a fresh SQLite runtime queries new whole and passage rules with all source JSON reads blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure();
  const witness = native.witnesses.find(w => w.proofs.some(proof => proof.branchIndex !== -1)); assert.ok(witness);
  const raw = rawFacts(witness); const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); };
  syncBuiltinESMExports();
  try { const fresh = createClaimsCatalog({ directory }); const hits = lookupInterpretations(directory, query(raw), fresh);
    for (const proof of witness.proofs) assert.ok(hits.some(hit => hit.id === proof.id));
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('model materials consume only the confirmed passage with the new visibility boundary and no provider call', async context => {
  const directory = temporary(context), actual = createReportLookup(directory), id = 'yhzp-v3-c105-p002-101'; let calls = 0;
  const lookup = queries => actual(queries).map(row => ({ ...row, personality: row.personality.filter(hit => hit.id === id), events: row.events.filter(hit => hit.id === id) }));
  const queries = parseChartQueries([query([god('branch_ten_god', 'day', '偏财')])]);
  const result = await generateReport({ chartQueries: queries }, { lookup, signal: new AbortController().signal,
    complete: async request => { calls++; assert.ok(request.materials.includes('財要藏，藏則豊厚')); assert.ok(!request.materials.includes('名振鄉邦'));
      assert.match(request.materials, /只发送已匹配的独立原句/u); return '模型替身报告'; } });
  assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
