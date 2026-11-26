import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../src/bootstrap/synastry.dart';
import '../src/features/account/account.dart';
import '../src/features/account/settings/model/agreements.dart';
import '../src/features/synastry/control/synastry_page_controller.dart';
import '../src/features/synastry/synastry.dart';
import '../src/shared/http/json_client.dart';

const _place = BirthPlace(
  id: 'sample',
  name: '杭州市',
  countryCode: 'CN',
  country: '中国',
  region: '浙江省',
  city: '杭州市',
  latitude: 30.27,
  longitude: 120.15,
  timeZone: 'Asia/Shanghai',
);

void main() {
  testWidgets('a long generated report opens at the outline on a narrow page', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(360, 700);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    final result = Completer<Map<String, String>>();
    final account = await _fixtureAccount(
      (request) {
        if (request.method == 'POST' &&
            request.url.path == '/account/reading-history') {
          return _json(_entry('a' * 64, '四类关系归档'));
        }
        return _json(null);
      },
      share: true,
      member: true,
    );
    await tester.pumpWidget(
      MaterialApp(
        home: SynastryPage(
          loadPlaces: () async => [_place],
          account: account,
          calculate: (profile, _) async =>
              _chart(profile.date.utcMidnight.toIso8601String()),
          compare: (_, __, ___) async => _comparison,
          summarize: (_, __, ___) => result.future,
        ),
      ),
    );
    await tester.pumpAndSettle();
    await _tap(tester, '手动填写 A 方资料');
    await _fillProfile(tester, '1990-06-01');
    await _tap(tester, '确认A 方资料');
    await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
    await _tap(tester, '手动填写 B 方资料');
    await _fillProfile(tester, '1992-07-02');
    await _tap(tester, '确认B 方资料');
    await _tap(tester, '比较盘面');
    final generate = find.text('生成合盘解读');
    await tester.ensureVisible(generate);
    await tester.pumpAndSettle();
    await tester.tap(generate);
    await tester.pump();
    result.complete({
      for (final key in ['family', 'friendship', 'romance', 'collaboration'])
        key: List.filled(30, '保存在同一份合盘报告中的段落。').join('\n\n'),
    });
    await tester.pumpAndSettle();

    expect(find.text('合盘解读').hitTestable(), findsOneWidget);
    final collaboration = find.widgetWithText(OutlinedButton, '合作');
    expect(collaboration.hitTestable(), findsOneWidget);
    await tester.tap(collaboration);
    await tester.pumpAndSettle();
    final heading = find
        .descendant(of: find.byType(Semantics), matching: find.text('合作'))
        .hitTestable();
    expect(heading, findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'guest edits both profiles, retries the draft and compares locally',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 700);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final calculations = <BirthProfile>[];
      final inputs = <Map<String, Object?>>[];
      final cancelledResult = Completer<Map<String, Object?>>();
      var cancelSeen = false;
      var onlineCalls = 0;
      await tester.pumpWidget(
        MaterialApp(
          home: SynastryPage(
            loadPlaces: () async => [_place],
            calculate: (profile, cancel) async {
              calculations.add(profile);
              if (profile.date.day == 3)
                throw const FormatException('bad chart');
              if (profile.date.day == 5) {
                unawaited(cancel.then((_) => cancelSeen = true));
                return cancelledResult.future;
              }
              return _chart(profile.date.utcMidnight.toIso8601String());
            },
            compare: (a, b, _) async {
              inputs.addAll([a, b]);
              return _comparison;
            },
            summarize: (request, _, _) async {
              onlineCalls++;
              return {};
            },
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<OutlinedButton>(
              find.widgetWithText(OutlinedButton, '手动填写 B 方资料'),
            )
            .onPressed,
        isNull,
      );

      await _tap(tester, '手动填写 A 方资料');
      await _fillProfile(tester, '1990-06-01');
      await _tap(tester, '确认A 方资料');
      expect(find.text('1990-06-01 09:20 · 杭州市'), findsOneWidget);

      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      await _tap(tester, '手动填写 B 方资料');
      await _fillProfile(tester, '1992-07-02');
      await _tap(tester, '确认B 方资料');
      await _tap(tester, '修改 B 方资料');
      expect(_input(tester, '出生日期').controller?.text, '1992-07-02');
      expect(_input(tester, '出生小时').controller?.text, '09');
      expect(_input(tester, '出生地').controller?.text, '杭州市');
      expect(
        tester
            .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, '女'))
            .selected,
        isTrue,
      );
      await tester.enterText(
        find.widgetWithText(TextField, '出生日期'),
        '1992-07-03',
      );
      await _tap(tester, '确认B 方资料');
      expect(find.text('排盘失败，请核对出生资料后重试。'), findsOneWidget);
      expect(_input(tester, '出生日期').controller?.text, '1992-07-03');
      await tester.enterText(
        find.widgetWithText(TextField, '出生日期'),
        '1992-07-04',
      );
      await _tap(tester, '确认B 方资料');
      expect(find.text('1992-07-04 09:20 · 杭州市'), findsOneWidget);

      await _tap(tester, '比较盘面');
      expect(inputs.map((input) => input['mode']), [
        'manual_subject',
        'manual_subject',
      ]);
      expect(
        (inputs.last['chart'] as Map)['calculatedAt'],
        '1992-07-04T00:00:00.000Z',
      );
      await _tap(tester, '八字 · 可用');
      expect(find.text('八字真实对照事实'), findsOneWidget);
      expect(find.text('登录或进入游客体验后生成解读'), findsOneWidget);
      expect(calculations.map((profile) => profile.date.day), [1, 2, 3, 4]);
      expect(onlineCalls, 0);

      await _tap(tester, '修改 A 方资料');
      await tester.enterText(
        find.widgetWithText(TextField, '出生日期'),
        '1990-06-05',
      );
      final confirm = find.text('确认A 方资料');
      await tester.ensureVisible(confirm);
      await tester.pump();
      await tester.tap(confirm);
      await tester.pump();
      expect(find.bySemanticsLabel('正在计算盘面'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(cancelSeen, isTrue);
      cancelledResult.complete(_chart('1990-06-05T00:00:00.000Z'));
      await tester.pumpAndSettle();
      expect(find.text('1990-06-01 09:20 · 杭州市'), findsOneWidget);
      expect(find.text('1990-06-05 09:20 · 杭州市'), findsNothing);

      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      expect(find.text('1992-07-04 09:20 · 杭州市'), findsNothing);
      expect(find.text('双人盘面对照'), findsNothing);
      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      await _tap(tester, '手动填写 B 方资料');
      expect(_input(tester, '出生日期').controller?.text, '');
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'opens the active guest account archive and keeps interpretation private',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(360, 700);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      final latest = 'a' * 64;
      final older = 'b' * 64;
      final requests = <String>[];
      final contexts = <String?>[];
      final destinations = <AccountDestination>[];
      final account = await _fixtureAccount((request) {
        final path = request.url.path;
        expect(request.method, 'GET');
        expect(request.url.queryParameters['expectedOwnerId'], 'guest-fixture');
        expect(request.url.queryParameters['kind'], 'synastry');
        requests.add(path);
        return switch (path) {
          '/account/reading-history' => _json({
            'entries': [_entry(latest, '最近合盘'), _entry(older, '早期合盘')],
            'nextCursor': null,
          }),
          '/account/reading-history/latest' => () {
            final context = request.url.queryParameters['contextKey'];
            contexts.add(context);
            return context == null
                ? _json(_archived(latest, '最近'))
                : _json(_archived(older, '匹配'));
          }(),
          _ when path.endsWith(older) => _json(_archived(older, '早期')),
          _ => throw StateError('Unexpected path $path'),
        };
      });
      expect(account.authorizedSession?.id, 'guest-fixture');
      await tester.pumpWidget(
        MaterialApp(
          home: AccountSectionLinks(
            open: (destination) async => destinations.add(destination),
            child: SynastryPage(
              loadPlaces: () async => [_place],
              account: account,
              calculate: (profile, _) async =>
                  _chart(profile.date.utcMidnight.toIso8601String()),
              compare: (a, b, _) async => _comparison,
              summarize: (request, isCurrent, cancel) async =>
                  throw StateError('Reading an archive must not send evidence'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('从合盘存档读取'), findsOneWidget);
      expect(find.widgetWithText(OutlinedButton, '亲情'), findsOneWidget);
      expect(find.text('读取本人盘面'), findsNothing);
      await _tap(tester, '查看已存解读');
      await _tap(tester, '早期合盘');
      await tester.pumpAndSettle();
      final collaboration = find.widgetWithText(OutlinedButton, '合作');
      expect(collaboration, findsOneWidget);
      await tester.tap(collaboration);
      await tester.pumpAndSettle();
      expect(find.text('早期合作正文'), findsOneWidget);
      expect(find.text('最近合作正文'), findsNothing);
      expect(tester.getCenter(find.text('早期合作正文')).dy, lessThan(700));
      expect(
        requests,
        containsAll([
          '/account/reading-history/latest',
          '/account/reading-history',
          '/account/reading-history/$older',
        ]),
      );
      await _tap(tester, '手动填写 A 方资料');
      await _fillProfile(tester, '1990-06-01');
      await _tap(tester, '确认A 方资料');
      await _tap(tester, '我已获准使用 B 方资料进行本次合盘');
      await _tap(tester, '手动填写 B 方资料');
      await _fillProfile(tester, '1992-07-02');
      await _tap(tester, '确认B 方资料');
      await _tap(tester, '比较盘面');
      await _tap(tester, '前往 AI 授权');
      expect(destinations, [accountDestination(AccountSection.aiPermissions)]);
      await _tap(tester, '查看此组合已存解读');
      expect(find.text('从合盘存档读取'), findsOneWidget);
      expect(find.text('匹配亲情正文'), findsOneWidget);
      expect(contexts, [
        null,
        '["1990-06-01T00:00:00.000Z","1992-07-02T00:00:00.000Z"]',
      ]);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'loads all saved reports in place and retries the same older cursor',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(320, 680);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);

      final cursor = 'd' * 64;
      final older = 'e' * 64;
      final cursors = <String?>[];
      var olderReads = 0;
      final account = await _fixtureAccount((request) {
        expect(request.url.queryParameters['expectedOwnerId'], 'guest-fixture');
        expect(request.url.queryParameters['kind'], 'synastry');
        final path = request.url.path;
        if (path == '/account/reading-history/latest') return _json({}, 404);
        if (path.endsWith(older)) {
          olderReads++;
          return _json(_archived(older, '第二页'));
        }
        expect(path, '/account/reading-history');
        final before = request.url.queryParameters['before'];
        cursors.add(before);
        if (before == null) {
          return _json({
            'entries': [
              _entry('a' * 64, '第一页第一篇'),
              _entry('b' * 64, '第一页第二篇'),
              _entry('c' * 64, '第一页第三篇'),
              _entry(cursor, '第一页第四篇'),
            ],
            'nextCursor': cursor,
          });
        }
        expect(before, cursor);
        if (cursors.length == 2) return _json({}, 503);
        return _json({
          'entries': [_entry(older, '第二页合盘')],
          'nextCursor': null,
        });
      });

      await tester.pumpWidget(
        MaterialApp(
          home: SynastryPage(
            loadPlaces: () async => [_place],
            account: account,
          ),
        ),
      );
      await tester.pumpAndSettle();
      await _tap(tester, '查看已存解读');
      expect(find.text('第一页第四篇'), findsOneWidget);
      expect(cursors, [null]);

      await _tap(tester, '加载更多');
      expect(find.text('暂时无法读取存档。'), findsOneWidget);
      expect(find.text('第一页第一篇'), findsOneWidget);
      await _tap(tester, '加载更多');
      expect(find.text('第二页合盘'), findsOneWidget);
      expect(cursors, [null, cursor, cursor]);

      await _tap(tester, '收起已存解读');
      expect(find.text('第二页合盘'), findsNothing);
      await _tap(tester, '查看已存解读');
      await _tap(tester, '第二页合盘');
      expect(find.text('第二页亲情正文'), findsOneWidget);
      expect(olderReads, 1);
      expect(cursors, [null, cursor, cursor]);

      expect(find.text('收起已存解读'), findsNothing);
      await _tap(tester, '查看已存解读');
      expect(find.text('第二页合盘'), findsOneWidget);
      expect(cursors, [null, cursor, cursor]);
      await _tap(tester, '刷新报告');
      expect(cursors, [null, cursor, cursor, null]);
      expect(find.text('第二页合盘'), findsNothing);
      expect(find.text('第一页第四篇'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  for (final kind in [
    'B-side consent',
    'AI authorization',
    'archived A account session',
  ]) {
    final revokeAi = kind == 'AI authorization';
    final archiveA = kind == 'archived A account session';
    test('withdrawing $kind aborts the actual model request', () async {
      final requestArrived = Completer<void>();
      final disconnected = Completer<void>();
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      Socket? connection;
      addTearDown(() async {
        connection?.destroy();
        await server.close(force: true);
      });
      server.listen((request) async {
        expect(request.method, 'POST');
        expect(request.uri.path, '/synastry/summary');
        expect(
          jsonDecode(await utf8.decoder.bind(request).join()),
          _comparison['summaryRequest'],
        );
        final socket = await request.response.detachSocket(writeHeaders: false);
        connection = socket;
        socket.listen(
          (_) {},
          onDone: () => disconnected.complete(),
          onError: (Object _) {
            if (!disconnected.isCompleted) disconnected.complete();
          },
          cancelOnError: true,
        );
        requestArrived.complete();
      });
      final account = await _fixtureAccount(
        (request) {
          expect(request.method, 'GET');
          return switch (request.url.path) {
            '/account/synastry-chart-snapshots/latest' when archiveA => _json(
              _snapshot(_ownedChart()),
            ),
            '/account/reading-history/latest' => _json(null),
            _ => fail('Unexpected archive request: $request'),
          };
        },
        share: true,
        member: archiveA,
      );
      final controller = SynastryPageController(
        account: account,
        calculate: (profile, _) async =>
            _chart(profile.date.utcMidnight.toIso8601String()),
        compare: (a, b, _) async => _comparison,
        summarize: configureSynastrySummary(
          value: Uri.http('127.0.0.1:' + server.port.toString()).toString(),
        ),
      );
      addTearDown(controller.dispose);
      await _prepareComparison(controller, archiveA: archiveA);
      final response = HttpOverrides.runWithHttpOverrides(
        controller.generateSummary,
        _LoopbackHttpOverrides(),
      );
      await requestArrived.future.timeout(const Duration(seconds: 5));
      if (revokeAi) {
        await account.choose(account.catalog!.ai, _permission, false);
      } else if (archiveA) {
        await account.signOut();
      } else {
        controller.confirmConsent(false);
      }
      await disconnected.future.timeout(const Duration(seconds: 5));
      await response;
      expect(controller.report, isNull);
      expect(controller.needsSave, isFalse);
      expect(controller.busy, isFalse);
      if (revokeAi) {
        expect(controller.result, _comparison);
        expect(controller.needsPermission, isTrue);
      } else if (archiveA) {
        expect(account.authorizedSession, isNull);
      } else {
        expect(controller.b, isNull);
        expect(controller.result, isNull);
      }
    });
  }

  test(
    'reloading archived A discards stale data and rejects invalid projections',
    () async {
      var response = _json(_snapshot(_ownedChart()));
      final account = await _fixtureAccount((request) {
        expect(request.url.path, '/account/synastry-chart-snapshots/latest');
        expect(request.url.queryParameters, {
          'expectedOwnerId': 'member-fixture',
        });
        return response;
      }, member: true);
      var comparisons = 0;
      final controller = SynastryPageController(
        account: account,
        calculate: (profile, _) async =>
            _chart(profile.date.utcMidnight.toIso8601String()),
        compare: (a, b, _) async {
          comparisons++;
          expect(a['mode'], 'account_owner');
          expect(a['chart'], _ownedChart());
          return _comparison;
        },
      );
      addTearDown(controller.dispose);

      await _prepareComparison(controller, archiveA: true);
      expect(controller.ownChartStatus, OwnSynastryChartStatus.available);
      response = _json({}, 403);
      final refresh = controller.readOwnChart();
      expect(controller.a, isNull);
      expect(controller.result, isNull);
      await refresh;
      expect(controller.ownChartStatus, OwnSynastryChartStatus.failed);
      expect(controller.canCompare, isFalse);
      expect(controller.aFromArchive, isFalse);
      expect(controller.b, isNotNull);

      response = _json(_snapshot({..._ownedChart(), 'snapshotId': 'b' * 64}));
      await controller.readOwnChart();
      expect(controller.ownChartStatus, OwnSynastryChartStatus.failed);
      expect(controller.canCompare, isFalse);

      response = _json({
        'status': 'missing_snapshot',
        'archiveId': 'a' * 64,
        'calculatedAt': '2026-10-20T09:00:00.000Z',
      });
      await controller.readOwnChart();
      expect(controller.ownChartStatus, OwnSynastryChartStatus.missingSnapshot);
      expect(controller.a, isNull);

      response = _json(_snapshot({..._ownedChart(), 'timeKnown': false}));
      await controller.readOwnChart();
      expect(controller.ownChartStatus, OwnSynastryChartStatus.unknownTime);
      expect(controller.a, isNull);
      expect(comparisons, 1);

      response = _json(_snapshot(_ownedChart()));
      await controller.readOwnChart();
      expect(controller.ownChartStatus, OwnSynastryChartStatus.available);
      expect(controller.canCompare, isTrue);
    },
  );

  test('an unknown chart version cannot open or generate a report', () async {
    final account = await _fixtureAccount(
      (request) => throw StateError('Unexpected archive request'),
      share: true,
    );
    final controller = SynastryPageController(
      account: account,
      calculate: (profile, _) async => _chart('not-a-date'),
      compare: (a, b, _) async => _comparison,
      summarize: (_, _, _) async => throw StateError('Unexpected model call'),
    );
    addTearDown(controller.dispose);
    await _prepareComparison(controller);
    await controller.restoreComparedReport();
    expect(controller.report, isNull);
    expect(controller.message, '暂时无法确认双方盘面版本，请重新排盘。');
    await controller.generateSummary();
    expect(controller.report, isNull);
    expect(controller.message, '暂时无法确认双方盘面版本，请重新排盘。');
  });
}

const _permission = 'synastry.cloud_interpretation';

class _LoopbackHttpOverrides extends HttpOverrides {}

Future<AccountController> _fixtureAccount(
  http.Response Function(http.Request) readArchives, {
  bool share = false,
  bool member = false,
}) async {
  Map<String, Object?> agreements(bool shared) => {
    'requiredAccepted': true,
    'permissions': {
      for (final purpose in aiPurposes.keys)
        purpose: shared && purpose == _permission,
    },
  };
  final api = AccountApi(
    JsonHttpClient(
      base: Uri.https('fixture.invalid'),
      client: MockClient(
        (request) async => switch (request.url.path) {
          '/account/session' =>
            member
                ? _json({
                    'user': {'id': 'member-fixture', 'displayName': '测试会员'},
                  })
                : _json({}, 401),
          '/account/auth/logout' => http.Response('', 204),
          '/account/auth/guest' => _json({
            'id': 'guest-fixture',
            'expiresAt': 4102444800000,
          }),
          '/account/auth/capabilities' => _json({}),
          '/account/agreements/catalog' => _json({
            'documents': [
              for (final id in ['privacy', 'terms', 'ai'])
                {
                  'id': id,
                  'title': id,
                  'version': '1',
                  'hash': 'sha',
                  'state': 'preview',
                  'sections': [],
                },
            ],
          }),
          '/account/agreements' => _json(agreements(share)),
          '/account/agreements/permission' => _json(agreements(false)),
          final path
              when path.startsWith('/account/reading-history') ||
                  path == '/account/synastry-chart-snapshots/latest' =>
            readArchives(request),
          final path => throw StateError('Unexpected path $path'),
        },
      ),
    ),
  );
  final account = AccountController(api, AgreementsApi(api));
  addTearDown(account.dispose);
  await account.initialize();
  return account;
}

Future<void> _prepareComparison(
  SynastryPageController controller, {
  bool archiveA = false,
}) async {
  BirthProfile profile(int day) => BirthProfile(
    date: BirthDate(1990, 6, day),
    time: const BirthTime(hour: 9, minute: 20),
    place: _place,
    gender: BirthGender.female,
  );
  controller.confirmConsent(true);
  if (archiveA) {
    await controller.readOwnChart();
    expect(controller.aFromArchive, isTrue);
  } else {
    expect(await controller.setManual(SynastrySide.a, profile(1)), isTrue);
  }
  expect(await controller.setManual(SynastrySide.b, profile(2)), isTrue);
  await controller.compareCharts();
  expect(controller.result, _comparison);
}

const _comparison = <String, Object?>{
  'comparison': {
    'sections': [
      {
        'system': 'bazi',
        'coverage': 'complete',
        'evidence': [
          {'observation': '八字真实对照事实'},
        ],
      },
    ],
  },
  'summaryRequest': {'rulesVersion': 'fixture', 'facts': []},
};

Map<String, Object?> _chart(String calculatedAt) => {
  'calculatedAt': calculatedAt,
  'bazi': {'status': 'complete'},
  'ziwei': {'status': 'complete'},
  'western': {'status': 'complete'},
};

Map<String, Object?> _ownedChart() => {
  ..._chart('2026-10-20T09:00:00.000Z'),
  'schemaVersion': 1,
  'snapshotId': 'a' * 64,
  'archiveId': 'a' * 64,
  'timeKnown': true,
  'ziwei': {'status': 'unavailable', 'reason': 'calculation_failed'},
};

Map<String, Object?> _snapshot(Map<String, Object?> chart) => {
  'status': 'available',
  'snapshot': chart,
};

Map<String, Object?> _entry(String id, String title) => {
  'id': id,
  'title': title,
  'calculatedAt': '2026-10-20T09:00:00.000Z',
  'savedAt': 1792490400000,
  'kind': 'synastry',
};

Map<String, Object?> _archived(String id, String prefix) => {
  ..._entry(id, '${prefix}合盘'),
  'report': {
    'version': 1,
    'kind': 'synastry',
    'sections': [
      for (final label in ['亲情', '友情', '爱情', '合作'])
        {'title': label, 'body': '$prefix${label}正文'},
    ],
  },
};

http.Response _json(Object? value, [int status = 200]) => http.Response.bytes(
  utf8.encode(jsonEncode(value)),
  status,
  headers: {'Content-Type': 'application/json; charset=utf-8'},
);

TextField _input(WidgetTester tester, String label) =>
    tester.widget<TextField>(find.widgetWithText(TextField, label));

Future<void> _fillProfile(WidgetTester tester, String date) async {
  await tester.enterText(find.widgetWithText(TextField, '出生日期'), date);
  await tester.enterText(find.widgetWithText(TextField, '出生小时'), '09');
  await tester.enterText(find.widgetWithText(TextField, '出生分钟'), '20');
  await tester.enterText(find.widgetWithText(TextField, '出生地'), '杭州');
  await tester.pumpAndSettle();
  await _tap(tester, '杭州市');
  await _tap(tester, '女');
}

Future<void> _tap(WidgetTester tester, String label) async {
  final found = find.text(label);
  if (found.evaluate().isEmpty) {
    await tester.scrollUntilVisible(
      found,
      180,
      scrollable: find.byType(Scrollable).first,
    );
  }
  await tester.ensureVisible(found);
  await tester.pumpAndSettle();
  await tester.tap(found);
  await tester.pumpAndSettle();
}
