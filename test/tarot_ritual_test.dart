import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/view/guide_form.dart';
import '../src/features/divination/view/ritual/tarot_deck.dart';
import '../src/features/divination/view/ritual/tarot_preparation.dart';

void main() {
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

  testWidgets(
    'manual ritual can pause, reveal, and continue to chart at 360dp',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 640);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            child: child!,
          ),
          home: const GuideForm(),
        ),
      );
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
      expect(tester.takeException(), isNull);
    },
  );
}
