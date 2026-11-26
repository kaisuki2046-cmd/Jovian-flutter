import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/view/ritual/coin_cast_ritual.dart';
import '../src/features/divination/view/ritual/coin_toss_motion.dart';
import '../src/ui/interface_language.dart';

const _tossButton = ValueKey('coin-ritual-toss-button');
const _audioChannel = MethodChannel('jovian/coin_audio');

Widget _rig({
  required List<List<int>> tosses,
  required VoidCallback toss,
  required ValueChanged<int> settled,
  bool active = true,
  bool reducedMotion = false,
  bool pending = false,
  bool english = false,
  double width = 310,
}) => MaterialApp(
  localizationsDelegates: english ? const [interfaceStringsDelegate] : null,
  home: Scaffold(
    body: Align(
      alignment: Alignment.topCenter,
      child: SizedBox(
        width: width,
        child: SingleChildScrollView(
          child: CoinCastRitual(
            tosses: tosses,
            onToss: toss,
            onSettled: settled,
            active: active,
            reducedMotion: reducedMotion,
            pending: pending,
          ),
        ),
      ),
    ),
  ),
);

void main() {
  test(
    'coin layout keeps the ordered three real faces on the casting floor',
    () {
      for (final width in [248.0, 360.0, 560.0]) {
        final height = coinStageLayout(width).height;
        for (final (index, face) in [3, 2, 3].indexed) {
          final position = coinRestingPosition(width, index);
          final launch = coinTossPose(0, index, face, width, previous: 2);
          final flying = coinTossPose(0.42, index, face, width, previous: 2);
          final landed = coinTossPose(1, index, face, width, previous: 2);
          expect(visibleCoinFace(launch), 2);
          expect(visibleCoinFace(landed), face);
          expect(landed.x, closeTo(position.x, 0.001));
          expect(landed.y, closeTo(position.y, 0.001));
          expect(landed.y, lessThan(height));
          expect(flying.y, lessThan(landed.y - 100));
          expect(flying.shadowOpacity, lessThan(landed.shadowOpacity));
        }
      }
    },
  );

  testWidgets(
    'animates the sixth recorded toss once before showing its actual result',
    (tester) async {
      final tosses = <List<int>>[
        [2, 2, 2],
        [2, 2, 3],
        [2, 3, 2],
        [3, 2, 3],
        [3, 3, 3],
      ];
      final settled = <int>[];
      var attempts = 0;
      late StateSetter update;
      await tester.pumpWidget(
        StatefulBuilder(
          builder: (context, setState) {
            update = setState;
            return _rig(
              tosses: tosses,
              settled: settled.add,
              toss: () {
                attempts++;
                update(() {
                  tosses.add([3, 2, 3]);
                });
              },
            );
          },
        ),
      );
      await tester.pumpAndSettle();
      expect(settled, isEmpty);
      expect(find.text('已投 5 / 6 次'), findsOneWidget);
      await tester.tap(find.byKey(_tossButton));
      await tester.pump();
      expect(find.text('正在投掷…'), findsOneWidget);
      expect(find.text('已投 5 / 6 次'), findsOneWidget);
      expect(find.text('已投 6 / 6 次'), findsNothing);
      expect(tester.widget<InkWell>(find.byKey(_tossButton)).onTap, isNull);
      await tester.pump(const Duration(milliseconds: 1600));
      expect(settled, isEmpty);
      await tester.pump(const Duration(milliseconds: 1300));
      await tester.pumpAndSettle();
      expect(attempts, 1);
      expect(settled, [6]);
      expect(find.text('六爻已成'), findsOneWidget);
      expect(find.text('上爻 · 背 / 字 / 背 · 8'), findsOneWidget);
      expect(find.text('已投 6 / 6 次'), findsOneWidget);
      expect(
        find.byKey(const ValueKey('coin-ritual-face-0-3')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('coin-ritual-face-1-2')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey('coin-ritual-face-2-3')),
        findsOneWidget,
      );
      expect(tester.widget<InkWell>(find.byKey(_tossButton)).onTap, isNull);
    },
  );

  testWidgets(
    'reduced motion and pending state keep authoritative results without replay',
    (tester) async {
      final settled = <int>[];
      final tosses = <List<int>>[];
      var pressed = 0;
      Widget page({bool pending = false}) => _rig(
        tosses: tosses,
        toss: () => pressed++,
        settled: settled.add,
        pending: pending,
        reducedMotion: true,
        width: 250,
      );
      await tester.pumpWidget(page(pending: true));
      expect(find.text('等待投掷结果…'), findsOneWidget);
      expect(tester.widget<InkWell>(find.byKey(_tossButton)).onTap, isNull);
      await tester.pumpWidget(page());
      await tester.tap(find.byKey(_tossButton));
      tosses.add([3, 2, 2]);
      await tester.pumpWidget(page());
      await tester.pump();
      expect(pressed, 1);
      expect(settled, [1]);
      expect(find.text('初爻 · 背 / 字 / 字 · 7'), findsOneWidget);
      expect(find.text('正在投掷…'), findsNothing);
      await tester.pumpWidget(page());
      await tester.pumpAndSettle();
      expect(settled, [1]);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('localizes coin controls and ordered face semantics in English', (
    tester,
  ) async {
    Widget page(List<List<int>> tosses, {bool pending = false}) => _rig(
      tosses: tosses,
      toss: () {},
      settled: (_) {},
      pending: pending,
      english: true,
      width: 286,
    );

    await tester.pumpWidget(page([]));
    expect(find.text('Toss three coins'), findsOneWidget);
    expect(find.text('Marked side = 2, reverse side = 3'), findsOneWidget);
    expect(find.text('Line 1'), findsOneWidget);
    expect(find.bySemanticsLabel('Six tosses'), findsOneWidget);
    expect(find.bySemanticsLabel('Three coins ready to toss'), findsOneWidget);

    await tester.pumpWidget(page([], pending: true));
    expect(
      find.bySemanticsLabel('Waiting for the toss result…'),
      findsOneWidget,
    );

    const first = [
      [3, 2, 3],
    ];
    await tester.pumpWidget(page(first));
    expect(find.text('Tossing…'), findsOneWidget);
    expect(
      find.text('The coins are turning. Wait for them to settle…'),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Tossing three coins'), findsOneWidget);
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel('Toss 2'), findsOneWidget);
    expect(find.text('Tossed 1 / 6'), findsOneWidget);
    expect(
      find.text('Line 1 · Reverse / Marked / Reverse · 8'),
      findsOneWidget,
    );
    expect(
      find.bySemanticsLabel(
        'Coin 1: reverse side; Coin 2: marked side; Coin 3: reverse side',
      ),
      findsOneWidget,
    );

    await tester.pumpWidget(page(List.filled(6, first.single)));
    await tester.pumpAndSettle();
    expect(find.text('Six lines complete'), findsOneWidget);
    expect(find.text('Tossed 6 / 6'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('settles and stops an in-flight toss when hidden', (
    tester,
  ) async {
    final settled = <int>[];
    Widget page(List<List<int>> tosses, {bool active = true}) =>
        _rig(tosses: tosses, toss: () {}, settled: settled.add, active: active);
    await tester.pumpWidget(page([]));
    final result = [
      [2, 3, 2],
    ];
    await tester.pumpWidget(page(result));
    expect(find.text('正在投掷…'), findsOneWidget);
    await tester.pumpWidget(page(result, active: false));
    await tester.pump();
    expect(settled, [1]);
    expect(find.text('初爻 · 字 / 背 / 字 · 7'), findsOneWidget);
    expect(tester.widget<InkWell>(find.byKey(_tossButton)).onTap, isNull);
    await tester.pumpWidget(page(result));
    await tester.pumpAndSettle();
    expect(settled, [1]);
    expect(find.text('正在投掷…'), findsNothing);
  });

  testWidgets('native sound follows the toss and stops when the view leaves', (
    tester,
  ) async {
    final audio = _recordAudio(tester);
    final result = [
      [2, 3, 2],
    ];
    Widget page(List<List<int>> tosses, {bool active = true}) =>
        _rig(tosses: tosses, toss: () {}, settled: (_) {}, active: active);
    await tester.pumpWidget(page([]));
    expect(audio.single.method, 'prepare');
    expect(audio.single.arguments, hasLength(3));
    await tester.pumpWidget(page(result));
    expect(_variants(audio), [0]);
    await tester.pump(const Duration(milliseconds: 400));
    expect(_variants(audio), [0, 1, 2]);
    await tester.pump(const Duration(milliseconds: 1570));
    expect(_variants(audio), [0, 1, 2, 0]);
    await tester.pumpWidget(page(result, active: false));
    expect(audio.last.method, 'stop');
    await tester.pumpAndSettle();
    await tester.pump(coinTossDuration);
    expect(_variants(audio), [0, 1, 2, 0]);
  });

  testWidgets('reduced motion plays one sound and never replays saved tosses', (
    tester,
  ) async {
    final audio = _recordAudio(tester);
    final first = [
      [2, 3, 2],
    ];
    final second = [
      ...first,
      [2, 2, 3],
    ];
    Widget page(List<List<int>> tosses) =>
        _rig(tosses: tosses, toss: () {}, settled: (_) {}, reducedMotion: true);
    await tester.pumpWidget(page(first));
    expect(_variants(audio), isEmpty);
    await tester.pumpWidget(page(second));
    await tester.pump(coinTossDuration);
    expect(_variants(audio), [0]);
    await tester.pumpWidget(const SizedBox());
    expect(audio.last.method, 'stop');
  });
}

List<MethodCall> _recordAudio(WidgetTester tester) {
  final audio = <MethodCall>[];
  final messenger = tester.binding.defaultBinaryMessenger;
  messenger.setMockMethodCallHandler(_audioChannel, (call) async {
    audio.add(call);
    return null;
  });
  addTearDown(() => messenger.setMockMethodCallHandler(_audioChannel, null));
  return audio;
}

List<int> _variants(List<MethodCall> calls) => [
  for (final call in calls)
    if (call.method == 'strike') call.arguments['variant'] as int,
];
