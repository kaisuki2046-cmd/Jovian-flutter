import 'dart:async';
import 'dart:convert';

import 'local_compute_error.dart';

const unavailableCompute = LocalComputeException(
  'unavailable',
  '本机计算脚本加载失败，请重试。',
);
const invalidComputeReply = LocalComputeException(
  'invalid_response',
  '本机计算结果无法读取，请重试。',
);

class LocalComputeExchange {
  LocalComputeExchange(this._onProgress, Future<void>? cancel) {
    _timer = Timer(const Duration(minutes: 3), () {
      fail(const LocalComputeException('timeout', '本机计算超时，请重试。'));
    });
    unawaited(
      cancel?.then<void>((_) {
        fail(const LocalComputeException('cancelled', '已取消测算。'));
      }),
    );
  }

  final void Function(String)? _onProgress;
  final _reply = Completer<Map<String, Object?>>();
  late final Timer _timer;

  bool get done => _reply.isCompleted;
  Future<Map<String, Object?>> get result => _reply.future;

  void read(String message) {
    if (done) return;
    final Object? value;
    try {
      value = jsonDecode(message);
    } on FormatException {
      fail(invalidComputeReply);
      return;
    }
    switch (value) {
      case {'stage': final String stage}:
        _onProgress?.call(stage);
      case {'result': final Map<String, Object?> result}:
        _timer.cancel();
        _reply.complete(result);
      case {'error': final String error}:
        fail(LocalComputeException('failed', error));
      default:
        fail(invalidComputeReply);
    }
  }

  void fail(LocalComputeException error) {
    if (done) return;
    _timer.cancel();
    _reply.completeError(error);
  }
}
