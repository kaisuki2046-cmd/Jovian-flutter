import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileZpzqCases, zpzqCaseProfile } from './zpzq-natal-cases.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-130-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-zpzq-cases-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-zpzq-cases-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const native = ({ date: [year, month, day, hour], gender }) => {
  const wall = Date.UTC(year, month - 1, day, hour);
  return [...chartFacts.bazi(calculateBaZi(wall - 8 * 3_600_000, wall)), { kind: 'natal_gender', gender }];
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = (id, text, inputDigest) => JSON.stringify([id, text ?? null, inputDigest]);

function queries(confirmedFacts, options) {
  const parsed = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts }], options);
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('bazi', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
test('every verified Ziping Zhenquan form reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, zpzqCaseProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileZpzqCases(changed).reason, 'source_review_required', id);
  }
  assert.equal(whole, fixture.wholeRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(native(sample)), chart = context(parsed), derived = claimChartContext('bazi', chart);
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
      assert.match(detail.calculationNote, /子平真诠.*月令/u);
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

const explain = (id, facts, options) => explainClaim(id, 'bazi', context(queries(facts, options)), undefined, catalog);
const sampleFor = id => fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === id));
const knownPillars = pillars => chartFacts.bazi(describeBaZiPillars(pillars));

test('the adjacent partner rule keeps historical gender and requires a consistent complete chart', () => {
  const id = 'zpzq-v1-c005-p003-001';
  const facts = native(sampleFor(id));
  assert.ok(explain(id, facts).matched);
  assert.ok(!explain(id, facts.filter(fact => fact.kind !== 'natal_gender')).matched);
  assert.ok(!explain(id, facts, { timeKnown: false }).matched);
  const incomplete = facts.filter(fact => fact.kind !== 'pillar' || fact.position !== 'hour');
  assert.equal(explain(id, incomplete).reason, 'conflicting_pillars');
  const wrongYear = { kind: 'pillar', position: 'year', ganZhi: facts.find(f => f.kind === 'pillar' && f.position === 'year').ganZhi === '甲子' ? '甲寅' : '甲子' };
  assert.equal(explain(id, [...facts, wrongYear]).reason, 'conflicting_pillars');
});

test('the Gui-before-Xin passage cannot be triggered by an otherwise valid chart with the reverse order', () => {
  const id = 'zpzq-v1-c021-p005-001';
  assert.equal(explain(id, native(sampleFor(id))).matched, true);
  const reverse = knownPillars({ year: '丙寅', month: '辛卯', day: '己卯', hour: '癸酉' });
  assert.equal(explain(id, reverse).matched, false);
});

test('Geng in Shen needs a full water combination, visible Ding, and no visible Ren or Gui', () => {
  const id = 'zpzq-v1-c015-p007-001';
  assert.equal(explain(id, native(sampleFor(id))).matched, true);
  const bothPresent = { day: '庚子', hour: '丁丑' };
  const supported = { ...bothPresent, year: '戊辰', month: '庚申' };
  const exposesRen = knownPillars({ ...bothPresent, year: '壬辰', month: '戊申' });
  assert.equal(explain(id, knownPillars(supported)).matched, true);
  assert.equal(explain(id, knownPillars({ ...supported, day: '庚寅' })).matched, false);
  assert.equal(explain(id, exposesRen).matched, false);
});

test('visible wealth is counted by actual stem, separately from the hidden officer', () => {
  const id = 'zpzq-v1-c034-p019-001';
  const support = knownPillars({ year: '丙寅', month: '癸巳', day: '癸未', hour: '壬戌' });
  const repeats = knownPillars({ year: '丙寅', month: '癸巳', day: '癸未', hour: '丁巳' });
  assert.equal(explain(id, support).matched, true);
  assert.equal(explain(id, repeats).matched, false);
});
