import '../lib/jovian_divination.dart';

void main() {
  final automatic = GuideRitual(
    question: '面试后续会怎样？',
    focus: '面试后续',
    automatic: true,
    automaticStartedAt: DateTime.utc(2026, 11, 26),
    now: () => DateTime.utc(2026, 11, 26),
    random: () => 0.25,
  ).snapshot.toChartSnapshotJson();
  final old = parseGuideSnapshot(automatic);
  if (old.tarotCutIndex != null)
    throw StateError('An old snapshot has a cut point.');
  for (final index in [36, 39, 42]) {
    final read = parseGuideSnapshot({...automatic, 'tarotCutIndex': index});
    if (read.tarotCutIndex != index ||
        read.toChartSnapshotJson()['tarotCutIndex'] != index ||
        read.chart?.chartHash != old.chart?.chartHash) {
      throw StateError('The cut point changed the original reading.');
    }
  }
  for (final index in [null, 35, 43, 39.5, '39']) {
    _reject({...automatic, 'tarotCutIndex': index});
  }
  final casting = GuideRitual(
    question: '面试后续会怎样？',
    focus: '面试后续',
  ).snapshot.toChartSnapshotJson();
  _reject({...casting, 'tarotCutIndex': 39});
  print(
    'Reading snapshots accept the optional legacy Tarot cut point without changing chart hashes.',
  );
}

void _reject(Map<String, Object?> value) {
  try {
    parseGuideSnapshot(value);
  } on FormatException {
    return;
  }
  throw StateError('An invalid cut point was accepted.');
}
