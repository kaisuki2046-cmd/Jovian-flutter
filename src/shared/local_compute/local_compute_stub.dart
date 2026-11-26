import 'local_compute_error.dart';

const isLocalComputeAvailable = false;

Future<Map<String, Object?>> runLocalCompute(
  Map<String, Object?> operation, {
  void Function(String stage)? onProgress,
  Future<void>? cancel,
}) async => throw const LocalComputeException('unsupported', '此平台暂不支持本机排盘。');
