import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:jovian_fortune/jovian_fortune.dart';

import '../src/features/account/account.dart';
import '../src/features/fortune/control/fortune_local.dart';
import '../src/features/fortune/control/fortune_online.dart';
import '../src/features/fortune/control/fortune_page_controller.dart';
import '../src/features/fortune/model/online_fortune.dart';
import '../src/features/fortune/requests/fortune_report_api.dart';
import '../src/shared/http/json_client.dart';
import 'support/fortune_local_fixture.dart';

void main() {
  for (final (description, previous, selection) in [
    (
      'automatically reopens the previous weekly report',
      FortunePeriod.week,
      null,
    ),
    (
      'automatically reopens a report in the current daily window',
      FortunePeriod.day,
      null,
    ),
    (
      'keeps the explicit monthly selection during a delayed initial restore',
      FortunePeriod.week,
      FortunePeriod.month,
    ),
    (
      'choosing the highlighted current day still cancels an older week restore',
      FortunePeriod.week,
      FortunePeriod.day,
    ),
  ]) {
    test(description, () async {
      const owner = 'fortune-restore-owner';
      final firstArchiveRequested = Completer<void>();
      final firstArchive = Completer<http.Response>();
      final delayVerification = selection == FortunePeriod.day;
      final verifyingOldWeek = Completer<void>();
      final oldWeekResponse = Completer<http.Response>();
      final modelLookups = <(FortunePeriod, int)>[];
      int generalReads = 0;
      final accountApi = AccountApi(
        JsonHttpClient(
          base: Uri.https('account.example.test'),
          client: MockClient((request) async {
            expect(request.method, 'GET');
            expect(request.url.queryParameters['expectedOwnerId'], owner);
            if (request.url.path == '/account/destiny-history/latest') {
              return _response({
                ..._entry(_snapshot, '命盘记录'),
                'report': {
                  'version': 1,
                  'timeKnown': true,
                  'chartSnapshot': {'version': 1, 'timeKnown': true},
                  'charts': [
                    for (final method in ['bazi', 'ziwei', 'western'])
                      {'method': method, 'rows': []},
                  ],
                },
              });
            }
            expect(request.url.path, '/account/reading-history/latest');
            if (request.url.queryParameters['contextKey'] case final context?) {
              final fields = jsonDecode(context) as List;
              expect(fields[0], _snapshot);
              final period = FortunePeriod.values.byName(fields[1] as String);
              expect(fields[2], 'UTC');
              expect(fields[3], _window(period).start);
              return _response(_saved(period));
            }
            generalReads++;
            if (!firstArchiveRequested.isCompleted) {
              firstArchiveRequested.complete();
              if (selection != null && !delayVerification) {
                return firstArchive.future;
              }
            }
            return _response(_saved(previous));
          }),
        ),
      );
      final account = AccountController(accountApi, AgreementsApi(accountApi));
      final service = _FortuneWindowFixture(
        FortuneReportApi(
          JsonHttpClient(
            base: Uri.https('fortune.example.test'),
            client: MockClient((request) async {
              expect(request.method, 'GET');
              expect(request.url.path, '/fortune/reports/latest');
              expect(request.url.queryParameters['expectedOwnerId'], owner);
              expect(request.url.queryParameters['snapshotId'], _snapshot);
              expect(request.url.queryParameters['displayTimezone'], 'UTC');
              final period = FortunePeriod.values.byName(
                request.url.queryParameters['periodType']!,
              );
              final start = int.parse(
                request.url.queryParameters['windowStart']!,
              );
              modelLookups.add((period, start));
              if (delayVerification && period == previous) {
                verifyingOldWeek.complete();
                return oldWeekResponse.future;
              }
              return _response(_published(period));
            }),
          ),
        ),
      );
      final controller = FortunePageController(
        loadDisplay: () async => (zone: 'UTC', clock: (int time) => time),
        readServerTime: () async => _today,
        account: account,
        ownerId: owner,
        archiveId: null,
        local: const FortuneLocalFixture(),
        online: service,
      );
      addTearDown(() {
        controller.dispose();
        account.dispose();
      });
      final restored = Completer<void>();
      controller.addListener(() {
        if (controller.reportSaved &&
            !controller.loadingReport &&
            !restored.isCompleted)
          restored.complete();
      });
      controller.initialize();
      await firstArchiveRequested.future.timeout(const Duration(seconds: 2));
      if (selection != null) {
        if (delayVerification) {
          await verifyingOldWeek.future.timeout(const Duration(seconds: 2));
        }
        expect(controller.loadingReport, isTrue);
        if (delayVerification) expect(controller.displayedPeriod, selection);
        controller.selectPeriod(selection);
      }
      await restored.future.timeout(const Duration(seconds: 2));
      if (selection != null) {
        if (delayVerification) {
          oldWeekResponse.complete(_response(_published(previous)));
        } else {
          firstArchive.complete(_response(_saved(previous)));
        }
        await Future<void>.delayed(Duration.zero);
      }
      final expected = selection ?? previous;
      expect(controller.displayedPeriod, expected);
      expect(controller.published?.id, _idFor(expected));
      expect(controller.displayedWindow?.start, _window(expected).start);
      final expectedLookups = [
        if (delayVerification) (previous, _window(previous).start),
        (expected, _window(expected).start),
      ];
      expect(modelLookups, expectedLookups);
      expect(generalReads, 1);
      expect(
        controller.archivedWindow != null,
        selection == null && previous == FortunePeriod.week,
      );
      if (controller.archivedWindow == null) {
        controller.selectPeriod(expected);
        expect(controller.loadingPreview, isFalse);
        await Future<void>.delayed(Duration.zero);
        expect(modelLookups, expectedLookups);
        expect(generalReads, 1);
      }
    });
  }

  test(
    'scope and period determine the archive and ignore a stale response',
    () async {
      const owner = '00000000-0000-4000-8000-000000000001';
      final snapshotId = 'a' * 64;
      final dailyResponse = Completer<http.Response>();
      final dailyRequested = Completer<void>();
      final client = AccountApi(
        JsonHttpClient(
          base: Uri.parse('https://account.example.test'),
          client: MockClient((request) async {
            expect(request.url.queryParameters['expectedOwnerId'], owner);
            if (request.url.path.endsWith('/destiny-history/latest')) {
              return _response({
                ..._entry(snapshotId, '命盘记录'),
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
                },
              });
            }
            expect(request.url.path, '/account/reading-history/latest');
            expect(request.url.queryParameters['kind'], 'fortune');
            final key =
                jsonDecode(request.url.queryParameters['contextKey']!) as List;
            expect(key[0], snapshotId);
            expect(key[2], 'UTC');
            if (key[1] == 'day') {
              expect(key[3], DateTime.utc(2026, 11, 11).millisecondsSinceEpoch);
              dailyRequested.complete();
              return dailyResponse.future;
            }
            expect(key[1], 'week');
            expect(key[3], DateTime.utc(2026, 11, 9).millisecondsSinceEpoch);
            return _response(_report('c' * 64, '本周已保存'));
          }),
        ),
      );
      final account = AccountController(client, AgreementsApi(client));
      final controller = FortunePageController(
        loadDisplay: () async =>
            (zone: 'UTC', clock: (int value) => value - value % 1000),
        readServerTime: () async => DateTime.utc(2026, 11, 11, 12),
        account: account,
        ownerId: owner,
        archiveId: null,
        local: const FortuneLocalFixture(),
      );
      addTearDown(() {
        controller.dispose();
        account.dispose();
      });
      controller.initialize();
      await dailyRequested.future;
      final weekly = Completer<void>();
      controller.addListener(() {
        if (controller.savedReport?.entry.title == '本周已保存' &&
            !weekly.isCompleted) {
          weekly.complete();
        }
      });
      controller.selectPeriod(FortunePeriod.week);
      await weekly.future;
      dailyResponse.complete(_response(_report('b' * 64, '昨日请求')));
      await Future<void>.delayed(Duration.zero);
      expect(controller.savedReport?.entry.title, '本周已保存');
      expect(controller.preview?.current.tenGod, isNotNull);
    },
  );

  test(
    'an unreachable time service uses device time and retains a valid preview',
    () async {
      final fallback = DateTime.utc(2026, 11, 1, 12);
      final controller = FortunePageController(
        loadDisplay: () async =>
            (zone: 'UTC', clock: (int value) => value - value % 1000),
        readServerTime: () async => throw const JsonRequestError('network'),
        account: null,
        ownerId: null,
        archiveId: null,
        local: const FortuneLocalFixture(),
        now: () => fallback,
      );
      addTearDown(controller.dispose);
      await controller.refreshTime();
      expect(controller.referenceTime, fallback);
      expect(controller.usingFallbackTime, isTrue);
      expect(controller.syncingTime, isFalse);
      expect(
        controller.preview?.window.start,
        DateTime.utc(2026, 11, 1).millisecondsSinceEpoch,
      );
    },
  );

  test(
    'switching the period cancels an older preview and recovers on refresh',
    () async {
      final local = _DelayedPreview();
      final date = DateTime.utc(2026, 11, 11, 12);
      final controller = FortunePageController(
        loadDisplay: () async => (zone: 'UTC', clock: (int value) => value),
        readServerTime: () async => date,
        account: null,
        ownerId: null,
        archiveId: null,
        local: local,
      );
      addTearDown(controller.dispose);

      final initial = controller.refreshTime();
      await Future<void>.delayed(Duration.zero);
      final day = local.pending.single;
      controller.selectPeriod(FortunePeriod.week);
      final week = local.pending.last;
      await day.cancel;
      expect(controller.loadingPreview, isTrue);
      expect(controller.preview, isNull);
      final weekly = await const FortuneLocalFixture().preview(
        date.millisecondsSinceEpoch,
        FortunePeriod.week,
        'UTC',
        null,
        week.cancel,
      );
      week.result.complete(weekly);
      await Future<void>.delayed(Duration.zero);
      expect(
        controller.preview?.window.start,
        DateTime.utc(2026, 11, 9).millisecondsSinceEpoch,
      );
      day.result.completeError(StateError('Superseded daily preview failed.'));
      await initial;
      expect(controller.preview?.window.start, weekly.preview.window.start);
      expect(controller.previewError, isNull);
      expect(controller.loadingPreview, isFalse);

      final failed = controller.refreshTime();
      await Future<void>.delayed(Duration.zero);
      local.pending.last.result.completeError(StateError('worker missing'));
      await failed;
      expect(controller.previewError, '暂时无法计算当前运势日期，请重试。');

      final retry = controller.refreshTime();
      await Future<void>.delayed(Duration.zero);
      local.pending.last.result.complete(weekly);
      await retry;
      expect(controller.preview?.window.start, weekly.preview.window.start);
      expect(controller.previewError, isNull);
    },
  );
}

final _today = DateTime.utc(2026, 11, 11, 12);
final _snapshot = 'a' * 64;

String _idFor(FortunePeriod period) => ['b', 'c', 'd', 'f'][period.index] * 64;

DisplayWindow _window(FortunePeriod period, [int? at]) => buildFortunePreview(
  at ?? _today.millisecondsSinceEpoch,
  period,
  (time) => time,
).window;

Map<String, Object?> _published(FortunePeriod period) => {
  'reportId': _idFor(period),
  'calculationRunId': 'e' * 64,
  'natalChartSnapshotId': _snapshot,
  'periodType': period.name,
  'sections': [
    for (final section in fortuneSectionTitles.keys)
      {'sectionId': section, 'summary': '已发布的 $section'},
  ],
};

Map<String, Object?> _saved(FortunePeriod period) => {
  ..._entry('1' * 64, '已归档运势'),
  'kind': 'fortune',
  'report': {
    'version': 1,
    'kind': 'fortune',
    'context': {
      'snapshotId': _snapshot,
      'displayTimezone': 'UTC',
      'periodType': period.name,
      'windowStart': _window(period).start,
      'windowEnd': _window(period).end,
      'calculationRunId': 'e' * 64,
      'reportId': _idFor(period),
    },
    'sections': [
      {'title': '综合运势', 'body': '已经保存的正文。'},
    ],
  },
};

class _FortuneWindowFixture extends FortuneOnline {
  _FortuneWindowFixture(FortuneReportApi api) : super(api, () async => _today);

  @override
  Future<PreparedFortunePeriod> prepare(
    Map<String, Object?> input,
    int at,
    Map<String, Object?> archive,
    Future<void> cancel,
  ) async {
    final period = FortunePeriod.values.byName(input['periodType']! as String);
    final window = _window(period, at);
    String date(int time) => DateTime.fromMillisecondsSinceEpoch(
      time,
      isUtc: true,
    ).toIso8601String().substring(0, 10);
    return PreparedFortunePeriod(
      fortuneArchiveKey(
        archive['snapshotId']! as String,
        period,
        input['displayTimezone']! as String,
        window,
      ),
      window.start,
      const {},
      date(window.start),
      date(window.end - 1),
      null,
    );
  }
}

class _DelayedPreview extends FortuneLocal {
  final pending =
      <({Future<void> cancel, Completer<LocalFortunePreview> result})>[];

  @override
  Future<LocalFortunePreview> preview(
    int asOf,
    FortunePeriod period,
    String zone,
    ArchivedDestinyCharts? archive,
    Future<void> cancel,
  ) {
    final result = Completer<LocalFortunePreview>();
    pending.add((cancel: cancel, result: result));
    return result.future;
  }
}

Map<String, Object?> _entry(String id, String title) => {
  'id': id,
  'title': title,
  'calculatedAt': '2026-11-11T12:00:00.000Z',
  'savedAt': 1794398400000,
};

Map<String, Object?> _report(String id, String title) => {
  ..._entry(id, title),
  'kind': 'fortune',
  'report': {
    'version': 1,
    'kind': 'fortune',
    'sections': [
      {'title': '综合运势', 'body': '已归档文本'},
    ],
  },
};

http.Response _response(Map<String, Object?> value) =>
    http.Response.bytes(utf8.encode(jsonEncode(value)), 200);
