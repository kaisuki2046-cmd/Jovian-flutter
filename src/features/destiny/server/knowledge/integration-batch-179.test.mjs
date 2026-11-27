import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { isBirthDate } from '../../model/birth-profile.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyAspectAngles, lillyPartileDistance } from './lilly-aspects.mjs';
import { lillyFortune } from './lilly-fortune.mjs';
import { compileLillyFortuneWitness, lillyFortuneWitnessProfile } from './lilly-fortune-witnesses.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-fortune-witness-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-fortune-witness-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const { witnesses, dayMercuryRulerContact, nightMercury, oppositeSect, rulerWithoutTerm } =
  JSON.parse(readFileSync(new URL('./claims/integration-batch-179-witnesses.json', import.meta.url)));
const idOf = key => `astro-lilly-v3-wealth-${key}-001`;
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const onDate = date => witnesses.find(sample => sample.date === date);
const query = (raw, timeKnown = true) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts: raw, tradition: 'Christian Astrology',
}], { timeKnown })[0];
const context = q => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (key, raw, timeKnown = true) => {
  const q = query(raw, timeKnown);
  return explainClaim(idOf(key), 'western', context(q), q.tradition, catalog);
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const proof = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const selected = (facts, kind) => facts.filter(fact => fact.kind === 'western_lilly_fortune_' + kind);
const longitudeOf = (raw, planet) => raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === planet)?.longitude;
const cellsAt = (sign, degree) => catalog.lillyDignityCells(sign, degree);
const sects = { Sun: 'day', Jupiter: 'day', Saturn: 'day', Moon: 'night', Venus: 'night', Mars: 'night' };

function sectOf(raw, planet) {
  if (planet !== 'Mercury') return sects[planet];
  const relative = (longitudeOf(raw, planet) - longitudeOf(raw, 'Sun') + 360) % 360;
  return relative > 180 ? 'day' : relative > 0 && relative < 180 ? 'night' : null;
}

test('each Fortune witness group reaches SQLite, explanations and ordinary report material', () => {
  const expected = new Map();
  for (const id of ['duration-p011', 'duration-p012', 'sources-p030', 'sources-p031',
    'sources-p032', 'sources-p033', 'sources-p034'].map(idOf)) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyFortuneWitnessProfile, id);
    assert.equal(row.remainingAlternatives, 1, id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 校订本';
    assert.equal(compileLillyFortuneWitness(changed).reason, 'source_review_required');
    for (const input of row.inputs) expected.set(id + ':' + digest(input), input);
  }
  assert.equal(expected.size, 11);
  const seen = new Set();
  for (const sample of witnesses) {
    const date = new Date(sample.date);
    assert.ok(isBirthDate({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() }));
    assert.ok(Number.isInteger(date.getTime() / 60_000));
    const raw = rawOf(sample), q = query(raw), base = context(q), lot = lillyFortune(raw);
    const chart = claimChartContext('western', base, [], cellsAt);
    const references = lookup([q]), materials = buildReportMaterials(references);
    const hits = references.flatMap(({ personality, events }) => [...personality, ...events]);
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && !seen.has(key), key);
      assert.equal(evaluateRule(input, 'natal', chart).matched, true, key);
      const result = explainClaim(id, 'western', base, q.tradition, catalog);
      assert.equal(result.matched, true, key);
      assert.ok(hits.some(hit => hit.id === id), key);
      assert.ok(materials.includes(result.claim.evidence.original_text), key);
      const facts = proof(result), [governor] = selected(facts, 'governor');
      assert.equal(governor.planet, lot.ruler);
      assert.ok(materials.includes(factText(governor)), key);
      for (const fact of [...selected(facts, 'testimony'), ...selected(facts, 'malefic_dominion')]) {
        assert.ok(materials.includes(factText(fact)), key);
      }
      for (const { planet, sect, target, aspect } of selected(facts, 'testimony')) {
        const reference = target === 'lot' ? lot.longitude : longitudeOf(raw, lot.ruler);
        assert.notEqual(planet, lot.ruler);
        assert.equal(sectOf(raw, planet), sect);
        assert.equal(sectOf(raw, lot.ruler), sect);
        assert.equal(lillyPartileDistance(longitudeOf(raw, planet), reference), lillyAspectAngles[aspect]);
      }
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('Mercury may witness either sect and contact with the ruler does not become contact with the lot', () => {
  const day = rawOf(onDate(dayMercuryRulerContact)), night = rawOf(nightMercury);
  for (const [raw, sect] of [[day, 'day'], [night, 'night']]) {
    const facts = proof(explain('duration-p011', raw));
    assert.ok(selected(facts, 'testimony').some(fact => fact.planet === 'Mercury' && fact.sect === sect));
  }
  const dayDetails = explain('duration-p011', day);
  const [actual] = selected(proof(dayDetails), 'testimony').filter(fact => fact.planet === 'Mercury');
  assert.equal(actual.target, 'ruler');
  assert.ok(![60, 120].includes(lillyPartileDistance(longitudeOf(day, 'Mercury'), lillyFortune(day).longitude)));
  const conflict = [...day, { kind: 'planet_longitude', planet: 'Mercury', longitude: (longitudeOf(day, 'Mercury') + 1) % 360 }];
  const derived = claimChartContext('western', context(query(conflict)), [], cellsAt);
  assert.ok(selected(derived.present, 'testimony').every(fact => fact.planet !== 'Mercury'));
});

test('an aspect from the opposite sect does not count and supplied proof cannot replace coordinates', () => {
  const wrong = rawOf(oppositeSect), fortune = lillyFortune(wrong);
  const opposite = wrong.filter(fact => fact.kind === 'planet_longitude' && Object.hasOwn(sects, fact.planet)
    && sectOf(wrong, fact.planet) !== sectOf(wrong, fortune.ruler));
  assert.ok(opposite.some(({ longitude }) => [fortune.longitude, longitudeOf(wrong, fortune.ruler)]
    .some(target => [60, 120].includes(lillyPartileDistance(longitude, target)))));
  assert.equal(explain('duration-p011', wrong).matched, false);
  const day = rawOf(onDate(dayMercuryRulerContact)), detail = explain('duration-p011', day);
  const withoutHouse = day.filter(fact => fact.kind !== 'western_profile_cusp_longitude' || fact.house !== 1);
  assert.equal(explain('duration-p011', [...withoutHouse, ...proof(detail)]).matched, false);
  assert.equal(explain('duration-p011', day, false).matched, false);
});

test('a malefic must actually own both the lot sign and its term', () => {
  const signs = 'aries taurus gemini cancer leo virgo libra scorpio sagittarius capricorn aquarius pisces'.split(' ');
  const cellsOf = ({ longitude }) => cellsAt(signs[Math.floor(longitude / 30)], Math.floor(longitude % 30));
  for (const sample of witnesses.filter(row => row.proofs.some(proof => proof.id === idOf('duration-p012')))) {
    const raw = rawOf(sample), fortune = lillyFortune(raw);
    const detail = explain('duration-p012', raw);
    assert.equal(detail.matched, true);
    assert.deepEqual(selected(proof(detail), 'malefic_dominion').map(fact => fact.planet), [fortune.ruler]);
    const owned = cellsOf(fortune).filter(cell => cell.body === fortune.ruler.toLowerCase());
    assert.ok(['domicile', 'term'].every(name => owned.some(cell => cell.dimension === name)));
  }
  const raw = rawOf(onDate(rulerWithoutTerm)), fortune = lillyFortune(raw);
  assert.equal(fortune.ruler, 'Saturn');
  assert.ok(cellsOf(fortune).some(cell => cell.dimension === 'term' && cell.body !== 'saturn'));
  assert.equal(explain('sources-p030', raw).matched, true);
  assert.equal(explain('duration-p012', raw).matched, false);
});
