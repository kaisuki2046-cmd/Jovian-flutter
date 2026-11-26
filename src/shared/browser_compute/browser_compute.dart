import 'browser_compute_stub.dart'
    if (dart.library.js_interop) 'browser_compute_web.dart'
    as platform;

export 'browser_compute_error.dart' show BrowserComputeException;

/// Calls the original browser calculations using their JSON contracts.
class BrowserCompute {
  const BrowserCompute();

  bool get isAvailable => platform.isBrowserComputeAvailable;

  Future<Map<String, Object?>> calculateDestiny(
    Map<String, Object?> profile, {
    void Function(String stage)? onProgress,
    Future<void>? cancel,
  }) => platform.runBrowserCompute(
    {'name': 'calculateDestiny', 'profile': profile},
    onProgress: onProgress,
    cancel: cancel,
  );

  Future<Map<String, Object?>> calculateManualSubjectChart(
    Map<String, Object?> profile, {
    Future<void>? cancel,
  }) => platform.runBrowserCompute({
    'name': 'calculateManualSubjectChart',
    'profile': profile,
  }, cancel: cancel);

  Future<Map<String, Object?>> compareSynastry(
    Map<String, Object?> a,
    Map<String, Object?> b, {
    Future<void>? cancel,
  }) => platform.runBrowserCompute({
    'name': 'compareSynastry',
    'a': a,
    'b': b,
  }, cancel: cancel);

  Future<Map<String, Object?>> buildFortuneFactSubmission(
    Map<String, Object?> input,
    int asOf,
    Map<String, Object?> archive, {
    Map<String, Object?>? returnLocation,
    Future<void>? cancel,
  }) => platform.runBrowserCompute({
    'name': 'buildFortuneFactSubmission',
    'input': input,
    'asOf': asOf,
    'archive': archive,
    'returnLocation': ?returnLocation,
  }, cancel: cancel);
}
