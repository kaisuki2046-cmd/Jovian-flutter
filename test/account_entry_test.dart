import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';
import '../src/features/account/account.dart';
import '../src/features/account/auth/model/account_deletion.dart';
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

class _DeletionStorage implements DeletionReceiptStorage {
  SavedDeletion? latest;

  @override
  Future<SavedDeletion?> read() async => latest;

  @override
  Future<void> write(SavedDeletion? receipt) async => latest = receipt;
}

void main() {
  testWidgets(
    'a server-required nickname gates the signed-in app until saved',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 640);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      var pending = true;
      var displayName = '临时昵称';
      var protectedReads = 0;
      final writes = <Map<String, Object?>>[];
      Map<String, Object?> member() => {
        'user': {
          'id': 'nickname-owner',
          'displayName': displayName,
          'bio': '原个人简介',
          if (pending) 'nicknameRequired': true,
        },
      };
      final api = AccountApi(
        JsonHttpClient(
          base: Uri.parse('https://account.example.test'),
          client: MockClient((request) async {
            switch ('${request.method} ${request.url.path}') {
              case 'GET /account/session':
                return _json(member());
              case 'GET /account/auth/capabilities':
                return _json({'phoneCodesAvailable': true});
              case 'GET /account/agreements/catalog':
                return _json({
                  'documents': [
                    _document('terms', '用户服务协议'),
                    _document('privacy', '隐私政策'),
                    _document('ai', 'AI 数据共享告知'),
                  ],
                });
              case 'GET /account/agreements':
                return _json({
                  'requiredAccepted': true,
                  'permissions': {
                    for (final key in aiPurposes.keys) key: false,
                  },
                });
              case 'GET /social/me':
                protectedReads++;
                return _json({'followingCount': 0, 'followerCount': 0});
              case 'PATCH /account/profile':
                final body = jsonDecode(request.body) as Map<String, Object?>;
                writes.add(body);
                if (body['displayName'] == '已经占用') return _json({}, 409);
                displayName = body['displayName'] as String;
                pending = false;
                return _json(member());
              default:
                return _json({}, 404);
            }
          }),
        ),
      );
      final account = AccountController(api, AgreementsApi(api));
      await tester.pumpWidget(
        JovianApp(account: account, initialTab: JovianTab.account),
      );
      await tester.pumpAndSettle();
      expect(find.text('设置昵称'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      expect(account.authorizedSession, isNull);
      expect(protectedReads, 0);
      final submit = find.widgetWithText(FilledButton, '保存昵称并继续');
      final field = find.widgetWithText(TextField, '昵称');
      await tester.enterText(field, '   ');
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(submit).onPressed, isNull);
      await tester.enterText(field, '已经占用');
      await tester.pumpAndSettle();
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(find.text('这个昵称已被使用，请换一个。'), findsOneWidget);
      expect(find.byType(NavigationBar), findsNothing);
      await tester.enterText(field, '  新的唯一昵称  ');
      await tester.pumpAndSettle();
      expect(find.text('这个昵称已被使用，请换一个。'), findsNothing);
      await tester.tap(submit);
      await tester.pumpAndSettle();
      expect(writes.last, {
        'expectedOwnerId': 'nickname-owner',
        'displayName': '新的唯一昵称',
        'bio': '原个人简介',
      });
      expect(find.text('设置昵称'), findsNothing);
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.text('新的唯一昵称'), findsOneWidget);
      expect(account.authorizedSession?.id, 'nickname-owner');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('confirmed account deletion can recover from a lost response', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(360, 800);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    const owner = 'fixture-owner';
    final receipt = 'r' * 43;
    final token = 't' * 43;
    final storage = _DeletionStorage();
    var accepted = false;
    var completed = false;
    var attempts = 0;
    var cleanup = 0;
    final api = AccountApi(
      JsonHttpClient(
        base: Uri.parse('https://account.example.test'),
        client: MockClient((request) async {
          switch ('${request.method} ${request.url.path}') {
            case 'GET /account/session':
              return accepted
                  ? _json({}, 401)
                  : _json({
                      'user': {
                        'id': owner,
                        'displayName': '测试会员',
                        'hasPassword': true,
                      },
                    });
            case 'GET /account/auth/capabilities':
              return _json({});
            case 'GET /account/agreements/catalog':
              return _json({
                'documents': [
                  _document('terms', '用户服务协议'),
                  _document('privacy', '隐私政策'),
                  _document('ai', 'AI 数据共享告知'),
                ],
              });
            case 'GET /account/agreements':
              return _json({
                'requiredAccepted': true,
                'permissions': {for (final key in aiPurposes.keys) key: false},
              });
            case 'GET /social/me':
              return _json({'followingCount': 0, 'followerCount': 0});
            case 'GET /account/deletion':
              return _json({'receipt': receipt, 'method': 'password'});
            case 'POST /account/deletion':
              expect(storage.latest?.receipt, receipt);
              final input = jsonDecode(request.body) as Map<String, Object?>;
              expect(input['confirm'], true);
              expect(input['legacyReadingTokens'], [token]);
              expect(input['receipt'], receipt);
              attempts++;
              if (input['password'] == 'wrong') return _json({}, 422);
              expect(input['password'], 'fixture-password');
              accepted = true;
              return _json({}, 503);
            case 'POST /account/deletion/status':
              expect(jsonDecode(request.body), {'receipt': receipt});
              return accepted
                  ? _json({
                      'status': completed ? 'completed' : 'pending',
                      'requestedAt': 1,
                      'completedAt': completed ? 2 : null,
                    })
                  : _json({}, 404);
            default:
              return _json({}, 404);
          }
        }),
      ),
    );
    final account = AccountController(
      api,
      AgreementsApi(api),
      deletionDevice: AccountDeletionDevice(
        receipts: storage,
        legacyReadingTokens: (id) async {
          expect(id, owner);
          return [token, token, 'invalid'];
        },
        clearMemberData: (id) async {
          expect(id, owner);
          expect(accepted, isTrue);
          cleanup++;
          if (cleanup < 3) throw StateError('test device storage unavailable');
        },
      ),
    );
    await tester.pumpWidget(
      JovianApp(account: account, initialTab: JovianTab.account),
    );
    await tester.pumpAndSettle();
    Future<void> tap(Finder finder) async {
      await tester.ensureVisible(finder);
      await tester.tap(finder);
      await tester.pumpAndSettle();
    }

    await tap(find.byTooltip('设置'));
    await tap(find.text('账户与安全'));
    await tap(find.text('注销账号'));
    await tap(find.text('阅读《账号注销与数据删除说明》'));
    expect(find.text('内测草案，未发布生效。'), findsOneWidget);
    expect(find.text('注销请求'), findsOneWidget);
    expect(find.text('数据处理范围'), findsOneWidget);
    await tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(attempts, 0);
    final password = find.widgetWithText(TextField, '当前密码');
    final submit = find.widgetWithText(FilledButton, '确认注销账号');
    await tester.enterText(password, 'wrong');
    await tester.pumpAndSettle();
    expect(tester.widget<FilledButton>(submit).onPressed, isNull);
    expect(attempts, 0);
    await tap(find.text('我了解注销影响并确认申请'));
    await tap(submit);
    expect(find.text('身份验证失败，请核对密码或验证码。'), findsOneWidget);
    expect(cleanup, 0);
    await tester.enterText(password, 'fixture-password');
    await tap(submit);
    expect(attempts, 2);
    expect(account.session, isNull);
    expect(find.text('账号已退出，关联数据正在清理。'), findsOneWidget);
    expect(find.text('本机记录清理未完成，请重试。'), findsOneWidget);
    completed = true;
    await tap(find.text('刷新注销状态'));
    expect(find.text('账号注销已完成。'), findsOneWidget);
    expect(storage.latest?.deviceCleared, true);
    await tap(find.text('知道了'));
    expect(storage.latest, isNull);
    expect(tester.takeException(), isNull);
  });

  testWidgets('recovers with a bound phone and returns to password sign-in', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    const phone = '+8613900139000';
    final calls = <String>[];
    final api = AccountApi(
      JsonHttpClient(
        base: Uri.parse('https://account.example.test'),
        client: MockClient((request) async {
          final path = request.url.path;
          if (path.startsWith('/account/auth/password-reset/')) {
            calls.add(request.url.pathSegments.last);
            final input = jsonDecode(request.body) as Map<String, Object?>;
            expect(input['phone'], phone);
            if (path.endsWith('/code'))
              return _json({'challengeId': 'fixture-sms'});
            if (path.endsWith('/verify')) {
              expect(input['challengeId'], 'fixture-sms');
              expect(input['code'], '012345');
              return _json({'resetToken': 'r' * 43});
            }
            expect(input['resetToken'], 'r' * 43);
            expect(input['newPassword'], 'fixture-next');
            return calls.where((call) => call == 'complete').length == 1
                ? _json({}, 410)
                : http.Response('', 204);
          }
          return switch (path) {
            '/account/session' || '/account/auth/guest' => _json({}, 401),
            '/account/auth/capabilities' => _json({
              'phoneCodesAvailable': true,
            }),
            '/account/agreements/catalog' => _json({
              'documents': [
                _document('terms', '用户服务协议'),
                _document('privacy', '隐私政策'),
                _document('ai', 'AI 数据共享告知'),
              ],
            }),
            _ => fail('Unexpected request $path'),
          };
        }),
      ),
    );
    final account = AccountController(api, AgreementsApi(api));
    await tester.pumpWidget(
      JovianApp(account: account, initialTab: JovianTab.account),
    );
    await tester.pumpAndSettle();
    Future<void> press(String label) async {
      final target = find.text(label);
      await tester.ensureVisible(target);
      await tester.tap(target);
      await tester.pumpAndSettle();
    }

    await press('手机号登录');
    expect(find.text('请确认登录协议'), findsOneWidget);
    expect(calls, isEmpty);
    await press('同意并继续');
    await press('找回账号');
    expect(find.text('请输入账号已绑定的手机号。'), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, '手机号'),
      '13900139000',
    );
    await press('找回账号');
    expect(find.text('验证手机号 139******00'), findsOneWidget);
    for (var attempt = 0; attempt < 2; attempt++) {
      await press('获取验证码');
      await tester.enterText(find.widgetWithText(TextField, '恢复验证码'), '012345');
      await press('验证并继续');
      await tester.enterText(
        find.widgetWithText(TextField, '新密码'),
        'fixture-next',
      );
      await tester.enterText(
        find.widgetWithText(TextField, '确认新密码'),
        'different',
      );
      await press('确认重置密码');
      expect(find.text('两次输入的新密码不一致。'), findsOneWidget);
      expect(calls.last, 'verify');
      await tester.enterText(
        find.widgetWithText(TextField, '确认新密码'),
        'fixture-next',
      );
      await press('确认重置密码');
      if (attempt == 0) {
        expect(find.text('验证已过期，请重新获取验证码。'), findsOneWidget);
      }
    }
    expect(calls, ['code', 'verify', 'complete', 'code', 'verify', 'complete']);
    expect(find.text('密码已重置，请使用新密码登录。'), findsOneWidget);
    final address = tester.widget<TextField>(
      find.widgetWithText(TextField, '手机号'),
    );
    expect(address.controller!.text, '13900139000');
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'login first asks for agreement and preserves the old login wire contract',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({});
      addTearDown(() => FlutterSecureStorage.setMockInitialValues({}));
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
        JovianApp(
          account: account,
          initialTab: JovianTab.account,
          persistTheme: true,
        ),
      );
      await tester.pumpAndSettle();

      Future<void> openEmail() async {
        await tester.tap(find.text('其他登录方式'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('邮箱登录'));
        await tester.pumpAndSettle();
      }

      await openEmail();
      expect(find.text('请确认登录协议'), findsOneWidget);
      expect(loginBodies, isEmpty);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      expect(loginBodies, isEmpty);

      await openEmail();
      await tester.tap(find.text('同意并继续'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextField, '邮箱'),
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
      final darkMode = find.text('深色模式');
      await tester.tap(darkMode);
      await tester.pumpAndSettle();
      expect(Theme.of(tester.element(darkMode)).brightness, Brightness.dark);
      expect(
        await const FlutterSecureStorage().read(key: 'jovian.ui.theme.v1'),
        'dark',
      );
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('深色'), findsOneWidget);
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
      await tester.tap(find.byType(BackButton));
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
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('改名后的测试会员'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
