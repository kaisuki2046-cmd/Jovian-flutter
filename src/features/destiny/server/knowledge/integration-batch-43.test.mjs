import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { Ecliptic, GeoMoon, NextMoonNode, SearchMoonNode } from 'astronomy-engine';
import { calculateWestern, chartFacts, chartVersions, trueLunarNodeProfile } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { lillyNodeFacts } from './lilly-nodes.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const { alternatives, witnesses } = JSON.parse(readFileSync(new URL('./claims/integration-batch-43-witnesses.json', import.meta.url)));
const ids = {
  betterFriends: 'astro-lilly-v3-friends-p012-001', mixedFriends: 'astro-lilly-v3-friends-p013-001',
  faith: 'astro-lilly-v3-religion-dreams-p004-001', southFriends: 'astro-lilly-v3-friends-p040-001',
  relatives: 'astro-lilly-v3-relatives-p008-001', ruler: 'astro-lilly-v3-relatives-p014-001',
  servants: 'astro-lilly-v3-health-servants-p012-001',
};
const origin = { latitude: 0, longitude: 0 };
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const witnessFor = id => witnesses.find(witness => witness.proofs.some(proof => proof.id === id));
const rawFacts = witness => chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const nodeLongitude = longitude => ({ kind: 'western_true_node_longitude', profile: trueLunarNodeProfile, longitude });
const catalog = catalogForDirectory();

function hit(id, facts, timeKnown = true) {
  const [parsed] = parseChartQueries([query(facts)], { timeKnown });
  return lookupInterpretations(catalogDirectory, parsed).find(row => row.id === id);
}

test('osculating north longitude agrees with Swiss true-node tables and the signed lunar crossings', () => {
  // Astrodienst Ephemeris 2000, page 2, 00:00 UT, True Node column (L).
  const values = [[1, 123 + 59 / 60], [8, 123 + 39 / 60], [15, 123 + 44 / 60], [31, 123 + 42 / 60]];
  for (const [day, expected] of values) {
    const result = calculateWestern(Date.UTC(2000, 0, day), origin);
    assert.ok(Math.abs(result.trueNorthNodeLongitude - expected) < 0.02);
    assert.equal(calculateWestern(Date.UTC(2000, 0, day), { latitude: 52, longitude: -60 }).trueNorthNodeLongitude, result.trueNorthNodeLongitude);
  }
  const crossingA = SearchMoonNode(new Date('2000-01-01T00:00:00Z'));
  const crossingB = NextMoonNode(crossingA);
  assert.deepEqual(new Set([crossingA.kind, crossingB.kind]), new Set([-1, 1]));
  for (const crossing of [crossingA, crossingB]) {
    const moon = Ecliptic(GeoMoon(crossing.time));
    const chart = calculateWestern(crossing.time.date.getTime(), origin);
    const expected = (chart.trueNorthNodeLongitude + (crossing.kind === 1 ? 0 : 180)) % 360;
    assert.ok(Math.abs((expected - moon.elon + 540) % 360 - 180) < 0.0001);
  }
});

test('both nodes are opposite and honor the separate longitude house and sign boundaries', () => {
  const base = [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...Array.from({ length: 12 }, (_, i) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: i * 30 }))];
  const projected = longitude => lillyNodeFacts([...base, nodeLongitude(longitude)]);
  for (const [longitude, houses] of [[114.9999, [4, 10]], [115, [5, 11]], [355, [1, 7]]]) {
    assert.deepEqual(projected(longitude).filter(fact => fact.kind === 'western_lilly_node_house').map(fact => fact.house), houses);
  }
  assert.deepEqual(projected(115).filter(fact => fact.kind === 'western_lilly_node_sign').map(fact => fact.sign), ['巨蟹座', '摩羯座']);
  assert.deepEqual(lillyNodeFacts([...base, nodeLongitude(115), nodeLongitude(116)]), []);
  assert.deepEqual(lillyNodeFacts([...base.slice(0, -1), nodeLongitude(115)]), []);
  assert.equal(parseChartQueries([query([...base, { ...nodeLongitude(115), profile: 'mean-node' }])]), null);
});

test('all native node alternatives are read through SQLite and cited in the report', () => {
  const rows = new Map(Object.values(ids).map(id => [id, catalog.get(id)]));
  const expected = new Set([...rows].flatMap(([id, row]) => {
    const isFriend = [ids.betterFriends, ids.mixedFriends, ids.southFriends].includes(id);
    assert.equal(row.remainingAlternatives, isFriend ? 1 : 0);
    return row.inputs.filter(input => input.required.some(fact => fact.kind === 'western_lilly_node_house'))
      .map(input => id + ':' + digest(input));
  }));
  assert.equal(rows.get(ids.faith).inputs.length, 6);
  assert.equal(expected.size, 36);
  assert.equal(alternatives, expected.size);
  const lookup = createReportLookup();
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = parseChartQueries([query(rawFacts(witness))]);
    assert.ok(parsed);
    const chart = chartContext('western', parsed[0].confirmedFacts);
    const calculated = claimChartContext('western', chart);
    const references = lookup(parsed);
    const hits = references.flatMap(reference => [...reference.personality, ...reference.events]);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = row.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', calculated).matched, true);
      assert.ok(hits.some(hit => hit.id === id), id);
      assert.ok(explainClaim(id, 'western', chart, undefined, catalog).matched);
      assert.ok(materials.includes(row.claim.evidence.original_text));
      seen.add(id + ':' + inputDigest);
    }
  }
  assert.deepEqual(seen, expected);
});

test('the report requires observed longitude and the actual second-house ruler for combust evidence', () => {
  const raw = rawFacts(witnessFor(ids.ruler));
  const result = hit(ids.ruler, raw);
  const pos = { kind: 'western_lilly_node_house', node: 'south_node', house: 3 };
  assert.ok(result.matchedConditions.required.some(fact => JSON.stringify(fact) === JSON.stringify(pos)));
  const coordinate = raw.find(fact => fact.kind === 'western_true_node_longitude');
  const missing = raw.filter(fact => fact !== coordinate);
  assert.equal(hit(ids.relatives, [...missing, pos]), undefined);
  assert.equal(hit(ids.relatives, [...raw, nodeLongitude((coordinate.longitude + 20) % 360)]), undefined);
  assert.equal(hit(ids.relatives, raw, false), undefined);
  assert.equal(hit(ids.ruler, raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Sun')), undefined);

  const solar = result.matchedConditions.required.find(fact => fact.kind === 'western_lilly_solar_state');
  assert.equal(solar.selector, 'house_2_ruler');
  const withoutSun = raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Sun');
  assert.equal(hit(ids.ruler, [...withoutSun, solar]), undefined);
});

test('reported friendship branches remain bounded to actual occupancy and source revisions require review', async () => {
  const id = ids.betterFriends;
  const raw = rawFacts(witnessFor(id));
  const node = raw.find(fact => fact.kind === 'western_true_node_longitude');
  const chartQueries = parseChartQueries([query(raw)]);
  const originalLookup = createReportLookup();
  const lookup = queries => originalLookup(queries).map(reference => ({
    ...reference, personality: reference.personality.filter(row => row.id === id),
    events: reference.events.filter(row => row.id === id),
  }));
  const { report } = await generateReport({ chartQueries }, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /北交点位于/u);
      assert.match(materials, /实际落第一或第十一宫/u);
      return '交点测试报告';
    },
  });
  assert.equal(report, '交点测试报告');
  assert.equal(hit(id, raw.filter(fact => fact !== node)), undefined);
  for (const reviewedId of Object.values(ids)) {
    const edited = structuredClone(catalog.get(reviewedId).claim);
    edited.evidence.context += '另一版';
    assert.equal(compileWesternClaim(edited).reason, 'source_review_required');
  }
});
