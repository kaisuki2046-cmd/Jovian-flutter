import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/app_shell.dart' show JovianShell;
import '../src/app/main.dart';
import '../src/ui/tab_dock.dart';
import '../src/ui/tab_lens.dart';
import '../src/ui/theme.dart';

Finder _tab(JovianTab value) => find.byKey(ValueKey(value));

void main() {
  testWidgets(
    'page scroll compacts the dock and reverses before reaching top',
    (tester) async {
      const scrollKey = ValueKey('dock-scroll-list');
      await tester.pumpWidget(
        MaterialApp(
          home: JovianShell(
            initialTab: JovianTab.destiny,
            buildPage: (_, tab, __, ___) => ListView(
              key: scrollKey,
              children: [
                for (var i = 0; i < 40; i++)
                  ListTile(title: Text('${tab.label} $i')),
              ],
            ),
          ),
        ),
      );
      final nav = find.byType(NavigationBar);
      final scroll = find.byKey(scrollKey);
      final bottom = tester.getRect(nav).bottom;
      expect(tester.getSize(nav).height, 56);
      await tester.drag(scroll, const Offset(0, -260));
      await tester.pumpAndSettle();
      expect(tester.getSize(nav).height, 44);
      expect(tester.getRect(nav).bottom, bottom);
      await tester.drag(scroll, const Offset(0, 90));
      await tester.pumpAndSettle();
      expect(tester.getSize(nav).height, 56);
      expect(tester.getRect(nav).bottom, bottom);
    },
  );

  test(
    'the displaced outline stays centered vertically and within both edges',
    () {
      const tray = Size(432, 66);
      const resting = Size(76.4, 56);
      final right = tabLensOutline(
        pose: const TabLensPose(500, press: 1, travel: 1),
        tray: tray,
        resting: resting,
      );
      final left = tabLensOutline(
        pose: const TabLensPose(-40, press: 1, travel: -1),
        tray: tray,
        resting: resting,
      );
      final idle = tabLensOutline(
        pose: const TabLensPose(216, press: 1),
        tray: tray,
        resting: resting,
      );
      expect(right.bounds.right, closeTo(430, .01));
      expect(left.bounds.left, closeTo(2, .01));
      expect(right.bounds.center.dy, 33);
      expect(left.bounds.center.dy, 33);
      expect(right.bounds.height, 76);
      expect(left.bounds.height, idle.bounds.height);
      expect(right.bounds.width, greaterThan(idle.bounds.width));
      expect(right.points, isNot(equals(left.points)));
      expect(right.path().getBounds().right, closeTo(right.bounds.width, .01));
    },
  );

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
    final lensFilters = find.descendant(
      of: lens,
      matching: find.byType(BackdropFilter),
    );
    expect(lensFilters, findsOneWidget);
    final resting = tester.getRect(lens);
    expect(resting.width / resting.height, closeTo(1.36, 0.02));
    final start = tester.getCenter(_tab(JovianTab.synastry));
    final target = tester.getCenter(_tab(JovianTab.messages));
    final gesture = await tester.startGesture(start);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 120));
    expect(lensFilters, findsNWidgets(2));
    final pressed = tester.getRect(lens);
    expect(pressed.height, closeTo(resting.height + 20, .01));
    await gesture.moveTo(start.translate(0, -55));
    await tester.pump();
    expect(tester.getRect(lens), pressed);
    await gesture.moveTo(target.translate(0, -50));
    await tester.pump();
    final optics = tester.widgetList<BackdropFilter>(lensFilters).toList();
    expect(optics, hasLength(2));
    expect(optics[0].filter, isNot(equals(optics[1].filter)));
    expect(tester.getCenter(lens).dx, closeTo(target.dx, 1));
    expect(tester.getCenter(lens).dy, pressed.center.dy);
    expect(tester.getSize(lens).height, closeTo(pressed.height, .01));
    await tester.pump(const Duration(milliseconds: 350));
    await tester.pump();
    expect(tester.getSize(lens).height, closeTo(pressed.height, .01));
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
    final firstTouch = await tester.startGesture(target, pointer: 41);
    await firstTouch.moveTo(start);
    await tester.pump();
    final secondTouch = await tester.startGesture(
      const Offset(25, 215),
      pointer: 42,
    );
    await firstTouch.up();
    await secondTouch.up();
    await tester.pumpAndSettle();
    expect(
      tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex,
      JovianTab.messages.index,
    );
    expect(lensFilters, findsOneWidget);
    expect(tester.getSize(lens).height, closeTo(resting.height, 0.01));

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
