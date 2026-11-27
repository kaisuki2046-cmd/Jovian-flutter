import assert from 'node:assert/strict';
import test from 'node:test';
import { tarotDeck } from '../model/tarot-deck.mjs';
import { tarotMeanings } from '../model/tarot-meanings.mjs';
import { interpretTarot, openTarotSelection, pickTarotSlot, retryTarotReading } from './tarot.ts';

const question = { id: 1, kind: 'tarotQuestion', question: '我在考虑换工作。' };

test('all 78 distinct cards have traditional and everyday meanings for both orientations', () => {
  assert.equal(tarotDeck.length, 78);
  assert.equal(new Set(tarotDeck.map(({ id }) => id)).size, 78);
  assert.deepEqual(Object.keys(tarotMeanings).sort(), tarotDeck.map(({ id }) => id).sort());
  for (const { upright, reversed } of Object.values(tarotMeanings)) {
    for (const meaning of [upright, reversed]) {
      assert.ok(meaning.traditional.trim());
      assert.ok(meaning.plain.trim());
      assert.ok(['advance', 'verify', 'adjust'].includes(meaning.direction));
    }
    assert.notEqual(upright.traditional, reversed.traditional);
    assert.notEqual(upright.plain, reversed.plain);
  }
});


test('prepares nine unique faces and reveals only after three valid picks, in selection order', () => {
  let randomCalls = 0;
  const task = openTarotSelection(question, () => randomCalls++ % 4 === 3 ? 0.75 : 0);
  assert.equal(task.slots.length, 9);
  assert.equal(new Set(task.slots.map(({ card }) => card.id)).size, 9);
  assert.deepEqual(task.selectedSlots, []);

  const first = pickTarotSlot(task, 7);
  assert.equal(first.kind, 'tarotPicking');
  assert.deepEqual(first.selectedSlots, [7]);
  for (const invalid of [7, -1, 2.5, 9, NaN]) {
    assert.strictEqual(pickTarotSlot(first, invalid), first);
  }

  const second = pickTarotSlot(first, 0);
  assert.equal(second.kind, 'tarotPicking');
  assert.deepEqual(second.selectedSlots, [7, 0]);

  const result = pickTarotSlot(second, 3);
  assert.equal(result.kind, 'tarotResult');
  assert.equal(result.id, question.id);
  assert.deepEqual(result.draw.cards.map(({ position, slot, card, orientation }) => [position, slot, card.id, orientation]), [
    ['situation', 7, 'major-7', 'reversed'],
    ['focus', 0, 'major-0', 'upright'],
    ['next-step', 3, 'major-3', 'reversed'],
  ]);
  assert.equal(randomCalls, 18);
  assert.equal(result.readings.length, 3);
});

test('each card shows its own traditional meaning and explains it in its spread position', () => {
  const picking = openTarotSelection(question, () => 0);
  const { draw } = pickTarotSlot(pickTarotSlot(pickTarotSlot(picking, 0), 1), 2);
  const [card] = draw.cards;
  const { upright, reversed } = tarotMeanings[card.card.id];
  const readings = interpretTarot({
    ...draw,
    cards: [
      card,
      { ...card, position: 'focus' },
      { ...card, position: 'next-step', orientation: 'reversed' },
    ],
  });

  assert.equal(readings[0].traditional, upright.traditional);
  assert.ok(readings[0].explanation.startsWith(upright.plain));
  assert.match(readings[0].explanation, /现状/);
  assert.equal(readings[1].traditional, upright.traditional);
  assert.match(readings[1].explanation, /需要留意/);
  assert.notEqual(readings[1].explanation, readings[0].explanation);
  assert.equal(readings[2].traditional, reversed.traditional);
  assert.ok(readings[2].explanation.startsWith(reversed.plain));
  assert.match(readings[2].explanation, /下一步/);
});

test('moving the same cards between focus and next step changes the synthesis and priority', () => {
  const values = [0, 0, 0, 0.75, 0.64, 0];
  const picking = openTarotSelection(question, () => values.shift() ?? 0);
  const first = pickTarotSlot(picking, 0);
  const adjustThenVerify = pickTarotSlot(pickTarotSlot(first, 1), 2);
  const verifyThenAdjust = pickTarotSlot(pickTarotSlot(first, 2), 1);
  const moving = pickTarotSlot(pickTarotSlot({ ...first, question: '最近要不要搬家？' }, 2), 1);

  const cards = (result) => result.draw.cards.map(({ card, orientation }) => [card.id, orientation]).sort();
  assert.deepEqual(cards(adjustThenVerify), cards(verifyThenAdjust));
  assert.match(adjustThenVerify.overview.summary, /稳住，再核对选项/);
  assert.match(adjustThenVerify.overview.nextStep, /分工或工作量/);
  assert.match(verifyThenAdjust.overview.summary, /问题的具体来源，再调整做法/);
  assert.match(verifyThenAdjust.overview.nextStep, /用同一标准比较新旧岗位/);
  assert.deepEqual(moving.readings, verifyThenAdjust.readings);
  assert.match(moving.overview.nextStep, /用实际报价或现场信息核实/);
});

test('a spread with the same direction across all three positions gives a shared conclusion', () => {
  const picking = openTarotSelection(question, () => 0);
  const result = pickTarotSlot(pickTarotSlot(pickTarotSlot(picking, 0), 1), 3);
  assert.match(result.overview.summary, /三张牌给出的方向一致/);
  assert.match(result.overview.nextStep, /安排一次了解岗位的面谈/);
});


test('retry recomputes text from the recorded draw', () => {
  const picking = openTarotSelection(question, () => 0.2);
  const result = pickTarotSlot(pickTarotSlot(pickTarotSlot(picking, 3), 1), 8);
  const retry = retryTarotReading(result);

  assert.equal(retry.id, result.id);
  assert.equal(retry.question, result.question);
  assert.strictEqual(retry.draw, result.draw);
  assert.deepEqual(retry.overview, result.overview);
  assert.deepEqual(retry.readings, result.readings);
  assert.notStrictEqual(retry.readings, result.readings);
  assert.equal(retry.reused, true);
});
