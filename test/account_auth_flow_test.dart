import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/shared/http/json_client.dart';

void main() {
  testWidgets('320px phone registration uses the existing SMS flow', (
    tester,
  ) async {
    final service = _AuthService({'phoneCodesAvailable': true});
    await _open(tester, service);
    expect(find.text('木星环'), findsOneWidget);
    expect(find.text('在这里，慢慢认识自己'), findsOneWidget);
    expect(find.text('个人中心'), findsNothing);

    await _tap(tester, '注册');
    await _enter(tester, '手机号或邮箱', '13800138000');
    expect(_field('昵称'), findsNothing);
    expect(_field('确认密码'), findsNothing);
    expect(find.text('继续验证手机号'), findsOneWidget);
    await tester.testTextInput.receiveAction(TextInputAction.go);
    await tester.pumpAndSettle();
    expect(find.text('请确认登录协议'), findsOneWidget);
    expect(service.submitted, isEmpty);
    await _tap(tester, '同意并继续');
    expect(_field('手机号'), findsOneWidget);
    expect(find.text('未注册的手机号验证后会自动创建账号。'), findsOneWidget);

    await _tap(tester, '发送验证码');
    expect(find.textContaining('virtual-auth-provider/inbox'), findsOneWidget);
    expect(service.submitted.keys, ['/account/auth/phone/login/code']);
    expect(service.submitted['/account/auth/phone/login/code'], [
      {'phone': '+8613800138000'},
    ]);
    await _enter(tester, '验证码', '012345');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(service.submitted['/account/auth/phone/login'], [
      {
        'phone': '+8613800138000',
        'challengeId': 'fixture-challenge',
        'code': '012345',
        'acceptance': _acceptance('v1'),
      },
    ]);
    expect(service.account.session?.id, 'fixture-member');
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    '320px password registration confirms the same eight characters',
    (tester) async {
      final service = _AuthService({
        'emailRegistrationCodeRequired': false,
        'emailRegistrationAvailable': true,
      });
      await _open(tester, service);
      await _tap(tester, '注册');
      await _enter(tester, '手机号或邮箱', 'tester@example.test');
      await _enter(tester, '昵称', '木星测试');
      await _enter(tester, '密码', 'fixture1');
      await _enter(tester, '确认密码', 'fixture2');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      await _tap(tester, '同意并继续');
      expect(find.text('两次输入的密码不一致。'), findsOneWidget);
      expect(service.submitted, isEmpty);
      await _enter(tester, '确认密码', 'fixture1');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(service.submitted['/account/auth/register'], [
        {
          'email': 'tester@example.test',
          'displayName': '木星测试',
          'password': 'fixture1',
          'acceptance': _acceptance('v1'),
        },
      ]);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'simulated WeChat prompts again when the service updates agreements',
    (tester) async {
      final service = _AuthService({
        'localSocialProviders': ['wechat'],
      })..updateAgreements = true;
      await _open(tester, service);
      expect(find.text('第三方登录使用本机模拟身份。'), findsOneWidget);
      await _tap(tester, 'QQ 登录');
      expect(find.text('暂未接入QQ登录服务。'), findsOneWidget);
      expect(service.submitted, isEmpty);

      await _tap(tester, '微信登录');
      await _tap(tester, '同意并继续');
      expect(service.catalogReads, 2);
      expect(find.text('协议已更新，请阅读并重新确认后继续。'), findsOneWidget);
      expect(service.submitted['/account/auth/social/wechat'], [
        {'acceptance': _acceptance('v1')},
      ]);
      await _tap(tester, '微信登录');
      expect(find.text('请确认登录协议'), findsOneWidget);
      await _tap(tester, '同意并继续');
      expect(service.submitted['/account/auth/social/wechat'], [
        {'acceptance': _acceptance('v1')},
        {'acceptance': _acceptance('v2')},
      ]);
      expect(service.account.session?.socialProvider, 'wechat');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'an existing session only confirms the current required agreements',
    (tester) async {
      final service = _AuthService({})
        ..pendingAgreement = true
        ..updateAgreements = true;
      await _open(tester, service);
      expect(find.text('阅读并确认协议'), findsOneWidget);
      expect(find.text('退出登录'), findsOneWidget);
      expect(_field('密码'), findsNothing);
      await _tap(tester, '阅读并确认协议');
      await _tap(tester, '同意并继续');
      expect(service.account.authorizedSession, isNull);
      expect(service.catalogReads, 2);
      await _tap(tester, '阅读并确认协议');
      await _tap(tester, '同意并继续');
      final submissions = service.submitted['/account/agreements/confirmation'];
      expect(submissions, [
        {'agreements': _acceptance('v1')['agreements'], 'source': 'sign-in'},
        {'agreements': _acceptance('v2')['agreements'], 'source': 'sign-in'},
      ]);
      expect(service.account.authorizedSession?.id, 'fixture-member');
      expect(tester.takeException(), isNull);
    },
  );
}

Future<void> _open(WidgetTester tester, _AuthService service) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 640);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetViewInsets);
  addTearDown(service.account.dispose);
  await service.account.initialize();
  await tester.pumpWidget(
    MaterialApp(
      theme: ThemeData.dark(),
      home: AccountPage(account: service.account, standalone: true),
    ),
  );
  await tester.pumpAndSettle();
}

Finder _field(String label) => find.widgetWithText(TextField, label);

Future<void> _enter(WidgetTester tester, String label, String value) async {
  final field = _field(label);
  await tester.ensureVisible(field);
  await tester.enterText(field, value);
  tester.view.viewInsets = const FakeViewPadding(bottom: 240);
  await tester.pumpAndSettle();
}

Future<void> _tap(WidgetTester tester, String label) async {
  final target = find.text(label);
  await tester.ensureVisible(target);
  await tester.tap(target);
  await tester.pumpAndSettle();
}

Map<String, Object?> _acceptance(String version) => {
  'agreed': true,
  'agreements': [
    for (final name in ['privacy', 'terms'])
      {'id': name, 'version': version, 'hash': '$name-$version'},
  ],
};

class _AuthService {
  _AuthService(this.capabilities) {
    final api = AccountApi(
      JsonHttpClient(
        base: Uri.https('account.example.test'),
        client: MockClient(_respond),
      ),
    );
    account = AccountController(api, AgreementsApi(api));
  }

  final Map<String, Object?> capabilities;
  late final AccountController account;
  final submitted = <String, List<Object?>>{};
  bool updateAgreements = false;
  bool pendingAgreement = false;
  int catalogReads = 0;
  String version = 'v1';

  Future<http.Response> _respond(http.Request request) async {
    final path = request.url.path;
    if (request.method == 'POST') {
      submitted.putIfAbsent(path, () => []).add(jsonDecode(request.body));
    }
    switch ('${request.method} $path') {
      case 'GET /account/session':
        return pendingAgreement ? _member() : _json({}, 401);
      case 'GET /account/auth/guest':
        return _json({}, 401);
      case 'GET /account/auth/capabilities':
        return _json(capabilities);
      case 'GET /account/agreements/catalog':
        catalogReads++;
        return _json({
          'documents': [
            _document('terms', '用户服务协议'),
            _document('privacy', '隐私政策'),
            _document('ai', 'AI 数据共享告知'),
          ],
        });
      case 'POST /account/auth/phone/login/code':
        return _json({
          'challengeId': 'fixture-challenge',
          'delivery': 'local-inbox',
        });
      case 'POST /account/auth/social/wechat':
        if (updateAgreements) {
          updateAgreements = false;
          version = 'v2';
          return _json({}, 412);
        }
        return _member(provider: 'wechat');
      case 'POST /account/auth/phone/login':
      case 'POST /account/auth/register':
        return _member();
      case 'POST /account/agreements/confirmation':
        if (updateAgreements) {
          updateAgreements = false;
          version = 'v2';
          return _json({}, 409);
        }
        pendingAgreement = false;
        return _state();
      case 'GET /account/agreements':
        return _state();
      default:
        throw StateError('Unexpected request: ${request.method} $path');
    }
  }

  http.Response _state() => _json({
    'requiredAccepted': !pendingAgreement,
    'permissions': {for (final purpose in aiPurposes.keys) purpose: false},
  });

  Map<String, Object?> _document(String id, String title) => {
    'id': id,
    'title': title,
    'version': version,
    'hash': '$id-$version',
    'state': 'preview',
    'sections': [
      {'title': title, 'text': '用于认证流程测试。'},
    ],
  };
}

http.Response _member({String? provider}) => _json({
  'user': {
    'id': 'fixture-member',
    'uid': '12345678',
    'displayName': '木星测试',
    if (provider != null) 'socialProvider': provider,
  },
});

http.Response _json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status);
