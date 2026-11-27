import { tarotDeck } from '../model/tarot-deck.mjs';
import type { TarotPicking } from '../model/tarot';

export const cutPoints = [19, 39, 59] as const;

export function shuffleTarotDeck(random: () => number) {
  const deck = [...tarotDeck];
  for (let index = deck.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [deck[index], deck[other]] = [deck[other], deck[index]];
  }
  return deck.map(({ id }) => id);
}

export function cutTarotDeck(deck: readonly string[], cut: number, question: string, random: () => number): TarotPicking {
  const slots = [...deck.slice(cut), ...deck.slice(0, cut)].slice(0, 9).map((id) => {
    const card = tarotDeck.find((entry) => entry.id === id);
    if (!card) throw new RangeError('Unknown tarot card in shuffled deck.');
    return { card, orientation: random() < 0.5 ? 'upright' as const : 'reversed' as const };
  });
  return { id: 0, kind: 'tarotPicking', question, slots, selectedSlots: [] };
}

export function prepareFullTarotDeck(random: () => number, question: string): TarotPicking {
  const cards = new Map(tarotDeck.map((card) => [card.id, card]));
  const slots = shuffleTarotDeck(random).map((id) => ({
    card: cards.get(id)!, orientation: random() < 0.5 ? 'upright' as const : 'reversed' as const,
  }));
  return { id: 0, kind: 'tarotPicking', question, slots, selectedSlots: [] };
}
