import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/settings/view/language_page.dart';
import '../src/ui/interface_language.dart';

void main() {
  testWidgets('changing interface language keeps original content', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 600);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    var selected = InterfaceLanguage.chinese;
    await tester.pumpWidget(
      StatefulBuilder(
        builder: (context, setState) => MaterialApp(
          locale: selected.locale,
          localizationsDelegates: const [
            interfaceStringsDelegate,
            ...GlobalMaterialLocalizations.delegates,
          ],
          supportedLocales: const [Locale('zh', 'CN'), Locale('en')],
          home: InterfaceLanguageScope(
            onChanged: (language) => setState(() => selected = language),
            child: const Column(
              children: [
                Expanded(child: LanguagePage()),
                UiText('我的报告'),
                Text('我的报告'),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('语言'), findsOneWidget);
    expect(find.text('我的报告'), findsNWidgets(2));

    await tester.tap(find.text('English'));
    await tester.pumpAndSettle();
    expect(selected, InterfaceLanguage.english);
    expect(find.text('Language'), findsOneWidget);
    expect(find.text('My reports'), findsOneWidget);
    expect(find.text('我的报告'), findsOneWidget);
    expect(
      find.text(
        'Your messages and generated reports keep their original language.',
      ),
      findsOneWidget,
    );

    await tester.tap(find.text('简体中文'));
    await tester.pumpAndSettle();
    expect(selected, InterfaceLanguage.chinese);
    expect(find.text('语言'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
