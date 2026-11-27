import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { calculateBaZi, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { baziClassicalStructureProfile, compileBaziClassicalStructures } from './bazi-classical-structures.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-139-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-classical-structure-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-classical-structure-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const food = suffix => 'zpzq-v1-c038-p' + suffix;
const successor = suffix => 'yhzp-v2-c002-p' + suffix;

function factsAt(wall) {
  const local = Date.parse(wall);
  return chartFacts.bazi(calculateBaZi(local - 8 * 3_600_000, local));
}
function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{
    method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts,
  }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}
const explain = (id, facts) => explainClaim(id, 'bazi', chartContext('bazi', facts), undefined, catalog);
const outputs = refs => refs.flatMap(({ personality, events }) => [...personality, ...events]);
const witness = id => fixture.witnesses.find(w => w.proofs.some(([key]) => key === id));

test('each reviewed option reaches SQLite, its own explanation and report materials through real BaZi charts', () => {
  const ids = new Set(fixture.witnesses.flatMap(row => row.proofs.map(([id]) => id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  for (const id of ids) {
    const row = catalog.get(id), profiles = row.inputs ? [row.compiler] : row.branches.map(branch => branch.conditionCompiler);
    assert.deepEqual(profiles, [baziClassicalStructureProfile], id);
    const text = row.inputs ? row.claim.evidence.original_text : row.branches[0].text;
    const inputs = row.inputs ?? row.branches[0].inputs;
    assert.ok(row.claim.evidence.original_text.includes(text));
    inputs.forEach((input, index) => expected.set(JSON.stringify([id, index]), { input, text }));
    const changed = structuredClone(row.claim);
    changed.evidence.context += '異文';
    assert.equal(compileBaziClassicalStructures(changed).reason, 'source_review_required', id);
  }
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const row of fixture.witnesses) {
    const facts = factsAt(row.wall);
    assert.deepEqual(facts.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), row.pillars);
    const chart = claimChartContext('bazi', chartContext('bazi', facts));
    const refs = lookup(queries(facts)), matches = outputs(refs), materials = buildReportMaterials(refs);
    for (const proof of row.proofs) {
      const [id] = proof, key = JSON.stringify(proof), spec = expected.get(key);
      assert.ok(spec && evaluateRule(spec.input, 'natal', chart).matched, id);
      const result = explain(id, facts), hit = matches.find(item => item.id === id);
      assert.ok(hit && result.matched, id);
      assert.match(result.calculationNote, /月令本气.*柱序/u);
      assert.ok(materials.includes(spec.text), id);
      seen.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('wealth, food and killing must occupy the original order of exposed stems', () => {
  const id = food('018-001'), sample = witness(id);
  assert.equal(explain(id, factsAt(sample.wall)).matched, true);
  const reordered = factsAt('1963-07-13T00:30:00Z');
  const stems = reordered.filter(fact => fact.kind === 'stem_ten_god' && fact.position !== 'day');
  assert.deepEqual(stems.map(fact => fact.tenGod), ['七杀', '食神', '正财']);
  assert.equal(explain(id, reordered).matched, false);
});

test('a source pattern with a named limit keeps that limit in its native chart', () => {
  const rooted = food('001-001'), sample = factsAt(witness(rooted).wall);
  const match = explain(rooted, sample);
  assert.deepEqual(match.matchedBranches.map(branch => branch.text), ['财要有根，不必偏正叠出']);
  assert.equal(explain(rooted, factsAt('1944-09-12T12:30:00Z')).matched, false);
  const single = food('010-201'), caseFacts = factsAt(witness(single).wall);
  assert.ok(caseFacts.some(fact => fact.kind === 'hidden_ten_god' && fact.tenGod === '正财'));
  assert.equal(explain(single, caseFacts).matched, true);
  assert.equal(explain(single, factsAt('2023-09-28T02:30:00Z')).matched, false);
  assert.equal(explain(successor('100-101'), factsAt('1950-07-27T00:30:00Z')).matched, false);
});

test('one virtue, missing hour and forged calculated evidence cannot trigger the two-virtue passage', () => {
  const id = successor('118-101'), source = catalog.get(id);
  const oneVirtue = factsAt('1929-12-10T20:30:00Z');
  const derived = claimChartContext('bazi', chartContext('bazi', oneVirtue));
  assert.equal(new Set(derived.present.filter(fact => fact.kind === 'shen_sha' && ['天德', '月德'].includes(fact.name))
    .map(fact => fact.name)).size, 1);
  assert.equal(explain(id, [...oneVirtue, ...source.inputs[0].required]).matched, false);
  const actual = factsAt(witness(id).wall);
  assert.equal(explain(id, actual).matched, true);
  assert.equal(explain(id, [...actual.filter(fact => fact.position !== 'hour'), ...source.inputs[0].required]).matched, false);
  assert.ok(!outputs(lookup(queries(actual, false))).some(hit => hit.id === id));
});
