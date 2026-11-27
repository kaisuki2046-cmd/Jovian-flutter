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

const directory = mkdtempSync(join(tmpdir(), 'destiny-quanshu-tongyuan-mutations-and-branches-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (passage, suffix) => `ziwei-v3-c020-p${passage}-${suffix}`;

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by source passage, suffix, matched passage, group.
const witnesses = [
  [[1930, 1, 19, 9], ['119004/002/0/0']],
  [[1930, 2, 19, 3], ['166000/001/4/0', '166002/003/0/0']],
  [[1930, 7, 19, 11], ['154003/003/0/0']],
  [[1930, 12, 19, 6], ['160000/003/0/0']],
  [[1931, 1, 19, 7], ['131005/001/0/0']],
  [[1931, 4, 19, 6], ['158006/002/0/0']],
  [[1931, 9, 19, 8], ['164001/001/8/0']],
  [[1938, 11, 19, 5], ['168001/003/0/0']],
  [[1945, 1, 19, 0], ['119004/001/0/0']],
  [[1950, 7, 19, 4], ['158006/002/1/0']],
  [[1934, 2, 17, 0], ['129003/003/0/0']],
  [[1944, 6, 19, 9], ['168001/002/0/0']],
  [[1961, 5, 24, 8], ['166000/001/3/0']],
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

test('verified related-palace, brightness and transformation passages reach SQLite and report materials', () => {
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
      if (key === '164001/001' && text !== '科权禄') return;
      if (key === '166000/001' && !['夹忌', '六夹贵逢吉甚妙'].includes(text)) return;
      inputs.forEach((_, group) => expected.add([key, passage, group].join('/')));
    });
    const changed = structuredClone(row.claim);
    changed.evidence.context = '异本';
    assert.equal(compileQuanshuTongyuan(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [12, 0, 14]);
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
  assert.equal(witnesses.length, 13);
  assert.deepEqual(seen, expected);
});

test('adjacent transformations need the reported carriers and the body flank needs a verified seat', () => {
  const life = idOf('164001', '001'), observed = native([1931, 9, 19, 8]);
  assert.ok(quotes(explain(life, observed)).includes('科权禄'));
  const withoutScience = observed.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '科');
  assert.ok(!quotes(explain(life, withoutScience)).includes('科权禄'));

  const body = idOf('166000', '001'), bodyFacts = native([1961, 5, 24, 8]);
  const branch = catalog.get(body).branches.find(passage => passage.text === '六夹贵逢吉甚妙');
  const [rule] = branch.inputs;
  const transformationFlank = {
    ...rule,
    anyOf: rule.anyOf.filter(alternative => alternative.some(fact => fact.kind === 'star_mutagen')),
  };
  assert.ok(evaluateRule(transformationFlank, 'natal', claimChartContext('ziwei', query(bodyFacts).context)).matched);
  assert.equal(evaluateRule(transformationFlank, 'natal', claimChartContext('ziwei', query(bodyFacts, false).context)).matched, false);
  assert.ok(!quotes(explain(body, bodyFacts, false)).includes(branch.text));
});

test('the short passage excludes the unconfirmed neighboring clauses', () => {
  const qisha = idOf('131005', '001'), observed = native([1931, 1, 19, 7]);
  assert.deepEqual(quotes(explain(qisha, observed)), ['杀居午']);
  const loneFire = idOf('129003', '003'), withGrowth = native([1934, 2, 17, 0]);
  assert.deepEqual(quotes(explain(loneFire, withGrowth)), ['贪狼加吉坐长生']);

  const absence = idOf('119004', '001'), moonChart = native([1945, 1, 19, 0]);
  assert.ok(explain(absence, moonChart).matched);
  const incomplete = moonChart.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '财帛');
  assert.equal(explain(absence, incomplete).matched, false);
});
