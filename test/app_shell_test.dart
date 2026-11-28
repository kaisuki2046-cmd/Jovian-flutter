import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/app_shell.dart' show JovianShell;
import '../src/app/main.dart';
import '../src/features/divination/view/guide_assistant.dart';
import '../src/features/divination/view/guide_composer.dart';
import '../src/ui/interface_language.dart';
import '../src/ui/tab_dock.dart';
import '../src/ui/tab_lens.dart';
import '../src/ui/theme.dart';
import 'support/birth_picker_fixture.dart';

Finder _tab(JovianTab value) => find.byKey(ValueKey(value));

void main() {
  testWidgets('short guide welcome stays visible after session restore', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(844, 390);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    const footer = ValueKey('landscape-guide-footer');
    Widget screen(Object revision) => MaterialApp(
      theme: jovianTheme(Brightness.light),
      home: Scaffold(
        appBar: AppBar(title: const Text('对话')),
        body: GuideThread(
          sentRevision: 0,
          latestMessage: revision,
          messages: [GuideSuggestions(select: (_) {})],
          composer: const SizedBox(key: footer, height: 114),
          welcome: const GuideWelcome(),
        ),
      ),
    );
    final greeting = find.bySemanticsLabel('有什么事情想知道吗？');
    await tester.pumpWidget(screen('initial'));
    expect(greeting.hitTestable(), findsOneWidget);

    await tester.pumpWidget(screen('session restored'));
    await tester.pump();
    expect(greeting.hitTestable(), findsOneWidget);
    final assistant = find.byType(GuideAssistantWelcomePortrait);
    expect(
      tester.getRect(assistant).bottom,
      lessThanOrEqualTo(tester.getTopLeft(find.byKey(footer)).dy),
    );
    final recentQuestion = find.text('最近什么时候适合搬家？');
    await tester.ensureVisible(recentQuestion);
    await tester.pump();
    expect(recentQuestion.hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

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
    _disableContinuousGuideMotion(tester);
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
    await tester.tap(find.widgetWithText(FilledButton, '开始解读'));
    await tester.pump();
    final date = find.widgetWithText(OutlinedButton, '2000 年 1 月 1 日');
    await selectBirthDate(tester, '2000-01-01');
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
    expect(date, findsOneWidget);
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
      _disableContinuousGuideMotion(tester);
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

  testWidgets('narrow English tabs use the original captions and full names', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [interfaceStringsDelegate],
        theme: jovianTheme(Brightness.light),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(2)),
          child: child!,
        ),
        home: JovianShell(
          initialTab: JovianTab.destiny,
          buildPage: (_, tab, __, ___) =>
              Center(child: Text('Screen ${tab.name}')),
        ),
      ),
    );
    await tester.pumpAndSettle();
    final bar = find.byType(NavigationBar);
    expect(tester.getSize(bar).height, 56);
    final captions = ['Chart', 'Match', 'Reading', 'Messages', 'Profile'];
    final fullNames = [
      'Birth chart',
      'Compatibility',
      'AI reading',
      'Messages',
      'Profile',
    ];
    for (final (index, caption) in captions.indexed) {
      final label = find.text(caption);
      expect(label, findsOneWidget);
      final paragraph = tester.renderObject<RenderParagraph>(label);
      final width = paragraph.getMaxIntrinsicWidth(double.infinity);
      expect(paragraph.size.width + .1, greaterThanOrEqualTo(width));

      final destination = _tab(JovianTab.values[index]);
      expect(tester.getSize(destination).width, greaterThanOrEqualTo(48));
      expect(
        tester.getSemantics(destination).label,
        contains(fullNames[index]),
      );
      expect(
        find.descendant(
          of: destination,
          matching: find.byWidgetPredicate(
            (widget) => widget is Tooltip && widget.message == fullNames[index],
          ),
        ),
        findsOneWidget,
      );
    }

    final focusColor = tester.widget<NavigationBar>(bar).overlayColor!;
    expect(
      focusColor.resolve({WidgetState.focused}),
      isNot(Colors.transparent),
    );
    expect(focusColor.resolve({WidgetState.pressed}), Colors.transparent);

    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pumpAndSettle();
    expect(
      tester.widget<NavigationBar>(bar).selectedIndex,
      JovianTab.synastry.index,
    );

    final start = tester.getCenter(_tab(JovianTab.synastry));
    final profile = tester.getCenter(_tab(JovianTab.account));
    final gesture = await tester.startGesture(start);
    await gesture.moveTo(profile);
    await tester.pump();
    await gesture.up();
    await tester.pumpAndSettle();
    expect(
      tester.widget<NavigationBar>(bar).selectedIndex,
      JovianTab.account.index,
    );
    expect(tester.takeException(), isNull);
  });

  testWidgets('the glass lens follows a drag and settles at its target once', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(360, 640);
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(_dockTestApp());
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
    final face = optics.first.filter?.debugShortDescription;
    final rim = optics.last.filter?.debugShortDescription;
    expect(face, startsWith('blur(0.65, 0.65'));
    expect(rim, contains('matrix([1.34,'));
    expect(rim, contains('blur(2.0, 2.0'));
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

  testWidgets('a touch still activates a destination after the pressed frame', (
    tester,
  ) async {
    await tester.pumpWidget(_dockTestApp());
    await tester.pumpAndSettle();
    final navigation = find.byType(NavigationBar);
    final press = await tester.startGesture(
      tester.getCenter(_tab(JovianTab.messages)),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 75));
    expect(
      tester.widget<NavigationBar>(navigation).selectedIndex,
      JovianTab.synastry.index,
    );
    await press.up();
    await tester.pumpAndSettle();
    expect(
      tester.widget<NavigationBar>(navigation).selectedIndex,
      JovianTab.messages.index,
    );
    expect(tester.takeException(), isNull);
  });
}

Widget _dockTestApp() => MaterialApp(
  theme: jovianTheme(Brightness.light),
  home: JovianShell(
    initialTab: JovianTab.synastry,
    buildPage: (_, _, _, _) => const SizedBox.expand(),
  ),
);

void _disableContinuousGuideMotion(WidgetTester tester) {
  final dispatcher = tester.binding.platformDispatcher;
  dispatcher.accessibilityFeaturesTestValue = const FakeAccessibilityFeatures(
    disableAnimations: true,
  );
  addTearDown(dispatcher.clearAccessibilityFeaturesTestValue);
}
