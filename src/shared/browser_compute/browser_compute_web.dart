import 'dart:async';
import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:web/web.dart' as web;

import 'browser_compute_error.dart';

bool get isBrowserComputeAvailable =>
    globalContext.hasProperty('Worker'.toJS).toDart;

const _unavailable = BrowserComputeException(
  'unavailable',
  '本机计算脚本加载失败，请刷新后重试。',
);
const _invalidResponse = BrowserComputeException(
  'invalid_response',
  '本机计算结果无法读取，请重试。',
);

Future<Map<String, Object?>> runBrowserCompute(
  Map<String, Object?> operation, {
  void Function(String stage)? onProgress,
  Future<void>? cancel,
}) async {
  if (!isBrowserComputeAvailable) {
    throw const BrowserComputeException('unsupported', '此浏览器不支持本机排盘。');
  }
  final uri = Uri.parse(web.document.baseURI).resolve('legacy-compute.js');
  final web.Worker worker;
  try {
    worker = web.Worker(uri.toString().toJS);
  } catch (_) {
    throw _unavailable;
  }
  final completed = Completer<Map<String, Object?>>();
  void fail(BrowserComputeException error) {
    if (!completed.isCompleted) completed.completeError(error);
  }

  worker.onerror = ((web.Event event) {
    event.preventDefault();
    fail(_unavailable);
  }).toJS;
  worker.onmessageerror = ((web.Event _) => fail(_invalidResponse)).toJS;
  worker.onmessage = ((web.MessageEvent message) {
    if (completed.isCompleted) return;
    final data = message.data;
    if (data == null || !data.isA<JSString>()) {
      fail(_invalidResponse);
      return;
    }
    final Object? reply;
    try {
      reply = jsonDecode((data as JSString).toDart);
    } on FormatException {
      fail(_invalidResponse);
      return;
    }
    switch (reply) {
      case {'stage': final String stage}:
        onProgress?.call(stage);
      case {'result': final Map<String, Object?> result}:
        completed.complete(result);
      case {'error': final String message}:
        fail(BrowserComputeException('failed', message));
      default:
        fail(_invalidResponse);
    }
  }).toJS;
  unawaited(
    cancel?.then<void>((_) {
      fail(const BrowserComputeException('cancelled', '已取消测算。'));
    }),
  );

  try {
    worker.postMessage(jsonEncode(operation).toJS);
    return await completed.future.timeout(
      const Duration(minutes: 3),
      onTimeout: () =>
          throw const BrowserComputeException('timeout', '本机计算超时，请重试。'),
    );
  } finally {
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
  }
}
