import assert from 'node:assert/strict';
import fs, { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import { createHash } from 'node:crypto';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { createClaimsCatalog, claimChartContext, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { claimSourceDirectory } from './claims-sqlite.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { parseChartQueries, createReportLookup } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-28-20261119.json', import.meta.url)));
const native = JSON.parse(readFileSync(new URL('./claims/integration-batch-28-witnesses.json', import.meta.url)));
const sources = JSON.parse(readFileSync(new URL('./claims/ziwei.json', import.meta.url)));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const waterId = 'ziwei-v2-jielan-072-p002-002', lightsId = 'ziwei-v4-jielan-203-p002-001', passageId = 'ziwei-v2-minggong-p323001-033';
const positive = '若太阳在寅卯辰巳午化忌，太阴在酉戌亥子化忌为福论。';
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
const rawFacts = witness => chartFacts.ziwei(calculateZiwei(witness.profile, witness.timeIndex));
const factsFor = (star, branch, palace = '命宫') => [
  { kind: 'palace_star', palace, star, scope: 'origin' }, { kind: 'palace_branch', palace, branch },
  { kind: 'star_mutagen', palace, star, change: '忌', scope: 'origin' },
];
function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-twenty-eight-'));
  context.after(() => { assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-twenty-eight-')); rmSync(directory, { recursive: true, force: true }); });
  return directory;
}

test('all 141 new alternatives reach SQLite, explanations and source-bounded materials from native birth witnesses', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory); catalog.ensure();
  assert.equal(batch.wholeEntries, 2); assert.equal(batch.branchEntries, 1); assert.equal(batch.wholeAlternatives, 132); assert.equal(batch.passageAlternatives, 9);
  assert.equal(native.targetAlternatives, 141); assert.deepEqual(native.missing, []);
  const expected = batch.changes.flatMap(row => [...row.inputs.map(input => row.id + ':-1:' + input.digest),
    ...row.branches.flatMap((branch, i) => branch.inputs.map(input => row.id + ':' + i + ':' + input.digest))]); const seen = new Set();
  for (const witness of native.witnesses) {
    const raw = rawFacts(witness), parsed = parseChartQueries([query(raw)]); assert.ok(parsed);
    const chart = claimChartContext('ziwei', chartContext('ziwei', parsed[0].confirmedFacts, [], 'natal'));
    const hits = lookupInterpretations(directory, parsed[0]);
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id), input = (proof.branchIndex === -1 ? row.inputs : row.branches[proof.branchIndex].inputs).find(input => digest(input) === proof.inputDigest); assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true);
      const hit = hits.find(hit => hit.id === proof.id); assert.ok(hit, proof.id);
      assert.equal(explainClaim(proof.id, 'ziwei', chartContext('ziwei', raw, [], 'natal'), undefined, catalog).matched, true);
      assert.deepEqual(row.claim, sources.find(source => source.id === proof.id));
      const material = buildReportMaterials([{ topic: '命理', personality: [], events: [hit] }]);
      if (proof.branchIndex === -1) assert.ok(material.includes(row.claim.evidence.original_text));
      else { assert.equal(hit.matchScope, 'passage_branch'); assert.ok(material.includes(positive)); assert.ok(!material.includes('主大凶')); }
      seen.add(proof.id + ':' + proof.branchIndex + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected.sort());
});

test('named transformations require the same star, palace, branch and natal time layer in SQL and explanations', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory); catalog.ensure();
  const raw = factsFor('廉贞', '亥'), matches = facts => lookupInterpretations(directory, query(facts)).some(hit => hit.id === waterId);
  assert.equal(matches(raw), true);
  const wrong = [raw.slice(0, 2), raw.slice(1), [raw[0], raw[2]],
    raw.map(f => f.kind === 'star_mutagen' ? { ...f, star: '太阳' } : f),
    raw.map(f => f.kind === 'star_mutagen' ? { ...f, palace: '夫妻' } : f),
    raw.map(f => f.kind === 'palace_branch' ? { ...f, branch: '寅' } : f),
    [raw[0], raw[1], { kind: 'palace_mutagen', palace: '命宫', change: '忌', scope: 'origin' }]];
  for (const facts of wrong) { assert.equal(matches(facts), false); assert.equal(explainClaim(waterId, 'ziwei', chartContext('ziwei', facts, [], 'natal'), undefined, catalog).matched, false); }
  const mixedPeriod = raw.map(f => f.kind === 'star_mutagen' ? { ...f, scope: 'yearly' } : f);
  assert.equal(parseChartQueries([query(mixedPeriod)]), null);
  assert.throws(() => matches(mixedPeriod), /scope conflicts/u);
  assert.throws(() => chartContext('ziwei', mixedPeriod, [], 'natal'), /scope conflicts/u);
  const annual = raw.map(f => f.scope ? { ...f, scope: 'yearly' } : f);
  assert.ok(!lookupInterpretations(directory, { ...query(annual), chartScope: 'annual' }).some(hit => hit.id === waterId));
  assert.equal(explainClaim(waterId, 'ziwei', chartContext('ziwei', annual, [], 'annual'), undefined, catalog).matched, false);
  for (const branch of ['亥', '子', '丑']) assert.equal(matches(factsFor('廉贞', branch, '夫妻')), true);
});

test('each book retains its own Sun list and the 全书 quotation remains confined to 命宫', context => {
  const directory = temporary(context), has = (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id);
  for (const branch of '寅卯辰巳午') {
    const raw = factsFor('太阳', branch); assert.equal(has(passageId, raw), true); assert.equal(has(lightsId, raw), branch !== '午');
    assert.equal(has(passageId, factsFor('太阳', branch, '迁移')), false);
  }
  for (const branch of '酉戌亥子') { assert.equal(has(lightsId, factsFor('太阴', branch)), true); assert.equal(has(passageId, factsFor('太阴', branch)), true); }
  for (const branch of '午未申') { assert.equal(has(lightsId, factsFor('太阴', branch)), false); assert.equal(has(passageId, factsFor('太阴', branch)), false); }
  assert.equal(has(lightsId, factsFor('太阳', '酉')), false); assert.equal(has(lightsId, factsFor('太阴', '寅')), false);
});

test('source OR alternatives work independently while contradictory birth years and simultaneous natal 忌 stars are rejected', context => {
  const directory = temporary(context), catalog = catalogForDirectory(directory); catalog.ensure();
  for (const [star, branch, stem] of [['太阳', '寅', '甲'], ['太阴', '酉', '乙']]) {
    const raw = [...factsFor(star, branch), { kind: 'natal_year_stem', stem }];
    assert.ok(lookupInterpretations(directory, query(raw)).some(hit => hit.id === lightsId));
    for (const facts of [[...raw, { kind: 'natal_year_stem', stem: '辛' }],
      [...factsFor(star, branch), { kind: 'natal_year_stem', stem: '辛' }],
      [...raw, { kind: 'star_mutagen', palace: '夫妻', star: star === '太阳' ? '太阴' : '太阳', scope: 'origin', change: '忌' }]]) {
      assert.ok(!lookupInterpretations(directory, query(facts)).some(hit => hit.id === lightsId));
      const explained = explainClaim(lightsId, 'ziwei', chartContext('ziwei', facts, [], 'natal'), undefined, catalog);
      assert.equal(explained.matched, false); assert.equal(explained.reason, 'conflicting_natal_year_placement');
    }
  }
});

test('audit retains three version conflicts, all raw sources and the unproved negative quotation as pending', context => {
  const catalog = catalogForDirectory(temporary(context)), mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  const pending = pendingClaimConditions({ catalog });
  for (const row of batch.reviewed) { const item = pending.find(item => item.id === row.id); assert.equal(item.reason, 'different_chart_tradition'); assert.match(item.reviewNote, /默认生年四化/u); }
  assert.ok(pending.some(row => row.id === passageId));
  assert.equal(catalog.get(passageId).inputs, undefined); assert.equal(catalog.get(passageId).branches.length, 1);
  assert.equal(mappings.get(passageId).branches[0].text, positive);
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  assert.equal(batch.previousQueryableInputsPreserved, 2805); assert.equal(batch.previousQueryableCompiledUnchanged, 2804);
});

test('fresh runtime reads new whole and passage rules from SQLite with source JSON access blocked', context => {
  const directory = temporary(context); catalogForDirectory(directory).ensure(); const original = fs.readFileSync;
  fs.readFileSync = function(file, ...args) { if (String(file).startsWith(claimSourceDirectory) && /\.json$/u.test(String(file))) throw new Error('Runtime JSON scan'); return original(file, ...args); }; syncBuiltinESMExports();
  try {
    const fresh = createClaimsCatalog({ directory });
    for (const [id, raw] of [[waterId, factsFor('廉贞', '亥')], [lightsId, factsFor('太阳', '寅')], [passageId, factsFor('太阳', '午')]]) assert.ok(lookupInterpretations(directory, query(raw), fresh).some(hit => hit.id === id));
  } finally { fs.readFileSync = original; syncBuiltinESMExports(); }
});

test('the real report lookup supplies only the confirmed positive passage and a readable source-version note to the model double', async context => {
  const directory = temporary(context), actual = createReportLookup(directory); let calls = 0;
  const lookup = queries => actual(queries).map(row => ({ ...row, personality: row.personality.filter(hit => hit.id === passageId), events: row.events.filter(hit => hit.id === passageId) }));
  const result = await generateReport({ chartQueries: parseChartQueries([query(factsFor('太阳', '午'))]) }, { lookup, signal: new AbortController().signal,
    complete: async request => { calls++; assert.ok(request.materials.includes(positive)); assert.ok(!request.materials.includes('主大凶')); assert.match(request.materials, /同一颗已命名星曜/u); assert.match(request.materials, /太阳列表含午/u); assert.ok(!request.materials.includes('iztro-2.6.5-natal-mutagen-placement-v1')); return '模型替身报告'; } });
  assert.equal(calls, 1); assert.equal(result.report, '模型替身报告');
});
