import 'local_compute_stub.dart'
    if (dart.library.io) 'local_compute_native.dart'
    if (dart.library.js_interop) 'local_compute_web.dart'
    as platform;

export 'local_compute_error.dart' show LocalComputeException;

/// Runs the original calculation source using the local platform's Worker.
class LocalCompute {
  const LocalCompute();

  bool get isAvailable => platform.isLocalComputeAvailable;

  Future<Map<String, Object?>> calculateDestiny(
    Map<String, Object?> profile, {
    void Function(String stage)? onProgress,
    Future<void>? cancel,
  }) => platform.runLocalCompute(
    {'name': 'calculateDestiny', 'profile': profile},
    onProgress: onProgress,
    cancel: cancel,
  );

  Future<Map<String, Object?>> calculateManualSubjectChart(
    Map<String, Object?> profile, {
    Future<void>? cancel,
  }) => platform.runLocalCompute({
    'name': 'calculateManualSubjectChart',
    'profile': profile,
  }, cancel: cancel);

  Future<Map<String, Object?>> compareSynastry(
    Map<String, Object?> a,
    Map<String, Object?> b, {
    Future<void>? cancel,
  }) => platform.runLocalCompute({
    'name': 'compareSynastry',
    'a': a,
    'b': b,
  }, cancel: cancel);

  Future<Map<String, Object?>> previewFortune(
    int asOf,
    String period,
    String timeZone, {
    Map<String, Object?>? archive,
    Future<void>? cancel,
  }) => platform.runLocalCompute({
    'name': 'previewFortune',
    'asOf': asOf,
    'period': period,
    'timeZone': timeZone,
    'archive': ?archive,
  }, cancel: cancel);

  Future<Map<String, Object?>> queryFortuneCalendar(
    Map<String, String> reference, {
    Future<void>? cancel,
  }) => platform.runLocalCompute({
    'name': 'queryFortuneCalendar',
    'reference': reference,
  }, cancel: cancel);

  Future<Map<String, Object?>> buildFortuneFactSubmission(
    Map<String, Object?> input,
    int asOf,
    Map<String, Object?> archive, {
    Map<String, Object?>? returnLocation,
    Future<void>? cancel,
  }) => platform.runLocalCompute({
    'name': 'buildFortuneFactSubmission',
    'input': input,
    'asOf': asOf,
    'archive': archive,
    'returnLocation': ?returnLocation,
  }, cancel: cancel);

  Future<Map<String, Object?>> prepareFortunePeriod(
    Map<String, Object?> input,
    int asOf,
    Map<String, Object?> archive,
    Future<void> cancel,
  ) => platform.runLocalCompute({
    'name': 'prepareFortunePeriod',
    'input': input,
    'asOf': asOf,
    'archive': archive,
  }, cancel: cancel);

  Future<Map<String, Object?>> archiveFortuneReport(
    Map<String, Object?> report,
    Map<String, Object?> input,
    int asOf,
    Future<void> cancel,
  ) => platform.runLocalCompute({
    'name': 'archiveFortuneReport',
    'report': report,
    'input': input,
    'asOf': asOf,
  }, cancel: cancel);
}
