import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, trueLunarNodeProfile } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { buildReportMaterials, conditionsText } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyWitFacts, lillyWitProfile } from './lilly-wit.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-wit-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const place = { latitude: 31.23, longitude: 121.47 };
const witnesses = [
  '1990-01-01T00:15:00Z', '1990-01-05T10:15:00Z', '1990-01-25T07:15:00Z', '1990-01-27T12:15:00Z',
  '1990-01-31T22:15:00Z', '1990-02-20T19:15:00Z', '1990-03-21T12:15:00Z', '1990-06-20T01:15:00Z',
  '1990-07-03T07:15:00Z', '1990-08-03T05:15:00Z', '1990-10-06T06:15:00Z', '1991-07-26T23:15:00Z',
  '1920-01-26T00:00:00Z', '1921-12-29T00:00:00Z', '1924-05-16T00:00:00Z', '1925-02-16T22:00:00Z',
  '1931-04-29T12:00:00Z', '1934-05-16T00:00:00Z', '1939-04-06T22:00:00Z', '1959-03-30T22:00:00Z',
  '1963-05-23T00:00:00Z',
];
const id = number => 'astro-lilly-v3-wit-p' + String(number).padStart(3, '0') + '-001';
const reviewed = new Set([2, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20, 21, 25, 26, 29, 44].map(id));
const proofKey = (id, required) => JSON.stringify([id, required]);
const raw = instant => chartFacts.western(calculateWestern(Date.parse(instant), place));
const hits = references => references.flatMap(({ events, personality }) => [...events, ...personality]);
const longitude = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const zodiac = { kind: 'western_zodiac', zodiac: 'tropical' };
const wit = selector => ({ kind: 'western_lilly_wit', selector });

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(number, facts) {
  return explainClaim(id(number), 'western', chartContext('western', facts), undefined, catalog);
}

test('all 16 Wit records and 30 alternatives reach SQLite, individual explanations and report materials', () => {
  const expected = new Set();
  for (const id of reviewed) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyWitProfile);
    assert.equal(row.remainingAlternatives, 0);
    for (const input of row.inputs) expected.add(proofKey(id, input.required));
  }
  assert.equal(expected.size, 30);
  const seen = new Set();
  for (const instant of witnesses) {
    const parsed = query(raw(instant));
    const references = lookup(parsed);
    const materials = buildReportMaterials(references);
    for (const hit of hits(references).filter(hit => reviewed.has(hit.id))) {
      const { required, alternatives } = hit.matchedConditions;
      const keys = (alternatives.length ? alternatives : [required]).map(group => proofKey(hit.id, group));
      assert.ok(keys.every(key => expected.has(key)), hit.id);
      if (keys.every(key => seen.has(key))) continue;
      const proof = explainClaim(hit.id, 'western', chartContext('western', parsed[0].confirmedFacts), undefined, catalog);
      assert.ok(proof.matched, hit.id);
      assert.match(proof.calculationNote, /莉莉卷三智识篇/u);
      assert.deepEqual(proof.matchedConditions, hit.matchedConditions);
      assert.ok(materials.includes(conditionsText(proof.matchedConditions)), hit.id);
      assert.ok(materials.includes(proof.claim.evidence.original_text), hit.id);
      for (const key of keys) seen.add(key);
    }
  }
  assert.deepEqual(seen, expected);
  const changed = structuredClone(catalog.get(id(2)).claim);
  changed.evidence.context += ' revised';
  assert.equal(compileWesternClaim(changed).reason, 'source_review_required');
  for (const number of [7, 23, 24, 37, 46]) assert.equal(catalog.get(id(number)).reason, 'unsupported_calculation_profile');
});

test('the ecliptic horizon is independent of the five-degree house assignment and requires usable cusps', () => {
  const cusps = Array.from({ length: 12 }, (_, index) => ({
    kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: 10 + index * 30,
  }));
  const facts = [zodiac, { kind: 'western_profile_system', profile: 'regiomontanus' }, ...cusps, longitude('Mercury', 8)];
  assert.ok(lillyHouseFacts(facts).some(fact => fact.kind === 'western_lilly_planet_house' && fact.planet === 'Mercury' && fact.house === 1));
  assert.ok(explain(21, facts).matched);
  assert.equal(explain(21, [...facts.slice(0, -1), longitude('Mercury', 10)]).matched, false);
  const badHorizon = facts.map(fact => fact.kind === 'western_profile_cusp_longitude' && fact.house === 7 ? { ...fact, longitude: 192 } : fact);
  assert.equal(explain(21, badHorizon).matched, false);
  const forged = wit('mercury_above_horizon');
  assert.equal(explain(21, [zodiac, longitude('Mercury', 8), forged]).matched, false);
  assert.equal(query([...facts, forged], false)[0].confirmedFacts.some(fact => fact.kind === forged.kind), false);
});

test('absence and directed reception require the underlying pair observations', () => {
  const unaspected = raw('1990-02-20T19:15:00Z');
  assert.ok(explain(20, unaspected).matched);
  const missingMars = unaspected.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Mars');
  const forged = { kind: 'western_lilly_aspect', table: 'main', first: 'mars', second: 'mercury', aspect: 'any', matches: false };
  assert.equal(explain(20, [...missingMars, forged]).matched, false);
  const mercury = unaspected.find(fact => fact.kind === 'planet_longitude' && fact.planet === 'Mercury').longitude;
  const onMercury = missingMars.concat(longitude('Mars', mercury));
  assert.equal(explain(20, onMercury).matched, false);
  const application = raw('1990-03-21T12:15:00Z');
  assert.ok(explain(2, application).matched);
  const withoutSpeed = application.filter(fact => fact.kind !== 'planet_hourly_motion' || fact.planet !== 'Mercury');
  assert.equal(explain(2, withoutSpeed).matched, false);
});

test('a partile contact uses the matching zodiac degree and majority uses distinct verified planets', () => {
  const facts = [zodiac, longitude('Mercury', 359.9), longitude('Mars', 89.01), longitude('Saturn', 95.1)];
  assert.deepEqual(lillyWitFacts(facts, []), [wit('mercury_partile_mars')]);
  assert.deepEqual(lillyWitFacts(facts.map(fact => fact.planet === 'Mercury' ? longitude('Mercury', 0.01) : fact), []), []);
  const air = ['Sun', 'Moon', 'Mercury', 'Venus'].map(planet => longitude(planet, 61));
  assert.ok(explain(18, [zodiac, ...air]).matched);
  assert.equal(explain(18, [zodiac, ...air.slice(0, 3), air[0]]).matched, false);
  assert.equal(explain(18, [zodiac, ...air, longitude('Mercury', 41)]).matched, false);
});

test('lunar-node contact can use either node but needs a unique node and actual Moon longitude', () => {
  const north = { kind: 'western_true_node_longitude', profile: trueLunarNodeProfile, longitude: 179.9 };
  assert.ok(explain(19, [zodiac, north, longitude('Moon', 179.4)]).matched);
  assert.ok(explain(19, [zodiac, north, longitude('Moon', 359.4)]).matched);
  assert.equal(explain(19, [zodiac, north, longitude('Moon', 180.1)]).matched, false);
  assert.equal(explain(19, [zodiac, north, longitude('Mercury', 179.4)]).matched, false);
  assert.equal(explain(19, [zodiac, north, { ...north, longitude: 180 }, longitude('Moon', 179.4)]).matched, false);
});
