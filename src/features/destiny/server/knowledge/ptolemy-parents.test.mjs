import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { ptolemyParentsFacts, ptolemyParentsProfile } from './ptolemy-parents.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const { place, witnesses, sourceRecords, alternatives, negative } =
  JSON.parse(readFileSync(new URL('./claims/integration-batch-69-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory(), lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const claimId = suffix => `astro-ptolemy-v3-parents-p${suffix}-001`;
const native = instant => chartFacts.western(calculateWestern(Date.parse(instant), place));
const queryFor = (confirmedFacts, fields = {}) => ({ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
  confirmedFacts, ...fields });
const hits = refs => refs.flatMap(ref => [...ref.events, ...ref.personality]);

function parse(facts, fields, options) {
  const queries = parseChartQueries([queryFor(facts, fields)], options);
  assert.ok(queries);
  return queries;
}

function explain(id, query) {
  const chart = { ...chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope),
    ptolemyParentAttendanceText: query.ptolemyParentAttendanceText };
  return explainClaim(id, 'western', chart, undefined, catalog);
}

test('all reviewed Ptolemy parent alternatives reach SQLite, explanation and report materials from native charts', () => {
  const ids = ['001', '002', '008', '009', '024'].map(claimId);
  assert.equal(ids.length, sourceRecords);
  const expected = new Set();
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, ptolemyParentsProfile);
    assert.equal(row.remainingAlternatives, 0);
    for (const input of row.inputs) expected.add(id + ':' + digest(input));
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' alternate evidence';
    assert.equal(compileWesternClaim(changed).reason, 'source_review_required');
  }
  assert.equal(expected.size, alternatives);
  const seen = new Set();
  for (const { instant, edition, proofs } of witnesses) {
    const fields = edition === 'allacci_latin' ? { ptolemyParentAttendanceText: edition } : {};
    const queries = parse(native(instant), fields);
    const refs = lookup(queries), found = hits(refs), materials = buildReportMaterials(refs);
    for (const { id, inputDigest } of proofs) {
      const row = catalog.get(id);
      const input = row.inputs.find(candidate => digest(candidate) === inputDigest);
      assert.ok(input, id);
      assert.ok(found.some(hit => hit.id === id), id);
      const detail = explain(id, queries[0]);
      assert.ok(detail.matched, id);
      const groups = detail.matchedConditions.alternatives.length
        ? detail.matchedConditions.alternatives : [detail.matchedConditions.required];
      assert.ok(groups.some(required => JSON.stringify(required) === JSON.stringify(input.required)), id);
      assert.ok(materials.includes(row.claim.evidence.original_text), id);
      assert.ok(materials.includes(detail.calculationNote), id);
      seen.add(id + ':' + inputDigest);
    }
    assert.doesNotMatch(materials, /western_ptolemy_parent|active_luminary_or_planet/u);
  }
  assert.deepEqual(seen, expected);
});

test('the source variants preserve distinct gates and Allacci requires deliberate edition selection', () => {
  const greek = claimId('001'), robbins = claimId('002'), latin = claimId('024');
  const matched = queries => new Set(hits(lookup(queries)).map(hit => hit.id));
  const independentRoles = matched(parse(native(negative.differentAttendants)));
  assert.ok(independentRoles.has(greek));
  assert.ok(!independentRoles.has(robbins) && !independentRoles.has(latin));
  const facts = native(negative.allacciOnly);
  const defaultEdition = matched(parse(facts));
  assert.ok([greek, robbins, latin].every(id => !defaultEdition.has(id)));
  const latinEdition = { ptolemyParentAttendanceText: 'allacci_latin' };
  const selected = matched(parse(facts, latinEdition));
  assert.ok(selected.has(latin) && !selected.has(greek) && !selected.has(robbins));
  const strictWitness = witnesses.find(({ proofs }) => proofs.some(({ id }) => id === robbins));
  const strictFacts = native(strictWitness.instant);
  assert.ok(matched(parse(strictFacts)).has(robbins));
  const strictLatin = matched(parse(strictFacts, latinEdition));
  assert.ok(strictLatin.has(latin) && !strictLatin.has(greek) && !strictLatin.has(robbins));
  assert.equal(parseChartQueries([queryFor(facts, { ptolemyParentAttendanceText: 'either' })]), null);
  assert.equal(parseChartQueries([queryFor(facts, { ...latinEdition, chartScope: 'annual' })]), null);
});

test('sect priority and attendance require usable natal coordinates and derived claims are rechecked', () => {
  const greek = claimId('001'), father = claimId('008'), mother = claimId('009'), latin = claimId('024');
  const facts = native(negative.differentAttendants);
  const noSect = facts.filter(fact => fact.kind !== 'western_sect');
  const ambiguousSect = [...facts, { kind: 'western_sect', sect: 'night' }];
  for (const input of [noSect, ambiguousSect]) {
    const [parsed] = parse(input);
    assert.ok(explain(greek, parsed).matched);
    assert.equal(explain(father, parsed).matched, false);
    assert.equal(explain(mother, parsed).matched, false);
  }
  const missingMoon = facts.filter(fact => !(fact.kind === 'planet_longitude' && fact.planet === 'Moon'));
  const contradictoryMoon = [...facts, { kind: 'planet_longitude', planet: 'Moon', longitude: 123 }];
  const forged = ptolemyParentsFacts(facts);
  const [stripped] = parse([...missingMoon, ...forged]);
  assert.ok(stripped.confirmedFacts.every(fact => fact.kind !== 'western_ptolemy_parent'));
  for (const query of [queryFor([...missingMoon, ...forged]), stripped, parse(contradictoryMoon)[0],
    parse(facts, {}, { timeKnown: false })[0], parse(facts, { chartScope: 'annual' })[0]]) {
    assert.equal(explain(greek, query).matched, false);
  }
  const [unknownTime] = parse(facts, { ptolemyParentAttendanceText: 'allacci_latin' }, { timeKnown: false });
  assert.ok([father, mother, latin].every(id => !explain(id, unknownTime).matched));
  const [forgedAbsence] = parse(facts, { confirmedAbsentFacts: forged });
  assert.ok(explain(greek, forgedAbsence).matched);
});

test('attendance wraps from Pisces to Aries and Mercury changes sect by phase', () => {
  const selectors = longitude => ptolemyParentsFacts([
    { kind: 'western_zodiac', zodiac: 'tropical' },
    ...Object.entries({ Sun: 359, Moon: 8, Mercury: longitude, Jupiter: 2 }).map(([planet, longitude]) =>
      ({ kind: 'planet_longitude', planet, longitude })),
  ]).map(fact => fact.selector);
  const evening = selectors(1);
  assert.ok(evening.includes('attendance.sun.benefic_next_following_sign'));
  assert.ok(evening.includes('attendance.sun.same_sect_next_following_sign'));
  assert.ok(evening.includes('attendance.moon.same_sect_same_sign'));
  const morning = selectors(357);
  assert.ok(morning.includes('attendance.sun.same_sect_same_sign'));
  assert.ok(!morning.includes('attendance.moon.same_sect_same_sign'));
  assert.ok(!selectors(359).includes('attendance.sun.same_sect_same_sign'));
});
