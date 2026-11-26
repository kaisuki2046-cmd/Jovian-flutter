import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

import '../src/features/synastry/requests/synastry_summary_api.dart';
import '../src/shared/http/json_client.dart';

const _request = <String, Object?>{
  'rulesVersion': 'fixture',
  'facts': [
    {
      'system': 'bazi',
      'rule': 'fixture',
      'direction': 'a_to_b',
      'observation': '既有事实',
      'sources': ['A', 'B'],
      'facts': {'value': 6},
      'chartRulesets': ['x', 'x'],
    },
  ],
};

void main() {
  test(
    'forwards legacy evidence and native model credentials unchanged',
    () async {
      final api = SynastrySummaryApi(
        JsonHttpClient(
          base: Uri.parse('https://model.example.test'),
          client: MockClient((request) async {
            expect(request.method, 'POST');
            expect(request.url.path, '/synastry/summary');
            expect(request.headers['x-account-session'], 'fixture');
            expect(request.headers['authorization'], isNull);
            expect(jsonDecode(request.body), _request);
            return http.Response.bytes(
              utf8.encode(
                jsonEncode({
                  'family': '亲情解读',
                  'friendship': '',
                  'romance': 42,
                  'collaboration': '合作解读',
                  'unrecognized': '忽略',
                }),
              ),
              200,
            );
          }),
        ),
        readNativeSession: () async => 'fixture',
      );
      addTearDown(api.close);
      expect(await api.summarize(_request, isCurrent: () => true), {
        'family': '亲情解读',
        'collaboration': '合作解读',
      });
    },
  );

  test(
    'preserves service permission errors and drops stale responses',
    () async {
      var current = true;
      var status = 428;
      final api = SynastrySummaryApi(
        JsonHttpClient(
          base: Uri.parse('https://model.example.test'),
          client: MockClient((request) async {
            expect(request.headers['x-account-session'], isNull);
            if (status == 200) current = false;
            return http.Response(
              status == 428
                  ? '{"error":"permission_required"}'
                  : '{"family":"stale"}',
              status,
            );
          }),
        ),
      );
      addTearDown(api.close);
      await expectLater(
        api.summarize(_request, isCurrent: () => current),
        throwsA(
          isA<JsonRequestError>().having(
            (error) => error.status,
            'status',
            428,
          ),
        ),
      );
      status = 200;
      await expectLater(
        api.summarize(_request, isCurrent: () => current),
        throwsA(
          isA<JsonRequestError>().having(
            (error) => error.code,
            'code',
            'account_changed',
          ),
        ),
      );
    },
  );
}
