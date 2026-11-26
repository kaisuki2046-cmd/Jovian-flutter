import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';

import '../src/bootstrap/account.dart';
import '../src/bootstrap/destiny.dart';
import '../src/bootstrap/divination.dart';
import '../src/bootstrap/fortune.dart';
import '../src/bootstrap/synastry.dart';
import '../src/shared/http/service_endpoint.dart';

void main() {
  test('service endpoints preserve the origin and gateway path prefix', () {
    final endpoint = serviceEndpoint(
      ' https://preview.example.test:8443/api/account/ ',
      'ACCOUNT_API_URL',
    );
    expect(endpoint?.scheme, 'https');
    expect(endpoint?.host, 'preview.example.test');
    expect(endpoint?.port, 8443);
    expect(endpoint?.path, '/api/account/');
    expect(
      serviceEndpoint('http://127.0.0.1:8787', 'ACCOUNT_API_URL'),
      Uri.parse('http://127.0.0.1:8787'),
    );
    expect(serviceEndpoint('', 'ACCOUNT_API_URL'), isNull);
  });

  test('a bad service is isolated and endpoint secrets stay out of logs', () {
    final logs = <String>[];
    final original = debugPrint;
    debugPrint = (message, {wrapWidth}) {
      if (message != null) logs.add(message);
    };
    addTearDown(() => debugPrint = original);

    final account = configureAccount(value: 'https://preview.example.test');
    expect(account, isNotNull);
    addTearDown(account!.dispose);
    expect(configureOnlineGuide(value: 'ftp://example.test'), isNull);
    expect(
      configureDestinyReport(value: 'https://name:key@example.test/'),
      isNull,
    );
    expect(
      configureSynastrySummary(value: 'https://example.test/#draft'),
      isNull,
    );
    expect(
      configureFortuneTime(value: 'https://example.test/?token=key'),
      isNull,
    );
    expect(configureFortuneOnline(null, value: 'http://[invalid'), isNull);
    expect(logs, [
      'Invalid DIVINATION_REPORT_URL. This service is unavailable.',
      'Invalid DESTINY_REPORT_URL. This service is unavailable.',
      'Invalid SYNASTRY_REPORT_URL. This service is unavailable.',
      'Invalid FORTUNE_TIME_URL. This service is unavailable.',
      'Invalid FORTUNE_TIME_URL. This service is unavailable.',
    ]);
  });
}
