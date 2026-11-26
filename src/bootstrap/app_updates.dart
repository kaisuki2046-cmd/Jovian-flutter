import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;

import '../features/account/account.dart'
    show AppUpdateController, AndroidAppVersion, AndroidRelease;
import '../shared/http/json_client.dart';
import '../shared/http/service_endpoint.dart' show ServiceEnvironment;

const _platform = MethodChannel('jovian/app_updates');

AppUpdateController? configureAppUpdates({
  String endpoint = ServiceEnvironment.appUpdates,
  String downloadOrigin = ServiceEnvironment.androidDownloadOrigin,
}) {
  if (kIsWeb || defaultTargetPlatform != TargetPlatform.android) return null;
  final base = Uri.tryParse(endpoint.trim());
  final origin = AndroidRelease.trustedDownloadOrigin(downloadOrigin);
  final client = _validApi(base) && origin != null ? http.Client() : null;
  final latest = client == null
      ? null
      : JsonHttpClient(
          base: base!,
          client: client,
          timeout: const Duration(seconds: 5),
        );
  return AppUpdateController(
    readInstalled: () async => AndroidAppVersion.fromJson(
      await _platform.invokeMapMethod<Object?, Object?>('installedVersion'),
    ),
    readLatest: latest == null
        ? null
        : () async => AndroidRelease.fromResponse(
            await latest.request(['app-updates', 'android', 'latest']),
            origin!,
          ),
    openDownload: (url) async =>
        await _platform.invokeMethod<bool>('openDownload', url.toString()) ??
        false,
    close: client?.close,
  );
}

bool _validApi(Uri? url) =>
    url != null &&
    url.host.isNotEmpty &&
    !url.authority.contains('@') &&
    !url.hasQuery &&
    !url.hasFragment &&
    (url.scheme == 'https' ||
        (url.scheme == 'http' &&
            const {
              '127.0.0.1',
              'localhost',
              '10.0.2.2',
              '::1',
            }.contains(url.host)));
