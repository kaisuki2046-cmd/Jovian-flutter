import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { calculateZiwei, chartFacts, chartVersions } from '../../control/charts.ts';
import { buildReportMaterials } from '../report-materials.mjs';
import { generateReport, parseInput } from '../report.mjs';
import { claimChartContext, explainClaim } from './claims.mjs';
import { catalogForDirectory } from './database.mjs';
import { chartContext, evaluateRule } from './matching.mjs';
import { createReportLookup } from './report-lookup.mjs';
import { compileJielanPalacePassages, jielanPalacePassageProfile } from './ziwei-source-passages.mjs';

const fixture = JSON.parse(readFileSync(new URL('./claims/integration-batch-88-witnesses.json', import.meta.url), 'utf8'));
const directory = mkdtempSync(join(tmpdir(), 'destiny-jielan-companions-'));
const catalog = catalogForDirectory(directory), lookup = createReportLookup(directory);
after(() => rmSync(directory, { recursive: true, force: true }));
const prefix = 'ziwei-v2-jielan-101-p';
const digest = input => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const key = ({ id, text, inputDigest }) => JSON.stringify([id, text ?? null, inputDigest]);
const nativeFacts = ({ profile, timeIndex }) => chartFacts.ziwei(calculateZiwei(profile, timeIndex));

function inputFor(confirmedFacts, timeKnown = true) {
  const input = parseInput({ timeKnown, chartQueries: [{
    method: 'ziwei', rulesetVersion: chartVersions.ziwei.rulesetVersion, confirmedFacts,
  }] });
  assert.ok(input);
  return input;
}

const context = ([query]) => chartContext('ziwei', query.confirmedFacts, query.confirmedAbsentFacts, query.chartScope);
const explain = (id, facts, timeKnown = true) =>
  explainClaim(prefix + id, 'ziwei', context(inputFor(facts, timeKnown).chartQueries), undefined, catalog);
function witness(id, text) {
  const sample = fixture.witnesses.find(row => row.proofs.some(proof => proof.id === prefix + id && proof.text === text));
  assert.ok(sample, id);
  return nativeFacts(sample);
}

test('every reviewed condition group has a native witness through SQLite, individual explanation and report materials', () => {
  const expected = new Map();
  let wholeRecords = 0;
  for (const shortId of fixture.ids) {
    const id = prefix + shortId;
    const row = catalog.get(id);
    if (row.inputs) wholeRecords++;
    for (const { text, inputs, conditionCompiler } of row.inputs
      ? [{ inputs: row.inputs, conditionCompiler: row.compiler }] : row.branches) {
      assert.equal(conditionCompiler, jielanPalacePassageProfile, id);
      if (text) assert.ok(row.claim.evidence.original_text.includes(text), id);
      for (const input of inputs) expected.set(key({ id, text, inputDigest: digest(input) }), input);
    }
  }
  assert.equal(wholeRecords, fixture.wholeRecords);
  assert.equal(expected.size, fixture.conditionGroups);

  const seen = new Set();
  for (const sample of fixture.witnesses) {
    const parsed = inputFor(nativeFacts(sample));
    const chart = context(parsed.chartQueries), derived = claimChartContext('ziwei', chart);
    const refs = lookup(parsed.chartQueries);
    const matches = refs.flatMap(ref => [...ref.personality, ...ref.events]);
    const materials = buildReportMaterials(refs);
    for (const proof of sample.proofs) {
      const { id, text } = proof, expectedInput = expected.get(key(proof));
      assert.ok(expectedInput && evaluateRule(expectedInput, 'natal', derived).matched, id);
      const hit = matches.find(row => row.id === id), detail = explainClaim(id, 'ziwei', chart, undefined, catalog);
      assert.ok(hit && detail.matched, id);
      if (text) {
        assert.ok(hit.matchedBranches.some(branch => branch.text === text), id);
        assert.ok(detail.matchedBranches.some(branch => branch.text === text), id);
      }
      assert.ok(materials.includes(text ?? hit.claim.evidence.original_text), id);
      seen.add(key(proof));
    }
  }
  assert.deepEqual(seen, new Set(expected.keys()));
});

test('Jielan separates same-palace malefics, named sector companions and verified absence', () => {
  const fall = '陷地加杀，做事颠置，大事小成';
  const fallen = witness('010-003', fall);
  assert.deepEqual(explain('010-003', fallen).matchedBranches.map(branch => branch.text), [fall]);
  const fourMalefics = ['擎羊', '陀罗', '火星', '铃星'];
  const oppositeOnly = fallen.map(fact => fact.kind === 'palace_star' && fact.palace === '命宫' && fourMalefics.includes(fact.star)
    ? { ...fact, palace: '迁移' } : fact);
  assert.equal(explain('010-003', oppositeOnly).matched, false);
  assert.equal(explain('010-003', fallen, false).matched, false);

  const brother = witness('011-004', '值魁钺，主有贵兄弟');
  const missingYue = brother.filter(fact => fact.kind !== 'palace_star' || fact.star !== '天钺');
  assert.equal(explain('011-004', [...missingYue, { kind: 'palace_sector_star', palace: '兄弟', star: '天钺' }]).matched, false);

  const rightAssistant = witness('021-019', '无凶杀，吉');
  assert.equal(explain('021-019', rightAssistant).matched, true);
  const incomplete = rightAssistant.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '疾厄');
  const forged = { kind: 'palace_sector_malefic_count', palace: '父母', count: 0 };
  assert.equal(explain('021-019', [...incomplete, forged]).matched, false);

  const transformed = witness('021-009', '如化忌，主克');
  const otherHost = transformed.map(fact => fact.kind === 'star_mutagen' && fact.palace === '父母'
    && fact.star === '廉贞' && fact.change === '忌' ? { ...fact, star: '太阴' } : fact);
  assert.ok(explain('021-009', transformed).matchedBranches.some(branch => branch.text === '如化忌，主克'));
  assert.ok((explain('021-009', otherHost).matchedBranches ?? []).every(branch => branch.text !== '如化忌，主克'));
});

test('financial malefic counts require complete seats and the report sends only the matching sentence', async () => {
  const statement = '逢杀，先难后易';
  const wealth = witness('014-001', statement);
  assert.deepEqual(explain('014-001', wealth).matchedBranches.map(branch => branch.text), [statement]);
  const four = '加四杀，先易后难';
  const allFour = witness('014-001', four);
  assert.deepEqual(explain('014-001', allFour).matchedBranches.map(branch => branch.text), [four]);
  const incomplete = wealth.filter(fact => fact.kind !== 'palace_origin_star_count' || fact.palace !== '福德');
  assert.equal(explain('014-001', incomplete).matched, false);
  const result = await generateReport(inputFor(wealth), {
    lookup, signal: new AbortController().signal,
    complete: async ({ materials }) => {
      assert.match(materials, /逢杀，先难后易/u);
      assert.doesNotMatch(materials, /加四杀，先易后难/u);
      return '测试报告';
    },
  });
  assert.equal(result.report, '测试报告');
});

test('a reviewed passage cannot apply when its source wording changes', () => {
  const { claim } = catalog.get(prefix + '010-003');
  assert.equal(compileJielanPalacePassages({
    ...claim, evidence: { ...claim.evidence, original_text: claim.evidence.original_text.replace('巨门', '太阳') },
  }).reason, 'source_review_required');
});
