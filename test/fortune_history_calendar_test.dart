import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/fortune/control/fortune_online.dart';
import '../src/features/fortune/requests/fortune_report_api.dart';
import '../src/features/fortune/view/fortune_calendar_page.dart';
import '../src/features/fortune/view/fortune_page.dart';
import '../src/shared/http/json_client.dart';

const _owner = 'fortune-history-member';
final _dayId = 'a' * 64;
final _weekId = 'b' * 64;
final _snapshot = 'c' * 64;
final _run = 'd' * 64;

http.Response _json(Object? body) =>
    http.Response.bytes(utf8.encode(jsonEncode(body)), 200);

Map<String, Object?> _entry(String id, String title) => {
  'id': id,
  'title': title,
  'kind': 'fortune',
  'calculatedAt': '2026-11-11T12:00:00.000Z',
  'savedAt': 1794398400000,
};

void main() {
  testWidgets(
    'opens the exact saved fortune with its original date and advice run',
    (tester) async {
      FlutterSecureStorage.setMockInitialValues({
        'fixture-fortune-session': 'fixture',
      });
      tester.view.physicalSize = const Size(390, 1030);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final day = _entry(_dayId, '旧日运势');
      final week = _entry(_weekId, '已保存周运势');
      final detailRequests = <String>[];
      final onlineRequests = <String>[];
      final api = AccountApi(
        JsonHttpClient(
          base: Uri.parse('https://account.example.test'),
          client: MockClient((request) async {
            final path = request.url.path;
            if (path.startsWith('/account/reading-history')) {
              expect(request.url.queryParameters['expectedOwnerId'], _owner);
              expect(request.url.queryParameters['kind'], 'fortune');
              if (path.endsWith('/reading-history'))
                return _json({
                  'entries': [week, day],
                });
              final id = request.url.pathSegments.last;
              expect(id, anyOf(_dayId, _weekId));
              detailRequests.add(id);
              final daily = id == _dayId;
              return _json({
                ...(daily ? day : week),
                'report': {
                  'version': 1,
                  'kind': 'fortune',
                  'context': {
                    'snapshotId': _snapshot,
                    'calculationRunId': _run,
                    'periodType': daily ? 'day' : 'week',
                    'displayTimezone': 'Asia/Shanghai',
                    'windowStart': DateTime.utc(
                      2026,
                      11,
                      daily ? 9 : 8,
                      16,
                    ).millisecondsSinceEpoch,
                    'windowEnd': DateTime.utc(
                      2026,
                      11,
                      daily ? 10 : 15,
                      16,
                    ).millisecondsSinceEpoch,
                  },
                  'sections': [
                    {'title': '综合运势', 'body': daily ? '已保存的旧日正文。' : '已保存本周正文。'},
                  ],
                },
              });
            }
            return switch (path) {
              '/account/session' => _json({
                'user': {'id': _owner, 'displayName': '测试会员'},
              }),
              '/account/auth/capabilities' => _json({}),
              '/account/agreements/catalog' => _json({
                'documents': [
                  for (final id in ['terms', 'privacy', 'ai'])
                    {
                      'id': id,
                      'title': id,
                      'version': 'v1',
                      'hash': id,
                      'state': 'published',
                      'sections': [],
                    },
                ],
              }),
              '/account/agreements' => _json({
                'requiredAccepted': true,
                'permissions': {
                  for (final purpose in aiPurposes.keys) purpose: true,
                },
              }),
              '/account/destiny-history/latest' => _json(null),
              '/account/auth/logout' => http.Response('', 204),
              _ => fail('Unexpected account request $path'),
            };
          }),
        ),
        nativeSession: const SecureNativeSession('fixture-fortune-session'),
      );
      final account = AccountController(api, AgreementsApi(api));
      addTearDown(account.dispose);
      await account.initialize();
      final online = FortuneReportApi(
        JsonHttpClient(
          base: Uri.parse('https://fortune.example.test'),
          client: MockClient((request) async {
            onlineRequests.add(request.url.path);
            expect(request.method, 'GET');
            expect(request.url.path, '/fortune/advice/$_run');
            expect(request.url.queryParameters['expectedOwnerId'], _owner);
            expect(request.headers['authorization'], 'Bearer fixture');
            return _json({
              'version': 1,
              'calculationRunId': _run,
              'snapshotId': _snapshot,
              'groups': [
                {
                  'kind': '数字',
                  'items': [
                    {
                      'method': 'bazi',
                      'theme': '木',
                      'options': ['3'],
                      'reason': '原盘建议依据。',
                      'source': '资料校验测试',
                      'limitations': [],
                    },
                  ],
                },
                {'kind': '饰品', 'items': []},
                {'kind': '颜色', 'items': []},
              ],
            });
          }),
        ),
        readNativeSession: account.readNativeSession,
      );
      Future<DateTime> now() async => DateTime.utc(2026, 11, 12, 2);
      await tester.pumpWidget(
        MaterialApp(
          home: FortunePage(
            account: account,
            readServerTime: now,
            loadDisplay: () async => (
              zone: 'Asia/Shanghai',
              clock: (int ms) => ms + const Duration(hours: 8).inMilliseconds,
            ),
            connectOnline: () => FortuneOnline(online, now),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.tap(find.text('运势报告历史'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('已保存周运势'));
      await tester.pumpAndSettle();
      expect(find.text('已保存本周正文。'), findsOneWidget);
      expect(
        find.text('2026年11月9日 至 2026年11月15日 · Asia/Shanghai'),
        findsOneWidget,
      );
      expect(find.text('提运建议'), findsNothing);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      await tester.tap(find.text('旧日运势'));
      await tester.pumpAndSettle();
      expect(find.text('已保存的旧日正文。'), findsOneWidget);
      expect(find.text('2026年11月10日 · Asia/Shanghai'), findsOneWidget);
      expect(onlineRequests, isEmpty);
      await tester.tap(find.text('按盘面获取建议'));
      await tester.pumpAndSettle();
      expect(find.text('3'), findsOneWidget);
      await tester.tap(find.text('查看建议依据'));
      await tester.pumpAndSettle();
      expect(find.text('原盘建议依据。'), findsOneWidget);
      expect(detailRequests, [_weekId, _dayId]);
      expect(onlineRequests, ['/fortune/advice/$_run']);
      await account.signOut();
      await tester.pumpAndSettle();
      expect(find.text('已保存的旧日正文。'), findsNothing);
      expect(find.text('当前账号会话已变化，请返回周期运势。'), findsOneWidget);
    },
  );

  testWidgets(
    'calendar validates manual entry and queries Beijing date and time',
    (tester) async {
      tester.view.physicalSize = const Size(420, 1400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(
        const MaterialApp(
          home: FortuneCalendarPage(
            reference: FortuneReference('2026-11-10', '23:40'),
          ),
        ),
      );
      final date = find.widgetWithText(TextField, '北京日期');
      final time = find.widgetWithText(TextField, '北京时间');
      await tester.enterText(date, '2026-02-30');
      await tester.tap(find.text('查询历法'));
      await tester.pumpAndSettle();
      expect(find.textContaining('1900 至 2099'), findsOneWidget);
      await tester.tap(find.byTooltip('选择北京日期'));
      await tester.pumpAndSettle();
      expect(find.byType(DatePickerDialog), findsOneWidget);
      await tester.tap(find.text('取消'));
      await tester.pumpAndSettle();
      await tester.enterText(date, '2026-11-10');
      await tester.tap(find.byTooltip('选择北京时间'));
      await tester.pumpAndSettle();
      expect(
        MediaQuery.of(
          tester.element(find.byType(TimePickerDialog)),
        ).alwaysUse24HourFormat,
        isTrue,
      );
      await tester.tap(find.text('确定'));
      await tester.pumpAndSettle();
      expect(tester.widget<TextField>(time).controller?.text, '23:40');
      await tester.tap(time);
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(find.text('下一整点四柱'), findsOneWidget);
      expect(find.text('周一为每周起点，窗口结束时刻不计入。'), findsOneWidget);
      expect(find.text('查询起点 2026-11-11 00:00'), findsOneWidget);
      expect(find.text('截止时刻 2026-11-11 01:00'), findsOneWidget);
    },
  );
}
