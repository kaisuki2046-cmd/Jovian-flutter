import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/fortune/control/fortune_local.dart';
import '../src/features/fortune/control/fortune_online.dart';
import '../src/features/fortune/model/online_fortune.dart';
import '../src/features/fortune/requests/fortune_report_api.dart';
import '../src/features/fortune/view/fortune_page.dart';
import '../src/shared/http/json_client.dart';
import '../src/ui/interface_language.dart';
import 'support/fortune_local_fixture.dart';

const _owner = 'active-member';
final _snapshotId = 'a' * 64;
final _reportId = 'b' * 64;
final _runId = 'c' * 64;
final _today = DateTime.utc(2026, 11, 11, 12);
final _returnAt = DateTime.utc(2026, 3, 10, 18, 25).millisecondsSinceEpoch;

void main() {
  testWidgets('large English period labels wrap and can select a forecast', (
    tester,
  ) async {
    _viewport(tester, const Size(320, 700));
    await tester.pumpWidget(
      MaterialApp(
        localizationsDelegates: const [interfaceStringsDelegate],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.linear(2)),
          child: child!,
        ),
        home: FortunePage(
          loadDisplay: _utc,
          local: const FortuneLocalFixture(),
          readServerTime: () async => _today,
        ),
      ),
    );
    await tester.pumpAndSettle();

    final current = find.widgetWithText(ChoiceChip, 'Today');
    final year = find.widgetWithText(ChoiceChip, 'This year');
    expect(find.byType(ChoiceChip), findsNWidgets(4));
    expect(
      tester.getTopLeft(year).dy,
      greaterThan(tester.getTopLeft(current).dy),
    );
    expect(tester.widget<ChoiceChip>(current).selected, isTrue);
    await _tap(tester, 'This year');
    expect(tester.widget<ChoiceChip>(year).selected, isTrue);
    expect(find.text('2026年1月1日 至 2026年12月31日'), findsOneWidget);

    await tester.tap(find.byTooltip('Calendar lookup'));
    await tester.pumpAndSettle();
    expect(find.text('Calendar lookup'), findsOneWidget);
  });

  testWidgets('offline chart retains preview and explains missing service', (
    tester,
  ) async {
    _viewport(tester, const Size(390, 760));
    final account = _accountWithChart();
    addTearDown(account.dispose);
    await account.initialize();
    await tester.pumpWidget(
      MaterialApp(
        home: FortunePage(
          loadDisplay: _utc,
          local: const FortuneLocalFixture(),
          readServerTime: () async => _today,
          account: account,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('解读服务暂未配置。'), findsOneWidget);
    expect(find.text('参考干支'), findsOneWidget);
    expect(find.text('运势报告历史'), findsOneWidget);
    expect(find.widgetWithText(OutlinedButton, '解读'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('date refresh disables actions until the new preview succeeds', (
    tester,
  ) async {
    _viewport(tester, const Size(390, 760));
    final account = _accountWithChart();
    addTearDown(account.dispose);
    await account.initialize();
    final nextTime = Completer<DateTime>();
    final local = _RefreshPreview();
    var updatedDay = false;
    final service = _SolarReturnService(
      FortuneReportApi(
        JsonHttpClient(
          base: Uri.https('fortune.example.test'),
          client: MockClient((request) async {
            expect(request.method, 'GET');
            return http.Response('', 204);
          }),
        ),
      ),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: FortunePage(
          loadDisplay: _utc,
          local: local,
          readServerTime: () =>
              updatedDay ? nextTime.future : Future.value(_today),
          account: account,
          connectOnline: () => service,
        ),
      ),
    );
    await tester.pumpAndSettle();
    final interpret = find.widgetWithText(OutlinedButton, '解读');
    final advice = find.widgetWithText(OutlinedButton, '按盘面获取建议');
    bool enabled(Finder button) =>
        tester.widget<OutlinedButton>(button).onPressed != null;
    expect(enabled(interpret), isTrue);
    expect(enabled(advice), isTrue);

    local.fail = true;
    updatedDay = true;
    await tester.tap(find.text('刷新日期'));
    await tester.pump();
    expect(enabled(interpret), isFalse);
    expect(enabled(advice), isFalse);

    nextTime.complete(_today.add(const Duration(days: 1)));
    await tester.pumpAndSettle();
    expect(find.text('暂时无法计算当前运势日期，请重试。'), findsOneWidget);
    expect(enabled(interpret), isFalse);
    expect(enabled(advice), isFalse);

    local.fail = false;
    await _tap(tester, '刷新日期');
    expect(enabled(interpret), isTrue);
    expect(enabled(advice), isTrue);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'can enter southern and western coordinates and retry without them',
    (tester) async {
      _viewport(tester, const Size(320, 700));
      final requests = <String>[];
      final account = _account((request) {
        if (request.url.path.endsWith('/destiny-history/latest'))
          return _json(_chart());
        if (request.url.path.endsWith('/reading-history/latest'))
          return http.Response('', 204);
        if (request.url.path == '/account/reading-history' &&
            request.method == 'POST')
          return _json({..._entry(_reportId, '运势报告'), 'kind': 'fortune'});
        throw StateError('Unexpected account request ${request.url.path}');
      });
      addTearDown(account.dispose);
      await account.initialize();
      final service = _SolarReturnService(
        FortuneReportApi(
          JsonHttpClient(
            base: Uri.https('fortune.example.test'),
            client: MockClient((request) async {
              requests.add('${request.method} ${request.url.path}');
              if (request.method == 'GET') return http.Response('', 204);
              expect(request.url.path, '/fortune/interpret');
              expect(jsonDecode(request.body), {
                'calculationRunId': _runId,
                'expectedOwnerId': _owner,
                'language': 'zh-CN',
              });
              return _json({
                'reportId': _reportId,
                'calculationRunId': _runId,
                'natalChartSnapshotId': _snapshotId,
                'periodType': 'year',
                'sections': [
                  for (final section in ['overall', 'wealth', 'romance'])
                    {'sectionId': section, 'summary': '常规解读 $section'},
                ],
              });
            }),
          ),
        ),
      );
      await tester.pumpWidget(
        MaterialApp(
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(
              context,
            ).copyWith(textScaler: TextScaler.linear(1.25)),
            child: child!,
          ),
          home: FortunePage(
            loadDisplay: _utc,
            local: const FortuneLocalFixture(),
            readServerTime: () async => _today,
            account: account,
            connectOnline: () => service,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await _tap(tester, '本年');
      await _tap(tester, '设置太阳回归地点');
      expect(find.textContaining('2026年3月10日 18:25'), findsOneWidget);
      final latitude = find.widgetWithText(TextField, '纬度');
      final longitude = find.widgetWithText(TextField, '经度');
      expect(
        tester.getTopLeft(longitude).dy,
        greaterThan(tester.getTopLeft(latitude).dy),
      );
      await tester.enterText(latitude, '33.90');
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<OutlinedButton>(find.widgetWithText(OutlinedButton, '解读'))
            .onPressed,
        isNull,
      );
      await tester.enterText(longitude, '118.40');
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('切换为南纬'));
      await tester.pumpAndSettle();
      await tester.tap(find.byTooltip('切换为西经'));
      await tester.pumpAndSettle();
      expect(tester.widget<TextField>(latitude).controller?.text, '-33.90');
      expect(tester.widget<TextField>(longitude).controller?.text, '-118.40');
      await _tap(tester, '解读');
      expect(find.textContaining('无法确定可靠的回归上升'), findsOneWidget);
      expect(requests.where((request) => request.startsWith('POST')), isEmpty);
      await _tap(tester, '清空地点，生成常规解读');
      expect(find.text('常规解读 overall'), findsOneWidget);
      expect(find.text('已存档，可随时回看'), findsOneWidget);
      expect(latitude, findsNothing);
      expect(service.locations, [
        {'returnAt': _returnAt, 'latitude': -33.9, 'longitude': -118.4},
        null,
      ]);
      expect(requests.where((request) => request.startsWith('POST')), [
        'POST /fortune/interpret',
      ]);
      expect(tester.takeException(), isNull);
    },
  );

  for (final status in [403, 404]) {
    testWidgets(
      'unavailable selected archive $status returns to Destiny with the session intact',
      (tester) async {
        _viewport(tester, const Size(390, 760));
        var rechecks = 0;
        final archiveRequests = <Uri>[];
        final account = _account((request) {
          final path = request.url.path;
          if (path.endsWith('/destiny-history/$_snapshotId')) {
            archiveRequests.add(request.url);
            return _json({'error': 'unavailable'}, status);
          }
          throw StateError('Unexpected account request $path');
        }, onRestore: () => rechecks++);
        addTearDown(account.dispose);
        await account.initialize();
        await tester.pumpWidget(
          MaterialApp(
            home: Builder(
              builder: (context) => Scaffold(
                appBar: AppBar(title: const Text('命理')),
                body: TextButton(
                  onPressed: () => Navigator.of(context).push(
                    MaterialPageRoute<void>(
                      builder: (_) => FortunePage(
                        loadDisplay: _utc,
                        local: const FortuneLocalFixture(),
                        readServerTime: () async => _today,
                        account: account,
                        archiveId: _snapshotId,
                      ),
                    ),
                  ),
                  child: const Text('查看此盘的周期运势'),
                ),
              ),
            ),
          ),
        );
        await _tap(tester, '查看此盘的周期运势');
        expect(find.textContaining('这张命盘不可用'), findsOneWidget);
        expect(find.textContaining('会话已失效'), findsNothing);
        expect(find.text('重新读取'), findsNothing);
        expect(account.authorizedSession?.id, _owner);
        expect(rechecks, 1);
        expect(
          archiveRequests.single.queryParameters['expectedOwnerId'],
          _owner,
        );
        await _tap(tester, '返回命理');
        expect(find.text('命理'), findsOneWidget);
        expect(find.text('周期运势'), findsNothing);
        expect(tester.takeException(), isNull);
      },
    );
  }
}

class _RefreshPreview extends FortuneLocalFixture {
  bool fail = false;

  @override
  Future<LocalFortunePreview> preview(
    int asOf,
    FortunePeriod period,
    String zone,
    ArchivedDestinyCharts? archive,
    Future<void> cancel,
  ) async {
    if (fail) throw StateError('Preview unavailable.');
    return super.preview(asOf, period, zone, archive, cancel);
  }
}

class _SolarReturnService extends FortuneOnline {
  _SolarReturnService(FortuneReportApi api) : super(api, () async => _today);

  final locations = <Map<String, Object?>?>[];

  @override
  Future<PreparedFortunePeriod> prepare(
    Map<String, Object?> input,
    int at,
    Map<String, Object?> archive,
    Future<void> cancel,
  ) async {
    final year = input['periodType'] == 'year';
    return PreparedFortunePeriod(
      year ? 'year-plan' : 'day-plan',
      (year ? DateTime.utc(2026) : DateTime.utc(2026, 11, 11))
          .millisecondsSinceEpoch,
      {'period': year ? 'year' : 'day'},
      year ? '2026-01-01' : '2026-11-11',
      year ? '2026-12-31' : '2026-11-11',
      year ? _returnAt : null,
    );
  }

  @override
  Future<String> calculate(
    Map<String, Object?> input,
    String owner,
    String snapshot,
    Map<String, Object?> chart,
    Future<void> cancel, {
    Map<String, Object?>? returnLocation,
  }) async {
    expect(input['periodType'], 'year');
    expect(owner, _owner);
    expect(snapshot, _snapshotId);
    locations.add(returnLocation);
    if (returnLocation != null) throw const FortuneReturnLocationUnavailable();
    return _runId;
  }

  @override
  Future<Map<String, Object?>> archive(
    PublishedFortune report,
    Map<String, Object?> input,
    int at,
    Future<void> cancel,
  ) async => report.toJson();
}

AccountController _accountWithChart() => _account(
  (request) => switch (request.url.path) {
    '/account/destiny-history/latest' => _json(_chart()),
    '/account/reading-history/latest' => http.Response('', 204),
    final path => fail('Unexpected account request $path'),
  },
);

AccountController _account(
  http.Response Function(http.Request) respond, {
  VoidCallback? onRestore,
}) {
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.https('account.example.test'),
      client: MockClient((request) async {
        if (request.url.path == '/account/session') onRestore?.call();
        return switch (request.url.path) {
          '/account/session' => _json({
            'user': {'id': _owner, 'displayName': '测试用户'},
          }),
          '/account/auth/capabilities' => _json({}),
          '/account/agreements/catalog' => _json({
            'documents': [
              for (final key in ['terms', 'privacy', 'ai'])
                {
                  'id': key,
                  'title': key,
                  'version': 'v1',
                  'hash': key,
                  'state': 'published',
                  'sections': [],
                },
            ],
          }),
          '/account/agreements' => _json({
            'requiredAccepted': true,
            'permissions': {for (final key in aiPurposes.keys) key: true},
          }),
          _ => respond(request),
        };
      }),
    ),
  );
  return AccountController(api, AgreementsApi(api));
}

Future<({String zone, int Function(int) clock})> _utc() async =>
    (zone: 'UTC', clock: (int value) => value - value % 1000);

Map<String, Object?> _entry(String id, String title) => {
  'id': id,
  'title': title,
  'calculatedAt': '2026-11-11T12:00:00.000Z',
  'savedAt': 1794398400000,
};

Map<String, Object?> _chart() => {
  ..._entry(_snapshotId, '命理归档'),
  'report': {
    'version': 1,
    'timeKnown': true,
    'charts': [
      {
        'method': 'bazi',
        'rows': [
          {'label': '日柱', 'value': '丁丑'},
        ],
      },
      {'method': 'ziwei', 'rows': []},
      {'method': 'western', 'rows': []},
    ],
    'chartSnapshot': {'version': 1},
  },
};

http.Response _json(Object? value, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(value)),
  status,
  headers: {'Content-Type': 'application/json; charset=utf-8'},
);

void _viewport(WidgetTester tester, Size size) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
}

Future<void> _tap(WidgetTester tester, String label) async {
  final finder = find.text(label);
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}
