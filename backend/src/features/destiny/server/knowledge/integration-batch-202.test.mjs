import assert from 'node:assert/strict';
import { mkdtempSync, rmdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { lillyTravelProfile } from './lilly-travel.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-travel-obstruction-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => {
  rmSync(catalog.file, { force: true });
  rmdirSync(directory);
});
const idFor = number => `astro-lilly-v3-travel-followup-p${number}-001`;
const place = { latitude: 31.23, longitude: 121.47 };
const rawAt = instant => chartFacts.western(calculateWestern(Date.parse(instant), place));
const referencesFor = [
  ['1924-01-01T00:15:00Z', ['003', '029', '030', '031', '032', '033', '038', '039', '050', '052']],
  ['1924-01-01T12:15:00Z', ['037']],
  ['1924-01-01T18:15:00Z', ['036']],
];
const selectorsFrom = conditions => [...conditions.required, ...conditions.alternatives.flat()]
  .filter(fact => fact.kind === 'western_lilly_travel');

function request(raw, timeKnown = true) {
  const queries = parseChartQueries([{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts: raw }], { timeKnown });
  assert.ok(queries);
  const [query] = queries;
  return { queries, plain: chartContext('western', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope) };
}

const detail = (number, plain) => explainClaim(idFor(number), 'western', plain, undefined, catalog);
const hits = queries => lookup(queries).flatMap(({ personality, events }) => [...personality, ...events]);

test('twelve sources and all twenty-six verified alternatives reach SQLite, explanation and report text', () => {
  let sources = 0, alternatives = 0;
  for (const [instant, numbers] of referencesFor) {
    const { queries, plain } = request(rawAt(instant));
    const reportHits = hits(queries);
    for (const number of numbers) {
      const id = idFor(number), row = catalog.get(id);
      const result = detail(number, plain), match = reportHits.find(rule => rule.id === id);
      assert.ok(result.matched && match, number);
      assert.equal(row.compiler, lillyTravelProfile);
      assert.equal(row.remainingAlternatives, number === '003' ? 1 : 0, number);
      const changed = structuredClone(row.claim);
      changed.evidence.context += ' alternate evidence';
      assert.equal(compileWesternClaim(changed).reason, 'source_review_required', number);
      const groups = result.matchedConditions.alternatives.length
        ? result.matchedConditions.alternatives : [result.matchedConditions.required];
      assert.deepEqual(new Set(groups.map(group => JSON.stringify(group))), new Set(row.inputs.map(input => JSON.stringify(input.required))), number);
      const text = buildReportMaterials([{ topic: match.topic, personality: [], events: [match] }]);
      assert.ok(text.includes(row.claim.evidence.original_text), number);
      assert.doesNotMatch(text, /western_lilly_travel|落undefined/u);
      assert.match(text, /按莉莉首列容许度，/u);
      assert.match(text, /按莉莉另一说容许度，/u);
      sources++;
      alternatives += row.inputs.length;
    }
  }
  assert.deepEqual([sources, alternatives], [12, 26]);
});

test('only the malefic that actually obstructs can supply the selected house', () => {
  const raw = rawAt('1924-01-03T14:15:00Z');
  assert.ok(lillyHouseFacts(raw).some(fact => fact.kind === 'western_lilly_planet_house'
    && fact.planet === 'Mars' && fact.house === 3));
  const { plain, queries } = request(raw);
  assert.ok(detail('038', plain).matched, 'Saturn supplies the obstruction witness');
  assert.equal(detail('039', plain).matched, false, 'Mars is present but does not obstruct');
  assert.equal(detail('037', plain).matched, false);
  assert.ok(!hits(queries).some(rule => rule.id === idFor('037')));
});

test('domicile and hard contact are separate and each orb column is evaluated independently', () => {
  const domicileOnly = request(rawAt('1924-01-19T00:15:00Z')).plain;
  assert.equal(detail('052', domicileOnly).matched, true);
  assert.equal(detail('050', domicileOnly).matched, false);

  const mainOnly = request(rawAt('1924-01-18T06:15:00Z')).plain;
  const contact = detail('050', mainOnly);
  assert.ok(contact.matched);
  assert.deepEqual(new Set(selectorsFrom(contact.matchedConditions).map(fact => fact.table)), new Set(['main']));
});

test('unknown time, a missing planet, and supplied selectors cannot create an obstruction', () => {
  const raw = rawAt(referencesFor[0][0]);
  const supplied = catalog.get(idFor('050')).inputs[0].required.filter(fact => fact.kind === 'western_lilly_travel');
  const missingMoon = raw.filter(fact => fact.kind !== 'planet_longitude' || fact.planet !== 'Moon');
  for (const { queries, plain } of [request(raw, false), request([...missingMoon, ...supplied])]) {
    assert.equal(detail('050', plain).matched, false);
    assert.ok(!hits(queries).some(rule => rule.id === idFor('050')));
  }
  const noJourney = request(rawAt('1959-12-26T00:15:00Z'));
  assert.ok(!hits(noJourney.queries).some(rule => referencesFor.some(([, numbers]) => numbers.some(n => rule.id === idFor(n)))));
});
