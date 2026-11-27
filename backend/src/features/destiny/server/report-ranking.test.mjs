import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reportTopics } from './knowledge/topics.mjs';
import { ptolemyTermProfile } from './knowledge/ptolemy-terms.mjs';
import { generateReport, selectPromptMaterials } from './report.mjs';
import { collectReportMaterials, renderReportMaterials } from './report-materials.mjs';
import { rawReportScores, reportEvidenceKey, selectReportMaterials } from './report-ranking.mjs';
import calibration from './report-ranking-calibration.json' with { type: 'json' };

const pillars = [
  { kind: 'pillar', position: 'day', ganZhi: '甲辰' },
  { kind: 'pillar', position: 'hour', ganZhi: '乙丑' },
  { kind: 'pillar', position: 'year', ganZhi: '丙寅' },
  { kind: 'pillar', position: 'month', ganZhi: '庚寅' },
];
const books = {
  classic: { book: '三命通会', edition: '测试校本' },
  other: { book: '渊海子平', edition: '测试校本' },
};
const evidence = (id, required, reading, source = books.other) => ({
  id, kind: 'rule', conditions: { required }, source, originalText: '测试原句', modernInterpretation: reading,
});
const overall = entries => [{ topicId: 'overall', topic: '综合', entries }];
const emptyReport = Object.entries(reportTopics).map(([topicId, topic]) => ({ topicId, topic, personality: [], events: [] }));
const signal = () => new AbortController().signal;

test('ranks condition strictness first, concrete content second, and source credibility third', () => {
  const entries = [
    evidence('exact', pillars, '诸事平顺'),
    evidence('concrete-classic', pillars.slice(0, 2), '婚后可能迁居，再换工作。', books.classic),
    evidence('concrete-other', pillars.slice(0, 2), '婚后可能迁居，再换工作。'),
    evidence('abstract-classic', pillars.slice(0, 2), '诸事平顺', books.classic),
  ];
  const selected = selectReportMaterials(overall(entries.toReversed()), calibration)[0].entries;
  assert.deepEqual(selected.map(row => row.id), entries.map(row => row.id));
  assert.equal(selected[1].scores[2], 100);
  assert.ok(selected.every(row => row.scores.length === 3 && row.scores.every(score => score >= 0 && score <= 100)));
});

test('ranks rare observed hits ahead of common hits with the same proof and accounts for alternative routes', () => {
  const common = evidence('common', pillars.slice(0, 2), '');
  const rare = evidence('rare', common.conditions.required, '');
  const sampled = { sampleSize: 96, hits: { [reportEvidenceKey(common)]: 40, [reportEvidenceKey(rare)]: 2 } };
  assert.deepEqual(selectReportMaterials(overall([common, rare]), sampled)[0].entries.map(row => row.id), ['rare', 'common']);
  const proof = { required: [pillars[0]], alternatives: [[pillars[1]]] };
  const strict = rawReportScores({ ...rare, conditions: proof })[0];
  const broad = rawReportScores({ ...rare, conditions: { ...proof, alternatives: [[pillars[1]], [pillars[2]]] } })[0];
  assert.ok(strict > broad);
  assert.equal(rawReportScores({ ...rare, conditions: { ...proof, alternatives: [[pillars[1]], [pillars[1]]] } })[0], strict);
});

test('takes the top forty of each theme without moving unused slots and deduplicates before the limit', () => {
  const blocks = emptyReport.map(({ topicId, topic }, group) => ({ topicId, topic,
    entries: Array.from({ length: group ? 47 : 4 }, (_, index) =>
      evidence(`${topicId}-${String(index).padStart(2, '0')}`, pillars, '可能转学')),
  }));
  blocks[0].entries.push({ ...blocks[0].entries[0] });
  const ranked = selectReportMaterials(blocks, calibration);
  assert.deepEqual(ranked.map(({ topic, entries }) => [topic, entries.length]), [
    ['综合', 4], ['事业', 40], ['爱情', 40], ['学业', 40], ['财富', 40],
  ]);
  for (const { topicId, entries } of ranked.slice(1)) {
    assert.equal(entries.at(-1).id, topicId + '-39');
  }
});

test('actual report assembly budgets each matched branch, shares slots with auxiliary evidence, and preserves the Tieban response', async () => {
  const references = emptyReport.map((section, index) => {
    const claim = {
      id: 'branch-' + index, title: '分句测试', source: books.classic,
      category: { topic: section.topic, type: '事件', tags: [] },
      evidence: { original_text: '完整文段', context: '完整上下文' },
      interpretation: { classical_meaning: '整条解读', limitations: [] },
    };
    const matchedBranches = Array.from({ length: 44 }, (_, branch) => ({
      text: `${section.topic}分句${String(branch).padStart(2, '0')}`,
      modernInterpretation: '在所列组合下可能换工作。',
      matchedConditions: { required: pillars, absent: [], alternatives: [], relations: [], measurements: [] },
    }));
    return { ...section, events: [{ id: claim.id, topic: section.topic, method: 'bazi', layer: 'events',
      claim, matchScope: 'passage_branch', matchedConditions: matchedBranches[0].matchedConditions, matchedBranches }] };
  });
  const iron = { id: 'test-tieban', category: { topic: '综合' }, source: { book: '铁板神数' },
    evidence: { original_text: '编号原文' }, interpretation: { classical_meaning: '编号释义', limitations: [] } };
  references[0].tieban = { profile: 'test-tieban-profile', libraryEdition: 'muxuan-json',
    results: [{ axis: 'earlier', clauseId: 1, status: 'matched', claim: iron }] };
  references[0].caseReferences = [{
    id: 'case', matchedConditions: { required: [...pillars, { kind: 'natal_gender', gender: '男' }] },
    reportEvidence: { source: books.classic, originalText: '古籍命例原文', modernInterpretation: '比对用途' },
  }];
  const row = { role: 'term_ruler_lookup', profile: ptolemyTermProfile, planet: 'Sun', sign: '白羊座', degree: 2,
    system: 'egyptian_common', ruler: 'Mars', start: 0, end: 5,
    reportEvidence: [{ id: 'table-row', source: { book: 'Tetrabiblos' }, originalText: '计算表原文', modernInterpretation: '计算表释义' }] };
  references[0].calculationReferences = [row];
  const pool = collectReportMaterials(references, { combineAliases: false });
  assert.ok(['case', 'tieban', 'calculation', 'lookup'].every(kind => pool[0].entries.some(entry => entry.kind === kind)));
  const selected = selectPromptMaterials(references);
  assert.deepEqual(selected.map(({ entries }) => entries.length), [40, 40, 40, 40, 40]);
  assert.ok(selected[0].entries.some(entry => entry.kind === 'case'));
  const expected = renderReportMaterials(selected);
  const result = await generateReport({ chartQueries: [] }, { lookup: () => references, signal: signal(),
    complete: async ({ promptMaterials: materials, references: filtered }) => {
      assert.equal(materials, expected);
      assert.equal([...materials.matchAll(/^原文：/gmu)].length, 200);
      assert.match(materials, /^原文：古籍命例原文$/mu);
      assert.doesNotMatch(materials, /编号原文|计算表原文|界主查表结果|整条解读|完整上下文|^出处：/mu);
      assert.equal(filtered[0].events[0].matchedBranches.length, 39);
      assert.equal(filtered[0].caseReferences.length, 1);
      return '测试报告';
    } });
  assert.equal(result.tieban.results[0].claimId, iron.id);
  assert.ok(references.every(section => section.events[0].matchedBranches.length === 44));
});

test('the committed calibration contains distinct frequencies and all three empirical distributions', () => {
  assert.equal(calibration.sampleSize, 96);
  const frequencies = Object.values(calibration.hits);
  assert.ok(frequencies.length > 1000 && frequencies.some(count => count === 1) && frequencies.some(count => count >= 48));
  assert.ok(frequencies.every(count => Number.isInteger(count) && count > 0 && count <= calibration.sampleSize));
  assert.equal(calibration.distributions.length, 3);
  const sizes = calibration.distributions.map(rows => {
    assert.ok(rows.length > 8);
    assert.ok(rows.every(([score, count], index) => Number.isFinite(score) && count > 0 && (!index || rows[index - 1][0] < score)));
    return rows.reduce((total, [, count]) => total + count, 0);
  });
  assert.ok(sizes[0] > frequencies.length);
  assert.deepEqual(sizes.slice(1), [frequencies.length, frequencies.length]);
});
