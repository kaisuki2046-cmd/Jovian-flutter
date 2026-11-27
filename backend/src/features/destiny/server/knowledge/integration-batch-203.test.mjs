import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-palace-chapters-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const samples = [
  ['050-p639', 1940, 2, 1, 0, null],
  ['056-p1572', 1931, 1, 1, 1, '田財宮武曲權火同居、長生來照'],
  ['056-p1572', 1930, 10, 1, 2, '田財宮武曲權火同居、長生來照'],
  ['056-p1573', 1934, 4, 8, 5, null],
  ['056-p1575', 1937, 12, 8, 8, '未田羊刧刑得日月化祿朝、正祿合者、反自田宅'],
  ['057-p1598', 1940, 7, 22, 3, '無會若福宮居子午遇破軍則化福勝貴'],
  ['057-p1598', 1941, 10, 22, 0, '無會若福宮居子午遇破軍則化福勝貴'],
  ['057-p1634', 1940, 7, 22, 11, '福宮紫相與壽星合者、雖有刑姚等惡星、能享壽福'],
];
const idFor = record => `ziwei-v3-xingjue-${record}-001`;
const native = ([, year, month, day, hour]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: 'female' }, hour));
const sampleFor = record => samples.find(([candidate]) => candidate === record);

function context(confirmedFacts, confirmedAbsentFacts) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts, confirmedAbsentFacts,
  }]);
  assert.ok(queries);
  const [query] = queries;
  const plain = chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
  return { queries, plain };
}

function explain(record, facts) {
  return explainClaim(idFor(record), 'ziwei', context(facts).plain, undefined, catalog);
}

test('six sources and all eight rule groups match from native charts through SQLite and report materials', () => {
  const proven = new Set();
  for (const sample of samples) {
    const [record, , , , , text] = sample, id = idFor(record);
    const { queries, plain } = context(native(sample));
    const detail = explainClaim(id, 'ziwei', plain, undefined, catalog);
    assert.ok(detail.matched, JSON.stringify(sample));
    const hit = lookup(queries).flatMap(topic => [...topic.personality, ...topic.events]).find(rule => rule.id === id);
    assert.ok(hit, record);
    const original = catalog.get(id).claim.evidence.original_text;
    const materials = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(materials.includes(text ?? original), record);
    if (text) {
      assert.deepEqual(detail.matchedBranches.map(branch => branch.text), [text]);
      assert.deepEqual(hit.matchedBranches, detail.matchedBranches, record);
      assert.ok(!materials.includes('现代释义：'), record);
      if (original !== text) assert.ok(!materials.includes(original), record);
    } else {
      assert.ok(catalog.get(id).inputs.length === 1, record);
    }
    const facts = (detail.matchedBranches?.[0]?.matchedConditions ?? detail.matchedConditions)?.required;
    assert.ok(facts?.length, record);
    proven.add(JSON.stringify([record, facts]));
  }
  assert.equal(proven.size, samples.length);
  for (const [record, expected] of [['056-p1572', 2], ['056-p1575', 1], ['057-p1598', 2], ['057-p1634', 1]]) {
    assert.equal(catalog.get(idFor(record)).branches[0].inputs.length, expected);
  }
});

test('unknown trine roster and a genuine support star must not satisfy the no-help clause', () => {
  const positive = native(sampleFor('057-p1598'));
  const incomplete = positive.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '夫妻');
  assert.equal(explain('057-p1598', incomplete).matched, false);
  const id = idFor('057-p1598');
  const absentClaim = catalog.get(id).branches[0].inputs[0].mustBeAbsent;
  const { plain } = context(incomplete, absentClaim);
  assert.equal(explainClaim(id, 'ziwei', plain, undefined, catalog).matched, false);
  const missingRelation = positive.filter(fact => fact.kind !== 'palace_relation' || fact.anchor !== '福德' || fact.target !== '迁移');
  assert.equal(explain('057-p1598', missingRelation).matched, false);

  const supported = native(['057-p1598', 1940, 7, 9, 9]);
  assert.ok(supported.some(fact => fact.kind === 'palace_star' && ['夫妻', '迁移'].includes(fact.palace) && fact.star === '禄存'));
  assert.equal(explain('057-p1598', supported).matched, false);
});

test('wrong palace, missing transformation carrier, and missing external star suppress the corresponding passage', () => {
  for (const [record, criterion] of [
    ['050-p639', fact => fact.kind === 'palace_relation' && fact.anchor === '子女' && fact.target === '田宅'],
    ['056-p1572', fact => fact.kind === 'star_mutagen' && fact.star === '武曲' && fact.change === '权'],
    ['056-p1573', fact => fact.kind === 'palace_relation' && fact.anchor === '田宅' && fact.target === '子女'],
    ['056-p1575', fact => fact.kind === 'star_mutagen' && fact.star === '太阴' && fact.change === '禄'],
    ['057-p1634', fact => fact.kind === 'palace_star' && fact.star === '天姚'],
  ]) {
    const facts = native(sampleFor(record));
    assert.ok(facts.some(criterion), record);
    assert.equal(explain(record, facts.filter(fact => !criterion(fact))).matched, false, record);
  }
});
