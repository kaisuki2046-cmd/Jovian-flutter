import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { lillySourceCompositeAlternatives, lillyCompositeSourceDisposition, isReviewedLillyComposite } from './lilly-source-composites.mjs';
import { compileWesternClaim, westernClaimConditionAlternatives } from './western-claims.mjs';
import { claimChartContext } from './claims.mjs';
import { chartContext } from './matching.mjs';
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const evaluate = (groups, facts) => groups.some(group => group.every(c => facts.has(c.fact) && facts.get(c.fact) === c.equals));
const expand = (suffix, equals) => lillySourceCompositeAlternatives({ fact: 'profiles.lilly.' + suffix, equals });

test('all 144 two-body house assignments preserve the existential and its complete De Morgan negation', () => {
  const cases = [['marriage_male.benefic_occupies_house_7', ['jupiter', 'venus'], [7]],
    ['friends.testimonies.benefic_in_listed_friendship_house', ['jupiter', 'venus'], [1, 5, 7, 9, 11]],
    ['religion_dreams.malefic_in_9', ['saturn', 'mars'], [9]]];
  for (const [predicate, bodies, houses] of cases) for (let a = 1; a <= 12; a++) for (let b = 1; b <= 12; b++) {
    const values = new Map([[`chart.planets.${bodies[0]}.house`, a], [`chart.planets.${bodies[1]}.house`, b]]), positive = houses.includes(a) || houses.includes(b);
    assert.equal(evaluate(expand(predicate, true), values), positive); assert.equal(evaluate(expand(predicate, false), values), !positive);
  }
});

test('the Venus-first/Jupiter-seventh conjunction and its negation retain the named bodies and unknown states', () => {
  const predicate = 'children.testimonies.venus_asc_jupiter_seventh';
  for (let venus = 1; venus <= 12; venus++) for (let jupiter = 1; jupiter <= 12; jupiter++) {
    const values = new Map([['chart.planets.venus.house', venus], ['chart.planets.jupiter.house', jupiter]]);
    assert.equal(evaluate(expand(predicate, true), values), venus === 1 && jupiter === 7);
    assert.equal(evaluate(expand(predicate, false), values), venus !== 1 || jupiter !== 7);
  }
  const unknown = new Map([['chart.planets.venus.house', 1]]);
  assert.equal(evaluate(expand(predicate, true), unknown), false); assert.equal(evaluate(expand(predicate, false), unknown), false);
  assert.equal(evaluate(expand(predicate, false), new Map([['chart.planets.venus.house', 2]])), true);
  for (const p of ['marriage_male.benefic_occupies_house_7', 'friends.testimonies.benefic_in_listed_friendship_house']) {
    assert.equal(evaluate(expand(p, false), new Map([['chart.planets.jupiter.house', 2]])), false);
  }
});

test('the seventh ruler is classified by its own unique classical identity, with no modern ruler or occupant substitution', () => {
  const predicate = 'marriage_male.house_7_ruler_is_benefic';
  for (const body of ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
    const values = new Map([['profiles.lilly.rulers.house_7', body]]), benefic = ['jupiter', 'venus'].includes(body);
    assert.equal(evaluate(expand(predicate, true), values), benefic); assert.equal(evaluate(expand(predicate, false), values), !benefic);
  }
  assert.equal(evaluate(expand(predicate, false), new Map()), false);
  assert.equal(evaluate(expand(predicate, true), new Map([['profiles.lilly.rulers.house_7', 'neptune']])), false);
});

test('a profession member and its sign stay on the same body, and only the Lilly convention admits these composites', () => {
  const predicate = 'profession.active_significator_sign', groups = expand(predicate, 'taurus');
  const values = new Map([['profiles.lilly.profession_rulers.mercury', true], ['chart.planets.mercury.sign', 'gemini'],
    ['profiles.lilly.profession_rulers.venus', false], ['chart.planets.venus.sign', 'taurus']]);
  assert.equal(evaluate(groups, values), false); values.set('profiles.lilly.profession_rulers.venus', true); assert.equal(evaluate(groups, values), true);
  for (const group of groups) assert.equal(group[0].fact.split('.').at(-1), group[1].fact.split('.')[2]);
  const condition = { fact: 'profiles.lilly.' + predicate, equals: 'taurus' };
  assert.deepEqual(westernClaimConditionAlternatives(condition, 'geometric'), [[condition]]);
  for (const equals of [true, 'unknown', 'Taurus']) assert.equal(expand(predicate, equals), null);
});

test('all eight source fingerprints fail closed for altered evidence, conditions and source metadata', () => {
  const selected = sources.filter(row => isReviewedLillyComposite(row.id)); assert.equal(selected.length, 8);
  for (const source of selected) {
    assert.equal(lillyCompositeSourceDisposition(source), true); assert.equal(compileWesternClaim(source).remainingAlternatives, 0);
    for (const field of ['source', 'conditions', 'evidence']) {
      const changed = structuredClone(source);
      if (field === 'source') changed.source.edition += '修订';
      if (field === 'conditions') changed.conditions.normalized.push('另须未定义的强弱或关联条件');
      if (field === 'evidence') changed.evidence.original_text += '另有前提';
      const result = compileWesternClaim(changed); assert.equal(result.reason, 'source_review_required'); assert.ok(!result.inputs);
    }
  }
});

test('supplied derived house, ruler and profession flags are removed rather than counted as observed coordinates', () => {
  const fake = [{ kind: 'western_lilly_planet_house', planet: 'Jupiter', house: 7 }, { kind: 'western_lilly_house_ruler', house: 7, planet: 'Venus' },
    { kind: 'western_lilly_profession_ruler', planet: 'Mercury', role: 'member', matches: true, profile: 'lilly-1647-profession-first-two-v1' }];
  const chart = claimChartContext('western', chartContext('western', [{ kind: 'western_zodiac', zodiac: 'tropical' }, ...fake], [], 'natal'));
  assert.ok(!chart.present.some(f => ['western_lilly_planet_house', 'western_lilly_house_ruler', 'western_lilly_profession_ruler'].includes(f.kind)));
});
