import assert from 'node:assert/strict';
import fs, { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateBaZi, describeBaZiPillars, chartFacts, chartVersions } from '../../control/charts.ts';
import { createClaimsCatalog, claimChartContext, explainClaim, structuredClaimMappings } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { qtbjSeasonalPassageProfile } from './qtbj-seasonal-passages.mjs';
const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-32-20261119.json',import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-32-witnesses.json',import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/bazi.json',import.meta.url)));
const pairId = 'qtbj-v3-c017-p003-301', hiddenId = 'qtbj-v6-c109-p002-301';
const digest = v => createHash('sha256').update(JSON.stringify(v)).digest('hex');
const query = confirmedFacts => ({method:'bazi',rulesetVersion:chartVersions.bazi.rulesetVersion,confirmedFacts});
const rawFacts = w => chartFacts.bazi(calculateBaZi(Date.parse(w.date),Date.parse(w.localDate)));
const observed = pillars => chartFacts.bazi(describeBaZiPillars(pillars));
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(),'destiny-batch-thirty-two-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir())+sep+'destiny-batch-thirty-two-')); rmSync(directory,{recursive:true,force:true}); });
  return directory;
}

test('all 27 alternatives reach actual SQLite, explanation and report materials from native birth witnesses', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), seen = new Set(); catalog.ensure();
  assert.equal(batch.wholeEntries,2); assert.equal(native.targetAlternatives,27); assert.deepEqual(native.missing,[]);
  for (const w of native.witnesses) {
    const raw = rawFacts(w), parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const chart = claimChartContext('bazi',chartContext('bazi',parsed[0].confirmedFacts,[],'natal'));
    const hits = lookupInterpretations(directory,parsed[0]); assert.ok(createReportLookup(directory)(parsed).length);
    for (const proof of w.proofs) {
      const row = catalog.get(proof.id), input = row.inputs.find(i => digest(i) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input,'natal',chart).matched,true); const hit = hits.find(h => h.id === proof.id); assert.ok(hit);
      assert.equal(explainClaim(proof.id,'bazi',chartContext('bazi',raw,[],'natal'),undefined,catalog).matched,true);
      assert.deepEqual(row.claim,sources.find(s => s.id === proof.id));
      assert.ok(buildReportMaterials([{topic:'命理',personality:[],events:[hit]}]).includes(row.claim.evidence.original_text));
      seen.add(proof.id+':'+proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(),batch.changes.flatMap(r => r.inputs.map(i => r.id+':'+i.digest)).sort());
});

test('fixed column exposure and complete Xin absence cannot be borrowed from another column or from unknown time', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory,query(facts)).some(h => h.id === pairId);
  const raw = rawFacts(native.witnesses.find(w => w.proofs.some(p => p.id === pairId))); assert.equal(matches(raw),true);
  assert.equal(matches(observed({year:'庚寅',month:'戊寅',day:'丙子',hour:'庚寅'})),false,'year/hour does not replace month/hour');
  assert.equal(matches(observed({year:'辛酉',month:'庚寅',day:'丙子',hour:'庚寅'})),false,'visible Xin is forbidden');
  assert.equal(matches(observed({year:'丙戌',month:'庚寅',day:'丙子',hour:'庚寅'})),false,'Xin hidden in Xu is forbidden too');
  const [unknown] = parseChartQueries([query(raw)],{timeKnown:false}); assert.ok(unknown); assert.equal(matches(unknown.confirmedFacts),false);
  assert.equal(matches(raw.filter(f => f.kind !== 'branch' && f.kind !== 'pillar')),false,'no branch evidence cannot establish absence');
});

test('both concealed stems require branch evidence but can remain usable when a needless hour is unknown', context => {
  const directory = temporary(context), matches = facts => lookupInterpretations(directory,query(facts)).some(h => h.id === hiddenId);
  const raw = observed({year:'庚申',month:'己卯',day:'癸酉',hour:'辛酉'});
  assert.equal(matches(raw),true,'both exposed too; original has not asserted absence of exposure');
  const [unknown] = parseChartQueries([query(raw)],{timeKnown:false}); assert.equal(matches(unknown.confirmedFacts),true);
  assert.equal(matches(observed({year:'庚子',month:'己卯',day:'癸卯',hour:'辛酉'})),false,'visible Geng without hidden Geng is insufficient');
  assert.equal(matches(observed({year:'庚申',month:'己卯',day:'癸卯',hour:'壬子'})),false,'hidden Geng alone is insufficient');
  const onlyHour = observed({year:'戊子',month:'乙卯',day:'癸酉',hour:'己巳'}); assert.equal(matches(onlyHour),true);
  const [lost] = parseChartQueries([query(onlyHour)],{timeKnown:false}); assert.equal(matches(lost.confirmedFacts),false,'unknown required hidden Geng cannot be invented');
});

test('audits preserve sources and old compiled records while impossible and ambiguous candidates stay unindexed', context => {
  const catalog = catalogForDirectory(temporary(context)), mappings = new Map([...structuredClaimMappings(catalog)].map(r => [r.id,r]));
  for (const row of batch.changes) { assert.equal(mappings.get(row.id).status,'indexed'); assert.equal(mappings.get(row.id).remainingAlternatives ?? 0,0); }
  assert.equal(batch.previousQueryableCompiledUnchanged,2819); assert.equal(batch.previousQueryableInputsPreserved,2819);
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  for (const id of batch.pending) {
    const row = catalog.get(id);
    if (id === 'qtbj-v3-c016-p002-301') {
      assert.equal(mappings.get(id).status, 'indexed');
      assert.equal(row.compiler, qtbjSeasonalPassageProfile);
    } else {
      assert.ok(!row.inputs?.length);
      assert.deepEqual(row.branches, []);
    }
  }
});

test('fresh runtime matches both new entries with source JSON reads blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure(); const original = fs.readFileSync;
  fs.readFileSync = function(file,...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file,...args); }; syncBuiltinESMExports();
  try { const catalog = createClaimsCatalog({directory}); for (const r of batch.changes) { const w = native.witnesses.find(w => w.proofs.some(p => p.id === r.id)); assert.ok(lookupInterpretations(directory,query(rawFacts(w)),catalog).some(h => h.id === r.id)); } }
  finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('a model double receives the hidden-stem original through the real report lookup', async context => {
  const directory = temporary(context), actual = createReportLookup(directory), w = native.witnesses.find(w => w.proofs.some(p => p.id === hiddenId)); let calls = 0;
  const lookup = queries => actual(queries).map(r => ({...r,personality:r.personality.filter(h => h.id === hiddenId),events:r.events.filter(h => h.id === hiddenId)}));
  const result = await generateReport({chartQueries:parseChartQueries([query(rawFacts(w))])},{lookup,signal:new AbortController().signal,
    complete:async request => { calls++; assert.ok(request.materials.includes('庚辛两藏')); return '模型替身报告'; }});
  assert.equal(calls,1); assert.equal(result.report,'模型替身报告');
});
