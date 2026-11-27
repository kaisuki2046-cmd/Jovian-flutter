import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { calculateBaZi, chartFacts, chartVersions, describeBaZiPillars } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { qtbjWoodPassageProfile } from './bazi-literal-passages.mjs';
import { claimChartContext, compileClaimSources, explainClaim } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-39-witnesses.json', import.meta.url), 'utf8'));
const ids = {
  ziJia: 'qtbj-v2-c008-p005-001', chouJia: 'qtbj-v2-c008-p009-001',
  summerYi: 'qtbj-v2-c011-p001-001', haiYi: 'qtbj-v2-c014-p001-001', ziYi: 'qtbj-v2-c014-p009-001',
};
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion, confirmedFacts });
const catalog = catalogForDirectory();
const reportLookup = createReportLookup();

function rawFromDate(birthTime) {
  const instant = Date.parse(birthTime);
  return chartFacts.bazi(calculateBaZi(instant, instant + 8 * 3600000));
}

function rawFromPillars(year, month, day, hour) {
  return chartFacts.bazi(describeBaZiPillars({ year, month, day, hour }));
}

function matchedTexts(id, facts, timeKnown = true) {
  const [parsed] = parseChartQueries([query(facts)], { timeKnown });
  return lookupInterpretations(catalogDirectory, parsed).find(hit => hit.id === id)?.matchedBranches.map(branch => branch.text) ?? [];
}

test('all 89 new alternatives reach SQLite, explanation and report from native BaZi charts', () => {
  const rows = new Map(Object.values(ids).map(id => [id, catalog.get(id)]));
  const expected = new Set([...rows].flatMap(([id, row]) => {
    assert.equal(row.inputs, undefined);
    return row.branches.flatMap(branch => {
      assert.equal(branch.conditionCompiler, qtbjWoodPassageProfile);
      assert.ok(row.claim.evidence.original_text.includes(branch.text));
      return branch.inputs.map(input => [id, branch.text, digest(input)].join(':'));
    });
  }));
  assert.equal(expected.size, 89);
  assert.equal(alternatives, expected.size);
  assert.equal([...rows.values()].reduce((total, row) => total + row.branches.length, 0), 8);
  const proved = new Set();
  for (const witness of witnesses) {
    const raw = rawFromDate(witness.birthTime);
    assert.deepEqual(raw.filter(fact => fact.kind === 'pillar').map(fact => fact.ganZhi), witness.pillars);
    const parsed = parseChartQueries([query(raw)]);
    assert.ok(parsed);
    const chart = chartContext('bazi', parsed[0].confirmedFacts);
    const calculated = claimChartContext('bazi', chart);
    const references = reportLookup(parsed);
    const hits = references.flatMap(reference => [...reference.personality, ...reference.events]);
    const materials = buildReportMaterials(references);
    for (const { id, text, digest: inputDigest } of witness.proofs) {
      const branch = rows.get(id).branches.find(branch => branch.text === text);
      const input = branch.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', calculated).matched, true);
      assert.ok(hits.find(hit => hit.id === id)?.matchedBranches.some(branch => branch.text === text), id);
      assert.ok(explainClaim(id, 'bazi', chart, undefined, catalog).matchedBranches.some(branch => branch.text === text));
      assert.ok(materials.includes(text));
      proved.add([id, text, inputDigest].join(':'));
    }
  }
  assert.deepEqual(proved, expected);
});

test('month, hidden stems, both branches and verified stem absences gate the correct independent clauses', () => {
  const [zi, chou] = [ids.ziJia, ids.chouJia];
  const exact = rawFromPillars('辛巳', '庚子', '甲寅', '丁卯');
  assert.equal(matchedTexts(zi, exact).length, 1);
  assert.deepEqual(matchedTexts(zi, exact, false), []);
  assert.deepEqual(matchedTexts(zi, rawFromPillars('辛未', '庚子', '甲寅', '丁卯')), []);
  assert.deepEqual(matchedTexts(zi, rawFromPillars('辛巳', '庚子', '甲辰', '丁卯')), []);
  assert.deepEqual(matchedTexts(chou, rawFromPillars('己亥', '丁丑', '甲申', '庚午')), ['庚丁两透，科甲恩封。']);
  assert.deepEqual(matchedTexts(chou, rawFromPillars('庚子', '己丑', '甲申', '庚午')), ['庚透丁藏，小贵。']);
  const hiddenGeng = rawFromPillars('己亥', '丁丑', '甲申', '甲子');
  assert.deepEqual(matchedTexts(chou, hiddenGeng), ['丁透庚藏，小富贵。']);
  assert.deepEqual(matchedTexts(chou, hiddenGeng, false), []);
  assert.deepEqual(matchedTexts(chou, rawFromPillars('己亥', '丁丑', '甲子', '甲子')), []);
  assert.equal(matchedTexts(ids.ziYi, rawFromPillars('己亥', '丙子', '乙亥', '丁丑')).length, 1);
  assert.deepEqual(matchedTexts(ids.ziYi, rawFromPillars('己亥', '丙子', '乙亥', '癸未')), []);
  assert.deepEqual(matchedTexts(ids.ziYi, rawFromPillars('己亥', '丙子', '乙亥', '丙子')), []);
  assert.deepEqual(matchedTexts(ids.summerYi, rawFromPillars('庚子', '癸未', '乙亥', '丙子')), []);
});

test('the model receives only the matched verbatim clauses', async () => {
  for (const [id, counts, expected] of [
    [ids.chouJia, 1, ['庚丁两透，科甲恩封。']],
    [ids.summerYi, 2, ['先得丙透，支下又有丙火，名曰木秀火明', '得一癸透，科甲中人。']],
    [ids.haiYi, 1, ['丙戊两透，科甲定然。']],
  ]) {
    const witness = witnesses.find(w => w.proofs.filter(p => p.id === id).length === counts
      && expected[0].startsWith(w.proofs.find(p => p.id === id).text));
    assert.ok(witness);
    const chartQueries = parseChartQueries([query(rawFromDate(witness.birthTime))]);
    const lookup = queries => reportLookup(queries).map(reference => ({
      ...reference, personality: reference.personality.filter(hit => hit.id === id), events: reference.events.filter(hit => hit.id === id),
    }));
    const { report } = await generateReport({ chartQueries }, {
      lookup, signal: new AbortController().signal,
      complete: async ({ materials, promptMaterials }) => {
        const passages = promptMaterials.split('\n').filter(line => line.startsWith('原文：'));
        assert.deepEqual([...new Set(passages)].sort(), expected.map(text => '原文：' + text).sort());
        assert.match(materials, /缺柱不能证明未透/u);
        assert.doesNotMatch(promptMaterials, /缺柱不能证明未透/u);
        return '测试报告';
      },
    });
    assert.equal(report, '测试报告');
  }
});

test('source or exclusion edits invalidate the reviewed mappings before any passage can match', context => {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch39-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const method of ['ziwei', 'western']) writeFileSync(join(directory, method + '.json'), '[]');
  writeFileSync(join(directory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const original = Object.values(ids).map(id => catalog.get(id).claim);
  const updated = structuredClone(original);
  updated[0].conditions.excluded.push('未知附加前提');
  updated[1].evidence.context += '拟修订';
  updated[2].conditions.normalized.push('未知附加前提');
  updated[3].source.section = '异本';
  updated[4].evidence.original_text += '异文';
  writeFileSync(join(directory, 'bazi.json'), JSON.stringify(updated));
  for (const row of compileClaimSources(directory)) {
    assert.equal(row.reason, 'source_review_required');
    assert.equal(row.inputs, undefined);
    assert.deepEqual(row.branches, []);
  }
});
