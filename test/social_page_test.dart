import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/account/auth/model/session.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/social/social.dart';
import '../src/shared/http/json_client.dart';

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
  Future<http.Response> Function(http.Request) social,
) {
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.parse('https://account.example.test'),
      client: MockClient((request) async {
        if (request.url.path.startsWith('/social/')) {
          expect(request.headers['x-app-client'], 'native');
          expect(request.headers['authorization'], 'Bearer fixture-token');
          return social(request);
        }
        switch (request.url.path) {
          case '/account/session':
            return _json({
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
    expect(find.text('UID 12345678 · 长按复制'), findsOneWidget);
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
    'preserves UID and nickname search semantics and hides data on logout',
    (tester) async {
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
      await tester.tap(find.byTooltip('找用户'));
      await tester.pumpAndSettle();
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
}
