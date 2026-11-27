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
import { compileJielanNatalStars } from './ziwei-jielan-natal-stars.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-taiyin-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const prefix = 'ziwei-v4-jielan-156-p001-';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  [[1, 2, 0], ['001/1/0', '003/0/1']],
  [[1, 2, 1], ['001/0/0', '015/0/0']],
  [[1, 2, 9], ['004/0/0']],
  [[1, 2, 10], ['003/0/0']],
  [[1, 2, 11], ['009/1/0']],
  [[1, 3, 6], ['008/0/0', '023/0/0']],
  [[1, 3, 9], ['021/0/0']],
  [[1, 3, 11], ['025/0/0']],
  [[1, 4, 4], ['009/0/0']],
  [[1, 6, 2], ['002/0/1', '017/0/1', '019/0/1']],
  [[1, 6, 10], ['002/0/0', '017/0/0', '019/0/0']],
  [[1, 11, 4], ['014/0/0']],
  [[2, 11, 1], ['018/0/0']],
  [[3, 9, 2], ['012/0/0']],
  [[3, 16, 0], ['005/0/0']],
  [[4, 8, 9], ['018/0/1']],
];

function native([month, day, hour]) {
  return chartFacts.ziwei(calculateZiwei({ date: { year: 1940, month, day }, gender: 'female' }, hour));
}

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [parsed] = queries;
  return { queries, context: chartContext('ziwei', parsed.confirmedFacts, parsed.confirmedAbsentFacts, parsed.chartScope) };
}

const explain = (suffix, facts, timeKnown) =>
  explainClaim(prefix + suffix, 'ziwei', query(facts, timeKnown).context, undefined, catalog);
const passages = row => row.inputs ? [{ inputs: row.inputs }] : row.branches;

test('all Taiyin rules are witnessed by native charts in SQLite and report material', () => {
  const ids = new Set(witnesses.flatMap(([, rules]) => rules.map(rule => rule.split('/')[0])));
  const inventory = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Set(), seen = new Set();
  let whole = 0;
  for (const suffix of ids) {
    const id = prefix + suffix, row = catalog.get(id);
    if (row.inputs) whole++;
    assert.equal(inventory.get(id), row.inputs ? 'indexed' : 'branch_indexed', id);
    passages(row).forEach(({ inputs }, passage) => {
      inputs.forEach((_, index) => expected.add([suffix, passage, index].join('/')));
    });
    const changed = structuredClone(row.claim);
    changed.evidence.context = '另一底本';
    assert.equal(compileJielanNatalStars(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [16, 14, 23]);
  for (const [birth, rules] of witnesses) {
    const { queries, context } = query(native(birth));
    const derived = claimChartContext('ziwei', context);
    const hits = new Map(lookup(queries).flatMap(({ personality, events }) =>
      [...personality, ...events].map(hit => [hit.id, hit])));
    for (const rule of rules) {
      const [suffix, passage, group] = rule.split('/'), id = prefix + suffix;
      const row = catalog.get(id), { inputs, text } = passages(row)[passage];
      assert.ok(evaluateRule(inputs[group], 'natal', derived).matched, rule);
      const hit = hits.get(id), detail = explainClaim(id, 'ziwei', context, undefined, catalog);
      assert.ok(hit && detail.matched, rule);
      assert.match(detail.calculationNote, /太阴星论/u);
      const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
      assert.ok(material.includes(text ?? row.claim.evidence.original_text), rule);
      if (text) {
        assert.deepEqual(hit.matchedBranches.map(branch => branch.text), [text], rule);
        assert.doesNotMatch(material, /现代释义：/u, rule);
      }
      seen.add(rule);
    }
  }
  assert.deepEqual(seen, expected);
  for (const suffix of ['006', '007', '010', '011', '013', '016', '020', '022', '024', '026', '027']) {
    assert.equal(inventory.get(prefix + suffix), 'unmapped', suffix);
  }
});

test('branch-specific brightness from this edition excludes Dongqian, Ximei and unlisted Shen', () => {
  for (const birth of [[1, 2, 5], [1, 3, 7], [1, 5, 0]]) assert.equal(explain('001', native(birth)).matched, false);
  assert.equal(explain('009', native([1, 2, 11]), false).matched, false);
});

test('strengths require closed sector evidence and the actual body palace', () => {
  const body = native([1, 6, 2]);
  assert.ok(explain('002', body).matched);
  assert.equal(explain('002', body.filter(fact => fact.kind !== 'body_palace')).matched, false);
  const quiet = native([3, 16, 0]);
  assert.ok(explain('005', quiet).matched);
  const incomplete = quiet.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '子女');
  assert.equal(explain('005', incomplete).matched, false);
  assert.equal(explain('021', quiet).matched, false);
  assert.equal(explain('005', native([1, 3, 9])).matched, false);
});

test('the illness branch verifies both luminaries and all reachable paired placements', () => {
  for (const [birth, sun, moon] of [[[1, 17, 3], '酉', '巳'], [[1, 11, 4], '戌', '辰'], [[1, 12, 5], '亥', '卯']]) {
    const facts = native(birth), detail = explain('014', facts);
    assert.ok(detail.matched);
    const [pair] = detail.matchedConditions.alternatives;
    assert.ok(pair.some(fact => fact.kind === 'palace_branch' && fact.palace === '疾厄' && fact.branch === moon));
    assert.ok(pair.some(fact => fact.kind === 'palace_branch' && fact.palace !== '疾厄' && fact.branch === sun));
    assert.equal(explain('014', facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '太阳')).matched, false);
  }
});
