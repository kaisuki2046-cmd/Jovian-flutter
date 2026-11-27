import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createContentScorer } from './content-specificity.mjs';
import { conditionStrength, sourceCredibility } from './evidence-scores.mjs';
import { percentileScale } from './score-percentiles.mjs';
import { selectSummaryEvidence, summaryDirection } from './select-summary-evidence.mjs';

const types = ['family', 'friendship', 'romance', 'collaboration'];
const classic = { id: 'REF:BAZI:fixture', title: '三命通会' };
const predicate = (field, extra = {}) => ({ field, required: true, operator: 'eq', expected: '值', ...extra });
const proof = (direction, conditions = [], factId = 'same') => ({ direction, factId, conditions, exclusions: [] });
const entry = (id, proofs, extra = {}) => ({ id, source: { book: 'Test', locator: 'fixture' }, interpretation: String(id), proofs,
  scores: { condition: 50, content: 50, source: 50 }, ...extra });
const evidence = (sections) => ({ chartFacts: [], methods: [], ...Object.fromEntries(types.map((type) => [type, { basis: sections[type] ?? [] }])) });

test('calibrates tied observations at their rank midpoint and interpolates new values without changing their order', () => {
  const scale = percentileScale([20, 10, 0, 10, 0, 10]);
  assert.deepEqual([-1, 0, 5, 10, 20, 21].map(scale), [0, 0, 27.78, 55.56, 100, 100]);
  assert.equal(percentileScale([7, 7])(7), 50);
});

test('selects at most 40, 40 and 30 in each relationship without sharing unused quota', () => {
  const crowds = ['a_to_b', 'b_to_a', 'mutual', 'whole'].flatMap((direction, index) =>
    Array.from({ length: 55 }, (_, offset) => entry(index * 100 + offset + 1, [proof(direction)])));
  const raw = evidence(Object.fromEntries(types.map((type) => [type, crowds])));
  const selected = selectSummaryEvidence(raw);
  for (const type of types) {
    const groups = Object.groupBy(selected[type].basis, ({ proofs }) => summaryDirection(proofs));
    assert.deepEqual(Object.fromEntries(Object.entries(groups).map(([key, entries]) => [key, entries.length])),
      { a_to_b: 40, b_to_a: 40, common: 30 });
    assert.equal(new Set(selected[type].basis.map(({ id }) => id)).size, 110);
    assert.equal(raw[type].basis.length, 220);
  }
  assert.equal(types.reduce((total, type) => total + selected[type].basis.length, 0), 440);
  assert.equal(selected.chartFacts, raw.chartFacts);
  const sparse = selectSummaryEvidence(evidence({ family: crowds.slice(0, 55) }));
  assert.equal(sparse.family.basis.length, 40);
  assert.deepEqual(sparse.friendship.basis, []);
});

test('ranks substantive conditions first, then the configured credibility of the primary source', () => {
  const specific = [predicate('facts.planet'), predicate('facts.house')];
  const precise = entry(1, [proof('a_to_b', [...specific, predicate('facts.target')])]);
  const best = entry(2, [proof('a_to_b', specific)], { sourceRefs: [{ id: 'SOURCE-L0' }, classic] });
  const legacy = entry(3, [proof('a_to_b', specific)], { sourceRefs: [{ id: 'SOURCE-BAZI-CLASSIC' }] });
  const broad = entry(7, [proof('a_to_b', [predicate('facts.planet', { operator: 'in', expected: ['Sun', 'Moon', 'Venus'] })])],
    { sourceRefs: [classic] });
  const apparent = entry(6, [proof('a_to_b', [
    predicate('facts.planet'), predicate('facts.planet'), predicate('direction'), predicate('facts.optional', { required: false }),
    predicate('facts.source', { operator: 'exists' }), predicate('facts.target', { operator: 'exists' }),
  ])]);
  const cited = entry(4, [proof('a_to_b', specific)], { sourceRefs: [{ title: 'Tetrabiblos' }] });
  const unknown = { title: '未评级资料', author: '有署名', edition: '有版次', locator: '第 5 节', type: 'expert_review' };
  const supportingOnly = entry(5, [proof('a_to_b', specific)], { sourceRefs: [unknown, classic] });
  const entries = [broad, precise, apparent, best, legacy, cited, supportingOnly];
  const scale = percentileScale(entries.map(conditionStrength));
  const selected = selectSummaryEvidence(evidence({ romance: entries.map((item) => ({ ...item,
    scores: { condition: scale(conditionStrength(item)), content: 50, source: sourceCredibility(item.sourceRefs ?? []).score },
  })) }));
  assert.deepEqual(selected.romance.basis.map(({ id }) => id),
    [1, 2, 3, 4, 5, 6, 7]);
});

test('scores actionable specifics above vague repetition and orders content ahead of source on condition ties', () => {
  const vague = '可以多观察你们怎样沟通。';
  const specific = '遇到临时改约时，A 方提前告知新的联系时间，B 方写下无法参加的时段，再共同约定回执期限。';
  const scorer = createContentScorer([vague, specific, '各自说清自己的安排。', '项目交接时，列出负责交付的人员。', vague.repeat(8)]);
  assert.equal(scorer.evaluate(vague).score, scorer.evaluate(vague.repeat(8)).score);
  assert.ok(scorer.evaluate(specific).score > scorer.evaluate(vague).score);
  assert.ok(scorer.evaluate(specific).features.includes('数量与期限'));
  const forward = [proof('a_to_b')];
  const precise = entry(1, forward, { scores: { condition: 75, content: scorer.evaluate(specific).score, source: 0 } });
  const broad = entry(2, forward, { scores: { condition: 75, content: scorer.evaluate(vague).score, source: 100 } });
  const strict = entry(3, forward, { scores: { condition: 76, content: 0, source: 0 } });
  assert.deepEqual(selectSummaryEvidence(evidence({ friendship: [broad, precise, strict] })).friendship.basis.map(({ id }) => id), [strict.id, precise.id, broad.id]);
});

test('keeps every selected proof and assigns a mixed witness to only one direction', () => {
  const unilateral = entry(1, [proof('self_b'), proof('a_to_b', [], 'cross'), proof('mutual', [], 'pair')],
    { scores: { condition: 75, content: 50, source: 50 } });
  const twoDirections = entry(3, [proof('a_to_b'), proof('b_to_a', [], 'reverse')]);
  const twoNatal = entry(2, [proof('self_a'), proof('self_b', [], 'other')]);
  const oneNatal = entry(4, [proof('self_a')]);
  const adapter = entry(5, [proof('whole')], { source: undefined, variantId: 'ALG:western:fixture' });
  const chartCombination = entry(6, [proof('a_to_b'), proof('a_to_b', [], 'other')],
    { source: undefined, ruleId: 'fixture-combination' });
  const legacy = entry(7, [proof('whole')], { source: undefined });
  const duplicate = { ...unilateral, scores: { condition: 1, content: 1, source: 1 } };
  const reverse = entry(unilateral.id, [proof('b_to_a')]);
  const output = selectSummaryEvidence(evidence({
    family: [unilateral, twoDirections, twoNatal, oneNatal, adapter, chartCombination, legacy, duplicate, reverse],
  }));
  assert.equal(summaryDirection(unilateral.proofs), 'a_to_b');
  assert.equal(summaryDirection(twoDirections.proofs), 'common');
  assert.equal(summaryDirection(twoNatal.proofs), 'common');
  assert.deepEqual(output.family.basis.map(({ id, direction }) => [id, direction]),
    [[unilateral.id, 'a_to_b'], [reverse.id, 'b_to_a'], [twoNatal.id, 'common'], [twoDirections.id, 'common']]);
  assert.equal(output.family.basis[0].proofs, unilateral.proofs);
});
