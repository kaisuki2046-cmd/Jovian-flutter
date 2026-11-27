import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { calculateBaZi, calculateWestern, calculateZiwei, chartFacts, chartVersions, ziweiTimeIndex } from '../../control/charts.ts';
import { createDeepSeek, generateReport, parseInput, selectPromptMaterials } from '../report.mjs';
import { createClaimsCatalog, explainClaim, lookupWesternHistoricalCases } from './claims.mjs';
import { claimSourceDirectory, openKnowledgeReadDatabase } from './claims-sqlite.mjs';
import { lillyMerchantPrintedChartFacts } from './lilly-merchant-case.mjs';
import { chartContext } from './matching.mjs';
import { createReportLookup } from './report-lookup.mjs';

function temporary(context) {
  const directory = mkdtempSync(join(tmpdir(), 'destiny-unified-source-'));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

test('unified alternatives and status control the real lookup and the outbound evidence', async context => {
  const directory = temporary(context);
  const sourceDirectory = join(directory, 'sources');
  mkdirSync(sourceDirectory);
  const write = (name, value) => writeFileSync(join(sourceDirectory, name), JSON.stringify(value));
  for (const method of ['bazi', 'ziwei', 'western']) write(method + '.json', []);
  write('upgrade-manifest.json', { changedConditionIds: {}, changedEvidenceIds: {} });
  copyFileSync(join(claimSourceDirectory, 'report-knowledge.schema.json'), join(sourceDirectory, 'report-knowledge.schema.json'));

  const query = { method: 'bazi', rulesetVersion: chartVersions.bazi.rulesetVersion };
  const day = { kind: 'pillar', position: 'day', ganZhi: '甲子' };
  const year = { kind: 'pillar', position: 'year', ganZhi: '丙寅' };
  const anotherYear = { kind: 'pillar', position: 'year', ganZhi: '戊辰' };
  const month = { kind: 'pillar', position: 'month', ganZhi: '庚寅' };
  const entry = (id, originalText, modernInterpretation, requiredYear) => ({
    id, source: { book: '对照书名', locator: '第一卷', url: null },
    category: { method: 'bazi', topic: '事业', contentType: 'fact' },
    originalText, modernInterpretation,
    matchConditions: { status: true, original: ['仅本地条件原句'], formatted: {
      kind: 'chart', chartScope: 'natal', rulesetVersion: query.rulesetVersion, tradition: '对照书名',
      commonRequired: [day], alternatives: [{ input: { required: [requiredYear] } }],
    } },
  });
  const inactive = entry(3, '已停用原文', '已停用解读', year);
  inactive.matchConditions = { status: false, original: [], formatted: { kind: 'skipped', reason: 'user_requested_skip', alternatives: [] } };
  const records = [
    entry(1, '只在甲组命中的原文', '甲组释义', year),
    entry(2, '另一分句不应混入', '乙组释义', anotherYear),
    inactive,
    entry(4, null, '独立现代解读', year),
    entry(5, null, null, year),
  ];
  records[0].matchConditions.formatted.alternatives.push({ input: { required: [month] } }, { input: { required: [anotherYear] } });
  write('report-knowledge-ids.json', { 'fixture#first': 1, 'fixture#second': 2, 'fixture#disabled': 3, 'modern-only': 4, 'proof-only': 5 });
  write('report-knowledge.json', records);

  const catalog = createClaimsCatalog({ directory, sourceDirectory });
  const lookup = createReportLookup(directory, catalog);
  const input = parseInput({ timeKnown: true, chartQueries: [{ ...query, confirmedFacts: [day, year, month] }] });
  const evidence = lookup(input.chartQueries).flatMap(topic => topic.events).flatMap(rule =>
    rule.matchedBranches?.map(branch => branch.promptEvidence.knowledgeId) ?? [rule.promptEvidence.knowledgeId]);
  assert.deepEqual(evidence.sort(), [1, 4, 5]);
  assert.deepEqual(catalog.get(2).branches.map(branch => branch.promptEvidence.knowledgeId), [2]);
  assert.deepEqual(catalog.get(3).branches, []);
  assert.equal(catalog.get(3).reason, 'report_knowledge_disabled');
  const withOnlyOneRequiredFact = parseInput({ timeKnown: true, chartQueries: [{ ...query, confirmedFacts: [year] }] });
  assert.ok(lookup(withOnlyOneRequiredFact.chartQueries).every(topic => !topic.events.length));

  let request;
  const complete = createDeepSeek({ apiKey: 'test-only', transport: async (_, options) => {
    request = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: '测试报告' } }] });
  } });
  assert.deepEqual(await generateReport(input, { lookup, complete, signal: new AbortController().signal }), { report: '测试报告' });
  const prompt = request.messages[1].content;
  assert.match(prompt, /^原文：只在甲组命中的原文$/mu);
  assert.match(prompt, /^现代解读：独立现代解读$/mu);
  assert.match(prompt, /^命中条件：[^\n]*甲子[^\n]* 或 [^\n]*甲子[^\n]*$/mu);
  assert.match(prompt, /命中条件：[^\n]*丙寅[^\n]* 或 [^\n]*庚寅/u);
  assert.doesNotMatch(prompt, /另一分句|已停用|仅本地条件原句|对照书名|戊辰|原文：null|使用边界/u);

  records[0].matchConditions.formatted.alternatives = [{ input: { required: [anotherYear] } }];
  write('report-knowledge.json', records);
  assert.ok(!selectPromptMaterials(lookup(input.chartQueries)).flatMap(topic => topic.entries).some(material => material.knowledgeId === 1));
});

function natalInput({ year, month, day, hour, minute, gender, place }) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const instant = wall - place.offset * 3_600_000;
  const western = calculateWestern(instant, place);
  const genderFact = { kind: 'natal_gender', gender: gender === 'male' ? '男' : '女' };
  const daylight = western.sect ? [{ kind: 'natal_daylight', sect: western.sect }] : [];
  const facts = {
    bazi: [...chartFacts.bazi(calculateBaZi(instant, wall, gender)), ...daylight, genderFact],
    ziwei: [...chartFacts.ziwei(calculateZiwei({ date: { year, month, day },
      time: { timeKnown: true, hour, minute }, place, gender }, ziweiTimeIndex(wall))), ...daylight],
    western: [...chartFacts.western(western), genderFact],
  };
  const input = parseInput({ timeKnown: true, chartQueries: Object.entries(facts).map(([method, confirmedFacts]) => ({
    method, confirmedFacts, rulesetVersion: chartVersions[method].rulesetVersion, ...(method === 'bazi' && { birthYear: year }),
  })) });
  assert.ok(input);
  return input;
}

test('all active IDs are indexed and three native charts preserve lookup across all methods', context => {
  const directory = temporary(context);
  const priorDirectory = join(directory, 'prior');
  const targetDirectory = join(directory, 'target');
  const prior = createReportLookup(priorDirectory, createClaimsCatalog({ directory: priorDirectory, useReportKnowledge: false }));
  const targetCatalog = createClaimsCatalog({ directory: targetDirectory });
  const target = createReportLookup(targetDirectory, targetCatalog);
  const samples = [
    { year: 1988, month: 4, day: 11, hour: 10, minute: 25, gender: 'male', place: { latitude: 39.9042, longitude: 116.4074, offset: 8 } },
    { year: 1996, month: 9, day: 23, hour: 16, minute: 18, gender: 'female', place: { latitude: 35.6762, longitude: 139.6503, offset: 9 } },
    { year: 2002, month: 12, day: 7, hour: 7, minute: 45, gender: 'male', place: { latitude: -33.8688, longitude: 151.2093, offset: 11 } },
  ];
  const methods = new Set();
  const matchedIds = sections => sections.map(({ topicId, personality, events, caseReferences = [] }) => ({
    topicId, rules: [...new Set([...personality, ...events].map(rule => rule.id))].sort(),
    cases: caseReferences.map(row => row.id).sort(),
  }));
  const calculations = sections => sections[0].tieban?.additionalCalculations.map(({ profile, results }) =>
    [profile, results.map(({ clauseId, status, reason, claim }) => [clauseId, status, reason, claim?.id])]);
  for (const sample of samples) {
    const { chartQueries } = natalInput(sample);
    const newResult = target(chartQueries);
    const oldResult = prior(chartQueries);
    assert.deepEqual(matchedIds(newResult), matchedIds(oldResult));
    assert.deepEqual(calculations(newResult), calculations(oldResult));
    assert.deepEqual(newResult[0].calculationReferences, oldResult[0].calculationReferences);
    const selected = selectPromptMaterials(newResult).flatMap(section => section.entries);
    assert.ok(selected.length && selected.every(entry => Number.isSafeInteger(entry.knowledgeId)));
    for (const section of newResult) for (const rule of [...section.personality, ...section.events]) methods.add(rule.method);
  }
  assert.deepEqual([...methods].sort(), ['bazi', 'western', 'ziwei']);
  const merchantChart = chartContext('western', lillyMerchantPrintedChartFacts());
  const withComparison = lookupWesternHistoricalCases(merchantChart, 'Christian Astrology', targetCatalog)
    .find(result => result.comparisonNote);
  assert.ok(withComparison?.promptEvidence.knowledgeId);
  assert.deepEqual(
    explainClaim(withComparison.promptEvidence.knowledgeId, 'western', merchantChart, 'Christian Astrology', targetCatalog),
    explainClaim(withComparison.id, 'western', merchantChart, 'Christian Astrology', targetCatalog),
  );

  const db = openKnowledgeReadDatabase(join(targetDirectory, 'destiny-knowledge.sqlite'));
  try {
    const indexed = db.prepare(`WITH represented(id) AS (
      SELECT json_extract(metadata_json, '$.promptEvidence.knowledgeId') FROM claim_entry
      UNION SELECT json_extract(branch_json, '$.promptEvidence.knowledgeId') FROM claim_branch
      UNION SELECT json_extract(details_json, '$.promptEvidence.knowledgeId') FROM rule_provenance
    )
    SELECT count(*) AS entries, sum(enabled) AS active,
      sum((represented.id IS NOT NULL) != enabled) AS differences
    FROM report_knowledge_id LEFT JOIN represented USING (id)`).get();
    assert.deepEqual({ ...indexed }, { entries: 14660, active: 14660, differences: 0 });
    const deleted = [
      [8842, 'tbss-v1-clauses-p01012-001'],
      [9284, 'tbss-v10-clauses-p10095-001'],
      [14813, 'tbss14-v1-clauses-p01238-001'],
    ];
    const source = db.prepare('SELECT id FROM claim_entry WHERE id = ?');
    const alias = db.prepare('SELECT id FROM report_knowledge_id WHERE id = ?');
    const number = db.prepare('SELECT clause_id FROM tieban_clause_number WHERE claim_id = ?');
    for (const [id, sourceId] of deleted) {
      assert.equal(source.get(sourceId), undefined);
      assert.equal(alias.get(id), undefined);
      assert.equal(number.get(sourceId), undefined);
      assert.equal(targetCatalog.get(String(id)), null);
    }
    assert.equal(db.prepare("SELECT count(*) AS n FROM tieban_clause_number WHERE library_edition <> 'muxuan-json'").get().n, 0);
  } finally { db.close(); }
});
