
import assert from 'node:assert/strict';
import test from 'node:test';
import { understandWithModel } from './question-model.mjs';

const question = '换工作和搬家是两件事，我想都问。';
const completed = (selection) => new Response(JSON.stringify({
  status: 'completed',
  output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(selection) }] }],
}));

test('DeepSeek uses its Responses endpoint and structured output format', async () => {
  const result = await understandWithModel(question, {
    provider: 'deepseek',
    apiKey: 'test-key',
    model: 'deepseek-flash',
    async transport(url, init) {
      assert.equal(url, 'https://api.deepseek.com/responses');
      assert.equal(init.headers.Authorization, 'Bearer test-key');
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'deepseek-flash');
      assert.deepEqual(body.reasoning, { effort: 'none' });
      assert.equal(body.text.format.type, 'json_schema');
      assert.equal(body.text.format.strict, undefined);
      assert.deepEqual(JSON.parse(body.input), { question });
      return completed({ intent: 'ready', focus: 'choice' });
    },
  });
  assert.equal(result.source, 'model');
});

test('model may choose an intent but cannot contribute prose or calculation fields', async () => {
  const signal = new AbortController().signal;
  const options = { apiKey: 'test-key', model: 'test-model', signal };
  const result = await understandWithModel(question, {
    ...options,
    transport: async (_url, init) => {
      assert.equal(init.signal, signal);
      const body = JSON.parse(init.body);
      assert.equal(body.store, false);
      assert.deepEqual(JSON.parse(body.input), { question });
      return completed({ intent: 'multiple_questions', focus: 'choice' });
    },
  });
  assert.equal(result.source, 'model');
  assert.match(result.clarification, /先挑一件事/);

  for (const payload of [
    { intent: 'ready', focus: '乾为天变泽天夬' },
    { intent: 'ready', focus: 'choice', evidence: ['fake'] },
    { intent: '__proto__', focus: 'choice' },
  ]) {
    await assert.rejects(understandWithModel(question, { ...options, transport: async () => completed(payload) }), TypeError);
  }
});

test('timing questions can start even if the model asks for the current stage', async () => {
  const options = {
    provider: 'deepseek', model: 'deepseek-flash', apiKey: 'test-key',
    transport: async () => Response.json({
      choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({
        intent: 'missing_details', focus: 'general', questions: ['现在进展到哪一步了？'],
      }) } }],
    }),
  };
  for (const text of ['什么时候回款？', '这件事多久有结果？', '什么时候能收到消息？']) {
    const result = await understandWithModel(text, options, true);
    assert.equal(result.clarification, '');
    assert.match(result.focus, /时间/);
  }
  for (const text of ['什么时候？', '帮我算一下']) {
    const result = await understandWithModel(text, options, true);
    assert.match(result.clarification, /哪件事/);
    assert.doesNotMatch(result.clarification, /进展/);
  }
});

test('specific color questions can start when the model treats them as vague or casual', async () => {
  async function parse(text, intent, questions = []) {
    return understandWithModel(text, {
      provider: 'deepseek', model: 'deepseek-flash', apiKey: 'test-key',
      transport: async () => Response.json({
        choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ intent, focus: 'general', questions }) } }],
      }),
    }, true);
  }

  for (const text of [
    '算一下我今天穿的什么颜色的内裤',
    '算算我今天的underwear的颜色',
    '算算我今天穿了什么颜色的内裤',
    '算算我今天穿了什么颜色的T-shirt',
    'What color is my T-shirt?',
  ]) {
    assert.equal((await parse(text, 'missing_details', ['你想问什么事？'])).clarification, '');
    const result = await parse(text, 'chat_only');
    assert.equal(result.clarification, '');
    assert.equal(result.intent, undefined);
  }
  for (const text of ['什么颜色？', '算算什么颜色？']) {
    assert.match((await parse(text, 'missing_details', ['你想问什么事？'])).clarification, /哪件事/);
  }
  const separate = await parse('我什么时候回款？我今天的T-shirt是什么颜色？', 'multiple_questions', ['你最想先问哪个？']);
  assert.match(separate.clarification, /先挑一件事/);
});
