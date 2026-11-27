import type { CoinToss } from './iching';
import type { TarotDraw } from './tarot';

export const maxReportVersions = 3;

export type DivinationReport = Readonly<{
  answer: string;
  explanation: string;
  nextSteps: readonly string[];
}>;

export type TaskSnapshot = Readonly<{
  question: string;
  slotCount: number;
  selectedSlots: readonly number[];
  draw?: TarotDraw;
  tosses: readonly CoinToss[];
  reportVersion: number;
  report?: DivinationReport;
}>;
