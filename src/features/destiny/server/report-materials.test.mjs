import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildReportMaterials, conditionsText, factText } from './report-materials.mjs';
const fact = { kind: 'palace_star', palace: '子女', star: '天机', scope: 'origin' };
const claim = { source: { book: '测试资料' }, evidence: { original_text: '原文甲。原文乙。' },
  interpretation: { classical_meaning: '整条释义，含未确认的另一支。', limitations: ['不得据此预测生育或健康。', '只用于古籍资料比对。'] } };

test('readable conditions preserve each method’s meaningful qualifiers without internal profiles', () => {
  assert.equal(factText({ kind: 'ziwei_life_body_clash' }), '命宫与身宫对冲');
  assert.equal(factText({ kind: 'bazi_hidden_god_phase', position: 'hour', tenGod: '偏财', phase: '长生', anchor: 'month' }),
    '时柱藏干十神偏财以月令论为长生');
  assert.equal(factText({ kind: 'bazi_element_balance', element: '木', band: '过盛', profile: 'weighted-element-balance-v1' }),
    '五行木过盛');
  assert.equal(factText({ kind: 'natal_ziwei_time_band', branch: '子', band: 'middle' }), '生于子时中段');
  assert.equal(factText({ kind: 'western_sect', sect: 'day' }), '日盘');
  assert.equal(factText({ kind: 'planet_motion', planet: 'Mars', motion: 'retrograde' }), '火星逆行');
  assert.equal(factText({ kind: 'planet_house', planet: 'Sun', house: 10 }), '太阳落在第10宫');
});

test('compact conditions retain confirmed alternatives, absences, relations, orb and applicable age range', () => {
  const sun = { kind: 'palace_star', palace: '命宫', star: '太阳', scope: 'origin' };
  const moon = { kind: 'palace_star', palace: '财帛', star: '太阴', scope: 'origin' };
  const text = conditionsText({ required: [sun], absent: [moon], alternatives: [[sun, moon]],
    relations: [{ type: 'trine_palaces', first: sun, second: moon }],
    measurements: [{ kind: 'aspect_orb', first: 'Sun', second: 'Moon', aspect: '三分相', orb: 1.5 }],
    decadalPeriod: { ganZhi: '甲子', startAge: 12, endAge: 21 },
  });
  assert.match(text, /不见：财帛宫有太阴/u);
  assert.match(text, /已满足组合：命宫有太阳且财帛宫有太阴/u);
  assert.match(text, /命宫的太阳与财帛宫的太阴三合/u);
  assert.match(text, /太阳与月亮形成三分相，容许度1.5°/u);
  assert.match(text, /适用12至21虚岁甲子运限/u);
  assert.doesNotMatch(text, /origin|trine_palaces|aspect_orb|\{|\}/u);
});

test('source boundaries and legacy limits travel with matched materials as attributed source data', () => {
  const materials = buildReportMaterials([{ topic: '综合', personality: [{ claim, matchedConditions: { required: [fact] } }],
    events: [{ source: { title: '旧规则' }, basis: '旧依据', reading: '旧解读', limit: '旧规则的适用边界。' }] }]);
  assert.ok(materials.includes('原资料使用边界：不得据此预测生育或健康。；只用于古籍资料比对。'));
  assert.ok(materials.includes('原资料使用边界：旧规则的适用边界。'));
});

test('a matched passage keeps source limits while withholding unconfirmed whole-record conclusions', () => {
  const materials = buildReportMaterials([{ topic: '综合', personality: [{ claim,
    matchedBranches: [{ text: '原文甲。', modernInterpretation: '只有甲分句的解读。', matchedConditions: { required: [fact] } }] }], events: [] }]);
  assert.ok(materials.includes('原文/依据：原文甲。\n现代解读：只有甲分句的解读。'));
  assert.doesNotMatch(materials, /出处：|测试资料/u);
  assert.ok(materials.includes('原文甲。'));
  assert.ok(materials.includes('不得据此预测生育或健康。'));
  assert.ok(!materials.includes('原文乙。'));
  assert.ok(!materials.includes('整条释义'));
});

test('multiple matched passages keep their own original, explanation and conditions together', () => {
  const second = { kind: 'palace_star', palace: '命宫', star: '紫微', scope: 'origin' };
  const materials = buildReportMaterials([{ topic: '综合', personality: [{ claim, matchedBranches: [
    { text: '原文甲。', modernInterpretation: '甲的盘面解读。', matchedConditions: { required: [fact] } },
    { text: '原文乙。', modernInterpretation: '乙的盘面解读。', matchedConditions: { required: [second] } },
  ] }], events: [] }]);
  assert.match(materials, /原文\/依据：原文甲。\n现代解读：甲的盘面解读。\n命中条件：子女宫有天机/u);
  assert.match(materials, /原文\/依据：原文乙。\n现代解读：乙的盘面解读。\n命中条件：命宫有紫微/u);
  assert.doesNotMatch(materials, /整条释义/u);
});
