import assert from 'node:assert/strict';
import test from 'node:test';
import { openTarotSelection, pickTarotSlot } from '../control/tarot.ts';
import { assembleReport, buildReportEvidence, requestModelReport } from './report.mjs';

const question = '我最近要不要换工作？';
const tosses = [[2, 2, 3], [2, 3, 3], [3, 3, 3], [2, 2, 2], [3, 3, 3], [2, 3, 3]];
const picking = openTarotSelection({ id: 0, kind: 'tarotQuestion', question }, () => 0);
const { draw } = [7, 0, 3].reduce(pickTarotSlot, picking);

function response(selection) {
  return Response.json({
    status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(selection) }] }],
  });
}

test('the model input keeps the three results and the exact shared inputs', () => {
  const evidence = buildReportEvidence({ question, draw, tosses });
  assert.deepEqual(evidence.tarot.cards.map(({ cardName }) => cardName), ['战车', '愚者', '皇后']);
  assert.equal(evidence.liuyao.primary, '水火既济');
  assert.equal(evidence.liuyao.changed, '震为雷');
  assert.deepEqual(evidence.meihua.inputsFromFirstThreeLiuYaoLines, [7, 8, 9]);
  assert.equal(evidence.meihua.primary, '山地剥');
  assert.equal(evidence.judgment, 'verify');
  assert.ok(evidence.glossary.some(({ term }) => term === '体用比和'));
  assert.ok(!evidence.glossary.some(({ term }) => term === '用克体'));
});

test('the model can select approved wording and cannot replace the judgment', async () => {
  const evidence = buildReportEvidence({ question, draw, tosses });
  const result = await requestModelReport(evidence, {
    apiKey: 'test-key', model: 'test-model',
    transport: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      const body = JSON.parse(options.body);
      assert.equal(body.store, false);
      assert.equal(body.text.format.strict, true);
      assert.equal(body.text.format.schema.additionalProperties, false);
      assert.equal(body.input, JSON.stringify(evidence));
      return response({ explanations: ['combined', 'priority'], actions: ['first', 'compare'] });
    },
  });
  assert.equal(result.answer, evidence.choices.answer);
  assert.ok(result.explanation.includes(evidence.choices.explanations[1].text));
  assert.deepEqual(result.nextSteps, evidence.choices.actions.map(({ text }) => text));
  assert.doesNotMatch(JSON.stringify(result), /塔罗|六爻|梅花易数|水火既济/);
});

test('invented claims, unknown IDs, missing primary content and duplicates are rejected', async () => {
  const evidence = buildReportEvidence({ question, draw, tosses });
  const invalid = [
    { explanations: ['combined'], actions: ['first'], answer: '明天一定会拿到 offer' },
    { explanations: ['combined', '你一定会升职'], actions: ['first'] },
    { explanations: ['priority'], actions: ['first'] },
    { explanations: ['combined'], actions: ['first', 'first'] },
    { explanations: ['combined'], actions: ['review'] },
  ];
  for (const selection of invalid) {
    await assert.rejects(requestModelReport(evidence, {
      apiKey: 'test-key', model: 'test-model', transport: async () => response(selection),
    }));
  }
  const refusal = Response.json({
    status: 'completed',
    output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal' }] }],
  });
  await assert.rejects(requestModelReport(evidence, {
    apiKey: 'test-key', model: 'test-model', transport: async () => refusal,
  }));
  assert.deepEqual(Object.keys(assembleReport(evidence.choices)), ['answer', 'explanation', 'nextSteps']);
});
