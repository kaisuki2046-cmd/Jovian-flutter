import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions, trueLunarNodeProfile } from '../../control/charts.ts';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim, pendingClaimConditions } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { isLillyNinthHouseSource, lillyNinthHouseProfile } from './lilly-ninth-house.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileWesternClaim, usesLillyAspectTable } from './western-claims.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-158-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-religion-dreams-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-ninth-house-test-'));
after(() => rmSync(directory, { recursive: true, force: true }));
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const native = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));
const idOf = number => prefix + number + '-001';

function queries(confirmedFacts, timeKnown = true, chartScope = 'natal') {
  const parsed = parseChartQueries([{
    method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, tradition: 'Christian Astrology',
    chartScope, confirmedFacts,
  }], { timeKnown });
  assert.equal(parsed.length, 1);
  return parsed;
}

const context = ([q]) => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const hits = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (number, facts) => explainClaim(idOf(number), 'western', context(queries(facts)), undefined, catalog);
const fixtureFacts = number => native(fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === idOf(number))));

test('every reviewed ninth-house group reaches SQLite, single-claim explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(({ proofs }) => proofs.map(({ id }) => id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  for (const id of ids) {
    const record = catalog.get(id);
    assert.equal(record.compiler, lillyNinthHouseProfile, id);
    for (const input of record.inputs) {
      assert.ok(new Set(input.required.filter(usesLillyAspectTable).map(fact => fact.table)).size <= 1, id);
      expected.set(id + ':' + digest(input), input);
    }
    const changed = structuredClone(record.claim);
    changed.conditions.original.push('不同版本');
    assert.ok(isLillyNinthHouseSource(changed));
    assert.equal(compileWesternClaim(changed).reason, 'source_review_required', id);
  }

  assert.equal(expected.size, fixture.alternatives);
  const calculation = [...new Map([...expected.values()].flatMap(input => input.required)
    .map(fact => [JSON.stringify(fact), fact])).values()];
  const dignityCells = new Map();
  const cellsAt = (sign, degree) => {
    const key = sign + degree;
    if (!dignityCells.has(key)) dignityCells.set(key, catalog.lillyDignityCells(sign, degree));
    return dignityCells.get(key);
  };
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(native(sample));
    const chart = context(parsed);
    const derived = claimChartContext('western', chart, calculation, cellsAt);
    const references = lookup(parsed);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of sample.proofs) {
      const key = id + ':' + inputDigest;
      const input = expected.get(key);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, key);
      const hit = hits(references).find(row => row.id === id);
      assert.ok(hit, id);
      const detail = explainClaim(id, 'western', chart, undefined, catalog);
      assert.equal(detail.matched, true, id);
      assert.match(detail.calculationNote, /第九宫篇/);
      const testimony = input.required.find(fact => fact.kind === 'western_lilly_ninth_house')
        ?? input.required.find(fact => fact.kind === 'western_lilly_solar_state');
      assert.ok(testimony && materials.includes(factText(testimony)), key);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

const position = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const motion = (planet, value) => ({ kind: 'planet_motion', planet, motion: value });
const north = longitude => ({ kind: 'western_true_node_longitude', profile: trueLunarNodeProfile, longitude });
const cusps = (offset = 0) => [
  { kind: 'western_zodiac', zodiac: 'tropical' },
  { kind: 'western_profile_system', profile: 'regiomontanus' },
  ...Array.from({ length: 12 }, (_, index) => ({
    kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude: index * 30 + offset,
  })),
];
const synthetic = [
  ...cusps(), position('Sun', 20), position('Moon', 50), position('Mercury', 77), position('Venus', 110),
  position('Mars', 142), position('Jupiter', 356), position('Saturn', 200),
];

test('a confirmed ninth-house vacancy differs from the confirmed vacancy of both houses', () => {
  assert.equal(explain('030', synthetic).matched, true);
  assert.equal(explain('022', synthetic).matched, false);
  assert.equal(explain('013', synthetic).matched, true); // Sagittarius cusp selects its Jupiter domicile lord.
  const moved = synthetic.map(fact => fact.planet === 'Mercury' ? position('Mercury', 98) : fact);
  assert.equal(explain('022', moved).matched, true);
  const incomplete = synthetic.filter(fact => fact.planet !== 'Mercury');
  const fake = { kind: 'western_lilly_ninth_house', table: 'main', selector: 'ninth_empty' };
  assert.equal(explain('030', [...incomplete, fake]).matched, false);
  assert.equal(explain('013', incomplete).matched, false);
  const occupied = synthetic.map(fact => fact.planet === 'Sun' ? position('Sun', 244) : fact);
  assert.equal(explain('015', occupied).matched, true);
  assert.equal(explain('013', occupied).matched, false);
  assert.equal(explain('030', occupied).matched, false);
});

test('a fixed-sign malefic needs its own direct motion, house and favorable aspect', () => {
  const facts = [...cusps(), position('Jupiter', 177), position('Saturn', 237), position('Mars', 50), motion('Mars', 'direct')];
  assert.equal(explain('007', [...facts, motion('Saturn', 'retrograde')]).matched, false);
  assert.equal(explain('007', [...facts, motion('Saturn', 'direct')]).matched, true);
  assert.equal(explain('007', [...facts, motion('Saturn', 'direct'), motion('Saturn', 'retrograde')]).matched, false);
});

test('the chapter opening only considers the South Node in the ninth house', () => {
  const facts = [...cusps(10), position('Jupiter', 170), position('Saturn', 260), position('Mars', 30)];
  assert.equal(explain('033', [...facts, north(272)]).matched, true);
  assert.equal(explain('041', [...facts, north(272)]).matched, false);
  assert.equal(explain('041', [...facts, north(92)]).matched, true);
});

test('the Moon and South Node must share both the ninth house and the same zodiac degree', () => {
  const facts = [...cusps(), position('Moon', 247.4)];
  assert.equal(explain('039', [...facts, north(67.8)]).matched, true);
  assert.equal(explain('039', [...facts, north(68.1)]).matched, false);
  assert.equal(explain('039', [...facts, north(67.8), north(68.1)]).matched, false);
});

test('precise longitude and genuine natal scope are required, and incomplete contacts cannot prove absence', () => {
  const spica = fixtureFacts('005'), bright = fixtureFacts('009');
  assert.equal(explain('005', spica).matched, true);
  assert.ok(hits(lookup(queries(spica, false))).every(row => row.id !== idOf('005')));
  assert.ok(hits(lookup(queries(spica, true, 'decade'))).every(row => row.id !== idOf('005')));
  assert.equal(explain('009', bright).matched, true);
  const fake = { kind: 'western_lilly_ninth_house', table: 'main', selector: 'strong_unafflicted_benefic_in_9' };
  assert.equal(explain('009', [...bright.filter(fact => fact.planet !== 'Mars'), fake]).matched, false);
});

test('method notes remain reference-only and unverified domination and many-planet rules stay pending', () => {
  for (const number of ['001', '003', '006', '028', '029']) assert.ok(!catalog.get(idOf(number)).inputs, number);
  const pending = new Map(pendingClaimConditions({ catalog }).filter(row => row.id.startsWith(prefix)).map(row => [row.id, row]));
  for (const number of ['005', '009', '010', '025', '027', '034', '035', '039', '041', '042']) {
    const id = idOf(number);
    const row = catalog.get(id);
    assert.equal(row.remainingAlternatives, 1, number);
    assert.ok(row.reviewNote, number);
    assert.equal(pending.get(id)?.reviewNote, row.reviewNote, number);
  }
});
