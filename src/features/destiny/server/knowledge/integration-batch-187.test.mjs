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

const directory = mkdtempSync(join(tmpdir(), 'destiny-ptolemy-context-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-ptolemy-context-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const samples = JSON.parse(readFileSync(new URL('./claims/integration-batch-187-witnesses.json', import.meta.url)));
const idOf = (chapter, passage) => `astro-ptolemy-v1-chapter-${chapter}-p${String(passage).padStart(3, '0')}-001`;
const chapters = [[4, 1, 8], [10, 1, 10], [12, 3, 6], [17, 9, 10], [18, 9, 13]];
const ids = new Set(chapters.flatMap(([chapter, lo, hi]) => Array.from({ length: hi - lo + 1 }, (_, i) => idOf(chapter, i + lo))));
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
const asc = longitude => ({ kind: 'western_geometry_ascendant', longitude });
const mc = longitude => ({ kind: 'western_geometry_midheaven', longitude });
const witnesses = raw => new Set(ptolemyBookOneFacts(raw).map(fact => fact.witness));

test('29 historical IDs and 31 groups reach SQLite explanations from eight native charts', () => {
  const fixtures = samples.map(sample => {
    const query = parse(rawOf(sample)), raw = context(query);
    return { sample, query, raw, derived: claimChartContext('western', raw, [], undefined, undefined, { ptolemyBookOne: true }) };
  });
  assert.equal(ids.size, 29);
  let groups = 0;
  const selectors = new Set();
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, ptolemyBookOneProfile, id);
    assert.equal(row.matchScope, 'historical_aphorism', id);
    const changed = structuredClone(row.claim);
    changed.evidence.context += '另一个版本';
    assert.equal(compilePtolemyBookOne(changed).reason, 'source_review_required', id);
    for (const input of row.inputs) {
      groups++;
      const { witness } = input.required.find(fact => fact.kind === 'western_ptolemy_book_one_selector');
      selectors.add(witness);
      const { raw, derived } = fixtures.find(({ sample }) => sample.witnesses.includes(witness));
      assert.equal(evaluateRule(input, 'natal', derived).matched, true, witness);
      assert.equal(explainClaim(id, 'western', raw, 'Tetrabiblos', catalog).reason, 'historical_aphorism_requires_opt_in');
      const detail = explainClaim(id, 'western', raw, 'Tetrabiblos', catalog, { historicalAphorism: true });
      assert.equal(detail.matched, true, witness);
      assert.match(detail.calculationNote, /卷一|Hübner/u);
      for (const fact of proof(detail)) assert.doesNotMatch(factText(fact), /undefined/u);
    }
  }
  assert.equal(groups, 31);
  assert.equal(selectors.size, 30);
  assert.deepEqual(catalog.get(idOf(18, 11)).inputs, catalog.get(idOf(18, 13)).inputs);
  assert.ok(catalog.candidates('western', fixtures[0].derived.presentKeys, 'Tetrabiblos').every(row => !ids.has(row.claim.id)));
  const normal = createReportLookup(directory)([fixtures[0].query]);
  assert.ok(normal.flatMap(({ personality, events }) => [...personality, ...events]).every(hit => !ids.has(hit.id)));
});

test('the twelve signs have the documented season, solar/lunar half and triplicity, with both wind editions retained', () => {
  const seasons = ['spring', 'summer', 'autumn', 'winter'];
  const winds = ['winds_north', 'winds_south', 'winds_east', 'winds_west'];
  const solar = new Set(['狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座']);
  for (const [index, name] of zodiacNames.entries()) {
    const result = witnesses([tropical, sign('Sun', index)]);
    assert.deepEqual(seasons.filter(season => result.has(season)), [seasons[Math.floor(index / 3)]]);
    assert.deepEqual(winds.filter(wind => result.has(wind)), [winds[index % 4]]);
    assert.equal(result.has('solar_half'), solar.has(name));
    assert.equal(result.has('lunar_half'), !solar.has(name));
  }
  const air = [tropical, sign('Mercury', 2)];
  assert.equal(explain(18, 11, air).matched, true);
  const greek = explain(18, 13, air);
  assert.equal(greek.matched, true);
  assert.match(greek.calculationNote, /Hübner.*东北/u);
  assert.equal(explain(18, 13, [tropical, sign('Mercury', 3)]).matched, false);
  assert.equal(explain(18, 11, air.slice(1)).matched, false);
  const luminaries = [tropical, sign('Sun', 0), sign('Moon', 2)];
  assert.equal(explain(4, 8, luminaries).matched, false);
  assert.equal(explain(4, 8, [...luminaries, sign('Saturn', 6)]).matched, true);
});

test('whole signs use confirmed axes, and alternate sign order starts at the actual rising sign', () => {
  const angles = [tropical, asc(10), mc(280)];
  const cases = [[1, 'sign_ic_asc'], [4, 'sign_west_ic'], [7, 'sign_mc_west'], [10, 'sign_asc_mc']];
  for (const [signIndex, quadrant] of cases) {
    const observed = [...witnesses([...angles, sign('Mercury', signIndex)])].filter(value => value.startsWith('sign_'));
    assert.deepEqual(observed, [quadrant]);
  }
  assert.ok([...witnesses([...angles, sign('Mercury', 0)])].every(value => !value.startsWith('sign_')));
  assert.ok([...witnesses([tropical, asc(10), mc(40), sign('Mercury', 4)])].every(value => !value.startsWith('sign_')));
  assert.equal(explain(12, 4, [tropical, asc(100), sign('Sun', 2)]).matched, true);
  assert.equal(explain(12, 3, [tropical, asc(100), sign('Sun', 2)]).matched, false);
  assert.equal(explain(12, 4, [tropical, asc(100), sign('Sun', 2)], false).matched, false);
  const raw = rawOf(samples[0]), actual = proof(explain(12, 5, raw));
  const withoutAngles = raw.filter(fact => !['western_geometry_ascendant', 'western_geometry_midheaven',
    'western_profile_cusp_longitude'].includes(fact.kind));
  assert.equal(explain(12, 5, [...withoutAngles, ...actual.filter(fact => fact.kind.startsWith('western_ptolemy_book_one_'))]).matched, false);
});

test('current season and verified angular evidence support both quality comparisons with explicit scope', () => {
  const branches = new Set();
  for (const sample of samples) for (const branch of sample.qualityBranches) {
    const [type, origin] = branch.split(':');
    const result = explain(10, type === 'akin_quality' ? 9 : 10, rawOf(sample));
    const evidence = proof(result).filter(fact => fact.kind === 'western_ptolemy_book_one_quality');
    assert.ok(evidence.some(fact => (['spring', 'summer', 'autumn', 'winter'].includes(fact.context) ? 'season' : 'angle') === origin));
    for (const fact of evidence) {
      assert.equal(fact.contextQuality, type === 'akin_quality' ? fact.quality
        : { heat: 'cold', cold: 'heat', moisture: 'dryness', dryness: 'moisture' }[fact.quality]);
    }
    branches.add(branch);
  }
  assert.equal(branches.size, 4);
  assert.equal(explain(10, 5, [tropical, asc(359.5), degree('Mars', 0.5)]).matched, true);
  assert.equal(explain(10, 5, [tropical, asc(359.5), degree('Mars', 0.5001)]).matched, false);
  assert.ok(![...witnesses([tropical, asc(100), degree('Mercury', 99.8)])].some(value => value.endsWith('_quality')));
});
