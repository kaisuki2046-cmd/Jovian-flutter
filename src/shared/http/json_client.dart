import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

class JsonRequestError implements Exception {
  const JsonRequestError(this.code, {this.status});
  final String code;
  final int? status;
}

class JsonHttpClient {
  const JsonHttpClient({
    required this.base,
    required this.client,
    this.timeout = const Duration(seconds: 185),
  });

  final Uri base;
  final http.Client client;
  final Duration timeout;

  Future<Map<String, Object?>> request(
    List<String> path, {
    Map<String, String> headers = const {},
    Map<String, Object?>? body,
    String? method,
    Map<String, String>? query,
  }) async =>
      await requestNullable(
        path,
        headers: headers,
        body: body,
        method: method,
        query: query,
      ) ??
      (throw const JsonRequestError('invalid_response'));

  Future<Map<String, Object?>?> requestNullable(
    List<String> path, {
    Map<String, String> headers = const {},
    Map<String, Object?>? body,
    String? method,
    Map<String, String>? query,
  }) async {
    final aborted = Completer<void>();
    final url = base.replace(
      pathSegments: [
        ...base.pathSegments.where((segment) => segment.isNotEmpty),
        ...path,
      ],
      queryParameters: query,
    );
    final request = http.AbortableRequest(
      method ?? (body == null ? 'GET' : 'POST'),
      url,
      abortTrigger: aborted.future,
    )..followRedirects = false;
    request.headers.addAll(headers);
    request.headers['Accept'] = 'application/json';
    if (body != null) {
      request.headers['Content-Type'] = 'application/json; charset=utf-8';
      request.bodyBytes = utf8.encode(jsonEncode(body));
    }
    final http.Response response;
    try {
      response = await client
          .send(request)
          .then(http.Response.fromStream)
          .timeout(
            timeout,
            onTimeout: () {
              aborted.complete();
              throw const JsonRequestError('timeout');
            },
          );
    } on http.ClientException {
      throw const JsonRequestError('network');
    }
    if (response.statusCode == 204) return const {};
    final Object? value;
    try {
      value = jsonDecode(utf8.decode(response.bodyBytes));
    } on FormatException {
      throw JsonRequestError('invalid_response', status: response.statusCode);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final code = value is Map ? value['error'] ?? value['code'] : null;
      throw JsonRequestError(
        code is String ? code : 'request_failed',
        status: response.statusCode,
      );
    }
    if (value != null && value is! Map<String, Object?>)
      throw const JsonRequestError('invalid_response');
    return value as Map<String, Object?>?;
  }
}
