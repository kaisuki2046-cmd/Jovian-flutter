import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { westernFixedStarProfile } from '../../control/western-fixed-stars.mjs';
import { factText } from '../chart-facts-text.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim, pendingClaimConditions } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { compileLillyMannersSource, lillyMannersProfile } from './lilly-manners.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-159-witnesses.json', import.meta.url)));
const prefix = 'astro-lilly-v3-manners-p';
const directory = mkdtempSync(join(tmpdir(), 'destiny-lilly-manners-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-lilly-manners-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory);
const lookup = createReportLookup(directory);
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const idOf = number => prefix + number + '-001';
const native = sample => chartFacts.western(calculateWestern(Date.parse(sample.date), sample));

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{
    method: 'western', rulesetVersion: chartVersions.western.rulesetVersion, tradition: 'Christian Astrology', confirmedFacts,
  }], { timeKnown });
  assert.equal(parsed.length, 1);
  return parsed;
}
const context = ([q]) => chartContext('western', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const hits = references => references.flatMap(({ personality, events }) => [...personality, ...events]);
const explain = (number, facts) => explainClaim(idOf(number), 'western', context(queries(facts)), undefined, catalog);
const position = (planet, longitude) => ({ kind: 'planet_longitude', planet, longitude });
const star = (name, longitude) => ({ kind: 'western_fixed_star_longitude', profile: westernFixedStarProfile, star: name, longitude });
const tropical = { kind: 'western_zodiac', zodiac: 'tropical' };
const cusps = longitudes => [
  tropical, { kind: 'western_profile_system', profile: 'regiomontanus' },
  ...longitudes.map((longitude, index) => ({ kind: 'western_profile_cusp_longitude', profile: 'regiomontanus', house: index + 1, longitude })),
];
const equalCusps = (offset = 0) => cusps(Array.from({ length: 12 }, (_, i) => (i * 30 + offset) % 360));

test('verified Lilly manners configurations reach SQLite, single-claim explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(({ proofs }) => proofs.map(({ id }) => id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let partial = 0;
  for (const id of ids) {
    const record = catalog.get(id);
    assert.equal(record.compiler, lillyMannersProfile, id);
    if (record.remainingAlternatives) partial++;
    for (const input of record.inputs) expected.set(id + ':' + digest(input), input);
    const changed = structuredClone(record.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileLillyMannersSource(changed).reason, 'source_review_required', id);
  }
  assert.equal(partial, fixture.partialRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  const dignityCells = new Map();
  const cellsAt = (sign, degree) => {
    const key = sign + degree;
    if (!dignityCells.has(key)) dignityCells.set(key, catalog.lillyDignityCells(sign, degree));
    return dignityCells.get(key);
  };
  for (const sample of fixture.witnesses) {
    const parsed = queries(native(sample));
    const chart = context(parsed);
    const derived = claimChartContext('western', chart, [], cellsAt);
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
      assert.match(detail.calculationNote, /性情篇/);
      const fact = input.required.find(value => value.kind === 'western_lilly_manners');
      assert.ok(fact && materials.includes(factText(fact)), key);
      assert.ok(materials.includes(hit.claim.evidence.original_text), id);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('full first-house interception supplies its own candidate without changing the rising sign', () => {
  const mars = position('Mars', 44);
  const intercepted = [...cusps([15, 68, 85, 105, 135, 160, 195, 248, 265, 285, 315, 340]), mars];
  const proof = explain('080', intercepted);
  assert.equal(proof.matched, true);
  assert.ok(proof.matchedConditions.required.some(fact => fact.selector === 'intercepted_sign_candidate'));
  assert.equal(explain('023', intercepted).matched, true);
  assert.equal(explain('080', [...equalCusps(), mars]).matched, false);
});

test('the Moon and Mercury fallback requires verified vacancy and the same third planet for the shared contact', () => {
  const empty = [...equalCusps(), position('Sun', 130), position('Moon', 58), position('Mercury', 68),
    position('Venus', 95), position('Mars', 63), position('Jupiter', 225), position('Saturn', 275)];
  assert.equal(explain('035', empty).matched, true);
  assert.equal(explain('079', empty).matched, true);
  assert.equal(explain('079', empty.filter(fact => fact.planet !== 'Jupiter')).matched, false);
  const separate = [...equalCusps(), position('Sun', 130), position('Moon', 60), position('Mercury', 78),
    position('Venus', 80), position('Mars', 58), position('Jupiter', 225), position('Saturn', 275)];
  assert.equal(explain('035', separate).matched, true);
  assert.equal(explain('079', separate).matched, false);
  const inRisingSign = empty.map(fact => fact.planet === 'Sun' ? position('Sun', 29) : fact);
  assert.equal(explain('035', inRisingSign).matched, false);
});

test('a named fixed star requires a verified role and each distinct excerpt keeps its interpretation', () => {
  const algol = star('caput_algol', 52.4);
  const saturn = position('Saturn', 52.6);
  const fake = { kind: 'western_lilly_manners', table: 'main', selector: 'star.caput_algol.significator' };
  assert.equal(explain('004', [...equalCusps(), algol, saturn, fake]).matched, false);
  const withRuler = [...equalCusps(), algol, saturn, position('Mars', 52.8)];
  assert.equal(explain('004', withRuler).matched, true);
  assert.equal(explain('077', withRuler).matched, false);
  const withSignificator = [...equalCusps(36), algol, saturn];
  assert.equal(explain('077', withSignificator).matched, true);
  const materials = buildReportMaterials(lookup(queries(withSignificator)));
  for (const id of ['004', '077']) {
    const { evidence, interpretation } = catalog.get(idOf(id)).claim;
    assert.ok(materials.includes(`原文/依据：${evidence.original_text}\n现代解读：${interpretation.classical_meaning}`), id);
  }
});

test('the direct Mercury and Spica entry checks its own star and survives a chart without houses', () => {
  const exact = [tropical, position('Mercury', 202.7), star('spica_virgo', 202.8)];
  assert.equal(explain('019', exact).matched, true);
  assert.equal(explain('013', exact).matched, false);
  assert.equal(explain('019', [...exact, star('spica_virgo', 203.1)]).matched, false);
  assert.equal(explain('019', exact.map(fact => fact.planet === 'Mercury' ? position('Venus', 202.7) : fact)).matched, false);
  assert.ok(hits(lookup(queries(exact, false))).every(row => row.id !== idOf('019')));
});

test('the sole Mercury contact shapes a selected Mercury, and incomplete charts cannot prove contact count', () => {
  const complete = [position('Sun', 35), position('Moon', 70), position('Mercury', 100), position('Venus', 104),
    position('Mars', 10), position('Jupiter', 180), position('Saturn', 250)];
  assert.equal(explain('086', [...equalCusps(), ...complete]).matched, false);
  assert.equal(explain('086', [...equalCusps(90), ...complete]).matched, true);
  assert.equal(explain('086', [...equalCusps(90), ...complete.filter(fact => fact.planet !== 'Saturn')]).matched, false);
});

test('partial evidence and unresolved historical identities are counted separately', () => {
  const pending = pendingClaimConditions({ catalog }).filter(row => row.id.startsWith(prefix));
  for (const number of ['005', '008', '016', '017', '037', '038', '039', '093', '095', '096']) {
    assert.ok(pending.some(row => row.id === idOf(number) && row.status === 'unmapped'), number);
  }
  const ids = new Set(fixture.witnesses.flatMap(({ proofs }) => proofs.map(({ id }) => id)));
  const partial = pending.filter(row => row.status === 'indexed' && ids.has(row.id));
  assert.equal(partial.length, fixture.partialRecords);
  assert.ok(partial.every(row => row.recognized.length && row.reviewNote));
});
