import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, sep } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { compileZiweiChangshengSource, ziweiChangshengSourceProfile } from './ziwei-changsheng-sources.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-129-witnesses.json', import.meta.url)));
const directory = mkdtempSync(join(tmpdir(), 'destiny-ziwei-changsheng-'));
after(() => {
  assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep + 'destiny-ziwei-changsheng-'));
  rmSync(directory, { recursive: true, force: true });
});
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = (id, text, inputDigest) => JSON.stringify([id, text ?? null, inputDigest]);

function queries(confirmedFacts, options) {
  const parsed = parseChartQueries([{ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts }], options);
  assert.ok(parsed);
  return parsed;
}

const context = ([q]) => chartContext('ziwei', q.confirmedFacts, q.confirmedAbsentFacts, q.chartScope);
test('every reviewed Changsheng group reaches SQLite, explanation and report materials', () => {
  const ids = new Set(fixture.witnesses.flatMap(w => w.proofs.map(proof => proof.id)));
  assert.equal(ids.size, fixture.sourceRecords);
  const expected = new Map();
  let whole = 0;
  for (const id of ids) {
    const row = catalog.get(id);
    if (row.inputs) whole++;
    const groups = row.inputs ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { inputs, text, conditionCompiler } of groups) {
      assert.equal(conditionCompiler, ziweiChangshengSourceProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += ' 异本';
    assert.equal(compileZiweiChangshengSource(changed).reason, 'source_review_required', id);
  }
  assert.equal(whole, fixture.wholeRecords);
  assert.equal(expected.size, fixture.alternatives);
  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = queries(native(sample)), chart = context(parsed), derived = claimChartContext('ziwei', chart);
    const refs = lookup(parsed), hits = refs.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(refs);
    for (const { id, text, inputDigest } of sample.proofs) {
      const proof = key(id, text, inputDigest), input = expected.get(proof);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = hits.find(row => row.id === id), detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.match(detail.calculationNote, /长生十二神.*命宫/u);
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(proof);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('each stage agrees with the native palaces for both genders, near the lunar year boundary', () => {
  for (const date of [{ year: 2024, month: 2, day: 9 }, { year: 2024, month: 2, day: 10 }, { year: 2023, month: 6, day: 11 }]) {
    for (const gender of ['male', 'female']) {
      for (const timeIndex of [0, 5, 11, 12]) {
        const nativeChart = calculateZiwei({ date, gender }, timeIndex);
        const facts = chartFacts.ziwei(nativeChart);
        const observed = claimChartContext('ziwei', context(queries(facts))).present
          .filter(fact => fact.kind === 'palace_changsheng_phase');
        assert.deepEqual(new Map(observed.map(fact => [fact.palace, fact.phase])),
          new Map(nativeChart.palaces.map(palace => [palace.name, palace.changsheng12])));
      }
    }
  }
});

test('unconfirmed or conflicting phases cannot enable palace-specific rules', () => {
  const id = 'ziwei-v3-xingjue-050-p1376-001';
  const reference = fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === id));
  assert.ok(reference);
  const facts = native(reference);
  const explain = chart => explainClaim(id, 'ziwei', chart, undefined, catalog);
  assert.equal(explain(context(queries(facts))).matched, true);
  assert.equal(explain(context(queries(facts, { timeKnown: false }))).matched, false);
  const withoutAnchor = facts.filter(fact => fact.kind !== 'natal_ziwei_life_phase');
  const onlyClaimed = [...withoutAnchor, { kind: 'palace_changsheng_phase', palace: '子女', phase: '长生' }];
  assert.equal(explain(context(queries(onlyClaimed))).matched, false);
  assert.equal(explain(chartContext('ziwei', onlyClaimed)).matched, false);
  const wrongAnchor = facts.map(fact => fact.kind === 'natal_ziwei_life_phase'
    ? { ...fact, phase: fact.phase === '病' ? '衰' : '病' } : fact);
  assert.equal(explain(context(queries(wrongAnchor))).matched, false);
  const wrongPalace = facts.map(fact => fact.kind === 'palace_branch' && fact.palace === '子女'
    ? { ...fact, branch: fact.branch === '子' ? '丑' : '子' } : fact);
  assert.equal(explain(context(queries(wrongPalace))).matched, false);
});

test('an absolute phase identifies the historical horse label at the same seat', () => {
  const id = 'ziwei-v2-xingjue-021-p406-001', quote = '居絕地者死馬也';
  const reference = fixture.witnesses.find(sample => sample.proofs.some(proof => proof.id === id && proof.text === quote));
  assert.ok(reference);
  const facts = native(reference);
  const explain = facts => explainClaim(id, 'ziwei', context(queries(facts)), undefined, catalog);
  assert.ok(explain(facts).matchedBranches.some(branch => branch.text === quote));
  const withoutHorse = facts.filter(fact => fact.kind !== 'palace_star' || fact.star !== '天马');
  assert.equal(explain(withoutHorse).matched, false);
});
