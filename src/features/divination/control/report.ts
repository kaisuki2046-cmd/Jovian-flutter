import type { CombinedReading } from '../model/iching';
import { getReadingTopic } from './reading-guidance.mjs';

type CompletedReading = Extract<CombinedReading, { status: 'complete' }>;

export function buildReportChoices(question: string, combined: CompletedReading) {
  const topic = getReadingTopic(question);
  const canCompare = combined.direction !== 'advance';
  const explanations = [
    { id: 'combined', text: combined.summary },
    { id: 'priority', text: canCompare
      ? '先在' + topic.focus + '中选一个最影响你选择的条件。把这个条件想清楚，接下来的比较会更具体。'
      : '先想好怎样的反馈值得继续投入，再做一个容易回头的小尝试。' },
  ];
  const actions = [{ id: 'first', text: combined.nextStep }];
  if (combined.direction === 'verify' && topic.id === 'work-change') {
    actions.push({ id: 'compare', text: '把无法妥协的一项条件写下来，面谈后再对照岗位实际情况。' });
  } else if (combined.direction === 'adjust') {
    actions.push({ id: 'record', text: '给这次调整定一个观察点，事后记下哪里有改善、哪里依然卡住。' });
  } else if (combined.direction === 'advance') {
    actions.push({ id: 'review', text: '尝试后记录一个具体反馈，据此决定下一步的投入。' });
  }
  return { answer: combined.answer, explanations, actions };
}
