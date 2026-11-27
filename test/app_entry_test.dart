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
  testWidgets('profile login opens the welcome page and can return as guest', (
    tester,
  ) async {
    final requests = <String>[];
    final account = _account((request) async {
      final route = '${request.method} ${request.url.path}';
      requests.add(route);
      return switch (route) {
        'GET /account/session' => _json({}, 401),
        'GET /account/auth/guest' => _json({
          'id': 'profile-guest',
          'expiresAt': 4102444800000,
        }),
        'GET /account/auth/capabilities' => _json({
          'emailRegistrationAvailable': true,
          'localSocialProviders': ['wechat', 'qq'],
        }),
        'GET /account/agreements/catalog' => _json(_catalog),
        'GET /account/agreements' => _agreementState(true),
        _ => _json({}, 404),
      };
    });
    await tester.pumpWidget(
      JovianApp(account: account, initialTab: JovianTab.account),
    );
    await tester.pumpAndSettle();
    expect(find.text('我的报告'), findsOneWidget);
    await _press(tester, '登录');
    expect(find.text('在这里，慢慢认识自己'), findsOneWidget);
    expect(find.byType(NavigationBar), findsNothing);
    expect(find.text('登录或注册成功后会结束当前游客会话并删除游客档案。'), findsOneWidget);
    await _press(tester, '其他登录方式');
    expect(find.widgetWithText(ListTile, '微信登录'), findsOneWidget);
    expect(find.widgetWithText(ListTile, 'QQ 登录'), findsOneWidget);
    await _press(tester, '邮箱登录');
    await _press(tester, '同意并继续');
    expect(find.widgetWithText(TextField, '邮箱'), findsOneWidget);

    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('其他登录方式'), findsOneWidget);
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('我的报告'), findsOneWidget);
    expect(account.authorizedSession?.scope, 'guest:profile-guest');

    await _press(tester, '登录');
    await _press(tester, '返回游客资料');
    expect(find.text('我的报告'), findsOneWidget);
    expect(account.authorizedSession?.scope, 'guest:profile-guest');
    expect(requests.where((route) => route.startsWith('POST')), isEmpty);
  });

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

  testWidgets('welcome chooses a sign-in route and keeps consent on return', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final attempts = <Map<String, Object?>>[];
    final account = _account((request) async {
      switch (request.method + ' ' + request.url.path) {
        case 'GET /account/session':
        case 'GET /account/auth/guest':
          return _json({}, 401);
        case 'GET /account/auth/capabilities':
          return _json({
            'emailRegistrationAvailable': true,
            'phoneCodesAvailable': true,
            'localSocialProviders': ['qq'],
          });
        case 'GET /account/agreements/catalog':
          return _json(_catalog);
        case 'POST /account/auth/login':
          attempts.add(jsonDecode(request.body) as Map<String, Object?>);
          return _json({
            'user': {'id': 'welcome-member', 'displayName': '邮箱会员'},
          });
        case 'GET /account/agreements':
          return _agreementState(true);
        default:
          return _json({}, 404);
      }
    });
    await tester.pumpWidget(JovianApp(account: account));
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNothing);
    final wechat = tester.widget<FilledButton>(
      find.widgetWithText(FilledButton, '微信登录'),
    );
    expect(wechat.onPressed, isNull);

    await _press(tester, '手机号登录');
    expect(find.byType(TextField), findsNothing);
    await _press(tester, '取消');
    expect(find.text('其他登录方式'), findsOneWidget);
    expect(attempts, isEmpty);
    await _press(tester, '手机号登录');
    await _press(tester, '同意并继续');
    expect(find.widgetWithText(TextField, '手机号'), findsOneWidget);
    expect(find.widgetWithText(TextField, '验证码'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, '手机号'),
      '13800000000',
    );
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('其他登录方式'), findsOneWidget);

    await _press(tester, '注册');
    final registration = find.widgetWithText(TextField, '手机号或邮箱');
    expect(tester.widget<TextField>(registration).controller?.text, isEmpty);
    expect(find.widgetWithText(TextField, '昵称'), findsOneWidget);
    await _press(tester, '返回');

    await _press(tester, '其他登录方式');
    expect(find.text('选择登录方式'), findsOneWidget);
    final qq = tester.widget<ListTile>(find.widgetWithText(ListTile, 'QQ 登录'));
    expect(qq.onTap, isNotNull);
    await _press(tester, '邮箱登录');
    expect(find.text('同意并继续'), findsNothing);
    await tester.enterText(
      find.widgetWithText(TextField, '邮箱'),
      'User@example.test',
    );
    await tester.enterText(
      find.widgetWithText(TextField, '密码'),
      'FixturePassword',
    );
    await _press(tester, '登录');

    expect(attempts, [
      {
        'email': 'user@example.test',
        'password': 'FixturePassword',
        'acceptance': {
          'agreed': true,
          'agreements': [
            for (final id in ['privacy', 'terms'])
              {'id': id, 'version': 'preview-v2', 'hash': 'digest-' + id},
          ],
        },
      },
    ]);
    expect(account.authorizedSession?.scope, 'member:welcome-member');
    expect(find.byType(NavigationBar), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

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
