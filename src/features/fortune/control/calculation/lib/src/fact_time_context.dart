import 'package:jovian_fortune_model/jovian_fortune_model.dart';

import 'display_window.dart';

enum FortuneClockSource { server, preview, client }

class FortuneFactTime {
  const FortuneFactTime({
    required this.period,
    required this.source,
    required this.asOf,
    required this.referenceAt,
    required this.timeZone,
    required this.weekStartsOn,
    required this.window,
    required this.localStart,
    required this.localEndExclusive,
  });

  final FortunePeriod period;
  final FortuneClockSource source;
  final int asOf;
  final int referenceAt;
  final String timeZone;
  final int weekStartsOn;
  final DisplayWindow window;
  final String localStart;
  final String localEndExclusive;

  Map<String, Object?> toJson() => {
    'clockSource': source.name,
    'asOfUtc': fortuneIsoUtc(asOf),
    if (source == FortuneClockSource.server)
      'serverAsOfUtc': fortuneIsoUtc(asOf),
    'referenceAt': referenceAt,
    'displayTimezone': timeZone,
    'weekStartsOn': weekStartsOn,
    'window': window.toJson(),
    'policy': periodPolicyVersion,
    'displayWindow': {
      'periodType': period.name,
      'localStart': localStart,
      'localEndExclusive': localEndExclusive,
      'timezone': timeZone,
      'instantRange': {
        'startInstant': fortuneIsoUtc(window.start),
        'endInstantExclusive': fortuneIsoUtc(window.end),
      },
    },
  };
}

FortuneFactTime buildFactTimeContext(
  FortunePeriod period,
  int asOf,
  String timeZone,
  int Function(int) wallClock, {
  FortuneClockSource source = FortuneClockSource.preview,
  int weekStartsOn = 1,
  Map<String, Object?>? target,
}) {
  String dateAt(int instant) =>
      fortuneIsoUtc(wallClock(instant)).substring(0, 10);
  var anchor = asOf;
  if (target != null) {
    final date = _targetDate(period, target);
    if (!RegExp(r'^(19|20)\d\d-\d\d-\d\d$').hasMatch(date)) {
      throw const FormatException('Invalid civil date.');
    }
    final midday = DateTime.tryParse(
      '${date}T12:00:00Z',
    )?.millisecondsSinceEpoch;
    if (midday == null || fortuneIsoUtc(midday).substring(0, 10) != date) {
      throw const FormatException('Invalid civil date.');
    }
    const day = Duration.millisecondsPerDay;
    final match = [
      midday,
      midday - day,
      midday + day,
    ].where((instant) => dateAt(instant) == date).firstOrNull;
    if (match == null)
      throw const FormatException('Requested local date does not exist.');
    anchor = match;
    if (period == FortunePeriod.week &&
        dateAt(
              buildDisplayWindow(
                anchor,
                period,
                wallClock,
                weekStartsOn: weekStartsOn,
              ).start,
            ) !=
            date) {
      throw const FormatException(
        'Requested date is not the configured week start.',
      );
    }
  }
  final window = buildDisplayWindow(
    anchor,
    period,
    wallClock,
    weekStartsOn: weekStartsOn,
  );
  return FortuneFactTime(
    period: period,
    source: source,
    asOf: asOf,
    referenceAt: asOf >= window.start && asOf < window.end
        ? asOf
        : window.start,
    timeZone: timeZone,
    weekStartsOn: weekStartsOn,
    window: window,
    localStart: dateAt(window.start),
    localEndExclusive: dateAt(window.end),
  );
}

String _targetDate(FortunePeriod period, Map<String, Object?> target) {
  final keys = switch (period) {
    FortunePeriod.day => const ['date'],
    FortunePeriod.week => const ['weekStartDate'],
    FortunePeriod.month => const ['year', 'month'],
    FortunePeriod.year => const ['year'],
  };
  if (target.length != keys.length || !keys.every(target.containsKey)) {
    throw const FormatException('Target fields do not match the period.');
  }
  if (period == FortunePeriod.day || period == FortunePeriod.week) {
    final date = target[keys.single];
    if (date is! String) throw const FormatException('Invalid civil date.');
    return date;
  }
  final year = target['year'];
  final month = period == FortunePeriod.month ? target['month'] : 1;
  if (year is! int ||
      year < 1900 ||
      year > 2099 ||
      month is! int ||
      month < 1 ||
      month > 12) {
    throw const FormatException('Invalid calendar year or month.');
  }
  return '$year-${month.toString().padLeft(2, '0')}-01';
}
