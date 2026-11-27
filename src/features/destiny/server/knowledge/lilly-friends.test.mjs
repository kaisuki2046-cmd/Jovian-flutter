import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials, conditionsText } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyFriendsProfile } from './lilly-friends.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-friends-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  ['1990-01-01T00:15:00Z', 61],
  ['1990-01-02T07:15:00Z', -62],
  ['1990-01-03T14:15:00Z', 48],
  ['1990-01-04T21:15:00Z', -52],
  ['1990-01-06T04:15:00Z', 31],
  ['1990-01-07T11:15:00Z', 61],
  ['1990-01-08T18:15:00Z', -62],
  ['1990-01-10T01:15:00Z', 48],
  ['1990-01-12T15:15:00Z', 31],
  ['1990-01-13T22:15:00Z', 61],
  ['1990-01-17T19:15:00Z', -52],
  ['1990-01-19T02:15:00Z', 31],
  ['1990-01-21T16:15:00Z', -62],
  ['1990-01-29T10:15:00Z', 48],
  ['1990-02-01T00:15:00Z', 31],
  ['1990-02-15T05:15:00Z', 61],
  ['1990-02-16T12:15:00Z', -62],
  ['1990-03-01T10:15:00Z', -62],
  ['1990-03-13T01:15:00Z', 61],
  ['1990-03-27T06:15:00Z', -62],
  ['1990-04-02T17:15:00Z', -62],
  ['1991-09-09T03:15:00Z', 48],
  ['1991-09-16T21:15:00Z', -52],
  ['1994-02-21T13:15:00Z', -62],
  ['1994-04-29T17:15:00Z', -52],
  ['1994-05-04T21:15:00Z', 48],
  ['1996-04-07T20:15:00Z', 48],
  ['1996-04-13T00:15:00Z', -62],
];
const id = number => number === 6 ? 'astro-lilly-v3-health-servants-p006-001'
  : 'astro-lilly-v3-friends-p' + String(number).padStart(3, '0') + '-001';
const rows = new Set([24, 25, 26, 27, 28, 29, 30, 41, 6].map(id));
const raw = ([instant, latitude]) => chartFacts.western(calculateWestern(Date.parse(instant), { latitude, longitude: 121.47 }));
const key = (id, required) => JSON.stringify([id, required]);
const longitude = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const hits = references => references.flatMap(({ events, personality }) => [...events, ...personality]);

function query(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function explain(number, facts) {
  return explainClaim(id(number), 'western', chartContext('western', facts), undefined, catalog);
}

test('native charts cover all 54 new groups in SQLite, individual explanations and report materials', () => {
  const expected = new Set();
  for (const sourceId of rows) {
    const row = catalog.get(sourceId);
    if (sourceId !== id(6)) assert.equal(row.compiler, lillyFriendsProfile);
    assert.equal(row.remainingAlternatives, sourceId === id(41) ? 2 : 0);
    for (const input of row.inputs) expected.add(key(sourceId, input.required));
  }
  assert.equal(expected.size, 54);
  const seen = new Set();
  for (const fixture of witnesses) {
    const parsed = query(raw(fixture));
    const references = lookup(parsed);
    const materials = buildReportMaterials(references);
    for (const hit of hits(references).filter(hit => rows.has(hit.id))) {
      const { required, alternatives } = hit.matchedConditions;
      const groups = (alternatives.length ? alternatives : [required]).map(group => key(hit.id, group));
      assert.ok(groups.every(group => expected.has(group)), hit.id);
      if (groups.every(group => seen.has(group))) continue;
      const proof = explainClaim(hit.id, 'western', chartContext('western', parsed[0].confirmedFacts), undefined, catalog);
      assert.ok(proof.matched, hit.id);
      assert.deepEqual(proof.matchedConditions, hit.matchedConditions);
      assert.match(proof.calculationNote, /莉莉卷三(?:友伴篇|第六宫格言)/u);
      assert.ok(materials.includes(conditionsText(proof.matchedConditions)), hit.id);
      assert.ok(materials.includes(proof.claim.evidence.original_text), hit.id);
      for (const group of groups) seen.add(group);
    }
  }
  assert.deepEqual(seen, expected);
});

test('cusp, intercepted sign and actual occupancy are separate testimonies across Aries zero', () => {
  const base = [
    { kind: 'western_zodiac', zodiac: 'tropical' },
    { kind: 'western_profile_system', profile: 'regiomontanus' },
    ...[350, 41, 65, 90, 120, 146, 170, 221, 245, 270, 300, 328].map((longitude, index) => ({
      kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude,
    })),
  ];
  const role = number => explain(number, base.concat(longitude('Venus', 346))).matchedConditions.required
    .find(fact => fact.kind === 'western_lilly_friend_significator')?.role;
  assert.equal(role(25), 'cusp_ruler');
  assert.equal(role(26), 'intercepted_ruler');
  assert.equal(role(28), 'occupant');
  assert.equal(explain(28, base.concat(longitude('Venus', 344))).matched, false);
  assert.equal(explain(28, base.concat(longitude('Venus', 346), { kind: 'planet_sign', planet: 'Venus', sign: '金牛座' })).matched, false);
  const noAriesInterception = base.map(fact => fact.house === 2 ? { ...fact, longitude: 29.9 } : fact);
  assert.equal(explain(26, noAriesInterception).matched, false);
});

test('missing natal cusps and forged selection cannot create a friendship testimony', () => {
  const chart = raw(witnesses[0]);
  const forged = { kind: 'western_lilly_friend_significator', planet: 'Saturn', house: 1, role: 'intercepted_ruler' };
  const incomplete = chart.filter(fact => fact.kind !== 'western_profile_cusp_longitude');
  assert.equal(explain(24, incomplete.concat(forged)).matched, false);
  assert.equal(query(chart.concat(forged))[0].confirmedFacts.some(fact => fact.kind === forged.kind), false);
  assert.equal(hits(lookup(query(chart, false))).some(hit => rows.has(hit.id)), false);
});

test('peregrine and sign-class testimony must use the same planet in a named house', () => {
  const row = catalog.get(id(41));
  assert.equal(row.remainingAlternatives, 2);
  for (const { required } of row.inputs) {
    const placed = required.find(fact => fact.kind === 'western_lilly_planet_house');
    const dignity = required.find(fact => fact.kind === 'western_lilly_dignity');
    const sign = required.find(fact => fact.kind === 'western_lilly_sign_class');
    assert.ok([1, 11].includes(placed.house));
    assert.equal(dignity.planet, placed.planet);
    assert.equal(sign.selector, placed.planet.toLowerCase());
    assert.equal(dignity.dignity, 'peregrine');
    assert.ok(['movable', 'common'].includes(sign.classification));
  }
  const clear = raw(witnesses[3]);
  const proof = explain(41, clear);
  assert.ok(proof.matched);
  const planet = proof.matchedConditions.required.find(fact => fact.kind === 'western_lilly_planet_house').planet;
  const missing = clear.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== planet);
  assert.equal(explain(41, missing).matched, false);
});

test('a change to any reviewed source excerpt requires re-review', () => {
  for (const sourceId of rows) {
    const altered = structuredClone(catalog.get(sourceId).claim);
    altered.evidence.context += ' revised';
    assert.equal(compileWesternClaim(altered).reason, 'source_review_required', sourceId);
  }
});
