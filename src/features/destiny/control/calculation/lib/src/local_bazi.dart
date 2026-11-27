import 'package:jovian_destiny_model/jovian_destiny_model.dart';

import 'bazi.dart';
import 'birth_clock.dart';

class LocalBaZi {
  const LocalBaZi({
    required this.pillars,
    required this.sampleCount,
    required this.exactChart,
  });

  final Map<Pillar, List<String>> pillars;
  final int sampleCount;
  final Map<String, Object?>? exactChart;
}

Future<LocalBaZi> calculateLocalBaZi(BirthProfile profile) async {
  final zone = profile.place.timeZone;
  final instants = await birthInstants(profile.date, profile.time, zone);
  final wallClock = await localClock(zone);
  final known = profile.time.timeKnown;
  final candidates = {for (final p in Pillar.values) p: <String>{}};
  Map<String, Object?>? exact;
  for (final instant in instants) {
    final chart = calculateBaZi(
      instant,
      wallClock(instant),
      known ? profile.gender : null,
    );
    if (known) exact = chart;
    for (final MapEntry(:key, :value) in candidates.entries) {
      value.add(chart[key.name] as String);
    }
  }
  return LocalBaZi(
    pillars: {
      for (final MapEntry(:key, :value) in candidates.entries)
        key: List.unmodifiable(value),
    },
    sampleCount: instants.length,
    exactChart: exact,
  );
}
