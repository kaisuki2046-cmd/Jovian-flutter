import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { isBirthDate } from '../../model/birth-profile.ts';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyFortune } from './lilly-fortune.mjs';
import { lillyMotionFacts } from './lilly-solar-motion.mjs';
import { compileLillyWealthDuration, lillyWealthDurationProfile } from './lilly-wealth-duration.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-wealth-history-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-wealth-history-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const { witnesses, differentQuarters, singleLuminary, mixedMotion } =
  JSON.parse(readFileSync(new URL('./claims/integration-batch-178-witnesses.json', import.meta.url)));
const idOf = number => `astro-lilly-v3-wealth-duration-p${String(number).padStart(3, '0')}-001`;
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const query = (raw, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition: 'Christian Astrology',
}], { timeKnown })[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (number, raw, timeKnown = true) => {
  const q = query(raw, timeKnown);
  return explainClaim(idOf(number), 'western', context(q), q.tradition, catalog, { historicalAphorism: true });
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const present = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const kind = (facts, name) => facts.filter(fact => fact.kind === 'western_lilly_wealth_' + name);
const forId = number => witnesses.find(sample => sample.proofs.some(item => item.id === idOf(number)));
const onDate = date => witnesses.find(sample => sample.date === date);

function expectedParticipants(raw) {
  const houses = lillyHouseFacts(raw), lot = lillyFortune(raw);
  return new Set([houses.find(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 2).planet, lot.ruler,
    ...houses.filter(fact => fact.kind === 'western_lilly_planet_house' && fact.house === 2).map(fact => fact.planet)]);
}

test('all historical wealth groups are queryable by ID and kept out of normal SQLite and report candidates', () => {
  const ids = new Set([3, 21, 22, 24, 25, 26, 27, 29].map(idOf));
  const expected = new Map();
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyWealthDurationProfile, id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 校订本';
    assert.equal(compileLillyWealthDuration(changed).reason, 'source_review_required');
    for (const input of row.inputs) expected.set(id + ':' + digest(input), input);
  }
  assert.equal(expected.size, 16);
  const rows = catalog.lillyFortitudeRows(), cellsAt = (sign, degree) => catalog.lillyDignityCells(sign, degree);
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    assert.ok(Number.isInteger(date.getTime() / 60_000));
    const q = query(rawOf(sample)), base = context(q);
    const derived = claimChartContext('western', base, [], cellsAt, () => rows, { wealthHistory: true });
    assert.ok(catalog.candidates('western', derived.presentKeys, q.tradition).every(row => !ids.has(row.claim.id)));
    for (const { personality, events } of lookup([q])) assert.ok([...personality, ...events].every(row => !ids.has(row.id)));
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, key);
      assert.equal(explainClaim(id, 'western', base, q.tradition, catalog).reason, 'historical_aphorism_requires_opt_in');
      const detail = explainClaim(id, 'western', base, q.tradition, catalog, { historicalAphorism: true });
      assert.equal(detail.matched, true, key);
      assert.equal(detail.matchScope, 'historical_aphorism');
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('phase proof preserves a disagreement between a unique strongest planet and a strict majority', () => {
  const raw = rawOf(onDate(differentQuarters)), detail = explain(26, raw);
  assert.equal(detail.matched, true);
  assert.match(detail.calculationNote, /不换算年龄/);
  const facts = present(detail), quarters = kind(facts, 'quarter');
  const [strongest] = quarters.filter(fact => fact.basis === 'strongest');
  const [majority] = quarters.filter(fact => fact.basis === 'majority');
  assert.notEqual(strongest.quarter, majority.quarter);
  const members = kind(facts, 'participant'), scores = kind(facts, 'score');
  assert.deepEqual(new Set(members.map(fact => fact.planet)), expectedParticipants(raw));
  assert.deepEqual(new Set(scores.map(fact => fact.planet)), expectedParticipants(raw));
  const leadingScore = scores.find(a => scores.every(b => a === b || a.min > b.max));
  assert.ok(leadingScore);
  const inQuarter = (house, quarter) => 13 - quarter * 3 <= house && house <= 15 - quarter * 3;
  assert.ok(inQuarter(members.find(fact => fact.planet === leadingScore.planet).house, strongest.quarter));
  assert.ok(members.filter(fact => inQuarter(fact.house, majority.quarter)).length > members.length / 2);
  assert.equal(explain(26, raw, false).matched, false);
});

test('Saturn requires the verified principal role and a complete two-light decision', () => {
  for (const [number, expected] of [[21, []], [22, ['Sun', 'Moon']]]) {
    const raw = rawOf(forId(number)), detail = explain(number, raw), facts = present(detail);
    assert.equal(kind(facts, 'principal')[0].planet, 'Saturn');
    const participants = kind(facts, 'participant').map(fact => fact.planet);
    assert.deepEqual(new Set(participants), expectedParticipants(raw));
    assert.deepEqual(new Set(participants.filter(planet => ['Sun', 'Moon'].includes(planet))), new Set(expected));
    const incomplete = raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Moon');
    assert.equal(explain(number, [...incomplete, ...facts]).matched, false);
  }
  const partial = rawOf(singleLuminary);
  assert.equal([...expectedParticipants(partial)].filter(planet => ['Sun', 'Moon'].includes(planet)).length, 1);
  assert.equal(explain(21, partial).matched, false);
  assert.equal(explain(22, partial).matched, false);
});

test('opposing motion witnesses can coexist but a different star cannot supply direct motion', () => {
  const raw = rawOf(onDate(mixedMotion)), detail = explain(29, raw);
  const witnesses = kind(present(detail), 'timing_motion');
  const retrograde = witnesses.filter(fact => fact.motion === 'retrograde'), directSwift = witnesses.filter(fact => fact.motion === 'direct_swift');
  assert.ok(retrograde.length && directSwift.length);
  for (const { planet } of directSwift) {
    assert.ok(raw.some(fact => fact.kind === 'planet_hourly_motion' && fact.planet === planet && fact.signedDegrees > 0));
    assert.ok(lillyMotionFacts(raw).some(fact => fact.selector === planet.toLowerCase() && fact.condition === 'swift' && fact.matches));
  }
  const removed = new Set(directSwift.map(fact => fact.planet));
  const missingHourly = raw.filter(fact => fact.kind !== 'planet_hourly_motion' || !removed.has(fact.planet));
  const remaining = kind(present(explain(29, [...missingHourly, ...directSwift])), 'timing_motion');
  assert.ok(remaining.some(fact => fact.motion === 'retrograde'));
  assert.ok(remaining.every(fact => fact.motion !== 'direct_swift'));
});
