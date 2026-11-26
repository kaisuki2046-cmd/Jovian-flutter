import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/shared/http/json_client.dart';

http.Response _json(Object body, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), status);

Map<String, Object?> _document(String id, String title) => {
  'id': id,
  'title': title,
  'hash': 'hash-$id',
  'state': 'preview',
  'version': 'v1',
  'sections': [
    {'title': '测试协议', 'text': '用于登录契约对照'},
  ],
};

void main() {
  testWidgets(
    'login first asks for agreement and preserves the old login wire contract',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 800);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);

      final loginBodies = <Object?>[];
      final identityRequests = <Object?>[];
      final profileRequests = <Map<String, Object?>>[];
      final accountApi = AccountApi(
        JsonHttpClient(
          base: Uri.parse('https://account.example.test'),
          client: MockClient((request) async {
            const member = {
              'user': {
                'id': 'fixture-member',
                'uid': '12345678',
                'displayName': '测试会员',
              },
            };
            return switch ('${request.method} ${request.url.path}') {
              'GET /account/session' ||
              'GET /account/auth/guest' => _json({}, 401),
              'GET /account/auth/capabilities' => _json({
                'emailRegistrationAvailable': true,
                'phoneRegistrationWithoutCode': true,
              }),
              'GET /account/agreements/catalog' => _json({
                'documents': [
                  _document('terms', '用户服务协议'),
                  _document('privacy', '隐私政策'),
                  _document('ai', 'AI 数据共享告知'),
                ],
              }),
              'POST /account/auth/login' => (() {
                loginBodies.add(jsonDecode(request.body));
                return _json(member);
              })(),
              'GET /account/agreements' => _json({
                'requiredAccepted': true,
                'permissions': {for (final key in aiPurposes.keys) key: false},
              }),
              'GET /social/me' => _json({
                'followingCount': 0,
                'followerCount': 0,
              }),
              'POST /account/auth/identity-verification' => (() {
                identityRequests.add(jsonDecode(request.body));
                return _json({
                  'code': 'IDENTITY_VERIFICATION_NOT_ENABLED',
                }, 503);
              })(),
              'PATCH /account/profile' => (() {
                final payload =
                    jsonDecode(request.body) as Map<String, Object?>;
                profileRequests.add(payload);
                if (payload['displayName'] == '占用昵称') return _json({}, 409);
                return _json({
                  'user': {
                    ...member['user']!,
                    'displayName': payload['displayName'],
                    'bio': payload['bio'],
                    'visibility': payload['visibility'],
                  },
                });
              })(),
              _ => _json({}, 404),
            };
          }),
        ),
      );
      final account = AccountController(accountApi, AgreementsApi(accountApi));
      await tester.pumpWidget(
        JovianApp(account: account, initialTab: JovianTab.account),
      );
      await tester.pumpAndSettle();

      await tester.enterText(
        find.widgetWithText(TextField, '手机号或邮箱'),
        'test@example.test',
      );
      await tester.enterText(
        find.widgetWithText(TextField, '密码'),
        'fixture-password',
      );
      final login = find.widgetWithText(FilledButton, '登录');
      expect(tester.widget<FilledButton>(login).onPressed, isNotNull);
      await tester.ensureVisible(login);
      await tester.tap(login);
      await tester.pumpAndSettle();
      expect(find.text('请确认登录协议'), findsOneWidget);
      expect(loginBodies, isEmpty);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(loginBodies, isEmpty);

      await tester.tap(login);
      await tester.pumpAndSettle();
      await tester.tap(find.text('同意并继续'));
      await tester.pumpAndSettle();
      expect(loginBodies, [
        {
          'email': 'test@example.test',
          'password': 'fixture-password',
          'acceptance': {
            'agreed': true,
            'agreements': [
              {'id': 'privacy', 'version': 'v1', 'hash': 'hash-privacy'},
              {'id': 'terms', 'version': 'v1', 'hash': 'hash-terms'},
            ],
          },
        },
      ]);
      expect(find.text('测试会员'), findsOneWidget);
      expect(find.textContaining('12345678'), findsOneWidget);
      await tester.tap(find.byTooltip('设置'));
      await tester.pumpAndSettle();
      expect(find.text('隐私设置'), findsOneWidget);
      expect(find.byType(NavigationBar), findsOneWidget);
      await tester.tap(find.text('外观模式'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('深色'));
      await tester.pumpAndSettle();
      expect(
        Theme.of(tester.element(find.byType(NavigationBar))).brightness,
        Brightness.dark,
      );
      await tester.tap(find.text('基础个人资料'));
      await tester.pumpAndSettle();
      final nickname = find.widgetWithText(TextField, '昵称');
      await tester.enterText(nickname, '占用昵称');
      await tester.tap(find.text('保存资料'));
      await tester.pumpAndSettle();
      expect(find.text('这个昵称已被使用，请换一个。'), findsOneWidget);
      await tester.enterText(nickname, '改名后的测试会员');
      await tester.enterText(find.widgetWithText(TextField, '个人简介'), '测试个人简介');
      await tester.tap(find.text('公开昵称'));
      await tester.tap(find.text('保存资料'));
      await tester.pumpAndSettle();
      expect(find.text('个人资料已保存。'), findsOneWidget);
      expect(profileRequests.last, {
        'expectedOwnerId': 'fixture-member',
        'displayName': '改名后的测试会员',
        'bio': '测试个人简介',
        'visibility': {'displayName': true, 'bio': false},
      });
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('账户与安全'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('实名认证'));
      await tester.pumpAndSettle();
      expect(find.text('《实名认证服务协议》'), findsOneWidget);
      final name = find.widgetWithText(TextField, '真实姓名');
      final number = find.widgetWithText(TextField, '身份证号码');
      final submit = find.widgetWithText(FilledButton, '提交');
      await tester.enterText(name, '测试姓名');
      await tester.enterText(number, '00000000000000000X');
      expect(tester.widget<FilledButton>(submit).onPressed, isNull);
      await tester.tap(find.byType(Checkbox));
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(identityRequests, [<String, Object?>{}]);
      expect(find.text('实名认证服务暂未接入。'), findsOneWidget);
      expect(tester.widget<TextField>(name).controller!.text, isEmpty);
      expect(tester.widget<TextField>(number).controller!.text, isEmpty);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('改名后的测试会员'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
