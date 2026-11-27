import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildNaturalExpression, checkNaturalExpression } from './style.mjs';

test('stores 32 original examples with learning points and limits but selects at most two', () => {
  const document = readFileSync(new URL('./examples.md', import.meta.url), 'utf8').replace(/\r\n/gu, '\n');
  const entries = [...document.matchAll(/^## (EX-\d{3}) · ([^\n]+)\n\n\*\*学习重点\*\* (.+)\n\n([^\n]+)\n\n\*\*使用限制\*\* (.+)$/gmu)];
  assert.equal(entries.length, 32);
  assert.equal(new Set(entries.map((entry) => entry[1])).size, 32);
  const style = buildNaturalExpression(['love', 'career', 'study'], 'examples');
  assert.deepEqual(style.samples.map(({ category }) => category), ['感情', '取舍']);
  assert.deepEqual(buildNaturalExpression([], 'examples').samples.map(({ category }) => category), ['人际', '日常']);
  assert.match(buildNaturalExpression([], 'rules').prompt, /在意确定性.+明确答复/u);
  assert.match(style.prompt, /保留上游含义、方向、强度及适用条件/u);
  assert.doesNotMatch(style.prompt, /心理共鸣|psychologicalResonance|\b(?:BLOCK|ALLOW|CAUTION)\b/u);
  assert.doesNotMatch(buildNaturalExpression([], 'rules').prompt, /心理共鸣|psychologicalResonance|\b(?:BLOCK|ALLOW|CAUTION)\b/u);
  assert.ok(!style.prompt.includes(entries.at(-1)[4]));
  assert.deepEqual(buildNaturalExpression([], 'off'), { prompt: '', samples: [] });
});

test('flags repetitive openings and forced phrasing while allowing ordinary links and repeated topic words', () => {
  const repetitive = '你是一个重视分工的人。表面上容易协调，实际上还有疑问。\n\n你是一个在意进度的人。看似只差一步，其实还要多问两句。';
  assert.deepEqual(checkNaturalExpression(repetitive), ['连续段落使用同一开头', '反复使用同一种转折']);
  assert.deepEqual(checkNaturalExpression('分工还不清楚时，可以问问各自负责哪一部分。不过，等分工明确以后，有些事就能直接继续。'), []);
});
