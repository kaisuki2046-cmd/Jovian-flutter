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
import { compileXingjueNatalStars } from './xingjue-natal-stars.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-xingjue-sun-and-moon-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (passage, suffix = '001') => `ziwei-v2-xingjue-007-p${passage}-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, then source passage, suffix, text and condition group.
const witnesses = [
  [[1931, 4, 19, 6, 'male'], ['274/001/0/0', '282/001/0/0', '294/001/0/0']],
  [[1939, 2, 19, 7, 'male'], ['286/001/0/0', '292/001/0/0', '867/001/0/0']],
  [[1953, 8, 19, 9, 'male'], ['272/001/0/0', '863/001/0/0', '864/001/0/0']],
  [[1930, 8, 19, 4], ['285/001/0/0', '864/001/0/2']],
  [[1933, 11, 19, 10, 'male'], ['284/001/0/0', '866/001/0/0']],
  [[1934, 2, 19, 1], ['848/001/0/0', '868/001/0/0']],
  [[1957, 3, 19, 10, 'male'], ['284/001/0/2', '284/001/1/2']],
  [[1969, 4, 19, 9, 'male'], ['284/001/0/3', '284/001/1/3']],
  [[1914, 4, 29, 7, 'male'], ['862/001/0/0', '862/001/1/0']],
  [[1915, 8, 15, 5, 'male'], ['872/001/0/0', '872/001/1/0']],
  [[1921, 2, 8, 11, 'male'], ['284/001/0/1', '284/001/1/1']],
  [[1921, 6, 14, 7, 'male'], ['284/001/0/5', '284/001/1/5']],
  [[1921, 11, 17, 2, 'male'], ['284/001/0/4', '284/001/1/4']],
  [[1930, 1, 19, 9], ['864/001/0/3']],
  [[1930, 2, 19, 7], ['864/001/0/5']],
  [[1930, 5, 19, 2], ['864/001/0/4']],
  [[1930, 6, 19, 5], ['865/001/0/0']],
  [[1930, 7, 19, 0], ['293/001/0/0']],
  [[1930, 7, 19, 5], ['864/001/0/1']],
  [[1930, 8, 19, 5], ['273/001/0/0']],
  [[1930, 9, 19, 1], ['275/001/0/0']],
  [[1930, 9, 19, 10], ['280/001/0/0']],
  [[1931, 4, 19, 9, 'male'], ['843/001/0/0']],
  [[1933, 2, 19, 4, 'male'], ['869/001/0/0']],
  [[1933, 3, 19, 8, 'male'], ['851/001/0/0']],
  [[1935, 1, 19, 6, 'male'], ['871/001/0/0']],
  [[1936, 12, 19, 10], ['873/001/0/0']],
  [[1942, 1, 19, 10], ['847/001/0/0']],
  [[1943, 1, 19, 1, 'male'], ['877/001/0/0']],
  [[1946, 1, 19, 10], ['875/001/0/0']],
  [[1949, 8, 19, 1, 'male'], ['842/001/0/0']],
  [[1969, 7, 19, 6, 'male'], ['284/001/1/0']],
  [[1910, 10, 3, 11, 'male'], ['283/001/0/0']],
];

function native([year, month, day, hour, gender = 'female']) {
  return chartFacts.ziwei(calculateZiwei({ date: { year, month, day }, gender }, hour));
}

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts: absent, chartScope }] = queries;
  return { queries, context: chartContext('ziwei', present, absent, chartScope) };
}

const explain = (passage, facts, known) => explainClaim(idOf(passage), 'ziwei', query(facts, known).context, undefined, catalog);
const quotes = hit => hit.matchedBranches?.map(branch => branch.text) ?? [];

test('the reviewed Sun and Moon passages reach SQLite and report materials', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(rule => rule.split('/').slice(0, 2).join('/'))));
  const inventory = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Set(), seen = new Set();

  for (const key of ids) {
    const id = idOf(...key.split('/')), row = catalog.get(id);
    assert.equal(inventory.get(id), 'branch_indexed', id);
    assert.ok(row.branches.length, id);
    row.branches.forEach(({ inputs }, branch) => {
      inputs.forEach((_, group) => expected.add([key, branch, group].join('/')));
    });
    const changedSource = structuredClone(row.claim);
    changedSource.source.edition = '校勘待核';
    assert.equal(compileXingjueNatalStars(changedSource).reason, 'source_review_required', id);
  }

  assert.deepEqual([ids.size, expected.size], [31, 49]);
  for (const [birth, rules] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const hits = new Map(lookup(queries).flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const rule of rules) {
      const [passage, suffix, branch, group] = rule.split('/'), id = idOf(passage, suffix);
      const { inputs, text } = catalog.get(id).branches[branch];
      assert.ok(evaluateRule(inputs[group], 'natal', chart).matched, rule);
      const hit = hits.get(id), explained = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && explained.matched, rule);
      assert.ok(quotes(hit).includes(text), rule);
      assert.deepEqual(quotes(hit), quotes(explained), rule);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text), rule);
      assert.doesNotMatch(material, /现代释义：/u, rule);
      seen.add(rule);
    }
  }
  assert.deepEqual(seen, expected);
});

test('illumination and separate Life and Body placements require observed chart evidence', () => {
  const wealthTrines = native([1953, 8, 19, 9, 'male']);
  const wealthFlanks = native([1930, 8, 19, 3]);
  assert.ok(explain('272', wealthTrines).matched);
  assert.ok(explain('272', wealthFlanks).matched);
  const missingFlank = wealthFlanks.filter(fact => fact.kind !== 'palace_relation'
    || fact.anchor !== '财帛' || fact.target !== '子女' || fact.relation !== 'adjacent');
  assert.equal(explain('272', missingFlank).matched, false);

  const trines = native([1939, 2, 19, 7, 'male']);
  assert.ok(explain('286', trines).matched);
  const missingPath = trines.filter(fact => fact.kind !== 'palace_relation'
    || fact.anchor !== '命宫' || fact.target !== '财帛' || fact.relation !== 'trine');
  assert.equal(explain('286', missingPath).matched, false);
  const body = native([1946, 1, 19, 10]);
  assert.ok(explain('875', body).matched);
  assert.equal(explain('875', body, false).matched, false);
});

test('an absent light or benefic requires complete star lists for the relevant palaces', () => {
  const chart = native([1930, 9, 19, 1]);
  assert.ok(explain('275', chart).matched);
  const incompleteWealth = chart.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '财帛');
  assert.equal(explain('275', incompleteWealth).matched, false);
  const moonOnly = native([1930, 8, 19, 4]);
  assert.ok(explain('285', moonOnly).matched);
  const incompleteOpposite = moonOnly.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '迁移');
  assert.equal(explain('285', incompleteOpposite).matched, false);
});

test('the hour branch, Ji carrier and additional assistant keep independent requirements', () => {
  const time = native([1910, 10, 3, 11, 'male']);
  assert.ok(explain('283', time).matched);
  const missingHour = time.filter(fact => fact.kind !== 'natal_ziwei_hour');
  assert.equal(explain('283', missingHour).matched, false);
  const sun = native([1914, 4, 29, 7, 'male']);
  assert.equal(quotes(explain('862', sun)).length, 2);
  const missingWenChang = sun.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '仆役' || fact.star !== '文昌');
  assert.deepEqual(quotes(explain('862', missingWenChang)), ['戌宮命太陽單守、化忌同居、落日昏冥不美']);
  const missingCarrier = sun.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  assert.equal(explain('862', missingCarrier).matched, false);
});
