import 'dart:convert';
import 'dart:js_interop';
import 'dart:js_interop_unsafe';

import 'package:web/web.dart' as web;

import 'local_compute_error.dart';
import 'local_compute_exchange.dart';

bool get isLocalComputeAvailable =>
    globalContext.hasProperty('Worker'.toJS).toDart;

Future<Map<String, Object?>> runLocalCompute(
  Map<String, Object?> operation, {
  void Function(String stage)? onProgress,
  Future<void>? cancel,
}) async {
  if (!isLocalComputeAvailable) {
    throw const LocalComputeException('unsupported', '此浏览器不支持本机排盘。');
  }
  final uri = Uri.parse(web.document.baseURI).resolve('legacy-compute.js');
  final web.Worker worker;
  try {
    worker = web.Worker(uri.toString().toJS);
  } catch (_) {
    throw unavailableCompute;
  }
  final job = LocalComputeExchange(onProgress, cancel);

  worker.onerror = ((web.Event event) {
    event.preventDefault();
    job.fail(unavailableCompute);
  }).toJS;
  worker.onmessageerror = ((web.Event _) => job.fail(invalidComputeReply)).toJS;
  worker.onmessage = ((web.MessageEvent message) {
    final data = message.data;
    if (data == null || !data.isA<JSString>()) {
      job.fail(invalidComputeReply);
    } else {
      job.read((data as JSString).toDart);
    }
  }).toJS;

  try {
    try {
      worker.postMessage(jsonEncode(operation).toJS);
    } catch (_) {
      job.fail(invalidComputeReply);
    }
    return await job.result;
  } finally {
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
  }
}
