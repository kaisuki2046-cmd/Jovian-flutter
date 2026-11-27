import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/view/liuyao_form.dart';

void main() {
  testWidgets('casts six times and resets the chart', (tester) async {
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
      const MaterialApp(home: Scaffold(body: LiuYaoForm())),
    );
    await tester.pumpAndSettle();

    final toss = find.byKey(const ValueKey('coin-ritual-toss-button'));
    await tester.ensureVisible(toss);
    await tester.tap(toss);
    await tester.pumpAndSettle();
    expect(find.text('已完成 1 / 6 次'), findsOneWidget);
    expect(find.text('六爻结果'), findsNothing);

    for (var count = 2; count <= 6; count++) {
      await tester.ensureVisible(toss);
      await tester.tap(toss);
      await tester.pumpAndSettle();
      expect(
        find.text(count == 6 ? '已投 6 / 6 次' : '已完成 $count / 6 次'),
        findsOneWidget,
      );
    }
    expect(toss, findsNothing);
    expect(find.text('六爻结果'), findsOneWidget);
    expect(find.textContaining('本卦 · '), findsOneWidget);
    final chart = find.text('查看京房排盘');
    await tester.ensureVisible(chart);
    await tester.tap(chart);
    await tester.pumpAndSettle();
    expect(find.textContaining('旬空'), findsWidgets);
    expect(find.textContaining('投掷 '), findsNWidgets(6));

    final restart = find.text('重新起卦');
    await tester.ensureVisible(restart);
    await tester.tap(restart);
    await tester.pumpAndSettle();
    expect(find.text('已完成 0 / 6 次'), findsOneWidget);
    expect(find.text('六爻结果'), findsNothing);
    expect(toss, findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
