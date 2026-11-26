import 'package:jovian_fortune_model/jovian_fortune_model.dart';
import 'package:lunar/lunar.dart';

const _minute = Duration.millisecondsPerMinute;
const _hour = Duration.millisecondsPerHour;
const _day = Duration.millisecondsPerDay;
const beijingOffset = 8 * _hour;
final _datePattern = RegExp(r'^(\d{4})-(\d{2})-(\d{2})$');
final _timePattern = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$');

FortuneReference fortuneReferenceFields(int instant) {
  final value = DateTime.fromMillisecondsSinceEpoch(
    instant + beijingOffset,
    isUtc: true,
  ).toIso8601String();
  return FortuneReference(value.substring(0, 10), value.substring(11, 16));
}

Lunar lunarAtBeijing(int instant) => lunarAtCivilClock(instant + beijingOffset);

Lunar lunarAtCivilClock(int wallTime) {
  final local = DateTime.fromMillisecondsSinceEpoch(wallTime, isUtc: true);
  return Solar.fromYmdHms(
    local.year,
    local.month,
    local.day,
    local.hour,
    local.minute,
    local.second,
  ).getLunar();
}

Map<String, String> _pillars(int instant) {
  final lunar = lunarAtBeijing(instant);
  return {
    'year': lunar.getYearInGanZhiExact(),
    'month': lunar.getMonthInGanZhiExact(),
    // The explicit calendar query uses the midnight day-pillar convention.
    'day': lunar.getDayInGanZhiExact2(),
    'hour': lunar.getTimeInGanZhi(),
  };
}

FortuneCalendar? calculateFortuneCalendar(FortuneReference fields) {
  final date = _datePattern.firstMatch(fields.date.trim());
  final time = _timePattern.firstMatch(fields.time.trim());
  if (date == null || time == null) return null;
  final year = int.parse(date[1]!);
  final month = int.parse(date[2]!);
  final day = int.parse(date[3]!);
  final hour = int.parse(time[1]!);
  final minute = int.parse(time[2]!);
  if (year < 1900 ||
      year > 2099 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31)
    return null;
  final civil = DateTime.utc(year, month, day);
  if (civil.day != day) return null;
  final dayStart = civil.millisecondsSinceEpoch - beijingOffset;
  final monday = dayStart - (civil.weekday - 1) * _day;
  final referenceAt = dayStart + hour * _hour + minute * _minute;
  final actionAt = dayStart + (hour + 1) * _hour;
  int midnight(int y, [int m = 1]) =>
      DateTime.utc(y, m).millisecondsSinceEpoch - beijingOffset;
  return FortuneCalendar(_pillars(referenceAt), _pillars(actionAt), [
    FortuneWindow('year', midnight(year), referenceAt, midnight(year + 1)),
    FortuneWindow(
      'month',
      midnight(year, month),
      referenceAt,
      midnight(year, month + 1),
    ),
    FortuneWindow('week', monday, referenceAt, monday + 7 * _day),
    FortuneWindow('day', dayStart, referenceAt, dayStart + _day),
    FortuneWindow('hour', actionAt, actionAt, actionAt + _hour),
  ]);
}
