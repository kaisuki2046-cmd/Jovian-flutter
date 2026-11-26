import 'dart:async';
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
import '../src/ui/interface_language.dart';
import 'support/fortune_local_fixture.dart';

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
  final languages = ValueVariant<InterfaceLanguage>(
    InterfaceLanguage.values.toSet(),
  );
  testWidgets(
    'opens the exact saved fortune with its original date and advice run',
    variant: languages,
    (tester) async {
      final language = languages.currentValue!;
      FlutterSecureStorage.setMockInitialValues({
        'fixture-fortune-session': 'fixture',
      });
      tester.view.physicalSize = const Size(320, 1030);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final day = _entry(_dayId, '旧日运势');
      final week = _entry(_weekId, '已保存周运势');
      final detailRequests = <String>[];
      final listRequests = <String?>[];
      final onlineRequests = <String>[];
      final adviceRefresh = Completer<http.Response>();
      final api = AccountApi(
        JsonHttpClient(
          base: Uri.parse('https://account.example.test'),
          client: MockClient((request) async {
            final path = request.url.path;
            if (path.startsWith('/account/reading-history')) {
              expect(request.url.queryParameters['expectedOwnerId'], _owner);
              expect(request.url.queryParameters['kind'], 'fortune');
              if (path.endsWith('/reading-history')) {
                final before = request.url.queryParameters['before'];
                listRequests.add(before);
                return _json(
                  before == null
                      ? {
                          'entries': [week],
                          'nextCursor': _weekId,
                        }
                      : {
                          'entries': [day],
                        },
                );
              }
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
            if (onlineRequests.length == 2) return adviceRefresh.future;
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
                      'limitations': ['原盘适用限制。'],
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
          locale: language.locale,
          supportedLocales: [
            for (final item in InterfaceLanguage.values) item.locale,
          ],
          localizationsDelegates: const [
            interfaceStringsDelegate,
            ...GlobalMaterialLocalizations.delegates,
          ],
          home: FortunePage(
            account: account,
            local: const FortuneLocalFixture(),
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
      expect(listRequests, isEmpty);
      expect(find.text('已保存周运势'), findsNothing);
      await tester.tap(find.text(language.label('查看已存解读')));
      await tester.pumpAndSettle();
      expect(find.text(language.label('周期运势')), findsOneWidget);
      expect(find.text(language.label('收起已存解读')), findsOneWidget);
      expect(listRequests, [null]);
      await tester.tap(find.text('已保存周运势'));
      await tester.pumpAndSettle();
      expect(
        find.text(
          language == InterfaceLanguage.english ? 'Forecast reading' : '运势解读',
        ),
        findsOneWidget,
      );
      expect(find.text('已保存本周正文。'), findsOneWidget);
      expect(
        find.text(
          language == InterfaceLanguage.english
              ? 'Nov 9, 2026 to Nov 15, 2026 · Asia/Shanghai'
              : '2026年11月9日 至 2026年11月15日 · Asia/Shanghai',
        ),
        findsOneWidget,
      );
      expect(find.text(language.label('提运建议')), findsNothing);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text(language.label('收起已存解读')), findsOneWidget);
      await tester.tap(find.text(language.label('收起已存解读')));
      await tester.pumpAndSettle();
      expect(find.text('已保存周运势'), findsNothing);
      await tester.tap(find.text(language.label('查看已存解读')));
      await tester.pumpAndSettle();
      expect(find.text('已保存周运势'), findsOneWidget);
      expect(listRequests, [null]);
      await tester.tap(find.text(language.label('加载更多')));
      await tester.pumpAndSettle();
      expect(listRequests, [null, _weekId]);
      await tester.tap(find.text('旧日运势'));
      await tester.pumpAndSettle();
      expect(find.text('已保存的旧日正文。'), findsOneWidget);
      expect(
        find.text(
          language == InterfaceLanguage.english
              ? 'Nov 10, 2026 · Asia/Shanghai'
              : '2026年11月10日 · Asia/Shanghai',
        ),
        findsOneWidget,
      );
      expect(onlineRequests, isEmpty);
      await tester.tap(find.text(language.label('按盘面获取建议')));
      await tester.pumpAndSettle();
      expect(find.text('3'), findsOneWidget);
      await tester.tap(find.text(language.label('查看建议依据')));
      await tester.pumpAndSettle();
      final reason = find.text('原盘建议依据。');
      final source = find.text(language.label('来源：') + '资料校验测试');
      final limitation = find.text('原盘适用限制。');
      expect(reason, findsOneWidget);
      expect(source, findsOneWidget);
      expect(limitation, findsOneWidget);
      await tester.ensureVisible(find.text(language.label('收起依据')));
      await tester.tap(find.text(language.label('收起依据')));
      await tester.pumpAndSettle();
      expect(reason, findsNothing);
      expect(source, findsNothing);
      expect(limitation, findsNothing);
      await tester.tap(find.text(language.label('查看建议依据')));
      await tester.pumpAndSettle();
      expect(reason, findsOneWidget);
      await tester.ensureVisible(find.text(language.label('按盘面获取建议')));
      await tester.tap(find.text(language.label('按盘面获取建议')));
      await tester.pump();
      expect(reason, findsNothing);
      expect(source, findsNothing);
      expect(limitation, findsNothing);
      adviceRefresh.complete(http.Response('', 500));
      await tester.pumpAndSettle();
      expect(find.text(language.label('重试获取建议')), findsOneWidget);
      expect(reason, findsNothing);
      await tester.tap(find.text(language.label('重试获取建议')));
      await tester.pumpAndSettle();
      expect(reason, findsOneWidget);
      expect(source, findsOneWidget);
      expect(limitation, findsOneWidget);
      expect(detailRequests, [_weekId, _dayId]);
      expect(onlineRequests, List.filled(3, '/fortune/advice/$_run'));
      await account.signOut();
      await tester.pumpAndSettle();
      expect(find.text('已保存的旧日正文。'), findsNothing);
      expect(find.text(language.label('当前账号会话已变化，请返回周期运势。')), findsOneWidget);
      await tester.tap(find.byType(BackButton));
      await tester.pumpAndSettle();
      expect(find.text(language.label('周期运势')), findsOneWidget);
      expect(find.text(language.label('查看已存解读')), findsNothing);
      expect(tester.takeException(), isNull);
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
            local: FortuneLocalFixture(),
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

  testWidgets('English calendar works at 320 dp and 200 percent text', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(320, 700);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    const reference = FortuneReference('2026-11-10', '23:40');
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: const [
          interfaceStringsDelegate,
          ...GlobalMaterialLocalizations.delegates,
        ],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(2)),
          child: child!,
        ),
        home: const FortuneCalendarPage(
          reference: reference,
          local: FortuneLocalFixture(),
        ),
      ),
    );
    final date = find.widgetWithText(TextField, 'Beijing date');
    final time = find.widgetWithText(TextField, 'Beijing time');
    expect(date, findsOneWidget);
    expect(time, findsOneWidget);
    await tester.tap(find.byTooltip('Select a Beijing date'));
    await tester.pumpAndSettle();
    expect(find.text('Select a Beijing date'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Select a Beijing time'));
    await tester.pumpAndSettle();
    expect(find.text('Select a Beijing time'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(tester.widget<TextField>(time).controller?.text, '23:40');
    final search = find.text('Look up the calendar');
    await tester.enterText(date, '2026-02-30');
    await tester.ensureVisible(search);
    await tester.pumpAndSettle();
    await tester.tap(search);
    await tester.pumpAndSettle();
    expect(
      find.textContaining('Enter a valid date from 1900 to 2099'),
      findsOneWidget,
    );
    await tester.enterText(date, '2026-11-10');
    await tester.ensureVisible(search);
    await tester.pumpAndSettle();
    await tester.tap(search);
    await tester.pumpAndSettle();
    final pillars = calculateFortuneCalendar(reference)!.actionPillars;
    expect(
      find.textContaining(
        "Day pillar ${pillars['day']} · Hour pillar ${pillars['hour']}",
      ),
      findsOneWidget,
    );
    expect(find.text('Four Pillars at the next hour'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Next full hour'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('Lookup start 2026-11-11 00:00'), findsOneWidget);
    expect(find.text('End time 2026-11-11 01:00'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('editing the query discards its pending calendar result', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(420, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    final calendar = _DelayedCalendar();
    await tester.pumpWidget(
      MaterialApp(
        home: FortuneCalendarPage(
          reference: const FortuneReference('2026-11-10', '23:40'),
          local: calendar,
        ),
      ),
    );
    await tester.tap(find.text('查询历法'));
    await tester.pump();
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextField, '北京日期'),
      '2026-11-12',
    );
    await tester.pump();
    expect(calendar.cancelled, isTrue);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    calendar.first.completeError(StateError('Superseded query failed.'));
    await tester.pumpAndSettle();
    expect(find.text('历法查询暂不可用，请重试。'), findsNothing);
    await tester.tap(find.text('查询历法'));
    await tester.pumpAndSettle();
    expect(find.text('查询起点 2026-11-13 00:00'), findsOneWidget);
  });
}

class _DelayedCalendar extends FortuneLocalFixture {
  final first = Completer<FortuneCalendar?>();
  bool cancelled = false;
  bool _started = false;

  @override
  Future<FortuneCalendar?> queryCalendar(
    FortuneReference reference,
    Future<void> cancel,
  ) {
    if (_started) return super.queryCalendar(reference, cancel);
    _started = true;
    unawaited(cancel.then<void>((_) => cancelled = true));
    return first.future;
  }
}
