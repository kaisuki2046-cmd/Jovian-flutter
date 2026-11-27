import 'dart:async';
import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/app_shell.dart';
import '../src/features/account/account.dart';
import '../src/features/account/auth/model/session.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/social/social.dart';
import '../src/shared/http/json_client.dart';
import '../src/ui/interface_language.dart';

const _memberId = '00000000-0000-0000-0000-000000000001';
const _actorId = '00000000-0000-0000-0000-000000000002';
const _alertId = '00000000-0000-0000-0000-000000000003';

class _Storage implements NativeSessionStorage {
  String? token = 'fixture-token';
  Completer<String?>? nextRead;

  @override
  Future<String?> read() {
    final pending = nextRead;
    nextRead = null;
    return pending?.future ?? Future.value(token);
  }

  @override
  Future<void> write(String? token) async => this.token = token;
}

const _profile = <String, Object?>{
  'id': _actorId,
  'uid': '12345678',
  'displayName': '明月',
  'following': 2,
  'followers': 3,
  'follows': false,
  'followedBy': true,
};

http.Response _json(Object value, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(value)), status);

AccountController _account(
  _Storage storage,
  Future<http.Response> Function(http.Request) social, {
  Future<http.Response> Function(http.Request)? visibleProfile,
  bool guest = false,
}) {
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.parse('https://account.example.test'),
      client: MockClient((request) async {
        if (request.url.path.startsWith('/social/')) {
          expect(request.headers['x-app-client'], 'native');
          expect(request.headers['authorization'], 'Bearer fixture-token');
          return social(request);
        }
        if (request.url.path == '/account/profile/visible/$_actorId') {
          expect(request.headers['x-app-client'], 'native');
          expect(request.headers['authorization'], 'Bearer fixture-token');
          return visibleProfile == null
              ? _json({
                  'profile': {'reading': {}},
                })
              : visibleProfile(request);
        }
        switch (request.url.path) {
          case '/account/session':
            return guest
                ? _json({
                    'guest': {
                      'id': 'guest-fixture',
                      'expiresAt': 1800000000000,
                    },
                  })
                : _json({
                    'user': {'id': _memberId, 'displayName': '当前会员'},
                  });
          case '/account/auth/capabilities':
            return _json({});
          case '/account/agreements/catalog':
            return _json({
              'documents': [
                for (final id in ['privacy', 'terms', 'ai'])
                  {
                    'id': id,
                    'version': 'v1',
                    'hash': 'fixture-$id',
                    'title': id,
                    'state': 'preview',
                    'sections': [],
                  },
              ],
            });
          case '/account/agreements':
            return _json({
              'requiredAccepted': true,
              'permissions': {
                for (final purpose in aiPurposes.keys) purpose: true,
              },
            });
          case '/account/auth/logout':
            return http.Response('', 204);
          default:
            fail('Unexpected account route ${request.method} ${request.url}');
        }
      }),
    ),
    nativeSession: storage,
  );
  return AccountController(api, AgreementsApi(api));
}

void main() {
  testWidgets('returning to Messages refreshes unread and moderation access', (
    tester,
  ) async {
    final delayed = Completer<http.Response>();
    var reads = 0;
    final account = _account(_Storage(), (request) async {
      expect(request.url.path, '/social/notifications/summary');
      return switch (++reads) {
        1 => _json({'unread': 1, 'canModerate': true}),
        2 => delayed.future,
        3 => _json({'error': 'forbidden'}, 403),
        4 => _json({'unread': 2, 'canModerate': false}),
        _ => throw StateError('Unexpected summary refresh'),
      };
    });
    addTearDown(account.dispose);
    await account.initialize();
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [interfaceStringsDelegate],
        home: JovianShell(
          initialTab: JovianTab.destiny,
          buildPage: (_, tab, active, _) => tab == JovianTab.messages
              ? SocialPage(account: account, active: active)
              : const SizedBox.shrink(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(reads, 0);

    Future<void> openTab(JovianTab tab) async {
      await tester.tap(find.byKey(ValueKey(tab)));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
    }

    await openTab(JovianTab.messages);
    expect(reads, 1);
    expect(find.text('1 unread'), findsOneWidget);
    expect(find.text('Moderation queue'), findsOneWidget);

    await openTab(JovianTab.destiny);
    expect(reads, 1);
    await openTab(JovianTab.messages);
    expect(reads, 2);
    expect(find.text('1 unread'), findsNothing);
    expect(find.text('Moderation queue'), findsNothing);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);

    await openTab(JovianTab.destiny);
    await openTab(JovianTab.messages);
    expect(reads, 3);
    expect(
      find.text('This account cannot access this feature.'),
      findsOneWidget,
    );

    delayed.complete(_json({'unread': 99, 'canModerate': true}));
    await tester.pumpAndSettle();
    expect(find.text('99 unread'), findsNothing);
    expect(find.text('Moderation queue'), findsNothing);

    await tester.tap(find.text('Retry'));
    await tester.pumpAndSettle();
    expect(reads, 4);
    expect(find.text('2 unread'), findsOneWidget);
    expect(find.text('Moderation queue'), findsNothing);
  });
  for (final switchTabs in [true, false]) {
    final reason = switchTabs ? 'switching tabs' : 'going back';
    testWidgets('a late read does not open a profile after $reason', (
      tester,
    ) async {
      final read = Completer<http.Response>();
      var reads = 0;
      var profileRequests = 0;
      var unread = 1;
      final account = _account(_Storage(), (request) async {
        switch (request.url.path) {
          case '/social/notifications/summary':
            return _json({'unread': unread, 'canModerate': false});
          case '/social/notifications':
            return _json({
              'unread': unread,
              'items': [
                {
                  'id': _alertId,
                  'actor': _profile,
                  'createdAt': 1700000000000,
                  'readAt': unread == 0 ? 1700000000001 : null,
                },
              ],
            });
          case '/social/notifications/read':
            reads++;
            return read.future;
          case '/social/profiles/$_actorId':
            profileRequests++;
            return _json(_profile);
          default:
            fail('Unexpected social route ${request.url.path}');
        }
      });
      addTearDown(account.dispose);
      await account.initialize();
      await tester.pumpWidget(
        MaterialApp(
          home: JovianShell(
            initialTab: JovianTab.messages,
            buildPage: (_, tab, active, _) => tab == JovianTab.messages
                ? SocialPage(account: account, active: active)
                : const SizedBox.shrink(),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('新增粉丝'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('查看主页'));
      await tester.pump();
      expect(reads, 1);

      if (switchTabs) {
        await tester.tap(find.byKey(const ValueKey(JovianTab.destiny)));
        await tester.pumpAndSettle();
      } else {
        await tester.tap(find.byType(BackButton));
        await tester.pump();
      }
      unread = 0;
      read.complete(_json({'unread': unread}));
      await tester.pumpAndSettle();
      expect(profileRequests, 0);

      if (switchTabs) {
        await tester.tap(find.byKey(const ValueKey(JovianTab.messages)));
      } else {
        expect(find.text('1 条未读'), findsNothing);
        await tester.tap(find.text('新增粉丝'));
      }
      await tester.pumpAndSettle();
      expect(find.text('明月关注了你'), findsOneWidget);
      expect(find.textContaining(' · 已读'), findsOneWidget);
      await tester.tap(find.text('查看主页'));
      await tester.pumpAndSettle();
      expect(find.text('UID 12345678'), findsOneWidget);
      expect(reads, 1);
      expect(profileRequests, 1);
    });
  }

  testWidgets('guest message shortcuts open sign-in prompts without requests', (
    tester,
  ) async {
    var signIns = 0;
    final account = _account(
      _Storage(),
      (request) async => fail('Guest requested ${request.url.path}'),
      guest: true,
    );
    addTearDown(account.dispose);
    await account.initialize();
    await tester.pumpWidget(
      MaterialApp(
        home: SocialPage(account: account, openAccount: () => signIns++),
      ),
    );
    await tester.pumpAndSettle();

    for (final destination in ['新增粉丝', '我的举报']) {
      await tester.tap(find.text(destination));
      await tester.pumpAndSettle();
      expect(find.text(destination), findsOneWidget);
      expect(find.text('登录后查看当前账户的消息'), findsOneWidget);
      await tester.tap(find.text('前往登录'));
      expect(find.byType(BackButton), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('消息'), findsOneWidget);
    }
    expect(signIns, 2);
  });

  testWidgets('loads, reads and returns from a live follower alert', (
    tester,
  ) async {
    final paths = <String>[];
    var unread = 1;
    final account = _account(_Storage(), (request) async {
      final route = '${request.method} ${request.url.path}';
      paths.add(route);
      switch (route) {
        case 'GET /social/notifications/summary':
          return _json({'unread': unread, 'canModerate': false});
        case 'GET /social/notifications':
          return _json({
            'unread': unread,
            'items': [
              {
                'id': _alertId,
                'actor': _profile,
                'createdAt': 1700000000000,
                'readAt': unread == 0 ? 1700000000001 : null,
              },
            ],
          });
        case 'POST /social/notifications/read':
          expect(jsonDecode(request.body), {'id': _alertId});
          return _json({'unread': --unread});
        case 'GET /social/profiles/$_actorId':
          return _json(_profile);
        case 'POST /social/follows':
          expect(jsonDecode(request.body), {'id': _actorId, 'active': true});
          return _json({
            'following': 2,
            'followers': 4,
            'follows': true,
            'followedBy': true,
          });
        default:
          fail('Unexpected social route $route');
      }
    });
    await account.initialize();
    await tester.pumpWidget(MaterialApp(home: SocialPage(account: account)));
    await tester.pumpAndSettle();
    expect(find.text('1 条未读'), findsOneWidget);
    expect(find.text('举报处理'), findsNothing);
    await tester.tap(find.text('新增粉丝'));
    await tester.pumpAndSettle();
    expect(find.text('明月关注了你'), findsOneWidget);
    await tester.tap(find.text('查看主页'));
    await tester.pumpAndSettle();
    expect(find.text('明月'), findsOneWidget);
    expect(find.text('UID 12345678'), findsOneWidget);
    await tester.tap(find.text('回关'));
    await tester.pumpAndSettle();
    expect(find.text('互相关注'), findsOneWidget);
    expect(find.text('粉丝 4'), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.textContaining(' · 已读'), findsOneWidget);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('1 条未读'), findsNothing);
    expect(paths, [
      'GET /social/notifications/summary',
      'GET /social/notifications',
      'POST /social/notifications/read',
      'GET /social/profiles/$_actorId',
      'POST /social/follows',
      'GET /social/notifications',
      'GET /social/notifications/summary',
    ]);
    expect(paths.where((route) => route.contains('conversation')), isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
    account.dispose();
  });

  testWidgets(
    'opens logged-in search through the narrow message actions menu',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 700);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final requests = <Map<String, String>>[];
      final account = _account(_Storage(), (request) async {
        if (request.url.path == '/social/notifications/summary') {
          return _json({'unread': 0, 'canModerate': false});
        }
        expect(request.url.path, '/social/search');
        final query = request.url.queryParameters;
        requests.add(query);
        return query.containsKey('uid')
            ? _json({'error': 'not_found'}, 404)
            : _json({
                'items': [_profile],
              });
      });
      await account.initialize();
      await tester.pumpWidget(MaterialApp(home: SocialPage(account: account)));
      await tester.pumpAndSettle();
      final more = find.byTooltip('更多操作');
      final findUser = find.widgetWithText(PopupMenuItem<VoidCallback>, '找用户');
      await tester.tap(more);
      await tester.pumpAndSettle();
      expect(findUser, findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(findUser, findsNothing);
      await tester.tap(more);
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(12, 400));
      await tester.pumpAndSettle();
      expect(findUser, findsNothing);
      await tester.tap(more);
      await tester.pumpAndSettle();
      await tester.tap(findUser);
      await tester.pumpAndSettle();
      expect(findUser, findsNothing);
      expect(find.text('找用户'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.enterText(find.byType(TextField), '1234');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      expect(find.text('请输入完整的 8 位 UID。'), findsOneWidget);
      expect(requests, isEmpty);
      await tester.enterText(find.byType(TextField), 'UID：12345678');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      expect(find.text('未找到该用户。'), findsOneWidget);
      await tester.tap(find.text('按昵称搜索'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), ' 明月 ');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsOneWidget);
      expect(requests, [
        {'uid': '12345678'},
        {'nickname': '明月'},
      ]);
      await account.signOut();
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsNothing);
      expect(find.text('登录后可按 UID 或昵称找用户，并查看新增粉丝提醒。'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      account.dispose();
    },
  );

  testWidgets(
    'follows in the list, preserves failed rows and removes unfollows',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 700);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final firstFollow = Completer<http.Response>();
      final mutations = <bool>[];
      var follows = false;
      var followerReads = 0;
      final account = _account(_Storage(), (request) async {
        final profile = {..._profile, 'follows': follows};
        switch (request.url.path) {
          case '/social/followers':
            followerReads++;
            return _json({
              'items': [profile],
            });
          case '/social/following':
            return _json({
              'items': [if (follows) profile],
            });
          case '/social/follows':
            expect(request.method, 'POST');
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            expect(body['id'], _actorId);
            final active = body['active'] as bool;
            mutations.add(active);
            if (mutations.length == 1) return firstFollow.future;
            follows = active;
            return _json({...profile, 'follows': follows});
          default:
            fail('Unexpected social request ${request.url}');
        }
      });
      await account.initialize();
      Widget list(SocialList direction) => MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [interfaceStringsDelegate],
        home: SocialConnectionsPage(account: account, direction: direction),
      );

      await tester.pumpWidget(list(SocialList.followers));
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Follow back'));
      await tester.pump();
      final follow = tester.widget<FilledButton>(
        find.widgetWithText(FilledButton, 'Follow back'),
      );
      expect(follow.onPressed, isNull);
      expect(
        tester
            .widget<IconButton>(
              find.byWidgetPredicate(
                (widget) => widget is IconButton && widget.tooltip == 'Refresh',
              ),
            )
            .onPressed,
        isNull,
      );
      firstFollow.complete(_json({'error': 'temporary'}, 503));
      await tester.pumpAndSettle();
      expect(
        find.text('Could not update the follow status. Try again.'),
        findsOneWidget,
      );
      expect(find.text('明月'), findsOneWidget);
      await tester.tap(find.widgetWithText(FilledButton, 'Follow back'));
      await tester.pumpAndSettle();
      expect(find.text('Following each other'), findsOneWidget);
      expect(find.text('明月'), findsOneWidget);
      await tester.tap(find.byTooltip('Refresh'));
      await tester.pumpAndSettle();
      expect(followerReads, 2);

      await tester.pumpWidget(list(SocialList.following));
      await tester.pumpAndSettle();
      await tester.tap(
        find.widgetWithText(FilledButton, 'Following each other'),
      );
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsNothing);
      expect(find.text('You are not following anyone yet.'), findsOneWidget);
      expect(mutations, [true, true, false]);
      expect(tester.takeException(), isNull);

      await tester.pumpWidget(const SizedBox.shrink());
      account.dispose();
    },
  );

  testWidgets('guest menu opens the sign-in gate without searching', (
    tester,
  ) async {
    final account = _account(
      _Storage(),
      (request) async => fail('A guest must not request ${request.url}.'),
      guest: true,
    );
    await account.initialize();
    var openedAccount = false;
    await tester.pumpWidget(
      MaterialApp(
        home: SocialPage(
          account: account,
          openAccount: () => openedAccount = true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('更多操作'));
    await tester.pumpAndSettle();
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
    expect(find.text('消息'), findsOneWidget);
    expect(find.text('找用户'), findsNothing);

    await tester.tap(find.byTooltip('更多操作'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(PopupMenuItem<VoidCallback>, '找用户'));
    await tester.pumpAndSettle();
    expect(find.text('找用户'), findsOneWidget);
    expect(find.byType(TextField), findsNothing);
    await tester.tap(find.text('前往登录'));
    expect(openedAccount, isTrue);
    await tester.tap(find.byType(BackButton));
    await tester.pumpAndSettle();
    expect(find.text('消息'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
    account.dispose();
  });

  test(
    'drops old-owner requests and responses when the session changes',
    () async {
      final storage = _Storage();
      var count = 0;
      final received = Completer<void>();
      final result = Completer<http.Response>();
      final account = _account(storage, (_) {
        count++;
        received.complete();
        return result.future;
      });
      addTearDown(account.dispose);
      await account.initialize();
      final pendingResponse = account.requestSocial(_memberId, [
        'notifications',
      ]);
      final responseCheck = expectLater(
        pendingResponse,
        throwsA(isA<JsonRequestError>()),
      );
      await received.future;
      final pendingCredentials = Completer<String?>();
      storage.nextRead = pendingCredentials;
      final staleRequest = account.requestSocial(
        _memberId,
        ['follows'],
        body: {'id': _actorId, 'active': true},
      );
      final credentialsCheck = expectLater(
        staleRequest,
        throwsA(isA<JsonRequestError>()),
      );
      await account.signOut();
      result.complete(_json({'unread': 1}));
      pendingCredentials.complete('fixture-token');
      await Future.wait([responseCheck, credentialsCheck]);
      expect(count, 1);
    },
  );

  testWidgets(
    'returns to the same search while rechecking access and retries public birth details',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 700);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final rechecking = Completer<http.Response>();
      final stale = Completer<http.Response>();
      final queries = <Map<String, String>>[];
      var birthReads = 0;
      final account = _account(
        _Storage(),
        (request) async {
          switch (request.url.path) {
            case '/social/notifications/summary':
              return _json({'unread': 0, 'canModerate': false});
            case '/social/profiles/$_actorId':
              return _json(_profile);
            case '/social/search':
              final query = request.url.queryParameters;
              queries.add(query);
              if (query['nickname'] == '晚到的昵称') return stale.future;
              if (queries.length == 2) return rechecking.future;
              if (query.containsKey('uid')) return _json(_profile);
              return _json({
                'items': [_profile],
              });
            default:
              fail('Unexpected social request ${request.url}');
          }
        },
        visibleProfile: (_) async {
          birthReads++;
          if (birthReads == 1) return _json({'error': 'temporary'}, 503);
          return _json({
            'profile': {
              'reading': {'birthPlace': '测试公开出生地'},
            },
          });
        },
      );
      await account.initialize();
      await tester.pumpWidget(MaterialApp(home: SocialPage(account: account)));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('找用户'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('按昵称搜索'));
      await tester.pumpAndSettle();
      final field = find.byType(TextField);
      await tester.enterText(field, ' 明月 ');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(tester.testTextInput.isVisible, isFalse);
      expect(find.text('明月'), findsOneWidget);
      await tester.tap(find.text('明月'));
      await tester.pumpAndSettle();
      expect(find.text('用户主页'), findsOneWidget);
      expect(find.text('重试读取公开资料'), findsOneWidget);
      await tester.tap(find.text('重试读取公开资料'));
      await tester.pumpAndSettle();
      expect(birthReads, 2);
      expect(find.text('测试公开出生地'), findsOneWidget);
      expect(tester.takeException(), isNull);

      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('找用户'), findsOneWidget);
      expect(tester.widget<TextField>(field).controller!.text, ' 明月 ');
      expect(find.text('正在核对搜索结果…'), findsOneWidget);
      expect(find.text('明月'), findsOneWidget);
      expect(
        tester.widget<ListTile>(find.widgetWithText(ListTile, '明月')).onTap,
        isNull,
      );
      rechecking.complete(_json({'items': []}));
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsNothing);
      expect(find.text('未找到该用户。'), findsOneWidget);

      await tester.enterText(field, '晚到的昵称');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('按 UID 搜索'));
      await tester.pumpAndSettle();
      await tester.enterText(field, '12345678');
      await tester.pump();
      await tester.tap(find.text('搜索'));
      await tester.pumpAndSettle();
      stale.complete(_json({'items': []}));
      await tester.pumpAndSettle();
      expect(find.text('明月'), findsOneWidget);
      expect(queries, [
        {'nickname': '明月'},
        {'nickname': '明月'},
        {'nickname': '晚到的昵称'},
        {'uid': '12345678'},
      ]);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text('消息'), findsOneWidget);
      expect(find.text('明月'), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      account.dispose();
    },
  );
}
