import 'package:lunar/lunar.dart';

class CastCalendar {
  const CastCalendar({
    required this.timezone,
    required this.year,
    required this.month,
    required this.day,
  });

  final String timezone;
  final String year;
  final String month;
  final String day;

  Map<String, String> toJson() => {
    'timezone': timezone,
    'year': year,
    'month': month,
    'day': day,
  };
}

CastCalendar castCalendar(DateTime instant) {
  // The casting clock is fixed to UTC+08:00 regardless of device timezone.
  final date = instant.toUtc().add(const Duration(hours: 8));
  final lunar = Solar.fromYmdHms(
    date.year,
    date.month,
    date.day,
    date.hour,
    date.minute,
    date.second,
  ).getLunar();
  return CastCalendar(
    timezone: 'Asia/Shanghai',
    year: lunar.getYearInGanZhiExact(),
    month: lunar.getMonthInGanZhiExact(),
    day: lunar.getDayInGanZhiExact(),
  );
}
