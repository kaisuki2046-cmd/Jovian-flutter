import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/settings/view/appearance_page.dart';
import '../src/ui/theme.dart';

void main() {
  testWidgets('320px appearance retains the three choices and changes theme', (
    tester,
  ) async {
    final modes = <ThemeMode>[];
    await _openAppearance(tester, const Size(320, 600), modes);

    final radios = find.byType(RadioListTile<ThemeMode>);
    expect(radios, findsNWidgets(3));
    expect(
      tester.getSize(radios.first).width,
      320 - jovianPagePadding.horizontal,
    );
    expect(
      tester.widget<RadioListTile<ThemeMode>>(radios.last).selected,
      isTrue,
    );
    expect(find.text('自动同步设备的浅色或深色模式'), findsOneWidget);

    final dark = find.text('深色模式');
    await tester.tap(dark);
    await tester.pumpAndSettle();
    expect(modes, [ThemeMode.dark]);
    expect(
      tester.widget<RadioListTile<ThemeMode>>(radios.at(1)).selected,
      isTrue,
    );
    expect(Theme.of(tester.element(dark)).brightness, Brightness.dark);
    expect(find.text('外观模式'), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('设置'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('desktop appearance uses radio keys and Escape returns', (
    tester,
  ) async {
    final modes = <ThemeMode>[];
    await _openAppearance(tester, const Size(1280, 800), modes);
    final radios = find.byType(RadioListTile<ThemeMode>);
    expect(
      tester.getSize(radios.first).width,
      jovianPageWidth - jovianPagePadding.horizontal,
    );
    expect(tester.getCenter(radios.first).dx, 640);

    // Enter the radio group through normal traversal, then advance from system.
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pumpAndSettle();
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pumpAndSettle();
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pumpAndSettle();
    expect(modes, [ThemeMode.light]);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pumpAndSettle();
    expect(modes, [ThemeMode.light, ThemeMode.dark]);
    await tester.sendKeyEvent(LogicalKeyboardKey.escape);
    await tester.pumpAndSettle();
    expect(find.text('设置'), findsOneWidget);
    expect(modes, [ThemeMode.light, ThemeMode.dark]);
  });
}

Future<void> _openAppearance(
  WidgetTester tester,
  Size size,
  List<ThemeMode> modes,
) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  var selected = ThemeMode.system;
  await tester.pumpWidget(
    StatefulBuilder(
      builder: (context, setState) => MaterialApp(
        theme: jovianTheme(Brightness.light),
        darkTheme: jovianTheme(Brightness.dark),
        themeMode: selected,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => Navigator.of(context).push<void>(
                MaterialPageRoute(
                  builder: (context) => AppearancePage(
                    initialMode: selected,
                    onChanged: (mode) {
                      modes.add(mode);
                      setState(() => selected = mode);
                    },
                  ),
                ),
              ),
              child: const Text('设置'),
            ),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('设置'));
  await tester.pumpAndSettle();
}
