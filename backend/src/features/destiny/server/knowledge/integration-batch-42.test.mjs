import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-42-witnesses.json', import.meta.url)));
const ids = {
  candidate: 'astro-lilly-v3-wealth-duration-p013-001',
  secondSaturn: 'astro-lilly-v3-wealth-duration-p017-001',
  secondMars: 'astro-lilly-v3-wealth-duration-p018-001',
  secondSun: 'astro-lilly-v3-wealth-duration-p019-001',
  relatives: 'astro-lilly-v3-relatives-p006-001',
  family: 'astro-lilly-v3-family-p019-001',
  pair: 'astro-lilly-v3-family-p007-001',
};
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const query = confirmedFacts => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts });
const native = witness => chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
const witnessFor = id => witnesses.find(witness => witness.proofs.some(proof => proof.id === id));
const catalog = catalogForDirectory();
const reportLookup = createReportLookup();

function find(id, facts, timeKnown = true) {
  const [parsed] = parseChartQueries([query(facts)], { timeKnown });
  return lookupInterpretations(catalogDirectory, parsed).find(hit => hit.id === id);
}

test('all reviewed dignity and palace alternatives query from native western charts into report materials', () => {
  const rows = new Map(Object.values(ids).map(id => [id, catalog.get(id)]));
  const expected = new Set([...rows].flatMap(([id, row]) => {
    assert.equal(row.remainingAlternatives, 0);
    assert.deepEqual(row.branches, []);
    return row.inputs.map(input => id + ':' + digest(input));
  }));
  assert.equal(expected.size, 25);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = parseChartQueries([query(native(witness))]);
    assert.ok(parsed);
    const chart = chartContext('western', parsed[0].confirmedFacts);
    const calculated = claimChartContext('western', chart, [], (sign, degree) => catalog.lillyDignityCells(sign, degree));
    const references = reportLookup(parsed);
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

test('named planets use independently reconstructed houses and unknown time blocks those placements', () => {
  for (const [id, planet, expectedHouse] of [
    [ids.secondSaturn, 'Saturn', 2], [ids.secondMars, 'Mars', 2], [ids.secondSun, 'Sun', 2], [ids.relatives, 'Saturn', 3],
  ]) {
    const raw = native(witnessFor(id));
    const hit = find(id, raw);
    const placement = { kind: 'western_lilly_planet_house', planet, house: expectedHouse };
    assert.ok(hit.matchedConditions.required.some(fact => JSON.stringify(fact) === JSON.stringify(placement)));
    if (id !== ids.relatives) assert.ok(!hit.matchedConditions.required.some(fact => fact.kind === 'western_lilly_dignity'));
    const withoutLongitude = raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== planet);
    assert.equal(find(id, [...withoutLongitude, placement]), undefined);
    assert.equal(find(id, raw, false), undefined);
  }
});

test('a candidate and each distinct twelfth-house participant must satisfy their own dignity checks', () => {
  const pairRaw = native(witnessFor(ids.pair));
  const pair = find(ids.pair, pairRaw).matchedConditions.required;
  const fourthLord = pair.find(fact => fact.kind === 'western_lilly_house_ruler').planet;
  assert.notEqual(fourthLord, 'Saturn');
  for (const planet of ['Saturn', fourthLord]) {
    assert.ok(pair.some(fact => fact.kind === 'western_lilly_planet_house' && fact.house === 12 && fact.planet === planet));
    assert.ok(pair.some(fact => fact.kind === 'western_lilly_dignity' && fact.dignity === 'peregrine' && fact.matches && fact.planet === planet));
    const missing = pairRaw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== planet);
    assert.equal(find(ids.pair, [...missing, ...pair.filter(fact => fact.planet === planet)]), undefined);
  }
  assert.ok(find(ids.family, pairRaw));
  const candidate = find(ids.candidate, native(witnessFor(ids.candidate))).matchedConditions.required;
  const house = candidate.find(fact => fact.kind === 'western_lilly_planet_house');
  const dignity = candidate.find(fact => fact.kind === 'western_lilly_dignity');
  assert.equal(house.house, 2);
  assert.equal(house.planet, dignity.planet);
  assert.equal(dignity.matches, false);
});

test('the report passes the wealth candidate with its limits and changed sources cannot inherit the mapping', async () => {
  const chartQueries = parseChartQueries([query(native(witnessFor(ids.candidate)))]);
  const lookup = queries => reportLookup(queries).map(reference => ({
    ...reference, personality: reference.personality.filter(hit => hit.id === ids.candidate),
    events: reference.events.filter(hit => hit.id === ids.candidate),
  }));
  const { report } = await generateReport({ chartQueries }, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /if essentially dignified/u);
      assert.match(materials, /尚未执行多星的力量排序/u);
      assert.doesNotMatch(materials, /who is most powerfull/u);
      return '二宫候选测试报告';
    },
  });
  assert.equal(report, '二宫候选测试报告');
  for (const id of Object.values(ids)) {
    const edited = structuredClone(catalog.get(id).claim);
    edited.evidence.context += '另一版';
    assert.equal(compileWesternClaim(edited).reason, 'source_review_required');
  }
});
