import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, trueLunarNodeProfile } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim, pendingClaimConditions } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyTemperamentSource, lillyTemperamentProfile } from './lilly-temperament.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-160-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-temperament-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-temperament-'));
  rmSync(directory, { recursive: true, force: true });
});
const prefix = 'astro-lilly-v3-manners-p';
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const idOf = number => prefix + number + '-001';

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{
    method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, tradition: 'Christian Astrology', confirmedFacts,
  }], { timeKnown });
  assert.equal(parsed.length, 1);
  return parsed;
}
const context = ([q]) => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const hits = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (number, facts, timeKnown = true) =>
  explainClaim(idOf(number), 'western', context(queries(facts, timeKnown)), undefined, catalog);
const position = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const north = longitude => ({ kind: 'western_true_node_longitude', profile: trueLunarNodeProfile, longitude });
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const cusps = (offset = 0) => [
  tropical, { kind: 'western_profile_system', profile: 'regiomontanus' },
  ...Array.from({ length: 12 }, (_, i) => ({
    kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: i + 1, longitude: (offset + i * 30) % 360,
  })),
];

test('all reviewed CVI witness groups reach SQLite, single-record explanation and report materials from native charts', () => {
  const ids = new Set(fixture.witnesses.flatMap(({ proofs }) => proofs.map(({ id }) => id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let partial = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    assert.equal(row.compiler, lillyTemperamentProfile, id);
    if (row.remainingAlternatives) partial++;
    for (const input of row.inputs) expected.set(id + ':' + digest(input), input);
    const revised = structuredClone(row.claim);
    revised.evidence.context += ' 异本';
    assert.equal(compileLillyTemperamentSource(revised).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.alternatives);
  assert.equal(partial, fixture.partialRecords);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const native = chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
    const parsed = queries(native), chart = context(parsed), derived = claimChartContext('western', chart);
    const references = lookup(parsed), matched = hits(references), materials = buildReportMaterials(references);
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest, input = expected.get(key);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, key);
      const hit = matched.find(rule => rule.id === id);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', chart, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.match(detail.calculationNote, /气质篇/);
      const witness = input.required.find(fact => fact.kind === 'western_lilly_temperament');
      assert.ok(witness && materials.includes(factText(witness)), key);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('lunar phase quarters wrap through zero and require both consistent longitudes', () => {
  const facts = [tropical, position('Sun', 350)];
  for (const [moon, phase] of [[350, '055'], [79.999, '055'], [80, '056'], [170, '057'], [260, '058'], [349.999, '058']]) {
    for (const number of ['055', '056', '057', '058']) {
      assert.equal(explain(number, [...facts, position('Moon', moon)]).matched, phase === number, '' + moon);
    }
  }
  const fake = { kind: 'western_lilly_temperament', table: 'main', selector: 'moon_phase.new_to_first_quarter' };
  assert.equal(explain('055', [...facts, fake]).matched, false);
  assert.equal(explain('055', [...facts, position('Moon', 356), position('Moon', 80)]).matched, false);
  assert.equal(explain('055', [...facts, position('Moon', 356)], false).matched, false);
});

test('the solar season can use a stable sign and the sign quality needs a chapter witness', () => {
  const sun = { kind: 'planet_sign', planet: 'Sun', sign: '白羊座' };
  assert.equal(explain('061', [tropical, sun], false).matched, true);
  assert.equal(explain('065', [tropical, sun], false).matched, false); // Solar season has its own row.
  assert.equal(explain('065', [tropical, { ...sun, planet: 'Moon' }], false).matched, true);
  assert.equal(explain('061', [tropical, sun, position('Sun', 185)]).matched, false);
});

test('a solar orientation is only usable for a planet with its own verified chapter role', () => {
  const facts = [...cusps(), position('Sun', 30), position('Moon', 15), position('Saturn', 116)];
  assert.equal(explain('042', facts).matched, true);
  const selected = explain('046', facts);
  assert.equal(selected.matched, true);
  assert.match(selected.calculationNote, /首列容许度/);
  assert.equal(explain('046', facts.filter(fact => fact.planet !== 'Moon')).matched, false);
  assert.equal(explain('046', facts.map(fact => fact.planet === 'Saturn' ? position('Saturn', 118) : fact)).matched, false);
});

test('partile rays to the ascendant use projected zodiac degrees across the boundary', () => {
  const facts = cusps(359.8);
  const exact = [...facts, position('Mars', 89.7)];
  assert.equal(explain('043', exact).matched, true);
  assert.equal(explain('105', exact).matched, true);
  assert.equal(explain('043', [...facts, position('Mars', 90.1)]).matched, false);
  assert.equal(explain('105', [...facts, position('Mars', 90.1)]).matched, false);
});

test('first-house nodes and double Moon evidence use confirmed five-degree placements', () => {
  const facts = cusps();
  assert.equal(explain('059', [...facts, north(355.2)]).matched, true);
  assert.equal(explain('060', [...facts, north(355.2)]).matched, false);
  assert.equal(explain('060', [...facts, north(175.2)]).matched, true);
  assert.equal(explain('104', [...facts, north(355.2), north(175.2)]).matched, false);
  assert.equal(explain('104', [...facts, position('Moon', 356.3)]).matched, true);
  assert.equal(explain('076', [...facts, position('Moon', 356.3)]).matched, true);
  assert.equal(explain('076', [...facts, position('Moon', 354.9)]).matched, false);
});

test('unresolved compilation and general weighting stay unmatchable while partial witnesses retain explanations', () => {
  const pending = new Map(pendingClaimConditions({ catalog }).filter(row => row.id.startsWith(prefix)).map(row => [row.id,row]));
  for (const number of ['069', '070', '071', '072', '073', '074', '075', '098', '099', '100', '101', '107']) {
    assert.equal(pending.get(idOf(number))?.status,'unmapped',number);
  }
  const ids = new Set(fixture.witnesses.flatMap(({ proofs }) => proofs.map(({ id }) => id)));
  const partial = [...ids].filter(id => pending.get(id)?.status === 'indexed');
  assert.equal(partial.length,fixture.partialRecords);
  assert.ok(partial.every(id => pending.get(id).recognized.length && pending.get(id).reviewNote));
});
