import { tarotDeck, tarotSpread } from '../model/tarot-deck.mjs';
import { tarotMeanings } from '../model/tarot-meanings.mjs';
import { getReadingAction, isJobChangeQuestion } from './reading-guidance.mjs';
import type { TarotDraw, TarotPicking, TarotPosition, TarotResult } from '../model/tarot';

const slotCount = 9;

const positionHints: Record<TarotPosition, string> = {
  situation: '放在「现状」位，可以用它回看最近发生的一件具体的事。',
  focus: '放在「需要留意」位，可以问问自己这一点会怎样影响判断。',
  'next-step': '放在「下一步」位，可以从中选一个近期能尝试的动作。',
};

export function openTarotSelection(task: { id: number; question: string }, random: () => number = Math.random): TarotPicking {
  const remaining = [...tarotDeck];
  const slots = Array.from({ length: slotCount }, () => {
    const index = Math.floor(random() * remaining.length);
    const [card] = remaining.splice(index, 1);
    return { card, orientation: random() < 0.5 ? 'upright' : 'reversed' } as const;
  });
  return { id: task.id, kind: 'tarotPicking', question: task.question, slots, selectedSlots: [] };
}

export function selectTarotSlot(task: TarotPicking, slot: number, now: () => number = Date.now):
TarotPicking | { kind: 'completed'; draw: TarotDraw; selectedSlots: number[] } {
  if (!task.slots[slot] || task.selectedSlots.includes(slot) || task.selectedSlots.length >= tarotSpread.length) {
    return task;
  }
  const selectedSlots = [...task.selectedSlots, slot];
  if (selectedSlots.length < tarotSpread.length) return { ...task, selectedSlots };

  const draw: TarotDraw = {
    deck: 'rider-waite-smith',
    deckVersion: 1,
    spread: 'situation-focus-next-step',
    drawnAt: new Date(now()).toISOString(),
    cards: tarotSpread.map(({ id }, index) => ({
      ...task.slots[selectedSlots[index]],
      position: id,
      slot: selectedSlots[index],
    })),
  };
  return { kind: 'completed', draw, selectedSlots };
}

export function pickTarotSlot(task: TarotPicking, slot: number): TarotPicking | TarotResult {
  const selected = selectTarotSlot(task, slot);
  if (selected.kind === 'tarotPicking') return selected;
  return {
    id: task.id, kind: 'tarotResult', question: task.question, draw: selected.draw,
    ...readTarot(task.question, selected.draw), reused: false,
  };
}

function cardMeaning({ card, orientation }: TarotDraw['cards'][number]) {
  return tarotMeanings[card.id][orientation];
}

export function interpretTarot(draw: TarotDraw): TarotResult['readings'] {
  return draw.cards.map((entry) => {
    const { traditional, plain } = cardMeaning(entry);
    return {
      position: entry.position,
      cardName: entry.card.name,
      orientation: entry.orientation,
      traditional,
      explanation: plain + positionHints[entry.position],
    };
  });
}

type Direction = ReturnType<typeof cardMeaning>['direction'];

const situationSummary: Record<Direction, string> = {
  advance: '现状里已经有想试一试的动力。',
  verify: '眼下还有会影响判断的信息需要弄清。',
  adjust: '眼下的做法或负担已经影响了进展。',
};

// Read the focus as a condition for the action, using the situation to explain what led there.
const pairedSummary: Record<Direction, Record<Direction, string>> = {
  advance: {
    advance: '可以把行动放在首位，选一个做完就能得到反馈的小尝试，再决定投入多少。',
    verify: '可以保留行动的打算，先把它会遇到的现实条件问清楚。拿到答案后，才好判断值得推进多少。',
    adjust: '想前进的意愿可以用来改善眼下的做法。先处理最拖慢进展的一环，再看调整后还有多少空间。',
  },
  verify: {
    advance: '这组牌支持尝试，前提是先核实最可能改变你判断的条件。条件成立后，就可以试一个可回头的小动作。',
    verify: '重点是把决定建立在能核实的信息上。先确定哪个答案会改变你的选择，再去找这一条证据。',
    adjust: '先找出问题的具体来源，再调整做法。把调整后的结果与之前对照，才能知道改动有没有用。',
  },
  adjust: {
    advance: '推进的机会取决于能否先卸下一项旧负担。腾出时间或精力后，再试一个成本有限的选项。',
    verify: '先把手头最消耗你的部分稳住，再核对选项。等压力缓下来，你会更容易看清哪条信息真的重要。',
    adjust: '适合先把资源、节奏或分工重新安排好。等影响最大的阻力减轻，再决定下一步投入多少。',
  },
};

export function readTarot(question: string, draw: TarotDraw): Pick<TarotResult, 'overview' | 'readings'> {
  // Cards are stored in spread order when the last slot is picked.
  const [situation, focus, action] = draw.cards.map((card) => cardMeaning(card).direction);
  const allAligned = situation === focus && focus === action;
  const firstStep = focus === 'advance' ? action : focus;
  const isJobChange = isJobChangeQuestion(question);
  const context = isJobChange ? '就要不要换工作而言，' : '';
  const opening = allAligned ? '三张牌给出的方向一致。' : situationSummary[situation];

  return {
    overview: {
      summary: context + opening + pairedSummary[focus][action],
      nextStep: getReadingAction(question, firstStep),
      direction: firstStep,
    },
    readings: interpretTarot(draw),
  };
}

export function retryTarotReading(task: TarotResult): TarotResult {
  return { ...task, ...readTarot(task.question, task.draw), reused: true };
}
