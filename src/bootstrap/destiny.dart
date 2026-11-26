import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:jovian_destiny/jovian_destiny.dart';

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
