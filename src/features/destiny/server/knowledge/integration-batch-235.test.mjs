import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, zodiacNames } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext } from './matching.mjs';
import { compilePtolemySiblings, ptolemySiblingsProfile } from './ptolemy-siblings.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-ptolemy-siblings-'));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const tradition = 'Tetrabiblos';
const location = { latitude: 31.23, longitude: 121.47 };
const idOf = number => 'astro-ptolemy-v3-siblings-p' + String(number).padStart(3, '0') + '-001';
const native = date => chartFacts.western(calculateWestern(Date.parse(date), location));

after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});

const witnesses = [
  ['1980-01-01T00:00Z', [17, 18, 20, 36]],
  ['1980-01-11T05:00Z', [1, 2, 3, 14, 15]],
  ['1980-01-17T08:00Z', [16]],
  ['1980-01-21T10:00Z', [19]],
  ['1980-01-27T13:00Z', [5]],
  ['1980-01-29T14:00Z', [4]],
  ['1980-04-20T07:00Z', [13]],
  ['1980-07-13T01:00Z', [24]],
  ['1980-09-17T10:00Z', [7]],
  ['1981-07-18T18:00Z', [23]],
  ['2006-10-07T16:00Z', [22]],
];

function request(confirmedFacts, timeKnown = true) {
  const queries = parseChartQueries([{
    method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, confirmedFacts, tradition,
  }], { timeKnown });
  assert.ok(queries);
  const [query] = queries;
  return { queries, chart: chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}

const explain = (number, raw, timeKnown = true) =>
  explainClaim(idOf(number), 'western', request(raw, timeKnown).chart, tradition, catalog, { historicalAphorism: true });
const groups = result => result.matchedConditions.alternatives;

test('all 18 source records match native charts through SQLite and are confined to opt-in historical lookup', () => {
  const ids = new Set(witnesses.flatMap(([, numbers]) => numbers.map(idOf)));
  assert.equal(ids.size, 18);
  for (const [date, numbers] of witnesses) {
    const raw = native(date);
    const { queries, chart } = request(raw);
    const sources = numbers.map(number => catalog.get(idOf(number)));
    const derived = claimChartContext('western', chart, sources.flatMap(({ inputs }) => inputs[0].required));
    assert.ok(catalog.candidates('western', derived.presentKeys, tradition).every(row => !ids.has(row.claim.id)));
    const report = lookup(queries);
    assert.ok(report.flatMap(({ events, personality }) => [...events, ...personality]).every(hit => !ids.has(hit.id)));
    for (const [index, number] of numbers.entries()) {
      const { claim, compiler, matchScope } = sources[index];
      assert.equal(compiler, ptolemySiblingsProfile, claim.id);
      assert.equal(matchScope, 'historical_aphorism', claim.id);
      const changed = structuredClone(claim);
      changed.evidence.context += '异本文字';
      assert.equal(compilePtolemySiblings(changed).reason, 'source_review_required');
      assert.equal(explainClaim(claim.id, 'western', chart, tradition, catalog).reason, 'historical_aphorism_requires_opt_in');
      const result = explain(number, raw);
      assert.ok(result.matched && groups(result).length, claim.id);
      assert.match(result.calculationNote, /兄弟姐妹篇/u);
      for (const fact of [...result.matchedConditions.required, ...groups(result).flat()]) {
        assert.doesNotMatch(factText(fact), /undefined|NaN/u, claim.id);
      }
    }
  }
});

test('editions maintain distinct maternal positions and the successive sign is kept with its own base', () => {
  const raw = native('1980-01-01T00:00Z');
  assert.equal(explain(1, raw).matched, false);
  for (const [number, basis] of [[17, 'mc'], [18, 'venus']]) {
    const places = groups(explain(number, raw)).flat().filter(f => f.kind === 'western_ptolemy_siblings_place');
    assert.deepEqual(places.map(p => [p.basis, p.following]), [[basis, false], [basis, true]]);
    assert.equal((zodiacNames.indexOf(places[0].sign) + 1) % 12, zodiacNames.indexOf(places[1].sign));
  }
  assert.equal(explain(19, raw).matched, false);
  const night = native('1980-01-21T10:00Z');
  assert.ok(groups(explain(19, night)).flat().some(f => f.basis === 'moon'));
  assert.equal(explain(19, night, false).matched, false);

  const pair = groups(explain(20, raw));
  assert.ok(pair.every(group => group.filter(f => f.target === 'place').length === 2));
  assert.ok(pair.every(group => group.some(f => f.planet === 'Jupiter' && f.target === 'Venus'
    && ['opposition', 'disjunct'].includes(f.relation))));
  assert.equal(explain(20, raw.filter(f => f.planet !== 'Venus')).matched, false);
});

test('the Fortune condition binds both aspects to one giver and an actual longitude', () => {
  const raw = native('1980-04-20T07:00Z');
  const evidence = groups(explain(13, raw));
  for (const group of evidence) {
    const contacts = group.filter(f => f.kind === 'western_ptolemy_siblings_contact');
    assert.equal(new Set(contacts.map(f => f.planet)).size, 1);
    assert.ok(contacts.some(f => f.target === 'fortune'));
    assert.ok(contacts.some(f => f.target !== 'fortune' && f.target !== 'place'));
    assert.ok(group.some(f => f.kind === 'western_ptolemy_fortune_point'));
  }
  assert.equal(explain(13, raw.filter(f => f.kind !== 'planet_longitude' || f.planet !== 'Sun')).matched, false);
});

test('the historical Mars opposition uses the planet on the actual angle and ignores client-supplied conclusions', () => {
  const raw = native('2006-10-07T16:00Z');
  const mars = groups(explain(22, raw)).flat().find(f => f.kind === 'western_ptolemy_book_one_region');
  assert.equal(mars.planet, 'Mars');
  assert.ok(mars.distance <= 1);
  const missing = raw.filter(f => f.kind !== 'planet_longitude' || f.planet !== 'Mars');
  const forged = { kind: 'western_ptolemy_siblings_source', number: 22 };
  assert.equal(explain(22, [...missing, forged]).matched, false);
  assert.ok(request([...missing, forged]).queries[0].confirmedFacts.every(f => f.kind !== forged.kind));
  assert.equal(explain(22, raw, false).matched, false);
});
