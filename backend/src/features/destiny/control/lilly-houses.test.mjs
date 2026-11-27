import assert from 'node:assert/strict';
import { test } from 'node:test';
import { lillyHouse, lillyHouseFacts, lillyHouseRuleset } from './lilly-houses.mjs';

const cusps = Array.from({ length: 12 }, (_, index) => index * 30);
const raw = (positions = []) => [
  { kind: 'western_zodiac', zodiac: 'tropical' },
  { kind: 'western_profile_system', profile: 'regiomontanus' },
  ...cusps.map((longitude, index) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude })),
  ...positions.map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude })),
];

test('Lilly natal intervals start exactly five degrees before each cusp, including the zero-degree wrap', () => {
  for (const [longitude, expected] of [[0, 1], [24.999999, 1], [25, 2], [29.99, 2], [30, 2], [344.999999, 12], [345, 12], [354.999999, 12], [355, 1], [359.99, 1]]) {
    assert.equal(lillyHouse(longitude, cusps), expected, String(longitude));
  }
  // Equal houses are only the arithmetic fixture; production uses the actual
  // irregular Regiomontanus cusps, never an equal-house substitution.
  const irregular = [5, 25, 70, 95, 130, 165, 185, 205, 250, 275, 310, 345];
  for (let index = 0; index < 12; index++) {
    assert.equal(lillyHouse(irregular[index] - 5, irregular), index + 1);
    assert.equal(lillyHouse(irregular[index] - 5 - 1e-6, irregular), index === 0 ? 12 : index);
  }
  assert.equal(lillyHouse(NaN, cusps), null);
  assert.equal(lillyHouse(15, []), null);
  assert.equal(lillyHouse(15, [0, 0, ...cusps.slice(2)]), null);
});

test('the twelve cusp lords follow the original domicile column, including classical Saturn and Jupiter', () => {
  const facts = lillyHouseFacts(raw([['Mars', 25], ['Venus', 65], ['Mercury', 95], ['Moon', 155], ['Sun', 185], ['Jupiter', 215], ['Saturn', 275], ['Uranus', 5]]));
  assert.equal(facts[0].ruleset, lillyHouseRuleset);
  assert.deepEqual(facts.filter(fact => fact.kind === 'western_lilly_house_ruler').map(fact => fact.planet),
    ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter']);
  assert.ok(!facts.some(fact => fact.planet === 'Uranus'));
  assert.equal(facts.find(fact => fact.kind === 'western_lilly_ruler_house' && fact.house === 1).placedIn, 2);
  assert.equal(facts.find(fact => fact.kind === 'western_lilly_ruler_house' && fact.house === 11).placedIn, 10);
  assert.equal(facts.find(fact => fact.kind === 'western_lilly_ruler_house' && fact.house === 12).placedIn, 8);
});

test('incomplete, mixed and contradictory inputs never supply a borrowed or default historical profile', () => {
  const base = raw([['Mars', 25]]);
  assert.deepEqual(lillyHouseFacts(base.filter(fact => fact.kind !== 'western_profile_system')), []);
  assert.deepEqual(lillyHouseFacts(base.filter(fact => fact.kind !== 'western_zodiac')), []);
  assert.deepEqual(lillyHouseFacts(base.filter(fact => fact.house !== 12)), []);
  assert.deepEqual(lillyHouseFacts([...base, { kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: 1, longitude: 5 }]), []);
  assert.deepEqual(lillyHouseFacts([...base, { kind: 'western_profile_house_sign', profile: 'regiomontanus', house: 1, sign: '金牛座' }]), []);
  const ambiguous = lillyHouseFacts([...base, { kind: 'planet_longitude', planet: 'Mars', longitude: 85 }]);
  assert.ok(ambiguous.some(fact => fact.kind === 'western_lilly_house_ruler' && fact.house === 1));
  assert.ok(!ambiguous.some(fact => fact.kind === 'western_lilly_ruler_house' && fact.house === 1));
  assert.deepEqual(lillyHouseFacts([{ kind: 'house_sign', house: 1, sign: '白羊座' }, { kind: 'planet_house', planet: 'Mars', house: 2 }]), []);
});
