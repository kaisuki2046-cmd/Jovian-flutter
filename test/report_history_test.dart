import 'dart:async';
import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../src/features/account/auth/requests/account_api.dart';
import '../src/features/account/history/control/report_history_controller.dart';
import '../src/features/account/history/model/report_history.dart';
import '../src/features/account/history/requests/report_history_api.dart';
import '../src/shared/http/json_client.dart';

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
}

Map<String, Object?> _entry(String id) => {
  'id': id,
  'title': '归档报告',
  'calculatedAt': '2026-11-25T00:00:00.000Z',
  'savedAt': 1795564800000,
  'kind': 'fortune',
};

http.Response _json(Object? value, [int status = 200]) =>
    http.Response.bytes(utf8.encode(jsonEncode(value)), status);
