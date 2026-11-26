import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:jovian_destiny/jovian_destiny.dart';

import '../features/destiny/destiny.dart';
import '../features/destiny/requests/destiny_report_api.dart';
import '../shared/browser_compute/browser_compute.dart';
import '../shared/http/credentialed_client.dart'
    if (dart.library.js_interop) '../shared/http/credentialed_client_web.dart';
import '../shared/http/json_client.dart';
import '../shared/http/service_endpoint.dart';

Future<void>? _clock;

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

Future<LocalBaZi> calculateDestinyBaZi(BirthProfile profile) async {
  await (_clock ??= initializeBirthClock(flutterAssets: rootBundle));
  return calculateLocalBaZi(profile);
}

Future<DestinyReading> Function(BirthProfile, Future<void>)?
legacyDestinyCalculation() {
  const compute = BrowserCompute();
  if (!compute.isAvailable) return null;
  return (profile, cancel) async {
    try {
      return DestinyReading.fromLegacy(
        await compute.calculateDestiny(profile.toJson(), cancel: cancel),
      );
    } on BrowserComputeException catch (error) {
      throw FormatException(error.message);
    }
  };
}

Future<String> Function(Map<String, Object?>)? configureDestinyReport({
  String value = const String.fromEnvironment('DESTINY_REPORT_URL'),
  Future<String?> Function()? readNativeSession,
}) {
  final base = serviceEndpoint(value, 'DESTINY_REPORT_URL');
  if (base == null) return null;
  return (body) async {
    final client = createCredentialedClient();
    try {
      return await DestinyReportApi(
        JsonHttpClient(base: base, client: client),
        readNativeSession: kIsWeb ? null : readNativeSession,
      ).read(body);
    } finally {
      client.close();
    }
  };
}
