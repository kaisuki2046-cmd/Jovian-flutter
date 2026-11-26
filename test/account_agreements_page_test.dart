import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/auth/control/account_controller.dart';
import '../src/features/account/auth/requests/account_api.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/account/settings/requests/agreements_api.dart';
import '../src/features/account/settings/view/agreements_page.dart';
import '../src/shared/http/json_client.dart';

void main() {
  testWidgets(
    'lists the supporting drafts and confirms the current API versions',
    (tester) async {
      final writes = <Object?>[];
      final account = _fixture((request) {
        if (request.url.path == '/account/agreements/confirmation') {
          writes.add(jsonDecode(request.body));
          return _json(_state(accepted: true));
        }
        throw StateError('Unexpected request ${request.url}');
      });
      addTearDown(account.dispose);
      await account.initialize();
      await tester.pumpWidget(_app(account));
      await tester.pumpAndSettle();

      await _tap(tester, '《服务端用户协议》');
      expect(find.text('版本 v2'), findsOneWidget);
      expect(find.text('服务端当前正文'), findsOneWidget);
      expect(find.text('内测草案，未发布生效。'), findsNothing);
      await tester.pageBack();
      await tester.pumpAndSettle();

      for (final title in [
        '隐私政策摘要',
        '商城及付费服务协议',
        '在线服务协议',
        '账号管理规定',
        '平台管理规范',
        '实名认证服务协议',
        '账号注销与数据删除说明',
      ]) {
        await _tap(tester, '《$title》');
        expect(find.text(title), findsOneWidget);
        expect(find.text('内测草案，未发布生效。'), findsOneWidget);
        expect(
          find.text('暂无正文。'),
          title == '商城及付费服务协议' ? findsOneWidget : findsNothing,
        );
        if (title == '实名认证服务协议') {
          expect(find.textContaining('【待填：实际接入的实名用途】'), findsOneWidget);
        }
        await tester.pageBack();
        await tester.pumpAndSettle();
      }
      expect(writes, isEmpty);

      await tester.scrollUntilVisible(find.text('确认新版登录协议'), -180);
      await _tap(tester, '确认新版登录协议');
      await _tap(tester, '同意并继续');
      expect(writes, [
        {
          'agreements': [
            {'id': 'privacy', 'version': 'v2', 'hash': 'current-privacy'},
            {'id': 'terms', 'version': 'v2', 'hash': 'current-terms'},
          ],
          'source': 'sign-in',
        },
      ]);
      expect(find.text('已确认当前登录协议'), findsOneWidget);
    },
  );

  testWidgets(
    'historical receipts read their original versions and stay owner-scoped',
    (tester) async {
      var reads = 0;
      final account = _fixture((request) async {
        if (request.url.path == '/account/auth/logout')
          return http.Response('', 204);
        expect(request.url.path, '/account/agreements/terms/v1');
        reads++;
        if (reads == 1) return _json({}, 404);
        return _json(
          _document(
            'terms',
            '历史用户协议',
            version: 'v1',
            hash: 'stored-terms-v1',
            text: '历史版本正文',
          ),
        );
      });
      addTearDown(account.dispose);
      await account.initialize();
      await tester.pumpWidget(_app(account));
      await tester.pumpAndSettle();
      await _tap(tester, '协议确认记录');
      final recordedVersion = find.textContaining('版本 v1 ·');
      await tester.tap(recordedVersion);
      await tester.pumpAndSettle();
      expect(find.text('暂时无法打开此协议版本。'), findsOneWidget);
      await _tap(tester, '重试读取');
      expect(reads, 2);
      expect(find.text('历史用户协议'), findsOneWidget);
      expect(find.text('版本 v1'), findsOneWidget);
      expect(find.text('历史版本正文'), findsOneWidget);
      expect(find.text('服务端当前正文'), findsNothing);
      await account.signOut();
      await tester.pumpAndSettle();
      expect(find.text('历史版本正文'), findsNothing);
      expect(find.text('会话已变化，请返回后重新读取。'), findsOneWidget);
    },
  );
}

Future<void> _tap(WidgetTester tester, String label) async {
  final target = find.text(label);
  await tester.ensureVisible(target);
  await tester.pumpAndSettle();
  await tester.tap(target);
  await tester.pumpAndSettle();
}

Widget _app(AccountController account) =>
    MaterialApp(home: AccountAgreementsPage(account: account));

AccountController _fixture(
  FutureOr<http.Response> Function(http.Request) handle,
) {
  final client = AccountApi(
    JsonHttpClient(
      base: Uri.parse('https://account.example.test'),
      client: MockClient((request) async {
        return switch (request.url.path) {
          '/account/session' => _json({
            'user': {'id': 'member', 'displayName': '会员'},
          }),
          '/account/auth/capabilities' => _json({}),
          '/account/agreements' => _json(_state()),
          '/account/agreements/catalog' => _json({
            'documents': [
              _document('terms', '服务端用户协议'),
              _document('privacy', '隐私政策'),
              _document('ai', 'AI 服务与数据共享告知'),
            ],
          }),
          _ => await handle(request),
        };
      }),
    ),
  );
  return AccountController(client, AgreementsApi(client));
}

Map<String, Object?> _state({bool accepted = false}) => {
  'requiredAccepted': accepted,
  'permissions': {for (final purpose in aiPurposes.keys) purpose: false},
  'decisions': [
    {
      'agreementId': 'terms',
      'version': 'v1',
      'purpose': '',
      'agreed': true,
      'decidedAt': 1795564800000,
    },
    {
      'agreementId': 'ai',
      'version': 'v2',
      'purpose': aiPurposes.keys.first,
      'agreed': true,
      'decidedAt': 1795564800000,
    },
  ],
};

Map<String, Object?> _document(
  String id,
  String title, {
  String version = 'v2',
  String? hash,
  String text = '服务端当前正文',
}) => {
  'id': id,
  'version': version,
  'hash': hash ?? 'current-$id',
  'state': 'published',
  'title': title,
  'sections': [
    {'title': '说明', 'text': text},
  ],
};

http.Response _json(Object value, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(value)), status);
