import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:jovian_destiny/jovian_destiny.dart'
    show BirthPlace, BirthProfile;

import '../features/destiny/destiny.dart';
import '../features/destiny/requests/destiny_report_api.dart';
import '../shared/local_compute/local_compute.dart';
import '../shared/http/credentialed_client.dart'
    if (dart.library.js_interop) '../shared/http/credentialed_client_web.dart';
import '../shared/http/json_client.dart';
import '../shared/http/service_endpoint.dart';

Future<List<BirthPlace>> loadBirthPlaces() async {
  final data = await rootBundle.loadString(
    'src/features/destiny/assets/birth_places.json',
  );
  return List.unmodifiable(
    (jsonDecode(data) as List<Object?>).map(
      (entry) => BirthPlace.fromJson(entry as Map<String, Object?>),
    ),
  );
}

Future<DestinyReading> calculateDestinyReading(
  BirthProfile profile,
  Future<void> cancel,
  void Function(String) progress,
) async {
  try {
    return DestinyReading.fromLegacy(
      await const LocalCompute().calculateDestiny(
        profile.toJson(),
        cancel: cancel,
        onProgress: progress,
      ),
    );
  } on LocalComputeException catch (error) {
    throw FormatException(error.message);
  }
}

Future<String> Function(Map<String, Object?>, Future<void>)?
configureDestinyReport({
  String value = ServiceEnvironment.destiny,
  Future<String?> Function()? readNativeSession,
}) {
  final base = serviceEndpoint(value, 'DESTINY_REPORT_URL');
  if (base == null) return null;
  return (body, cancel) async {
    final client = createCredentialedClient();
    try {
      return await DestinyReportApi(
        JsonHttpClient(base: base, client: client),
        readNativeSession: kIsWeb ? null : readNativeSession,
      ).read(body, cancel: cancel);
    } finally {
      client.close();
    }
  };
}
