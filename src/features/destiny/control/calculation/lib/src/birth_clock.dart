import 'package:jovian_civil_time/jovian_civil_time.dart';
import 'package:jovian_destiny_model/jovian_destiny_model.dart';

const samplingVersion = 'known-time-parts-v2';
const birthClockVersion = 'gregory-iana-tzdb-v1';
const _minuteMs = Duration.millisecondsPerMinute;
const _hourMs = Duration.millisecondsPerHour;
const _sampleInterval = 30;
Future<void> initializeBirthClock({Object? flutterAssets}) =>
    initializeCivilTime(flutterAssets: flutterAssets);

Future<int Function(int)> localClock(String timeZone) async {
  try {
    return await civilClock(timeZone);
  } on FormatException {
    throw const FormatException('此设备无法读取出生地时区，请换一台支持该时区的设备。');
  }
}

Future<List<int>> birthInstants(
  BirthDate date,
  BirthTime time,
  String timeZone,
) async {
  if (!date.isValid() || !time.isValid) {
    throw const FormatException('请核对出生日期和时间。');
  }
  final wallClock = await localClock(timeZone);
  final midnight = date.utcMidnight.millisecondsSinceEpoch;
  // Probe actual offsets around the date. A gap matches zero times and a
  // repeated wall time can match two different UTC instants.
  final offsets = <int>{};
  for (var hour = -36; hour <= 36; hour += 6) {
    final instant = midnight + hour * _hourMs;
    offsets.add(wallClock(instant) - instant);
  }
  final instants = <int>[
    for (final minute in _sampleMinutes(time))
      for (final offset in offsets)
        if (wallClock(midnight + minute * _minuteMs - offset) ==
            midnight + minute * _minuteMs)
          midnight + minute * _minuteMs - offset,
  ]..sort();
  if (instants.isEmpty) {
    throw FormatException(
      time.hour != null || time.minute != null
          ? '出生地当天没有符合该输入的当地时刻，请修改时间。'
          : '出生地没有这个当地日期，请核对日期和地点。',
    );
  }
  if (time.timeKnown && instants.length != 1) {
    throw const FormatException('出生地当天发生时间回拨，该时刻出现了两次，无法仅凭填写的时分确定对应时刻。');
  }
  return instants;
}

Iterable<int> _sampleMinutes(BirthTime time) {
  final BirthTime(:hour, :minute) = time;
  if (hour != null && minute != null) return [hour * 60 + minute];
  if (hour != null) {
    final start = hour * 60;
    return [for (var step = 0; step < 60; step += 5) start + step, start + 59];
  }
  if (minute != null) return List.generate(24, (hour) => hour * 60 + minute);
  return [for (var step = 0; step < 1440; step += _sampleInterval) step, 1439];
}
