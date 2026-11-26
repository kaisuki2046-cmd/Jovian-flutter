import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/auth/control/account_controller.dart';
import '../src/features/account/auth/requests/account_api.dart';
import '../src/features/account/history/control/report_history_controller.dart';
import '../src/features/account/history/model/report_history.dart';
import '../src/features/account/history/requests/report_history_api.dart';
import '../src/features/account/history/view/archived_charts_page.dart';
import '../src/features/account/history/view/reports_page.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/account/settings/requests/agreements_api.dart';
import '../src/shared/http/json_client.dart';
import '../src/ui/theme.dart';

void main() {
  test(
    'an owner mismatch clears report data and ignores an outstanding page',
    () async {
      final record = 'a' * 64;
      final pendingPage = Completer<http.Response>();
      final receivedPage = Completer<void>();
      var reloads = 0;
      final api = AccountApi(
        JsonHttpClient(
          base: Uri.parse('https://account.example.test'),
          client: MockClient((request) async {
            expect(request.url.queryParameters['expectedOwnerId'], 'old-owner');
            expect(request.url.queryParameters['kind'], 'fortune');
            final before = request.url.queryParameters['before'];
            if (before != null) {
              expect(before, record);
              receivedPage.complete();
              return pendingPage.future;
            }
            if (request.url.path.endsWith(record))
              return _json({'status': 403}, 403);
            if (request.url.path.endsWith('/latest')) return _json(null);
            return _json({
              'entries': [_entry(record)],
              'nextCursor': record,
            });
          }),
        ),
      );
      final requests = ReportHistoryApi(api);
      final controller = ReportHistoryController(
        requests,
        'old-owner',
        ReportKind.fortune,
        () async => reloads++,
      );
      addTearDown(() {
        controller.dispose();
        api.close();
      });
      final ready = Completer<void>();
      controller.addListener(() {
        if (!controller.loading && !ready.isCompleted) ready.complete();
      });
      await ready.future;
      expect(controller.page?.entries.single.id, record);
      expect(await requests.latest('old-owner', ReportKind.fortune), isNull);
      final oldResponse = controller.more();
      await receivedPage.future;
      await controller.select(record);
      expect(controller.locked, isTrue);
      expect(controller.page, isNull);
      expect(controller.report, isNull);
      expect(reloads, 1);
      pendingPage.complete(
        _json({
          'entries': [_entry('b' * 64)],
          'nextCursor': null,
        }),
      );
      await oldResponse;
      expect(controller.page, isNull);
      expect(controller.locked, isTrue);
    },
  );

  testWidgets(
    'the narrow report reader preserves pagination and hides data on identity change',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 640);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final first = 'a' * 64;
      final second = 'b' * 64;
      final requests = <String>[];
      var mode = 'member';
      final account = _account((request) {
        final path = request.url.path;
        if (path == '/account/session') {
          return mode == 'guest'
              ? _json({}, 401)
              : _member(nicknameRequired: mode == 'nickname');
        }
        if (path == '/account/auth/guest') {
          return _json({'id': 'guest-owner', 'expiresAt': 1795564800000});
        }
        final owner = request.url.queryParameters['expectedOwnerId'];
        final before = request.url.queryParameters['before'];
        expect(request.url.queryParameters['kind'], 'fortune');
        requests.add('$owner:${before ?? path.split('/').last}');
        if (owner == 'guest-owner') {
          return _json({'entries': [], 'nextCursor': null});
        }
        expect(owner, 'member-owner');
        if (path.endsWith(second)) {
          return _json({
            ..._entry(second, '第二份报告'),
            'report': {
              'version': 1,
              'kind': 'fortune',
              'sections': [
                {'title': '小结', 'body': '仅本人可见的报告内容'},
              ],
            },
          });
        }
        return _json({
          'entries': [
            if (before == null)
              _entry(first, '第一份报告')
            else
              _entry(second, '第二份报告'),
          ],
          'nextCursor': before == null ? first : null,
        });
      });
      addTearDown(account.dispose);
      await account.initialize();
      await tester.pumpWidget(
        MaterialApp(
          theme: jovianTheme(Brightness.dark),
          home: ReportsPage(account: account, initialKind: ReportKind.fortune),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('加载更多'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('第二份报告'));
      await tester.pumpAndSettle();
      final body = find.text('仅本人可见的报告内容');
      expect(find.text('报告详情'), findsOneWidget);
      expect(find.text('小结'), findsOneWidget);
      expect(body, findsOneWidget);
      expect(find.text('第一份报告'), findsNothing);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('第二份报告'), findsOneWidget);
      expect(requests, [
        'member-owner:reading-history',
        'member-owner:$first',
        'member-owner:$second',
      ]);

      await tester.tap(find.text('第二份报告'));
      await tester.pumpAndSettle();
      mode = 'nickname';
      await account.initialize();
      await tester.pumpAndSettle();
      expect(body, findsNothing);
      expect(find.text('会话已变化，请返回后重新读取。'), findsOneWidget);

      mode = 'guest';
      await account.initialize();
      await tester.pumpAndSettle();
      expect(body, findsNothing);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('暂无已保存的报告。'), findsOneWidget);
      expect(find.text('第二份报告'), findsNothing);
      expect(requests.last, 'guest-owner:reading-history');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'report filters preserve loaded pages and retry the same cursor',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 640);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final firstPage = [
        for (var index = 1; index <= 12; index++)
          _entry(index.toRadixString(16).padLeft(64, '0'), '运势报告 $index'),
      ];
      final older = 'd' * 64;
      final cursor = 'b' * 64;
      final fortunePages = <String?>[];
      var destinyPages = 0;
      final account = _account((request) {
        final path = request.url.path;
        if (path == '/account/session') return _member();
        if (path == '/account/destiny-history') {
          destinyPages++;
          return _json({'entries': [], 'nextCursor': null});
        }
        expect(request.url.queryParameters['kind'], 'fortune');
        if (path.endsWith('/$older')) {
          return _json({
            ..._entry(older, '较早的运势报告'),
            'report': {
              'version': 1,
              'kind': 'fortune',
              'sections': [
                {'title': '小结', 'body': '较早的归档内容'},
                {'title': '建议', 'body': '较早报告的建议'},
              ],
            },
          });
        }
        final before = request.url.queryParameters['before'];
        fortunePages.add(before);
        if (before == null) {
          return _json({'entries': firstPage, 'nextCursor': cursor});
        }
        expect(before, cursor);
        if (fortunePages.length == 2) return _json({}, 503);
        return _json({
          'entries': [_entry(older, '较早的运势报告')],
          'nextCursor': null,
        });
      });
      addTearDown(account.dispose);
      await account.initialize();
      await tester.pumpWidget(
        MaterialApp(
          theme: jovianTheme(Brightness.dark),
          home: ReportsPage(account: account, initialKind: ReportKind.fortune),
        ),
      );
      await tester.pumpAndSettle();
      expect(destinyPages, 0);
      await tester.scrollUntilVisible(find.text('加载更多'), 250);
      await tester.tap(find.text('加载更多'));
      await tester.pumpAndSettle();
      expect(find.text('运势报告 12').hitTestable(), findsOneWidget);
      expect(find.text('重试').hitTestable(), findsOneWidget);
      await tester.tap(find.text('重试'));
      await tester.pumpAndSettle();
      expect(fortunePages, [null, cursor, cursor]);
      expect(find.text('较早的运势报告').hitTestable(), findsOneWidget);

      final position = tester
          .state<ScrollableState>(find.byType(Scrollable))
          .position
          .pixels;
      expect(position, greaterThan(0));
      await tester.tap(find.text('命理'));
      await tester.pumpAndSettle();
      expect(find.text('暂无已保存的报告。').hitTestable(), findsOneWidget);
      expect(find.text('较早的运势报告').hitTestable(), findsNothing);
      expect(destinyPages, 1);
      await tester.tap(find.text('运势'));
      await tester.pumpAndSettle();
      expect(
        tester.state<ScrollableState>(find.byType(Scrollable)).position.pixels,
        position,
      );
      expect(fortunePages, [null, cursor, cursor]);
      await tester.tap(find.text('较早的运势报告'));
      await tester.pumpAndSettle();
      expect(find.text('小结'), findsOneWidget);
      expect(find.text('较早的归档内容'), findsOneWidget);
      expect(find.text('建议'), findsOneWidget);
      expect(find.text('较早报告的建议'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'an inactive report request can hide every cached category and the open reader',
    (tester) async {
      final fortune = 'e' * 64;
      final destiny = 'f' * 64;
      final pendingPage = Completer<http.Response>();
      final pendingRestore = Completer<http.Response>();
      var sessionReads = 0;
      var pageRequested = false;
      final account = _account((request) {
        final path = request.url.path;
        if (path == '/account/session') {
          return ++sessionReads == 1 ? _member() : pendingRestore.future;
        }
        if (path == '/account/destiny-history') {
          return _json({
            'entries': [_entry(destiny, '原账号命理报告')],
            'nextCursor': null,
          });
        }
        if (path.endsWith('/$destiny')) {
          return _json({
            ..._entry(destiny, '原账号命理报告'),
            'report': {'version': 1, 'overview': '原账号的命理解读内容'},
          });
        }
        if (request.url.queryParameters['before'] == fortune) {
          pageRequested = true;
          return pendingPage.future;
        }
        expect(request.url.queryParameters['kind'], 'fortune');
        return _json({
          'entries': [_entry(fortune, '原账号运势报告')],
          'nextCursor': fortune,
        });
      });
      addTearDown(account.dispose);
      await account.initialize();
      await tester.pumpWidget(
        MaterialApp(
          theme: jovianTheme(Brightness.dark),
          home: ReportsPage(account: account, initialKind: ReportKind.fortune),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('加载更多'));
      await tester.pump();
      expect(pageRequested, isTrue);
      await tester.tap(find.text('命理'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('原账号命理报告'));
      await tester.pumpAndSettle();
      expect(find.text('原账号的命理解读内容'), findsOneWidget);

      pendingPage.complete(_json({}, 403));
      await tester.pump();
      await tester.pump();
      expect(sessionReads, 2);
      expect(find.text('原账号的命理解读内容'), findsNothing);
      expect(find.text('会话已变化，请返回后重新读取。'), findsOneWidget);

      pendingRestore.complete(_member());
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.text('会话已变化，重新读取').hitTestable(), findsOneWidget);
      await tester.tap(find.text('运势'));
      await tester.pumpAndSettle();
      expect(find.text('原账号运势报告'), findsNothing);
      expect(find.text('会话已变化，重新读取').hitTestable(), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('archived four pillars wrap and keep their saved details', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 640);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    var reads = 0;
    final account = _account((request) {
      if (request.url.path == '/account/session') return _member();
      expect(request.url.path, '/account/destiny-history/latest');
      expect(request.url.queryParameters['expectedOwnerId'], 'member-owner');
      if (++reads == 1) return _json({}, 503);
      return _json({
        ..._entry('c' * 64),
        'report': {
          'version': 1,
          'timeKnown': false,
          'charts': [
            {
              'method': 'bazi',
              'rows': [
                {'label': '年柱', 'value': '甲子\n天干十神 比肩'},
                {'label': '月柱', 'value': '乙丑'},
                {'label': '日柱', 'value': '丙寅'},
                {'label': '时柱', 'value': '未知'},
              ],
            },
            {'method': 'ziwei', 'rows': [], 'note': '需要确定出生时刻。'},
            {
              'method': 'western',
              'rows': [
                {'label': '太阳', 'value': '摩羯座'},
              ],
            },
          ],
        },
      });
    });
    addTearDown(account.dispose);
    await account.initialize();
    await tester.pumpWidget(
      MaterialApp(
        theme: jovianTheme(Brightness.dark),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(1.4)),
          child: child!,
        ),
        home: ArchivedChartsPage(account: account),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('暂时无法读取命盘，点击重试'));
    await tester.pumpAndSettle();
    expect(reads, 2);
    expect(find.text('三套盘面'), findsOneWidget);
    expect(find.text('查看命盘'), findsNothing);
    expect(find.textContaining('出生时刻未完全确定'), findsOneWidget);
    final first = tester.getTopLeft(find.text('甲子'));
    final second = tester.getTopLeft(find.text('乙丑'));
    final third = tester.getTopLeft(find.text('丙寅'));
    expect(first.dy, second.dy);
    expect(first.dx, third.dx);
    expect(third.dy, greaterThan(first.dy));
    expect(find.text('天干十神 比肩'), findsOneWidget);
    await tester.tap(find.text('紫微斗数'));
    await tester.pumpAndSettle();
    expect(find.text('需要确定出生时刻。'), findsOneWidget);
    expect(find.text('甲子'), findsNothing);
    await tester.tap(find.text('西方星盘'));
    await tester.pumpAndSettle();
    expect(find.text('摩羯座'), findsOneWidget);
    await tester.tap(find.text('刷新盘面'));
    await tester.pumpAndSettle();
    expect(reads, 3);
    expect(find.text('摩羯座'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

AccountController _account(
  FutureOr<http.Response> Function(http.Request) onRequest,
) {
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.parse('https://account.example.test'),
      client: MockClient((request) async {
        return switch (request.url.path) {
          '/account/auth/capabilities' => _json({}),
          '/account/agreements/catalog' => _json({
            'documents': [
              for (final id in ['privacy', 'terms', 'ai'])
                {
                  'id': id,
                  'title': id,
                  'version': 'v1',
                  'hash': 'hash',
                  'state': 'preview',
                  'sections': [],
                },
            ],
          }),
          '/account/agreements' => _json({
            'requiredAccepted': true,
            'permissions': {
              for (final purpose in aiPurposes.keys) purpose: false,
            },
          }),
          _ => onRequest(request),
        };
      }),
    ),
  );
  return AccountController(api, AgreementsApi(api));
}

http.Response _member({bool nicknameRequired = false}) => _json({
  'user': {
    'id': 'member-owner',
    'displayName': '会员',
    'nicknameRequired': nicknameRequired,
  },
});

Map<String, Object?> _entry(String id, [String title = '归档报告']) => {
  'id': id,
  'title': title,
  'calculatedAt': '2026-11-25T00:00:00.000Z',
  'savedAt': 1795564800000,
  'kind': 'fortune',
};

http.Response _json(Object? value, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(value)), status);
