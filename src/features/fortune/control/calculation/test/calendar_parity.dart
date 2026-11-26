import 'dart:convert';
import 'dart:io';

import 'package:jovian_civil_time/jovian_civil_time.dart';
import 'package:jovian_fortune/jovian_fortune.dart';

const _legacy = r'''
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
registerHooks({ resolve(specifier, context, next) {
  if (['./period-window','./fortune-calendar','./fact-time-context','../model/interpretation'].includes(specifier)) {
    return next(specifier+'.ts', context);
  }
  return next(specifier, context);
}});
const { calculateFortuneCalendar, fortuneReferenceFields } = await import('./src/features/fortune/control/fortune-calendar.ts');
const { buildFortunePreview, readNatalDay } = await import('./src/features/fortune/control/fortune-preview.ts');
const { buildAlmanacDay } = await import('./src/features/fortune/control/almanac.ts');
const { fortuneArchiveContext } = await import('./src/features/fortune/control/report-archive.ts');
const { buildFactTimeContext } = await import('./src/features/fortune/control/fact-time-context.ts');
const [windows, dates, natalReports, targets] = JSON.parse(readFileSync(0,'utf8'));
const periods = ['day','week','month','year'];
const output = {
  windows: windows.map(([at,timeZone,weekStartsOn]) => {
    const parsed = Date.parse(at);
    return periods.map(period => ({
      preview: buildFortunePreview(parsed, period, { pillar: '丁丑', timeKnown: false }, { timeZone, weekStartsOn }),
      context: buildFactTimeContext({ periodType: period, displayTimezone: timeZone, weekStartsOn }, parsed, 'server'),
      key: fortuneArchiveContext({ periodType: period, displayTimezone: timeZone }, parsed, 'a'.repeat(64)).key,
    }));
  }),
  dates: dates.map(([date,time]) => {
    const calendar = calculateFortuneCalendar({ date, time });
    if (!calendar) return null;
    const at = calendar.windows[0].start;
    const almanac = buildAlmanacDay(at);
    delete almanac.source;
    return { calendar, fields: fortuneReferenceFields(at), almanac };
  }),
  natal: natalReports.map(readNatalDay),
  targets: targets.map(([periodType, displayTimezone, weekStartsOn,targetPeriod]) => {
    try {
      return buildFactTimeContext({ periodType, displayTimezone, weekStartsOn, targetPeriod },Date.UTC(2026,10,25),'client');
    } catch { return null; }
  }),
};
process.stdout.write(JSON.stringify(output));
''';

Future<Map<String, Object?>> _node(Object input) async {
  final process = await Process.start(
    'node',
    ['--input-type=module', '--eval', _legacy],
    workingDirectory: Platform.script
        .resolve('../../../../../../../')
        .toFilePath(),
  );
  final output = utf8.decoder.bind(process.stdout).join();
  final errors = utf8.decoder.bind(process.stderr).join();
  process.stdin.encoding = utf8;
  process.stdin.write(jsonEncode(input));
  await process.stdin.close();
  if (await process.exitCode != 0) throw StateError(await errors);
  return jsonDecode(await output) as Map<String, Object?>;
}

void _same(Object? actual, Object? expected, String name) {
  if (jsonEncode(actual) != jsonEncode(expected)) {
    throw StateError('$name differs.\nDart: $actual\nNode: $expected');
  }
}

Future<void> main() async {
  await initializeCivilTime();
  const cases = [
    ('2026-11-07T10:00:00Z', 'Asia/Shanghai', 1),
    ('2027-01-01T00:30:00Z', 'America/New_York', 0),
    ('2026-03-08T16:00:00Z', 'America/New_York', 1),
    ('2026-11-01T12:00:00Z', 'America/New_York', 6),
    ('2026-11-01T12:00:00Z', 'America/Havana', 1),
    ('2026-03-08T12:00:00Z', 'America/Havana', 1),
    ('2011-12-29T20:00:00Z', 'Pacific/Apia', 1),
    ('2026-11-11T15:00:00.999Z', 'Asia/Kathmandu', 1),
    ('2024-02-29T13:20:00Z', 'Australia/Lord_Howe', 1),
    ('1900-07-01T04:00:00Z', 'Asia/Shanghai', 1),
    ('2026-11-26T04:00:00Z', 'asia/shanghai', 1),
    ('2026-01-01T00:30:00Z', 'UTC', 3),
    ('2024-04-27T12:00:00Z', 'Africa/Cairo', 1),
  ];
  final dates = <(String, String)>[
    for (final year in [1900, 1950, 2000, 2024, 2026, 2099])
      for (final month in ['01', '02', '04', '08', '11', '12'])
        for (final time in ['00:00', '12:20', '22:59', '23:00', '23:59'])
          ('$year-$month-28', time),
    ('2024-02-29', '13:20'),
    ('2026-12-31', '23:59'),
    ('2026-02-29', '21:10'),
    ('2026-02-31', '10:00'),
    ('1899-12-31', '12:00'),
    ('2100-01-01', '00:00'),
    ('2026-01-01', '24:00'),
    (' 2026-01-01 ', ' 00:00 '),
  ];
  final natal = <(bool, List<String>, bool?, List<String?>?)>[
    (false, ['丁丑\n日主'], null, null),
    (true, ['丁丑'], false, ['甲子', '甲子']),
    (true, ['丁丑'], true, ['丁丑', '甲子']),
    (true, ['丁丑'], true, [null]),
    (true, ['丁丑'], false, []),
    (false, ['随时刻变化'], null, null),
    (false, ['甲子', '丁丑'], null, null),
  ];
  final targets = <(FortunePeriod, String, int, Map<String, Object?>)>[
    (FortunePeriod.day, 'America/New_York', 1, {'date': '2026-03-08'}),
    (
      FortunePeriod.week,
      'America/New_York',
      0,
      {'weekStartDate': '2026-03-08'},
    ),
    (
      FortunePeriod.week,
      'America/New_York',
      1,
      {'weekStartDate': '2026-03-08'},
    ),
    (FortunePeriod.day, 'Pacific/Apia', 1, {'date': '2011-12-30'}),
    (FortunePeriod.day, 'Pacific/Kiritimati', 1, {'date': '2026-04-15'}),
    (FortunePeriod.month, 'Asia/Shanghai', 1, {'year': 2024, 'month': 2}),
    (FortunePeriod.year, 'Asia/Shanghai', 1, {'year': 2026}),
    (FortunePeriod.month, 'UTC', 1, {'year': 2026, 'month': 13}),
    (FortunePeriod.day, 'UTC', 1, {'date': '2026-02-29'}),
    (FortunePeriod.year, 'UTC', 1, {'year': 2026, 'month': 1}),
  ];
  final base = await _node([
    [
      for (final (at, zone, start) in cases) [at, zone, start],
    ],
    [
      for (final (date, time) in dates) [date, time],
    ],
    [
      for (final (known, rows, snapKnown, candidates) in natal)
        {
          'timeKnown': known,
          'charts': [
            {
              'method': 'bazi',
              'rows': [
                for (final value in rows) {'label': '日柱', 'value': value},
              ],
            },
          ],
          if (candidates != null)
            'chartSnapshot': {
              'timeKnown': snapKnown,
              'bazi': {
                'rawResult': [
                  for (final day in candidates)
                    day == null ? null : {'day': day},
                ],
              },
            },
        },
    ],
    [
      for (final (period, zone, start, target) in targets)
        [period.name, zone, start, target],
    ],
  ]);
  for (final (index, (stamp, zone, start)) in cases.indexed) {
    final asOf = DateTime.parse(stamp).millisecondsSinceEpoch;
    final clock = await fortuneDisplayClock(zone);
    final expected = (base['windows'] as List)[index] as List;
    for (final period in FortunePeriod.values) {
      final row = expected[period.index] as Map;
      final preview = buildFortunePreview(
        asOf,
        period,
        clock,
        natal: const NatalDay('丁丑', false),
        weekStartsOn: start,
      );
      _same(
        preview.toJson(),
        row['preview'],
        '$stamp $zone ${period.name} preview',
      );
      final time = buildFactTimeContext(
        period,
        asOf,
        zone,
        clock,
        source: FortuneClockSource.server,
        weekStartsOn: start,
      );
      _same(time.toJson(), row['context'], '$zone ${period.name} context');
      _same(
        fortuneArchiveKey(
          'a' * 64,
          period,
          zone,
          buildDisplayWindow(asOf, period, clock),
        ),
        row['key'],
        'archive key',
      );
    }
  }
  for (final (index, (date, time)) in dates.indexed) {
    final calendar = calculateFortuneCalendar(FortuneReference(date, time));
    final expected = (base['dates'] as List)[index];
    if (calendar == null) {
      _same(null, expected, '$date $time validation');
      continue;
    }
    final at = calendar.windows.first.start;
    _same(
      {
        'calendar': calendar.toJson(),
        'fields': fortuneReferenceFields(at).toJson(),
        'almanac': buildAlmanacDay(at).toJson()..remove('source'),
      },
      expected,
      '$date $time calendar and almanac',
    );
  }
  for (final (index, (known, rows, snapKnown, candidates)) in natal.indexed) {
    final found = readNatalDay(
      timeKnown: known,
      dayRows: rows,
      snapshotPillars: candidates,
      snapshotTimeKnown: snapKnown,
    );
    _same(
      found?.toJson(),
      (base['natal'] as List)[index],
      'natal candidate $index',
    );
  }
  for (final (index, (period, zone, week, target)) in targets.indexed) {
    final clock = await fortuneDisplayClock(zone);
    Map<String, Object?>? result;
    try {
      result = buildFactTimeContext(
        period,
        DateTime.utc(2026, 11, 25).millisecondsSinceEpoch,
        zone,
        clock,
        source: FortuneClockSource.client,
        weekStartsOn: week,
        target: target,
      ).toJson();
    } on FormatException {
      result = null;
    }
    _same(result, (base['targets'] as List)[index], 'target $index');
  }
  for (final invalid in ['', '+08:00', 'Unknown/Place']) {
    try {
      await fortuneDisplayClock(invalid);
      throw StateError('Invalid timezone was accepted.');
    } on FormatException {
      continue;
    }
  }
  stdout.writeln(
    '${cases.length * 4} period previews, ${dates.length} calendar and almanac cases, ${natal.length} natal cases, and ${targets.length} target windows matched legacy output.',
  );
}
