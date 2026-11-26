import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';

void main() {
  testWidgets(
    'validates the question and can pause or reset a manual cast from the app',
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
      await tester.pumpWidget(
        const JovianApp(initialTab: JovianTab.divination),
      );
      await tester.tap(find.text('综合算事'));
      await tester.pumpAndSettle();

      final manual = find.text('手动起盘');
      await tester.tap(manual);
      await tester.pump();
      expect(find.text('请输入你的问题。'), findsOneWidget);
      await tester.enterText(find.byType(TextFormField), '我这次面试后续会怎样？');
      await tester.ensureVisible(manual);
      await tester.tap(manual);
      await tester.pumpAndSettle();

      final toss = find.byKey(const ValueKey('coin-ritual-toss-button'));
      await tester.ensureVisible(toss);
      await tester.tap(toss);
      await tester.pumpAndSettle();
      expect(find.text('已投 1 / 6 次'), findsOneWidget);

      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();
      final resume = find.text('继续本次仪式');
      await tester.ensureVisible(resume);
      await tester.tap(resume);
      await tester.pumpAndSettle();
      expect(find.text('已投 1 / 6 次'), findsOneWidget);

      await tester.tap(find.byTooltip('暂停仪式'));
      await tester.pumpAndSettle();
      final restart = find.text('另问一件事');
      await tester.ensureVisible(restart);
      await tester.tap(restart);
      await tester.pumpAndSettle();
      expect(find.text('有什么事情想知道吗？'), findsOneWidget);
      expect(find.text('我这次面试后续会怎样？'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('automatic mode reveals three cards without manual actions', (
    tester,
  ) async {
    await tester.pumpWidget(const JovianApp(initialTab: JovianTab.divination));
    await tester.tap(find.text('综合算事'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextFormField), '这件事怎么推进？');
    final auto = find.text('自动起盘');
    await tester.ensureVisible(auto);
    await tester.tap(auto);
    await tester.pumpAndSettle();
    expect(find.text('扔六次铜钱'), findsNothing);
    expect(find.text('抽三张塔罗'), findsNothing);
    expect(find.text('翻开三张塔罗'), findsOneWidget);
    final details = find.text('查看盘面');
    await tester.ensureVisible(details);
    await tester.tap(details);
    await tester.pumpAndSettle();
    expect(find.text('梅花取数来自三枚自动生成的数。'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
