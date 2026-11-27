import 'dart:convert';
import 'dart:io';

import 'package:jovian_destiny/jovian_destiny.dart';

import 'legacy_oracle.dart';

const _legacy = r'''
import { readFileSync } from 'node:fs';
import { Solar } from 'lunar-javascript';
import { calculateBaZi } from './src/features/destiny/control/charts.ts';
const [instants, years] = JSON.parse(readFileSync(0,'utf8'));
const months = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '立秋', '白露', '寒露', '立冬', '大雪'];
for (const year of years) {
  const terms = Solar.fromYmd(year, 7, 1).getLunar().getJieQiTable();
  for (const name of months) {
    const start = Date.parse(terms[name].toYmdHms().replace(' ', 'T') + '+08:00');
    for (const offset of [-1000, -1, 0, 1000]) instants.push([start + offset, start + offset + 8 * 3600000]);
  }
}
const result = [];
for (const [instant, wall] of instants) {
  for (const gender of ['female', 'male', 'other']) {
    result.push([instant, wall, gender, calculateBaZi(instant, wall, gender)]);
  }
}
process.stdout.write(JSON.stringify(result));
''';

Future<void> main() async {
  const hourMs = Duration.millisecondsPerHour;
  final input = [
    for (final year in [1900, 1950, 1989, 2000, 2004, 2024])
      for (final month in [1, 2, 5, 7, 12])
        for (final hour in [0, 12, 22, 23])
          for (final offset in [-5, 5.75, 8])
            [
              DateTime.utc(year, month, 15, hour, 59).millisecondsSinceEpoch -
                  (offset * hourMs).round(),
              DateTime.utc(year, month, 15, hour, 59).millisecondsSinceEpoch,
            ],
  ];
  final cases = await runLegacyOracle(_legacy, [
    input,
    [1900, 1989, 2000, 2024, 2026],
  ]);
  for (final value in cases) {
    final [instant as int, wall as int, gender as String, expected] =
        value as List<Object?>;
    final actual = calculateBaZi(
      instant,
      wall,
      BirthGender.values.byName(gender),
    );
    if (jsonEncode(actual) != jsonEncode(expected)) {
      final date = DateTime.fromMillisecondsSinceEpoch(instant, isUtc: true);
      final mismatched = actual.keys
          .where(
            (key) =>
                jsonEncode(actual[key]) != jsonEncode((expected as Map)[key]),
          )
          .toList();
      throw StateError(
        'BaZi differs at $date ($gender): '
        '${{
          for (final key in mismatched) key: [actual[key], (expected as Map)[key]],
        }}',
      );
    }
  }
  stdout.writeln('BaZi calculation matched ${cases.length} legacy charts.');
}
