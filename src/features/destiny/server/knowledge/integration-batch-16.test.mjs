import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { claimChartContext, createClaimsCatalog, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-16-20261118.json', import.meta.url)));
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
function temporary(context, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + prefix));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}
function setup(context) {
  const directory = temporary(context, 'destiny-batch-sixteen-');
  return { catalog: catalogForDirectory(directory), report: createReportLookup(directory),
    matches: (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id) };
}

test('all 29 new alternatives reach SQL, explanation and report materials from actual native Ziwei births', context => {
  const { catalog, report, matches } = setup(context);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-16-witnesses.json', import.meta.url)));
  assert.equal(batch.changes.length, 12);
  assert.equal(batch.uniqueAlternatives, 29);
  assert.equal(witnesses.profile, batch.profile);
  assert.equal(witnesses.targetAlternatives, 29);
  assert.deepEqual(witnesses.missing, []);
  const expected = batch.changes.flatMap(row => row.inputDigests.map(hash => row.id + ':' + hash)).sort();
  const seen = new Set();
  for (const { profile, timeIndex, proofs } of witnesses.witnesses) {
    const facts = chartFacts.ziwei(calculateZiwei(profile, timeIndex));
    const parsed = parseChartQueries([query(facts)]);
    assert.ok(parsed);
    const chart = claimChartContext('ziwei', chartContext('ziwei', parsed[0].confirmedFacts, [], 'natal'));
    const material = buildReportMaterials(report(parsed));
    for (const proof of proofs) {
      const row = catalog.get(proof.id);
      const input = row.inputs.find(input => digest(input) === proof.inputDigest);
      assert.ok(input, proof.id + ': current exact alternative');
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, proof.id);
      assert.ok(matches(proof.id, facts), proof.id + ': real SQLite lookup');
      assert.equal(explainClaim(proof.id, 'ziwei', chartContext('ziwei', facts, [], 'natal'), undefined, catalog).matched, true);
      assert.ok(material.includes(row.claim.evidence.original_text), proof.id + ': exact source');
      for (const limit of row.claim.interpretation.limitations) assert.ok(material.includes(limit), proof.id + ': source limit');
      seen.add(proof.id + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), expected);
});

test('new conditions preserve every indispensable observation, year stem, source brightness and known-time requirement', context => {
  const { catalog, matches } = setup(context);
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    for (const input of row.inputs) {
      const facts = input.required.filter(fact => fact.kind !== 'palace_source_brightness');
      assert.ok(matches(id, facts), id);
      for (const fact of facts) assert.equal(matches(id, facts.filter(other => other !== fact)), false, id + ': missing ' + JSON.stringify(fact));
      const [unknown] = parseChartQueries([query(facts)], { timeKnown: false });
      assert.equal(matches(id, unknown.confirmedFacts), false, id + ': unknown birth time');
    }
    assert.equal(matches(id, []), false, id + ': no chart data');
  }
  const same = 'ziwei-v1-xingjue-025-p135-001';
  const facts = catalog.get(same).inputs[0].required;
  assert.equal(catalog.get(same).inputs.length, 1);
  assert.ok(facts.every(fact => !fact.palace || fact.palace === '官禄'));
  assert.equal(matches(same, facts.map(fact => fact.kind === 'palace_star' ? { ...fact, palace: '命宫' } : fact)), false, 'the conjunction cannot be borrowed from another palace');
  const both = catalog.get('ziwei-v2-fuqigong-p009-001').inputs[0].required;
  for (const gender of ['女', '男']) assert.ok(matches('ziwei-v2-fuqigong-p009-001', [...both, { kind: 'natal_gender', gender }]));
  const crying = catalog.get('ziwei-v4-jielan-227-p001-001').inputs[0].required;
  assert.deepEqual(crying.filter(fact => fact.kind === 'palace_star').map(fact => fact.star).sort(), ['天哭', '天虚'].sort());
});

test('complete star names survive verb ambiguity and explicit palace context binds same-guard predicates', context => {
  const directory = temporary(context, 'destiny-star-name-');
  const sourceDirectory = join(directory, 'sources');
  mkdirSync(sourceDirectory);
  const fixture = (id, chapter, normalized) => ({ id, title: '合成语法测试', category: { topic: '综合', type: '性格', tags: [] },
    source: { book: '测试资料', author: '测试', edition: '1', volume: '一', chapter, section: null, passage_id: id, url: 'https://example.test/fixture' },
    evidence: { original_text: '仅校验解析语法，不是古籍命理依据', context: null },
    conditions: { original: normalized, normalized, uncertain: [], excluded: [] },
    interpretation: { classical_meaning: '仅测试', limitations: ['合成资料'] } });
  const names = '紫微 天机 太阳 武曲 天同 廉贞 天府 太阴 贪狼 巨门 天相 天梁 七杀 破军'.split(' ');
  const rows = names.flatMap((name, index) => [fixture('guard-' + index, '无宫职篇题', [name + '守卯位或酉位命宫']),
    fixture('together-' + index, '无宫职篇题', [name + '同守卯位或酉位命宫'])]);
  // 同守 with one star is also accepted by the existing placement grammar;
  // its name must still be preserved rather than split into a verb.
  rows.push(fixture('bound', '无宫职篇题', ['本命官禄宫在寅', '七杀与文曲同守']),
    fixture('unbound', '七杀', ['七杀与文曲同守']),
    fixture('two-sites', '无宫职篇题', ['本命官禄宫在寅', '本命夫妻宫在辰', '七杀与文曲同守']),
    fixture('same-twice', '无宫职篇题', ['天同与天同同守']),
    fixture('ambiguous-group', '无宫职篇题', ['天同守卯位或酉位命宫', '会吉星']),
    fixture('unknown-note', '无宫职篇题', ['天哭天虚临本命父母宫', '按本歌核对']));
  for (const [method, claims] of Object.entries({ bazi: [], western: [], ziwei: rows })) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(claims));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const catalog = createClaimsCatalog({ directory: join(directory, 'runtime'), sourceDirectory, includeLegacy: false });
  for (const [index, name] of names.entries()) for (const prefix of ['guard-', 'together-']) {
    const inputs = catalog.get(prefix + index).inputs;
    assert.equal(inputs.length, 2, name);
    assert.deepEqual(inputs.map(input => input.required.find(fact => fact.kind === 'palace_branch').branch).sort(), ['卯', '酉'].sort());
    assert.ok(inputs.every(input => input.required.some(fact => fact.kind === 'palace_star' && fact.star === name)), name);
  }
  assert.equal(catalog.get('bound').inputs.length, 1);
  assert.ok(catalog.get('bound').inputs[0].required.every(fact => fact.palace === '官禄'));
  assert.equal(catalog.get('unbound').inputs.length, 12, 'a star heading does not imply life palace');
  for (const id of ['two-sites', 'same-twice', 'ambiguous-group', 'unknown-note']) assert.equal(catalog.get(id).inputs, undefined, id);
});

test('source JSON and audit retain original wording, exact note scope and unresolved source semantics', context => {
  const { catalog } = setup(context);
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
  const original = new Map(JSON.parse(readFileSync(new URL('./claims/ziwei.json', import.meta.url))).map(claim => [claim.id, claim]));
  const mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  const pending = pendingClaimConditions({ catalog });
  for (const { id } of batch.changes) {
    assert.deepEqual(catalog.get(id).claim, original.get(id), id);
    assert.equal(pending.some(row => row.id === id), false);
  }
  for (const [id, text] of [['ziwei-v2-fuqigong-p009-001', '依原句男女命均论'], ['ziwei-v1-zhuxing-wenda-p182000-001', '按本歌核对']]) {
    assert.equal(mappings.get(id).sourceConditions.find(row => row.text === text).status, 'editorial_note');
  }
  const deferred = pending.find(row => row.id === 'ziwei-v2-c003-p101011-001');
  assert.ok(deferred);
  assert.match(deferred.reviewNote, /明度/u);
  assert.equal(catalog.get(deferred.id).inputs, undefined);
  assert.deepEqual(catalog.get(deferred.id).claim, original.get(deferred.id));
});
