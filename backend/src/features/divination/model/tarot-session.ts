import type { TarotDraw } from './tarot';
import type { ReadingBase, ruleVersions } from './reading';

export type TarotSnapshot = ReadingBase & Readonly<{
  method: 'tarot';
  ruleVersion: typeof ruleVersions.tarot;
  stage: 'shuffle' | 'cut' | 'draw' | 'reading';
  cut?: number;
  slotCount: number;
  selectedSlots: readonly number[];
  draw?: TarotDraw;
}>;
