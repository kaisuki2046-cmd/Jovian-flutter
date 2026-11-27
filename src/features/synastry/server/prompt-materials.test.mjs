import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildSummaryMaterials } from './prompt-materials.mjs';

const sections = (overrides = {}) => ({ family: { basis: [] }, friendship: { basis: [] },
  romance: { basis: [] }, collaboration: { basis: [] }, ...overrides });

test('sends matched original wording, source conditions and modern interpretations while sharing repeated material', () => {
  const entry = { direction: 'a_to_b', contentType: 'personality', proofs: [{ factId: 'PRIVATE-ID', direction: 'a_to_b', observation: '私人盘面描述',
    sources: ['A 年柱 卯', 'B 年柱 酉'], conditions: [{ expected: '私人条件' }],
    exclusions: [[{ expected: '私人排除条件' }]] }],
  interpretation: '遇到临时改约时，两人需要的回应速度可能不同。',
  originalText: '古籍原文', originalConditions: ['原文条件甲', '原文条件乙'] };
  const common = { direction: 'common', contentType: 'fact', interpretation: '双方容易在明确期限后达成一致。',
    originalText: '约定日期的原文', originalConditions: ['共同条件'] };
  const reverse = { ...common, direction: 'b_to_a' };
  const distinct = { ...entry, originalConditions: ['另一条原文条件'] };
  const evidence = { ...sections({ friendship: { basis: [entry, entry, distinct] }, collaboration: { basis: [entry, common, reverse] } }),
    chartFacts: [{ observation: '另一条私人盘面描述', facts: { degrees: 89.875 }, chartRulesets: ['私人盘版'] }],
    methods: [{ name: '私人排盘方法', limitations: ['私人算法限制'] }] };
  const text = buildSummaryMaterials(evidence);
  assert.equal(text, buildSummaryMaterials(sections({ friendship: evidence.friendship, collaboration: evidence.collaboration })));
  assert.doesNotMatch(text, /PRIVATE-ID|私人|A 年柱 卯|B 年柱 酉|89\.875/u);
  assert.equal(text.split('古籍原文').length - 1, 1);
  assert.match(text, /〔条1〕 原文命中条件：\["原文条件甲","原文条件乙"\]/u);
  assert.match(text, /〔释1〕 A方作用于B方｜相处表现\n  现代解读：遇到临时改约时，两人需要的回应速度可能不同。\n  原文：〔原1〕\n  原文命中条件：〔条1〕/u);
  assert.match(text, /【友情命中解读】\n- 〔释1〕\n- A方作用于B方｜相处表现[^]*?原文命中条件：\["另一条原文条件"\]\n\n【爱情命中解读】/u);
  assert.match(text, /【爱情命中解读】\n本类暂无命中解读。\n\n【合作命中解读】\n- 〔释1〕\n- 双方共同｜事件倾向[^]*?\n- B方作用于A方｜事件倾向/u);
});
