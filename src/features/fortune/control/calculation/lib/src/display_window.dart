import 'package:jovian_civil_time/jovian_civil_time.dart';
import 'package:jovian_fortune_model/jovian_fortune_model.dart';

const periodPolicyVersion = 'fortune-iana-civil-v1';
const _hour = Duration.millisecondsPerHour;
const _day = Duration.millisecondsPerDay;

Future<int Function(int)> fortuneDisplayClock(String timeZone) {
  if (timeZone.isEmpty ||
      timeZone.startsWith('+') ||
      timeZone.startsWith('-')) {
    throw FormatException('Expected an IANA display time zone: $timeZone');
  }
  return civilClock(timeZone);
}

DisplayWindow buildDisplayWindow(
  int asOf,
  FortunePeriod period,
  int Function(int) wallClock, {
  int weekStartsOn = 1,
}) {
  if (weekStartsOn < 0 || weekStartsOn > 6) {
    throw RangeError.range(weekStartsOn, 0, 6, 'weekStartsOn');
  }
  final date = DateTime.fromMillisecondsSinceEpoch(
    wallClock(asOf),
    isUtc: true,
  );
  final today = DateTime.utc(
    date.year,
    date.month,
    date.day,
  ).millisecondsSinceEpoch;
  final weekStart = today - ((date.weekday - weekStartsOn) % 7) * _day;
  int midnight(int year, [int month = 1]) =>
      DateTime.utc(year, month).millisecondsSinceEpoch;
  final (start, end) = switch (period) {
    FortunePeriod.day => (today, today + _day),
    FortunePeriod.week => (weekStart, weekStart + 7 * _day),
    FortunePeriod.month => (
      midnight(date.year, date.month),
      midnight(date.year, date.month + 1),
    ),
    FortunePeriod.year => (midnight(date.year), midnight(date.year + 1)),
  };
  return DisplayWindow(
    _startOfCivilDay(wallClock, start),
    _startOfCivilDay(wallClock, end),
  );
}

int _startOfCivilDay(int Function(int) wallClock, int midnight) {
  int? earliest;
  for (var hour = -36; hour <= 36; hour += 6) {
    final sample = midnight + hour * _hour;
    final candidate = midnight - (wallClock(sample) - sample);
    if (wallClock(candidate) == midnight &&
        (earliest == null || candidate < earliest)) {
      earliest = candidate;
    }
  }
  if (earliest != null) return earliest;

  // A jump at midnight can skip the requested local time or the entire date.
  var low = (midnight - 36 * _hour) ~/ 1000;
  var high = (midnight + 36 * _hour) ~/ 1000;
  while (high - low > 1) {
    final middle = low + (high - low) ~/ 2;
    if (wallClock(middle * 1000) < midnight) {
      low = middle;
    } else {
      high = middle;
    }
  }
  return high * 1000;
}
