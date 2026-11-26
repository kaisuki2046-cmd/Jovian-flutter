import 'dart:io';

import '../lib/jovian_divination.dart';
import 'parity_support.dart';

const _question = '这次面试后续会怎样？';
const _focus = '面试后续';
const _date = '2000-01-07T22:59:59+08:00';
const _legacyProgram = r'''
import { readFileSync } from 'node:fs';
import { createReadingTaskService } from './src/features/divination/server/reading-tasks.mjs';
const {cases, question, focus, date} = JSON.parse(readFileSync(0, 'utf8'));
const results = [];
for (const {seed, automatic, coins, cards} of cases) {
  let state = seed;
  let clock = Date.parse(date);
  const service = createReadingTaskService(':memory:', {
    random: () => (state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 2**32,
    now: () => clock,
    understand: async () => ({focus, clarification: '', source: 'model'}),
  });
  try {
    const {proof} = await service.understandQuestion({question, requireModel: true});
    const {token, task} = service.start({method: 'combined', profile: 'three-methods-v1', question, focus, proof, automatic});
    const states = [task];
    if (!automatic) {
      states.push(service.toss(token, coins[0]));
      clock += 2000;
      for (const coin of coins.slice(1)) states.push(service.toss(token, coin));
      for (const card of cards) states.push(service.pick(token, card));
      states.push(service.toss(token, coins[0]));
      states.push(service.pick(token, cards[0]));
    }
    results.push(states.map(({evidence, followUps, ...chart}) => chart));
  } finally {
    service.close();
  }
}
process.stdout.write(JSON.stringify(results));
''';

String _eventId(int suffix) =>
    '00000000-0000-4000-8000-'
    '${suffix.toString().padLeft(12, '0')}';

void _throwsCode(String code, void Function() action) {
  try {
    action();
  } on GuideRitualError catch (error) {
    if (error.code == code) return;
    throw StateError('Expected $code, got ${error.code}');
  }
  throw StateError('Expected $code, but action succeeded.');
}

Future<void> main() async {
  final coins = List.generate(
    6,
    (step) => GuideCoinEvent(actionId: _eventId(step), step: step),
  );
  final times = ['9007199254740993', '1794528001003', '1794528001003'];
  final cards = List.generate(
    3,
    (step) => GuideCardEvent(
      actionId: _eventId(step + 6),
      step: step,
      slot: [77, 0, 35][step],
      epochMs: times[step],
      monotonicMs: [1799.25, 1799.5, 1800.0][step],
      clockSessionId: _eventId(9),
    ),
  );
  final cases = [
    for (final seed in [0, 1, 26, 105, 999])
      for (final automatic in [false, true]) (seed, automatic),
  ];
  final expected = await runLegacyOracle(_legacyProgram, {
    'question': _question,
    'focus': _focus,
    'date': _date,
    'cases': [
      for (final (seed, automatic) in cases)
        {
          'seed': seed,
          'automatic': automatic,
          'coins': coins.map((coin) => coin.toJson()).toList(),
          'cards': cards.map((card) => card.toJson()).toList(),
        },
    ],
  });

  var snapshots = 0;
  for (var index = 0; index < cases.length; index++) {
    final (seed, automatic) = cases[index];
    var random = seed;
    var clock = DateTime.parse(_date);
    var randomCalls = 0;
    final ritual = GuideRitual(
      question: _question,
      focus: _focus,
      automatic: automatic,
      now: () => clock,
      random: () {
        randomCalls++;
        random = (random * 1664525 + 1013904223) & 0xffffffff;
        return random / 0x100000000;
      },
    );
    final actual = [ritual.snapshot.toChartSnapshotJson()];
    if (!automatic) {
      _throwsCode('selection_out_of_order', () => ritual.pick(cards.first));
      _throwsCode('toss_out_of_order', () => ritual.toss(coins[1]));
      actual.add(ritual.toss(coins.first).toChartSnapshotJson());
      clock = clock.add(const Duration(seconds: 2));
      for (final coin in coins.skip(1)) {
        actual.add(ritual.toss(coin).toChartSnapshotJson());
      }
      _throwsCode(
        'invalid_slot',
        () => ritual.pick(
          GuideCardEvent(
            actionId: cards.first.actionId,
            clockSessionId: cards.first.clockSessionId,
            step: 0,
            slot: 78,
            monotonicMs: 0,
            epochMs: times.first,
          ),
        ),
      );
      for (final card in cards) {
        actual.add(ritual.pick(card).toChartSnapshotJson());
      }
      final calls = randomCalls;
      actual.add(ritual.toss(coins.first).toChartSnapshotJson());
      actual.add(ritual.pick(cards.first).toChartSnapshotJson());
      _throwsCode(
        'action_conflict',
        () => ritual.toss(
          GuideCoinEvent(actionId: coins.first.actionId, step: 1),
        ),
      );
      if (calls != randomCalls || ritual.snapshot.stage != GuideStage.reading) {
        throw StateError('A replay changed the completed ritual.');
      }
    }
    final legacy = expected[index] as List;
    if (legacy.length != actual.length) {
      throw StateError('Wrong snapshot count for ${cases[index]}.');
    }
    for (var step = 0; step < actual.length; step++) {
      if (!deepEquals(actual[step], legacy[step])) {
        final old = legacy[step] as Map;
        final keys = {...actual[step].keys, ...old.keys};
        final different = keys.where(
          (key) => !deepEquals(actual[step][key], old[key]),
        );
        throw StateError(
          'Ritual mismatch for ${cases[index]}, step $step: '
          '${different.map((key) => '$key = ${old[key]} vs ${actual[step][key]}').join(', ')}',
        );
      }
    }
    snapshots += actual.length;
  }
  stdout.writeln(
    '${cases.length} guided rituals and $snapshots snapshots match the legacy service, including chart hashes.',
  );
}
