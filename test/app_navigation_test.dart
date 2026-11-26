import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/app_navigation.dart';
import '../src/app/main.dart';

void main() {
  test(
    'public paths round trip and a fortune archive stays out of the URL',
    () async {
      const parser = JovianRouteParser();
      for (final tab in JovianTab.values) {
        final path = tab.path;
        final result = await parser.parseRouteInformation(
          RouteInformation(uri: Uri.parse(path)),
        );
        expect(result.tab, tab);
        expect(parser.restoreRouteInformation(result).uri.path, path);
      }
      final archiveId = 'a' * 64;
      final fortune = await parser.parseRouteInformation(
        RouteInformation(uri: Uri.parse('/modules/fortune/'), state: archiveId),
      );
      expect(fortune.tab, JovianTab.destiny);
      expect(fortune.archiveId, archiveId);
      final restored = parser.restoreRouteInformation(fortune);
      expect(restored.uri.toString(), '/modules/fortune');
      expect(restored.state, archiveId);
      final unknown = await parser.parseRouteInformation(
        RouteInformation(uri: Uri.parse('/missing'), state: archiveId),
      );
      expect(unknown.tab, JovianTab.destiny);
      expect(unknown.archiveId, isNull);
    },
  );

  testWidgets(
    'platform history switches tabs without discarding the birth form',
    (tester) async {
      final platform = tester.binding.platformDispatcher;
      platform.defaultRouteNameTestValue = '/synastry';
      addTearDown(platform.clearDefaultRouteNameTestValue);
      await tester.pumpWidget(const JovianApp());
      await tester.pumpAndSettle();
      expect(_selection(tester), JovianTab.synastry.index);

      await tester.tap(find.byKey(const ValueKey(JovianTab.destiny)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      final birthDate = find.widgetWithText(TextField, '出生日期');
      await tester.enterText(birthDate, '2000-01-01');
      await tester.binding.handlePushRoute('/messages');
      await tester.pumpAndSettle();
      expect(_selection(tester), JovianTab.messages.index);
      expect(birthDate, findsNothing);

      await tester.binding.handlePushRoute('/');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(_selection(tester), JovianTab.destiny.index);
      expect(
        tester.widget<TextField>(birthDate).controller?.text,
        '2000-01-01',
      );
      expect(tester.takeException(), isNull);
    },
  );
}

int _selection(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex;
