import assert from 'node:assert/strict';
import fs, { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { compileClaimSources, createClaimsCatalog, claimChartContext, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { compatibleZiweiNatalPlacement } from './ziwei-natal-placement.mjs';
import { ziweiGusuiProfile } from './ziwei-gusui-sources.mjs';
import { quanshuMinggongPassageProfile } from './quanshu-minggong-passages.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-23-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-23-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/ziwei.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
const gradeId = 'ziwei-v2-minggong-p142000-004', sheepId = 'ziwei-v2-minggong-p253000-001';
const horseId = 'ziwei-v3-c020-p156002-001', martialId = 'ziwei-v2-minggong-p125002-001';
const rawFacts = witness => chartFacts.ziwei(calculateZiwei(witness.profile, witness.timeIndex));
const star = (palace, star) => ({ kind: 'palace_star', palace, star, scope: 'origin' });
const branch = (palace, branch) => ({ kind: 'palace_branch', palace, branch });
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twenty-three-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twenty-three-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}
function fixture(context, claims) {
  const sourceDirectory = join(temporary(context), 'sources'); mkdirSync(sourceDirectory);
  for (const method of ['bazi', 'ziwei', 'western']) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(method === 'ziwei' ? claims : []));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  return sourceDirectory;
}

test('all 26 new natal-year and grade alternatives reach actual SQLite, explanations and report materials from native births', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory), report = createReportLookup(directory);
  assert.equal(batch.wholeEntries, 5); assert.equal(batch.branchEntries, 1);
  assert.equal(batch.wholeAlternatives, 22); assert.equal(batch.passageAlternatives, 4);
  assert.equal(native.targetAlternatives, 26); assert.deepEqual(native.missing, []);
  const expected = batch.changes.flatMap(row => [...row.inputs.map(input => row.id + ':-1:' + input.digest),
    ...row.branches.flatMap((branch, i) => branch.inputDigests.map(hash => row.id + ':' + i + ':' + hash))]); const seen = new Set();
  for (const witness of native.witnesses) {
    const raw = rawFacts(witness), parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const chart = claimChartContext('ziwei', chartContext('ziwei', parsed[0].confirmedFacts, [], 'natal'));
    const hits = lookupInterpretations(directory, parsed[0]), material = buildReportMaterials(report(parsed));
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id), input = (proof.branchIndex === -1 ? row.inputs : row.branches[proof.branchIndex].inputs).find(input => digest(input) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true);
      const hit = hits.find(hit => hit.id === proof.id); assert.ok(hit, proof.id);
      assert.equal(explainClaim(proof.id, 'ziwei', chartContext('ziwei', raw, [], 'natal'), undefined, catalog).matched, true);
      const quotation = proof.branchIndex === -1 ? row.claim.evidence.original_text : row.branches[proof.branchIndex].text;
      assert.ok(material.includes(quotation)); assert.deepEqual(row.claim, sources.find(source => source.id === proof.id));
      if (proof.branchIndex !== -1) { assert.equal(hit.matchScope, 'passage_branch'); assert.ok(hit.matchedBranches.some(branch => branch.text === quotation)); }
      seen.add(proof.id + ':' + proof.branchIndex + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('the two 申廉贞 birth grades quote only the confirmed grade and reject 寅, other years and missing placement', context => {
  const directory = temporary(context); const matches = facts => lookupInterpretations(directory, query(facts)).find(hit => hit.id === gradeId);
  const raw = [star('命宫', '廉贞'), branch('命宫', '申')];
  for (const stem of ['甲', '庚', '戊', '丙']) {
    const hit = matches([...raw, { kind: 'natal_year_stem', stem }]); assert.ok(hit);
    const text = stem === '丙' ? '丙生人次之' : '申宫入庙甲庚戊生人贵格';
    assert.deepEqual(hit.matchedBranches.map(branch => branch.text), [text]);
    const material = buildReportMaterials([{ topic: '事业', personality: [], events: [hit] }]);
    assert.ok(material.includes(text)); assert.ok(!material.includes('寅宫和平')); assert.match(material, /等级分别核对/u);
    if (stem === '丙') assert.ok(!hit.matchedBranches.some(branch => branch.text.includes('贵格')));
  }
  for (const facts of [raw, [star('命宫', '廉贞'), branch('命宫', '寅'), { kind: 'natal_year_stem', stem: '甲' }],
    [...raw, { kind: 'natal_year_stem', stem: '乙' }], [star('迁移', '廉贞'), branch('命宫', '申'), { kind: 'natal_year_stem', stem: '甲' }]]) assert.equal(matches(facts), undefined);
});

test('birth-year selectors cannot use the life-palace branch, and 四生 requires 天马 in the specified spouse palace', context => {
  const directory = temporary(context), matches = (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id);
  const sheepWitness = native.witnesses.find(w => w.proofs.some(p => p.id === sheepId)); assert.ok(sheepWitness);
  const sheepRaw = rawFacts(sheepWitness); assert.equal(matches(sheepId, sheepRaw), true);
  const noYear = sheepRaw.filter(f => f.kind !== 'natal_year_branch'); assert.equal(matches(sheepId, noYear), false);
  assert.equal(matches(sheepId, [...noYear, { kind: 'natal_year_branch', branch: '辰' }]), false);
  assert.equal(matches(sheepId, [...noYear, { kind: 'natal_year_branch', branch: '子' }]), false);
  for (const place of ['寅', '申', '巳', '亥']) assert.equal(matches(horseId, [star('夫妻', '天马'), branch('夫妻', place)]), true);
  for (const place of ['子', '丑', '辰', '午', '未', '酉', '戌', '卯']) assert.equal(matches(horseId, [star('夫妻', '天马'), branch('夫妻', place)]), false);
  assert.equal(matches(horseId, [star('迁移', '天马'), branch('夫妻', '寅')]), false);
  assert.equal(matches(horseId, [star('夫妻', '天马')]), false);
  const martialRaw = rawFacts(native.witnesses.find(w => w.proofs.some(p => p.id === martialId)));
  assert.equal(matches(martialId, martialRaw.filter(f => f.kind !== 'natal_year_stem')), false);
});

test('all 60 legal year pillars agree with native 羊马 placements; eight impossible 四库 birth-year alternatives stay excluded', () => {
  const branches = '子丑寅卯辰巳午未申酉戌亥';
  for (let year = 1960; year < 2020; year++) {
    const raw = chartFacts.ziwei(calculateZiwei({ date: { year, month: 7, day: 15 }, gender: 'female' }, 0));
    const selected = raw.filter(f => ['natal_year_stem', 'natal_year_branch', 'palace_branch'].includes(f.kind)
      || f.kind === 'palace_star' && ['擎羊', '天马'].includes(f.star));
    assert.equal(compatibleZiweiNatalPlacement(selected), true, String(year));
    const positions = selected.filter(f => f.kind === 'palace_branch');
    for (const name of ['擎羊', '天马']) {
      const located = selected.find(f => f.kind === 'palace_star' && f.star === name); assert.ok(located);
      const shifted = positions.find(f => f.branch === branches[(branches.indexOf(positions.find(p => p.palace === located.palace).branch) + 1) % 12]);
      assert.equal(compatibleZiweiNatalPlacement(selected.map(f => f === located ? { ...f, palace: shifted.palace } : f)), false);
    }
  }
  const row = compileClaimSources().find(row => row.claim.id === sheepId);
  assert.equal(row.inputs.length, 8); assert.equal(row.incompatibleAlternatives.length, 8);
  assert.deepEqual([...new Set(row.incompatibleAlternatives.flat().filter(f => f.kind === 'natal_year_branch').map(f => f.branch))].sort(), ['戌', '辰'].sort());
  for (const facts of row.incompatibleAlternatives) assert.equal(compatibleZiweiNatalPlacement(facts), false);
});

test('contradictory birth years and palace positions cannot match either whole rules or grade passages', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory);
  const conditions = [
    { id: martialId, facts: [star('命宫', '武曲'), { kind: 'natal_year_stem', stem: '甲' }, { kind: 'natal_year_stem', stem: '己' }] },
    { id: gradeId, facts: [star('命宫', '廉贞'), branch('命宫', '申'), { kind: 'natal_year_stem', stem: '甲' }, { kind: 'natal_year_stem', stem: '丙' }] },
    { id: gradeId, facts: [star('命宫', '廉贞'), branch('命宫', '申'), branch('命宫', '寅'), { kind: 'natal_year_stem', stem: '甲' }] },
    { id: sheepId, facts: [star('命宫', '擎羊'), branch('命宫', '辰'), { kind: 'palace_brightness', palace: '命宫', star: '擎羊', scope: 'origin', brightness: '庙' },
      { kind: 'natal_year_branch', branch: '丑' }, { kind: 'natal_year_stem', stem: '甲' }] },
    { id: horseId, facts: [star('夫妻', '天马'), branch('夫妻', '寅'), { kind: 'natal_year_branch', branch: '子' }, { kind: 'natal_year_branch', branch: '午' }] },
  ];
  for (const { id, facts } of conditions) {
    assert.ok(!lookupInterpretations(directory, query(facts)).some(hit => hit.id === id));
    const explained = explainClaim(id, 'ziwei', chartContext('ziwei', facts, [], 'natal'), undefined, catalog);
    assert.equal(explained.matched, false); assert.equal(explained.reason, 'conflicting_natal_year_placement');
  }
});

test('grade source fingerprints fail closed and no new syntax drops an unknown prerequisite', context => {
  for (const field of ['source', 'conditions', 'evidence']) {
    const changed = structuredClone(sources.find(row => row.id === gradeId));
    if (field === 'source') changed.source.edition += '修订';
    if (field === 'conditions') changed.conditions.normalized.push('另须未定义的条件');
    if (field === 'evidence') changed.evidence.original_text += '另有条件';
    const [row] = compileClaimSources(fixture(context, [changed])); assert.equal(row.inputs, undefined); assert.deepEqual(row.branches, []);
  }
  const changed = structuredClone(sources.find(row => row.id === martialId)); changed.id = 'test-birth-year-unknown';
  changed.conditions.normalized = ['武曲守本命命宫，甲年或己年生且原局生旺'];
  const [row] = compileClaimSources(fixture(context, [changed])); assert.equal(row.inputs, undefined); assert.deepEqual(row.branches, []);
});

test('audits preserve original conditions, all eight incompatible alternatives and all still-unmapped diagnostic entries', context => {
  const catalog = catalogForDirectory(temporary(context)); const mapping = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  assert.equal(mapping.get(sheepId).incompatibleAlternatives.length, 8);
  assert.equal(mapping.get(sheepId).remainingAlternatives, 8);
  for (const id of [sheepId, horseId, martialId]) assert.ok(mapping.get(id).sourceConditions.every(row => row.status === 'compiled_source_expression'));
  const pending = pendingClaimConditions({ catalog });
  assert.ok(pending.some(row => row.id === gradeId));
  assert.ok(pending.some(row => row.id === sheepId && /8个可查询/u.test(row.reviewNote)));
  const verifiedConcordances = new Set(['ziwei-v3-jielan-123-p001-108', 'ziwei-v3-jielan-123-p001-124']);
  for (const { id } of batch.statusOnly) {
    if (verifiedConcordances.has(id)) {
      assert.equal(mapping.get(id).status, 'indexed');
      assert.equal(catalog.get(id).compiler, ziweiGusuiProfile);
    } else if (id === 'ziwei-v2-minggong-p323001-009') {
      assert.equal(mapping.get(id).status, 'indexed');
      assert.equal(catalog.get(id).compiler, quanshuMinggongPassageProfile);
    } else if (id === 'ziwei-v2-minggong-p255000-004') {
      assert.equal(mapping.get(id).status, 'branch_indexed');
      assert.ok(catalog.get(id).branches.some(branch => branch.conditionCompiler === quanshuMinggongPassageProfile));
    } else {
      assert.ok(pending.some(item => item.id === id && item.status === 'unmapped'));
    }
  }
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousQueryableCompiledUnchanged, 2763);
});

test('fresh SQLite runtime reads the new natal-year and grade rules with source JSON access blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure();
  const witness = native.witnesses.find(w => w.proofs.some(p => p.id === gradeId)); assert.ok(witness);
  const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); };
  syncBuiltinESMExports();
  try { const fresh = createClaimsCatalog({ directory }); const hits = lookupInterpretations(directory, query(rawFacts(witness)), fresh);
    for (const proof of witness.proofs) assert.ok(hits.some(hit => hit.id === proof.id));
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('report generation consumes only the matched 丙 grade through real lookup without a provider request', async context => {
  const directory = temporary(context), actual = createReportLookup(directory); let calls = 0;
  const lookup = queries => actual(queries).map(row => ({ ...row, personality: row.personality.filter(hit => hit.id === gradeId), events: row.events.filter(hit => hit.id === gradeId) }));
  const facts = [star('命宫', '廉贞'), branch('命宫', '申'), { kind: 'natal_year_stem', stem: '丙' }];
  const result = await generateReport({ chartQueries: parseChartQueries([query(facts)]) }, { lookup, signal: new AbortController().signal,
    complete: async request => { calls++; assert.ok(request.materials.includes('丙生人次之')); assert.ok(!request.materials.includes('申宫入庙甲庚戊生人贵格'));
      assert.ok(!request.materials.includes('寅宫和平')); return '模型替身报告'; } });
  assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
