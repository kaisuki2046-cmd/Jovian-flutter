import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import 'support/divination_service_fixture.dart';
import 'support/tarot_gestures.dart';

void main() {
  final dispatcher =
      TestWidgetsFlutterBinding.ensureInitialized().platformDispatcher;
  setUp(() {
    dispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(
      disableAnimations: true,
    );
  });
  tearDown(dispatcher.clearAccessibilityFeaturesTestValue);
  testWidgets(
    'sends a question directly into the one ritual and can pause or start a new chat',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 640);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.binding.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      final service = DivinationServiceFixture();
      final online = service.connect(DivinationRecoveryFixture());
      addTearDown(online.dispose);
      await tester.pumpWidget(
        JovianApp(initialTab: JovianTab.divination, onlineGuide: online),
      );
      await tester.pumpAndSettle();
      expect(find.byType(TabBar), findsNothing);
      expect(find.text('手动起盘'), findsNothing);
      expect(find.text('自动起盘'), findsNothing);
      final send = find.byTooltip('发送消息');
      expect(send, findsNothing);
      await tester.enterText(find.byType(TextFormField), '   ');
      await tester.pump();
      expect(send, findsNothing);
      await tester.enterText(find.byType(TextFormField), '我这次面试后续会怎样？');
      await tester.pump();
      await tester.tap(send);
      await tester.pumpAndSettle();

      expect(find.text('第 1 步 · 塔罗选牌'), findsOneWidget);
      for (final position in [40, 38, 39]) {
        final card = await openTarotCard(tester, position);
        await confirmTarotCard(tester, card);
        await tester.pumpAndSettle();
      }
      await tester.tap(find.text('一键翻牌'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('继续六爻起卦'));
      await tester.pumpAndSettle();
      final toss = find.byKey(const ValueKey('coin-ritual-toss-button'));
      await tester.ensureVisible(toss);
      await tester.tap(toss);
      await tester.pumpAndSettle();
      expect(find.text('已完成 1 / 6 次'), findsOneWidget);
      expect(service.calls, [
        'POST /reading/understand',
        'POST /reading',
        for (var index = 0; index < 3; index++) 'POST /reading/pick',
        'POST /reading/toss',
      ]);

      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();
      final resume = find.text('继续本次仪式');
      await tester.ensureVisible(resume);
      await tester.tap(resume);
      await tester.pumpAndSettle();
      expect(find.text('已完成 1 / 6 次'), findsOneWidget);

      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('新对话'));
      await tester.pumpAndSettle();
      expect(find.text('有什么事情想知道吗？'), findsOneWidget);
      expect(find.text('我这次面试后续会怎样？'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('without a service the landing keeps the draft and cannot cast', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(360, 640);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const JovianApp(initialTab: JovianTab.divination));
    await tester.pumpAndSettle();
    expect(find.text('算事服务当前未连接，暂时无法发送问题。'), findsOneWidget);
    final field = find.byType(TextFormField);
    await tester.enterText(field, divinationFixtureDetails);
    await tester.pump();
    expect(
      tester
          .widget<IconButton>(
            find.byWidgetPredicate(
              (widget) => widget is IconButton && widget.tooltip == '发送消息',
            ),
          )
          .onPressed,
      isNull,
    );
    await tester.testTextInput.receiveAction(TextInputAction.send);
    await tester.pumpAndSettle();
    expect(
      tester.widget<TextFormField>(field).controller!.text,
      divinationFixtureDetails,
    );
    expect(find.byKey(const ValueKey('guide-ritual-dialog')), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
