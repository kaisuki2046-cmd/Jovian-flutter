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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-star-questions-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (passage, suffix) => `ziwei-v1-zhuxing-wenda-p${passage}-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by source passage, suffix, matched passage, group.
const witnesses = [
  [[1933, 10, 19, 3], ['130000/007/1/3', '130000/007/2/0', '182006/003/0/0']],
  [[1934, 3, 19, 5], ['182003/009/0/0', '182003/010/1/0', '127000/015/0/0']],
  [[1946, 4, 19, 5], ['116000/004/0/0', '122000/009/0/0', '116000/010/0/0']],
  [[1930, 3, 19, 8], ['101000/006/0/0', '133000/017/0/0']],
  [[1930, 7, 19, 5], ['121000/006/0/0', '182003/010/0/0']],
  [[1932, 2, 19, 5], ['130000/007/1/1', '037/002/0/0']],
  [[1932, 2, 19, 11], ['037/004/0/0', '014/009/0/0']],
  [[1937, 8, 19, 5], ['130000/009/0/0']],
  [[1949, 4, 19, 1], ['037/002/0/4']],
  [[1930, 9, 19, 5], ['123000/013/0/0']],
  [[1931, 3, 19, 6], ['122000/025/0/0']],
  [[1931, 9, 19, 10], ['130000/007/1/2']],
  [[1935, 5, 19, 8], ['130000/007/1/4']],
  [[1930, 3, 19, 2], ['130000/007/1/0']],
  [[1941, 7, 19, 2], ['116000/008/0/0']],
  [[1932, 8, 19, 11], ['130000/007/0/0']],
  [[1930, 1, 19, 5], ['182011/002/0/0']],
  [[1930, 2, 19, 0], ['123000/006/1/0']],
  [[1930, 6, 19, 3], ['115000/004/0/0']],
  [[1930, 6, 19, 8], ['122000/027/0/0']],
  [[1931, 2, 19, 4], ['158000/003/0/0']],
  [[1931, 4, 20, 8], ['037/002/0/3']],
  [[1931, 6, 19, 1], ['130000/007/1/5']],
  [[1933, 4, 19, 10], ['037/002/0/2']],
  [[1934, 7, 19, 0], ['123000/006/0/0']],
  [[1935, 8, 19, 8], ['133000/011/0/0']],
  [[1937, 4, 19, 11], ['037/002/0/1']],
  [[1938, 9, 19, 3], ['182012/002/0/0']],
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

test('verified Questions on the Stars passages reach SQLite and report materials', () => {
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
    assert.equal(compileQuanshuZhuxingWenda(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [25, 0, 38]);
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
  assert.equal(witnesses.length, 28);
  assert.deepEqual(seen, expected);
});

test('an actual body seat and its independently matched passages require birth time', () => {
  const qisha = idOf('130000', '007'), birth = native([1933, 10, 19, 3]);
  const source = quotes(explain(qisha, birth));
  assert.ok(source.includes('與囚於身命'));
  assert.ok(source.includes('會囚耗於遷移'));
  assert.ok(!quotes(explain(qisha, birth, false)).includes('與囚於身命'));

  const tianliang = idOf('127000', '015'), body = native([1934, 3, 19, 5]);
  assert.ok(explain(tianliang, body).matched);
  assert.equal(explain(tianliang, body, false).matched, false);
});

test('illness and Sun passages separate actual natal Ji from a separate malefic witness', () => {
  const ju = idOf('123000', '006');
  const afflicted = native([1934, 7, 19, 0]);
  assert.ok(quotes(explain(ju, afflicted)).includes('在疾厄遇刑忌'));
  assert.ok(quotes(explain(ju, native([1930, 2, 19, 0]))).includes('殺臨'));
  const withoutJi = facts => facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  assert.ok(!quotes(explain(ju, withoutJi(afflicted))).includes('在疾厄遇刑忌'));

  const sun = idOf('182003', '010'), observed = native([1934, 3, 19, 5]);
  assert.ok(quotes(explain(sun, observed)).includes('刑忌'));
  assert.ok(!quotes(explain(sun, withoutJi(observed))).includes('刑忌'));
});

test('solo Wenqu and an unassisted bell need actual absence evidence', () => {
  const solo = idOf('037', '002'), observed = native([1930, 2, 19, 11]);
  assert.ok(explain(solo, observed).matched);
  const incomplete = (facts, palace) => facts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== palace);
  assert.equal(explain(solo, incomplete(observed, '命宫')).matched, false);

  const bell = idOf('182012', '002'), reduced = native([1938, 9, 19, 3]);
  assert.ok(explain(bell, reduced).matched);
  assert.equal(explain(bell, incomplete(reduced, '财帛')).matched, false);
});
