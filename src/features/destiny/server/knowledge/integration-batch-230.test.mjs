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

const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-taiwei-followups-'));
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
  ['004', 0, 0, 0, [1940, 9, 19, 8]],
  ['004', 0, 1, 3, [1940, 5, 12, 8]],
  ['004', 1, 0, 0, [1940, 2, 7, 0]],
  ['004', 1, 1, 0, [1940, 2, 22, 11]],
  ['007', 0, 0, 0, [1940, 3, 3, 5]],
  ['007', 0, 1, 4, [1940, 2, 27, 3]],
  ['017', 0, 0, 0, [1940, 2, 9, 11]],
  ['017', 0, 0, 1, [1940, 2, 9, 11]],
  ['018', 1, 0, 0, [1940, 2, 7, 0]],
  ['018', 1, 1, 0, [1940, 2, 22, 11]],
  ['018', 2, 0, 5, [1940, 2, 12, 7]],
  ['026', 0, 0, 2, [1940, 4, 17, 8]],
  ['026', 0, 0, 10, [1949, 8, 21, 11]],
  ['026', 0, 0, 20, [1945, 2, 23, 5]],
  ['026', 0, 0, 22, [1942, 2, 17, 10]],
  ['030', 1, 0, 2, [1940, 2, 17, 5]],
  ['030', 1, 1, 30, [1940, 2, 22, 7]],
  ['030', 2, 0, 0, [1940, 2, 17, 5]],
  ['030', 2, 1, 24, [1940, 2, 22, 7]],
  ['032', 0, 0, 0, [1940, 9, 4, 4]],
  ['033', 0, 0, 0, [1954, 2, 7, 6]],
  ['035', 0, 0, 4, [1941, 2, 1, 8]],
  ['035', 0, 1, 60, [1941, 2, 7, 4]],
  ['040', 0, 0, 12, [1949, 8, 21, 11]],
  ['040', 0, 0, 15, [1949, 8, 21, 11]],
  ['041', 0, 0, 1, [1944, 1, 28, 0]],
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

test('new entries and newly reviewed passages reach production SQLite and the report on actual charts', () => {
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
      if (passage === 0 && /-(?:018|030)$/u.test(id)) return;
      inputs.forEach((_, index) => expected.add([id, passage, index].join('/')));
    });
    const changed = structuredClone(row.claim);
    changed.evidence.context = '另一个底本';
    assert.equal(compileJielanNatalStars(changed).reason, 'source_review_required', id);
  }
  assert.deepEqual([ids.size, whole, expected.size], [11, 5, 21]);
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
  assert.equal(dates.size, 19);
  assert.deepEqual(seen, expected);
});

test('the transit-palace exception must inherit the positive configuration and verify the added Ji carrier', () => {
  const observed = native([1949, 8, 21, 11]);
  assert.ok(explain('026', observed).matched);
  assert.ok(explain('040', observed).matched);
  const noJiHost = observed.filter(fact => fact.kind !== 'star_mutagen' || fact.change !== '忌');
  assert.ok(explain('026', noJiHost).matched);
  assert.equal(explain('040', noJiHost).matched, false);
  const noQualification = observed.filter(fact => fact.kind !== 'star_mutagen' || fact.star !== '武曲');
  assert.equal(explain('026', noQualification).matched, false);
  assert.equal(explain('040', noQualification).matched, false);
});

test('Sun and Moon from the trines need a natal auspicious transformation on one of the luminaries', () => {
  const observed = native([1940, 2, 12, 7]);
  const expected = '如是三合于命，兼化吉以为美。';
  const quotes = facts => explain('018', facts).matchedBranches?.map(branch => branch.text) ?? [];
  assert.ok(quotes(observed).includes(expected));
  const lackingHost = observed.filter(({ kind, star }) =>
    kind !== 'star_mutagen' || !['太阳', '太阴'].includes(star));
  assert.equal(quotes(lackingHost).includes(expected), false);
});

test('the Intercept Void example requires the named natal void star and the Jia birth stem', () => {
  const observed = native([1954, 2, 7, 6]);
  assert.ok(explain('033', observed).matched);
  const replaced = observed.map(fact => fact.kind === 'palace_star' && fact.star === '截路'
    ? { ...fact, star: '旬空' } : fact);
  assert.equal(explain('033', replaced).matched, false);
  assert.equal(explain('033', observed.filter(fact => fact.kind !== 'natal_year_stem')).matched, false);
});
