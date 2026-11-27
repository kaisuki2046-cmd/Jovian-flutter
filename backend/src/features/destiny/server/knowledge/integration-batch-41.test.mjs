import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { Lunar } from 'lunar-javascript';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport } from '../report.mjs';
import { claimChartContext, compileClaimSources, explainClaim } from './claims.mjs';
import { catalogDirectory, catalogForDirectory, lookupInterpretations } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup, parseChartQueries } from './report-lookup.mjs';
import { quanshuPalaceTextProfile } from './ziwei-source-passages.mjs';

const { witnesses, alternatives } = JSON.parse(readFileSync(new URL('./claims/integration-batch-41-witnesses.json', import.meta.url), 'utf8'));
const ids = [
  'ziwei-v2-c008-p101001-001', 'ziwei-v2-c005-p101018-001', 'ziwei-v2-guanlugong-p101011-001',
  'ziwei-v2-guanlugong-p101016-001', 'ziwei-v2-guanlugong-p101020-001', 'ziwei-v2-guanlugong-p101021-001',
  'ziwei-v2-guanlugong-p107000-001',
];
const impossibleId = 'ziwei-v2-guanlugong-p004-001';
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const query = confirmedFacts => ({ method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts });
const catalog = catalogForDirectory();
const reportLookup = createReportLookup();
const native = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));
const witnessFor = id => witnesses.find(witness => witness.proofs.some(proof => proof.id === id));

function find(id, facts) {
  return lookupInterpretations(catalogDirectory, query(facts)).find(hit => hit.id === id);
}

test('all seven source texts reach SQLite, explanation and report from eight proved alternatives', () => {
  const rows = new Map(ids.map(id => [id, catalog.get(id)]));
  const expected = new Set([...rows].flatMap(([id, row]) => {
    assert.equal(row.compiler, quanshuPalaceTextProfile);
    assert.deepEqual(row.branches, []);
    return row.inputs.map(input => id + ':' + digest(input));
  }));
  assert.equal(expected.size, 8);
  assert.equal(alternatives, expected.size);
  const seen = new Set();
  for (const witness of witnesses) {
    const parsed = parseChartQueries([query(native(witness))]);
    assert.ok(parsed);
    const chart = chartContext('ziwei', parsed[0].confirmedFacts);
    const calculated = claimChartContext('ziwei', chart);
    const references = reportLookup(parsed);
    const hits = references.flatMap(reference => [...reference.personality, ...reference.events]);
    const materials = buildReportMaterials(references);
    for (const { id, inputDigest } of witness.proofs) {
      const row = rows.get(id);
      const input = row.inputs.find(input => digest(input) === inputDigest);
      assert.ok(input);
      assert.equal(evaluateRule(input, 'natal', calculated).matched, true);
      assert.ok(hits.some(hit => hit.id === id), id);
      assert.equal(explainClaim(id, 'ziwei', chart, undefined, catalog).matched, true);
      assert.ok(materials.includes(row.claim.evidence.original_text));
      seen.add(id + ':' + inputDigest);
    }
  }
  assert.deepEqual(seen, expected);
});

test('required stars, brightness and verified absences remain bound to the stated natal palace', () => {
  const [travel, children, giant] = ids;
  const travelFacts = native(witnessFor(travel));
  assert.ok(find(travel, travelFacts));
  for (const star of ['紫微', '左辅', '右弼']) {
    const misplaced = travelFacts.map(fact => fact.kind === 'palace_star' && fact.palace === '迁移' && fact.star === star
      ? { ...fact, palace: '命宫' } : fact);
    assert.equal(find(travel, misplaced), undefined);
  }
  const giantFacts = native(witnessFor(giant));
  const mismatch = giantFacts.map(fact => fact.kind === 'palace_brightness' && fact.palace === '官禄' && fact.star === '巨门'
    ? { ...fact, palace: '命宫' } : fact);
  assert.equal(find(giant, mismatch), undefined);
  const [unknownTime] = parseChartQueries([query(giantFacts)], { timeKnown: false });
  assert.ok(!lookupInterpretations(catalogDirectory, unknownTime).some(hit => hit.id === giant));

  const childrenFacts = native(witnessFor(children));
  const four = ['擎羊', '陀罗', '火星', '铃星'];
  assert.ok(four.every(star => childrenFacts.some(fact => fact.kind === 'palace_star' && fact.star === star && fact.palace !== '子女')));
  const hit = find(children, childrenFacts);
  assert.deepEqual(hit.matchedConditions.absent.map(fact => fact.star).sort(), [...four].sort());
  assert.equal(find(children, childrenFacts.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '子女')), undefined);
  for (const star of four) {
    const changed = childrenFacts.map(fact => fact.palace === '子女' && fact.kind === 'palace_origin_star_count'
      ? { ...fact, count: fact.count + 1 } : fact);
    changed.push({ kind: 'palace_star', palace: '子女', star, scope: 'origin' });
    assert.equal(find(children, changed), undefined);
  }
});

test('with all four assistants and literary stars together, neither possible palace is career in the default layout', () => {
  const dates = [...Array.from({ length: 12 }, (_, i) => Lunar.fromYmd(2001, i + 1, 15)),
    Lunar.fromYmd(2020, -4, 10), Lunar.fromYmd(2020, -4, 20)];
  const combinedBranches = new Set();
  for (const lunar of dates) {
    const solar = lunar.getSolar();
    const date = { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() };
    for (let timeIndex = 0; timeIndex <= 12; timeIndex++) {
      const facts = native({ profile: { date, gender: 'female' }, timeIndex });
      const together = ['文昌', '文曲', '左辅', '右弼'].map(star => facts.find(fact => fact.kind === 'palace_star' && fact.star === star).palace);
      if (new Set(together).size !== 1) continue;
      const branchAt = palace => facts.find(fact => fact.kind === 'palace_branch' && fact.palace === palace).branch;
      combinedBranches.add(branchAt(together[0]));
      assert.equal(branchAt('命宫'), '寅');
      assert.equal(branchAt('官禄'), '午');
      assert.notEqual(together[0], '官禄');
    }
  }
  assert.deepEqual(combinedBranches, new Set(['丑', '未']));
  assert.equal(catalog.get(impossibleId), null);
});

test('report materials preserve the selected edition and changed source conditions stop compilation', async context => {
  const id = ids[1];
  const row = catalog.get(id);
  const chartQueries = parseChartQueries([query(native(witnessFor(id)))]);
  const lookup = queries => reportLookup(queries).map(reference => ({
    ...reference, personality: reference.personality.filter(hit => hit.id === id),
    events: reference.events.filter(hit => hit.id === id),
  }));
  const { report } = await generateReport({ chartQueries }, {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.ok(materials.includes(row.claim.evidence.original_text));
      assert.doesNotMatch(materials, /有杀先招祀子/u);
      assert.match(materials, /子息数等只作古籍取象/u);
      return '卷二测试报告';
    },
  });
  assert.equal(report, '卷二测试报告');

  const directory = mkdtempSync(join(tmpdir(), 'destiny-batch41-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  for (const method of ['bazi', 'western']) writeFileSync(join(directory, method + '.json'), '[]');
  writeFileSync(join(directory, 'upgrade-manifest.json'), JSON.stringify({ changedConditionIds: {}, changedEvidenceIds: {} }));
  const edited = ids.map((id, index) => {
    const claim = structuredClone(catalog.get(id).claim);
    if (index % 2) claim.conditions.uncertain.push('新版待核');
    else claim.evidence.context += '异本';
    return claim;
  });
  writeFileSync(join(directory, 'ziwei.json'), JSON.stringify(edited));
  for (const row of compileClaimSources(directory)) {
    assert.equal(row.reason, 'source_review_required');
    assert.equal(row.inputs, undefined);
    assert.deepEqual(row.branches, []);
  }
});
