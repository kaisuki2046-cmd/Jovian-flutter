import 'dart:convert';

import 'package:jovian_fortune_model/jovian_fortune_model.dart';
import 'package:lunar/lunar.dart';

import 'calendar.dart';
import 'display_window.dart';

const _hour = Duration.millisecondsPerHour;
const _day = Duration.millisecondsPerDay;
const _stems = '甲乙丙丁戊己庚辛壬癸';
const _branches = '子丑寅卯辰巳午未申酉戌亥';

NatalDay? readNatalDay({
  required bool timeKnown,
  required List<String> dayRows,
  List<String?>? snapshotPillars,
  bool? snapshotTimeKnown,
}) {
  if (snapshotPillars != null && snapshotPillars.isNotEmpty) {
    final pillar = snapshotPillars.first;
    return pillar != null &&
            _validPillar(pillar) &&
            snapshotPillars.every((candidate) => candidate == pillar)
        ? NatalDay(pillar, snapshotTimeKnown ?? timeKnown)
        : null;
  }
  if (dayRows.length != 1) return null;
  final pillar = dayRows.single.split(RegExp(r'\r?\n')).first.trim();
  return _validPillar(pillar) ? NatalDay(pillar, timeKnown) : null;
}

bool _validPillar(String value) {
  if (value.length != 2) return false;
  final stem = _stems.indexOf(value[0]);
  final branch = _branches.indexOf(value[1]);
  return stem >= 0 && branch >= 0 && stem.isEven == branch.isEven;
}

({int time, String name}) nextSolarBoundary(int instant) {
  final boundary = lunarAtBeijing(instant).getNextJie();
  final solar = boundary.getSolar();
  final utc =
      DateTime.utc(
        solar.getYear(),
        solar.getMonth(),
        solar.getDay(),
        solar.getHour(),
        solar.getMinute(),
        solar.getSecond(),
      ).millisecondsSinceEpoch -
      beijingOffset;
  if (utc <= instant) throw StateError('Invalid solar term boundary.');
  return (time: utc, name: boundary.getName());
}

FortuneEvent _fact(
  int at,
  String reason,
  FortunePeriod period,
  NatalDay? natal,
) {
  final lunar = lunarAtBeijing(at);
  final year = lunar.getYearInGanZhiExact();
  final month = lunar.getMonthInGanZhiExact();
  final day = lunar.getDayInGanZhiExact();
  final pillar = switch (period) {
    FortunePeriod.year => year,
    FortunePeriod.month => month,
    _ => day,
  };
  return FortuneEvent(
    at: at,
    reason: reason,
    year: year,
    month: month,
    day: day,
    tenGod: natal == null
        ? null
        : LunarUtil.SHI_SHEN[natal.pillar[0] + pillar[0]],
  );
}

FortunePreview buildFortunePreview(
  int asOf,
  FortunePeriod period,
  int Function(int) wallClock, {
  NatalDay? natal,
  int weekStartsOn = 1,
}) {
  final window = buildDisplayWindow(
    asOf,
    period,
    wallClock,
    weekStartsOn: weekStartsOn,
  );
  final boundaries = {window.start: '周期起点'};
  for (
    var term = nextSolarBoundary(window.start);
    term.time < window.end;
    term = nextSolarBoundary(term.time)
  ) {
    boundaries[term.time] = '${term.name}交节';
  }
  if (period == FortunePeriod.day || period == FortunePeriod.week) {
    // Preview facts follow the natal engine's 23:00 Beijing boundary.
    const offset = beijingOffset + _hour;
    final start = window.start + offset;
    final first = start - start % _day + _day - offset;
    for (var at = first; at < window.end; at += _day) {
      final reason = boundaries[at];
      boundaries[at] = reason == null ? '换日' : '$reason · 换日';
    }
  }
  final times = boundaries.keys.toList()..sort();
  return FortunePreview(window, _fact(asOf, '参考时刻', period, natal), [
    for (final time in times) _fact(time, boundaries[time]!, period, natal),
  ]);
}

String fortuneArchiveKey(
  String snapshotId,
  FortunePeriod period,
  String zone,
  DisplayWindow window,
) => jsonEncode([snapshotId, period.name, zone, window.start]);
