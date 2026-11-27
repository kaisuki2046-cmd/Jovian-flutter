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
import { compileQuanshuZhuxingWenda } from './quanshu-zhuxing-wenda.mjs';
import { compileQuanshuMinggongPassage } from './quanshu-minggong-passages.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-minggong-and-questions-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const sources = {
  minggong: { prefix: 'ziwei-v2-minggong-p', compile: compileQuanshuMinggongPassage },
  wenda: { prefix: 'ziwei-v1-zhuxing-wenda-p', compile: compileQuanshuZhuxingWenda },
};
const idOf = (source, passage, suffix) => `${sources[source].prefix}${passage}-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by source passage, suffix, matched passage, group.
const witnesses = [
  [[1932, 10, 19, 4], ['minggong/214001/003/0/0', 'minggong/276000/002/0/0', 'minggong/276000/002/1/0']],
  [[1930, 7, 19, 6], ['minggong/125002/002/0/0', 'wenda/014/004/0/0']],
  [[1936, 2, 19, 4], ['minggong/188000/002/0/0', 'minggong/237002/002/0/0']],
  [[1938, 2, 19, 2, 'male'], ['minggong/166000/002/0/0', 'minggong/168000/003/0/0']],
  [[1943, 10, 19, 7], ['minggong/141002/003/2/0', 'wenda/133000/020/0/0']],
  [[1964, 6, 19, 11], ['minggong/146000/003/0/0']],
  [[1938, 4, 19, 10, 'male'], ['minggong/166000/002/0/1']],
  [[1936, 6, 19, 8], ['minggong/206002/006/1/1']],
  [[1930, 2, 19, 0], ['minggong/141002/003/0/0']],
  [[1930, 2, 19, 1], ['minggong/162000/002/0/5']],
  [[1930, 7, 19, 10], ['wenda/182010/002/0/0']],
  [[1930, 12, 19, 6], ['minggong/152000/002/0/0']],
  [[1932, 2, 19, 10, 'male'], ['minggong/232000/002/0/0']],
  [[1932, 3, 19, 3], ['minggong/141002/003/1/0']],
  [[1934, 9, 19, 6], ['minggong/162000/002/0/0']],
  [[1936, 2, 19, 7], ['minggong/206002/006/0/1']],
  [[1936, 9, 19, 8], ['minggong/206002/006/0/0']],
  [[1940, 1, 19, 2], ['minggong/162000/002/0/4']],
  [[1942, 7, 19, 10], ['minggong/162000/002/0/2']],
  [[1944, 1, 19, 3], ['minggong/162000/002/0/3']],
  [[1944, 10, 19, 5], ['minggong/162000/002/0/1']],
  [[1946, 2, 19, 10], ['minggong/206002/006/1/0']],
  [[1946, 3, 19, 10], ['wenda/048/002/0/0']],
  [[1960, 12, 19, 9], ['minggong/206002/006/2/0']],
  [[1964, 12, 19, 3], ['minggong/206002/006/2/1']],
  [[1930, 1, 19, 1], ['wenda/182014/003/0/0']],
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
const passages = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;
const quotes = detail => detail.matchedBranches?.map(branch => branch.text) ?? [];

test('verified birth-pillar, placement and flank passages reach SQLite and report materials', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(rule => rule.split('/').slice(0, 3).join('/'))));
  const inventory = new Map(catalog.inventory().map(({claim, lookup: state}) => [claim.id, state.status]));
  const expected = new Set(), seen = new Set();
  let whole = 0;
  for (const key of ids) {
    const id = idOf(...key.split('/')), row = catalog.get(id);
    assert.ok(row, id);
    if (row.inputs) whole++;
    assert.equal(inventory.get(id), row.inputs ? 'indexed' : 'branch_indexed', id);
    passages(row).forEach(({inputs}, passage) => {
      inputs.forEach((_, group) => expected.add([key, passage, group].join('/')));
    });
    const changed = structuredClone(row.claim);
    changed.evidence.context = '异本';
    const [source] = key.split('/');
    assert.equal(sources[source].compile(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [18, 0, 32]);
  for (const [birth, rules] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const hits = new Map(lookup(queries).flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const rule of rules) {
      const [source, chapter, suffix, passage, group] = rule.split('/'), id = idOf(source, chapter, suffix);
      const row = catalog.get(id), { inputs, text } = passages(row)[passage];
      assert.ok(evaluateRule(inputs[group], 'natal', chart).matched, rule);
      const hit = hits.get(id), detail = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && detail.matched, rule);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text ?? row.claim.evidence.original_text), rule);
      if (text) {
        assert.ok(quotes(hit).includes(text), rule);
        assert.deepEqual(quotes(hit), quotes(detail), rule);
        assert.doesNotMatch(material, /现代释义：/u, rule);
      }
      seen.add(rule);
    }
  }
  assert.equal(witnesses.length, 26);
  assert.deepEqual(seen, expected);
});

test('an opposite witness cannot stand in for same-palace evidence or vice versa', () => {
  const id = idOf('minggong', '206002', '006');
  const opposite = native([1936, 6, 19, 8]);
  assert.deepEqual(quotes(explain(id, opposite)), ['或对居']);
  assert.deepEqual(quotes(explain(id, native([1936, 2, 19, 7]))), ['与紫微同垣']);
  const missingOpposition = opposite.filter(fact => fact.kind !== 'palace_relation'
    || fact.anchor !== '命宫' || fact.target !== '迁移' || fact.relation !== 'opposite');
  assert.equal(explain(id, missingOpposition).matched, false);
});

test('a body seat needs confirmed time and Hua Quan needs its actual natal carrier', () => {
  const body = idOf('minggong', '162000', '002'), bodyChart = native([1930, 2, 19, 1]);
  assert.ok(explain(body, bodyChart).matched);
  assert.equal(explain(body, bodyChart, false).matched, false);
  const wuqu = idOf('minggong', '125002', '002'), observed = native([1930, 7, 19, 6]);
  assert.ok(explain(wuqu, observed).matched);
  const withoutPower = observed.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '权');
  assert.equal(explain(wuqu, withoutPower).matched, false);
});

test('the natal fortune flank requires actual transformed fortune and trine support', () => {
  const flank = idOf('wenda', '182010', '002'), observed = native([1930, 7, 19, 10]);
  assert.deepEqual(quotes(explain(flank, observed)), ['夹禄拱贵并化禄']);
  const missingCarrier = observed.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '禄');
  assert.equal(explain(flank, missingCarrier).matched, false);
  const missingNobility = observed.filter(fact => fact.kind !== 'palace_star' || !['天魁', '天钺'].includes(fact.star));
  assert.equal(explain(flank, missingNobility).matched, false);
});
