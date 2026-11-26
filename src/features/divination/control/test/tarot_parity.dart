import 'dart:io';

import '../lib/jovian_divination.dart';
import 'parity_support.dart';

const _legacyProgram = r'''
import { readFileSync } from 'node:fs';
import { openTarotSelection, selectTarotSlot, readTarot } from './src/features/divination/control/tarot.ts';
import { cutTarotDeck, prepareFullTarotDeck, shuffleTarotDeck } from './src/features/divination/control/tarot-session.ts';
const cases = JSON.parse(readFileSync(0, 'utf8'));
const when = 1794528001234;
const results = cases.map(([question, mode, orientation, slots]) => {
  const next = () => orientation;
  let picking;
  if (mode === 'full') {
    let calls = 0;
    picking = prepareFullTarotDeck(() => calls++ < 77 ? 0.999 : orientation, question);
  } else if (mode === 'quick') {
    picking = openTarotSelection({ id: 1, question }, next);
  } else {
    picking = cutTarotDeck(shuffleTarotDeck(() => 0.31), mode, question, next);
  }
  const initial = picking;
  for (const slot of slots) picking = selectTarotSlot(picking, slot, () => when);
  return [initial, picking, readTarot(question, picking.draw)];
});
process.stdout.write(JSON.stringify(results));
''';

Future<void> main() async {
  const questions = [
    '要不要换新工作？',
    '如何准备面试？',
    '该怎么和朋友相处？',
    '如何准备考试？',
    '这周是否适合搬家？',
    '这件事该怎么处理？',
  ];
  final cases = <(String, Object, double, List<int>)>[
    for (final question in questions)
      for (final orientation in [0.25, 0.75])
        for (var index = 0; index < tarotDeck.length; index += 3)
          (question, 'full', orientation, [index + 2, index, index + 1]),
    for (final orientation in [0.25, 0.75])
      for (final mode in <Object>['quick', ...tarotCutPoints])
        (questions.first, mode, orientation, [8, 0, 4]),
  ];
  final expected = await runLegacyOracle(_legacyProgram, [
    for (final (question, mode, orientation, slots) in cases)
      [question, mode, orientation, slots],
  ]);
  if (expected.length != cases.length)
    throw StateError('Wrong oracle result count.');
  final instant = DateTime.fromMillisecondsSinceEpoch(
    1794528001234,
    isUtc: true,
  );
  for (var index = 0; index < cases.length; index++) {
    final (question, mode, orientation, slots) = cases[index];
    var calls = 0;
    final initial = switch (mode) {
      'full' => prepareFullTarotDeck(
        question,
        random: () => calls++ < 77 ? 0.999 : orientation,
      ),
      'quick' => openTarotSelection(
        id: 1,
        question: question,
        random: () => orientation,
      ),
      int cut => cutTarotDeck(
        shuffleTarotDeck(random: () => 0.31),
        cut,
        question,
        random: () => orientation,
      ),
      _ => throw StateError('Unexpected draw mode $mode.'),
    };
    if (initial.slots.map((slot) => slot.card.id).toSet().length !=
        initial.slots.length) {
      throw StateError('A deck repeated a card.');
    }
    if (!identical(selectTarotSlot(initial, -1), initial) ||
        !identical(selectTarotSlot(initial, initial.slots.length), initial)) {
      throw StateError('An invalid slot changed the draft.');
    }
    final first = selectTarotSlot(initial, slots[0]) as TarotPicking;
    if (!identical(selectTarotSlot(first, slots[0]), first)) {
      throw StateError('An already selected slot changed the draft.');
    }
    final second = selectTarotSlot(first, slots[1]) as TarotPicking;
    final complete =
        selectTarotSlot(second, slots[2], now: () => instant)
            as CompletedTarotSelection;
    final actual = [
      initial.toJson(),
      complete.toJson(),
      readTarot(question, complete.draw).toJson(),
    ];
    if (!deepEquals(actual, expected[index])) {
      throw StateError(
        'Tarot mismatch for ${cases[index]}\n'
        'Expected: ${expected[index]}\nActual: $actual',
      );
    }
  }

  final picking = prepareFullTarotDeck(questions.first, random: () => 0);
  final first = selectTarotSlot(picking, 70) as TarotPicking;
  final second = selectTarotSlot(first, 0) as TarotPicking;
  final guide =
      selectTarotSlot(
            second,
            44,
            now: () => instant,
            spread: TarotSpread.situationInfluenceTrend,
          )
          as CompletedTarotSelection;
  if (guide.draw.toJson()['spread'] != 'situation-influence-trend-v1') {
    throw StateError('The guide draw used the standalone spread identifier.');
  }
  stdout.writeln(
    '${cases.length} Tarot draws and interpretations match the legacy implementation.',
  );
}
