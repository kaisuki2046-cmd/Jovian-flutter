import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/shared/http/json_client.dart';

void main() {
  testWidgets(
    'direct account security requires current consent and preserves the nested back stack',
    (tester) async {
      final platform = tester.binding.platformDispatcher;
      platform.defaultRouteNameTestValue = '/account/phone';
      addTearDown(platform.clearDefaultRouteNameTestValue);
      final account = _account(
        (request) async => switch ('${request.method} ${request.url.path}') {
          'GET /account/session' => _json({
            'user': {
              'id': 'member-fixture',
              'displayName': '测试会员',
              'phone': '13800000000',
            },
          }),
          'GET /account/auth/capabilities' => _json({}),
          'GET /account/agreements/catalog' => _json(_catalog),
          'GET /account/agreements' => _agreementState(false),
          'POST /account/agreements/confirmation' => _agreementState(true),
          _ => _json({}, 404),
        },
      );
      await tester.pumpWidget(JovianApp(account: account));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, '手机号'), findsNothing);
      await _press(tester, '阅读并确认协议');
      await _press(tester, '同意并继续');
      expect(find.widgetWithText(AppBar, '手机号'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, '账户与安全'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, '设置'), findsOneWidget);
      await tester.binding.handlePushRoute('/account/appearance');
      await tester.pumpAndSettle();
      expect(find.widgetWithText(AppBar, '外观模式'), findsOneWidget);
      await tester.binding.handlePushRoute('/account');
      await tester.pumpAndSettle();
      expect(find.text('测试会员'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'cold start waits for restore and opens tabs after guest consent',
    (tester) async {
      final restoring = Completer<http.Response>();
      final requests = <String>[];
      final account = _account((request) async {
        final route = '${request.method} ${request.url.path}';
        requests.add(route);
        return switch (route) {
          'GET /account/session' => restoring.future,
          'GET /account/auth/guest' => _json({}, 401),
          'GET /account/auth/capabilities' => _json({}),
          'GET /account/agreements/catalog' => _json(_catalog),
          'POST /account/auth/guest' => _json({
            'id': 'guest-fixture',
            'expiresAt': 1795719000000,
          }, 201),
          'GET /account/agreements' => _agreementState(true),
          _ => _json({}, 404),
        };
      });
      await tester.pumpWidget(JovianApp(account: account));
      await tester.pump();
      expect(find.bySemanticsLabel('正在检查登录状态…'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      restoring.complete(_json({}, 401));
      await tester.pumpAndSettle();

      expect(find.text('在这里，慢慢认识自己'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      await _press(tester, '游客体验');
      expect(requests, isNot(contains('POST /account/auth/guest')));
      await _press(tester, '同意并继续');
      expect(
        requests.where((route) => route == 'POST /account/auth/guest'),
        hasLength(1),
      );
      expect(account.authorizedSession?.scope, 'guest:guest-fixture');
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.text('在这里，慢慢认识自己'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('a direct fortune link waits for the current agreement version', (
    tester,
  ) async {
    tester.binding.platformDispatcher.defaultRouteNameTestValue =
        '/modules/fortune';
    addTearDown(
      tester.binding.platformDispatcher.clearDefaultRouteNameTestValue,
    );
    final submitted = <Object?>[];
    final account = _account((request) async {
      switch ('${request.method} ${request.url.path}') {
        case 'GET /account/session':
          return _json({
            'user': {'id': 'member-fixture', 'displayName': '测试会员'},
          });
        case 'GET /account/auth/capabilities':
          return _json({});
        case 'GET /account/agreements/catalog':
          return _json(_catalog);
        case 'GET /account/agreements':
          return _agreementState(false);
        case 'POST /account/agreements/confirmation':
          submitted.add(jsonDecode(request.body));
          return _agreementState(true);
        default:
          return _json({}, 404);
      }
    });
    await tester.pumpWidget(JovianApp(account: account));
    await tester.pumpAndSettle();
    expect(find.text('周期运势'), findsNothing);
    expect(find.byType(NavigationBar), findsNothing);
    await _press(tester, '阅读并确认协议');
    expect(submitted, isEmpty);
    await tester.tap(find.text('同意并继续'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(submitted, [
      {
        'agreements': [
          for (final id in ['privacy', 'terms'])
            {'id': id, 'version': 'preview-v2', 'hash': 'digest-$id'},
        ],
        'source': 'sign-in',
      },
    ]);
    expect(find.widgetWithText(AppBar, '周期运势'), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

AccountController _account(
  Future<http.Response> Function(http.Request) respond,
) {
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.https('account.example.test'),
      client: MockClient(respond),
    ),
  );
  return AccountController(api, AgreementsApi(api));
}

http.Response _json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status);

http.Response _agreementState(bool accepted) => _json({
  'requiredAccepted': accepted,
  'permissions': {for (final key in aiPurposes.keys) key: false},
});

Future<void> _press(WidgetTester tester, String label) async {
  final target = find.text(label);
  await tester.ensureVisible(target);
  await tester.tap(target);
  await tester.pumpAndSettle();
}

final _catalog = {
  'documents': [
    for (final id in ['terms', 'privacy', 'ai'])
      {
        'id': id,
        'title': id,
        'state': 'preview',
        'version': 'preview-v2',
        'hash': 'digest-$id',
        'sections': [],
      },
  ],
};
