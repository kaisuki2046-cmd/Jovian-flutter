import 'package:flutter/foundation.dart';

import '../features/account/account.dart';
import '../shared/http/credentialed_client.dart'
    if (dart.library.js_interop) '../shared/http/credentialed_client_web.dart';
import '../shared/http/json_client.dart';
import '../shared/http/service_endpoint.dart';

AccountController? configureAccount({
  String value = const String.fromEnvironment('ACCOUNT_API_URL'),
}) {
  final base = serviceEndpoint(value, 'ACCOUNT_API_URL');
  if (base == null) return null;
  final account = AccountApi(
    JsonHttpClient(
      base: base,
      client: createCredentialedClient(),
      timeout: const Duration(seconds: 20),
    ),
    nativeSession: kIsWeb
        ? null
        : SecureNativeSession('jovian.account.v1.$base'),
  );
  return AccountController(account, AgreementsApi(account));
}
