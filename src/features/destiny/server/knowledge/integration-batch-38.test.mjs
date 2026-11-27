import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateBaZi, calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { lillyHouseFacts } from '../../control/lilly-houses.mjs';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { explainClaim } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup } from './report-lookup.mjs';
import { heluoProfile, tiebanBaseNumbers } from './tieban.mjs';
import { compileWesternClaim } from './western-claims.mjs';

const western = JSON.parse(readFileSync(new URL('./claims/integration-batch-38-western-witnesses.json', import.meta.url), 'utf8'));
const heluo = JSON.parse(readFileSync(new URL('./claims/tieban-heluo-witnesses.json', import.meta.url), 'utf8'));
const ascendantId = 'astro-lilly-v3-preferment-p034-001';
const emptySecondId = 'astro-lilly-v3-wealth-duration-p015-001';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const catalog = catalogForDirectory(catalogDirectory);
const query = (method, confirmedFacts) => ({ method, rulesetVersion: chartVersions[method].rulesetVersion, confirmedFacts });
const westernFacts = witness => chartFacts.western(calculateWestern(Date.parse(witness.date), witness));
function baziFacts({ birthTime, gender }) {
  const instant = Date.parse(birthTime);
  return [...chartFacts.bazi(calculateBaZi(instant, instant + 8 * 3600000)), { kind: 'natal_gender', gender }];
}
const heluoResult = object => object?.additionalCalculations.find(row => row.profile === heluoProfile);
const westernExample = id => westernFacts(western.witnesses.find(w => w.proofs.some(p => p.id === id)));
const westernHas = (id, raw) => lookupInterpretations(catalogDirectory, query('western', raw)).some(row => row.id === id);

test('both printed Heluo examples reproduce their numbers and keep uncollected clauses out of materials', async () => {
  const lookup = createReportLookup();
  for (const rows of [heluo.printed, heluo.center]) {
    const [witness] = rows;
    const raw = baziFacts(witness);
    assert.deepEqual(raw.filter(f => f.kind === 'pillar').map(f => f.ganZhi), witness.pillars);
    const result = heluoResult(tiebanBaseNumbers(raw, witness.birthYear));
    assert.deepEqual(result.candidates.map(f => f.clauseId), rows.map(f => f.clauseId));
    const parsed = parseInput({ timeKnown: true, chartQueries: [{ ...query('bazi', raw), birthYear: witness.birthYear }] });
    assert.equal(parsed.chartQueries[0].birthYear, witness.birthYear);
    const output = await generateReport(parsed, { lookup, signal: new AbortController().signal, complete: async ({ materials }) => {
      assert.doesNotMatch(materials, /河洛(?:先天|后天)基数/u);
      assert.doesNotMatch(materials, /birthYear/u);
      return '测试报告';
    } });
    assert.deepEqual(heluoResult(output.tieban).results, rows.map(({ axis, clauseId }) => ({
      axis, clauseId, status: 'unmatched', reason: 'not_in_catalog',
    })));
  }
  assert.deepEqual(heluo.printed.map(row => row.clauseId), [1497, 2666]);
  assert.deepEqual(heluo.center.map(row => row.clauseId), [5918, 8237]);
  const [center] = heluo.center;
  assert.equal(heluoResult(tiebanBaseNumbers(baziFacts(center))), undefined);
  assert.equal(heluoResult(tiebanBaseNumbers(baziFacts(center), 1985)), undefined);
});

test('Heluo requires the two solstice intervals exactly where the pure hexagram needs them', () => {
  for (const key of ['乾:午:小满', '乾:午:夏至', '坤:子:冬至']) {
    const witness = heluo.edges[key];
    const raw = baziFacts(witness);
    assert.ok(raw.some(fact => fact.kind === 'bazi_previous_qi' && fact.term === witness.qi));
    assert.deepEqual(heluoResult(tiebanBaseNumbers(raw, witness.birthYear)).candidates, witness.candidates);
    const old = raw.filter(fact => fact.kind !== 'bazi_previous_qi');
    assert.deepEqual(heluoResult(tiebanBaseNumbers(old, witness.birthYear)).candidates, [witness.candidates[0]]);
    const conflicting = [...raw, { kind: 'bazi_previous_qi', term: '春分' }];
    assert.deepEqual(heluoResult(tiebanBaseNumbers(conflicting, witness.birthYear)).candidates, [witness.candidates[0]]);
  }
  const pending = heluo.edges.uncertain;
  assert.deepEqual(heluoResult(tiebanBaseNumbers(baziFacts(pending), pending.birthYear)).candidates, pending.candidates);
  assert.equal(pending.candidates.length, 1);
  const queryWithYear = { ...query('bazi', baziFacts(pending)), birthYear: pending.birthYear };
  assert.equal(parseInput({ timeKnown: false, chartQueries: [queryWithYear] }).chartQueries[0].birthYear, undefined);
  assert.equal(parseInput({ timeKnown: true, chartQueries: [{ ...queryWithYear, birthYear: '1900' }] }), null);
});

test('Heluo uses the existing versioned SQLite index and quotes all 13 re-matched clause IDs', () => {
  const lookup = createReportLookup();
  assert.equal(heluo.additionalReach, 0);
  assert.equal(new Set(heluo.witnesses.map(w => w.claimId)).size, 13);
  for (const witness of heluo.witnesses) {
    const input = { ...query('bazi', baziFacts(witness)), birthYear: witness.birthYear };
    const references = lookup(parseInput({ timeKnown: true, chartQueries: [input] }).chartQueries);
    const actual = heluoResult(references[0].tieban);
    const found = actual.results.find(row => row.axis === witness.axis);
    assert.equal(actual.libraryEdition, heluo.libraryEdition);
    assert.equal(found.clauseId, witness.clauseId);
    assert.equal(found.claim.id, witness.claimId);
    const materials = buildReportMaterials(references);
    const label = witness.axis === 'heluo_earlier' ? '河洛先天基数' : '河洛后天基数';
    assert.ok(materials.includes(`${label} ${found.clauseId}`));
    assert.ok(materials.includes(found.claim.evidence.original_text));
  }
});

test('all 15 new Lilly groups reach SQLite, explanation and report through native charts', () => {
  const ids = [...new Set(western.witnesses.flatMap(row => row.proofs.map(proof => proof.id)))];
  const seen = new Set();
  const lookup = createReportLookup();
  assert.equal(ids.length, 3);
  for (const witness of western.witnesses) {
    const raw = westernFacts(witness);
    const parsed = parseInput({ timeKnown: true, chartQueries: [query('western', raw)] });
    const references = lookup(parsed.chartQueries);
    const hits = references.flatMap(row => [...row.personality, ...row.events]);
    for (const { id, inputDigest } of witness.proofs) {
      const hit = hits.find(row => row.id === id);
      assert.ok(hit, id);
      const compiled = catalog.get(id).inputs.find(input => digest(input) === inputDigest);
      const groups = [hit.matchedConditions.required, ...(hit.matchedConditions.alternatives ?? [])];
      assert.ok(groups.some(group => digest(group) === digest(compiled.required)), id);
      assert.ok(explainClaim(id, 'western', chartContext('western', raw), undefined, catalog).matched);
      assert.ok(buildReportMaterials(references).includes(hit.claim.evidence.original_text));
      seen.add(`${id}:${inputDigest}`);
    }
  }
  assert.equal(seen.size, 15);
  assert.deepEqual([...seen].sort(), ids.flatMap(id => catalog.get(id).inputs.map(input => `${id}:${digest(input)}`)).sort());
});

test('empty second house needs all seven coordinates and a shared actual ruler', () => {
  const raw = westernExample(emptySecondId);
  assert.ok(westernHas(emptySecondId, raw));
  const derived = { kind: 'western_lilly_empty_second_shared_ruler' };
  const withoutMercury = raw.filter(fact => !(fact.kind === 'planet_longitude' && fact.planet === 'Mercury'));
  assert.ok(!westernHas(emptySecondId, [...withoutMercury, derived]));
  const second = raw.find(fact => fact.kind === 'western_profile_cusp_longitude' && fact.house === 2).longitude;
  assert.ok(!westernHas(emptySecondId, [...withoutMercury.filter(f => !(f.kind === 'planet_sign' && f.planet === 'Mercury')),
    { kind: 'planet_longitude', planet: 'Mercury', longitude: second }]));
  const changedSource = structuredClone(catalog.get(emptySecondId).claim);
  changedSource.evidence.original_text += ' edited';
  assert.equal(compileWesternClaim(changedSource).reason, 'source_review_required');
});

test('the actual first-house ruler must have an unambiguous longitude in the rising sign', () => {
  const raw = westernExample(ascendantId);
  const ruler = lillyHouseFacts(raw).find(row => row.kind === 'western_lilly_house_ruler' && row.house === 1);
  const position = raw.find(fact => fact.kind === 'planet_longitude' && fact.planet === ruler.planet);
  const sign = raw.find(fact => fact.kind === 'planet_sign' && fact.planet === ruler.planet).sign;
  assert.ok(westernHas(ascendantId, raw));
  assert.ok(!westernHas(ascendantId, [...raw.filter(fact => fact !== position), { kind: 'western_lilly_ascendant_ruler_sign', sign }]));
  assert.ok(!westernHas(ascendantId, [...raw, { ...position, longitude: (position.longitude + 60) % 360 }]));
  const [unknown] = parseInput({ timeKnown: false, chartQueries: [query('western', raw)] }).chartQueries;
  assert.ok(!lookupInterpretations(catalogDirectory, unknown).some(row => row.id === ascendantId));
});
