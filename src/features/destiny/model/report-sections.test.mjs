import assert from 'node:assert/strict';
import { test } from 'node:test';
import { splitDestinyReport } from './report-sections.ts';

test('five plain topic headings become sections and preserve both personality and event paragraphs', () => {
  const titles = ['综合', '事业', '爱情', '学业', '财富'];
  const report = titles.map(title => `${title}\n你在${title}方面重视自主。\n\n从盘面看，更容易出现相应的生活转折。`).join('\n\n');
  const sections = splitDestinyReport(report);
  assert.deepEqual(sections.map(({ title }) => title), titles);
  for (const section of sections) assert.equal(section.text,
    `你在${section.title}方面重视自主。\n\n从盘面看，更容易出现相应的生活转折。`);
});

test('old archived Markdown, numbered and bracketed headings normalize without losing introductions or inline prose', () => {
  const text = '这是上次保存的报告。\r\n\r\n### 综合\r\n原文保留。\r\n\r\n二、事业：可能异地工作。\r\n\r\n**感情**\r\n关系变化。\r\n\r\n【学业】\r\n学习安排。\r\n\r\n5. 财运\r\n置业机会。';
  assert.deepEqual(splitDestinyReport(text), [
    { text: '这是上次保存的报告。' }, { title: '综合', text: '原文保留。' },
    { title: '事业', text: '可能异地工作。' }, { title: '爱情', text: '关系变化。' },
    { title: '学业', text: '学习安排。' }, { title: '财富', text: '置业机会。' },
  ]);
  assert.deepEqual(splitDestinyReport('综合来看，你比较独立。\n\n你对事业的看法会变化。'),
    [{ text: '综合来看，你比较独立。\n\n你对事业的看法会变化。' }]);
  assert.deepEqual(splitDestinyReport(''), []);
});
