import assert from 'node:assert/strict';
import fs, { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { compatibleZiweiRelativeFacts, ziweiMajorLayout, ziweiRelativePalaces } from './ziwei-relative-profile.mjs';
import { normalizeRuleInput, chartContext, evaluateRule } from './matching.mjs';
import { compileClaimSources, createClaimsCatalog, claimChartContext, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-21-20261119.json', import.meta.url)));
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-21-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/ziwei.json', import.meta.url)));
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
const branches = [...'子丑寅卯辰巳午未申酉戌亥'];
const mod = n => (n % 12 + 12) % 12;
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twenty-one-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twenty-one-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}
function isolatedSources(context, claims) {
  const directory = temporary(context); const sourceDirectory = join(directory, 'sources'); mkdirSync(sourceDirectory);
  for (const method of ['bazi', 'ziwei', 'western']) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(method === 'ziwei' ? claims : []));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  return { directory, sourceDirectory };
}

test('relative profile reproduces all twelve native major-star layouts and the six actual body-palace sites', () => {
  assert.equal(witnesses.layouts.length, 12); const purpleSites = new Set();
  for (const [purple, proof] of witnesses.layouts) {
    const raw = chartFacts.ziwei(calculateZiwei(proof.profile, proof.timeIndex));
    const at = new Map(raw.filter(f => f.kind === 'palace_branch').map(f => [f.palace, f.branch]));
    const actual = Object.fromEntries(raw.filter(f => f.kind === 'palace_star' && Object.hasOwn(proof.positions, f.star)).map(f => [f.star, at.get(f.palace)]));
    assert.deepEqual(actual, proof.positions); assert.deepEqual(ziweiMajorLayout(purple), actual); purpleSites.add(purple);
  }
  assert.deepEqual([...purpleSites].sort(), [...branches].sort());
  const observed = new Set(witnesses.witnesses.flatMap(w => chartFacts.ziwei(calculateZiwei(w.profile, w.timeIndex)).filter(f => f.kind === 'body_palace').map(f => f.palace)));
  assert.deepEqual([...observed].sort(), ziweiRelativePalaces.filter((_, i) => i % 2 === 0).sort());
  for (const [i, palace] of ziweiRelativePalaces.entries()) assert.equal(compatibleZiweiRelativeFacts([{ kind: 'body_palace', palace }]), i % 2 === 0);
  assert.equal(compatibleZiweiRelativeFacts([{ kind: 'body_palace', palace: '夫妻' }, { kind: 'body_palace', palace: '官禄' }]), false);
});

test('all 144 complete native layouts disprove the simultaneous double-flank reading without changing AND to OR', context => {
  let simultaneous = 0; let individual = 0;
  for (const [, { positions }] of witnesses.layouts) for (let life = 0; life < 12; life++) {
    const flanks = (a, b, center) => [mod(center - 1), mod(center + 1)].every(site => [positions[a], positions[b]].some(branch => branches.indexOf(branch) === site));
    const first = flanks('武曲', '天相', life), second = flanks('太阳', '太阴', mod(life - 4));
    if (first || second) individual++;
    if (first && second) simultaneous++;
  }
  assert.equal(simultaneous, 0); assert.ok(individual > 0);
  const catalog = catalogForDirectory(temporary(context));
  assert.equal(catalog.get('ziwei-v1-xingjue-032-p149-001'), null);
  const disjunction = catalog.get('ziwei-v3-jielan-122-p001-001');
  assert.equal(disjunction.inputs.length, 4);
  assert.ok(disjunction.inputs.every(input => input.required.filter(f => f.kind === 'palace_star').length === 2));
});

test('reversed palace phrases bind their entire conjunction and unknown star names or added qualifiers remain pending', context => {
  const base = structuredClone(sources.find(row => row.id === 'ziwei-v3-xingjue-049-p1344-001'));
  base.id = 'test-reversed-explicit-palace'; base.source.chapter = '测试一般篇';
  base.conditions.normalized = ['亥地夫妻宫', '武曲破军地空地劫天马同守'];
  const unknown = structuredClone(base); unknown.id = 'test-unknown-companion'; unknown.conditions.normalized[1] += '及未知星';
  const extra = structuredClone(base); extra.id = 'test-required-qualified'; extra.conditions.normalized.push('另须未实现的制化');
  const { sourceDirectory } = isolatedSources(context, [base, unknown, extra]);
  const rows = compileClaimSources(sourceDirectory); const resolved = rows.find(row => row.claim.id === base.id);
  assert.equal(resolved.inputs.length, 1);
  assert.ok(resolved.inputs[0].required.every(fact => fact.palace === '夫妻'));
  for (const id of [unknown.id, extra.id]) assert.equal(rows.find(row => row.claim.id === id).inputs, undefined);
  const current = compileClaimSources().find(row => row.claim.id === 'ziwei-v3-xingjue-049-p1344-001');
  assert.equal(current.inputs, undefined, 'unresolved 空劫 in the real source is not silently renamed or omitted');
});

test('the source-specific OR route fails closed when its source or normalized prerequisites change', context => {
  const original = sources.find(row => row.id === 'ziwei-v3-jielan-122-p001-001');
  for (const changed of [
    { ...structuredClone(original), evidence: { ...original.evidence, original_text: original.evidence.original_text + '另须一项' } },
    { ...structuredClone(original), conditions: { ...original.conditions, normalized: [...original.conditions.normalized, '女命'] } },
  ]) {
    const { sourceDirectory } = isolatedSources(context, [changed]);
    assert.equal(compileClaimSources(sourceDirectory)[0].inputs, undefined);
  }
});

test('all thirty-two whole-record alternatives reach SQLite, explanations and source-preserving report materials', context => {
  const directory = temporary(context); const catalog = catalogForDirectory(directory); const report = createReportLookup(directory);
  assert.equal(batch.newEntries, 6); assert.equal(batch.promotedEntries, 2); assert.equal(batch.newAlternativeCount, 32);
  assert.equal(witnesses.targetAlternatives, 32); assert.deepEqual(witnesses.missing, []);
  const expected = batch.changes.flatMap(row => row.addedInputDigests.map(d => row.id + ':' + d)); const seen = new Set();
  const ids = new Set(batch.changes.map(row => row.id));
  for (const witness of witnesses.witnesses) {
    const raw = chartFacts.ziwei(calculateZiwei(witness.profile, witness.timeIndex));
    const parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const chart = claimChartContext('ziwei', chartContext('ziwei', parsed[0].confirmedFacts, [], 'natal'));
    const hits = lookupInterpretations(directory, parsed[0]); const material = buildReportMaterials(report(parsed));
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id); const input = row.inputs.find(input => digest(input) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true);
      const hit = hits.find(hit => hit.id === proof.id); assert.ok(hit, proof.id);
      assert.equal(hit.matchScope, undefined); assert.match(hit.calculationNote, /两侧相夹/u);
      assert.equal(explainClaim(proof.id, 'ziwei', chartContext('ziwei', raw, [], 'natal'), undefined, catalog).matched, true);
      assert.ok(material.includes(row.claim.evidence.original_text));
      assert.deepEqual(row.claim, sources.find(source => source.id === proof.id));
      seen.add(proof.id + ':' + proof.inputDigest);
      for (const needed of input.required) {
        const partial = { ...chart, presentKeys: new Set([...chart.presentKeys].filter(key => key !== JSON.stringify(needed))) };
        assert.equal(evaluateRule(input, 'natal', partial).matched, false, proof.id + ': required premise retained');
      }
    }
    const [unknown] = parseChartQueries([query(raw)], { timeKnown: false });
    assert.ok(lookupInterpretations(directory, unknown).every(row => !ids.has(row.id)));
  }
  assert.deepEqual([...seen].sort(), expected.sort());
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
});

test('eight unreachable source expansions and six former body branches are retained as diagnostics instead of fake birth witnesses', context => {
  const catalog = catalogForDirectory(temporary(context));
  const fixed = catalog.get('ziwei-v2-minggong-p206002-001');
  assert.equal(fixed.incompatibleAlternatives.length, 8);
  assert.ok(fixed.incompatibleAlternatives.every(facts => !compatibleZiweiRelativeFacts(facts)));
  const mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  assert.equal(mappings.get(fixed.claim.id).incompatibleAlternatives.length, 8);
  for (const { id } of batch.changes) assert.equal(mappings.get(id).sourceConditions[0].status, 'compiled_relative_expression');
  assert.equal(batch.retiredImpossibleBranches.length, 6);
  for (const { id, inputDigest, bodyPalace } of batch.retiredImpossibleBranches) {
    assert.equal(id, 'ziwei-v1-zhuxing-wenda-p115000-001');
    const input = normalizeRuleInput('ziwei', { required: [{ kind: 'palace_star', palace: bodyPalace, star: '天同', scope: 'origin' }, { kind: 'body_palace', palace: bodyPalace }] });
    assert.equal(digest(input), inputDigest); assert.equal(compatibleZiweiRelativeFacts(input.required), false);
  }
  const example = 'ziwei-v1-guancelu-001-p172-001';
  assert.equal(mappings.get(example).status, 'case_indexed');
  const pending = pendingClaimConditions({ catalog });
  assert.ok(!pending.some(row => row.id === 'ziwei-v1-xingjue-032-p149-001'));
  assert.ok(!pending.some(row => row.id === example));
  for (const row of batch.changes) assert.ok(!pending.some(item => item.id === row.id));
});

test('fresh runtime instances query new relative rules from SQLite with source JSON reads blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure();
  const witness = witnesses.witnesses[0]; const raw = chartFacts.ziwei(calculateZiwei(witness.profile, witness.timeIndex));
  const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); };
  syncBuiltinESMExports();
  try { const fresh = createClaimsCatalog({ directory }); const hits = lookupInterpretations(directory, query(raw), fresh);
    for (const proof of witness.proofs) assert.ok(hits.some(hit => hit.id === proof.id));
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('a model double consumes source limits and the relative-palace calculation note without a provider call', async context => {
  const directory = temporary(context); const witness = witnesses.witnesses.find(w => w.proofs.some(p => p.id === 'ziwei-v2-minggong-p146000-001')); assert.ok(witness);
  const queries = parseChartQueries([query(chartFacts.ziwei(calculateZiwei(witness.profile, witness.timeIndex)))]); let calls = 0;
  const result = await generateReport({ chartQueries: queries }, { lookup: createReportLookup(directory), signal: new AbortController().signal,
    complete: async request => { calls++; assert.match(request.materials, /不能跨宫拼接/u); assert.match(request.materials, /原资料使用边界/u); return '模型替身报告'; } });
  assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
