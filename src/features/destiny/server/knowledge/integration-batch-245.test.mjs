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
import { compileQuanshuTongyuan } from './quanshu-tongyuan.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-tongyuan-followup-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (passage, suffix) => `ziwei-v3-c020-p${passage}-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by source passage, suffix, matched passage, group.
const witnesses = [
  [[1930, 2, 19, 6], ['156000/001/0/0', '164001/001/1/0', '164001/001/2/0', '166000/001/1/0', '166000/001/2/0', '166002/001/0/0', '154003/002/0/0']],
  [[1932, 4, 19, 3], ['129007/001/0/0', '164001/001/7/0', '166000/001/3/0', '129007/002/0/0', '129014/002/0/0']],
  [[1932, 5, 19, 6], ['129017/001/0/0', '172001/001/0/0']],
  [[1930, 12, 19, 3], ['133014/001/0/1', '156000/001/1/0']],
  [[1930, 1, 19, 2], ['152007/002/0/0', '152007/002/1/0']],
  [[1931, 7, 19, 3], ['133014/001/0/0', '174001/012/0/0']],
  [[1934, 10, 19, 11], ['121001/001/0/0', '164001/001/0/0']],
  [[1936, 2, 19, 2], ['168001/001/0/0', '121001/002/0/0']],
  [[1930, 3, 19, 6], ['152007/002/2/0']],
  [[1931, 3, 19, 8], ['129014/003/0/0']],
  [[1930, 1, 19, 7], ['166002/002/0/0']],
  [[1930, 4, 19, 9], ['164001/001/4/0']],
  [[1930, 11, 19, 1], ['166000/001/0/0']],
  [[1931, 2, 19, 6], ['158006/001/0/0']],
  [[1931, 2, 19, 8], ['133004/001/0/0']],
  [[1934, 8, 19, 10], ['152002/003/0/0']],
  [[1930, 3, 19, 10], ['133014/001/0/2']],
  [[1930, 5, 19, 10], ['152007/001/0/0']],
  [[1930, 6, 19, 9], ['109009/001/0/0']],
  [[1930, 10, 19, 2], ['164001/001/5/0']],
  [[1930, 10, 19, 6], ['152002/003/0/1']],
  [[1931, 3, 19, 7], ['164001/001/3/0']],
  [[1932, 2, 19, 10], ['164001/001/6/0']],
  [[1933, 3, 19, 10], ['174001/014/0/0']],
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

test('verified same-palace chapter flanks and assemblies reach SQLite and report materials', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(rule => rule.split('/').slice(0, 2).join('/'))));
  const inventory = new Map(catalog.inventory().map(({claim, lookup: state}) => [claim.id, state.status]));
  const expected = new Set(), seen = new Set();
  let whole = 0;
  for (const key of ids) {
    const id = idOf(...key.split('/')), row = catalog.get(id);
    assert.ok(row, id);
    if (row.inputs) whole++;
    assert.equal(inventory.get(id), row.inputs ? 'indexed' : 'branch_indexed', id);
    passages(row).forEach(({text, inputs}, passage) => {
      // The following cycle independently verifies the new transformation flanks.
      if (key === '164001/001' && text === '科权禄' || key === '166000/001' && text === '夹忌') return;
      inputs.forEach((_, group) => expected.add([key, passage, group].join('/')));
    });
    const changed = structuredClone(row.claim);
    changed.evidence.context = '异本';
    assert.equal(compileQuanshuTongyuan(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [24, 0, 40]);
  for (const [birth, rules] of witnesses) {
    const { queries, context } = query(native(birth));
    const chart = claimChartContext('ziwei', context);
    const hits = new Map(lookup(queries).flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const rule of rules) {
      const [chapter, suffix, passage, group] = rule.split('/'), id = idOf(chapter, suffix);
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
  assert.equal(witnesses.length, 24);
  assert.deepEqual(seen, expected);
});

test('a flank needs both actual neighbors and a body flank needs confirmed birth time', () => {
  const life = idOf('164001', '001'), lifeChart = native([1930, 2, 19, 6]);
  assert.ok(quotes(explain(life, lifeChart)).includes('火铃'));
  const noAdjacency = lifeChart.filter(fact => fact.kind !== 'palace_relation' || fact.relation !== 'adjacent');
  assert.equal(explain(life, noAdjacency).matched, false);

  const body = idOf('166000', '001'), bodyChart = native([1930, 11, 19, 1]);
  assert.ok(quotes(explain(body, bodyChart)).includes('劫空'));
  assert.equal(explain(body, bodyChart, false).matched, false);
});

test('the empty Life and Body have distinct evidence from a benign Body and afflicted Life', () => {
  const solo = idOf('152002', '003'), observed = native([1934, 8, 19, 10]);
  assert.deepEqual(quotes(explain(solo, observed)), ['身命无正曜是也']);
  assert.equal(explain(solo, observed, false).matched, false);
  const mixed = idOf('166002', '002'), good = idOf('166002', '001');
  const distinctSectors = native([1930, 1, 19, 7]);
  assert.ok(explain(mixed, distinctSectors).matched);
  assert.equal(explain(good, distinctSectors).matched, false);
  const incomplete = distinctSectors.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '命宫');
  assert.equal(explain(mixed, incomplete).matched, false);
});

test('unconfirmed transformations and incomplete absence cannot qualify an excerpt', () => {
  const giant = idOf('133004', '001'), observed = native([1931, 2, 19, 8]);
  assert.deepEqual(quotes(explain(giant, observed)), ['巨门子午科权禄']);
  const missingSci = observed.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '科');
  assert.equal(explain(giant, missingSci).matched, false);
  const clean = idOf('129014', '003'), candidate = native([1931, 3, 19, 8]);
  assert.ok(explain(clean, candidate).matched);
  const missingPalaceCount = candidate.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '迁移');
  assert.equal(explain(clean, missingPalaceCount).matched, false);
});
