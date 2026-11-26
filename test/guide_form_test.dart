import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';

void main() {
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
      await tester.pumpWidget(
        const JovianApp(initialTab: JovianTab.divination),
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
      await tester.tap(find.byTooltip('新对话'));
      await tester.pumpAndSettle();
      expect(find.text('有什么事情想知道吗？'), findsOneWidget);
      expect(find.text('我这次面试后续会怎样？'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
