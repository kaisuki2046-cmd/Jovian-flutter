import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { compileLillyDignityCells, lillyDignityFacts, lillyDignityProfile } from './lilly-dignities.mjs';
import { westernClaimConditionAlternatives, compileWesternClaim } from './western-claims.mjs';
import { claimChartContext } from './claims.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { normalizeFacts } from './catalog.mjs';
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const cells = compileLillyDignityCells(sources.filter(row => /^astro-lilly-v1-dignity-table-p\d+-001$/u.test(row.id) && Number(row.id.match(/-p(\d+)/u)[1]) <= 144));
const at = (sign, degree) => cells.filter(cell => cell.sign === sign && cell.start <= degree && degree < cell.end);
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' }, sect = value => ({ kind: 'western_sect', sect: value });
const coordinates = entries => [tropical, ...entries.map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude }))];
const count = facts => lillyDignityFacts(facts, at, { includeCount: true }).find(f => f.kind === 'western_lilly_dignified_count')?.count;
// Independently chosen p.104 placements: Mercury has domicile AND exaltation,
// Venus a domicile; Sun has only day triplicity, Moon only night triplicity.
const base = [['Sun', 255], ['Moon', 155], ['Mercury', 165], ['Venus', 31], ['Mars', 32], ['Jupiter', 75], ['Saturn', 92]];
const replace = (entries, planet, longitude) => entries.map(row => row[0] === planet ? [planet, longitude] : row);

test('the complete seven-body count counts each planet once, preserves exact values and excludes outer planets and detriment', () => {
  const facts = coordinates(base); assert.equal(count([...facts, sect('day')]), 3); assert.equal(count([...facts, sect('night')]), 3);
  const mercury = lillyDignityFacts([...facts, sect('day')], at).filter(f => f.planet === 'Mercury' && f.matches);
  assert.ok(mercury.some(f => f.dignity === 'domicile')); assert.ok(mercury.some(f => f.dignity === 'exaltation'));
  assert.equal(count([...coordinates(replace(base, 'Moon', 95)), sect('day')]), 4);
  assert.equal(count([...coordinates(replace(replace(base, 'Moon', 95), 'Jupiter', 245)), sect('day')]), 5);
  assert.equal(count([...facts, ...coordinates([['Uranus', 0], ['Neptune', 0], ['Pluto', 0]]).slice(1), sect('day')]), 3);
  const mars = lillyDignityFacts([...facts, sect('day')], at).filter(f => f.planet === 'Mars');
  assert.ok(mars.some(f => f.dignity === 'detriment' && f.matches)); assert.ok(mars.some(f => f.dignity === 'peregrine' && f.matches));
});

test('unknown sect compares whole-chart counts before intersecting per-body facts, allowing a compensating Sun/Moon exchange', () => {
  const facts = coordinates(base), individual = lillyDignityFacts(facts, at);
  assert.ok(!individual.some(f => ['Sun', 'Moon'].includes(f.planet) && f.dignity === 'peregrine'));
  assert.equal(count(facts), 3, 'the whole count is certain although the two individual memberships are not');
  const changed = coordinates(replace(base, 'Moon', 65));
  assert.equal(count([...changed, sect('day')]), 3); assert.equal(count([...changed, sect('night')]), 2);
  assert.equal(count(changed), undefined, 'different complete outcomes remain unknown');
});

test('missing, conflicting, unconfirmed or incomplete-table inputs cannot invent a count or trust client count flags', () => {
  const facts = coordinates(base), fake = { kind: 'western_lilly_dignified_count', count: 3, profile: lillyDignityProfile };
  for (const raw of [facts.filter(f => f.planet !== 'Saturn'), [...facts, { kind: 'planet_longitude', planet: 'Saturn', longitude: 93 }],
    [...facts, { kind: 'planet_sign', planet: 'Moon', sign: '白羊座' }], facts.filter(f => f.kind !== 'western_zodiac'),
    [...facts, sect('day'), sect('night')], [...facts, { kind: 'western_zodiac', zodiac: 'sidereal' }]]) assert.equal(count(raw), undefined);
  assert.ok(!lillyDignityFacts([...facts, sect('day')], (sign, degree) => sign === 'gemini' ? [] : at(sign, degree), { includeCount: true }).some(f => f.kind === fake.kind));
  const chart = claimChartContext('western', chartContext('western', [tropical, fake], [{ ...fake, count: 4 }], 'natal'), [], at);
  assert.ok(!chart.present.some(f => f.kind === fake.kind)); assert.ok(![...chart.absentKeys].some(key => JSON.parse(key).kind === fake.kind));
  for (const bad of [{ ...fake, count: 8 }, { ...fake, count: -1 }, { ...fake, count: 3.5 }, { ...fake, profile: 'other' }]) assert.throws(() => normalizeFacts('western', [bad]));
});

test('compound positive and negative source conditions keep AND and its De Morgan negation, without guessing unknown values', () => {
  for (const fact of ['profiles.lilly.marriage.venus_aphorisms.oriental_dignified']) {
    const positive = westernClaimConditionAlternatives({ fact, equals: true }, 'lilly');
    const negative = westernClaimConditionAlternatives({ fact, equals: false }, 'lilly');
    assert.equal(positive.length, 1); assert.equal(positive[0].length, 2); assert.equal(negative.length, 2);
    const [a, b] = positive[0];
    const evaluate = (groups, values) => groups.some(group => group.every(item => values.has(item.fact) && values.get(item.fact) === item.equals));
    for (const x of [false, true]) for (const y of [false, true]) {
      const values = new Map([[a.fact, x ? a.equals : !a.equals], [b.fact, y ? b.equals : !b.equals]]);
      assert.equal(evaluate(positive, values), x && y); assert.equal(evaluate(negative, values), !(x && y));
    }
    const unknown = new Map([[a.fact, a.equals]]); assert.equal(evaluate(positive, unknown), false); assert.equal(evaluate(negative, unknown), false);
    const decisiveFalse = new Map([[a.fact, !a.equals]]); assert.equal(evaluate(negative, decisiveFalse), true);
  }
  const ambiguous = { fact: 'profiles.lilly.marriage.appearance.venus_saturn_in_saturn_terms', equals: false };
  assert.deepEqual(westernClaimConditionAlternatives(ambiguous, 'lilly'), [[ambiguous]], 'negating a sufficient common-positive witness cannot negate the unresolved whole source predicate');
  assert.equal(westernClaimConditionAlternatives({ ...ambiguous, equals: true }, 'lilly')[0].length, 2);
});

test('the two single-direction domicile alternatives each work independently and never require mutual reception', () => {
  const source = sources.find(row => row.id === 'astro-lilly-v3-travel-p008-001'), compiled = compileWesternClaim(source);
  assert.equal(compiled.inputs.length, 2); assert.ok(compiled.inputs.every(i => i.required.every(f => f.kind !== 'western_lilly_reception' || f.reception === 'domicile')));
  const matches = entries => {
    const raw = coordinates(entries), requested = compiled.inputs.flatMap(i => i.required);
    const context = claimChartContext('western', chartContext('western', raw, [], 'natal'), requested, at);
    return compiled.inputs.some(input => evaluateRule(input, 'natal', context).matched);
  };
  assert.equal(matches([['Moon', 65]]), true); assert.equal(matches([['Moon', 155]]), true); assert.equal(matches([['Mercury', 95]]), true);
  assert.equal(matches([['Moon', 5], ['Mercury', 5]]), false); assert.equal(matches([]), false);
});

test('the exact-count source and its profile cannot be widened to at least three or moved into another convention', () => {
  const source = sources.find(row => row.id === 'astro-lilly-v3-general-fortune-p001-001'), compiled = compileWesternClaim(source);
  assert.deepEqual(compiled.inputs.map(i => i.required.find(f => f.kind === 'western_lilly_dignified_count').count), [3, 4]);
  assert.equal(compileWesternClaim({ ...source, source: { ...source.source, book: 'Tetrabiblos' } }).reason, 'unsupported_calculation_profile');
  normalizeFacts('western', [{ kind: 'western_lilly_dignified_count', count: 3, profile: lillyDignityProfile }]);
});

test('a confirmed domicile sign needs no invented degree, while term ownership and contradictory coordinates stay unknown', () => {
  const source = sources.find(row => row.id === 'astro-lilly-v3-travel-p008-001'), compiled = compileWesternClaim(source);
  const requested = compiled.inputs.flatMap(input => input.required), sign = { kind: 'planet_sign', planet: 'Moon', sign: '双子座' };
  const evaluate = facts => {
    const context = claimChartContext('western', chartContext('western', facts, [], 'natal'), requested, at);
    return compiled.inputs.some(input => evaluateRule(input, 'natal', context).matched);
  };
  assert.equal(evaluate([tropical, sign]), true); assert.equal(evaluate([tropical, { ...sign, sign: '白羊座' }]), false);
  assert.equal(evaluate([tropical, sign, { ...sign, sign: '处女座' }]), false);
  assert.equal(evaluate([tropical, sign, { kind: 'planet_longitude', planet: 'Moon', longitude: 0 }]), false);
  const term = { kind: 'western_lilly_reception', first: 'saturn', second: 'venus', reception: 'term', matches: true, profile: lillyDignityProfile };
  const facts = [tropical, { kind: 'planet_sign', planet: 'Venus', sign: '白羊座' }];
  assert.ok(!claimChartContext('western', chartContext('western', facts, [], 'natal'), [term], at).present.some(f => f.kind === 'western_lilly_reception'));
});
