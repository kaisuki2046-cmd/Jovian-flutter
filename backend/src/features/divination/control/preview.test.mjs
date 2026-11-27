import assert from 'node:assert/strict';
import test from 'node:test';
import {
  classifyPreview, maxMessageLength, promptForTask, questionWithClarification, recommendedReadingQuestions, validateMessage,
} from './preview.ts';

test('rejects empty and oversized messages after trimming', () => {
  assert.ok(validateMessage('　 '));
  assert.equal(validateMessage(' 问'.repeat(maxMessageLength / 2).trim().padEnd(maxMessageLength, '事')), undefined);
  assert.ok(validateMessage('问'.repeat(maxMessageLength + 1)));
});

test('clarifies vague questions and routes specific questions to method selection', () => {
  assert.deepEqual(classifyPreview('这件事能不能成？', 'divination'), promptForTask('divination'));
  assert.equal(classifyPreview('我想问下个月换工作这件事。', 'divination').kind, 'confirmReading');
  assert.equal(classifyPreview('用六爻看看换工作这件事。', null).kind, 'confirmReading');
});

test('all suggested questions go to the reading flow from a fresh session', () => {
  for (const question of recommendedReadingQuestions) {
    assert.equal(classifyPreview(question, null).kind, 'confirmReading', question);
  }
});

test('uses the selected task to interpret follow-ups and respects a new explicit intent', () => {
  assert.equal(classifyPreview('我想了解伴侣之间的沟通。', 'compatibility').task, 'compatibility');
  assert.deepEqual(classifyPreview('五行起名', 'divination'), promptForTask('naming'));
  const naming = classifyPreview('姓林，想要清雅的双字名。', 'naming');
  assert.equal(naming.kind, 'preview');
  assert.equal(naming.task, 'naming');
});

test('repeated, rephrased and replacement questions go to the parser on their own', () => {
  const previous = '算一下我今天穿的什么颜色的内裤';
  for (const message of [
    previous + '？',
    '算算我今天的underwear的颜色',
    '算算我今天穿了什么颜色的内裤',
    '算算我今天穿了什么颜色的T-shirt',
    '我今天穿的上衣是什么颜色？',
    'What color is my T-shirt?',
  ]) {
    assert.equal(questionWithClarification(previous, message), message);
    assert.equal(classifyPreview(message, 'divination').kind, 'confirmReading');
  }
  assert.equal(questionWithClarification('帮我算一下', '上周谈的合同'), '帮我算一下；补充：上周谈的合同');
  assert.equal(questionWithClarification('这次面试怎么样？', '下周三'), '这次面试怎么样？；补充：下周三');
  assert.equal(questionWithClarification('问'.repeat(maxMessageLength), '上周谈的合同'), '上周谈的合同');
});

test('mixed intents, greetings, unrelated requests and sensitive requests skip previews', () => {
  assert.equal(classifyPreview('我想看合盘，也想五行起名。', 'divination').task, null);
  for (const message of ['你好！', '请帮我翻译这句话', '帮我用塔罗看看股票能赚多少', '最近工作时胸痛，我要不要去医院？', '合作纠纷要不要起诉？']) {
    assert.equal(classifyPreview(message, 'divination').kind, 'guidance');
  }
});
