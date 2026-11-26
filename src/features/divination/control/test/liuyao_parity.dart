import 'dart:io';

import '../lib/jovian_divination.dart';
import 'parity_support.dart';

const _legacyProgram = r'''
import { readFileSync } from 'node:fs';
import { Solar } from 'lunar-javascript';
import { castCalendar } from './src/features/divination/control/cast-calendar.mjs';
import { readJingfang } from './src/features/divination/control/liuyao.mjs';

const [tosses, dates, termYears] = JSON.parse(readFileSync(0, 'utf8'));
const start = Date.parse('2000-01-07T00:00:00+08:00');
const charts = tosses.map((coins, index) => {
  const calendar = castCalendar(start + index % 60 * 86_400_000);
  return readJingfang(coins, calendar);
});
const terms = ['小寒', '立春', '惊蛰', '清明', '立夏', '芒种', '小暑', '立秋', '白露', '寒露', '立冬', '大雪'];
for (const year of termYears) {
  const table = Solar.fromYmd(year, 7, 1).getLunar().getJieQiTable();
  for (const term of terms) {
    const solar = table[term];
    const epoch = Date.parse(solar.toYmdHms().replace(' ', 'T') + '+08:00');
    for (const offset of [-1000, -1, 0, 1000]) dates.push(epoch + offset);
  }
}
process.stdout.write(JSON.stringify([charts, dates.map(epoch => [epoch, castCalendar(epoch)])]));
''';

Future<void> main() async {
  const coins = [
    [2, 2, 2],
    [3, 2, 2],
    [2, 3, 3],
    [3, 3, 3],
  ];
  final tossCases = List.generate(
    4096,
    (pattern) => List.generate(6, (line) => coins[pattern >> (line * 2) & 3]),
  );
  final dates = [
    for (final year in [1900, 1970, 2000, 2024, 2026, 2027, 2100])
      for (var month = 1; month <= 12; month++)
        DateTime.utc(year, month, 15, 12).millisecondsSinceEpoch,
    for (final instant in [
      '2000-01-07T22:59:59.999+08:00',
      '2000-01-07T23:00:00.000+08:00',
      '2026-11-26T22:59:59.999+08:00',
      '2026-11-26T23:00:00.000+08:00',
      '2026-12-31T23:59:59.999+08:00',
      '2027-01-01T00:00:00.000+08:00',
    ])
      DateTime.parse(instant).millisecondsSinceEpoch,
  ];

  final [charts as List, calendars as List] = await runLegacyOracle(
    _legacyProgram,
    [
      tossCases,
      dates,
      [2000, 2026, 2027],
    ],
  );
  if (charts.length != tossCases.length ||
      calendars.length != dates.length + 144) {
    throw StateError('Unexpected number of results from the legacy oracle.');
  }
  final start = DateTime.parse('2000-01-07T00:00:00+08:00');
  for (var index = 0; index < charts.length; index++) {
    final date = start.add(Duration(days: index % 60));
    final actual = readJingfang(tossCases[index], castCalendar(date)).toJson();
    if (!deepEquals(actual, charts[index])) {
      throw StateError(
        'Chart mismatch for ${tossCases[index]} at $date\n'
        'Expected: ${charts[index]}\nActual: $actual',
      );
    }
  }
  for (final [epoch as int, expected] in calendars) {
    final instant = DateTime.fromMillisecondsSinceEpoch(epoch, isUtc: true);
    final actual = castCalendar(instant).toJson();
    if (!deepEquals(actual, expected)) {
      throw StateError(
        'Calendar mismatch for $instant\n'
        'Expected: $expected\nActual: $actual',
      );
    }
  }

  expectRejected(() => readLiuYao(tossCases.first.take(5).toList()));
  expectRejected(
    () => readLiuYao([
      ...tossCases.first.take(5),
      [2, 2, 4],
    ]),
  );
  expectRejected(
    () => readJingfang(
      tossCases.first,
      const CastCalendar(
        timezone: 'Asia/Shanghai',
        year: '庚辰',
        month: '己卯',
        day: '甲丑',
      ),
    ),
  );
  stdout.writeln(
    '${charts.length} charts and ${calendars.length} calendars match the legacy implementation.',
  );
}
