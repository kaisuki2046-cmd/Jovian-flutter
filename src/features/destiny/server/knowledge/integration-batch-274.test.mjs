import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { xingjuePalaceConfigurationProfile } from './xingjue-palace-configurations.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-three-stars-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v2-xingjue-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 1, 1, 8, 'female'], '015-p1116/0/0'],
  [[1924, 1, 1, 9, 'female'], '015-p349/1/3'],
  [[1924, 1, 1, 11, 'female'], '012-p322/0/0'],
  [[1924, 1, 8, 5, 'female'], '015-p349/0/0'],
  [[1924, 1, 8, 6, 'female'], '012-p322/0/1'],
  [[1924, 1, 22, 6, 'female'], '015-p348/0/1', '015-p349/1/0', '015-p356/0/0'],
  [[1924, 2, 8, 4, 'female'], '015-p349/1/2', '015-p1116/0/1'],
  [[1924, 2, 8, 7, 'female'], '012-p1092/0/1', '015-p349/1/5'],
  [[1924, 2, 15, 2, 'female'], '012-p328/1/0', '012-p330/0/0', '012-p1094/0/0', '015-p349/1/4'],
  [[1924, 2, 15, 5, 'female'], '015-p349/1/1'],
  [[1924, 3, 8, 11, 'female'], '012-p1092/0/2'],
  [[1924, 4, 1, 1, 'female'], '016-p1119/0/0'],
  [[1924, 4, 22, 7, 'female'], '016-p363/0/1'],
  [[1924, 5, 8, 8, 'female'], '012-p1092/0/3'],
  [[1924, 6, 8, 0, 'female'], '012-p328/1/1'],
  [[1924, 6, 15, 8, 'female'], '012-p321/0/1'],
  [[1924, 8, 15, 8, 'female'], '012-p1092/0/0'],
  [[1924, 9, 1, 6, 'female'], '016-p363/0/0'],
  [[1924, 10, 1, 6, 'female'], '012-p321/1/0'],
  [[1924, 10, 8, 3, 'female'], '015-p358/0/0'],
  [[1924, 10, 8, 10, 'female'], '012-p326/0/0'],
  [[1924, 12, 22, 0, 'female'], '016-p371/0/0'],
  [[1924, 12, 22, 5, 'female'], '012-p321/0/3'],
  [[1926, 1, 22, 7, 'female'], '015-p1111/0/0'],
  [[1926, 3, 1, 7, 'female'], '015-p356/1/0'],
  [[1926, 6, 1, 7, 'female'], '012-p321/1/1'],
  [[1926, 7, 8, 9, 'female'], '016-p372/0/0'],
  [[1927, 4, 15, 3, 'female'], '012-p321/1/2'],
  [[1927, 4, 22, 9, 'female'], '012-p321/1/3'],
  [[1927, 9, 8, 9, 'female'], '016-p1119/0/4'],
  [[1928, 1, 8, 0, 'female'], '015-p348/0/0'],
  [[1928, 4, 22, 3, 'female'], '016-p366/0/0'],
  [[1928, 5, 8, 10, 'female'], '012-p328/0/1'],
  [[1928, 6, 22, 2, 'female'], '012-p321/0/0'],
  [[1928, 7, 1, 0, 'female'], '016-p371/0/1'],
  [[1928, 7, 1, 8, 'female'], '012-p325/0/1', '012-p325/0/2'],
  [[1929, 1, 8, 6, 'female'], '016-p1119/0/1'],
  [[1929, 2, 1, 6, 'female'], '016-p365/0/0'],
  [[1929, 2, 8, 9, 'female'], '015-p1109/0/0'],
  [[1929, 2, 15, 5, 'female'], '016-p1121/0/1'],
  [[1929, 2, 22, 11, 'female'], '016-p1121/0/0'],
  [[1929, 3, 8, 5, 'female'], '016-p1122/0/4'],
  [[1929, 3, 8, 6, 'female'], '016-p1122/0/5'],
  [[1929, 5, 8, 0, 'female'], '016-p1121/0/2'],
  [[1929, 9, 1, 10, 'female'], '016-p1119/0/3'],
  [[1929, 11, 8, 10, 'female'], '012-p321/0/2'],
  [[1930, 5, 8, 10, 'female'], '016-p367/0/0'],
  [[1932, 10, 22, 4, 'female'], '012-p326/0/1'],
  [[1933, 4, 1, 6, 'female'], '016-p1121/0/3'],
  [[1938, 1, 15, 2, 'female'], '016-p1122/0/0'],
  [[1938, 1, 15, 3, 'female'], '016-p1122/0/1'],
  [[1938, 1, 15, 10, 'female'], '016-p1122/0/2'],
  [[1938, 1, 15, 11, 'female'], '016-p1122/0/3'],
  [[1938, 4, 15, 6, 'female'], '012-p325/0/0'],
  [[1938, 9, 8, 10, 'female'], '012-p325/0/3'],
  [[1939, 2, 1, 5, 'female'], '016-p1119/0/2'],
  [[1939, 6, 8, 1, 'female'], '016-p1119/0/5'],
  [[1939, 9, 22, 9, 'female'], '012-p328/0/0'],
];

const factsFor = ([year, month, day, hour, gender]) =>
  chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
const native = key => factsFor(witnesses.find(([, ...cases]) => cases.includes(key))[0]);

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const explain = (key, facts, timeKnown) => explainClaim(claimId(key), 'ziwei',
  query(facts, timeKnown).context, '紫微星诀', catalog);
const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);

test('each reviewed natal placement reaches SQLite and the default report', () => {
  const records = new Set(witnesses.flatMap(([, ...cases]) => cases.map(key => key.split('/')[0])));
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Map();
  for (const key of records) {
    assert.equal(states.get(claimId(key)), 'branch_indexed', key);
    catalog.get(claimId(key)).branches.forEach(({ text, inputs, conditionCompiler }, index) => {
      assert.equal(conditionCompiler, xingjuePalaceConfigurationProfile);
      inputs.forEach((input, alternative) => expected.set(`${key}/${index}/${alternative}`, { text, input }));
    });
  }
  const checked = new Set();
  for (const [birth, ...cases] of witnesses) {
    const { queries, context } = query(factsFor(birth)), derived = claimChartContext('ziwei', context);
    const results = hits(lookup(queries));
    for (const condition of cases) {
      const key = condition.split('/')[0], { text, input } = expected.get(condition);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, condition);
      const hit = results.find(row => row.id === claimId(key));
      const proof = explainClaim(claimId(key), 'ziwei', context, undefined, catalog);
      assert.ok(hit && proof.matched, condition);
      assert.deepEqual(hit.matchedBranches, proof.matchedBranches, condition);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text), condition);
      assert.doesNotMatch(material, /夭折|必夭|飄落他鄉|富貴|不貴|為將相|發達|晚發/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [24, 66, 58]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('the Fire star must occupy the source palace for each type of meeting', () => {
  const opposite = native('012-p328/0/0');
  const moveFire = opposite.map(fact => fact.kind === 'palace_star' && fact.star === '火星'
    ? { ...fact, palace: '父母' } : fact);
  assert.equal(explain('012-p328', moveFire).matched, false);
  const career = native('012-p1094/0/0');
  const otherTrine = career.map(fact => fact.kind === 'palace_star' && fact.star === '火星'
    ? { ...fact, palace: '财帛' } : fact);
  assert.equal(explain('012-p1094', otherTrine).matched, false);
  assert.ok(explain('012-p328', otherTrine).matchedBranches.some(branch => branch.text === '拱朝'));
});

test('the Xu palace Lu requires Tanlang as the actual natal carrier and a trine witness', () => {
  const facts = native('012-p325/0/1');
  assert.equal(explain('012-p325', facts).matched, true);
  const incorrect = facts.map(fact => fact.kind === 'star_mutagen' && fact.change === '禄'
    ? { ...fact, star: '天机' } : fact);
  assert.equal(explain('012-p325', incorrect).matched, false);
  const missingTrine = facts.filter(fact => !(fact.anchor === '命宫' && fact.relation === 'trine'));
  assert.equal(explain('012-p325', missingTrine).matched, false);
});

test('the Body palace and the single major star are independently verified', () => {
  const body = native('015-p1116/0/0');
  assert.equal(explain('015-p1116', body).matched, true);
  assert.equal(explain('015-p1116', body.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
  const solo = native('016-p1119/0/0');
  assert.equal(explain('016-p1119', solo).matched, true);
  const partial = solo.filter(fact => !(fact.palace === '官禄' && fact.kind === 'palace_origin_star_count'));
  assert.equal(explain('016-p1119', partial).matched, false);
});

test('the metal bureau and the actual You birth hour are required where named', () => {
  const gold = native('016-p1122/0/0');
  const earth = gold.map(fact => fact.kind === 'natal_ziwei_bureau' ? { ...fact, bureau: '土五局' } : fact);
  assert.equal(explain('016-p1122', earth).matched, false);
  const bornYou = native('016-p372/0/0');
  assert.equal(explain('016-p372', bornYou, false).matched, false);
  const missingYou = bornYou.filter(fact => fact.kind !== 'natal_ziwei_hour');
  assert.equal(explain('016-p372', missingYou).matched, false);
});
