import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/view/guide_form.dart';
import '../src/features/divination/view/ritual/guide_ritual_dialog.dart';
import '../src/features/divination/view/ritual/tarot_deck.dart';
import '../src/features/divination/view/ritual/tarot_preparation.dart';
import '../src/ui/interface_language.dart';
import 'support/divination_service_fixture.dart';

void main() {
  testWidgets('preparation announces each saved animation phase in English', (
    tester,
  ) async {
    for (final (elapsed, label) in [
      (0, 'Shuffling the deck…'),
      (1810, 'Gathering the cards…'),
      (2400, 'Spreading the cards…'),
      (3440, 'Cutting the deck…'),
      (5500, 'The deck is ready'),
    ]) {
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [interfaceStringsDelegate],
          home: Center(
            child: SizedBox(
              width: 296,
              child: TarotDeckPreparation(
                key: ValueKey(elapsed),
                slotCount: 78,
                cutIndex: 39,
                seed: 7,
                initialProgress: elapsed / 5700,
                active: false,
                reducedMotion: false,
                progress: (_) {},
                finish: () {},
              ),
            ),
          ),
        ),
      );
      final status = find.byKey(const ValueKey('tarot-preparation-status'));
      expect(tester.widget<Text>(status).data, label);
      expect(
        find.ancestor(
          of: status,
          matching: find.byWidgetPredicate(
            (widget) =>
                widget is Semantics && widget.properties.liveRegion == true,
          ),
        ),
        findsOneWidget,
      );
    }
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'pauses at the server cut point and continues the same animation',
    (tester) async {
      var progress = 0.0;
      var finished = 0;
      Widget preparation({required bool active, double initial = 0}) =>
          MaterialApp(
            home: Material(
              child: Center(
                child: SizedBox(
                  width: 296,
                  child: TarotDeckPreparation(
                    slotCount: 78,
                    cutIndex: 39,
                    seed: 7,
                    initialProgress: initial,
                    active: active,
                    reducedMotion: false,
                    progress: (value) => progress = value,
                    finish: () => finished++,
                  ),
                ),
              ),
            ),
          );

      await tester.pumpWidget(preparation(active: true));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 3440));
      expect(find.byKey(const ValueKey('tarot-cut-marker')), findsOneWidget);
      final paused = progress;
      await tester.pumpWidget(preparation(active: false));
      await tester.pump(const Duration(seconds: 2));
      expect(progress, paused);
      expect(finished, 0);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(preparation(active: true, initial: paused));
      expect(find.byKey(const ValueKey('tarot-cut-marker')), findsOneWidget);
      await tester.pumpAndSettle(const Duration(milliseconds: 300));
      expect(finished, 1);
      expect(progress, 1);
    },
  );

  for (final reject in [false, true]) {
    testWidgets(
      reject
          ? 'the third card returns before a retry is shown'
          : 'keeps the third card in the selected position before opening the reveal',
      (tester) async {
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(320, 660);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        final service = DivinationServiceFixture()..failReport = false;
        final online = service.connect(DivinationRecoveryFixture());
        addTearDown(online.dispose);
        await online.start(divinationFixtureDetails, automatic: false);
        for (var toss = 0; toss < 6; toss++) {
          await online.toss();
        }
        await online.pick(37);
        await online.pick(38);

        final reply = Completer<void>();
        if (reject) {
          service.pickReply = reply.future;
          service.failNextPick = true;
        }
        final changes = ValueNotifier(0);
        final subscription = online.changes.listen((_) => changes.value++);
        addTearDown(() async {
          await subscription.cancel();
          changes.dispose();
        });
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Center(
                child: GuideRitualDialog(
                  presentation: GuideRitualPresentation()..preparation = 1,
                  changes: changes,
                  snapshot: () => online.reading?.snapshot,
                  busy: () => online.busy,
                  error: () => online.message,
                  retry: () => online.canRetry ? online.retry : null,
                  toss: () {},
                  choose: (slot) => unawaited(online.pick(slot)),
                  pause: () {},
                ),
              ),
            ),
          ),
        );
        await tester.pumpAndSettle();

        final card = find.bySemanticsLabel('选取第 41 张牌');
        final flight = find.byKey(const ValueKey('tarot-card-flight'));
        final fanTitle = find.text('选择三张塔罗牌');
        final revealTitle = find.text('翻开三张塔罗牌');
        final retry = find.text('重试仪式同步');
        double flightY() => tester.widget<Positioned>(flight).top!;

        tester.widget<Semantics>(card).properties.onTap!();
        await tester.pump();
        final origin = flightY();
        expect(fanTitle, findsOneWidget);
        expect(revealTitle, findsNothing);
        expect(card, findsNothing);
        await tester.pump(const Duration(milliseconds: 160));
        expect(flightY(), lessThan(origin - 20));
        expect(revealTitle, findsNothing);
        expect(find.text('已选 2 / 3 张'), findsOneWidget);

        await tester.pump(const Duration(milliseconds: 305));
        if (reject) {
          // A slow response must keep the card at its destination.
          final landed = flightY();
          await tester.pump(const Duration(milliseconds: 150));
          expect(flightY(), landed);
          expect(retry, findsNothing);
          reply.complete();
          await tester.pump();
          await tester.pump();
          await tester.pump(const Duration(milliseconds: 80));
          expect(flightY(), greaterThan(landed));
          expect(retry, findsNothing);
          await tester.pump(const Duration(milliseconds: 180));
          await tester.pumpAndSettle();
          expect(flight, findsNothing);
          expect(card, findsOneWidget);
          expect(find.text('已选 2 / 3 张'), findsOneWidget);
          expect(retry, findsOneWidget);
          expect(fanTitle, findsOneWidget);
          expect(revealTitle, findsNothing);

          await tester.ensureVisible(retry);
          await tester.tap(retry);
          await tester.pumpAndSettle();
          final picks = [
            for (final (index, call) in service.calls.indexed)
              if (call == 'POST /reading/pick') service.transmitted[index],
          ];
          expect(picks, hasLength(4));
          expect(picks[2]['actionId'], picks[3]['actionId']);
          expect(picks[3]['slot'], 40);
        } else {
          expect(flight, findsNothing);
          expect(fanTitle, findsOneWidget);
          expect(find.text('已选 3 / 3 张'), findsOneWidget);
          expect(revealTitle, findsNothing);
          await tester.pump(const Duration(milliseconds: 150));
          await tester.pumpAndSettle();
        }
        expect(revealTitle, findsOneWidget);
        expect(find.bySemanticsLabel('翻开趋势牌'), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }

  testWidgets(
    'manual ritual can pause, reveal, and continue to chart at 360dp',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 640);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final service = DivinationServiceFixture()..failReport = false;
      final online = service.connect(DivinationRecoveryFixture());
      addTearDown(online.dispose);
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            child: child!,
          ),
          home: GuideForm(online: online),
        ),
      );
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextFormField), '我这次面试后续会怎样？');
      await tester.pump();
      await tester.tap(find.byTooltip('发送消息'));
      await tester.pumpAndSettle();
      final toss = find.byKey(const ValueKey('coin-ritual-toss-button'));
      for (var index = 0; index < 6; index++) {
        await tester.ensureVisible(toss);
        await tester.tap(toss);
        await tester.pumpAndSettle();
      }

      expect(find.byType(TarotDeckPreparation), findsNothing);
      expect(find.bySemanticsLabel('78 张塔罗牌阵'), findsOneWidget);
      final scroll = find.byKey(const ValueKey('tarot-fan-scroll'));
      final scrollView = tester.widget<SingleChildScrollView>(scroll);
      final resting = scrollView.controller!.offset;
      await tester.tap(find.byTooltip('向右浏览牌阵'));
      await tester.pumpAndSettle();
      expect(scrollView.controller!.offset, greaterThan(resting));
      await tester.tap(find.byTooltip('向左浏览牌阵'));
      await tester.pumpAndSettle();
      expect(scrollView.controller!.offset, closeTo(resting, 0.01));
      final center = find.bySemanticsLabel('选取第 40 张牌');
      expect(center, findsOneWidget);
      tester.widget<Semantics>(center).properties.onTap!();
      await tester.pumpAndSettle();
      expect(center, findsNothing);
      expect(find.text('已选 1 / 3 张'), findsOneWidget);

      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('继续本次仪式'));
      await tester.pumpAndSettle();
      expect(find.text('已选 1 / 3 张'), findsOneWidget);
      expect(center, findsNothing);
      for (final position in [38, 39]) {
        final card = find.bySemanticsLabel('选取第 $position 张牌');
        tester.widget<Semantics>(card).properties.onTap!();
        await tester.pumpAndSettle();
      }
      final present = find.bySemanticsLabel('翻开现状牌');
      expect(present, findsOneWidget);
      tester.widget<Semantics>(present).properties.onTap!();
      await tester.pumpAndSettle();
      expect(present, findsNothing);
      final faces = find.descendant(
        of: find.byKey(const ValueKey('guide-ritual-dialog')),
        matching: find.byWidgetPredicate(
          (widget) =>
              widget is Image &&
              widget.image is AssetImage &&
              (widget.image as AssetImage).assetName != tarotBack,
        ),
      );
      expect(faces, findsOneWidget);

      await tester.tap(find.text('一键翻牌'));
      await tester.pumpAndSettle();
      expect(faces, findsNWidgets(3));
      await tester.tap(find.text('查看解读'));
      await tester.pumpAndSettle();
      expect(find.byKey(const ValueKey('guide-ritual-dialog')), findsNothing);
      final charts = find.text('查看三套盘面');
      await tester.ensureVisible(charts);
      await tester.tap(charts);
      await tester.pumpAndSettle();
      expect(find.text('梅花取数来自三次抽牌的点击时刻。'), findsOneWidget);
      expect(
        service.calls.where((call) => call == 'POST /reading/toss'),
        hasLength(6),
      );
      expect(
        service.calls.where((call) => call == 'POST /reading/pick'),
        hasLength(3),
      );
      expect(service.calls.last, 'POST /reading/report');
      expect(tester.takeException(), isNull);
    },
  );
}
