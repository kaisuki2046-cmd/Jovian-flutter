import 'dart:convert';

import 'package:jovian_fortune/jovian_fortune.dart';

import '../../../shared/http/json_client.dart';
import '../model/online_fortune.dart';
import 'fortune_gzip.dart'
    if (dart.library.io) 'fortune_gzip_native.dart'
    if (dart.library.js_interop) 'fortune_gzip_web.dart';

class FortuneReportApi {
  const FortuneReportApi(this._http, {this.readNativeSession});

  final JsonHttpClient _http;
  final Future<String?> Function()? readNativeSession;

  Future<Map<String, String>> _sessionHeaders() async {
    final read = readNativeSession;
    if (read == null) return const {};
    final token = await read();
    if (token == null)
      throw const JsonRequestError('account_session_required', status: 401);
    return {'Authorization': 'Bearer $token', 'X-Account-Session': token};
  }

  Future<PublishedFortune?> latest(
    String owner,
    FortuneWindowKey key,
    Future<void> cancel,
  ) async {
    final result = await _http.requestNullable(
      ['fortune', 'reports', 'latest'],
      headers: await _sessionHeaders(),
      query: {
        'expectedOwnerId': owner,
        'snapshotId': key.snapshotId,
        'periodType': key.period.name,
        'displayTimezone': key.zone,
        'windowStart': key.start.toString(),
      },
      cancel: cancel,
    );
    return result == null
        ? null
        : PublishedFortune.fromJson(result, key.snapshotId, key.period);
  }

  Future<String> calculate(
    Map<String, Object?> input,
    String owner,
    String snapshot,
    Map<String, Object?> batch,
    Future<void> cancel,
  ) async {
    final raw = utf8.encode(
      jsonEncode({
        ...input,
        'expectedOwnerId': owner,
        'snapshotId': snapshot,
        'factBatch': batch,
      }),
    );
    final compressed = await gzipFortuneBody(raw);
    final result = await _http.request(
      ['fortune', 'calculate'],
      encodedBody: compressed ?? raw,
      headers: {
        ...await _sessionHeaders(),
        if (compressed != null) 'Content-Encoding': 'gzip',
      },
      cancel: cancel,
    );
    final id = result['reportId'];
    if (!isFortuneRecordId(id))
      throw const FormatException('Invalid calculation run ID.');
    return id as String;
  }

  Future<PublishedFortune> interpret(
    String owner,
    String snapshot,
    FortunePeriod period,
    String run,
    Future<void> cancel,
  ) async {
    final result = await _http.request(
      ['fortune', 'interpret'],
      headers: await _sessionHeaders(),
      body: {
        'calculationRunId': run,
        'expectedOwnerId': owner,
        'language': 'zh-CN',
      },
      cancel: cancel,
    );
    return PublishedFortune.fromJson(result, snapshot, period, runId: run);
  }

  Future<List<FortuneAdviceGroup>> advice(
    String owner,
    String snapshot,
    String run,
    Future<void> cancel,
  ) async {
    final result = await _http.request(
      ['fortune', 'advice', run],
      headers: await _sessionHeaders(),
      query: {'expectedOwnerId': owner},
      cancel: cancel,
    );
    return parseFortuneAdvice(result, run, snapshot);
  }

  void close() => _http.client.close();
}
