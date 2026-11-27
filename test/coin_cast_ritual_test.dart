import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/view/ritual/coin_cast_ritual.dart';
import '../src/features/divination/view/ritual/coin_toss_motion.dart';
import '../src/ui/interface_language.dart';

const _tossButton = ValueKey('coin-ritual-toss-button');
const _lines = ValueKey('coin-ritual-lines');
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

  test('headroom raises the flight without enlarging the floor or coins', () {
    const width = 280.0;
    const heightLimit = 240.0;
    const headroom = 64.0;
    final original = coinStageLayout(width, heightLimit: heightLimit);
    final taller = coinStageLayout(
      width,
      heightLimit: heightLimit,
      headroom: headroom,
    );
    expect(coinTossDuration, const Duration(milliseconds: 1500));
    expect(taller.height, original.height + headroom);
    expect(taller.baseHeight, original.baseHeight);
    expect(taller.coinSize, original.coinSize);
    expect(taller.thickness, original.thickness);
    for (var index = 0; index < coinLandingTimes.length; index++) {
      CoinPose pose(double time, double extra) => coinTossPose(
        time,
        index,
        2,
        width,
        heightLimit: heightLimit,
        headroom: extra,
      );
      final floor = pose(1, 0);
      final lowerFloor = pose(1, headroom);
      expect(lowerFloor.x, floor.x);
      expect(lowerFloor.y - floor.y, closeTo(headroom, 0.001));
      final originalLift = floor.y - pose(0.42, 0).y;
      final tallerLift = lowerFloor.y - pose(0.42, headroom).y;
      expect(tallerLift, greaterThan(originalLift + 40));
    }
  });

  test(
    'coins slow on ascent and speed up on descent under the same gravity',
    () {
      const width = 360.0;
      final accelerations = <double>[];
      for (final (index, landing) in coinLandingTimes.indexed) {
        double y(double time) => coinTossPose(time, index, 2, width).y;
        final positions = [
          for (var step = 0; step < 6; step++) y(0.16 + step * 0.1),
        ];
        final distances = [
          for (var step = 1; step < positions.length; step++)
            positions[step] - positions[step - 1],
        ];
        expect(distances.first, lessThan(-40));
        expect(distances[1], lessThan(0));
        expect(distances[3], greaterThan(0));
        expect(distances.last, greaterThan(40));
        accelerations.addAll([
          for (var step = 1; step < distances.length; step++)
            distances[step] - distances[step - 1],
        ]);
        final rest = coinRestingPosition(width, index).y;
        expect(y(landing), closeTo(rest, 0.001));
        expect(y(landing + 0.06), lessThan(rest));
        expect(y(1), closeTo(rest, 0.001));
      }
      expect(accelerations.first, greaterThan(0));
      expect(accelerations, everyElement(closeTo(accelerations.first, 0.001)));
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
      await tester.pump(coinTossDuration);
      expect(settled, isEmpty);
      expect(find.text('静心凝神，每次投掷时想着问题。'), findsOneWidget);
      expect(find.byKey(const ValueKey('coin-ritual-gold')), findsOneWidget);
      final firstCoin = find.byKey(const ValueKey('coin-ritual-coin-0'));
      final restingY = tester.widget<Positioned>(firstCoin).top!;
      expect(find.text('已完成 5 / 6 次'), findsOneWidget);
      await tester.tap(find.byKey(_tossButton));
      await tester.pump();
      expect(find.text('正在投掷…'), findsOneWidget);
      expect(find.text('已完成 5 / 6 次'), findsOneWidget);
      expect(find.text('已完成 6 / 6 次'), findsNothing);
      expect(tester.widget<InkWell>(find.byKey(_tossButton)).onTap, isNull);
      await tester.pump(coinTossDuration * 0.42);
      expect(
        tester.widget<Positioned>(firstCoin).top!,
        lessThan(restingY - 90),
      );
      await tester.pump(coinTossDuration * 0.55);
      expect(settled, isEmpty);
      await tester.pump(const Duration(milliseconds: 60));
      expect(attempts, 1);
      expect(settled, [6]);
      expect(find.text('六爻已成'), findsOneWidget);
      expect(tester.widget<Positioned>(firstCoin).top, closeTo(restingY, 1));
      expect(find.text('上爻 · 背 / 字 / 背 · 8'), findsOneWidget);
      expect(find.text('已完成 6 / 6 次'), findsOneWidget);
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
      final completedLines = _paintedLines(tester);
      await tester.pump(const Duration(milliseconds: 600));
      expect(_paintedLines(tester), completedLines);
    },
  );

  testWidgets(
    'only uncast lines pulse and the first-toss caption lasts until tapped',
    (tester) async {
      final tosses = <List<int>>[];
      var presses = 0;
      Widget page() =>
          _rig(tosses: tosses, toss: () => presses++, settled: (_) {});
      await tester.pumpWidget(page());
      final prompt = find.text('点击龟壳开始投掷');
      expect(prompt, findsOneWidget);
      final dim = _paintedLines(tester);
      expect(dim, hasLength(6));
      await tester.pump(const Duration(milliseconds: 800));
      final bright = _paintedLines(tester);
      for (final (index, line) in bright.indexed) {
        expect(line.color, isNot(dim[index].color));
        expect(line.end.dx - line.start.dx, greaterThan(42));
      }
      expect(prompt, findsOneWidget);
      expect(find.text('初爻'), findsNothing);

      await tester.tap(find.byKey(_tossButton));
      await tester.pump();
      expect(presses, 1);
      expect(prompt, findsNothing);

      tosses.add([3, 2, 3]);
      await tester.pumpWidget(page());
      await tester.pump();
      await tester.pump(coinTossDuration + const Duration(milliseconds: 50));
      expect(find.text('已完成 1 / 6 次'), findsOneWidget);
      final first = _paintedLines(tester);
      expect(first, hasLength(7));
      expect(first[5].start.dy, first[6].start.dy);
      expect(first[5].end.dx, lessThan(first[6].start.dx));
      expect(first[5].start.dy, greaterThan(first[4].start.dy));
      final yin = first.skip(5).toList();
      await tester.pump(const Duration(milliseconds: 800));
      final later = _paintedLines(tester);
      for (var index = 0; index < 5; index++) {
        expect(later[index].color, isNot(first[index].color));
      }
      expect(later.skip(5), yin);

      await tester.sendKeyEvent(LogicalKeyboardKey.tab);
      await tester.pump();
      await tester.sendKeyEvent(LogicalKeyboardKey.enter);
      await tester.pump();
      expect(presses, 2);
      tosses.add([2, 2, 3]);
      await tester.pumpWidget(page());
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));
      expect(_paintedLines(tester).skip(5), yin);
      await tester.pump(coinTossDuration);
      final second = _paintedLines(tester);
      expect(second.skip(5), yin);
      expect(second[4].color, yin.first.color);
      expect(second[4].start.dx, yin.first.start.dx);
      expect(second[4].end.dx, yin.last.end.dx);
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
      expect(find.byKey(const ValueKey('coin-ritual-gold')), findsNothing);
      expect(find.text('正在投掷…'), findsOneWidget);
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
      await tester.pump(coinTossDuration);
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
    expect(find.text('Tap the shell to start tossing'), findsOneWidget);
    expect(
      find.text(
        'Clear your mind and hold your question in mind with each toss.',
      ),
      findsOneWidget,
    );
    expect(find.text('Line 1'), findsNothing);
    expect(find.bySemanticsLabel('Six tosses'), findsOneWidget);
    expect(find.bySemanticsLabel('Three coins ready to toss'), findsOneWidget);

    await tester.pumpWidget(page([], pending: true));
    expect(find.bySemanticsLabel('Tossing…'), findsOneWidget);

    const first = [
      [3, 2, 3],
    ];
    await tester.pumpWidget(page(first));
    expect(find.text('Tossing…'), findsOneWidget);
    expect(find.text('Waiting for the coins to land…'), findsOneWidget);
    expect(find.bySemanticsLabel('Tossing three coins'), findsOneWidget);
    await tester.pump();
    await tester.pump(coinTossDuration + const Duration(milliseconds: 50));

    await tester.ensureVisible(find.byKey(_tossButton));
    await tester.pump();
    expect(find.bySemanticsLabel('Toss 2'), findsOneWidget);
    expect(find.text('Completed 1 / 6'), findsOneWidget);
    expect(
      tester.getSemantics(find.bySemanticsLabel('Six tosses')).value,
      'Line 1 8',
    );
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
    await tester.pump(coinTossDuration);
    expect(find.text('Six lines complete'), findsOneWidget);
    expect(find.text('Completed 6 / 6'), findsOneWidget);
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
    await tester.pump(coinTossDuration);
    expect(settled, [1]);
    expect(find.text('正在投掷…'), findsNothing);
  });

  testWidgets('native sound follows the toss and stops when the view leaves', (
    tester,
  ) async {
    final audio = _recordAudio(tester);
    final haptics = <Object?>[];
    final messenger = tester.binding.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
      if (call.method == 'HapticFeedback.vibrate') haptics.add(call.arguments);
      return null;
    });
    addTearDown(
      () => messenger.setMockMethodCallHandler(SystemChannels.platform, null),
    );
    final result = [
      [2, 3, 2],
    ];
    Widget page(List<List<int>> tosses, {bool active = true}) =>
        _rig(tosses: tosses, toss: () {}, settled: (_) {}, active: active);
    await tester.pumpWidget(page([]));
    expect(audio.single.method, 'prepare');
    expect(audio.single.arguments, hasLength(3));
    await tester.tap(find.byKey(_tossButton));
    await tester.pump();
    expect(haptics, ['HapticFeedbackType.selectionClick']);
    await tester.pumpWidget(page(result));
    expect(_variants(audio), [0]);
    const afterShakeCues = Duration(milliseconds: 400);
    await tester.pump(afterShakeCues);
    expect(_variants(audio), [0, 1, 0]);
    final firstLanding = coinTossDuration * coinLandingTimes.first;
    await tester.pump(
      firstLanding - afterShakeCues + const Duration(milliseconds: 10),
    );
    expect(_variants(audio), [0, 1, 0, 2]);
    expect(haptics.last, 'HapticFeedbackType.mediumImpact');
    await tester.pump(coinTossDuration * coinLandingTimes[1] - firstLanding);
    expect(haptics.last, 'HapticFeedbackType.lightImpact');
    await tester.pumpWidget(page(result, active: false));
    expect(audio.last.method, 'stop');
    await tester.pump(coinTossDuration);
    await tester.pump(coinTossDuration);
    expect(_variants(audio), [0, 1, 0, 2]);
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

List<({Offset start, Offset end, Color color})> _paintedLines(
  WidgetTester tester,
) {
  final lines = find.byKey(_lines);
  final canvas = TestRecordingCanvas();
  tester
      .widget<CustomPaint>(lines)
      .painter!
      .paint(canvas, tester.getSize(lines));
  return [
    for (final call in canvas.invocations)
      if (call.invocation.memberName == #drawLine)
        (
          start: call.invocation.positionalArguments[0] as Offset,
          end: call.invocation.positionalArguments[1] as Offset,
          color: (call.invocation.positionalArguments[2] as Paint).color,
        ),
  ];
}
