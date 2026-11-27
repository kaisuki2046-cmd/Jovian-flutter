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

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-gujichengge-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const prefix = 'ziwei-v1-xingjue-021-';
const fixtures = [
  [[1924, 2, 15, 10], 'p110-001/0'],
  [[1924, 4, 22, 7], 'p971-001/0'],
  [[1924, 4, 22, 8], 'p118-001/0'],
  [[1925, 2, 8, 10], 'p113-001/0'],
  [[1925, 11, 15, 8], 'p972-001/0'],
  [[1927, 7, 8, 1], 'p120-001/0'],
  [[1927, 12, 15, 10], 'p111-001/0', 'p111-001/1'],
  [[1933, 3, 27, 4], 'p115-001/0', 'p115-001/2', 'p115-001/3'],
  [[1933, 4, 9, 4], 'p115-001/1'],
];

function nativeFacts([year, month, day, hour]) {
  return chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender: 'male' }, hour));
}

function query(confirmedFacts) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown: true });
  assert.ok(queries);
  const [entry] = queries;
  return { queries, context: chartContext('ziwei', entry.confirmedFacts, entry.confirmedAbsentFacts, entry.chartScope) };
}

const proof = (key, facts) => explainClaim(prefix + key, 'ziwei', query(facts).context, undefined, catalog);

test('each reviewed source passage has a native chart, SQLite evidence and report text', () => {
  const records = new Set(fixtures.flatMap(([, ...keys]) => keys.map(key => key.split('/')[0])));
  const expected = new Map();
  const states = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  for (const key of records) {
    assert.equal(states.get(prefix + key), 'branch_indexed', key);
    catalog.get(prefix + key).branches.forEach(({ text, inputs, conditionCompiler }, index) => {
      assert.equal(conditionCompiler, xingjuePalaceConfigurationProfile);
      assert.equal(inputs.length, 1, key);
      expected.set(`${key}/${index}`, { text, input: inputs[0] });
    });
  }
  const checked = new Set();
  for (const [birth, ...passages] of fixtures) {
    const facts = nativeFacts(birth);
    const { context, queries } = query(facts);
    const derived = claimChartContext('ziwei', context);
    const results = lookup(queries).flatMap(ref => [...ref.events, ...ref.personality]);
    for (const passage of passages) {
      const { text, input } = expected.get(passage);
      const id = prefix + passage.split('/')[0];
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, passage);
      const hit = results.find(row => row.id === id);
      const explanation = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explanation.matched, passage);
      assert.deepEqual(hit.matchedBranches, explanation.matchedBranches, passage);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), passage);
      const materials = buildReportMaterials([{ topic: hit.topic, events: [hit], personality: [] }]);
      assert.ok(materials.includes(text), passage);
      assert.doesNotMatch(materials, /日月兩貴夾者富貴|食祿萬鐘|故子孫繁盛多貴|寅子辰三奇會者|日月羊火合/u, passage);
      checked.add(passage);
    }
  }
  assert.deepEqual([records.size, expected.size, fixtures.length], [8, 12, 9]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('conjunctions require confirmed natal carriers and compare the specific chart palace', () => {
  const jiLiang = nativeFacts([1925, 2, 8, 10]);
  assert.equal(proof('p113-001', jiLiang).matched, true);
  assert.equal(proof('p113-001', jiLiang.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '天梁')).matched, false);

  const ziLife = nativeFacts([1933, 4, 9, 4]);
  const withoutSeal = ziLife.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '迁移' || fact.star !== '封诰');
  const oppositeText = '午遷七殺左輔文昌八座封誥';
  assert.ok(proof('p115-001', ziLife).matchedBranches.some(branch => branch.text === oppositeText));
  const remaining = proof('p115-001', withoutSeal).matchedBranches;
  assert.ok(remaining.some(branch => branch.text === '子命武府祿存同官'));
  assert.ok(remaining.every(branch => branch.text !== oppositeText));
});
