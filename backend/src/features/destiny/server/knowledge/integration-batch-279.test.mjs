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

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-flanks-main-stars-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const claimId = key => 'ziwei-v2-xingjue-' + key + '-001';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1924, 1, 1, 0, 'female'], '005-p254/0/0'],
  [[1924, 1, 1, 2, 'female'], '005-p253/0/1', '005-p257/0/8'],
  [[1924, 1, 1, 6, 'female'], '009-p301/0/0'],
  [[1924, 1, 1, 9, 'female'], '008-p856/1/2'],
  [[1924, 1, 1, 10, 'female'], '005-p253/0/0', '005-p257/0/2'],
  [[1924, 2, 1, 1, 'female'], '002-p1055/0/0', '009-p305/0/5'],
  [[1924, 2, 1, 5, 'female'], '002-p236/0/0'],
  [[1924, 2, 1, 6, 'female'], '011-p310/0/0'],
  [[1924, 2, 1, 7, 'female'], '010-p307/0/1'],
  [[1924, 2, 1, 8, 'female'], '010-p308/0/0', '010-p306/1/0'],
  [[1924, 2, 1, 10, 'female'], '005-p254/0/1'],
  [[1924, 3, 1, 0, 'female'], '002-p234/0/0', '011-p311/0/0', '011-p311/0/1'],
  [[1924, 3, 1, 2, 'female'], '005-p257/0/9'],
  [[1924, 3, 1, 8, 'female'], '005-p254/0/2'],
  [[1924, 3, 1, 10, 'female'], '009-p303/0/0'],
  [[1924, 4, 1, 8, 'female'], '002-p1053/0/5'],
  [[1924, 4, 1, 10, 'female'], '005-p257/0/3', '005-p257/0/4', '008-p856/1/0'],
  [[1924, 4, 1, 11, 'female'], '002-p234/0/1', '002-p1055/0/1'],
  [[1924, 5, 1, 10, 'female'], '002-p234/0/2', '002-p1055/0/4'],
  [[1924, 6, 1, 3, 'female'], '002-p235/0/6'],
  [[1924, 6, 1, 9, 'female'], '002-p234/0/3'],
  [[1924, 7, 1, 8, 'female'], '002-p234/0/4'],
  [[1924, 7, 1, 11, 'female'], '008-p856/1/1'],
  [[1924, 7, 8, 2, 'male'], '002-p235/1/2'],
  [[1924, 8, 1, 2, 'female'], '005-p257/0/10'],
  [[1924, 8, 1, 8, 'female'], '002-p1055/0/9'],
  [[1924, 8, 1, 10, 'female'], '002-p233/0/1', '002-p1055/0/8'],
  [[1924, 9, 1, 0, 'female'], '008-p856/0/0'],
  [[1924, 9, 1, 1, 'female'], '009-p305/0/0'],
  [[1924, 9, 1, 10, 'female'], '005-p257/0/0', '005-p257/0/5'],
  [[1924, 9, 1, 11, 'female'], '002-p233/0/0'],
  [[1924, 11, 1, 6, 'female'], '002-p235/0/0'],
  [[1925, 1, 1, 1, 'male'], '002-p234/0/5'],
  [[1925, 2, 1, 2, 'male'], '005-p257/0/11'],
  [[1925, 2, 1, 3, 'male'], '002-p1055/0/7'],
  [[1925, 2, 1, 10, 'male'], '005-p257/0/1'],
  [[1925, 3, 1, 2, 'male'], '005-p257/0/6'],
  [[1925, 3, 1, 7, 'male'], '011-p318/0/1'],
  [[1925, 4, 1, 1, 'male'], '002-p1055/0/11'],
  [[1925, 5, 1, 2, 'male'], '002-p235/0/9'],
  [[1925, 9, 1, 8, 'male'], '011-p318/0/0'],
  [[1925, 10, 1, 8, 'male'], '002-p235/0/1'],
  [[1925, 10, 1, 11, 'male'], '009-p859/0/0'],
  [[1925, 12, 1, 2, 'male'], '005-p255/0/0'],
  [[1925, 12, 1, 8, 'male'], '002-p1053/0/1'],
  [[1926, 1, 22, 3, 'male'], '008-p1076/0/0', '008-p1077/0/0', '008-p1077/0/1'],
  [[1926, 4, 1, 10, 'female'], '002-p235/0/4'],
  [[1926, 5, 1, 2, 'female'], '005-p257/0/7'],
  [[1926, 5, 1, 8, 'female'], '002-p1053/0/6'],
  [[1926, 7, 1, 8, 'female'], '002-p233/1/0'],
  [[1926, 7, 1, 11, 'female'], '002-p230/0/0'],
  [[1926, 9, 1, 9, 'female'], '002-p1055/0/6'],
  [[1926, 11, 1, 0, 'female'], '002-p233/1/2'],
  [[1926, 11, 1, 8, 'female'], '002-p1053/0/0', '002-p1054/0/0'],
  [[1927, 1, 1, 0, 'male'], '010-p307/0/0'],
  [[1927, 5, 1, 2, 'male'], '005-p255/0/1'],
  [[1927, 9, 1, 1, 'male'], '002-p235/0/10'],
  [[1927, 9, 1, 11, 'male'], '002-p1055/0/3'],
  [[1927, 11, 1, 11, 'male'], '002-p232/0/2'],
  [[1928, 8, 1, 8, 'female'], '002-p1053/0/9'],
  [[1928, 12, 1, 3, 'female'], '009-p305/0/3'],
  [[1929, 8, 1, 8, 'male'], '010-p308/0/1'],
  [[1930, 1, 1, 10, 'female'], '002-p235/0/5'],
  [[1930, 7, 1, 1, 'female'], '002-p235/0/11', '002-p1055/0/10'],
  [[1930, 8, 1, 8, 'female'], '002-p235/0/8'],
  [[1930, 10, 1, 11, 'female'], '002-p1055/0/2'],
  [[1931, 4, 1, 9, 'male'], '002-p235/0/7'],
  [[1931, 7, 1, 8, 'male'], '002-p1053/0/8'],
  [[1932, 4, 1, 10, 'female'], '002-p1055/0/5'],
  [[1932, 6, 1, 1, 'female'], '002-p233/1/3'],
  [[1932, 8, 1, 3, 'female'], '002-p233/1/1'],
  [[1932, 11, 1, 11, 'female'], '002-p235/0/3'],
  [[1932, 12, 1, 2, 'female'], '008-p298/0/0'],
  [[1933, 6, 1, 10, 'male'], '011-p316/0/0'],
  [[1934, 1, 1, 8, 'female'], '002-p1053/0/2'],
  [[1934, 3, 1, 8, 'female'], '002-p1053/0/4'],
  [[1934, 4, 1, 11, 'female'], '009-p305/0/1'],
  [[1936, 9, 1, 8, 'female'], '002-p1053/0/10'],
  [[1936, 10, 1, 8, 'female'], '002-p1053/0/11'],
  [[1940, 2, 1, 8, 'female'], '002-p1053/0/3'],
  [[1940, 12, 1, 5, 'female'], '010-p306/0/0'],
  [[1940, 12, 1, 8, 'female'], '009-p305/0/4'],
  [[1941, 1, 1, 5, 'male'], '002-p235/0/2'],
  [[1943, 3, 1, 2, 'male'], '002-p232/0/5'],
  [[1943, 10, 1, 10, 'male'], '009-p305/0/2'],
  [[1944, 10, 1, 0, 'female'], '002-p235/1/1'],
  [[1946, 1, 1, 8, 'female'], '006-p805/0/0'],
  [[1946, 5, 1, 8, 'female'], '002-p1053/0/7'],
  [[1946, 11, 1, 11, 'female'], '002-p232/0/0'],
  [[1947, 2, 8, 3, 'female'], '006-p805/0/1'],
  [[1947, 9, 1, 2, 'male'], '002-p232/0/6'],
  [[1952, 2, 1, 2, 'female'], '002-p232/0/7'],
  [[1953, 6, 1, 11, 'male'], '002-p232/0/3'],
  [[1967, 3, 1, 8, 'male'], '002-p232/0/4'],
  [[1972, 6, 1, 11, 'female'], '002-p232/0/1'],
  [[1984, 11, 1, 8, 'female'], '002-p235/1/0'],
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
      assert.doesNotMatch(material, /多慷慨|賢良忠正|飄落天涯|成四正同梁雙祿馬格|必富貴清華|父子榮貴|威勇武猛/u, condition);
      checked.add(condition);
    }
  }
  assert.deepEqual([records.size, expected.size, witnesses.length], [29, 112, 96]);
  assert.deepEqual(checked, new Set(expected.keys()));
});

test('both flanks of the actual body palace are needed when Wu and Fu flank Life', () => {
  const facts = native('002-p232/0/0');
  assert.equal(explain('002-p232', facts).matched, true);
  assert.equal(explain('002-p232', facts, false).matched, false);
  const missingNeighbour = facts.filter(fact => !(fact.kind === 'palace_relation'
    && fact.anchor === '夫妻' && fact.target === '子女' && fact.relation === 'adjacent'));
  assert.equal(explain('002-p232', missingNeighbour).matched, false);
});

test('the flanking transformations require natal carriers in addition to the flanking stars', () => {
  const facts = native('002-p235/1/0');
  const passages = data => explain('002-p235', data).matchedBranches.map(branch => branch.text);
  assert.deepEqual(passages(facts), ['廉昌夾身命', '若得祿權夾']);
  assert.deepEqual(passages(facts.filter(fact => fact.kind !== 'star_mutagen')), ['廉昌夾身命']);
});

test('the You Fude passage requires a complete and clear opposite palace', () => {
  const facts = native('002-p230/0/0');
  assert.equal(explain('002-p230', facts).matched, true);
  const incompleteOpposite = facts.filter(fact => !(fact.kind === 'palace_origin_star_count' && fact.palace === '财帛'));
  assert.equal(explain('002-p230', incompleteOpposite).matched, false);
});

test('Lianzhen requires the Boshi General rather than a similarly named cycle star', () => {
  const facts = native('011-p316/0/0');
  assert.equal(explain('011-p316', facts).matched, true);
  const mixedCycle = facts.map(fact => fact.kind === 'palace_boshi_star' && fact.star === '将军'
    ? { ...fact, kind: 'palace_jiangqian_star', star: '将星' } : fact);
  assert.equal(explain('011-p316', mixedCycle).matched, false);
});

test('the Mao Lu addition requires the preceding Xu Wu configuration', () => {
  const facts = native('008-p1077/0/0');
  assert.equal(explain('008-p1076', facts).matched, true);
  assert.equal(explain('008-p1077', facts).matched, true);
  const withoutFire = facts.filter(fact => !(fact.kind === 'palace_star' && fact.palace === '财帛' && fact.star === '火星'));
  assert.equal(explain('008-p1076', withoutFire).matched, false);
  assert.equal(explain('008-p1077', withoutFire).matched, false);
  const withoutAides = facts.filter(fact => !(fact.kind === 'palace_star' && fact.palace === '仆役'
    && ['左辅', '八座'].includes(fact.star)));
  assert.equal(explain('008-p1076', withoutAides).matched, true);
  assert.equal(explain('008-p1077', withoutAides).matched, false);
});
