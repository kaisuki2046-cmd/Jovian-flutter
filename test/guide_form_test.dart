import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';

void main() {
  testWidgets(
    'deals 78 cards after six tosses and takes Meihua from three choices',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 640);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(const JovianApp());
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

      final toss = find.text('投三枚铜钱');
      for (var index = 0; index < 6; index++) {
        await tester.tap(toss);
        await tester.pump();
      }
      expect(find.text('抽三张塔罗'), findsOneWidget);
      expect(find.text('已选 0 / 3 张 · 现状、关键影响、趋势'), findsOneWidget);
      expect(find.text('翻开三张塔罗'), findsNothing);
      final firstChoice = find.byKey(const ValueKey('tarot-slot-77'));
      expect(firstChoice, findsOneWidget);
      await tester.ensureVisible(firstChoice);
      await tester.tap(firstChoice);
      await tester.pumpAndSettle();
      expect(find.text('已选 1 / 3 张 · 现状、关键影响、趋势'), findsOneWidget);

      await tester.tap(firstChoice);
      await tester.pumpAndSettle();
      expect(find.text('已选 1 / 3 张 · 现状、关键影响、趋势'), findsOneWidget);
      for (final slot in [0, 35]) {
        final card = find.byKey(ValueKey('tarot-slot-$slot'));
        await tester.ensureVisible(card);
        await tester.tap(card);
        await tester.pumpAndSettle();
      }
      expect(find.text('翻开三张塔罗'), findsOneWidget);
      expect(find.byType(Image), findsNWidgets(3));
      expect(find.text('现状'), findsOneWidget);
      expect(find.text('关键影响'), findsOneWidget);
      expect(find.text('趋势'), findsOneWidget);
      expect(toss, findsNothing);

      final charts = find.text('查看盘面');
      await tester.ensureVisible(charts);
      await tester.tap(charts);
      await tester.pumpAndSettle();
      expect(find.text('六爻结果'), findsOneWidget);
      expect(find.text('梅花易数结果'), findsOneWidget);
      expect(find.text('梅花取数来自三次抽牌的点击时刻。'), findsOneWidget);
      final restart = find.text('另问一件事');
      await tester.ensureVisible(restart);
      await tester.tap(restart);
      await tester.pumpAndSettle();
      expect(find.text('综合起盘'), findsOneWidget);
      expect(find.text('我这次面试后续会怎样？'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('automatic mode reveals three cards without manual actions', (
    tester,
  ) async {
    await tester.pumpWidget(const JovianApp());
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
    await tester.tap(find.text('查看盘面'));
    await tester.pumpAndSettle();
    expect(find.text('梅花取数来自三枚自动生成的数。'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
