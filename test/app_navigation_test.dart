import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_fortune/jovian_fortune.dart' show FortunePeriod;
import 'package:material_ui/material_ui.dart';

import '../src/app/app_navigation.dart';
import '../src/app/main.dart';
import '../src/features/account/account.dart';
import 'support/birth_picker_fixture.dart';

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

  test('legacy fortune bookmarks select exactly one account archive', () async {
    const parser = JovianRouteParser();
    Future<JovianLocation> parse(String path, {Object? state}) =>
        parser.parseRouteInformation(
          RouteInformation(uri: Uri.parse(path), state: state),
        );

    final requested = 'a' * 64;
    final previous = 'b' * 64;
    for (final path in ['/fortune', '/modules/fortune']) {
      final oldLink = await parse(
        '$path?snapshotId=$requested',
        state: previous,
      );
      expect(oldLink.archiveId, requested);
      final restored = parser.restoreRouteInformation(oldLink);
      expect(restored.uri.queryParameters['snapshotId'], requested);
      expect(restored.state, requested);
      expect(await parser.parseRouteInformation(restored), oldLink);
    }

    for (final query in ['', 'invalid', '$requested&snapshotId=$previous']) {
      final invalid = await parse(
        '/fortune?snapshotId=$query',
        state: previous,
      );
      expect(invalid.archiveId, '');
      expect(
        await parser.parseRouteInformation(
          parser.restoreRouteInformation(invalid),
        ),
        invalid,
      );
    }

    expect((await parse('/fortune')).archiveId, isNull);
    expect((await parse('/fortune', state: 'invalid')).archiveId, isNull);
  });

  test(
    'forecast permission links preserve the forecast and its archive',
    () async {
      const parser = JovianRouteParser();
      final archiveId = 'a' * 64;
      final fromSelection = await parser.parseRouteInformation(
        RouteInformation(
          uri: Uri.parse('/fortune?aiPermissions=month'),
          state: archiveId,
        ),
      );
      expect(fromSelection.fortunePermissionsPeriod, FortunePeriod.month);
      final selected = parser.restoreRouteInformation(fromSelection);
      expect(selected.uri.toString(), '/fortune?aiPermissions=month');
      expect(selected.state, archiveId);
      expect(await parser.parseRouteInformation(selected), fromSelection);

      final bookmark = Uri.parse(
        '/modules/fortune?snapshotId=$archiveId&aiPermissions=year',
      );
      final legacy = await parser.parseRouteInformation(
        RouteInformation(uri: bookmark),
      );
      expect(legacy.archiveId, archiveId);
      expect(legacy.fortunePermissionsPeriod, FortunePeriod.year);
      expect(parser.restoreRouteInformation(legacy).uri, bookmark);

      for (final query in ['unknown', 'month&aiPermissions=year']) {
        final invalid = await parser.parseRouteInformation(
          RouteInformation(uri: Uri.parse('/fortune?aiPermissions=$query')),
        );
        expect(invalid.fortunePermissionsPeriod, isNull);
        expect(
          parser.restoreRouteInformation(invalid).uri.toString(),
          '/fortune',
        );
      }
    },
  );

  testWidgets('return from forecast permissions restores its active period', (
    tester,
  ) async {
    final platform = tester.binding.platformDispatcher;
    platform.defaultRouteNameTestValue = '/modules/fortune?aiPermissions=year';
    addTearDown(platform.clearDefaultRouteNameTestValue);
    await tester.pumpWidget(const JovianApp());
    await tester.pumpAndSettle();
    expect(find.text('账号服务暂不可用。'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    final year = find.widgetWithText(ChoiceChip, '本年');
    expect(tester.widget<ChoiceChip>(year).selected, isTrue);

    await tester.binding.handlePushRoute(
      '/modules/fortune?aiPermissions=month',
    );
    await tester.pumpAndSettle();
    expect(find.text('账号服务暂不可用。'), findsOneWidget);
    await tester.binding.handlePushRoute('/modules/fortune');
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    final month = find.widgetWithText(ChoiceChip, '本月');
    expect(tester.widget<ChoiceChip>(month).selected, isTrue);
    expect(tester.takeException(), isNull);
  });

  test(
    'legacy account URLs retain their parent stack and known aliases',
    () async {
      const parser = JovianRouteParser();
      Future<JovianLocation> parse(String path, {Object? state}) =>
          parser.parseRouteInformation(
            RouteInformation(uri: Uri.parse(path), state: state),
          );

      final password = await parse('/account/password/');
      expect(password.tab, JovianTab.account);
      expect(password.sections.map((item) => item.section), [
        AccountSection.settings,
        AccountSection.security,
        AccountSection.password,
      ]);
      expect(
        parser.restoreRouteInformation(password).uri.path,
        '/account/password',
      );
      expect(
        await parser.parseRouteInformation(
          parser.restoreRouteInformation(password),
        ),
        password,
      );
      expect((await parse('/welcome')).welcome, isTrue);
      expect((await parse('/modules/social')).tab, JovianTab.messages);
      expect((await parse('/modules/account')).tab, JovianTab.account);
      expect((await parse('/modules/divination')).tab, JovianTab.divination);
      expect((await parse('/account/obsolete')).tab, JovianTab.account);
      final search = await parse('/account/find-user');
      expect(search.tab, JovianTab.messages);
      expect(search.sections.single.section, AccountSection.findUser);
      final public = await parse(
        '/account/social-profile?id=public-123&from=followers&ignored=private',
      );
      expect(public.tab, JovianTab.account);
      expect(public.sections.first.section, AccountSection.followers);
      expect(public.sections.last.profileId, 'public-123');
      expect(parser.restoreRouteInformation(public).uri.queryParameters, {
        'id': 'public-123',
        'from': 'followers',
      });
      final invalid = await parse(
        '/account/social-profile?id=user%40example.test',
      );
      expect(invalid.sections.single.section, AccountSection.findUser);
      expect(parser.restoreRouteInformation(invalid).uri.hasQuery, isFalse);
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
      await tester.tap(find.widgetWithText(FilledButton, '开始解读'));
      await tester.pump();
      final birthDate = find.widgetWithText(OutlinedButton, '2000 年 1 月 1 日');
      await selectBirthDate(tester, '2000-01-01');
      await tester.binding.handlePushRoute('/messages');
      await tester.pumpAndSettle();
      expect(_selection(tester), JovianTab.messages.index);
      expect(birthDate, findsNothing);

      await tester.binding.handlePushRoute('/');
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      expect(_selection(tester), JovianTab.destiny.index);
      expect(birthDate, findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}

int _selection(WidgetTester tester) =>
    tester.widget<NavigationBar>(find.byType(NavigationBar)).selectedIndex;
