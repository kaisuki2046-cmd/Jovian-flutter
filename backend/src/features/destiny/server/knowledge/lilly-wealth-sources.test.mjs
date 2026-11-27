import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { lillyCusps } from '../../control/lilly-houses.mjs';
import { buildReportMaterials, conditionsText } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyFortune } from './lilly-fortune.mjs';
import { lillyWealthSourcesProfile } from './lilly-wealth-sources.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-wealth-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const place = { latitude: 31.23, longitude: 121.47 };
const witnesses = ['1993-04-20T18:15:00Z', '1992-02-27T16:15:00Z', '1992-01-20T00:15:00Z', '1992-01-20T04:15:00Z'];
const id = (group, number) => 'astro-lilly-v3-wealth-' + group + '-p' + String(number).padStart(3, '0') + '-001';
const level = number => id('level', number), source = number => id('sources', number);
const span = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
const reviewed = new Set([...span(18, 24).map(level), level(28),
  ...[...span(3, 14), ...span(16, 26), ...span(35, 41)].map(source)]);
const raw = instant => chartFacts.western(calculateWestern(Date.parse(instant), place));
const hits = references => references.flatMap(({ events, personality }) => [...events, ...personality]);
const proofKey = (id, required) => JSON.stringify([id, required]);

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(id, facts, scope = 'natal') {
  return explainClaim(id, 'western', chartContext('western', facts, [], scope), undefined, catalog);
}

test('all 38 reviewed wealth records and 39 groups reach SQLite, explanations and report materials', () => {
  assert.equal(reviewed.size, 38);
  const expected = new Set();
  for (const id of reviewed) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyWealthSourcesProfile);
    assert.equal(row.remainingAlternatives, 0);
    assert.equal(row.inputs.length, id === level(28) ? 2 : 1);
    for (const input of row.inputs) expected.add(proofKey(id, input.required));
  }
  assert.equal(expected.size, 39);
  const seen = new Set();
  for (const instant of witnesses) {
    const parsed = query(raw(instant));
    const refs = lookup(parsed);
    const materials = buildReportMaterials(refs);
    for (const hit of hits(refs).filter(hit => reviewed.has(hit.id))) {
      const proof = explain(hit.id, parsed[0].confirmedFacts);
      assert.ok(proof.matched, hit.id);
      assert.match(proof.calculationNote, /财富篇/u);
      assert.deepEqual(proof.matchedConditions, hit.matchedConditions);
      const { required, alternatives } = proof.matchedConditions;
      for (const group of alternatives.length ? alternatives : [required]) {
        const key = proofKey(hit.id, group);
        assert.ok(expected.has(key), key);
        seen.add(key);
      }
      assert.ok(materials.includes(conditionsText(proof.matchedConditions)), hit.id);
      assert.ok(materials.includes(proof.claim.evidence.original_text), hit.id);
    }
    assert.doesNotMatch(materials, /western_lilly_wealth_source|lilly-1647-second-house-wealth-sources-v1/u);
  }
  assert.deepEqual(seen, expected);
  const changed = structuredClone(catalog.get(source(16)).claim);
  changed.evidence.context += ' Changed source context.';
  assert.equal(compileWesternClaim(changed).reason, 'source_review_required');
  assert.equal(catalog.get(level(1)).reason, 'unsupported_calculation_profile');
  assert.equal(catalog.get(source(15)).reason, 'unsupported_calculation_profile');
});

test('wealth themes require the selected bodies, and chapter completion needs valid positions and Fortune', () => {
  const all = raw(witnesses[0]);
  assert.equal(lillyFortune(all).house, 12);
  assert.equal(explain(source(14), all).matched, false, 'the lot does not count as a planet in house 12');
  assert.equal(explain(level(19), all).matched, false);
  const intercepted = raw(witnesses[1]);
  assert.equal(explain(level(19), intercepted).matched, true);
  assert.equal(explain(source(16), intercepted).matched, true, 'Saturn rules the intercepted Capricorn');
  assert.equal(explain(source(18), intercepted).matched, false, 'Mars is neither a selected ruler nor in the second house');
  const inconsistent = [...intercepted, { kind: 'planet_longitude', planet: 'Saturn', longitude: 1 }];
  assert.equal(explain(level(19), inconsistent).matched, false);
  assert.equal(explain(source(16), inconsistent).matched, false);
  assert.equal(explain(level(28), inconsistent).matched, false);
  const missingMoon = all.filter(f => f.kind !== 'planet_longitude' || f.planet !== 'Moon');
  assert.equal(explain(level(20), missingMoon).matched, false);
  assert.equal(explain(level(21), missingMoon).matched, false);
  assert.equal(explain(level(28), missingMoon).matched, false);
  assert.equal(explain(source(17), missingMoon).matched, true, 'Jupiter is an independently confirmed witness');
  assert.ok(!hits(lookup(query(all, false))).some(hit => reviewed.has(hit.id)));
  assert.equal(explain(source(16), all, 'annual').matched, false);
  const withoutCusps = all.filter(f => f.kind !== 'western_profile_cusp_longitude');
  const forged = [...withoutCusps, { kind: 'western_lilly_wealth_source', selector: 'planet.jupiter' }];
  assert.equal(explain(source(17), forged).matched, false);
  assert.ok(!hits(lookup(query(forged))).some(hit => reviewed.has(hit.id)));
});

test('the second-house window starts five degrees before its cusp and distance comparisons need two distinct distances', () => {
  const chart = raw(witnesses[2]);
  const second = lillyCusps(chart)[1];
  const before = second - 5.01, inside = second - 4.99;
  const reposition = (mercury, venus) => [
    ...chart.filter(f => !(['Mercury', 'Venus'].includes(f.planet) && ['planet_sign', 'planet_longitude'].includes(f.kind))),
    { kind: 'planet_longitude', planet: 'Mercury', longitude: mercury },
    { kind: 'planet_longitude', planet: 'Venus', longitude: venus },
  ];
  assert.equal(explain(level(23), reposition(before, before)).matched, false);
  assert.equal(explain(level(23), reposition(inside, before)).matched, true);
  assert.equal(explain(level(24), reposition(inside, before)).matched, false);
  assert.equal(explain(level(24), reposition(inside, inside)).matched, false);
  assert.equal(explain(level(24), reposition(inside, second + 1)).matched, true);
});
