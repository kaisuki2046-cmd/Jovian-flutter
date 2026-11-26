import 'browser_compute_error.dart';

const isBrowserComputeAvailable = false;

Future<Map<String, Object?>> runBrowserCompute(
  Map<String, Object?> operation, {
  void Function(String stage)? onProgress,
  Future<void>? cancel,
}) async => throw const BrowserComputeException('unsupported', '请在浏览器中使用本机排盘。');
