import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { calculateWestern, chartFacts, chartVersions, trueLunarNodeProfile } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyDignityCells } from './lilly-dignities.mjs';
import { compileLillyPrintedDignities, lillyPrintedDignityProfile, lillyPrintedDignityReferences } from './lilly-dignity-references.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const prefix = 'astro-lilly-v1-dignity-table-p';
const ids = Array.from({ length: 21 }, (_, index) => prefix + (145 + index) + '-001');
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)));
const cells = compileLillyDignityCells(sources);
const rows = [...compileLillyPrintedDignities(sources, cells)].map(([sourceId, row]) => ({ sourceId, ...row }));
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-printed-dignity-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-printed-dignity-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const position = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const sign = (planet, name) => ({ kind: 'planet_sign', planet, sign: name });
const node = longitude => ({ kind: 'western_true_node_longitude', profile: trueLunarNodeProfile, longitude });
const references = facts => lillyPrintedDignityReferences([tropical, ...facts], rows);
const exaltation = (facts, body) => references(facts).find(reference => reference.body === body);
const reportRefs = results => results.flatMap(topic => topic.calculationReferences ?? [])
  .filter(reference => reference.profile === lillyPrintedDignityProfile);
const request = (confirmedFacts, { tradition, timeKnown = true } = {}) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts, tradition,
}], { timeKnown });

test('all printed 1647 labels and exaltation degrees match the transcribed table and retain their SQLite identities', () => {
  const expectedLabels = [
    ['aries', 'diurnal', 'mars'], ['taurus', 'nocturnal', 'venus'], ['gemini', 'diurnal', 'mercury'],
    ['cancer', 'both', 'moon'], ['leo', 'both', 'sun'], ['virgo', 'nocturnal', 'mercury'],
    ['libra', 'diurnal', 'venus'], ['scorpio', 'nocturnal', 'mars'], ['sagittarius', 'diurnal', 'jupiter'],
    ['capricorn', 'nocturnal', 'saturn'], ['aquarius', 'diurnal', 'saturn'], ['pisces', 'nocturnal', 'jupiter'],
  ];
  const expectedDegrees = [
    ['sun', 'aries', 19], ['moon', 'taurus', 3], ['north_node', 'gemini', 3], ['jupiter', 'cancer', 15],
    ['mercury', 'virgo', 15], ['saturn', 'libra', 21], ['south_node', 'sagittarius', 3], ['mars', 'capricorn', 28],
    ['venus', 'pisces', 27],
  ];
  assert.deepEqual(rows.filter(row => row.ruler).map(({ sign, label, ruler }) => [sign, label, ruler]), expectedLabels);
  assert.deepEqual(rows.filter(row => row.body).map(({ body, sign, degree }) => [body, sign, degree]), expectedDegrees);
  for (const row of rows) {
    const compiled = catalog.get(row.sourceId);
    assert.equal(compiled.calculationReference.profile, lillyPrintedDignityProfile);
    assert.equal(compiled.calculationReference.role, row.role);
    assert.equal(compiled.inputs, undefined);
    assert.deepEqual(compiled.branches, []);
  }
});

test('the printed column labels ignore natal sect, and exact comparison requires non-conflicting longitude', () => {
  const label = sect => references([sign('Sun', '狮子座'), { kind: 'western_sect', sect }]).find(row => row.sign === 'leo' && row.label);
  assert.deepEqual(label('day'), label('night'));
  assert.equal(label('day').label, 'both');
  const signOnly = exaltation([sign('Sun', '白羊座')], 'sun');
  assert.equal(signOnly.matchesSign, true);
  assert.equal(signOnly.matchesDegree, undefined);
  assert.equal(exaltation([position('Sun', 19)], 'sun').matchesDegree, true);
  assert.equal(exaltation([position('Sun', 19.9999)], 'sun').matchesDegree, true);
  assert.equal(exaltation([position('Sun', 20)], 'sun').matchesDegree, false);
  assert.equal(exaltation([position('Sun', 48)], 'sun').matchesSign, false);
  assert.equal(exaltation([position('Sun', 19), sign('Sun', '金牛座')], 'sun'), undefined);
  assert.equal(exaltation([position('Sun', 19), position('Sun', 19.1)], 'sun'), undefined);
  assert.deepEqual(references([position('Sun', 19), { kind: 'western_zodiac', zodiac: 'sidereal' }]), []);
});

test('the north and south node use one verified north position and the actual opposite', () => {
  const verified = references([node(63.75)]).filter(row => row.body);
  assert.deepEqual(verified.map(({ body, observed, matchesDegree }) => [body, observed.sign, observed.degreeInSign, matchesDegree]),
    [['north_node', 'gemini', 3.75, true], ['south_node', 'sagittarius', 3.75, true]]);
  assert.equal(exaltation([node(63.75), node(64.75)], 'north_node'), undefined);
  assert.equal(exaltation([node(63.75), node(64.75)], 'south_node'), undefined);
  assert.equal(exaltation([{ kind: 'western_lilly_node_sign', node: 'south_node', sign: '射手座' }], 'south_node'), undefined);
});

test('source edits, incomplete printed rows and an inconsistent underlying dignity table fail closed', () => {
  const selected = sources.filter(claim => ids.includes(claim.id));
  for (const field of ['source', 'conditions', 'evidence']) {
    const changed = structuredClone(selected);
    changed[0][field].review = 'revised';
    assert.throws(() => compileLillyPrintedDignities(changed, cells), /Review Lilly printed dignity source/u);
  }
  assert.throws(() => compileLillyPrintedDignities(selected.slice(1), cells), /Incomplete Lilly printed dignity sources/u);
  const withoutAriesExaltation = cells.filter(cell => !(cell.sign === 'aries' && cell.dimension === 'exaltation'));
  assert.throws(() => compileLillyPrintedDignities(selected, withoutAriesExaltation), /Invalid Lilly printed exaltation/u);
});

test('native charts for each exact printed degree and every domicile label reach the actual SQLite report lookup', () => {
  const cases = [
    ['1975-02-21', ['venus']], ['1975-03-01', ['mars']], ['1975-04-09', ['sun']], ['1975-09-23', ['moon']],
    ['1976-08-13', ['mercury']], ['1978-06-28', ['jupiter']], ['1981-12-24', ['saturn']],
    ['1984-08-09', ['north_node', 'south_node']],
  ];
  const seen = new Set(), observedLabels = new Set();
  const planetNames = { venus: '金星', mars: '火星', sun: '太阳', moon: '月亮', mercury: '水星', jupiter: '木星',
    saturn: '土星', north_node: '北交点', south_node: '南交点' };
  let lastFacts;
  for (const [date, bodies] of cases) {
    const utc = Date.parse(date + 'T13:30:00Z');
    const facts = chartFacts.western(calculateWestern(utc, { latitude: 39.9042, longitude: 116.4074 }));
    lastFacts = facts;
    const parsed = request(facts);
    assert.ok(parsed);
    const topics = lookup(parsed), result = reportRefs(topics), materials = buildReportMaterials(topics);
    for (const body of bodies) {
      const match = result.find(item => item.body === body);
      assert.equal(match.matchesDegree, true, date + ' ' + body);
      assert.ok(materials.includes(planetNames[body] + '在' + match.signName + '，原表擢升点 ' + match.degree + '°，盘面同整度'));
      seen.add(match.source.id);
    }
    for (const row of result.filter(item => item.label)) {
      observedLabels.add(row.label);
      assert.ok(materials.includes(row.signName));
      seen.add(row.source.id);
    }
  }
  assert.deepEqual(seen, new Set(ids));
  assert.deepEqual(observedLabels, new Set(['diurnal', 'nocturnal', 'both']));
  assert.deepEqual(reportRefs(lookup(request(lastFacts, { tradition: 'Tetrabiblos' }))), []);
  const signOnly = reportRefs(lookup(request(lastFacts, { timeKnown: false })));
  assert.ok(signOnly.some(row => row.role === 'domicile_label_lookup'));
  assert.ok(signOnly.every(row => row.matchesDegree === undefined && !row.body?.endsWith('_node')));
});
