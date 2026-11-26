import '../../../shared/browser_compute/browser_compute.dart';
import '../model/online_fortune.dart';
import '../requests/fortune_report_api.dart';

class FortuneReturnLocationUnavailable implements Exception {
  const FortuneReturnLocationUnavailable();
}

class FortuneOnline {
  const FortuneOnline(
    this.api,
    this.readTime, {
    this.compute = const BrowserCompute(),
  });

  final FortuneReportApi api;
  final Future<DateTime> Function() readTime;
  final BrowserCompute compute;

  Future<PreparedFortunePeriod> prepare(
    Map<String, Object?> input,
    int at,
    Map<String, Object?> archive,
    Future<void> cancel,
  ) async => PreparedFortunePeriod.fromJson(
    await compute.prepareFortunePeriod(input, at, archive, cancel),
  );

  Future<String> calculate(
    Map<String, Object?> input,
    String owner,
    String snapshot,
    Map<String, Object?> chart,
    Future<void> cancel, {
    Map<String, Object?>? returnLocation,
  }) async {
    final at = (await readTime()).millisecondsSinceEpoch;
    final batch = await compute.buildFortuneFactSubmission(
      input,
      at,
      {'snapshotId': snapshot, 'chart': chart},
      returnLocation: returnLocation,
      cancel: cancel,
    );
    final facts = batch['facts'];
    if (returnLocation != null &&
        (facts is! List ||
            !facts.any(
              (fact) => switch (fact) {
                {
                  'factType': 'solar_return',
                  'normalizedPayload': {
                    'returnAngles': 'regiomontanus_verified',
                  },
                } =>
                  true,
                _ => false,
              },
            )))
      throw const FortuneReturnLocationUnavailable();
    return api.calculate(input, owner, snapshot, batch, cancel);
  }

  Future<Map<String, Object?>> archive(
    PublishedFortune report,
    Map<String, Object?> input,
    int at,
    Future<void> cancel,
  ) => compute.archiveFortuneReport(report.toJson(), input, at, cancel);
}
