import 'package:flutter/foundation.dart';
import 'package:jovian_divination/jovian_divination.dart';

import '../features/divination/requests/reading_gateway.dart';
import '../features/divination/requests/reading_recovery.dart'
    if (dart.library.js_interop) '../features/divination/requests/reading_recovery_web.dart';
import '../shared/http/credentialed_client.dart'
    if (dart.library.js_interop) '../shared/http/credentialed_client_web.dart';
import '../shared/http/json_client.dart';
import '../shared/http/service_endpoint.dart';

OnlineGuideController? configureOnlineGuide({
  String value = const String.fromEnvironment('DIVINATION_REPORT_URL'),
  Future<String?> Function()? readNativeSession,
  GuideRecoveryStore? nativeRecovery,
  String? ownerScope,
}) {
  final base = serviceEndpoint(value, 'DIVINATION_REPORT_URL');
  if (base == null) return null;
  final client = createCredentialedClient();
  final api = HttpGuideGateway(
    JsonHttpClient(base: base, client: client),
    readNativeSession: kIsWeb ? null : readNativeSession,
  );
  return OnlineGuideController(
    api,
    kIsWeb
        ? createReadingRecovery(base, ownerScope: ownerScope)
        : nativeRecovery ?? createReadingRecovery(base, ownerScope: ownerScope),
    onDispose: client.close,
  );
}
