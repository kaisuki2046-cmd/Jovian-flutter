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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-volume-five-conclusion-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const idOf = (chapter, suffix) => {
  const passage = ['242', '244'].includes(chapter) ? 'p002' : 'p001';
  return `ziwei-v5-jielan-${chapter}-${passage}-${suffix}`;
};

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Solar birth date and time index, followed by chapter, suffix, passage, group.
const witnesses = [
  [[1930, 1, 19, 1], ['244/005/1/0', '244/007/0/0']],
  [[1930, 1, 19, 8], ['242/002/0/0']],
  [[1930, 2, 19, 2], ['245/001/0/0', '245/002/0/3']],
  [[1930, 2, 19, 10], ['245/001/0/1', '245/002/1/0']],
  [[1930, 3, 19, 3], ['245/002/0/2']],
  [[1930, 4, 19, 4], ['245/002/0/1']],
  [[1930, 5, 19, 5], ['245/002/0/0']],
  [[1930, 7, 19, 7], ['245/002/0/4']],
  [[1930, 7, 19, 10], ['241/002/0/0']],
  [[1931, 1, 19, 5], ['244/007/1/0']],
  [[1975, 5, 19, 1], ['244/004/0/0', '244/004/1/0', '244/005/0/0']],
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

test('all verified concluding passages reach SQLite and report materials', () => {
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
  assert.deepEqual([ids.size, whole, expected.size], [7, 0, 16]);
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
  assert.equal(witnesses.length, 11);
  assert.deepEqual(seen, expected);
});

test('actual body seat and absence from the other palace are required', () => {
  const id = idOf('245', '002'), observed = native([1930, 2, 19, 2]);
  const body = observed.find(fact => fact.kind === 'body_palace');
  assert.equal(body?.palace, '官禄');
  assert.deepEqual(quotes(explain(id, observed)), ['二星见命不见身']);
  const incomplete = observed.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== body.palace);
  assert.equal(explain(id, incomplete).matched, false);
  assert.equal(explain(id, observed, false).matched, false);

  const genderId = idOf('241', '002');
  assert.ok(explain(genderId, native([1930, 7, 19, 10])).matched);
  assert.equal(explain(genderId, native([1930, 7, 19, 10, 'male'])).matched, false);
});

test('the fallen ruler carries natal Ji and the outside trine has independent evidence', () => {
  const id = idOf('244', '004'), observed = native([1975, 5, 19, 1]);
  assert.equal(quotes(explain(id, observed)).length, 2);
  assert.deepEqual(quotes(explain(id, native([1974, 9, 19, 9]))),
    ['再如命无吉星，反有杀忌凶星躔，又不入庙者，下局']);
  const missingCarrier = observed.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  assert.equal(explain(id, missingCarrier).matched, false);

  const harmId = idOf('244', '005');
  assert.ok(quotes(explain(harmId, observed)).includes('如命星在陷又化忌，加羊火空劫冲守'));
  const missingOpposition = observed.filter(fact => fact.kind !== 'palace_star' || fact.palace !== '迁移'
    || !['火星', '地空'].includes(fact.star));
  assert.ok(!quotes(explain(harmId, missingOpposition)).includes('如命星在陷又化忌，加羊火空劫冲守'));
});

test('the writer passage checks both stars and unresolved chart layouts stay unindexed', () => {
  const id = idOf('244', '007'), observed = native([1931, 1, 19, 5]);
  assert.deepEqual(quotes(explain(id, observed)), ['文昌文曲于巳亥为阳地', '此贪居巳亥遇昌曲']);
  const missingTrine = observed.filter(fact => fact.kind !== 'palace_star' || fact.star !== '文曲');
  assert.deepEqual(quotes(explain(id, missingTrine)), ['文昌文曲于巳亥为阳地']);
  for (const [chapter, suffix] of [['240', '001'], ['241', '001'], ['241', '003'], ['244', '003'], ['244', '010']]) {
    const entry = catalog.get(idOf(chapter, suffix));
    assert.ok(entry && !entry.inputs && !entry.branches.length, entry?.claim.id);
  }
});
