import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../src/features/fortune/requests/fortune_report_api.dart';
import '../src/shared/http/json_client.dart';

void main() {
  test(
    'native fortune sends each existing credential and compresses large facts',
    () async {
      final token = 'a' * 43;
      final run = 'b' * 64;
      final snapshot = 'c' * 64;
      final facts = {'detail': '命盘' * 100000};
      final client = MockClient((request) async {
        expect(request.url.path, '/fortune/calculate');
        expect(request.headers['authorization'], 'Bearer $token');
        expect(request.headers['x-account-session'], token);
        expect(request.headers['content-encoding'], 'gzip');
        expect(jsonDecode(utf8.decode(gzip.decode(request.bodyBytes))), {
          'periodType': 'day',
          'expectedOwnerId': 'owner',
          'snapshotId': snapshot,
          'factBatch': facts,
        });
        return http.Response(jsonEncode({'reportId': run}), 200);
      });
      final api = FortuneReportApi(
        JsonHttpClient(
          base: Uri.parse('https://fortune.example.test'),
          client: client,
        ),
        readNativeSession: () async => token,
      );
      addTearDown(api.close);
      expect(
        await api.calculate(
          {'periodType': 'day'},
          'owner',
          snapshot,
          facts,
          Completer<void>().future,
        ),
        run,
      );
    },
  );
}
