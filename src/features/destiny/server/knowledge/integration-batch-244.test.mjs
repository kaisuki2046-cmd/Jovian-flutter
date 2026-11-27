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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-tongyuan-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (passage, suffix) => `ziwei-v3-c020-p${passage}-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by source passage, suffix, matched passage, group.
const witnesses = [
  [[1930, 12, 19, 8], ['127005/001/0/0', '174001/007/0/0', '174001/008/0/0', '174001/015/0/0']],
  [[1931, 4, 19, 6], ['119008/001/0/0', '139001/001/0/0', '158001/001/0/0', '149004/001/0/0']],
  [[1934, 2, 19, 5], ['172003/001/0/0', '158001/002/0/0', '158001/003/0/0']],
  [[1930, 12, 19, 3], ['131001/001/1/0', '154007/001/0/0', '174001/011/0/0']],
  [[1930, 3, 19, 2], ['174001/013/0/0', '174001/019/0/0']],
  [[1930, 6, 19, 5], ['119004/003/0/0', '119010/002/0/0']],
  [[1931, 3, 19, 11], ['119008/001/0/1']],
  [[1934, 10, 19, 2], ['131001/001/0/0']],
  [[1930, 5, 19, 8], ['174001/018/0/0']],
  [[1932, 3, 19, 6], ['113003/001/0/0']],
  [[1930, 2, 19, 2], ['137001/001/0/0']],
  [[1930, 2, 19, 4], ['174001/006/0/1']],
  [[1930, 2, 19, 7], ['174001/003/0/0']],
  [[1930, 6, 19, 3], ['174001/002/0/0']],
  [[1930, 6, 19, 6], ['127003/001/0/0']],
  [[1930, 6, 19, 8], ['127003/002/0/0']],
  [[1930, 8, 19, 3], ['125003/002/0/0']],
  [[1930, 9, 19, 4], ['174001/004/0/0']],
  [[1930, 11, 19, 4], ['174001/006/0/0']],
  [[1938, 3, 21, 5], ['113002/002/0/0']],
  [[1942, 11, 19, 7], ['133014/002/0/0']],
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

test('verified same-palace chapter passages reach SQLite and report materials', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(rule => rule.split('/').slice(0, 2).join('/'))));
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
    assert.equal(compileQuanshuTongyuan(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [30, 0, 33]);
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
  assert.equal(witnesses.length, 21);
  assert.deepEqual(seen, expected);
});

test('the sun and moon positions and the verified body seat are independent evidence', () => {
  const sundown = idOf('119008', '001'), observed = native([1931, 4, 19, 6]);
  assert.deepEqual(quotes(explain(sundown, observed)), ['若反背日戌月辰']);
  const missingMoon = observed.filter(fact => fact.kind !== 'palace_star' || fact.star !== '太阴');
  assert.equal(explain(sundown, missingMoon).matched, false);

  const writing = idOf('174001', '006'), body = native([1930, 2, 19, 4]);
  assert.ok(explain(writing, body).matched);
  assert.equal(explain(writing, body, false).matched, false);
});

test('absence requires a closed sector and natal transformations require the actual star', () => {
  const clean = idOf('137001', '001'), observed = native([1930, 2, 19, 2]);
  assert.ok(explain(clean, observed).matched);
  const incomplete = observed.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '迁移');
  assert.equal(explain(clean, incomplete).matched, false);

  const ji = idOf('113002', '002'), afflicted = native([1938, 3, 21, 5]);
  assert.deepEqual(quotes(explain(ji, afflicted)), ['加刑忌']);
  const missingCarrier = afflicted.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  assert.equal(explain(ji, missingCarrier).matched, false);
});

test('a secondary chapter remark does not inherit a different grade table', () => {
  for (const [passage, suffix] of [['119010', '001'], ['133011', '002'], ['174001', '001']]) {
    const entry = catalog.get(idOf(passage, suffix));
    assert.ok(entry && !entry.inputs && !entry.branches.length, entry?.claim.id);
  }
  const qisha = catalog.get(idOf('131005', '001'));
  assert.ok(qisha && !qisha.inputs);
  assert.deepEqual(qisha.branches.map(branch => branch.text), ['杀居午']);
});
