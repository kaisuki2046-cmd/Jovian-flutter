import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { Body, EquatorFromVector, GeoVector, MakeTime, RotateVector, Rotation_EQJ_EQD, SiderealTime } from 'astronomy-engine';
import { calculateWestern, chartFacts, chartVersions, zodiacNames } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { normalizeFacts } from './catalog.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { compilePtolemyBookOne, ptolemyBookOneProfile, ptolemyBookOneFacts } from './ptolemy-book-one.mjs';
import { parseChartQueries } from './report-lookup.mjs';

const prefix = 'destiny-ptolemy-book-one-conditions-';
const directory = mkdtempSync(join(tmpdir(), prefix));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + prefix));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const samples = JSON.parse(readFileSync(new URL('./claims/integration-batch-190-witnesses.json', import.meta.url)));
const sampleOf = witness => samples.find(sample => sample.witnesses.includes(witness));
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const rawFor = witness => rawOf(sampleOf(witness));
const idOf = (segment, number) => `astro-ptolemy-v1-${segment}-p${String(number).padStart(3, '0')}-001`;
const ids = [...[2, 3, 4, 5].map(number => idOf('zodiac-types', number)), ...[1, 2, 3].map(number => idOf('chapter-23', number)),
  ...[2, 3, 6, 7, 8, 9, 12].map(number => idOf('applications', number))];
const context = (facts, timeKnown = true) => {
  const [query] = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts: facts, tradition: 'Tetrabiblos' }], { timeKnown });
  return chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
};
const explain = (id, raw, { timeKnown = true, historicalAphorism = true } = {}) =>
  explainClaim(id, 'western', context(raw, timeKnown), 'Tetrabiblos', catalog, { historicalAphorism });
const detail = result => result.matchedConditions.required;
const get = (facts, kind) => facts.filter(fact => fact.kind === kind);
const proofOf = (result, suffix) => get(detail(result), 'western_ptolemy_book_one_' + suffix);
const wrap = v => (v % 360 + 360) % 360;
const arc = v => wrap(v + 180) - 180;

test('fourteen source rows and all twenty alternatives query SQLite from nine native charts', () => {
  const fixtures = new Map(samples.map(sample => [sample, rawOf(sample)]));
  const covered = new Set();
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, ptolemyBookOneProfile, id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    const edited = structuredClone(row.claim);
    edited.evidence.context += '异文';
    assert.equal(compilePtolemyBookOne(edited).reason, 'source_review_required', id);
    for (const group of row.inputs) {
      const { witness } = group.required.find(fact => fact.witness);
      const raw = fixtures.get(sampleOf(witness));
      assert.ok(raw, witness);
      const result = explain(id, raw);
      assert.equal(result.matched, true, id + ' ' + witness);
      const matchedFacts = [detail(result), ...result.matchedConditions.alternatives].flat();
      assert.ok(matchedFacts.some(fact => fact.witness === witness), witness);
      assert.match(result.calculationNote, /I\.1[16]|I\.2[34]|卷一/u);
      for (const fact of matchedFacts) assert.doesNotMatch(factText(fact), /undefined/u);
      assert.equal(explain(id, raw, { historicalAphorism: false }).reason, 'historical_aphorism_requires_opt_in');
      covered.add(witness);
    }
  }
  assert.equal(covered.size, 20);
  const raw = fixtures.values().next().value;
  const derived = claimChartContext('western', context(raw), [], undefined, undefined, { ptolemyBookOne: true });
  assert.ok(catalog.candidates('western', derived.presentKeys, 'Tetrabiblos').every(row => !ids.includes(row.claim.id)));
});

test('all signs have exactly the I.11 class and the Venus example requires both directed sextiles', () => {
  const classes = { equinox_sign: [0, 6], solid_sign: [1, 4, 7, 10], bicorporeal_sign: [2, 5, 8, 11], solstice_sign: [3, 9] };
  for (const [index, sign] of zodiacNames.entries()) {
    const result = ptolemyBookOneFacts([{ kind: 'western_zodiac', zodiac: 'tropical' }, { kind: 'planet_sign', planet: 'Moon', sign }]);
    assert.deepEqual(result.filter(fact => Object.hasOwn(classes, fact.witness)).map(fact => fact.witness),
      Object.keys(classes).filter(name => classes[name].includes(index)));
  }
  const id = idOf('chapter-23', 2), facts = rawFor('proper_face_venus_both');
  const result = explain(id, facts);
  assert.deepEqual(proofOf(result, 'face').map(fact => [fact.planet, fact.luminary, fact.steps]), [['Venus', 'Sun', 2], ['Venus', 'Moon', 2]]);
  const longitude = planet => facts.find(fact => fact.kind === 'planet_longitude' && fact.planet === planet).longitude;
  const signOf = planet => Math.floor(longitude(planet) / 30);
  assert.equal((signOf('Venus') - signOf('Sun') + 12) % 12, 2);
  assert.equal((signOf('Moon') - signOf('Venus') + 12) % 12, 2);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Moon')).matched, false);
  assert.equal(explain(idOf('chapter-23', 3), rawFor('two_familiarities').filter(fact => fact.kind !== 'western_sect')).matched, false);
});

test('relative signed velocity distinguishes applying and separating, and only bodily contact requires same-side latitude', () => {
  const conjunctionId = idOf('applications', 2), rayId = idOf('applications', 3);
  const facts = rawFor('body_applying');
  const contacts = proofOf(explain(conjunctionId, facts), 'contact');
  assert.deepEqual(new Set(contacts.map(fact => fact.phase)), new Set(['applying', 'separating']));
  const angles = { conjunction: 0, sextile: 60, square: 90, trine: 120, opposition: 180 };
  const verify = (contact, raw) => {
    const { first, second, aspect, phase, distance } = contact;
    const value = (kind, planet, field) => raw.find(fact => fact.kind === kind && fact.planet === planet)[field];
    const offset = arc(value('planet_longitude', first, 'longitude') - value('planet_longitude', second, 'longitude'));
    const residual = offset - Math.sign(offset) * angles[aspect];
    const rate = value('planet_hourly_motion', first, 'signedDegrees') - value('planet_hourly_motion', second, 'signedDegrees');
    assert.equal(distance, Math.abs(residual));
    assert.equal(phase, residual * rate < 0 ? 'applying' : 'separating');
  };
  for (const contact of contacts) verify(contact, facts);
  const { first, second } = contacts.find(fact => fact.phase === 'applying');
  const forPair = facts.filter(fact => !fact.planet || [first, second].includes(fact.planet));
  assert.equal(explain(conjunctionId, forPair).matched, true);
  const reversed = forPair.map(fact => fact.kind === 'western_geometry_planet_latitude' && fact.planet === first
    ? { ...fact, latitude: -fact.latitude } : fact);
  assert.equal(explain(conjunctionId, reversed).matched, false);
  const noSpeed = forPair.filter(fact => fact.kind !== 'planet_hourly_motion' || fact.planet !== first);
  assert.equal(explain(conjunctionId, noSpeed).matched, false);
  const rays = rawFor('ray_applying').filter(fact => fact.kind !== 'western_geometry_planet_latitude');
  const rayContacts = proofOf(explain(rayId, rays), 'contact');
  assert.ok(rayContacts.some(fact => fact.phase === 'applying'));
  for (const contact of rayContacts) verify(contact, rays);
  assert.deepEqual(normalizeFacts('western', rayContacts), rayContacts);
});

test('native upper, lower and horizon events independently agree with equatorial positions and sidereal time', () => {
  const rad = Math.PI / 180;
  for (const [number, witness, angle] of [[6, 'upper_culmination', 'mc'], [6, 'approaching_upper_culmination', 'mc'],
    [7, 'horizon', 'descendant'], [8, 'eastern_horizon', 'ascendant'], [8, 'lower_culmination', 'ic']]) {
    const sample = sampleOf(witness), raw = rawOf(sample), time = MakeTime(new Date(sample.date));
    const result = explain(idOf('applications', number), raw);
    const evidence = proofOf(result, 'angle').filter(fact => fact.angle === angle);
    assert.ok(evidence.length, witness);
    for (const { planet, offset } of evidence) {
      const position = EquatorFromVector(RotateVector(Rotation_EQJ_EQD(time), GeoVector(Body[planet], time, true)));
      let event = position.ra * 15;
      if (angle === 'ic') event += 180;
      if (angle === 'ascendant' || angle === 'descendant') {
        const horizonArc = Math.acos(-Math.tan(sample.latitude * rad) * Math.tan(position.dec * rad)) / rad;
        event += angle === 'ascendant' ? -horizonArc : horizonArc;
      }
      const independentlyCalculated = arc(event - (SiderealTime(time) * 15 + sample.longitude));
      assert.ok(Math.abs(independentlyCalculated - offset) < 0.02, `${planet} ${angle}: ${offset} vs ${independentlyCalculated}`);
      if (witness === 'approaching_upper_culmination') assert.ok(offset > 1 && offset <= 3);
      else assert.ok(Math.abs(offset) <= 1);
    }
  }
});

test('unknown times, conflicting angles, and injected selectors withhold unsupported angular evidence', () => {
  const id = idOf('applications', 6), raw = rawFor('upper_culmination');
  const bogus = { kind: 'western_ptolemy_book_one_selector', witness: 'upper_culmination' };
  assert.equal(explain(id, [...raw, bogus], { timeKnown: false }).matched, false);
  const mc = raw.find(fact => fact.kind === 'western_geometry_midheaven');
  assert.equal(explain(id, [...raw, { ...mc, longitude: wrap(mc.longitude + 0.5) }, bogus]).matched, false);
  const direct = explain(idOf('applications', 9), rawFor('ascendant_disjunct'));
  const ascendant = get(detail(direct), 'western_geometry_ascendant')[0].longitude;
  for (const { planet, steps } of proofOf(direct, 'asc_aspect')) {
    const sign = get(detail(direct), 'planet_sign').find(fact => fact.planet === planet).sign;
    assert.ok([1, 5].includes(steps) && ![0, 6].includes((Math.floor(ascendant / 30) + zodiacNames.indexOf(sign)) % 12));
  }
});
