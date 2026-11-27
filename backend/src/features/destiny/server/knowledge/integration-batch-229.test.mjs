import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileJielanNatalStars } from './ziwei-jielan-natal-stars.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-taiwei-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const beijing = { latitude: 39.907, longitude: 116.397 };
const prefix = 'ziwei-v5-jielan-232-p001-';

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

// Suffix, passage, input, alternative and solar birth in Beijing local time.
const witnesses = [
  ['001', 0, 0, 0, [1940, 2, 19, 6]],
  ['001', 0, 1, 0, [1940, 3, 14, 5]],
  ['001', 0, 1, 1, [1940, 4, 15, 4]],
  ['001', 0, 1, 2, [1940, 11, 5, 9]],
  ['001', 0, 1, 3, [1944, 12, 27, 2]],
  ['001', 0, 1, 4, [1940, 7, 24, 1]],
  ['002', 0, 0, 0, [1944, 2, 7, 6]],
  ['003', 0, 0, 0, [1944, 2, 19, 9]],
  ['003', 0, 0, 1, [1944, 10, 20, 5]],
  ['003', 0, 0, 2, [1946, 3, 19, 10]],
  ['003', 0, 0, 3, [1946, 9, 27, 5]],
  ['005', 0, 0, 0, [1944, 2, 7, 0]],
  ['005', 0, 0, 1, [1984, 2, 7, 0]],
  ['005', 0, 0, 2, [1964, 2, 15, 0]],
  ['005', 0, 1, 0, [1944, 2, 27, 11]],
  ['005', 0, 1, 1, [1984, 3, 6, 11]],
  ['005', 0, 1, 2, [1964, 3, 14, 11]],
  ['005', 0, 1, 3, [1944, 3, 26, 10]],
  ['005', 0, 1, 4, [1984, 4, 3, 10]],
  ['005', 0, 1, 5, [1964, 4, 15, 10]],
  ['005', 0, 1, 6, [1944, 4, 23, 9]],
  ['005', 0, 1, 7, [1984, 5, 1, 9]],
  ['005', 0, 1, 8, [1964, 5, 13, 9]],
  ['005', 0, 1, 9, [1944, 6, 6, 8]],
  ['005', 0, 1, 10, [1984, 6, 2, 8]],
  ['005', 0, 1, 11, [1964, 6, 10, 8]],
  ['005', 0, 1, 12, [1944, 7, 20, 7]],
  ['005', 0, 1, 13, [1984, 6, 30, 7]],
  ['005', 0, 1, 14, [1964, 7, 12, 7]],
  ['006', 0, 0, 0, [1945, 2, 15, 5]],
  ['006', 0, 0, 1, [1952, 2, 23, 9]],
  ['006', 0, 0, 2, [1946, 2, 7, 5]],
  ['006', 0, 0, 3, [1946, 2, 7, 9]],
  ['013', 0, 0, 0, [1942, 3, 15, 10]],
  ['013', 0, 0, 1, [1946, 3, 11, 11]],
  ['013', 0, 0, 2, [1941, 4, 4, 0]],
  ['013', 0, 0, 3, [1942, 2, 15, 4]],
  ['013', 0, 0, 4, [1946, 2, 23, 4]],
  ['013', 0, 0, 5, [1947, 3, 23, 5]],
  ['013', 0, 1, 0, [1942, 5, 22, 11]],
  ['013', 0, 1, 6, [1945, 12, 12, 4]],
  ['013', 0, 1, 12, [1942, 8, 6, 9]],
  ['013', 0, 1, 18, [1952, 2, 7, 2]],
  ['013', 0, 1, 24, [1942, 4, 4, 1]],
  ['015', 0, 0, 0, [1940, 2, 23, 8]],
  ['015', 0, 0, 1, [1941, 3, 19, 9]],
  ['015', 0, 1, 1, [1942, 1, 17, 5]],
  ['015', 0, 1, 2, [1940, 2, 23, 4]],
  ['015', 0, 1, 3, [1941, 2, 11, 4]],
  ['015', 0, 1, 4, [1940, 9, 2, 9]],
  ['015', 0, 1, 6, [1940, 10, 16, 8]],
  ['015', 0, 1, 7, [1941, 11, 14, 8]],
  ['015', 0, 1, 8, [1940, 11, 21, 7]],
  ['015', 0, 1, 9, [1941, 12, 4, 7]],
  ['016', 0, 0, 0, [1946, 3, 11, 3]],
  ['016', 0, 0, 1, [1947, 1, 25, 2]],
  ['016', 0, 1, 0, [1947, 1, 5, 11]],
  ['016', 0, 1, 1, [1948, 1, 29, 11]],
  ['016', 0, 1, 2, [1946, 2, 10, 10]],
  ['016', 0, 1, 3, [1947, 2, 19, 10]],
  ['016', 0, 1, 5, [1947, 9, 23, 3]],
  ['016', 0, 1, 6, [1956, 11, 1, 2]],
  ['016', 0, 1, 7, [1947, 10, 21, 2]],
  ['016', 0, 1, 9, [1947, 11, 18, 1]],
  ['018', 0, 0, 0, [1940, 3, 26, 2]],
  ['018', 0, 1, 2, [1940, 8, 21, 11]],
  ['018', 0, 1, 7, [1940, 3, 10, 10]],
  ['018', 0, 1, 16, [1941, 4, 8, 9]],
  ['018', 0, 1, 21, [1940, 5, 13, 8]],
  ['018', 0, 1, 30, [1941, 12, 28, 1]],
  ['019', 0, 0, 0, [1940, 3, 2, 6]],
  ['019', 0, 1, 4, [1951, 3, 19, 11]],
  ['019', 0, 1, 7, [1940, 4, 27, 10]],
  ['019', 0, 1, 18, [1941, 11, 26, 3]],
  ['019', 0, 1, 21, [1940, 6, 14, 2]],
  ['019', 0, 1, 32, [1941, 7, 29, 7]],
  ['020', 0, 0, 0, [1940, 3, 14, 4]],
  ['020', 0, 0, 7, [1940, 2, 23, 2]],
  ['020', 0, 1, 2, [1944, 12, 27, 11]],
  ['020', 0, 1, 11, [1940, 2, 7, 11]],
  ['020', 0, 1, 14, [1947, 1, 1, 10]],
  ['020', 0, 1, 21, [1940, 2, 27, 10]],
  ['020', 0, 1, 30, [1940, 8, 17, 3]],
  ['020', 0, 1, 39, [1941, 3, 7, 9]],
  ['020', 0, 1, 42, [1940, 3, 18, 8]],
  ['020', 0, 1, 49, [1941, 4, 12, 8]],
  ['020', 0, 1, 58, [1940, 4, 19, 7]],
  ['020', 0, 1, 67, [1941, 5, 2, 7]],
  ['025', 0, 0, 0, [1940, 6, 6, 2]],
  ['025', 0, 0, 1, [1940, 6, 10, 10]],
  ['025', 0, 0, 2, [1940, 6, 6, 7]],
  ['025', 0, 0, 3, [1940, 6, 10, 1]],
  ['025', 0, 0, 4, [1940, 6, 6, 7]],
  ['025', 0, 0, 5, [1940, 6, 6, 2]],
  ['027', 0, 0, 0, [1940, 2, 7, 6]],
  ['027', 0, 1, 0, [1940, 2, 15, 7]],
  ['027', 0, 2, 0, [1940, 2, 11, 11]],
  ['027', 0, 2, 1, [1940, 2, 11, 10]],
  ['027', 0, 2, 2, [1940, 2, 15, 9]],
  ['027', 0, 2, 3, [1940, 2, 11, 7]],
  ['028', 0, 0, 0, [1940, 3, 14, 7]],
  ['030', 0, 0, 0, [1940, 2, 15, 6]],
  ['030', 0, 1, 0, [1940, 4, 7, 11]],
  ['030', 0, 1, 1, [1940, 4, 3, 10]],
  ['030', 0, 1, 2, [1940, 4, 11, 3]],
  ['030', 0, 1, 3, [1940, 5, 9, 2]],
  ['030', 0, 1, 4, [1940, 6, 26, 1]],
  ['031', 0, 0, 0, [1940, 3, 22, 10]],
  ['031', 0, 0, 1, [1940, 3, 14, 6]],
  ['031', 0, 1, 3, [1940, 7, 16, 10]],
  ['031', 0, 1, 6, [1940, 3, 30, 2]],
  ['031', 1, 0, 0, [1940, 5, 13, 10]],
  ['034', 0, 0, 0, [1940, 6, 10, 4]],
  ['036', 0, 0, 0, [1940, 2, 23, 8]],
  ['036', 0, 0, 1, [1941, 3, 19, 9]],
  ['036', 0, 1, 1, [1942, 1, 17, 5]],
  ['036', 0, 1, 2, [1940, 2, 23, 4]],
  ['036', 0, 1, 3, [1941, 2, 11, 4]],
  ['036', 0, 1, 4, [1940, 9, 2, 9]],
  ['036', 0, 1, 6, [1940, 10, 16, 8]],
  ['036', 0, 1, 7, [1941, 11, 14, 8]],
  ['036', 0, 1, 8, [1940, 11, 21, 7]],
  ['036', 0, 1, 9, [1941, 12, 4, 7]],
  ['037', 0, 0, 0, [1941, 5, 22, 10]],
  ['037', 0, 1, 3, [1944, 5, 29, 2]],
];

function native([year, month, day, hour, gender = 'female']) {
  const date = { year, month, day };
  const facts = chartFacts.ziwei(calculateZiwei({ date, gender }, hour));
  const instant = Date.UTC(year, month - 1, day, 2 * hour - 8);
  const { sect } = calculateWestern(instant, beijing);
  assert.ok(sect);
  return [...facts, { kind: 'natal_daylight', sect }];
}

function query(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(queries);
  const [{ confirmedFacts: present, confirmedAbsentFacts: absent, chartScope }] = queries;
  return { queries, context: chartContext('ziwei', present, absent, chartScope) };
}

const explain = (suffix, facts, timeKnown) =>
  explainClaim(prefix + suffix, 'ziwei', query(facts, timeKnown).context, undefined, catalog);

test('each reviewed passage and input group reaches production SQLite and the report on actual charts', () => {
  const ids = new Set(witnesses.map(([suffix]) => prefix + suffix));
  const inventory = new Map(catalog.inventory().map(({ claim, lookup: state }) => [claim.id, state.status]));
  const expected = new Set(), seen = new Set(), dates = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    assert.equal(inventory.get(id), row.inputs ? 'indexed' : 'branch_indexed', id);
    const groups = row.inputs ? [{ inputs: row.inputs }] : row.branches;
    groups.forEach(({ inputs }, passage) => {
      if (passage > 0 && /-(?:018|030)$/u.test(id)) return;
      inputs.forEach((_, index) => expected.add([id, passage, index].join('/')));
    });
    const changed = structuredClone(row.claim);
    changed.evidence.context = '另一个底本';
    assert.equal(compileJielanNatalStars(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [19, 10, 34]);
  for (const [suffix, passage, index, choice, birth] of witnesses) {
    const id = prefix + suffix, when = birth.join('/');
    if (!dates.has(when)) {
      const { queries, context } = query(native(birth));
      const hits = new Map(lookup(queries).flatMap(({ personality, events }) =>
        [...personality, ...events].map(hit => [hit.id, hit])));
      dates.set(when, { hits, context, derived: claimChartContext('ziwei', context) });
    }
    const { hits, context, derived } = dates.get(when);
    const row = catalog.get(id), groups = row.inputs ? [{ inputs: row.inputs }] : row.branches;
    const { inputs, text } = groups[passage], input = inputs[index];
    const variant = input.anyOf.length ? { ...input, anyOf: [input.anyOf[choice]] } : input;
    const label = [id, passage, index, choice].join('/');
    assert.ok(evaluateRule(variant, 'natal', derived).matched, label);
    const hit = hits.get(id), detail = explainClaim(id, 'ziwei', context, undefined, catalog);
    assert.ok(hit && detail.matched, label);
    assert.match(detail.calculationNote, /太微赋注解/u);
    const material = buildReportMaterials([{ topic: hit.topic, personality: [], events: [hit] }]);
    assert.ok(material.includes(text ?? row.claim.evidence.original_text), label);
    if (text) {
      assert.deepEqual(hit.matchedBranches, detail.matchedBranches, label);
      assert.ok(hit.matchedBranches.some(branch => branch.text === text), label);
      assert.doesNotMatch(material, /现代释义：/u, label);
    }
    seen.add([id, passage, index].join('/'));
  }
  assert.equal(dates.size, 113);
  assert.deepEqual(seen, expected);
});

test('the Lu Cun opposition requires the actual natal Ji carrier in the opposite palace', () => {
  const facts = native([1940, 2, 19, 6]);
  const withoutCarrier = facts.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  const withoutOpposition = facts.filter(fact => fact.kind !== 'palace_relation' ||
    fact.anchor !== '命宫' || fact.target !== '迁移');
  assert.ok(explain('001', facts).matched);
  assert.equal(explain('001', withoutCarrier).matched, false);
  assert.equal(explain('001', withoutOpposition).matched, false);
});

test('the daytime Sun clause uses reliable daylight, year stem and actual body seat when applicable', () => {
  const life = native([1940, 2, 23, 8]);
  const body = native([1940, 2, 23, 4]);
  assert.ok(explain('015', life).matched);
  assert.ok(explain('015', body).matched);
  assert.equal(explain('015', life.filter(fact => fact.kind !== 'natal_daylight')).matched, false);
  assert.equal(explain('015', [...life, { kind: 'natal_daylight', sect: 'night' }]).matched, false);
  assert.equal(explain('015', life, false).matched, false);
  assert.equal(explain('015', body.filter(fact => fact.kind !== 'natal_ziwei_hour')).matched, false);
  assert.ok(explain('036', life).matched);
  assert.equal(explain('036', native([1940, 2, 23, 8, 'male'])).matched, false);
});

test('the void palace needs a complete natal list and both actual trine stars', () => {
  const facts = native([1940, 2, 15, 6]);
  assert.ok(explain('030', facts).matched);
  const incomplete = facts.filter(({ kind, palace }) => kind !== 'palace_origin_star_count' || palace !== '命宫');
  assert.equal(explain('030', incomplete).matched, false);
  assert.equal(explain('030', facts.filter(({ kind, star }) => kind !== 'palace_star' || star !== '天机')).matched, false);
});

test('Nayin support requires the source seat plus the appropriate birth element and star', () => {
  const facts = native([1944, 2, 19, 9]);
  assert.ok(explain('003', facts).matched);
  assert.equal(explain('003', facts.filter(fact => fact.kind !== 'natal_year_nayin_element')).matched, false);
  assert.equal(explain('003', facts.filter(({ kind, palace, star }) =>
    kind !== 'palace_star' || palace !== '命宫' || !['武曲', '文昌'].includes(star))).matched, false);
});
