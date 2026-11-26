import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';

const _legacy = MethodChannel('jovian/legacy_preferences');
const _themeKey = 'jovian.ui.theme.v1';
const _languageKey = 'jovian.ui.language.v1';

void main() {
  testWidgets('an Android upgrade reads both Expo preferences once', (
    tester,
  ) async {
    final reads = await _launch(
      tester,
      '{"appearance":"dark","language":"en"}',
    );

    expect(reads, 1);
    expect(_appearance(tester), Brightness.dark);
    expect(_language(tester), 'en');
    expect(await const FlutterSecureStorage().read(key: _themeKey), isNull);
    expect(await const FlutterSecureStorage().read(key: _languageKey), isNull);
  });

  testWidgets('a Flutter choice overrides its corresponding Expo preference', (
    tester,
  ) async {
    final reads = await _launch(
      tester,
      '{"appearance":"dark","language":"en"}',
      saved: {_themeKey: 'light'},
    );

    expect(reads, 1);
    expect(_appearance(tester), Brightness.light);
    expect(_language(tester), 'en');
  });

  testWidgets('saved Flutter preferences avoid the Expo read altogether', (
    tester,
  ) async {
    final reads = await _launch(
      tester,
      '{"appearance":"dark","language":"en"}',
      saved: {_themeKey: 'light', _languageKey: 'zh'},
    );

    expect(reads, 0);
    expect(_appearance(tester), Brightness.light);
    expect(_language(tester), 'zh');
  });

  testWidgets('invalid Expo appearance does not block a supported language', (
    tester,
  ) async {
    final reads = await _launch(
      tester,
      '{"appearance":"blue","language":"en"}',
    );

    expect(reads, 1);
    expect(_appearance(tester), Brightness.light);
    expect(_language(tester), 'en');
  });

  testWidgets('invalid Expo JSON keeps the app defaults', (tester) async {
    final reads = await _launch(tester, 'bad-json');

    expect(reads, 1);
    expect(_appearance(tester), Brightness.light);
    expect(_language(tester), 'zh');
    expect(tester.takeException(), isNull);
  });
}

Future<int> _launch(
  WidgetTester tester,
  String legacy, {
  Map<String, String> saved = const {},
}) async {
  FlutterSecureStorage.setMockInitialValues(saved);
  final messenger = tester.binding.defaultBinaryMessenger;
  addTearDown(() => messenger.setMockMethodCallHandler(_legacy, null));
  var calls = 0;
  messenger.setMockMethodCallHandler(_legacy, (call) async {
    expect(call.method, 'read');
    expect(call.arguments, isNull);
    calls++;
    return legacy;
  });

  await tester.pumpWidget(
    const JovianApp(persistTheme: true, themeMode: ThemeMode.light),
  );
  await tester.pumpAndSettle();
  return calls;
}

Brightness _appearance(WidgetTester tester) =>
    Theme.of(tester.element(find.byType(NavigationBar))).brightness;

String _language(WidgetTester tester) => Localizations.localeOf(
  tester.element(find.byType(NavigationBar)),
).languageCode;
