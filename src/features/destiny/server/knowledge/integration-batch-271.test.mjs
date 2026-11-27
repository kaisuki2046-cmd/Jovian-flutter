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

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-child-fude-parents-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v3-xingjue-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 1, 8, 5, 'female'], '050-p1380/0/6'],
  [[1924, 1, 8, 9, 'female'], '050-p637/0/0'],
  [[1924, 1, 8, 10, 'male'], '050-p1379/0/0'],
  [[1924, 2, 8, 0, 'female'], '050-p1379/0/1'],
  [[1924, 2, 8, 7, 'male'], '050-p1380/0/7'],
  [[1924, 4, 8, 5, 'male'], '050-p1380/0/10'],
  [[1924, 6, 8, 8, 'female'], '050-p637/0/1'],
  [[1924, 8, 1, 9, 'female'], '057-p1606/0/0'],
  [[1924, 8, 8, 1, 'male'], '050-p1380/0/11'],
  [[1924, 8, 8, 10, 'female'], '050-p1380/0/2'],
  [[1924, 9, 8, 10, 'male'], '050-p1380/0/8'],
  [[1924, 11, 8, 1, 'female'], '050-p1380/0/0', '050-p1380/0/4'],
  [[1925, 1, 8, 4, 'female'], '058-p1655/0/0'],
  [[1925, 2, 8, 4, 'male'], '058-p1655/0/1'],
  [[1925, 3, 8, 1, 'male'], '050-p1380/0/3'],
  [[1925, 6, 8, 1, 'female'], '050-p1380/0/5'],
  [[1925, 6, 8, 4, 'male'], '050-p1380/0/1'],
  [[1925, 7, 8, 4, 'female'], '058-p1655/0/2'],
  [[1925, 9, 8, 10, 'female'], '050-p637/1/1'],
  [[1927, 2, 8, 10, 'male'], '058-p1655/0/3'],
  [[1927, 4, 8, 2, 'male'], '050-p1399/0/0'],
  [[1927, 7, 8, 9, 'male'], '050-p1380/0/9'],
  [[1928, 4, 8, 7, 'male'], '057-p1622/0/1'],
  [[1928, 9, 1, 4, 'female'], '057-p1623/0/0'],
  [[1934, 2, 22, 10, 'female'], '050-p637/1/0'],
  [[1934, 4, 8, 11, 'male'], '058-p1651/0/1'],
  [[1937, 3, 8, 6, 'female'], '057-p1607/0/0'],
  [[1939, 1, 8, 3, 'male'], '057-p1622/0/0'],
  [[1939, 8, 22, 3, 'female'], '057-p1594/0/0'],
  [[1940, 3, 8, 5, 'female'], '057-p1621/0/0'],
  [[1946, 7, 8, 3, 'female'], '058-p1651/0/0'],
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
const excerpts = matched => (matched.matchedBranches ?? []).map(branch => branch.text);
const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);

test('each reviewed palace group reaches SQLite and the default report from a native chart', () => {
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
      assert.doesNotMatch(material, /無子|不得養於家|早夭|福薄|終身不第|必享壽福/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [12, 32, 31]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('the children passage keeps its base when the same-palace natal Ji is absent', () => {
  const facts = native('050-p637/1/0');
  assert.deepEqual(excerpts(explain('050-p637', facts)), ['日月同居子宮', '遇忌姚']);
  const missingJi = facts.filter(fact => !(fact.palace === '子女' && fact.change === '忌'));
  assert.deepEqual(excerpts(explain('050-p637', missingJi)), ['日月同居子宮']);
  assert.equal(explain('050-p637', facts, false).matched, false);
});

test('natal Ji must belong to Tiantong and cannot be assigned to a forged carrier', () => {
  const facts = native('057-p1621/0/0');
  const altered = facts.map(fact => fact.kind === 'star_mutagen' && fact.palace === '福德' && fact.change === '忌'
    ? { ...fact, star: '天梁' } : fact);
  assert.equal(explain('057-p1621', facts).matched, true);
  assert.equal(explain('057-p1621', altered).matched, false);
});

test('opposition and the Suiqian cycle are matched at their source palaces', () => {
  const parents = native('058-p1651/0/0');
  assert.ok(parents.some(fact => fact.kind === 'palace_star' && fact.palace === '疾厄' && fact.star === '太阴'));
  assert.equal(explain('058-p1651', parents.filter(fact => !(fact.palace === '疾厄' && fact.star === '太阴'))).matched, false);
  const nativeCycle = native('058-p1655/0/0');
  assert.equal(explain('058-p1655', nativeCycle).matched, true);
  assert.equal(explain('058-p1655', nativeCycle.filter(fact => !(fact.kind === 'palace_suiqian_star' && fact.palace === '父母'))).matched, false);
});
