import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateBaZi, calculateZiwei, calculateWestern, chartFacts } from '../control/charts.ts';
import { buildChartFactsText, factText } from './chart-facts-text.mjs';
import { parseInput, generateReport, createDeepSeek } from './report.mjs';
import { chartVersions } from './knowledge/catalog.mjs';

test('real charts of all three methods become Chinese sentences without machine values or duplicate palace suffixes', () => {
  const date = { year: 1990, month: 1, day: 1 };
  const charts = {
    bazi: calculateBaZi(Date.UTC(1990, 0, 1, 8), Date.UTC(1990, 0, 1, 16)),
    ziwei: calculateZiwei({ date, gender: 'male' }, 8),
    western: calculateWestern(Date.UTC(1990, 0, 1, 8), { latitude: 39.9, longitude: 116.4 }),
  };
  const queries = Object.entries(charts).map(([method, chart]) => ({ method, confirmedFacts: chartFacts[method](chart) }));
  const text = buildChartFactsText(queries);
  assert.match(text, /年柱为己巳/u);
  assert.match(text, /紫微斗数盘面事实/u);
  assert.match(text, /太阳位于摩羯座/u);
  assert.doesNotMatch(text, /[A-Za-z_{}\[\]]|undefined|宫宫/u);
  assert.equal(factText({ kind: 'ziwei_grade', dimension: 'star', grade: '上' }), '星曜品级为上');
  assert.equal(factText({ kind: 'daozang_palace_star', palace: '命宫', star: '天贵', relation: 'occupies' }), '道藏盘命宫有天贵');
  assert.equal(factText({ kind: 'ziwei_daozang_input', yearBranch: '午', month: 5, day: 12, hour: 0, leap: true }),
    '道藏排盘口径为午年、农历闰5月12日、子时');
});

test('with unknown birth time, only confirmed conditions of the selected rule are sent', async () => {
  const input = parseInput({ timeKnown: false, chartQueries: [{ method: 'western', rulesetVersion: chartVersions.western.rulesetVersion,
    confirmedFacts: [{ kind: 'planet_sign', planet: 'Sun', sign: '白羊座' }, { kind: 'planet_house', planet: 'Moon', house: 4 },
      { kind: 'planet_motion', planet: 'Jupiter', motion: 'direct' }],
    confirmedAbsentFacts: [{ kind: 'planet_motion', planet: 'Mars', motion: 'retrograde' }],
  }] });
  let message;
  const complete = createDeepSeek({ apiKey: 'test-only', transport: async (_, request) => {
    message = JSON.parse(request.body).messages[1].content;
    return Response.json({ choices: [{ message: { content: '正文' } }] });
  } });
  await generateReport(input, { signal: new AbortController().signal, expressionMode: 'off', complete,
    lookup: queries => {
      const facts = buildChartFactsText(queries);
      assert.match(facts, /太阳位于白羊座/u);
      assert.match(facts, /已确认不见：火星逆行/u);
      assert.doesNotMatch(facts, /月亮|第4宫/u);
      return [{ topic: '综合', topicId: 'overall', personality: [{ id: 'test-rule', layer: 'personality',
        method: 'western', reading: '释义', basis: '依据', keywords: [], source: { title: '测试书' },
        matchedConditions: { required: queries[0].confirmedFacts.filter(fact => fact.kind === 'planet_sign'),
          absent: queries[0].confirmedAbsentFacts } }], events: [] }];
    },
  });
  assert.match(message, /现代解读：释义/u);
  assert.match(message, /^命中条件：太阳位于白羊座；不见：火星逆行$/mu);
  assert.doesNotMatch(message, /盘面事实|木星|月亮|第4宫|confirmedFacts|confirmedAbsentFacts|planet_house|\{"/u);
});
