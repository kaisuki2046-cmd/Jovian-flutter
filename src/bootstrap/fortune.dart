import 'package:flutter/services.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:http/http.dart' as http;
import 'package:jovian_civil_time/jovian_civil_time.dart';
import 'package:jovian_fortune/jovian_fortune.dart';

import '../features/fortune/requests/fortune_time_api.dart';
import '../shared/http/json_client.dart';
import '../shared/http/service_endpoint.dart';

Future<DateTime> Function()? configureFortuneTime({
  String value = const String.fromEnvironment('FORTUNE_TIME_URL'),
}) {
  final base = serviceEndpoint(value, 'FORTUNE_TIME_URL');
  if (base == null) return null;
  return () async {
    final client = http.Client();
    try {
      return await FortuneTimeApi(
        JsonHttpClient(
          base: base,
          client: client,
          timeout: const Duration(seconds: 3),
        ),
      ).read();
    } finally {
      client.close();
    }
  };
}

Future<({String zone, int Function(int) clock})> loadFortuneDisplay() async {
  await initializeCivilTime(flutterAssets: rootBundle);
  var zone = 'UTC';
  try {
    final local = await FlutterTimezone.getLocalTimezone();
    if (local.identifier.isNotEmpty) zone = local.identifier;
  } on MissingPluginException {
    // Some development runners do not supply a device time-zone channel.
  } on PlatformException {
    // A failed lookup uses the same UTC fallback as an unresolved zone.
  }
  try {
    return (zone: zone, clock: await fortuneDisplayClock(zone));
  } on FormatException {
    return (zone: 'UTC', clock: await fortuneDisplayClock('UTC'));
  }
}
