import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compileLillyDignityCells, lillyDignityProfile } from './lilly-dignities.mjs';
import { lillyReceptionFacts } from './lilly-receptions.mjs';
import { lillyAspect } from './lilly-aspects.mjs';
import { compileWesternClaim, westernClaimConditionAlternatives } from './western-claims.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { claimChartContext } from './claims.mjs';
import { normalizeFacts, chartVersions } from './catalog.mjs';
import { parseChartQueries } from './report-lookup.mjs';
import { factText } from '../chart-facts-text.mjs';

const source = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const cells = compileLillyDignityCells(source);
const at = (sign, degree) => cells.filter(cell => cell.sign === sign && cell.start <= degree && degree < cell.end);
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const coordinate = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const reception = (first, second, type = 'mutual', matches = true) => ({ kind: 'western_lilly_reception', first, second, reception: type, matches, profile: lillyDignityProfile });
const facts = (...positions) => [tropical, ...positions.map(([planet, longitude]) => coordinate(planet, longitude))];
const result = (input, requested) => lillyReceptionFacts(input, [requested], at)[0]?.matches;
const cusps = (start = 0) => [{ kind: 'western_profile_system', profile: 'regiomontanus' },
  ...Array.from({ length: 12 }, (_, i) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: (start + i * 30) % 360 }))];

test('directed receptions preserve receiver and guest; mutual reception requires two-way dignity without adding an aspect', () => {
  assert.equal(result(facts(['Mercury', 95]), reception('moon', 'mercury', 'domicile')), true, 'Moon receives Mercury in Cancer without needing Moon longitude');
  assert.equal(result(facts(['Mercury', 35]), reception('moon', 'mercury', 'exaltation')), true);
  assert.equal(result(facts(['Mercury', 35]), reception('moon', 'mercury', 'domicile')), false);
  assert.equal(result(facts(['Mercury', 35]), reception('mercury', 'moon', 'exaltation')), undefined, 'reversed guest position is missing');
  const byTerms = facts(['Venus', 24], ['Mars', 76]);
  assert.equal(result(byTerms, reception('mars', 'venus', 'term')), true);
  assert.equal(result(byTerms, reception('venus', 'mars', 'term')), true);
  assert.equal(result(byTerms, reception('venus', 'mars')), true, 'p.112 reciprocal terms example');
  assert.equal(result(byTerms, reception('venus', 'mars', 'mutual_domicile')), false);
  assert.equal(lillyAspect(24, 76, 'venus', 'mars', 'sextile', 'main'), false, 'mutual reception does not acquire a hidden aspect prerequisite');
  assert.equal(result(facts(['Sun', 10], ['Mars', 130]), reception('sun', 'mars', 'mutual_domicile')), true);
  assert.equal(result(facts(['Venus', 35], ['Mars', 24]), reception('venus', 'mars')), false, 'one direction alone is insufficient');
  assert.equal(result(facts(['Mars', 26 - 0.000001]), reception('saturn', 'mars', 'term')), false);
  assert.equal(result(facts(['Mars', 26]), reception('saturn', 'mars', 'term')), true, 'exact next term boundary');
  assert.equal(result(facts(['Venus', 24]), reception('venus', 'venus')), false, 'self dignity is not exchange between two planets');
});

test('unknown sect, missing coordinates and contradictions cannot be turned into an invented reception or absence', () => {
  const pair = facts(['Venus', 245], ['Sun', 35]);
  assert.equal(result([...pair, { kind: 'western_sect', sect: 'day' }], reception('sun', 'venus')), true);
  assert.equal(result([...pair, { kind: 'western_sect', sect: 'night' }], reception('sun', 'venus')), false);
  assert.equal(result(pair, reception('sun', 'venus')), undefined);
  assert.equal(result([...pair, { kind: 'western_sect', sect: 'day' }, { kind: 'western_sect', sect: 'night' }], reception('sun', 'venus')), undefined);
  assert.equal(result(facts(['Venus', 245]), reception('sun', 'venus')), undefined, 'unproved direction remains unknown when the known direction is possible');
  assert.equal(result(facts(['Venus', 35]), reception('sun', 'venus')), false, 'a confirmed false direction disproves the entire AND even if the other coordinate is unknown');
  assert.equal(result([coordinate('Mercury', 95)], reception('moon', 'mercury', 'domicile')), undefined);
  assert.equal(result([...facts(['Mercury', 95]), coordinate('Mercury', 125)], reception('moon', 'mercury', 'domicile')), undefined);
  assert.equal(result([...facts(['Mercury', 95]), { kind: 'planet_sign', planet: 'Mercury', sign: '狮子座' }], reception('moon', 'mercury', 'domicile')), undefined);
  assert.deepEqual(lillyReceptionFacts(facts(['Mercury', 95]), [reception('moon', 'mercury', 'domicile')], () => []), []);
  const forged = reception('moon', 'mercury', 'domicile');
  const context = claimChartContext('western', chartContext('western', [forged], [{ ...forged, matches: false }], 'natal'), [forged], at);
  assert.equal(context.present.length, 0);
  assert.equal(context.absentKeys.size, 0);
  const query = { method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: [...facts(['Mercury', 95]), forged] };
  assert.ok(!parseChartQueries([query])[0].confirmedFacts.some(fact => fact.kind === 'western_lilly_reception'));
  assert.ok(!parseChartQueries([query], { timeKnown: false })[0].confirmedFacts.some(fact => fact.kind === 'planet_longitude'));
  assert.throws(() => normalizeFacts('western', [{ ...forged, reception: 'general' }]));
  assert.throws(() => normalizeFacts('western', [{ ...forged, first: 'active_significator' }]));
  assert.notEqual(JSON.stringify(normalizeFacts('western', [forged])), JSON.stringify(normalizeFacts('western', [{ ...forged, first: forged.second, second: forged.first }])));
});

test('house roles and luminary dispositors use calculated traditional domicile rulers and reject self aliases', () => {
  const proof = [...facts(['Sun', 310], ['Mars', 280], ['Saturn', 10]), ...cusps(270)];
  const selected = reception('house_4_ruler', 'sun_dispositor');
  assert.equal(result(proof, selected), true, '4th lord Mars and Sun dispositor Saturn exchange domiciles');
  assert.equal(result(proof.filter(fact => !(fact.kind === 'planet_longitude' && fact.planet === 'Sun')), selected), undefined, 'dispositor identity needs its own luminary position');
  assert.equal(result(proof.filter(fact => fact.kind !== 'western_profile_cusp_longitude'), selected), undefined);
  assert.equal(result([...proof, { kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: 4, longitude: 40 }], selected), undefined);
  assert.equal(result([...proof, { kind: 'western_profile_house_sign', profile: 'regiomontanus', house: 4, sign: '金牛座' }], selected), undefined);
  assert.equal(result([...facts(['Mars', 0]), ...cusps()], reception('house_1_ruler', 'mars')), false, 'the same Mars cannot receive itself through a house alias');
  assert.match(factText(selected), /太阳所在星座的传统庙主/u);
  assert.match(factText(reception('moon', 'mercury', 'domicile')), /月亮以庙位接纳水星/u);
  assert.match(factText(reception('moon', 'mercury', 'domicile', false)), /月亮未以庙位接纳水星/u);
});

test('aggregate ORs, false ORs and exclusions compile logically without weakening unresolved source predicates', () => {
  const aggregate = 'profiles.lilly.travel.sun_to_moon_or_mercury.domicile';
  const make = (include, exclude = []) => ({ source: { book: 'Christian Astrology' }, conditions: { excluded: [], match: { version: 1, status: 'ready', include, exclude, reason: null } } });
  const ordinary = compileWesternClaim(make([[{ fact: aggregate, equals: true }]]));
  const negated = compileWesternClaim(make([[{ fact: aggregate, equals: false }]]));
  assert.equal(ordinary.inputs.length, 2);
  assert.equal(negated.inputs.length, 1);
  assert.equal(negated.inputs[0].required.length, 2);
  const exclusion = compileWesternClaim(make([[{ fact: 'chart.zodiac', equals: 'tropical' }]], [[{ fact: aggregate, equals: true }]]));
  const matches = (compiled, input) => {
    const selectors = compiled.inputs.flatMap(rule => [...rule.required, ...rule.mustBeAbsent]);
    const chart = claimChartContext('western', chartContext('western', input, [], 'natal'), selectors, at);
    return compiled.inputs.some(rule => evaluateRule(rule, 'natal', chart).matched);
  };
  assert.equal(matches(ordinary, facts(['Sun', 95])), true);
  assert.equal(matches(ordinary, facts(['Sun', 65])), true);
  assert.equal(matches(ordinary, facts(['Sun', 125])), false);
  assert.equal(matches(negated, facts(['Sun', 95])), false);
  assert.equal(matches(negated, facts(['Sun', 125])), true);
  assert.equal(matches(negated, [tropical]), false);
  assert.equal(matches(exclusion, facts(['Sun', 95])), false);
  assert.equal(matches(exclusion, facts(['Sun', 125])), true);
  assert.equal(matches(exclusion, [tropical]), false, 'unobserved source cannot disprove either excluded branch');
  const unknown = { fact: 'profiles.lilly.travel.sun_to_moon_or_mercury.reception', equals: true };
  assert.deepEqual(westernClaimConditionAlternatives(unknown, 'lilly'), [[unknown]]);
  assert.equal(compileWesternClaim(make([[unknown]])).reason, 'unsupported_calculation_profile');
  const before = JSON.stringify(source.find(claim => claim.id === 'astro-lilly-v3-mines-p002-001'));
  compileWesternClaim(JSON.parse(before));
  assert.equal(JSON.stringify(source.find(claim => claim.id === 'astro-lilly-v3-mines-p002-001')), before, 'original source is not mutated during expansion');
});
