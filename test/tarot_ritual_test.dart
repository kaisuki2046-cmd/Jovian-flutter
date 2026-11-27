import 'dart:async';

import 'package:flutter/gestures.dart';
import 'package:flutter/services.dart';
import 'package:jovian_divination/jovian_divination.dart' hide TarotSpread;
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/view/guide_form.dart';
import '../src/features/divination/view/ritual/guide_ritual_dialog.dart';
import '../src/features/divination/view/ritual/tarot_deck.dart';
import '../src/features/divination/view/ritual/tarot_preparation.dart';
import '../src/features/divination/view/ritual/tarot_spread.dart';
import '../src/ui/interface_language.dart';
import 'support/divination_service_fixture.dart';
import 'support/tarot_gestures.dart';

void main() {
  for (final kind in [PointerDeviceKind.touch, PointerDeviceKind.mouse]) {
    testWidgets('dragging with ${kind.name} leaves cards along the path', (
      tester,
    ) async {
      const slotCount = 78;
      final layout = TarotTableLayout(310, slotCount, extraHeight: 70);
      final spread = TarotSpread(slotCount, seed: 14);
      final picked = <int>{};
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: Center(
              child: StatefulBuilder(
                builder: (_, update) => TarotSpreadTable(
                  layout: layout,
                  spread: spread,
                  held: picked,
                  busy: false,
                  reducedMotion: false,
                  animateBacks: false,
                  choose: (slot, _) => update(() => picked.add(slot)),
                ),
              ),
            ),
          ),
        ),
      );

      final packet = find.byKey(const ValueKey('tarot-packet'));
      final opened = find.byWidgetPredicate((widget) {
        final key = widget.key;
        return widget is Positioned &&
            key is ValueKey<String> &&
            key.value.startsWith('tarot-slot-');
      });
      expect(opened, findsNothing);
      expect(tester.widget<TarotPileArt>(find.byType(TarotPileArt)).count, 78);
      final gesture = await tester.startGesture(
        tester.getCenter(packet),
        kind: kind,
      );
      await gesture.moveBy(const Offset(65, 0));
      await tester.pump();
      final straight = tester.widgetList<Positioned>(opened).toList();
      expect(straight.length, greaterThan(10));
      final gaps = [
        for (var index = 1; index < straight.length; index++)
          straight[index].left! - straight[index - 1].left!,
      ];
      expect(gaps.map((gap) => gap.round()).toSet().length, greaterThan(1));
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.widgetList<Positioned>(opened), straight);
      await gesture.moveBy(const Offset(0, -44));
      await tester.pump();
      final bent = tester.widgetList<Positioned>(opened).toList();
      expect(bent.length, greaterThan(straight.length));
      expect(bent.last.top!, lessThan(straight.last.top! - 20));
      expect(
        tester.widget<TarotPileArt>(find.byType(TarotPileArt)).count,
        slotCount - bent.length,
      );
      await gesture.up();
      await tester.pump();

      final first = find.bySemanticsLabel('选取第 1 张牌');
      final next = find.bySemanticsLabel('选取第 2 张牌');
      final glow = find.byKey(const ValueKey('tarot-preview-light'));
      tester.widget<Semantics>(first).properties.onTap!();
      await tester.pump();
      expect(glow, findsOneWidget);
      expect(tester.widget<Semantics>(first).properties.selected, isTrue);
      expect(picked, isEmpty);
      tester.widget<Semantics>(next).properties.onTap!();
      await tester.pump();
      expect(tester.widget<Semantics>(first).properties.selected, isFalse);
      expect(tester.widget<Semantics>(next).properties.selected, isTrue);
      expect(picked, isEmpty);
      tester.widget<Semantics>(next).properties.onTap!();
      await tester.pumpAndSettle();
      expect(next, findsNothing);
      expect(picked, {1});

      final pileAction = find.bySemanticsLabel('推开牌堆');
      Focus.of(tester.element(pileAction)).requestFocus();
      await tester.pump();
      final beforeKey = opened.evaluate().length;
      await tester.sendKeyEvent(LogicalKeyboardKey.arrowLeft);
      await tester.pump();
      expect(opened.evaluate().length, greaterThan(beforeKey));
      // The assistive action offers successive pushes without a pointer.
      await openTarotCard(tester, 78);
      expect(packet, findsNothing);
      expect(opened, findsNWidgets(slotCount - picked.length));
      expect(tester.takeException(), isNull);
    });
  }

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

        final card = await openTarotCard(tester, 41);
        final flight = find.byKey(const ValueKey('tarot-card-flight'));
        final lights = find.byKey(const ValueKey('tarot-back-lights'));
        final slotLights = find.descendant(
          of: find.byType(AspectRatio),
          matching: lights,
        );
        final fanTitle = find.text('选择三张塔罗牌');
        final revealTitle = find.text('翻开三张塔罗牌');
        final retry = find.text('重试仪式同步');
        Positioned flyingCard() => tester.widget<Positioned>(flight);
        double flightY() => flyingCard().top!;
        double yawProjection() => tester
            .widget<Transform>(
              find
                  .descendant(of: flight, matching: find.byType(Transform))
                  .first,
            )
            .transform
            .entry(2, 0);

        final inFan = tester.widget<Positioned>(
          find.byKey(const ValueKey('tarot-slot-40')),
        );
        expect(inFan.width! / inFan.height!, closeTo(2 / 3, .001));
        expect(slotLights, findsNWidgets(2));
        expect(
          find.descendant(of: find.byType(TarotSpreadTable), matching: lights),
          findsWidgets,
        );
        await confirmTarotCard(tester, card);
        final origin = flightY();
        expect(fanTitle, findsOneWidget);
        expect(revealTitle, findsNothing);
        expect(card, findsNothing);
        expect(slotLights, findsNWidgets(2));
        await tester.pump(const Duration(milliseconds: 220));
        expect(flightY(), lessThan(origin - 30));
        expect(yawProjection(), closeTo(0, .001));
        await tester.pump(const Duration(milliseconds: 430));
        final leftTurn = flyingCard();
        final leftYaw = yawProjection();
        expect(
          find.descendant(
            of: flight,
            matching: find.byWidgetPredicate(
              (widget) =>
                  widget is TarotBackArt && widget.hoverProgress != null,
            ),
          ),
          findsOneWidget,
        );
        await tester.pump(const Duration(milliseconds: 500));
        final rightTurn = flyingCard();
        expect(rightTurn.left!, closeTo(leftTurn.left!, .1));
        expect(rightTurn.top!, closeTo(leftTurn.top!, .1));
        expect(leftYaw * yawProjection(), lessThan(0));
        expect(rightTurn.width! / rightTurn.height!, closeTo(2 / 3, .001));

        await tester.pump(const Duration(milliseconds: 350));
        expect(flightY(), greaterThan(rightTurn.top!));
        expect(revealTitle, findsNothing);
        expect(find.text('已选 2 / 3 张'), findsOneWidget);

        await tester.pump(const Duration(milliseconds: 80));
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
          expect(slotLights, findsNWidgets(3));
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

  testWidgets('manual ritual picks and reveals Tarot before casting at 360dp', (
    tester,
  ) async {
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
    final surface = find.byKey(const ValueKey('guide-ritual-surface'));
    final bounds = tester.getRect(surface);
    expect(bounds, const Rect.fromLTWH(12, 8, 336, 624));
    final toss = find.byKey(const ValueKey('coin-ritual-toss-button'));
    expect(toss, findsNothing);
    expect(find.text('第 1 步 · 塔罗选牌'), findsOneWidget);
    expect(find.byType(TarotDeckPreparation), findsNothing);
    expect(find.bySemanticsLabel('78 张塔罗牌阵'), findsOneWidget);
    final center = await openTarotCard(tester, 40);
    await confirmTarotCard(tester, center);
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
      final card = await openTarotCard(tester, position);
      await confirmTarotCard(tester, card);
      await tester.pumpAndSettle();
    }
    expect(find.text('第 1 步 · 塔罗翻牌'), findsOneWidget);
    expect(tester.getRect(surface), bounds);
    expect(find.textContaining('六爻卜卦结果'), findsNothing);
    expect(toss, findsNothing);
    expect(service.calls, isNot(contains('POST /reading/toss')));
    expect(service.calls, isNot(contains('POST /reading/report')));
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
    await tester.tap(find.text('继续六爻起卦'));
    await tester.pumpAndSettle();
    expect(tester.getRect(surface), bounds);
    expect(find.text('第 2 步 · 六爻起卦'), findsNothing);
    final castTitle = find.text('投掷铜钱');
    expect(tester.widget<Text>(castTitle).textAlign, TextAlign.center);
    expect(
      tester.getCenter(castTitle).dx,
      closeTo(
        tester.getCenter(find.byKey(const ValueKey('guide-ritual-dialog'))).dx,
        0.1,
      ),
    );
    for (var index = 0; index < 6; index++) {
      await tester.ensureVisible(toss);
      await tester.tap(toss);
      await tester.pumpAndSettle();
    }
    expect(find.text('翻开三张塔罗牌'), findsNothing);
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
  });

  testWidgets('cut and selection share the same deck bounds at 320dp', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 600);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final changes = ValueNotifier(0);
    addTearDown(changes.dispose);
    final ritual = GuideRitual(
      question: divinationFixtureDetails,
      focus: divinationFixtureFocus,
      automatic: false,
    );
    final presentation = GuideRitualPresentation()..preparation = 0.96;
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [interfaceStringsDelegate],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(1.4)),
          child: child!,
        ),
        home: Scaffold(
          body: GuideRitualDialog(
            presentation: presentation,
            changes: changes,
            snapshot: () => ritual.snapshot,
            preparedTarot: () => const [],
            busy: () => false,
            error: () => null,
            retry: () => null,
            toss: () {},
            choose: (_) {},
            pause: () {},
          ),
        ),
      ),
    );
    final deckBefore = tester.getRect(
      find.byKey(const ValueKey('tarot-preparation-stage')),
    );
    final footerBefore = tester.getRect(find.text('Pause'));
    await tester.pumpAndSettle(const Duration(milliseconds: 240));
    expect(find.byType(TarotDeckPreparation), findsNothing);
    final layout = tester
        .widget<TarotSpreadTable>(find.byType(TarotSpreadTable))
        .layout;
    final original = TarotTableLayout(layout.width, layout.slotCount);
    expect(layout.height, closeTo(original.height + 54, 0.01));
    expect(layout.cardHeight, original.cardHeight);
    expect(
      tester.getRect(find.byKey(const ValueKey('tarot-spread-stage'))),
      deckBefore,
    );
    expect(tester.getRect(find.text('Pause')), footerBefore);
    expect(find.bySemanticsLabel('Spread the deck'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
