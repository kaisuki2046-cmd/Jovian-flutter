import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { compileQtbjSeasonalPassages, qtbjSeasonalPassageProfile } from './qtbj-seasonal-passages.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const { alternatives, records, whole, passages, inBirthDateRange, witnesses } =
  JSON.parse(readFileSync(new URL('./claims/integration-batch-70-witnesses.json', import.meta.url)));
const catalog = catalogForDirectory(), lookup = createReportLookup();
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const keyOf = (id, text, inputDigest) => JSON.stringify([id, text, inputDigest]);
const male = { kind: 'natal_gender', gender: '男' };

function queries(confirmedFacts, timeKnown = true) {
  const parsed = parseChartQueries([{ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts }], { timeKnown });
  assert.ok(parsed);
  return parsed;
}

function raw(witness) {
  const instant = Date.parse(witness.birthTime);
  return [...chartFacts.bazi(calculateBaZi(instant, instant + 8 * 3600000)), male];
}

const hits = refs => refs.flatMap(ref => [...ref.personality, ...ref.events]);
const chartFrom = ([query]) => chartContext('bazi', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (id, facts, timeKnown) => explainClaim(id, 'bazi', chartFrom(queries(facts, timeKnown)), undefined, catalog);
const witnessFor = (id, text) => witnesses.find(witness => witness.proofs.some(proof =>
  proof.id === id && (text === undefined || proof.text === text)));

test('all reviewed wood and water conditions reach SQLite, explanation and report materials from calculated pillars', () => {
  const rows = new Map([...new Set(witnesses.flatMap(witness => witness.proofs.map(proof => proof.id)))]
    .map(id => [id, catalog.get(id)]));
  assert.equal(rows.size, records);
  assert.equal([...rows.values()].filter(row => row.inputs?.length).length, whole);
  assert.equal([...rows.values()].reduce((count, row) => count + row.branches.length, 0), passages);
  const expected = new Map();
  for (const [id, row] of rows) {
    const branches = row.inputs ? [{ text: null, inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches;
    for (const { text, inputs, conditionCompiler } of branches) {
      assert.equal(conditionCompiler, qtbjSeasonalPassageProfile);
      for (const input of inputs) expected.set(keyOf(id, text, digest(input)), input);
    }
    const changed = structuredClone(row.claim);
    changed.evidence.context += '异本';
    assert.equal(compileQtbjSeasonalPassages(changed, () => assert.fail('altered source compiled')).reason, 'source_review_required');
  }
  assert.equal(expected.size, alternatives);
  const seen = new Set(), seenInRange = new Set();
  for (const witness of witnesses) {
    const parsed = queries(raw(witness)), chart = chartFrom(parsed);
    const derived = claimChartContext('bazi', chart);
    const refs = lookup(parsed), matched = hits(refs), materials = buildReportMaterials(refs);
    const birthTime = Date.parse(witness.birthTime) + 8 * 3600000;
    for (const { id, text, digest: inputDigest } of witness.proofs) {
      const key = keyOf(id, text, inputDigest), input = expected.get(key);
      assert.ok(input && evaluateRule(input, 'natal', derived).matched, id);
      const hit = matched.find(item => item.id === id);
      const detail = explainClaim(id, 'bazi', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? rows.get(id).claim.evidence.original_text), id);
      seen.add(key);
      if (birthTime >= Date.UTC(1900, 0, 1) && birthTime < Date.UTC(2026, 10, 20)) seenInRange.add(key);
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
  assert.equal(seenInRange.size, inBirthDateRange);
});

test('the contested Ji branch needs the stated gender, both positions and no second visible Jia', () => {
  const id = 'qtbj-v2-c005-p013-001';
  const facts = raw(witnessFor(id));
  assert.ok(explain(id, facts).matched);
  assert.equal(explain(id, facts.filter(fact => fact.kind !== 'natal_gender')).matched, false);
  assert.equal(explain(id, [...facts.filter(fact => fact.kind !== 'natal_gender'), { ...male, gender: '女' }]).matched, false);
  assert.equal(explain(id, facts, false).matched, false);
  const withSecondJia = [...chartFacts.bazi(describeBaZiPillars({ year: '甲子', month: '己巳', day: '甲寅', hour: '己巳' })), male];
  assert.equal(explain(id, withSecondJia).matched, false);
});

test('a concealed Ren is neither a visible rescue nor proof of total absence', () => {
  const id = 'qtbj-v6-c108-p002-101';
  const rescue = '有壬出救者，富贵', noRen = '无壬者，贫穷';
  for (const text of [rescue, noRen]) {
    const facts = raw(witnessFor(id, text));
    assert.deepEqual(explain(id, facts).matchedBranches.map(branch => branch.text), [text]);
    assert.equal(explain(id, facts, false).matched, false);
  }
  const hiddenOnly = chartFacts.bazi(describeBaZiPillars({ year: '庚戌', month: '戊寅', day: '癸亥', hour: '戊午' }));
  assert.equal(explain(id, hiddenOnly).matched, false);
  assert.ok(!hits(lookup(queries(hiddenOnly))).some(hit => hit.id === id));
});

test('conflicting day stems and complete trines remain visible in the source review queue', () => {
  const reviewIds = ['c097-p003-401', 'c105-p002-101', 'c112-p002-101', 'c119-p004-301', 'c119-p005-401'];
  for (const suffix of reviewIds) {
    const id = 'qtbj-v6-' + suffix, row = catalog.get(id);
    assert.ok(!row.inputs && !row.branches.length, id);
    assert.match(explainClaim(id, 'bazi', null, undefined, catalog).reviewNote, /阴支|阳支/u);
  }
});
