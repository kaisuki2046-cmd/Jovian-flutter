import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { zodiacNames } from '../../control/charts.ts';
import { compileLillyDignityCells } from './lilly-dignities.mjs';
import { lillySignClassFacts, lillySignClassProfile } from './lilly-sign-classes.mjs';
import { westernClaimConditionAlternatives } from './western-claims.mjs';
import { normalizeFacts } from './catalog.mjs';

const source = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const cells = compileLillyDignityCells(source.filter(row => /^astro-lilly-v1-dignity-table-p\d+-001$/u.test(row.id) && Number(row.id.match(/-p(\d+)/u)[1]) <= 144));
const at = (sign, degree) => cells.filter(cell => cell.sign === sign && cell.start <= degree && degree < cell.end);
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const longitude = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const sign = (planet, sign) => ({ kind: 'planet_sign', planet, sign });
const state = (facts, selector) => Object.fromEntries(lillySignClassFacts(facts, at).filter(f => f.selector === selector).map(f => [f.classification, f.matches]));
const cusps = offset => [{ kind: 'western_profile_system', profile: 'regiomontanus' }, ...Array.from({ length: 12 }, (_, i) => ({
  kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: (offset + i * 30) % 360,
}))];

test('all twelve signs and seven bodies reproduce independent source groups at both sides of every sign boundary', () => {
  const modes = ['movable', 'fixed', 'common', 'movable', 'fixed', 'common', 'movable', 'fixed', 'common', 'movable', 'fixed', 'common'];
  const elements = ['fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water', 'fire', 'earth', 'air', 'water'];
  for (const planet of ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn']) for (let s = 0; s < 12; s++) {
    for (const degree of [0, 15, 29.999999]) {
      const facts = [tropical, longitude(planet, s * 30 + degree), sign(planet, zodiacNames[s])];
      const result = state(facts, planet.toLowerCase());
      for (const mode of ['movable', 'fixed', 'common']) assert.equal(result[mode], mode === modes[s]);
      for (const element of ['fire', 'earth', 'air', 'water']) assert.equal(result[element], element === elements[s]);
      assert.equal(result.tropic, [3, 9].includes(s));
      assert.equal(result.human, [2, 5, 6, 10].includes(s));
      assert.equal(result.profession_quadrupedal, [0, 4, 8].includes(s), 'p.632 does not include Taurus or Capricorn');
      normalizeFacts('western', lillySignClassFacts(facts, at));
    }
    assert.deepEqual(state([tropical, sign(planet, zodiacNames[s])], planet.toLowerCase()), state([tropical, longitude(planet, s * 30)], planet.toLowerCase()), 'a unique confirmed sign suffices without inventing degrees');
  }
});

test('unknown and contradictory positions do not become false classifications or trusted client flags', () => {
  const fake = { kind: 'western_lilly_sign_class', selector: 'venus', classification: 'common', matches: true, profile: lillySignClassProfile };
  for (const facts of [[tropical], [tropical, fake], [tropical, longitude('Venus', 0), longitude('Venus', 30)],
    [tropical, longitude('Venus', 0), sign('Venus', '金牛座')], [tropical, sign('Venus', '白羊座'), sign('Venus', '金牛座')],
    [{ kind: 'western_zodiac', zodiac: 'sidereal' }, longitude('Venus', 0)]]) assert.deepEqual(state(facts, 'venus'), {});
  assert.equal(state([tropical, longitude('Venus', 0)], 'venus').common, false, 'known non-membership is different from unknown');
  for (const invalid of [{ ...fake, selector: 'neptune' }, { ...fake, classification: 'modern_tropic' }, { ...fake, profile: 'other' }, { ...fake, matches: 'true' }]) assert.throws(() => normalizeFacts('western', [invalid]));
});

test('cusp, ruler position and Sun are independent objects and invalid or incomplete historical cusps withhold the house selectors', () => {
  const facts = [tropical, ...cusps(240), longitude('Mercury', 150), longitude('Sun', 330)];
  assert.equal(state(facts, 'house_7_cusp').common, true); // Gemini
  assert.equal(state(facts, 'house_7_ruler').common, true); // Mercury in Virgo
  assert.equal(state(facts, 'sun').common, true); // Pisces
  assert.equal(state(facts, 'house_11_cusp').movable, true); // Libra
  assert.equal(state([...facts.filter(f => f.planet !== 'Mercury'), longitude('Mercury', 120)], 'house_7_ruler').fixed, true);
  assert.deepEqual(state(facts.filter(f => !(f.kind === 'western_profile_cusp_longitude' && f.house === 1)), 'house_7_ruler'), {});
  assert.deepEqual(state([...facts, { kind: 'western_profile_house_sign', profile: 'regiomontanus', house: 7, sign: '金牛座' }], 'house_7_cusp'), {});
});

test('Venus dispositor uses the sourced traditional domicile, including self-disposition, and needs its own sign for classification', () => {
  const expectedLords = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
  const bodies = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  for (let s = 0; s < 12; s++) {
    const otherPositions = bodies.filter(body => body !== 'Venus').map((body, i) => longitude(body, i * 30 + 4));
    const facts = [tropical, ...otherPositions, longitude('Venus', s * 30 + 1)];
    assert.deepEqual(state(facts, 'venus_dispositor'), state(facts, expectedLords[s].toLowerCase()));
  }
  const chosenOnly = state([tropical, sign('Venus', '巨蟹座')], 'venus_dispositor');
  assert.deepEqual(chosenOnly, { selected: true });
  assert.deepEqual(state([tropical, longitude('Venus', 90)], 'venus_dispositor'), { selected: true });
  assert.deepEqual(state([tropical, longitude('Venus', 90), longitude('Moon', 30)], 'venus_dispositor').common, false);
});

test('profession class aggregation preserves the same candidate and exact three-member Boolean negation, including unknowns', () => {
  const fact = 'profiles.lilly.profession_ruler_sign_classes.fire_element';
  const positive = westernClaimConditionAlternatives({ fact, equals: true }, 'lilly');
  const negative = westernClaimConditionAlternatives({ fact, equals: false }, 'lilly');
  assert.equal(positive.length, 3); assert.equal(negative.length, 8);
  const keys = positive.flat().map(row => row.fact); assert.equal(new Set(keys).size, 6);
  const evaluate = (groups, values) => groups.some(group => group.every(condition => values.get(condition.fact) === condition.equals));
  for (let bits = 0; bits < 64; bits++) {
    const values = new Map(keys.map((key, i) => [key, Boolean(bits & (1 << i))]));
    const expected = [0, 2, 4].some(i => values.get(keys[i]) && values.get(keys[i + 1]));
    assert.equal(evaluate(positive, values), expected); assert.equal(evaluate(negative, values), !expected);
  }
  const unknown = new Map([[keys[0], false], [keys[2], false]]);
  assert.equal(evaluate(positive, unknown), false); assert.equal(evaluate(negative, unknown), false);
  const splitCandidates = new Map(keys.map(key => [key, false])); splitCandidates.set(keys[0], true); splitCandidates.set(keys[3], true);
  assert.equal(evaluate(positive, splitCandidates), false, 'a selected Mercury and an unselected Venus in fire cannot be joined');
});
