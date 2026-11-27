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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-horse-and-mutations-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (chapter, suffix) => {
  const passage = ['192', '195', '197', '201', '203'].includes(chapter) ? 'p002' : 'p001';
  return `ziwei-v4-jielan-${chapter}-${passage}-${suffix}`;
};

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by chapter, suffix, passage, group.
const witnesses = [
  [[1930, 1, 19, 1], ['190/001/0/0', '206/001/0/0', '207/001/0/0']],
  [[1930, 6, 19, 5], ['201/001/1/0', '195/003/0/0']],
  [[1930, 6, 19, 10, 'female'], ['192/002/0/0', '192/002/1/0']],
  [[1930, 12, 19, 10, 'female'], ['204/001/0/0', '204/001/1/0', '206/001/0/1', '209/001/0/0', '204/003/0/0', '204/003/1/0']],
  [[1931, 2, 19, 8, 'female'], ['194/001/0/0', '194/002/0/0']],
  [[1931, 4, 19, 2, 'female'], ['194/001/0/1', '200/002/0/1']],
  [[1931, 4, 19, 4, 'female'], ['197/001/0/1', '194/001/0/2', '197/002/0/1', '200/001/0/1', '194/002/0/1', '197/003/0/1', '200/003/0/1']],
  [[1931, 4, 19, 6, 'female'], ['197/001/0/0', '201/001/0/0', '197/002/0/0', '198/001/0/0', '198/002/0/0', '200/001/0/0', '200/002/0/0', '201/002/0/0', '201/002/1/0', '197/003/0/0', '200/003/0/0', '201/003/0/0']],
  [[1932, 2, 19, 2, 'female'], ['200/002/1/1']],
  [[1932, 2, 19, 10, 'female'], ['200/002/1/0']],
  [[1933, 3, 19, 2, 'female'], ['207/001/1/0']],
  [[1934, 12, 19, 8, 'female'], ['192/001/0/0', '192/002/0/1', '192/002/1/1']],
  [[1936, 3, 19, 6, 'female'], ['195/002/0/0', '190/001/1/0', '198/002/1/0']],
  [[1936, 12, 19, 11], ['203/002/0/1']],
  [[1946, 2, 19, 3], ['203/002/0/0']],
  [[1954, 6, 19, 3], ['190/002/0/0']],
];

function native([year, month, day, hour, gender = 'male']) {
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

test('all new horse, mutation and related star groups reach SQLite and report materials', () => {
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
  assert.deepEqual([ids.size, whole, expected.size], [25, 10, 48]);
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
  assert.equal(witnesses.length, 16);
  assert.deepEqual(seen, expected);
});

test('the two Lu types and the flanking geometry each require their own evidence', () => {
  const mandarin = idOf('195', '002'), birth = native([1930, 12, 19, 7]);
  assert.ok(explain(mandarin, birth).matched);
  assert.equal(explain(mandarin, birth.filter(f => f.kind !== 'palace_star' || f.star !== '禄存')).matched, false);
  const withoutLuCarrier = birth.filter(f => f.kind !== 'star_mutagen' || f.change !== '禄');
  assert.equal(explain(mandarin, withoutLuCarrier).matched, false);

  const flanked = idOf('190', '002'), flanks = native([1954, 6, 19, 3]);
  assert.deepEqual(quotes(explain(flanked, flanks)), ['夹禄拱贵']);
  const withoutAdjacency = flanks.filter(f => f.kind !== 'palace_relation' || f.relation !== 'adjacent'
    || f.anchor !== '命宫' || f.target !== '父母');
  assert.equal(explain(flanked, withoutAdjacency).matched, false);
});

test('the horse entry requires all three stars in the same palace', () => {
  const horse = idOf('192', '001'), birth = native([1930, 2, 19, 7]);
  const palace = birth.find(f => f.kind === 'palace_star' && f.star === '天马' && f.scope === 'origin').palace;
  assert.ok(explain(horse, birth).matched);
  for (const omitted of ['紫微', '天府']) {
    const incomplete = birth.filter(f => f.kind !== 'palace_star' || f.palace !== palace || f.star !== omitted);
    assert.equal(explain(horse, incomplete).matched, false);
  }
  assert.equal(explain(horse, birth, false).matched, false);
});

test('Ji relief requires a positive witness distinct from the afflicted carrier', () => {
  const ji = idOf('204', '003');
  const favorable = '吉星凑合减灾危。';
  assert.ok(quotes(explain(ji, native([1930, 12, 19, 10, 'female']))).includes(favorable));

  const facts = native([1931, 10, 16, 0, 'female']);
  assert.ok(facts.some(f => f.kind === 'star_mutagen' && f.palace === '命宫' && f.star === '文昌' && f.change === '忌'));
  const supports = ['左辅', '右弼', '文曲', '天魁', '天钺', '禄存'];
  const axis = ['命宫', '财帛', '官禄', '迁移'];
  const withoutIndependentWitness = facts.filter(f => f.kind !== 'palace_star'
    || !axis.includes(f.palace) || !supports.includes(f.star));
  assert.deepEqual(quotes(explain(ji, withoutIndependentWitness)), ['女人化忌本非奇，更遇凶星是祸基。']);
});

test('source ambiguity does not promote additional verses or water identity into confirmed matches', () => {
  const lian = idOf('203', '002'), facts = native([1946, 2, 19, 3]);
  const result = explain(lian, facts);
  assert.deepEqual(quotes(result), ['如廉贞在亥化忌，是为火入水乡']);
  assert.match(result.calculationNote, /水命.*待校/u);
  for (const id of [idOf('195', '001'), idOf('203', '003'), idOf('204', '002')]) {
    const row = catalog.get(id);
    assert.ok(row && !row.inputs && !row.branches.length, id);
  }
});
