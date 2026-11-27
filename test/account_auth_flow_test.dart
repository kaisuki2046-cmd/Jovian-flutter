import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/shared/http/json_client.dart';
import '../src/ui/interface_language.dart';

void main() {
  testWidgets('a 320dp OTP form fits all six digits at large text size', (
    tester,
  ) async {
    final service = _AuthService({'phoneCodesAvailable': true});
    await _open(tester, service, largeText: true);
    await tester.scrollUntilVisible(find.text('Sign in with phone'), 140);
    await _tap(tester, 'Sign in with phone');
    await _tap(tester, 'Agree and continue');
    final formScroller = find
        .descendant(
          of: find.byType(ListView),
          matching: find.byType(Scrollable),
        )
        .first;
    expect(_field('Phone number').hitTestable(), findsOneWidget);
    await _enter(tester, 'Phone number', '13800138000');
    await tester.scrollUntilVisible(
      find.text('Send code'),
      100,
      scrollable: formScroller,
    );
    final send = find.text('Send code');
    await Scrollable.ensureVisible(tester.element(send), alignment: 0.5);
    await tester.pumpAndSettle();
    await tester.tap(send.hitTestable());
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      _field('Verification code'),
      -100,
      scrollable: formScroller,
    );
    await _enter(tester, 'Verification code', '012345');

    final field = _field('Verification code');
    final editor = tester.widget<EditableText>(
      find.descendant(of: field, matching: find.byType(EditableText)),
    );
    final digits = TextPainter(
      text: TextSpan(text: editor.controller.text, style: editor.style),
      textDirection: TextDirection.ltr,
      textScaler: TextScaler.linear(2),
    )..layout();
    // The field also needs horizontal padding around the six-digit code.
    expect(
      tester.getSize(field).width,
      greaterThanOrEqualTo(digits.width + 24),
    );
    digits.dispose();
    expect(find.text('Resend code'), findsOneWidget);
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
    expect(tester.takeException(), isNull);
  });

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
    expect(find.textContaining('模拟认证服务的收件箱'), findsOneWidget);
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
    'email registration retains a usable code when resend is throttled',
    (tester) async {
      final service =
          _AuthService({
              'emailRegistrationAvailable': true,
              'emailRegistrationCodeRequired': true,
            })
            ..emailCodeStatuses.addAll([200, 429, 200])
            ..registrationStatuses.addAll([422, 410, 201]);
      await _open(tester, service);
      await _tap(tester, '注册');
      await _enter(tester, '手机号或邮箱', '13800138000');
      expect(find.text('当前暂不支持手机号注册，请使用邮箱。'), findsOneWidget);
      expect(_field('昵称'), findsNothing);
      expect(
        tester
            .widget<FilledButton>(find.widgetWithText(FilledButton, '创建账号'))
            .onPressed,
        isNull,
      );

      await _enter(tester, '手机号或邮箱', 'tester@example.test');
      await _enter(tester, '昵称', '邮箱测试');
      await _enter(tester, '密码', 'fixture1');
      await _enter(tester, '确认密码', 'fixture1');
      await _tap(tester, '发送验证码');
      expect(service.submitted, isEmpty);
      await _tap(tester, '同意并继续');
      await _enter(tester, '验证码', '654321');
      await _tap(tester, '重新发送');
      expect(
        tester.widget<TextField>(_field('验证码')).controller!.text,
        '654321',
      );
      expect(find.text('操作太频繁，请稍后重试。'), findsOneWidget);
      await _tap(tester, '创建账号');
      expect(find.text('验证码不正确，请检查后重试。'), findsOneWidget);
      expect(find.text('重新发送'), findsOneWidget);

      await _enter(tester, '验证码', '123456');
      await _tap(tester, '创建账号');
      expect(find.text('这个验证码已失效，请重新获取。'), findsOneWidget);
      expect(tester.widget<TextField>(_field('验证码')).controller!.text, isEmpty);
      expect(find.text('发送验证码'), findsOneWidget);
      await _tap(tester, '发送验证码');
      await _enter(tester, '验证码', '223344');
      await _tap(tester, '创建账号');

      expect(service.submitted['/account/auth/register/code'], [
        for (var index = 0; index < 3; index++)
          {'email': 'tester@example.test'},
      ]);
      expect(service.submitted['/account/auth/register'], [
        for (final (id, code) in [
          ('email-challenge-1', '654321'),
          ('email-challenge-1', '123456'),
          ('email-challenge-3', '223344'),
        ])
          {
            'email': 'tester@example.test',
            'displayName': '邮箱测试',
            'password': 'fixture1',
            'challengeId': id,
            'code': code,
            'acceptance': _acceptance('v1'),
          },
      ]);
      expect(service.account.session?.id, 'fixture-member');
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
      await _tap(tester, '其他登录方式');
      final qq = find.widgetWithText(ListTile, 'QQ 登录');
      expect(qq, findsOneWidget);
      expect(tester.widget<ListTile>(qq).enabled, isFalse);
      expect(service.submitted, isEmpty);
      await tester.tap(find.byTooltip('关闭'));
      await tester.pumpAndSettle();

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

Future<void> _open(
  WidgetTester tester,
  _AuthService service, {
  bool largeText = false,
}) async {
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
      localizationsDelegates: largeText
          ? const [interfaceStringsDelegate]
          : const [],
      builder: largeText
          ? (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: const TextScaler.linear(2)),
              child: child!,
            )
          : null,
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
  final emailCodeStatuses = <int>[];
  final registrationStatuses = <int>[];
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
      case 'POST /account/auth/register/code':
        final status = emailCodeStatuses.removeAt(0);
        return status == 200
            ? _json({
                'challengeId': 'email-challenge-${submitted[path]!.length}',
              })
            : _json({}, status);
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
      case 'POST /account/auth/register':
        if (registrationStatuses.isNotEmpty) {
          final status = registrationStatuses.removeAt(0);
          if (status != 201) return _json({}, status);
        }
        return _member();
      case 'POST /account/auth/phone/login':
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
