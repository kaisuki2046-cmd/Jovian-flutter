import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { calculateBaZi, describeBaZiPillars, chartFacts, chartVersions } from '../../control/charts.ts';
import { catalogForDirectory, lookupInterpretations } from './database.mjs';
import { claimChartContext, explainClaim, pendingClaimConditions, structuredClaimMappings } from './claims.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { buildReportMaterials } from '../report-materials.mjs';

const batch = JSON.parse(readFileSync(new URL('./claims/integration-batch-15-20261118.json', import.meta.url)));
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-15-witnesses.json', import.meta.url)));
const hash = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts });
const observed = pillars => chartFacts.bazi(describeBaZiPillars(pillars));
function setup(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch-fifteen-'));
  context.after(() => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-batch-fifteen-'));
    rmSync(directory, { recursive: true, force: true });
  });
  return { directory, catalog: catalogForDirectory(directory), report: createReportLookup(directory),
    matches: (id, facts) => lookupInterpretations(directory, query(facts)).some(hit => hit.id === id) };
}

test('all 76 new alternatives reach SQL, explanation and report material from actual native birth-date calculations', context => {
  const { directory, catalog, report } = setup(context);
  assert.equal(batch.changes.length, 14);
  assert.equal(batch.uniqueAlternatives, 76);
  assert.equal(witnesses.targetAlternatives, 76);
  assert.deepEqual(witnesses.missing, []);
  const expected = new Set(batch.changes.flatMap(row => row.inputDigests.map(digest => row.id + ':' + digest)));
  const witnessed = new Set();
  const seenIds = new Set();
  for (const witness of witnesses.witnesses) {
    assert.equal(Date.parse(witness.localDate) - Date.parse(witness.date), witness.timezoneOffsetHours * 3600000);
    const raw = [...chartFacts.bazi(calculateBaZi(Date.parse(witness.date), Date.parse(witness.localDate))),
      { kind: 'natal_gender', gender: witness.gender }];
    const parsed = parseChartQueries([query(raw)]);
    assert.ok(parsed);
    const hits = lookupInterpretations(directory, parsed[0]);
    const material = buildReportMaterials(report(parsed));
    const chart = claimChartContext('bazi', chartContext('bazi', parsed[0].confirmedFacts, [], 'natal'));
    for (const proof of witness.proofs) {
      const row = catalog.get(proof.id);
      const input = row.inputs.find(input => hash(input) === proof.inputDigest);
      assert.ok(input, proof.id + ': current input digest');
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, proof.id + ': exact alternative');
      const hit = hits.find(hit => hit.id === proof.id);
      assert.ok(hit, proof.id);
      assert.ok(material.includes(row.claim.evidence.original_text), proof.id);
      assert.equal(explainClaim(proof.id, 'bazi', chartContext('bazi', raw, [], 'natal'), undefined, catalog).matched, true);
      if (row.compiler === 'bazi-literal-dnf-v1') assert.match(hit.calculationNote, /不透与原局完全不见分别处理/u);
      witnessed.add(proof.id + ':' + proof.inputDigest);
      seenIds.add(proof.id);
    }
  }
  assert.deepEqual([...witnessed].sort(), [...expected].sort());
  assert.deepEqual([...seenIds].sort(), batch.changes.map(row => row.id).sort());
});

test('column, gender, clash direction and unknown-hour requirements are retained', context => {
  const { matches } = setup(context);
  const yearOfficerSeal = 'yhzp-v1-c294-p002-001';
  assert.equal(matches(yearOfficerSeal, observed({ year: '辛丑', month: '庚寅', day: '甲子', hour: '甲子' })), true);
  assert.equal(matches(yearOfficerSeal, observed({ year: '辛卯', month: '己亥', day: '甲子', hour: '甲子' })), false, 'year officer cannot borrow the month seal');
  const clash = 'smth-v10-wuxian-p003-502';
  assert.equal(matches(clash, observed({ year: '甲子', month: '丁卯', day: '庚午', hour: '己卯' })), false, 'a year/day clash is not necessarily a month clash');
  assert.equal(matches(clash, observed({ year: '甲子', month: '庚午', day: '庚寅', hour: '己卯' })), true);
  const controlledDay = 'yhzp-v2-c002-p011-101';
  assert.equal(matches(controlledDay, observed({ year: '庚子', month: '戊寅', day: '甲午', hour: '己巳' })), true);
  assert.equal(matches(controlledDay, observed({ year: '甲子', month: '丙寅', day: '庚午', hour: '辛巳' })), false, 'the opposite direction cannot substitute for year stem controlling day stem');
  const sibling = 'yhzp-v3-c031-p002-003';
  const peers = observed({ year: '乙丑', month: '戊寅', day: '甲子', hour: '丙寅' });
  assert.equal(matches(sibling, [...peers, { kind: 'natal_gender', gender: '女' }]), true);
  assert.equal(matches(sibling, [...peers, { kind: 'natal_gender', gender: '男' }]), false);
  assert.equal(matches(sibling, peers), false);
  for (const id of ['yhzp-v2-c279-p002-001', 'qtbj-v2-c005-p004-001', 'qtbj-v2-c008-p007-001', 'qtbj-v2-c010-p004-001']) {
    const witness = witnesses.witnesses.find(row => row.ids.includes(id));
    const facts = chartFacts.bazi(calculateBaZi(Date.parse(witness.date), Date.parse(witness.localDate)));
    const [unknown] = parseChartQueries([query(facts)], { timeKnown: false });
    assert.equal(matches(id, unknown.confirmedFacts), false, id + ': cannot prove hour-dependent presence or absence');
  }
});

test('raw source, complete-expression mapping and unresolved scope notes remain distinct', context => {
  const { catalog, matches } = setup(context);
  const original = JSON.parse(readFileSync(new URL('./claims/bazi.json', import.meta.url)));
  const pending = pendingClaimConditions({ catalog });
  const mappings = new Map([...structuredClaimMappings(catalog)].map(row => [row.id, row]));
  for (const { id } of batch.changes) {
    const row = catalog.get(id);
    assert.deepEqual(row.claim, original.find(source => source.id === id));
    assert.equal(pending.some(item => item.id === id), false, id + ': fully mapped record is not still pending');
    if (row.compiler === 'bazi-literal-dnf-v1') {
      assert.equal(mappings.get(id).conditionCompiler, row.compiler);
      assert.equal(mappings.get(id).sourceConditions[0].status, 'compiled_literal_expression');
      assert.equal(mappings.get(id).sourceConditions[0].alternatives.length, row.inputs.length);
    }
  }
  const deferred = pending.find(row => row.id === 'qtbj-v2-c005-p004-002');
  assert.ok(deferred);
  assert.equal(deferred.status, 'branch_indexed');
  assert.match(deferred.reviewNote, /巳月本已藏庚/u);
  assert.equal(catalog.get(deferred.id).inputs, undefined);
  assert.equal(matches(deferred.id, observed({ year: '丁卯', month: '乙巳', day: '甲午', hour: '丙寅' })), false);
  const dayList = pending.find(row => row.id === 'yhzp-v1-c217-p002-001');
  assert.ok(dayList);
  assert.match(dayList.reviewNote, /乙丑/u);
  assert.equal(catalog.get(dayList.id).inputs, undefined, 'no unsourced replacement of the ten-day list');
});
