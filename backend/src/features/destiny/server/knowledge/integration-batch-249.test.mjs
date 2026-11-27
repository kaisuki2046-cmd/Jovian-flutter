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
import { compileQuanshuMinggongPassage } from './quanshu-minggong-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-minggong-natal-seats-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (chapter, suffix) => `ziwei-v2-minggong-p${chapter}-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth dates and time indices, followed by source passage, suffix, branch and rule group.
const witnesses = [
  [[1941, 11, 6, 4, 'male'], ['209000/001/0/1', '209000/002/0/1', '321000/001/0/0', '321000/001/1/0', '323001/027/0/0', '323001/027/0/2']],
  [[1942, 9, 19, 6], ['122000/001/0/0', '122000/001/1/0', '323001/039/0/0', '323001/042/0/0', '323001/042/1/0']],
  [[1932, 4, 6, 1], ['276000/001/0/0', '276000/001/1/0', '323001/007/0/0', '323001/039/0/5']],
  [[1930, 12, 15, 2], ['323001/006/0/8', '323001/027/0/4', '252002/002/0/1', '323001/039/0/4']],
  [[1934, 8, 19, 7], ['122000/001/0/5', '122000/001/1/5', '323001/006/0/1']],
  [[1936, 1, 19, 2], ['122000/001/0/4', '122000/001/1/4', '323001/018/0/0']],
  [[1972, 12, 6, 3], ['122000/001/0/3', '122000/001/1/3', '323001/039/0/3']],
  [[1930, 6, 19, 10], ['246000/001/0/0', '242001/005/0/0']],
  [[1930, 8, 19, 5], ['323001/027/0/1', '323001/039/0/1']],
  [[1938, 3, 19, 10], ['323001/039/0/2', '242001/006/0/0']],
  [[1939, 6, 19, 6, 'male'], ['209000/001/0/0', '209000/002/0/0']],
  [[1939, 10, 19, 2, 'male'], ['201000/001/0/1', '201000/001/1/1']],
  [[1941, 4, 19, 2, 'male'], ['201000/001/0/0', '201000/001/1/0']],
  [[1954, 4, 19, 11], ['122000/001/0/1', '122000/001/1/1']],
  [[1962, 11, 6, 4], ['122000/001/0/2', '122000/001/1/2']],
  [[1965, 6, 6, 6, 'male'], ['201000/001/0/2', '201000/001/1/2']],
  [[1931, 10, 22, 4, 'male'], ['201000/001/0/3', '201000/001/1/3']],
  [[1930, 11, 15, 3], ['323001/006/0/6', '323001/027/0/3']],
  [[1930, 1, 19, 5], ['267001/003/0/0']],
  [[1930, 3, 19, 8], ['323001/040/0/0']],
  [[1930, 6, 19, 3], ['323001/006/0/3']],
  [[1931, 1, 19, 4, 'male'], ['255000/001/0/0']],
  [[1932, 8, 19, 7], ['323001/027/0/5']],
  [[1933, 6, 19, 6, 'male'], ['173002/002/0/0']],
  [[1934, 2, 19, 11], ['252002/002/0/0']],
  [[1934, 3, 19, 5], ['122000/003/0/0']],
  [[1971, 9, 19, 6, 'male'], ['173002/002/0/1']],
  [[1937, 5, 6, 4, 'male'], ['195000/002/0/0']],
  [[1938, 2, 6, 8], ['252002/002/1/0']],
  [[1939, 10, 22, 4, 'male'], ['195000/002/0/1']],
  [[1930, 1, 15, 9], ['323001/006/0/4']],
  [[1930, 11, 15, 2], ['323001/006/0/7']],
  [[1932, 1, 15, 1], ['323001/006/0/0']],
  [[1932, 1, 15, 3], ['323001/006/0/9']],
  [[1932, 8, 15, 6], ['323001/006/0/2']],
  [[1934, 2, 15, 8], ['323001/006/0/5']],
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

const explain = (id, facts, timeKnown) => explainClaim(id, 'ziwei', query(facts, timeKnown).context, undefined, catalog);
const quotes = result => result.matchedBranches?.map(branch => branch.text) ?? [];

test('reviewed Minggong seats and assemblies reach SQLite and report materials', () => {
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
    const changed = structuredClone(row.claim);
    changed.evidence.context = '异本';
    assert.equal(compileQuanshuMinggongPassage(changed).reason, 'source_review_required', id);
  }

  assert.deepEqual([ids.size, expected.size], [22, 68]);
  for (const [birth, rules] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const hits = new Map(lookup(queries).flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const rule of rules) {
      const [chapter, suffix, branch, group] = rule.split('/'), id = idOf(chapter, suffix);
      const { inputs, text } = catalog.get(id).branches[branch];
      assert.ok(evaluateRule(inputs[group], 'natal', chart).matched, rule);
      const hit = hits.get(id), detail = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && detail.matched, rule);
      assert.ok(quotes(hit).includes(text), rule);
      assert.deepEqual(quotes(hit), quotes(detail), rule);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text), rule);
      assert.doesNotMatch(material, /现代释义：/u, rule);
      seen.add(rule);
    }
  }
  assert.deepEqual(seen, expected);
});

test('a confirmed female body seat and actual trine branch are required', () => {
  const sun = idOf('122000', '001'), sunChart = native([1954, 4, 19, 11]);
  assert.equal(quotes(explain(sun, sunChart)).length, 2);
  assert.equal(explain(sun, sunChart, false).matched, false);
  assert.equal(explain(sun, native([1954, 4, 19, 11, 'male'])).matched, false);

  const moon = idOf('323001', '018'), moonChart = native([1934, 11, 6, 11]);
  assert.ok(explain(moon, moonChart).matched);
  const missingTrine = moonChart.filter(fact => fact.kind !== 'palace_relation'
    || fact.anchor !== '命宫' || fact.target !== '官禄' || fact.relation !== 'trine');
  assert.equal(explain(moon, missingTrine).matched, false);
});

test('absence of additional malefics requires complete sector evidence', () => {
  const fireAndBell = idOf('276000', '001'), aligned = native([1932, 4, 6, 1]);
  assert.deepEqual(quotes(explain(fireAndBell, aligned)),
    ['火铃之星入命来，贪狼相会得和谐', '三方无杀诸般美']);
  const incomplete = aligned.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '迁移');
  assert.deepEqual(quotes(explain(fireAndBell, incomplete)), ['火铃之星入命来，贪狼相会得和谐']);
});

test('the malefic and supportive Hua Ji passages require the actual natal carrier', () => {
  const ji = idOf('321000', '001'), chart = native([1941, 11, 6, 4, 'male']);
  assert.equal(quotes(explain(ji, chart)).length, 2);
  const withoutCarrier = chart.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  assert.equal(explain(ji, withoutCarrier).matched, false);
});
