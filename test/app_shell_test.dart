import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import '../src/ui/tab_dock.dart';
import '../src/ui/theme.dart';

Finder _tab(JovianTab value) => find.byKey(ValueKey(value));

void main() {
  testWidgets('the five tabs keep form state and share the desktop viewport', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1280, 820);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const JovianApp());
    await tester.pump();

    final navigation = find.byType(NavigationBar);
    expect(
      tester.getSize(navigation).width,
      jovianPageWidth - 2 * tabDockMargin - 10,
    );
    final bar = tester.widget<NavigationBar>(navigation);
    expect(bar.selectedIndex, 0);
    expect(
      bar.destinations.cast<NavigationDestination>().map((item) => item.label),
      ['命理', '合盘', '算事', '消息', '个人中心'],
    );
    final date = find.widgetWithText(TextField, '出生日期');
    await tester.enterText(date, '2000-01-01');
    for (final tab in JovianTab.values.skip(1)) {
      await tester.tap(_tab(tab));
      await tester.pumpAndSettle();
      expect(tester.widget<NavigationBar>(navigation).selectedIndex, tab.index);
      expect(
        find.descendant(
          of: find.byType(AppBar),
          matching: find.text(tab == JovianTab.divination ? '对话' : tab.label),
        ),
        findsOneWidget,
      );
    }
    await tester.tap(_tab(JovianTab.destiny));
    await tester.pump(const Duration(milliseconds: 250));
    expect(tester.widget<TextField>(date).controller!.text, '2000-01-01');
    expect(find.widgetWithText(ListTile, '周期运势'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'dark layout keeps all tabs on a narrow screen and avoids the keyboard',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 640);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetViewInsets);
      await tester.pumpWidget(
        const JovianApp(
          initialTab: JovianTab.divination,
          themeMode: ThemeMode.dark,
        ),
      );
      await tester.pumpAndSettle();
      final nav = find.byType(NavigationBar);
      expect(tester.getSize(nav).width, 320 - 2 * tabDockMargin - 10);
      expect(Theme.of(tester.element(nav)).brightness, Brightness.dark);
      expect(find.byType(NavigationDestination), findsNWidgets(5));
      tester.view.viewInsets = const FakeViewPadding(bottom: 260);
      await tester.pump();
      expect(nav, findsNothing);
      tester.view.resetViewInsets();
      await tester.pumpAndSettle();
      expect(nav, findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('the glass lens follows a drag and settles at its target once', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(360, 640);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const JovianApp(initialTab: JovianTab.synastry));
    await tester.pumpAndSettle();
    final lens = find.byKey(const ValueKey('tab-glass-lens'));
    final lensFace = find.descendant(
      of: lens,
      matching: find.byType(BackdropFilter),
    );
    final resting = tester.getRect(lensFace);
    expect(resting.width / resting.height, closeTo(1.36, 0.02));
    final start = tester.getCenter(_tab(JovianTab.synastry));
    final target = tester.getCenter(_tab(JovianTab.messages));
    final gesture = await tester.startGesture(start);
    await tester.pump(const Duration(milliseconds: 120));
    await gesture.moveBy(const Offset(30, 0));
    await gesture.moveTo(target);
    await tester.pump();
    expect(tester.getCenter(lensFace).dx, closeTo(target.dx, 1));
    expect(tester.getSize(lensFace).height, greaterThan(resting.height));
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      JovianTab.synastry.index,
    );
    await gesture.up();
    await tester.pumpAndSettle();
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      JovianTab.messages.index,
    );
    expect(tester.getSize(lensFace).height, closeTo(resting.height, 0.01));

    final interrupted = await tester.startGesture(target);
    await interrupted.moveTo(start);
    await tester.pump();
    await interrupted.cancel();
    await tester.pumpAndSettle();
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      JovianTab.messages.index,
    );
    await tester.tap(_tab(JovianTab.synastry));
    await tester.pumpAndSettle();
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      JovianTab.synastry.index,
    );
  });
}
