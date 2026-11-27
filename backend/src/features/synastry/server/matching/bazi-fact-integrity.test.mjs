import assert from 'node:assert/strict';
import test from 'node:test';
import { isConsistentBaziFact } from './bazi-fact-integrity.mjs';

test('BaZi ten-god labels agree with both heavenly stems and a known location', () => {
  const relative = { rule: 'relative-ten-god', direction: 'a_to_b',
    facts: { observed: '庚', reference: '甲', label: '七杀' } };
  assert.equal(isConsistentBaziFact(relative), true);
  assert.equal(isConsistentBaziFact({ ...relative, facts: { ...relative.facts, label: '正官' } }), false);
  assert.equal(isConsistentBaziFact({ ...relative, facts: { label: '七杀' } }), false);
  const pillar = { ...relative, rule: 'cross-pillar-ten-god',
    facts: { ...relative.facts, position: 'month', layer: 'hidden', rank: 1 } };
  assert.equal(isConsistentBaziFact(pillar), true);
  assert.equal(isConsistentBaziFact({ ...pillar, facts: { ...pillar.facts, rank: 0 } }), false);
});

test('BaZi stem and branch contacts reject incompatible geometry and direction', () => {
  const pair = { rule: 'branch-punishment', direction: 'a_to_b',
    facts: { aPosition: 'year', bPosition: 'month', aBranch: '寅', bBranch: '巳', kind: 'directed' } };
  assert.equal(isConsistentBaziFact(pair), true);
  assert.equal(isConsistentBaziFact({ ...pair, direction: 'b_to_a' }), false);
  assert.equal(isConsistentBaziFact({ ...pair, rule: 'branch-union', direction: 'mutual' }), false);
  const union = { ...pair, rule: 'branch-union', direction: 'mutual',
    facts: { aPosition: 'year', bPosition: 'month', aBranch: '寅', bBranch: '亥' } };
  assert.equal(isConsistentBaziFact(union), true);
  assert.equal(isConsistentBaziFact({ ...union, facts: { aPosition: 'year', bPosition: 'month' } }), false);

  const stem = { rule: 'stem-combination', direction: 'mutual',
    facts: { aStem: '己', bStem: '甲', pair: '甲己', combinationElement: '土', aPosition: 'day', bPosition: 'month' } };
  assert.equal(isConsistentBaziFact(stem), true);
  assert.equal(isConsistentBaziFact({ ...stem, facts: { ...stem.facts, bStem: '乙' } }), false);

  const elements = { rule: 'day-stem-elements', direction: 'a_to_b',
    facts: { aStem: '甲', bStem: '丁', relation: 1 } };
  assert.equal(isConsistentBaziFact(elements), true);
  assert.equal(isConsistentBaziFact({ ...elements, facts: { ...elements.facts, relation: 2 } }), false);
});

test('BaZi branch groups require every member and evidence from both sides', () => {
  const fact = { rule: 'branch-group', direction: 'mutual', facts: {
    kind: '三合', combination: '巳酉丑', element: '金', formation: 'cross_only',
    aBranches: '巳酉', aPositions: 'month,day', bBranches: '丑', bPositions: 'year',
  } };
  assert.equal(isConsistentBaziFact(fact), true);
  assert.equal(isConsistentBaziFact({ ...fact, facts: { ...fact.facts, bBranches: '酉' } }), false);
  assert.equal(isConsistentBaziFact({ ...fact, facts: { ...fact.facts, formation: 'also_natal' } }), false);
});

test('BaZi strength context requires complete and internally consistent details for both sides', () => {
  const fact = { rule: 'day-master-strength-context', direction: 'mutual', facts: {
    aDayStem: '甲', aDayElement: '木', aMonthBranch: '子', aMonthMainStem: '癸', aMonthRelation: 'resource',
    aRootCount: 1, aMainQiRoots: 1, aRootPositions: 'year:1', aVisibleSupportCount: 1, aVisibleSupportPositions: 'year',
    bDayStem: '辛', bDayElement: '金', bMonthBranch: '酉', bMonthMainStem: '辛', bMonthRelation: 'peer',
    bRootCount: 1, bMainQiRoots: 1, bRootPositions: 'month:1', bVisibleSupportCount: 0, bVisibleSupportPositions: '',
  } };
  assert.equal(isConsistentBaziFact(fact), true);
  assert.equal(isConsistentBaziFact({ ...fact, facts: {} }), false);
  assert.equal(isConsistentBaziFact({ ...fact, facts: { ...fact.facts, bMonthMainStem: '庚' } }), false);
  assert.equal(isConsistentBaziFact({ ...fact, facts: { ...fact.facts, bRootPositions: 'hour:1' } }), false);
  assert.equal(isConsistentBaziFact({ ...fact, facts: { ...fact.facts, aVisibleSupportPositions: 'day' } }), false);
});
