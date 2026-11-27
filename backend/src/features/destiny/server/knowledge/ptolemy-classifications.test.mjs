import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { zodiacNames } from '../../control/charts.ts';
import { compileWesternClaim } from './western-claims.mjs';
import { compilePtolemyClassifications, ptolemyClassificationReferences, ptolemyClassificationSourceIds } from './ptolemy-classifications.mjs';
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const selected = sources.filter(c => ptolemyClassificationSourceIds.includes(c.id)), tables = compilePtolemyClassifications(selected);
const cells = [...tables].flatMap(([sourceId, t]) => t.entries.map(c => ({ ...c, sourceId, source: {} })));
const at = (planet, sign, sect) => cells.filter(c => (c.target === 'planet' && c.key === planet || c.target === 'sign' && c.key === sign) && ['both', sect].includes(c.sect));
const raw = (planet, sign, sect = 'day') => [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'planet_sign', planet, sign: zodiacNames[sign] }, ...(sect ? [{ kind: 'western_sect', sect }] : [])];
const state = facts => Object.fromEntries((ptolemyClassificationReferences(facts, at)[0]?.classifications ?? []).map(c => [c.dimension, c.values]));
// Independently transcribed Robbins I.5, I.7, I.11-12, I.18, not a Lilly table.
const nature = { Sun: 'common', Moon: 'beneficent', Mercury: 'common', Venus: 'beneficent', Mars: 'maleficent', Jupiter: 'beneficent', Saturn: 'maleficent' };
const affinity = { Sun: 'diurnal', Moon: 'nocturnal', Venus: 'nocturnal', Mars: 'nocturnal', Jupiter: 'diurnal', Saturn: 'diurnal' };
const triangles = { day: [['sun'], ['venus'], ['saturn'], ['venus', 'mars']], night: [['jupiter'], ['moon'], ['mercury'], ['moon', 'mars']] };

test('19 original sources form 61 cells and reproduce all 168 independent body/sign/sect classifications', () => {
  assert.equal(tables.size, 19); assert.equal(cells.length, 61);
  for (const planet of Object.keys(nature)) for (let sign = 0; sign < 12; sign++) for (const sect of ['day', 'night']) {
    const result = state(raw(planet, sign, sect)), mode = [3, 9].includes(sign) ? 'solstitial' : [0, 6].includes(sign) ? 'equinoctial' : [1, 4, 7, 10].includes(sign) ? 'solid' : 'bicorporeal';
    assert.deepEqual(result.planet_nature, [nature[planet]]); assert.deepEqual(result.planet_sect_affinity, affinity[planet] ? [affinity[planet]] : undefined);
    assert.deepEqual(result.sign_mode, [mode]); assert.deepEqual(result.sign_polarity, [sign % 2 ? 'feminine' : 'masculine']); assert.deepEqual(result.triplicity_rulers, triangles[sect][sign % 4]);
  }
});

test('unknown or contradictory sect never invents a triplicity result, a partial water co-ruler set, or Mercury affinity', () => {
  for (const facts of [raw('Mercury', 3, null), [...raw('Mercury', 3), { kind: 'western_sect', sect: 'night' }]]) {
    const result = state(facts); assert.deepEqual(result.planet_nature, ['common']); assert.equal(result.planet_sect_affinity, undefined); assert.equal(result.triplicity_rulers, undefined); assert.deepEqual(result.sign_mode, ['solstitial']);
  }
  assert.deepEqual(state(raw('Sun', 3, 'night')).planet_sect_affinity, ['diurnal'], 'fixed affinity is not the birth sect');
  assert.deepEqual(state(raw('Moon', 3)).planet_nature, ['beneficent'], 'Ptolemy explicitly includes the Moon; Lilly categories stay separate');
});

test('sign-only evidence needs no invented degree, while conflicting longitudes/signs and absent objects cannot supply a class', () => {
  const longitude = value => [{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'planet_longitude', planet: 'Sun', longitude: value }];
  assert.deepEqual(state(longitude(29.999)).sign_mode, ['equinoctial']); assert.deepEqual(state(longitude(30)).sign_mode, ['solid']);
  assert.deepEqual(state(longitude(359.999)).sign_mode, ['bicorporeal']); assert.deepEqual(state(longitude(360)), {});
  assert.deepEqual(state([...longitude(30), { kind: 'planet_sign', planet: 'Sun', sign: '白羊座' }]), {});
  assert.deepEqual(state([...longitude(30), { kind: 'planet_longitude', planet: 'Sun', longitude: 31 }]), {});
  assert.deepEqual(state(raw('Sun', 1, null)).sign_mode, ['solid']); assert.deepEqual(state([]), {});
});

test('planet identity classifications remain available without a tropical declaration, but sign categories never leak across zodiacs', () => {
  for (const facts of [raw('Moon', 3).filter(f => f.kind !== 'western_zodiac'), [...raw('Moon', 3), { kind: 'western_zodiac', zodiac: 'sidereal' }]]) {
    const result = state(facts); assert.deepEqual(result.planet_nature, ['beneficent']); assert.deepEqual(result.planet_sect_affinity, ['nocturnal']);
    for (const dimension of ['sign_mode', 'sign_polarity', 'triplicity_rulers']) assert.equal(result[dimension], undefined);
  }
  assert.deepEqual(ptolemyClassificationReferences([{ kind: 'ptolemy_classification', planet: 'Moon', value: 'beneficent' }], at), []);
});

test('all 57 source/condition/evidence alterations and incomplete matrices fail closed, and returned vectors cannot mutate source specs', () => {
  for (const original of selected) for (const field of ['source', 'conditions', 'evidence']) {
    const changed = structuredClone(selected), claim = changed.find(c => c.id === original.id);
    if (field === 'source') claim.source.edition += '修订';
    if (field === 'conditions') claim.conditions.normalized.push('新条件');
    if (field === 'evidence') claim.evidence.original_text += '新原句';
    assert.throws(() => compilePtolemyClassifications(changed), /Review Ptolemy/u);
  }
  assert.throws(() => compilePtolemyClassifications(selected.slice(1)), /Incomplete/u); assert.equal(compilePtolemyClassifications([]).size, 0);
  const changed = compilePtolemyClassifications(selected); changed.values().next().value.entries[0].values[0] = 'forged';
  assert.ok(![...compilePtolemyClassifications(selected).values()].some(t => t.entries.some(c => c.values.includes('forged'))));
});

test('classification definitions are calculation references and never compile as unconditional personal prediction rules', () => {
  for (const claim of selected) { const before = JSON.stringify(claim), result = compileWesternClaim(claim); assert.equal(result.reason, 'unsupported_calculation_profile'); assert.equal(result.inputs, undefined); assert.equal(JSON.stringify(claim), before); }
});
