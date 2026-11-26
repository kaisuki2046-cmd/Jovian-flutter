import 'dart:convert';
import 'dart:io';

import '../lib/fortune_time.dart';

void _expect(Object? actual, Object? expected) {
  if (actual != expected)
    throw StateError('Expected $expected, received $actual.');
}

Future<void> main() async {
  const origin = 'http://localhost:8081';
  final server = await serveFortuneTime(
    port: 0,
    webOrigin: origin,
    now: () => DateTime.utc(2026, 11, 26, 6, 0, 0, 123, 456),
  );
  final client = HttpClient();
  try {
    for (final (method, path, requestOrigin, status) in [
      ('GET', '/fortune/time', origin, 200),
      ('GET', '/fortune/time', null, 200),
      ('GET', '/fortune/time', 'https://example.com', 403),
      ('GET', '/fortune/time?asOfUtc=2000-01-01', origin, 404),
      ('POST', '/fortune/time', origin, 405),
      ('OPTIONS', '/fortune/time', origin, 405),
    ]) {
      final uri = Uri.parse('http://127.0.0.1:${server.port}$path');
      final request = await client.openUrl(method, uri);
      if (requestOrigin != null) request.headers.set('origin', requestOrigin);
      final response = await request.close();
      final body = await response.transform(utf8.decoder).join();
      _expect(response.statusCode, status);
      _expect(response.headers.value('cache-control'), 'no-store');
      _expect(response.headers.value('vary'), 'Origin');
      _expect(
        response.headers.value('access-control-allow-origin'),
        requestOrigin == origin ? origin : null,
      );
      _expect(response.headers.value('allow'), status == 405 ? 'GET' : null);
      if (status == 200) {
        _expect(response.headers.contentType?.mimeType, 'application/json');
        _expect(response.headers.contentType?.charset, 'utf-8');
        _expect(body, '{"asOfUtc":"2026-11-26T06:00:00.123Z"}');
      } else {
        _expect(body, '');
      }
    }
    stdout.writeln('Six HTTP cases passed for the Dart fortune-time endpoint.');
  } finally {
    client.close(force: true);
    await server.close(force: true);
  }
}
