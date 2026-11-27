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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-late-volume-five-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (chapter, suffix) => {
  const passage = chapter === '237' ? 'p002' : 'p001';
  return `ziwei-v5-jielan-${chapter}-${passage}-${suffix}`;
};

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by chapter, suffix, passage, group.
const witnesses = [
  [[1930, 1, 19, 3], ['238/002/0/1']],
  [[1930, 1, 19, 6], ['236/005/0/0']],
  [[1930, 2, 19, 6], ['237/008/0/0']],
  [[1930, 2, 19, 7], ['237/007/0/0', '234/011/0/0']],
  [[1930, 3, 19, 2], ['238/007/0/0', '234/012/0/0', '234/015/0/0']],
  [[1930, 3, 19, 8], ['234/022/0/0']],
  [[1930, 5, 19, 2], ['237/002/0/1', '237/002/1/0', '237/002/1/1', '237/004/0/0', '238/002/1/1', '234/016/0/0', '234/019/0/0', '236/006/0/0']],
  [[1930, 9, 19, 4], ['238/002/1/0']],
  [[1930, 12, 19, 0], ['238/003/0/0']],
  [[1930, 12, 19, 2], ['234/008/0/0']],
  [[1931, 2, 19, 6], ['238/005/0/0', '238/005/1/0']],
  [[1931, 4, 19, 9], ['237/006/0/1']],
  [[1932, 4, 19, 7], ['235/001/0/1', '238/006/0/1']],
  [[1934, 10, 19, 11], ['238/007/1/0']],
  [[1937, 6, 19, 7], ['237/002/0/0', '235/001/0/0', '234/005/0/0', '234/019/0/1']],
  [[1939, 10, 19, 9], ['237/006/0/0', '238/004/0/0']],
  [[1975, 5, 19, 1], ['238/002/0/0', '238/006/0/0', '236/007/0/0', '236/007/1/0', '236/008/0/0']],
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

test('all new volume-five conditions reach SQLite and report materials', () => {
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
    assert.equal(compileJielanNatalStars(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [24, 5, 37]);
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
  assert.equal(witnesses.length, 17);
  assert.deepEqual(seen, expected);
});

test('empty life and each trine palace need independent support', () => {
  const id = idOf('236', '005'), observed = native([1930, 1, 19, 6]);
  const benefics = ['左辅', '右弼', '文昌', '文曲', '天魁', '天钺', '禄存'];
  assert.ok(explain(id, observed).matched);
  for (const palace of ['财帛', '官禄']) {
    const missing = observed.filter(f => f.kind !== 'palace_star' || f.palace !== palace || !benefics.includes(f.star));
    assert.equal(explain(id, missing).matched, false);
  }
  const incomplete = observed.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '命宫');
  assert.equal(explain(id, incomplete).matched, false);
});

test('misfortune and Lu absences keep the source prerequisites and the verified excerpt', () => {
  const id = idOf('236', '007'), observed = native([1975, 5, 19, 1]);
  assert.deepEqual(quotes(explain(id, observed)),
    ['若命无吉星，反有凶杀化忌无禄落陷', '三方有吉星，亦可为中等']);
  const missingLu = observed.filter(f => f.kind !== 'star_mutagen' || f.change !== '禄');
  assert.equal(explain(id, missingLu).matched, false);
  const incompleteOrigin = observed.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '命宫');
  assert.equal(explain(id, incompleteOrigin).matched, false);
  const shorter = explain(idOf('236', '008'), native([1974, 9, 19, 9]));
  assert.deepEqual(quotes(shorter), ['若安命星躔陷地，又加凶杀化忌']);
});

test('transformation, actual ruler and adverse companion are checked separately', () => {
  const id = idOf('238', '005'), observed = native([1931, 2, 19, 6]);
  assert.deepEqual(quotes(explain(id, observed)), ['巨化吉宿富贵', '同凶也不昌荣。']);
  assert.equal(explain(id, observed.filter(f => f.kind !== 'star_mutagen' || f.star !== '巨门')).matched, false);
  const missingMalefics = observed.filter(f => f.kind !== 'palace_star' || !['擎羊', '陀罗', '火星', '铃星'].includes(f.star));
  assert.deepEqual(quotes(explain(id, missingMalefics)), ['巨化吉宿富贵']);

  const unclear = catalog.get(idOf('238', '001'));
  assert.ok(unclear && !unclear.inputs && !unclear.branches.length);
});
