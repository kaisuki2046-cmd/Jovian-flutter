import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateBaZi, describeBaZiPillars, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { claimChartContext, createClaimsCatalog, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { assertCurrentClaimSourceDigests } from './testing/claim-source-digests.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-17-20261118.json', import.meta.url)));
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts });
const observed = pillars => chartFacts.bazi(describeBaZiPillars(pillars));
function temporary(context, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + prefix));
    rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}
function setup(context) {
  const directory = temporary(context, 'destiny-batch-seventeen-');
  return { catalog: catalogForDirectory(directory), report: createReportLookup(directory),
    matches: (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id) };
}

test('all 29 explicit Lu, source-specific virtue and ten-god alternatives reach SQL, explanation and reports from real calculated births', context => {
  const { catalog, report, matches } = setup(context);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-17-witnesses.json', import.meta.url)));
  assert.equal(batch.changes.length, 4);
  assert.equal(batch.uniqueAlternatives, 29);
  assert.equal(witnesses.targetAlternatives, 29);
  assert.equal(witnesses.profile, batch.profile);
  assert.deepEqual(witnesses.missing, []);
  const seen = new Set();
  for (const witness of witnesses.witnesses) {
    assert.equal(Date.parse(witness.localDate) - Date.parse(witness.date), witness.timezoneOffsetHours * 3600000);
    const facts = [...chartFacts.bazi(calculateBaZi(Date.parse(witness.date), Date.parse(witness.localDate))),
      { kind: 'natal_gender', gender: witness.gender }];
    const parsed = parseChartQueries([query(facts)]);
    assert.ok(parsed);
    const chart = claimChartContext('bazi', chartContext('bazi', parsed[0].confirmedFacts, [], 'natal'));
    const material = buildReportMaterials(report(parsed));
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id);
      const input = row.inputs.find(input => digest(input) === proof.inputDigest);
      assert.ok(input, proof.id + ': exact input digest');
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, proof.id);
      assert.ok(matches(proof.id, facts), proof.id + ': SQLite');
      const explanation = explainClaim(proof.id, 'bazi', chartContext('bazi', facts, [], 'natal'), undefined, catalog);
      assert.equal(explanation.matched, true);
      assert.ok(material.includes(row.claim.evidence.original_text), proof.id + ': source');
      if (['yhzp-v2-c002-p037-001', 'yhzp-v2-c002-p070-001'].includes(proof.id)) assert.match(explanation.calculationNote, /项目月令加权模型/u);
      if (proof.id === 'yhzp-v3-c031-p002-101') {
        assert.match(explanation.calculationNote, /天德或月德至少一项/u);
        assert.match(material, /原资料异文说明不删除/u);
      }
      for (const limit of row.claim.interpretation.limitations) assert.ok(material.includes(limit));
      seen.add(proof.id + ':' + proof.inputDigest);
    }
  }
  assert.deepEqual([...seen].sort(), batch.changes.flatMap(row => row.inputDigests.map(hash => row.id + ':' + hash)).sort());
});

test('the source-specific one-virtue reading permits either virtue while retaining gender, seal and trusted calculation requirements', context => {
  const { matches } = setup(context);
  const id = 'yhzp-v3-c031-p002-101';
  // Legal-pillar synthetic fixtures isolate the existing virtue table; the
  // separate witness test supplies actual calendar dates for every rule.
  const fixtures = [
    [{ year: '甲子', month: '丙寅', day: '甲子', hour: '丁卯' }, true],
    [{ year: '甲子', month: '丙寅', day: '甲子', hour: '戊辰' }, true],
    [{ year: '乙丑', month: '戊寅', day: '甲子', hour: '丁卯' }, true],
    [{ year: '乙丑', month: '戊寅', day: '甲子', hour: '戊辰' }, false],
    [{ year: '甲申', month: '丁卯', day: '甲子', hour: '丙寅' }, true],
    [{ year: '庚申', month: '己卯', day: '丙子', hour: '庚寅' }, true],
  ];
  const aggregate = { kind: 'bazi_natal_configuration', name: '天月德至少一项' };
  for (const [pillars, expected] of fixtures) {
    const facts = [...observed(pillars), { kind: 'natal_gender', gender: '女' }];
    assert.equal(matches(id, facts), expected, JSON.stringify(pillars));
    const forged = [...facts.filter(fact => fact.kind !== 'shen_sha' || !['天德', '月德'].includes(fact.name)), aggregate,
      { kind: 'shen_sha', position: 'hour', name: '天德' }, { kind: 'shen_sha', position: 'year', name: '月德' }];
    assert.equal(matches(id, forged), expected, 'raw aggregates and virtue flags cannot override recalculation');
    const [unknown] = parseChartQueries([query(facts)], { timeKnown: false });
    assert.equal(matches(id, unknown.confirmedFacts), false, 'this aggregate currently requires four confirmed pillars');
    assert.equal(matches(id, facts.filter(fact => fact.kind !== 'natal_gender')), false, 'gender is not editorial');
    assert.equal(matches(id, facts.map(fact => fact.kind === 'natal_gender' ? { ...fact, gender: '男' } : fact)), false, 'male chart');
    assert.equal(matches(id, facts.filter(fact => !['stem_ten_god', 'branch_ten_god'].includes(fact.kind))), false, 'seal occurrence remains necessary');
  }
  assert.equal(matches(id, [aggregate]), false);
  assert.equal(matches(id, []), false);
  const onlyOne = [...observed({ year: '甲子', month: '丙寅', day: '甲子', hour: '戊辰' }), { kind: 'natal_gender', gender: '女' }];
  assert.equal(matches('yhzp-v2-c002-p118-102', onlyOne), false, 'another chapter explicitly requiring both virtues is not relaxed');
});

test('Lu is tied to the hour, absent officer requires hidden as well as shown evidence, and strength is recalculated', context => {
  const { matches } = setup(context);
  const lu = 'yhzp-v1-c351-p010-001';
  const clean = observed({ year: '甲子', month: '丙寅', day: '甲子', hour: '丁卯' });
  // 甲禄在寅: the month cannot substitute for an hour at 卯.
  assert.equal(matches(lu, clean), false);
  assert.equal(matches(lu, observed({ year: '甲子', month: '丙寅', day: '甲子', hour: '丙寅' })), true);
  assert.equal(matches(lu, observed({ year: '辛酉', month: '庚寅', day: '甲子', hour: '丙寅' })), false, 'visible officer');
  assert.equal(matches(lu, observed({ year: '己丑', month: '丙寅', day: '甲子', hour: '丙寅' })), false, '辛 officer concealed in 丑');
  const timeMissing = clean.filter(fact => fact.position !== 'hour');
  assert.equal(matches(lu, timeMissing), false);
  const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-17-witnesses.json', import.meta.url)));
  for (const id of ['yhzp-v2-c002-p037-001', 'yhzp-v2-c002-p070-001']) {
    const witness = witnesses.witnesses.find(row => row.ids.includes(id));
    const facts = chartFacts.bazi(calculateBaZi(Date.parse(witness.date), Date.parse(witness.localDate)));
    const chart = claimChartContext('bazi', chartContext('bazi', facts));
    assert.ok(chart.present.some(fact => fact.kind === 'day_master_strength' && fact.result === '偏弱'));
    assert.ok(matches(id, [...facts.filter(fact => fact.kind !== 'day_master_strength'),
      { kind: 'day_master_strength', result: '偏强', profile: 'monthly-weighted-strength-v1' }]));
    assert.equal(matches(id, [{ kind: 'day_master_strength', result: '偏弱', profile: 'monthly-weighted-strength-v1' },
      { kind: 'stem_ten_god', position: 'year', tenGod: id.includes('p037') ? '七杀' : '正官' }]), false);
  }
});

test('explicit occurrence does not resolve undefined control, comparisons, structures or multiplicity and source files remain intact', context => {
  const directory = temporary(context, 'destiny-occurrence-');
  const sourceDirectory = join(directory, 'sources');
  mkdirSync(sourceDirectory);
  const fixture = (id, normalized) => ({ id, title: '合成条件测试', category: { topic: '综合', type: '性格', tags: [] },
    source: { book: '测试资料', author: '测试', edition: '1', volume: '一', chapter: '测试', section: null, passage_id: id, url: 'https://example.test/fixture' },
    evidence: { original_text: '只测试解析，不是古籍命理断语', context: null },
    conditions: { original: normalized, normalized, uncertain: [], excluded: [] },
    interpretation: { classical_meaning: '仅测试', limitations: ['合成资料'] } });
  const rows = [fixture('occurrence', ['原局见七杀']), fixture('sealed', ['原局印绶且有天德、月德相助']),
    fixture('control', ['原局见七杀且制伏得宜']), fixture('relative', ['日主强、七杀较浅而可驾驭']),
    fixture('structure', ['原局印绶且入格']), fixture('repeated', ['原局七杀恰两位且无制']),
    fixture('not-defined', ['天德或月德强旺相助'])];
  const originalVariant = JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url)))
    .find(claim => claim.id === 'yhzp-v3-c031-p002-101');
  rows.push({ ...originalVariant, conditions: { ...originalVariant.conditions,
    normalized: [...originalVariant.conditions.normalized, '还须制化得宜'] } });
  for (const [method, claims] of Object.entries({ bazi: rows, ziwei: [], western: [] })) writeFileSync(join(sourceDirectory, method + '.json'), JSON.stringify(claims));
  writeFileSync(join(sourceDirectory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const isolated = createClaimsCatalog({ directory: join(directory, 'runtime'), sourceDirectory, includeLegacy: false });
  assert.equal(isolated.get('occurrence').inputs.length, 7);
  assert.equal(isolated.get('sealed').inputs, undefined, 'unspecified one-or-both scope stays unresolved');
  for (const input of isolated.get('occurrence').inputs) assert.ok(input.required.every(fact => fact.kind !== 'stem_ten_god' || fact.position !== 'day'));
  for (const id of ['control', 'relative', 'structure', 'repeated', 'not-defined']) assert.equal(isolated.get(id).inputs, undefined, id);
  assert.equal(isolated.get(originalVariant.id).inputs, undefined, 'source-specific resolution cannot swallow a new prerequisite');
  const { catalog } = setup(context);
  const originals = new Map(JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url))).map(claim => [claim.id, claim]));
  const pending = pendingClaimConditions({ catalog });
  for (const { id } of batch.changes) { assert.deepEqual(catalog.get(id).claim, originals.get(id)); assert.equal(pending.some(row => row.id === id), false); }
  const source = catalog.get('yhzp-v3-c031-p002-101').claim;
  assert.equal(source.conditions.uncertain.length, 1, 'the edition variation note is preserved');
  const mapping = [...structuredClaimMappings(catalog)].find(row => row.id === source.id);
  assert.equal(mapping.conditionCompiler, 'yhzp-v3-one-virtue-v1');
  assert.equal(mapping.sourceConditions[0].status, 'compiled_source_expression');
  const reviewedDeferred = new Map([
    ['yhzp-v2-c002-p077-001', '天德月德俱见且印星实见'],
    ['yhzp-v2-c002-p118-101', '原局天德及月德俱见'],
  ]);
  for (const id of batch.deferred) {
    const row = catalog.get(id);
    assert.deepEqual(row.claim, originals.get(id), id);
    if (reviewedDeferred.has(id)) {
      assert.equal(row.compiler, 'bazi-yuanhai-ziping-structures-v1', id);
      assert.deepEqual(row.inputs.map(({ required }) => required),
        [[{ kind: 'bazi_natal_configuration', name: reviewedDeferred.get(id) }]], id);
      assert.ok(!pending.some(item => item.id === id), id);
    } else {
      assert.ok(pending.find(item => item.id === id)?.reviewNote, id);
      assert.equal(row.inputs, undefined, id);
    }
  }
  assertCurrentClaimSourceDigests(Object.keys(batch.sourceHashes));
});
