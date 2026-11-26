import 'package:flutter/foundation.dart';

import '../features/synastry/requests/synastry_summary_api.dart';
import '../features/synastry/synastry.dart';
import '../shared/local_compute/local_compute.dart';
import '../shared/http/credentialed_client.dart'
    if (dart.library.js_interop) '../shared/http/credentialed_client_web.dart';
import '../shared/http/json_client.dart';
import '../shared/http/service_endpoint.dart';

const _compute = LocalCompute();

SynastryChartReader? configureSynastryChart() => _compute.isAvailable
    ? (profile, cancel) =>
          _compute.calculateManualSubjectChart(profile.toJson(), cancel: cancel)
    : null;

SynastryComparisonReader? configureSynastryComparison() => _compute.isAvailable
    ? (a, b, cancel) => _compute.compareSynastry(a, b, cancel: cancel)
    : null;

SynastrySummaryReader? configureSynastrySummary({
  String value = const String.fromEnvironment('SYNASTRY_REPORT_URL'),
  Future<String?> Function()? readNativeSession,
}) {
  final base = serviceEndpoint(value, 'SYNASTRY_REPORT_URL');
  if (base == null) return null;
  return (request, isCurrent) async {
    final api = SynastrySummaryApi(
      JsonHttpClient(
        base: base,
        client: createCredentialedClient(),
        timeout: const Duration(seconds: 130),
      ),
      readNativeSession: kIsWeb ? null : readNativeSession,
    );
    try {
      return await api.summarize(request, isCurrent: isCurrent);
    } finally {
      api.close();
    }
  };
}
