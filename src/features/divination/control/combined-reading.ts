import type { CombinedReading, LiuYaoReading, MeihuaReading, ReadingDirection } from '../model/iching';
import type { TarotResult } from '../model/tarot';
import { getReadingAction, getReadingTopic } from './reading-guidance.mjs';

const answers: Record<ReadingDirection, string> = {
  verify: '可以继续了解，等关键条件清楚后再做决定。',
  adjust: '先做一个能改善现状的调整，再判断是否需要更大的变化。',
  advance: '可以先做一次小范围尝试，用实际反馈判断要不要继续。',
};

const jobChangeAnswers: Record<ReadingDirection, string> = {
  verify: '可以开始看机会，等确认新岗位能改善你最在意的条件，再决定要不要离开。',
  adjust: '先找出眼下最想改善的一个问题，再比较换工作和调整现职哪种更合适。',
  advance: '可以先接触合适的岗位，通过面谈看看它能否改善你最在意的问题。',
};

export function combineReadings(tarot: Pick<TarotResult, 'question' | 'overview'>, liuyao: LiuYaoReading, meihua: MeihuaReading): CombinedReading {
  const signals = [tarot.overview.direction, liuyao.direction, meihua.direction];
  const direction = signals.includes('verify') ? 'verify' : signals.includes('adjust') ? 'adjust' : 'advance';
  const canTry = signals.includes('advance');
  const shouldAdjust = signals.includes('adjust');
  const topic = getReadingTopic(tarot.question);
  const focus = topic.focus;

  let summary = '选一个范围小、容易改变的尝试。拿到反馈后，再决定是否继续投入。';
  if (direction === 'verify') {
    summary = '先从' + focus + '中找出会改变你判断的一项，再想想可以从哪里核实。';
    if (shouldAdjust) summary += '信息明确后，可以先调整最卡住的一项安排。';
    if (canTry) summary += '条件合适时，再做一个成本有限的尝试。';
  } else if (direction === 'adjust') {
    summary = '把' + focus + '里最影响你的阻力缩小到一件可改变的事，再观察调整有没有用。';
    if (canTry) summary += '腾出余地后，可以接着试一个小选项。';
  }

  return {
    status: 'complete', liuyao, meihua, direction,
    answer: (topic.id === 'work-change' ? jobChangeAnswers : answers)[direction],
    summary,
    nextStep: getReadingAction(tarot.question, direction),
  };
}
