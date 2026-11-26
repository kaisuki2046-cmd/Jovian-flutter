import 'dart:convert';
import 'dart:io';

import 'package:jovian_destiny/jovian_destiny.dart';

import 'legacy_oracle.dart';

const _legacyProgram = r'''
import { readFileSync } from 'node:fs';
import { birthInstants } from './src/features/destiny/control/birth-clock.ts';
const cases = JSON.parse(readFileSync(0, 'utf8'));
const results = cases.map(([year, month, day, hour, minute, zone]) => {
  try {
    return birthInstants({year, month, day}, {
      hour, minute, timeKnown: hour !== null && minute !== null
    }, zone);
  } catch (error) {
    return error.message;
  }
});
process.stdout.write(JSON.stringify(results));
''';

Future<void> main() async {
  await initializeBirthClock();
  final cases = <(BirthDate, BirthTime, String)>[
    for (final (date, zone) in [
      (const BirthDate(2024, 3, 10), 'America/New_York'),
      (const BirthDate(2024, 11, 3), 'America/New_York'),
      (const BirthDate(2024, 3, 31), 'Europe/London'),
      (const BirthDate(2024, 10, 27), 'Europe/London'),
      (const BirthDate(2024, 4, 7), 'Australia/Lord_Howe'),
      (const BirthDate(2024, 10, 6), 'Australia/Lord_Howe'),
      (const BirthDate(2011, 12, 30), 'Pacific/Apia'),
      (const BirthDate(1990, 7, 1), 'Asia/Shanghai'),
      (const BirthDate(1985, 7, 1), 'Asia/Shanghai'),
      (const BirthDate(1900, 7, 1), 'Asia/Shanghai'),
      (const BirthDate(1900, 7, 1), 'Europe/Paris'),
      (const BirthDate(2023, 8, 16), 'Asia/Kathmandu'),
      (const BirthDate(2000, 2, 29), 'Etc/UTC'),
      (const BirthDate(2000, 2, 29), 'Unsupported/Zone'),
    ])
      for (final time in const [
        BirthTime(),
        BirthTime(hour: 1),
        BirthTime(hour: 2),
        BirthTime(minute: 27),
        BirthTime(hour: 0, minute: 0),
        BirthTime(hour: 1, minute: 15),
        BirthTime(hour: 1, minute: 30),
        BirthTime(hour: 2, minute: 15),
        BirthTime(hour: 2, minute: 30),
        BirthTime(hour: 12, minute: 0),
        BirthTime(hour: 23, minute: 59),
      ])
        (date, time, zone),
  ];
  final legacy = await runLegacyOracle(_legacyProgram, [
    for (final (date, time, zone) in cases)
      [date.year, date.month, date.day, time.hour, time.minute, zone],
  ]);
  for (final (index, (date, time, zone)) in cases.indexed) {
    final Object result;
    try {
      result = await birthInstants(date, time, zone);
    } on FormatException catch (error) {
      if (legacy[index] == error.message) continue;
      throw StateError(
        'Case $index $zone: ${error.message} vs. ${legacy[index]}',
      );
    }
    if (jsonEncode(result) != jsonEncode(legacy[index])) {
      throw StateError('Case $index $zone: $result vs. ${legacy[index]}');
    }
  }
  final cutoff = DateTime.utc(2024, 3, 1);
  if (const BirthDate(1900, 2, 29).isValid(today: cutoff) ||
      !const BirthDate(2024, 2, 29).isValid(today: cutoff) ||
      const BirthDate(2024, 3, 2).isValid(today: cutoff) ||
      const BirthTime(hour: 24).isValid ||
      const BirthTime(minute: 60).isValid) {
    throw StateError('Date or time input validation failed.');
  }
  stdout.writeln('Birth clock matched ${cases.length} legacy cases.');
}
