import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/account/auth/model/session.dart';
import '../src/features/account/profile/view/profile_dashboard.dart';
import '../src/features/account/profile/model/profile_details_store.dart';
import '../src/features/account/profile/model/profile_device_scope.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/account/settings/view/account_settings_page.dart';
import '../src/shared/http/json_client.dart';

const _memberId = '00000000-0000-0000-0000-000000000001';
const _guestId = '00000000-0000-0000-0000-000000000002';
const _friendId = '00000000-0000-0000-0000-000000000003';

class _Storage implements NativeSessionStorage {
  String? token = 'fixture';

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String? token) async => this.token = token;
}

http.Response _json(Object? value, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(value)), status);

AccountController _fixture(
  List<String> paths, {
  bool guest = false,
  bool accepted = true,
}) {
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.parse('https://account.example.test'),
      client: MockClient((request) async {
        final route = '${request.method} ${request.url.path}';
        paths.add(route);
        switch (route) {
          case 'GET /account/session':
            if (guest) return _json({'error': 'unauthorized'}, 401);
            return _json({
              'user': {
                'id': _memberId,
                'uid': '12345678',
                'displayName': '若水',
                'bio': '账户公开简介',
              },
            });
          case 'GET /account/auth/guest':
            return _json({'id': _guestId, 'expiresAt': 1900000000000});
          case 'GET /account/auth/capabilities':
            return _json({});
          case 'GET /account/agreements/catalog':
            return _json({
              'documents': [
                for (final (id, title) in [
                  ('terms', '用户协议'),
                  ('privacy', '隐私政策'),
                  ('ai', 'AI 服务与数据共享告知'),
                ])
                  {
                    'id': id,
                    'version': 'v1',
                    'hash': 'fixture-$id',
                    'title': title,
                    'state': 'published',
                    'sections': [
                      {'title': '告知', 'text': '协议正文'},
                    ],
                  },
              ],
            });
          case 'GET /account/agreements':
            return _json(_permissions(accepted));
          case 'POST /account/agreements/confirmation':
            return _json(_permissions(true));
          case 'GET /social/me':
            expect(request.headers['authorization'], 'Bearer fixture');
            return _json({
              'following': 2,
              'followers': 3,
              'discoverable': true,
            });
          case 'GET /social/following':
            return _json({
              'items': [
                {
                  'id': _friendId,
                  'displayName': '苍蓝',
                  'following': 0,
                  'followers': 1,
                  'follows': true,
                  'followedBy': false,
                },
              ],
            });
          case 'GET /account/destiny-history':
            expect(
              request.url.queryParameters['expectedOwnerId'],
              guest ? _guestId : _memberId,
            );
            return _json({'entries': []});
          case 'GET /account/destiny-history/latest':
            expect(
              request.url.queryParameters['expectedOwnerId'],
              guest ? _guestId : _memberId,
            );
            return _json(null);
          case 'POST /account/auth/logout':
            return http.Response('', 204);
          default:
            fail('Unexpected route $route');
        }
      }),
    ),
    nativeSession: _Storage(),
  );
  return AccountController(api, AgreementsApi(api));
}

Map<String, Object?> _permissions(bool accepted) => {
  'requiredAccepted': accepted,
  'permissions': {for (final purpose in aiPurposes.keys) purpose: false},
};

Widget _app(
  AccountController account, {
  VoidCallback? onUpgrade,
  VoidCallback? onMessages,
  ValueChanged<ThemeMode>? onThemeModeChanged,
}) => MaterialApp(
  home: Scaffold(
    body: Builder(
      builder: (context) => ListView(
        padding: const EdgeInsets.all(16),
        children: [
          ProfileDashboard(
            account: account,
            onUpgrade: onUpgrade,
            openMessages: onMessages,
            openSettings: () => Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => AccountSettingsPage(
                  account: account,
                  onThemeModeChanged: onThemeModeChanged,
                  appVersion: '0.1.0',
                ),
              ),
            ),
          ),
        ],
      ),
    ),
  ),
);

void main() {
  const legacyProfile = MethodChannel('jovian/legacy_preferences');
  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    final messenger =
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
    messenger.setMockMethodCallHandler(legacyProfile, (_) async => null);
    addTearDown(() => messenger.setMockMethodCallHandler(legacyProfile, null));
  });

  testWidgets(
    'preserves the original narrow layout, real counts, UID copying, and shortcuts',
    (tester) async {
      final paths = <String>[];
      final account = _fixture(paths);
      final clipboard = <Object?>[];
      var openedMessages = false;
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 720);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') clipboard.add(call.arguments);
          return null;
        },
      );
      addTearDown(() {
        tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        );
      });
      await account.initialize();
      await tester.pumpWidget(
        _app(account, onMessages: () => openedMessages = true),
      );
      await tester.pumpAndSettle();
      final avatar = tester.getRect(
        find.byKey(const ValueKey('profile-avatar')),
      );
      final gear = tester.getRect(find.byTooltip('设置'));
      expect(avatar.size, const Size.square(104));
      expect(gear.bottom, lessThan(avatar.top));
      expect(gear.right, greaterThan(avatar.right));
      expect(
        tester.getTopLeft(find.text('我的报告')).dy,
        tester.getTopLeft(find.text('消息')).dy,
      );
      await tester.tap(find.text('消息'));
      expect(openedMessages, isTrue);
      expect(find.text('若水'), findsOneWidget);
      expect(find.text('粉丝 3'), findsOneWidget);
      await tester.longPress(find.text('UID 12345678'));
      await tester.pumpAndSettle();
      expect(clipboard, [
        {'text': '12345678'},
      ]);
      await tester.tap(find.text('关注 2'));
      await tester.pumpAndSettle();
      expect(find.text('苍蓝'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('我的报告'));
      await tester.pumpAndSettle();
      expect(find.text('暂无已保存的报告。'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('命理档案'));
      await tester.pumpAndSettle();
      expect(find.text('还没有已保存的盘面。'), findsOneWidget);
      expect(paths.where((route) => route == 'GET /social/me'), hasLength(2));
      expect(paths, contains('GET /social/following'));
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('添加个性签名'));
      await tester.pumpAndSettle();
      expect(find.widgetWithText(TextField, '个性签名'), findsOneWidget);
      expect(find.widgetWithText(TextField, '个人简介'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      account.dispose();
    },
  );

  testWidgets(
    'local signature and tags stay with their identity on a narrow dashboard',
    (tester) async {
      final key = profileDeviceKey('member:$_memberId', 'profile-details');
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        legacyProfile,
        (call) async => call.method == 'readProfile' && call.arguments == key
            ? jsonEncode({
                'signature': '旧本机签名',
                'tags': {'zodiac': '双鱼座'},
              })
            : null,
      );
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 720);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final paths = <String>[];
      final member = _fixture(paths);
      final guest = _fixture(<String>[], guest: true);
      addTearDown(member.dispose);
      addTearDown(guest.dispose);
      await member.initialize();
      await tester.pumpWidget(_app(member));
      await tester.pumpAndSettle();
      expect(find.text('旧本机签名'), findsOneWidget);
      expect(find.text('账户公开简介'), findsNothing);
      expect(find.text('双鱼座'), findsOneWidget);
      await tester.tap(find.text('旧本机签名'));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextField, '个性签名'),
        '  新的本机签名  ',
      );
      await tester.tap(find.text('保存'));
      await tester.pumpAndSettle();
      expect(find.text('新的本机签名'), findsOneWidget);

      await tester.tap(find.text('双鱼座'));
      await tester.pumpAndSettle();
      for (final (label, value) in [
        ('星座', '双鱼座'),
        ('性格', '慢热'),
        ('兴趣', '书与山'),
      ]) {
        final input = find.widgetWithText(TextField, label);
        await tester.ensureVisible(input);
        await tester.enterText(input, value);
      }
      await tester.tap(find.text('保存'));
      await tester.pumpAndSettle();
      expect(find.text('慢热'), findsOneWidget);
      expect(find.text('书与山'), findsOneWidget);
      expect(paths.where((route) => route.startsWith('PATCH ')), isEmpty);
      expect(tester.takeException(), isNull);

      await tester.tap(find.text('基础个人资料'));
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(find.widgetWithText(TextField, '个人简介'))
            .controller!
            .text,
        '账户公开简介',
      );
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('新的本机签名'));
      await tester.pumpAndSettle();
      await tester.enterText(find.widgetWithText(TextField, '个性签名'), '未保存草稿');
      await member.signOut();
      await tester.pumpAndSettle();
      expect(find.text('当前会话已变更'), findsOneWidget);
      expect(find.text('新的本机签名'), findsNothing);
      expect(find.text('未保存草稿'), findsNothing);
      await tester.tap(find.text('关闭'));
      await tester.pumpAndSettle();
      await guest.initialize();
      await tester.pumpWidget(_app(guest));
      await tester.pumpAndSettle();
      expect(find.text('添加个性签名'), findsOneWidget);
      expect(find.text('添加标签'), findsOneWidget);
      expect(find.text('书与山'), findsNothing);
      expect(
        (await const LocalProfileDetailsStore().read(
          'member:$_memberId',
        )).signature,
        '新的本机签名',
      );
      await tester.pumpWidget(const SizedBox.shrink());
    },
  );

  testWidgets('account switches hide stale details during native reads', (
    tester,
  ) async {
    final member = _fixture(<String>[]);
    final guest = _fixture(<String>[], guest: true);
    addTearDown(member.dispose);
    addTearDown(guest.dispose);
    await member.initialize();
    await guest.initialize();
    final memberKey = profileDeviceKey(
      member.authorizedSession!.scope,
      'profile-details',
    );
    final guestKey = profileDeviceKey(
      guest.authorizedSession!.scope,
      'profile-details',
    );
    final guestRead = Completer<String?>();
    tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
      legacyProfile,
      (call) async {
        if (call.method != 'readProfile') return null;
        if (call.arguments == memberKey)
          return jsonEncode({'signature': '会员的旧签名'});
        if (call.arguments == guestKey) return guestRead.future;
        return null;
      },
    );

    await tester.pumpWidget(_app(member));
    await tester.pumpAndSettle();
    expect(find.text('会员的旧签名'), findsOneWidget);
    await tester.pumpWidget(_app(guest));
    await tester.pump();
    expect(find.text('会员的旧签名'), findsNothing);
    guestRead.complete(jsonEncode({'signature': '游客的旧签名'}));
    await tester.pumpAndSettle();
    expect(find.text('游客的旧签名'), findsOneWidget);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets(
    'settings opens agreements and privacy, sends presentation choice and signs out',
    (tester) async {
      final paths = <String>[];
      final account = _fixture(paths);
      ThemeMode? choice;
      await account.initialize();
      await tester.pumpWidget(
        _app(account, onThemeModeChanged: (value) => choice = value),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('设置'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('隐私设置'));
      await tester.pumpAndSettle();
      expect(find.text('命理在线解读'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('协议与政策'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('《用户协议》'));
      await tester.pumpAndSettle();
      expect(find.text('协议正文'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('外观模式'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('深色模式'));
      await tester.pumpAndSettle();
      expect(choice, ThemeMode.dark);
      expect(find.text('选择喜欢的阅读方式'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('深色'), findsOneWidget);
      final about = find.text('关于木星环');
      await tester.ensureVisible(about);
      await tester.pumpAndSettle();
      await tester.tap(about);
      await tester.pumpAndSettle();
      expect(find.text('版本 0.1.0'), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      final signOut = find.text('退出登录');
      await tester.ensureVisible(signOut);
      await tester.pumpAndSettle();
      await tester.tap(signOut);
      await tester.pumpAndSettle();
      await tester.tap(find.text('确认退出'));
      await tester.pumpAndSettle();
      expect(paths, contains('POST /account/auth/logout'));
      expect(find.text('若水'), findsNothing);
      expect(find.text('登录后可查看个人资料。'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      account.dispose();
    },
  );

  testWidgets(
    'guests can open reports and upgrade without reading member social data',
    (tester) async {
      final paths = <String>[];
      final account = _fixture(paths, guest: true);
      var upgraded = false;
      await account.initialize();
      await tester.pumpWidget(_app(account, onUpgrade: () => upgraded = true));
      await tester.pumpAndSettle();
      await tester.tap(find.text('登录'));
      await tester.pumpAndSettle();
      expect(upgraded, isTrue);
      expect(find.text('我的报告'), findsOneWidget);
      expect(find.text('命理档案'), findsOneWidget);
      expect(paths.where((route) => route.contains('/social/')), isEmpty);
      await tester.tap(find.byTooltip('设置'));
      await tester.pumpAndSettle();
      expect(find.text('结束游客体验'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      account.dispose();
    },
  );
}
