import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, calculateWestern, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup } from './report-lookup.mjs';
import { parseInput } from '../report.mjs';
import { compileYuanhaiNatalPassages, yuanhaiNatalPassagesProfile } from './yuanhai-natal-passages.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-151-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-yuanhai-natal-passages-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-yuanhai-natal-passages-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const beijing = { latitude: 39.9042, longitude: 116.4074 };
function native({ birthTime, pillars }) {
  const instant = Date.parse(birthTime);
  const chart = calculateBaZi(instant, instant + 8 * 3600_000);
  assert.deepEqual({ year: chart.year, month: chart.month, day: chart.day, hour: chart.hour }, pillars);
  return [...chartFacts.bazi(chart), { kind: 'natal_daylight', sect: calculateWestern(instant, beijing).sect }];
}
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = (id, text, inputDigest) => JSON.stringify([id, text ?? null, inputDigest]);

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseInput({ timeKnown, chartQueries: [
    { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts },
  ] });
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('bazi', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
const explain = (id, facts, timeKnown = true) =>
  explainClaim(id, 'bazi', context(queries(facts, timeKnown).chartQueries), undefined, catalog);

function witness(id, text) {
  const row = fixture.witnesses.find(w => w.proofs.some(proof =>
    proof.id === id && (text === undefined || proof.text === text)));
  assert.ok(row, id);
  return native(row);
}

test('every reviewed Yuanhai group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, yuanhaiNatalPassagesProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileYuanhaiNatalPassages(changed).reason, 'source_review_required', id);
  }
  assert.equal(whole, fixture.wholeRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(native(sample)).chartQueries, chart = context(parsed), derived = claimChartContext('bazi', chart);
    const refs = lookup(parsed), hits = refs.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of sample.proofs) {
      const proof = key(id, text, inputDigest), input = expected.get(proof);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id), detail = explainClaim(id, 'bazi', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.match(detail.calculationNote, /渊海子平.*继善篇.*碧渊赋/u);
      const evidence = text ?? hit.claim.evidence.original_text;
      assert.ok(materials.includes(evidence), id);
      if (text && text !== hit.claim.evidence.original_text) {
        assert.ok(!materials.includes(hit.claim.evidence.original_text), id);
      }
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('Gui day and hour require the complementary Hai or Chou in a different pillar', () => {
  const id = 'yhzp-v4-c025-p009-001', facts = witness(id);
  const hour = facts.find(fact => fact.kind === 'pillar' && fact.position === 'hour');
  assert.ok(hour && ['癸亥', '癸丑'].includes(hour.ganZhi));
  const other = hour.ganZhi === '癸亥' ? '丑' : '亥';
  assert.ok(explain(id, facts).matched);
  const missing = facts.filter(fact => fact.kind !== 'branch' || fact.position === 'hour' || fact.branch !== other);
  assert.equal(explain(id, missing).matched, false);
  assert.equal(explain(id, facts, false).matched, false);
});

test('the day and hour noble clause requires consistent daylight and a real hour nobleman', () => {
  const id = 'yhzp-v4-c025-p007-001', clause = '日時正貴，晚岁成名';
  const facts = witness(id, clause);
  assert.ok(explain(id, facts).matchedBranches.some(branch => branch.text === clause));
  const light = facts.find(fact => fact.kind === 'natal_daylight');
  assert.ok(light);
  const without = facts.filter(fact => fact.kind !== 'natal_daylight');
  const other = { kind: 'natal_daylight', sect: light.sect === 'day' ? 'night' : 'day' };
  for (const altered of [without, [...without, other], [...facts, other]]) {
    assert.ok(!explain(id, altered).matchedBranches?.some(branch => branch.text === clause));
  }
});

test('summer metal and winter fire supply only their own words to the report', () => {
  const id = 'yhzp-v4-c025-p006-001';
  const clauses = ['丙丁生於冬月，貴乎戊巳當頭', '庚辛産於夏天，妙乎𡈼癸得局'];
  for (const [i, clause] of clauses.entries()) {
    const facts = witness(id, clause);
    assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [clause]);
    const materials = buildReportMaterials(lookup(queries(facts).chartQueries));
    assert.ok(materials.includes(clause));
    assert.ok(!materials.includes(clauses[1 - i]));
  }
});

test('a caller cannot combine incompatible coordinates to activate an anchored wealth judgment', () => {
  const id = 'yhzp-v4-c025-p011-001', facts = witness(id);
  assert.ok(explain(id, facts).matched);
  const year = facts.find(fact => fact.kind === 'branch' && fact.position === 'year');
  assert.ok(year);
  const different = year.branch === '申' ? '午' : '申';
  assert.equal(explain(id, [...facts, { kind: 'branch', position: 'year', branch: different }]).matched, false);
});
