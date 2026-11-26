import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/view/ritual/coin_cast_ritual.dart';
import '../src/features/divination/view/ritual/coin_toss_motion.dart';

const _tossButton = ValueKey('coin-ritual-toss-button');

Widget _rig({
  required List<List<int>> tosses,
  required VoidCallback toss,
  required ValueChanged<int> settled,
  bool active = true,
  bool reducedMotion = false,
  bool pending = false,
  double width = 310,
}) => MaterialApp(
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
}
