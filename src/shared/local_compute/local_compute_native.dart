import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:webview_flutter/webview_flutter.dart';

import 'local_compute_error.dart';
import 'local_compute_exchange.dart';

const _asset = 'tool/legacy_compute/native_assets/legacy-compute.html';
const _channel = 'JovianCompute';

bool get isLocalComputeAvailable => WebViewPlatform.instance != null;

Future<Map<String, Object?>> runLocalCompute(
  Map<String, Object?> operation, {
  void Function(String stage)? onProgress,
  Future<void>? cancel,
}) async {
  if (!isLocalComputeAvailable) {
    throw const LocalComputeException('unsupported', '此平台暂不支持本机排盘。');
  }
  final WebViewController controller;
  try {
    controller = WebViewController();
  } catch (_) {
    throw unavailableCompute;
  }
  final job = LocalComputeExchange(onProgress, cancel);
  final runner = _NativeComputeRunner(controller, job, operation);
  unawaited(runner.load());
  try {
    return await job.result;
  } finally {
    unawaited(runner.close());
  }
}

class _NativeComputeRunner {
  _NativeComputeRunner(this._controller, this._job, this._operation);

  final WebViewController _controller;
  final LocalComputeExchange _job;
  final Map<String, Object?> _operation;
  final _message = StringBuffer();
  Future<void>? _channelRegistration;
  bool _started = false;

  Future<void> load() async {
    try {
      await _controller.setJavaScriptMode(JavaScriptMode.unrestricted);
      if (_job.done) return;
      await _controller.setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            final bundledPage =
                uri != null &&
                uri.scheme == 'file' &&
                uri.path.endsWith('/$_asset');
            return bundledPage
                ? NavigationDecision.navigate
                : NavigationDecision.prevent;
          },
          onWebResourceError: (error) {
            if (error.isForMainFrame == true) _job.fail(unavailableCompute);
          },
        ),
      );
      if (_job.done) return;
      final registration = _controller.addJavaScriptChannel(
        _channel,
        onMessageReceived: _receive,
      );
      _channelRegistration = registration;
      await registration;
      if (_job.done) return;
      await _controller.loadFlutterAsset(_asset);
    } catch (_) {
      _job.fail(unavailableCompute);
    }
  }

  void _receive(JavaScriptMessage event) {
    if (_job.done) return;
    final message = event.message;
    if (message == 'ready' && !_started) {
      _started = true;
      unawaited(_sendOperation());
      return;
    }
    if (_started && (message.startsWith('0') || message.startsWith('1'))) {
      _message.write(message.substring(1));
      if (message.startsWith('1')) {
        final payload = _message.toString();
        _message.clear();
        _job.read(payload);
      }
      return;
    }
    _job.fail(invalidComputeReply);
  }

  Future<void> _sendOperation() async {
    try {
      final input = base64Encode(utf8.encode(jsonEncode(_operation)));
      const chunkSize = 48 * 1024;
      for (
        var offset = 0;
        offset < input.length && !_job.done;
        offset += chunkSize
      ) {
        final next = input.substring(
          offset,
          math.min(offset + chunkSize, input.length),
        );
        await _controller.runJavaScript(
          'window.jovianNativeCompute.append("$next")',
        );
      }
      if (!_job.done)
        await _controller.runJavaScript('window.jovianNativeCompute.run()');
    } catch (_) {
      _job.fail(unavailableCompute);
    }
  }

  Future<void> close() async {
    final registration = _channelRegistration;
    if (registration == null) return;
    try {
      // Cancel the job immediately, then let native registration finish before
      // removing its callback. A cancelled load never starts the worker.
      await registration;
      if (_started) {
        await _controller.runJavaScript('window.jovianNativeCompute?.close()');
      }
    } catch (_) {
      // The view may have registered its callback before setup failed.
    }
    try {
      await _controller.removeJavaScriptChannel(_channel);
    } catch (_) {
      // The native view may already be gone during app teardown.
    }
  }
}
