import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileXingjueNatalStars } from './xingjue-natal-stars.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-women-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const witnesses = JSON.parse(readFileSync(new URL('./claims/integration-batch-200-witnesses.json', import.meta.url)));
const idFor = record => `ziwei-v3-xingjue-059-${record}`;
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const witnessFor = record => witnesses.find(sample => sample.record === record);
const byGroup = new Set(['p780-001', 'p1674-001', 'p1683-001']);

function request(confirmedFacts) {
  const queries = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }]);
  assert.ok(queries);
  const [query] = queries;
  return { queries, plain: chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}

function explain(record, facts) {
  return explainClaim(idFor(record), 'ziwei', request(facts).plain, undefined, catalog);
}

test('twelve chapter sources cover every verified condition group and alternative in real charts', () => {
  const records = new Set(witnesses.map(sample => sample.record));
  const confirmed = new Set(), expected = new Set();
  let whole = 0, groupsCount = 0;
  for (const record of records) {
    const id = idFor(record), row = catalog.get(id);
    if (row.inputs) whole++;
    const passages = row.inputs ? [{ inputs: row.inputs }] : row.branches;
    passages.forEach(({ inputs }, branch) => inputs.forEach((input, group) => {
      groupsCount++;
      const alternatives = byGroup.has(record) ? input.anyOf : [undefined];
      alternatives.forEach((_, alternative) => expected.add(JSON.stringify([id, branch, group, alternative])));
    }));
    const mutated = structuredClone(row.claim);
    mutated.evidence.context = '未核异本';
    assert.equal(compileXingjueNatalStars(mutated).reason, 'source_review_required', record);
  }
  assert.deepEqual([records.size, whole, groupsCount, expected.size, witnesses.length], [12, 4, 37, 41, 41]);

  for (const sample of witnesses) {
    const { record, branch, group, alternative } = sample;
    const id = idFor(record), row = catalog.get(id);
    const passage = row.inputs ? row : row.branches[branch];
    const input = passage.inputs[group];
    const condition = byGroup.has(record) ? { ...input, anyOf: [input.anyOf[alternative]] } : input;
    const { queries, plain } = request(native(sample));
    assert.ok(evaluateRule(condition, 'natal', claimChartContext('ziwei', plain)).matched, JSON.stringify(sample));
    const detail = explainClaim(id, 'ziwei', plain, undefined, catalog);
    const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).find(rule => rule.id === id);
    assert.ok(hit && detail.matched, record);
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    const original = row.claim.evidence.original_text;
    assert.ok(materials.includes(passage.text ?? original), record);
    if (passage.text) {
      assert.ok(hit.matchedBranches.some(item => item.text === passage.text), record);
      assert.deepEqual(hit.matchedBranches, detail.matchedBranches, record);
      assert.ok(!materials.includes('现代释义：'), record);
      if (passage.text !== original) assert.ok(!materials.includes(original), record);
    }
    confirmed.add(JSON.stringify([id, branch, group, alternative]));
  }
  assert.deepEqual(confirmed, expected);
});

test('women-specific passages need sex evidence while the explicit both-sex passage matches men', () => {
  for (const record of ['p787-001', 'p789-001', 'p1674-001']) {
    const sample = witnessFor(record);
    assert.equal(explain(record, native(sample).filter(fact => fact.kind !== 'natal_gender')).matched, false, record);
    const male = { ...sample, profile: { ...sample.profile, gender: 'male' } };
    assert.equal(explain(record, native(male)).matched, false, record);
  }
  const both = witnessFor('p1683-001');
  const men = native({ ...both, profile: { ...both.profile, gender: 'male' } });
  const result = explain(both.record, men);
  assert.ok(result.matched);
  assert.equal(result.matchedBranches.length, 1);
  assert.ok(result.matchedBranches[0].text.includes('不論男女'));
});

test('the named Giant Gate condition takes precedence over the generic void placement', () => {
  const sample = { profile: { date: { year: 1940, month: 11, day: 1 }, gender: 'female' }, timeIndex: 5 };
  const result = explain('p785-001', native(sample));
  assert.deepEqual(result.matchedBranches.map(({ text }) => text), ['巨刧迭守身命險艱']);
  const quietVoids = witnesses.find(witness => witness.record === 'p785-001' && witness.branch === 0);
  assert.deepEqual(explain('p785-001', native(quietVoids)).matchedBranches.map(({ text }) => text),
    ['空刧雖迭守身命不妨']);
});

test('missing palace relations and the right assistant prevent matches', () => {
  for (const [record, criterion] of [
    ['p783-001', fact => fact.kind === 'palace_relation' && fact.anchor === '夫妻' && fact.target === '福德'],
    ['p1672-001', fact => fact.kind === 'palace_relation' && fact.anchor === '命宫' && fact.target === '迁移'],
    ['p1674-001', fact => fact.kind === 'palace_relation' && fact.anchor === '财帛' && fact.target === '子女'],
    ['p787-001', fact => fact.kind === 'palace_star' && fact.palace === '夫妻' && fact.star === '右弼'],
  ]) {
    const facts = native(witnessFor(record));
    assert.ok(facts.some(criterion), record);
    assert.equal(explain(record, facts.filter(fact => !criterion(fact))).matched, false, record);
  }
});
