import 'package:time_machine2/time_machine2.dart' as tz;

Future<void>? _ready;

Future<void> initializeCivilTime({Object? flutterAssets}) =>
    _ready ??= tz.TimeMachine.initialize({
      'timeZone': 'UTC',
      'culture': 'en-US',
      if (flutterAssets != null) 'rootBundle': flutterAssets,
    }).then<void>((_) {});

Future<int Function(int)> civilClock(String zone) async {
  final ready = _ready;
  if (ready != null) await ready;
  final provider = await tz.DateTimeZoneProviders.tzdb;
  var location = await provider.getZoneOrNull(zone);
  if (location == null) {
    final lower = zone.toLowerCase();
    final canonical = provider.ids
        .where((id) => id.toLowerCase() == lower)
        .firstOrNull;
    if (canonical != null) location = await provider.getZoneOrNull(canonical);
  }
  if (location == null) throw FormatException('Invalid IANA time zone: $zone');
  final timeZone = location;
  return (int instant) {
    final seconds = instant - instant % Duration.millisecondsPerSecond;
    final offset = timeZone.getUtcOffset(
      tz.Instant.fromEpochMilliseconds(instant),
    );
    return seconds + offset.inMilliseconds;
  };
}
