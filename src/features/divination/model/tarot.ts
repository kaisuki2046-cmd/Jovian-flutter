import type { ReadingDirection } from './iching';
import type { tarotSpread } from './tarot-deck.mjs';

export type TarotPosition = (typeof tarotSpread)[number]['id'];

type TarotFace = Readonly<{
  card: Readonly<{ id: string; name: string }>;
  orientation: 'upright' | 'reversed';
}>;

export type TarotDraw = Readonly<{
  deck: 'rider-waite-smith';
  deckVersion: 1;
  spread: 'situation-focus-next-step' | 'situation-influence-trend-v1';
  drawnAt: string;
  cards: readonly (TarotFace & Readonly<{ position: TarotPosition; slot: number }>)[];
}>;

export type TarotPicking = {
  id: number;
  kind: 'tarotPicking';
  question: string;
  slots: readonly TarotFace[];
  selectedSlots: readonly number[];
};

export type TarotResult = {
  id: number;
  kind: 'tarotResult';
  question: string;
  draw: TarotDraw;
  overview: Readonly<{ summary: string; nextStep: string; direction: ReadingDirection }>;
  readings: readonly {
    position: TarotPosition;
    cardName: string;
    orientation: TarotFace['orientation'];
    traditional: string;
    explanation: string;
  }[];
  reused: boolean;
};
