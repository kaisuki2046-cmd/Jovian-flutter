import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyAspectReferences, lillyAspectReferenceProfile, lillyAspectReferences } from './lilly-aspect-references.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const prefix = 'astro-lilly-v1-aspects-p';
const ids = [...Array.from({ length: 15 }, (_, index) => index + 3), 19, 21]
  .map(id => prefix + String(id).padStart(3, '0') + '-001');
const sources = JSON.parse(readFileSync(new URL('./claims/western.json', import.meta.url)))
  .filter(claim => ids.includes(claim.id));
const rows = [...compileLillyAspectReferences(sources)].map(([sourceId, row]) => ({ sourceId, ...row }));
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-aspect-reference-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-aspect-reference-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const factsFor = positions => [{ kind: 'western_zodiac', zodiac: 'tropical' },
  ...positions.map(([planet, longitude]) => ({ kind: 'planet_longitude', planet, longitude }))];
const motion = (planet, signedDegrees) => ({ kind: 'planet_hourly_motion', planet, signedDegrees });
const refsOf = results => results.flatMap(topic => topic.calculationReferences ?? [])
  .filter(reference => reference.profile === lillyAspectReferenceProfile);
const request = (confirmedFacts, { timeKnown = true, tradition, chartScope } = {}) => parseChartQueries([{
  method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts, tradition, chartScope,
}], { timeKnown });

test('the fourteen printed orb values are distinct SQLite source cells and the three method records retain their identities', () => {
  const expected = [
    ['saturn', 600, 540], ['jupiter', 720, 540], ['mars', 450, 420], ['sun', 1020, 900],
    ['venus', 480, 420], ['mercury', 420, 420], ['moon', 750, 720],
  ];
  for (const [planet, first, alternate] of expected) {
    assert.deepEqual(rows.filter(row => row.planet === planet).map(({ table, arcminutes }) => [table, arcminutes]),
      [['main', first], ['other', alternate]]);
  }
  assert.deepEqual(rows.filter(row => row.method).map(row => row.method), ['platic', 'both_direct', 'opposite_motion']);
  for (const row of rows) {
    const result = catalog.get(row.sourceId);
    assert.equal(result.calculationReference.profile, lillyAspectReferenceProfile);
    assert.equal(result.calculationReference.role, row.role);
    assert.equal(result.inputs, undefined);
    assert.deepEqual(result.branches, []);
  }
  for (const field of ['source', 'conditions', 'evidence']) {
    const changed = structuredClone(sources);
    changed[0][field].revised = true;
    assert.throws(() => compileLillyAspectReferences(changed), /Review Lilly/u);
  }
  assert.throws(() => compileLillyAspectReferences(sources.slice(1)), /Incomplete Lilly/u);
});

test('both columns use their own moieties, and exact degree, off-sign and conflicting evidence do not borrow results', () => {
  const evaluate = (venus, saturn) => lillyAspectReferences(factsFor([['Venus', venus], ['Saturn', saturn]]), rows);
  const [example] = evaluate(40, 168);
  assert.equal(example.aspect, 'trine');
  assert.equal(example.deviation, 8);
  assert.deepEqual(example.columns.map(({ limit, matched }) => [limit, matched]), [[9, true], [8, true]]);
  assert.equal(example.method.id, prefix + '017-001');
  assert.deepEqual(evaluate(40, 169)[0].columns.map(column => column.matched), [true, false]);
  assert.deepEqual(evaluate(40, 169.000001), []);
  assert.equal(evaluate(40, 160.5)[0].method, undefined);
  assert.deepEqual(evaluate(58, 181), [], 'wrong sign geometry');
  assert.deepEqual(lillyAspectReferences(factsFor([['Venus', 40], ['Saturn', 168], ['Saturn', 160]]), rows), []);
  const wrap = factsFor([['Venus', 358], ['Saturn', 117]]);
  assert.equal(lillyAspectReferences(wrap, rows)[0].aspect, 'trine');
  assert.deepEqual(lillyAspectReferences([...wrap, { kind: 'western_zodiac', zodiac: 'sidereal' }], rows), []);
});

test('application sources require actual verified motion in their own direction and geometry', () => {
  const evaluate = (first, second, firstSpeed, secondSpeed, extra = []) => lillyAspectReferences([
    ...factsFor([['Mercury', first], ['Mars', second]]),
    motion('Mercury', firstSpeed), motion('Mars', secondSpeed), ...extra,
  ], rows)[0]?.columns[0];
  assert.equal(evaluate(5, 10, 0.06, 0.025).phase, 'both_direct');
  assert.equal(evaluate(17, 15, -0.05, 0.025).phase, 'opposite_motion');
  assert.equal(evaluate(15, 17, -0.05, 0.025).phase, null, 'moving apart');
  assert.equal(evaluate(10, 9, -0.05, -0.02).phase, null, 'retrograde perfection is still pending');
  assert.equal(evaluate(17, 15, -0.05, 0.025, [{ kind: 'planet_motion', planet: 'Mercury', motion: 'direct' }]).phase, null);
  assert.equal(evaluate(17, 15, -0.05, 0.025, [motion('Mercury', 0.045)]).phase, null);
});

test('all seventeen source records are materialized by the native chart, and only within eligible report requests', () => {
  const time = Date.parse('1977-01-03T13:30:00.000Z');
  const facts = chartFacts.western(calculateWestern(time, { latitude: 39.9042, longitude: 116.4074 }));
  const parsed = request(facts);
  assert.ok(parsed);
  const topics = lookup(parsed);
  const references = refsOf(topics);
  assert.ok(references.length);
  const matchedIds = references.flatMap(reference =>
    [reference.method?.id, ...reference.columns.flatMap(column => column.sources.map(source => source.id))]).filter(Boolean);
  assert.deepEqual(new Set(matchedIds), new Set(ids));
  const materialsById = new Map(references.flatMap(reference => reference.reportEvidence).map(material => [material.id, material]));
  assert.deepEqual(new Set(materialsById.keys()), new Set(ids));
  assert.equal(new Set(references.map(({ first, second }) => first + ':' + second)).size, references.length);
  const text = buildReportMaterials(topics);
  assert.doesNotMatch(text, /^出处：|依据：《Christian Astrology》/mu);
  for (const { originalText, modernInterpretation } of materialsById.values()) {
    assert.ok(text.includes(`原文/依据：${originalText}\n现代解读：${modernInterpretation}`));
  }
  assert.match(text, /莉莉相位计算依据.*首栏/su);
  assert.match(text, /另列.*范围(?:内|外)/u);
  assert.match(text, /顺逆相向渐入/u);
  assert.match(text, /双顺行渐入/u);
  assert.doesNotMatch(text, /astro-lilly-v1-aspects/u);
  assert.deepEqual(refsOf(lookup(request(facts, { tradition: 'Tetrabiblos' }))), []);
  assert.deepEqual(refsOf(lookup(request(facts, { timeKnown: false }))), []);
});
