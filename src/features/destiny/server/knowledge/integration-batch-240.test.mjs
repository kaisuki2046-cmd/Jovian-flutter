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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-malefic-stars-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (chapter, suffix) => `ziwei-v4-jielan-${chapter}-p001-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by chapter, suffix, passage, group.
const witnesses = [
  [[1930, 1, 19, 8], ['216/004/0/0', '216/005/0/0']],
  [[1930, 2, 19, 5], ['214/002/0/0', '215/002/0/0', '215/002/1/0', '216/002/0/1']],
  [[1930, 3, 19, 0], ['222/003/0/0', '222/004/2/0']],
  [[1930, 3, 19, 2], ['222/004/0/1']],
  [[1930, 5, 19, 7], ['222/006/0/0']],
  [[1930, 7, 19, 6], ['224/002/0/0']],
  [[1930, 12, 19, 4], ['216/002/0/0']],
  [[1931, 1, 19, 2], ['220/002/0/1']],
  [[1931, 1, 19, 3], ['220/004/0/1']],
  [[1931, 2, 19, 4], ['215/001/1/0']],
  [[1931, 2, 19, 8], ['214/001/1/1', '214/003/1/1']],
  [[1931, 3, 19, 5], ['216/004/0/1', '216/005/0/1']],
  [[1931, 3, 19, 6], ['211/002/0/0']],
  [[1931, 6, 19, 10], ['217/001/1/0', '222/002/2/0']],
  [[1931, 10, 19, 0], ['214/001/0/0', '214/001/1/0', '214/003/1/0', '215/001/0/0', '222/002/0/0', '222/002/1/0', '222/004/0/0', '222/004/1/0', '214/004/0/0', '222/007/0/0']],
  [[1931, 10, 19, 2], ['222/002/2/1']],
  [[1931, 11, 19, 6], ['210/001/0/0', '210/001/1/0', '211/001/0/0']],
  [[1932, 3, 19, 4], ['224/002/1/0']],
  [[1932, 6, 19, 2], ['218/003/0/0', '220/002/0/0', '220/004/0/0', '224/001/0/0']],
  [[1932, 10, 19, 8], ['222/002/0/1', '222/002/1/1', '222/003/0/1', '222/004/2/1', '224/001/0/1', '224/002/0/1', '222/007/0/1']],
  [[1934, 2, 19, 1], ['214/001/0/1', '214/002/0/1', '215/002/0/1', '215/002/1/1', '216/003/0/0', '217/001/0/0', '214/004/0/1']],
  [[1934, 2, 19, 11], ['216/003/0/1']],
  [[1938, 3, 19, 10], ['218/001/0/0', '219/001/0/0', '219/001/1/0', '222/004/1/1']],
  [[1938, 7, 19, 1], ['214/003/0/0']],
  [[1938, 7, 19, 10], ['216/002/1/0', '219/001/0/1', '219/001/1/1']],
  [[1938, 7, 19, 11], ['214/003/0/1']],
  [[1939, 11, 19, 0], ['210/001/2/0']],
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

test('all malefic star passages reach SQLite and report materials on witnessed charts', () => {
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
  assert.deepEqual([ids.size, whole, expected.size], [26, 0, 66]);
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
  assert.equal(witnesses.length, 27);
  assert.deepEqual(seen, expected);
});

test('Yang and Tuo must flank in their proper directions and all extra witnesses must be present', () => {
  const id = idOf('219', '001'), birth = native([1938, 3, 19, 10]);
  const expected = ['夹身夹命有陀羊', '火铃空劫又来伤'];
  assert.deepEqual(quotes(explain(id, birth)), expected);
  const incomplete = birth.filter(f => f.kind !== 'palace_star' || f.star !== '地空');
  assert.deepEqual(quotes(explain(id, incomplete)), expected.slice(0, 1));

  const palaces = new Map(birth.filter(f => f.kind === 'palace_star' && ['擎羊', '陀罗'].includes(f.star))
    .map(f => [f.star, f.palace]));
  const reversed = birth.map(f => f.kind === 'palace_star' && palaces.has(f.star)
    ? { ...f, palace: palaces.get(f.star === '擎羊' ? '陀罗' : '擎羊') }
    : f);
  assert.equal(explain(id, reversed).matched, false);
  assert.equal(explain(id, birth, false).matched, false);
});

test('the four tombs are checked against the birth year branch', () => {
  const id = idOf('215', '001'), birth = native([1931, 2, 19, 4]);
  assert.ok(birth.some(f => f.kind === 'natal_year_branch' && '辰戌丑未'.includes(f.branch)));
  assert.equal(quotes(explain(id, birth)).length, 2);
  assert.equal(explain(id, birth.filter(f => f.kind !== 'natal_year_branch')).matched, false);
});

test('the empty pair distinguishes favorable and unfavorable witnesses using a complete star list', () => {
  const id = idOf('210', '001');
  const auspicious = native([1931, 11, 19, 6]);
  const afflicted = native([1939, 11, 19, 0]);
  assert.deepEqual(quotes(explain(id, auspicious)), ['二星守命', '遇吉则吉']);
  assert.deepEqual(quotes(explain(id, afflicted)), ['二星守命', '遇凶则凶']);
  for (const birth of [auspicious, afflicted]) {
    const incomplete = birth.filter(f => f.kind !== 'palace_origin_star_count' || f.palace !== '命宫');
    assert.deepEqual(quotes(explain(id, incomplete)), ['二星守命']);
  }
  assert.deepEqual(catalog.get(idOf('216', '002')).branches.map(branch => branch.text), ['与贪狼同度', '居疾厄']);
});
