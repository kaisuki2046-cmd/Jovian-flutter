import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, zodiacNames } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compilePtolemyBookOne, ptolemyBookOneFacts, ptolemyBookOneProfile } from './ptolemy-book-one.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-ptolemy-book-one-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-ptolemy-book-one-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const samples = JSON.parse(readFileSync(new URL('./claims/integration-batch-185-witnesses.json', import.meta.url)));
const idOf = (chapter, passage) => `astro-ptolemy-v1-chapter-${chapter}-p${String(passage).padStart(3, '0')}-001`;
const chapterSizes = [[6, 7], [7, 6], [8, 4], [13, 4], [14, 3], [15, 1], [16, 1]];
const ids = new Set(chapterSizes.flatMap(([chapter, size]) =>
  Array.from({ length: size }, (_, i) => i + 1).filter(p => chapter !== 7 || p >= 3).map(p => idOf(chapter, p))));
const rawOf = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const parse = (raw, timeKnown = true) => parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
  confirmedFacts: raw, tradition: 'Tetrabiblos' }], { timeKnown })[0];
const context = query => chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (chapter, passage, raw, timeKnown = true) => {
  const query = parse(raw, timeKnown);
  return explainClaim(idOf(chapter, passage), 'western', context(query), query.tradition, catalog, { historicalAphorism: true });
};
const proof = result => [result.matchedConditions.required, ...result.matchedConditions.alternatives].flat();
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const sign = (planet, index) => ({ kind: 'planet_sign', planet, sign: zodiacNames[index] });
const degree = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const sect = value => ({ kind: 'western_sect', sect: value });

test('all 24 source IDs and 27 groups reach SQLite explanations from native charts', () => {
  const natives = samples.map(sample => {
    const query = parse(rawOf(sample)), rawContext = context(query);
    return { sample, query, rawContext, chart: claimChartContext('western', rawContext, [], undefined, undefined, { ptolemyBookOne: true }) };
  });
  assert.equal(ids.size, 24);
  const witnesses = new Set();
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, ptolemyBookOneProfile, id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    const altered = structuredClone(row.claim);
    altered.evidence.context += '另一版';
    assert.equal(compilePtolemyBookOne(altered).reason, 'source_review_required', id);
    for (const input of row.inputs) {
      const { witness } = input.required.find(fact => fact.kind === 'western_ptolemy_book_one_selector');
      const native = natives.find(({ sample }) => sample.witnesses.includes(witness));
      assert.ok(native, witness);
      witnesses.add(witness);
      assert.equal(evaluateRule(input, 'natal', native.chart).matched, true, witness);
      assert.equal(explainClaim(id, 'western', native.rawContext, 'Tetrabiblos', catalog).reason, 'historical_aphorism_requires_opt_in');
      const explained = explainClaim(id, 'western', native.rawContext, 'Tetrabiblos', catalog, { historicalAphorism: true });
      assert.equal(explained.matched, true, witness);
      assert.ok(proof(explained).some(fact => fact.witness === witness));
      assert.match(explained.calculationNote, /卷一/);
      for (const fact of proof(explained)) assert.doesNotMatch(factText(fact), /undefined/u);
    }
  }
  assert.equal(witnesses.size, 27);
  for (const { query, chart } of natives) {
    assert.ok(catalog.candidates('western', chart.presentKeys, query.tradition).every(entry => !ids.has(entry.claim.id)));
  }
  const report = createReportLookup(directory)([natives[0].query]);
  assert.ok(report.flatMap(({ personality, events }) => [...personality, ...events]).every(hit => !ids.has(hit.id)));
});

test('whole-sign comparison agrees with both primary-source pair tables across the entire zodiac', () => {
  const officialPairs = pairs => new Set(pairs.map(pair => pair.slice().sort((a, b) => a - b).join(':')));
  const equinox = officialPairs([[1, 11], [2, 10], [3, 9], [4, 8], [5, 7]]);
  const solstice = officialPairs([[2, 4], [1, 5], [0, 6], [11, 7], [10, 8]]);
  const aspects = { 2: 'sextile', 3: 'square', 4: 'trine', 6: 'opposition' };
  const pairWitnesses = new Set(['equinox', 'commanding', 'obeying', 'solstice', 'disjunct_one', 'disjunct_five', ...Object.values(aspects)]);
  for (let first = 0; first < 12; first++) for (let second = first; second < 12; second++) {
    const key = [first, second].join(':'), step = Math.min(second - first, 12 - second + first);
    const expected = new Set();
    if (equinox.has(key)) ['equinox', 'commanding', 'obeying'].forEach(witness => expected.add(witness));
    if (solstice.has(key)) expected.add('solstice');
    if (aspects[step]) expected.add(aspects[step]);
    if (step === 1 || step === 5) expected.add(step === 1 ? 'disjunct_one' : 'disjunct_five');
    const actual = ptolemyBookOneFacts([tropical, sign('Sun', first), sign('Moon', second)])
      .map(fact => fact.witness).filter(witness => pairWitnesses.has(witness));
    assert.deepEqual(new Set(actual), expected, key);
  }
  const pair = [tropical, sign('Sun', 1), sign('Moon', 11)];
  for (const [passage, subject] of [[2, 'Sun'], [3, 'Moon']]) {
    const explained = explain(14, passage, pair);
    const witness = proof(explained).find(fact => fact.kind === 'western_ptolemy_book_one_pair');
    assert.equal(witness.first, subject);
    const detail = proof(explained).find(fact => fact.kind === 'western_ptolemy_book_one_reflection');
    assert.equal(detail.first, subject);
    assert.equal(detail.anchorSign, '白羊座');
    assert.equal(detail.steps, 1);
  }
  assert.equal(explain(14, 1, pair.slice(1)).matched, false);
  assert.equal(explain(14, 1, [...pair, degree('Sun', 5)]).matched, false);
});

test('phase and quadrant evidence respect exact boundaries, distinct chart sects and confirmed birth time', () => {
  for (const boundary of [0, 90, 180, 270]) {
    const facts = [tropical, degree('Sun', 0), degree('Moon', boundary)];
    assert.ok(ptolemyBookOneFacts(facts).every(fact => !/^(?:waxing|waning)_/.test(fact.witness)));
  }
  const night = [tropical, degree('Sun', 1), degree('Mercury', 359), sign('Saturn', 2), sign('Mars', 5), sect('night')];
  assert.equal(explain(7, 3, night).matched, true);
  assert.equal(explain(7, 4, night).matched, false);
  assert.equal(explain(7, 5, night).matched, false);
  assert.equal(explain(7, 6, night).matched, true);
  assert.equal(explain(7, 6, [...night, sect('day')]).matched, false);
  const raw = rawOf(samples[0]);
  const quadrants = [6, 7];
  for (const passage of quadrants) {
    assert.equal(explain(6, passage, raw).matched, true);
    assert.equal(explain(6, passage, raw, false).matched, false);
  }
  const confirmed = explain(8, 3, raw);
  const withoutMoon = raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Moon');
  const forged = proof(confirmed).filter(fact => fact.kind.startsWith('western_ptolemy_book_one_'));
  assert.equal(explain(8, 3, [...withoutMoon, ...forged]).matched, false);
  assert.ok(parse([...withoutMoon, ...forged]).confirmedFacts.every(fact => !fact.kind.startsWith('western_ptolemy_book_one_')));
});
