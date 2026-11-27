import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateWestern, chartFacts } from '../../control/charts.ts';
import { lillySolarFacts, lillyMotionFacts, lillySolarProfile, lillyMotionProfile } from './lilly-solar-motion.mjs';
import { normalizeFacts } from './catalog.mjs';
import { parseChartQueries } from './report-lookup.mjs';
import { chartVersions } from './catalog.mjs';

const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const longitude = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const daily = (planet, signedDegrees) => ({ kind: 'planet_daily_motion', planet, signedDegrees });
const solar = (sun, body, planet = 'Mercury') => lillySolarFacts([tropical, longitude('Sun', sun), longitude(planet, body)]);
const states = (facts, selector) => Object.fromEntries(facts.filter(f => f.selector === selector).map(f => [f.condition, f.matches]));
const cusps = offset => [{ kind: 'western_profile_system', profile: 'regiomontanus' }, ...Array.from({ length: 12 }, (_, i) => ({
  kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: (offset + i * 30) % 360,
}))];

test('same-sign combustion, beams and the explicit cazimi exception respect the independently sourced boundaries', () => {
  assert.equal(states(solar(10, 18.499999), 'mercury').combust, true);
  assert.equal(states(solar(10, 18.5), 'mercury').combust, false);
  assert.equal(states(solar(10, 20), 'mercury').combust, false, 'the contradictory printed ten-degree example does not enlarge the explicit definition');
  assert.equal(states(solar(29, 31), 'mercury').combust, false, 'nearby positions across a sign boundary are not same-sign combustion');
  assert.equal(states(solar(29, 31), 'mercury').under_beams, true);
  assert.equal(states(solar(10, 26.999999), 'mercury').under_beams, true);
  assert.equal(states(solar(10, 27), 'mercury').under_beams, false);
  assert.equal(states(solar(10, 27), 'mercury').free_of_beams, true);
  for (const distance of [0, 17 / 60]) {
    const result = states(solar(10, 10 + distance), 'mercury');
    assert.equal(result.cazimi, true); assert.equal(result.combust, false); assert.equal(result.under_beams, false);
    assert.equal(result.free_of_beams, false, 'cazimi is an exception, not geometric freedom from beams');
  }
  const outside = states(solar(10, 10 + 17 / 60 + 0.000001), 'mercury');
  assert.equal(outside.cazimi, false); assert.equal(outside.combust, true);
});

test('solar orientation follows circular longitude for both Moon and planets and withholds the exact transition points', () => {
  for (const planet of ['Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) {
    const selector = planet.toLowerCase();
    assert.equal(states(solar(1, 359, planet), selector).oriental, true);
    assert.equal(states(solar(359, 1, planet), selector).occidental, true);
    for (const degree of [10, 190]) {
      const result = states(solar(10, degree, planet), selector);
      assert.ok(!Object.hasOwn(result, 'oriental')); assert.ok(!Object.hasOwn(result, 'occidental'));
    }
  }
});

test('house combustion is bound to the actual traditional ruler and requires the complete historical house profile', () => {
  const facts = [tropical, ...cusps(0), longitude('Sun', 10), longitude('Mars', 12), longitude('Venus', 80)];
  assert.equal(states(lillySolarFacts(facts), 'house_1_ruler').combust, true, 'Aries ascendant means Mars');
  assert.deepEqual(states(lillySolarFacts(facts), 'house_5_ruler'), {}, 'Leo fifth ruler is the Sun, not a second body in its own heart');
  assert.deepEqual(states(lillySolarFacts(facts.filter(f => !(f.kind === 'western_profile_cusp_longitude' && f.house === 8))), 'house_1_ruler'), {});
  assert.deepEqual(states(lillySolarFacts([...facts, { kind: 'western_profile_house_sign', profile: 'regiomontanus', house: 1, sign: '金牛座' }]), 'house_1_ruler'), {});
});

test('unknown or contradictory coordinates, speeds and client flags produce no invented negative evidence', () => {
  const good = [tropical, longitude('Sun', 10), longitude('Mercury', 12)];
  const fake = { kind: 'western_lilly_solar_state', selector: 'mercury', condition: 'combust', matches: true, profile: lillySolarProfile };
  for (const facts of [[tropical, fake], [...good, longitude('Mercury', 20)], [...good, { kind: 'planet_sign', planet: 'Mercury', sign: '金牛座' }],
    [...good, longitude('Sun', 11)], [...good, { kind: 'western_zodiac', zodiac: 'sidereal' }]]) assert.deepEqual(states(lillySolarFacts(facts), 'mercury'), {});
  for (const facts of [[tropical], [tropical, daily('Mercury', 1), daily('Mercury', 2)], [tropical, daily('Mercury', NaN)],
    [tropical, daily('Mercury', 33)], [daily('Mercury', 1)]]) assert.deepEqual(lillyMotionFacts(facts), []);
  for (const invalid of [{ ...fake, selector: 'sun' }, { ...fake, condition: 'visible' }, { ...fake, profile: 'other' },
    { ...fake, matches: 'true' }, daily('Mercury', Infinity), daily('Mercury', 33), daily('Other', 1),
    { kind: 'western_lilly_speed_state', selector: 'moon', condition: 'very_swift', matches: true, profile: lillyMotionProfile }]) assert.throws(() => normalizeFacts('western', [invalid]));
});

test('all seven independently transcribed mean daily rates use strict magnitude comparison while keeping direction separate', () => {
  // Book I printed pp.57,61,65,69,72,76,80, in arcseconds per day.
  const reference = [['Sun', 3548], ['Moon', 47436], ['Mercury', 3548], ['Venus', 3548], ['Mars', 1887], ['Jupiter', 299], ['Saturn', 121]];
  for (const [planet, arcseconds] of reference) for (const direction of [-1, 1]) {
    const mean = arcseconds / 3600, selector = planet.toLowerCase();
    const at = value => states(lillyMotionFacts([tropical, daily(planet, value * direction)]), selector);
    assert.deepEqual(at(mean), { swift: false, slow: false });
    assert.deepEqual(at(mean + 0.000001), { swift: true, slow: false });
    assert.deepEqual(at(mean - 0.000001), { swift: false, slow: true });
    normalizeFacts('western', lillyMotionFacts([tropical, daily(planet, mean)]));
  }
  assert.deepEqual(states(lillyMotionFacts([tropical, daily('Mercury', 0)]), 'mercury'), { swift: false, slow: true });
});

test('native full-day displacement agrees with 21 independent NASA/JPL windows, including wraparound and retrograde motion', () => {
  const fixture = JSON.parse(readFileSync(new URL('../../control/western-daily-motion-reference.json', import.meta.url)));
  const cache = new Map(); let checked = 0, retrograde = 0, wraps = 0, distinguishesHourlyDerivative = 0;
  for (const { planet, windows } of fixture.bodies) for (const window of windows) {
    if (!cache.has(window.center)) cache.set(window.center, calculateWestern(Date.parse(window.center), { latitude: 0, longitude: 0 }));
    const chart = cache.get(window.center), motion = chart.motion.find(row => row.planet === planet);
    assert.ok(Math.abs(motion.signedDailyDegrees - window.signedDegrees) < 0.0002, planet + ' ' + window.center);
    assert.equal(chartFacts.western(chart).find(f => f.kind === 'planet_daily_motion' && f.planet === planet).signedDegrees, motion.signedDailyDegrees);
    if (Math.abs(motion.degreesPerDay - window.signedDegrees) > 0.0002) distinguishesHourlyDerivative++;
    if (window.signedDegrees < 0) retrograde++;
    if (Math.abs(window.after.longitude - window.before.longitude) > 180) wraps++;
    checked++;
  }
  assert.equal(checked, 21); assert.ok(retrograde > 0); assert.ok(wraps > 0); assert.ok(distinguishesHourlyDerivative >= 2);
});

test('legacy charts without the new measurement remain readable and unknown birth times withhold time-sensitive solar and speed facts', () => {
  const chart = calculateWestern(Date.UTC(2000, 0, 1, 12), { latitude: 0, longitude: 0 });
  const old = structuredClone(chart); for (const motion of old.motion) delete motion.signedDailyDegrees;
  const oldFacts = chartFacts.western(old); assert.equal(oldFacts.filter(f => f.kind === 'planet_daily_motion').length, 0);
  assert.equal(oldFacts.filter(f => f.kind === 'planet_motion').length, 10);
  const [unknown] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: chartFacts.western(chart) }], { timeKnown: false });
  assert.ok(!unknown.confirmedFacts.some(f => ['planet_daily_motion', 'planet_longitude'].includes(f.kind)));
  assert.deepEqual(lillySolarFacts(unknown.confirmedFacts), []); assert.deepEqual(lillyMotionFacts(unknown.confirmedFacts), []);
});
