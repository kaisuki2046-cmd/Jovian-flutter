import 'package:jovian_json/jovian_json.dart';
import 'package:timezone/data/latest_all.dart' as tz_data;
import 'package:timezone/timezone.dart' as tz;

import 'chart_snapshot.dart';

const reportBodyLimit = 16 * 1024 * 1024;
const _reportTextLimit = 100000;
const _sectionLimit = 20000;
const reportDetailLimit = 10000;
const readingKinds = ['fortune', 'synastry'];
const chartMethods = ['bazi', 'ziwei', 'western'];
final _id = RegExp(r'^[a-f0-9]{64}$');

bool validArchiveId(Object? value) => value is String && _id.hasMatch(value);
bool validText(Object? value, [int limit = 120]) =>
    value is String && value.trim().isNotEmpty && value.length <= limit;

bool archiveTimestamp(Object? value) =>
    value is String && DateTime.tryParse(value)?.toIso8601String() == value;

final _locations = _loadLocations();
Map<String, tz.Location> _loadLocations() {
  tz_data.initializeTimeZones();
  return {
    for (final location in tz.timeZoneDatabase.locations.entries)
      location.key.toLowerCase(): location.value,
  };
}

final _offsetZone = RegExp(r'^[+-](?:[01][0-9]|2[0-3])(?::?[0-5][0-9])?$');
bool validTimeZone(String name) =>
    _locations.containsKey(name.toLowerCase()) || _offsetZone.hasMatch(name);

bool _safeInteger(Object? value) =>
    value is num &&
    value.isFinite &&
    value.abs() <= 9007199254740991 &&
    value == value.truncate();

Map<String, Object?>? parseReadingArchive(Object? input) {
  if (input is! Map<String, Object?> ||
      input['version'] != 1 ||
      !readingKinds.contains(input['kind']) ||
      !validText(input['title'], 240) ||
      !validText(input['contextKey'], 512) ||
      !archiveTimestamp(input['calculatedAt']))
    return null;
  final fortune = input['kind'] == 'fortune';
  final keys = fortune
      ? const ['overall', 'wealth', 'romance']
      : const ['family', 'friendship', 'romance', 'collaboration'];
  final values = input['sections'];
  if (values is! List || values.length != keys.length) return null;
  final sections = <Map<String, Object?>>[];
  var size = 0;
  for (final (index, value) in values.indexed) {
    if (value is! Map ||
        value['id'] != keys[index] ||
        !validText(value['title'], 240) ||
        !validText(value['body'], _sectionLimit))
      return null;
    final body = value['body'] as String;
    size += body.length;
    sections.add({'id': value['id'], 'title': value['title'], 'body': body});
  }
  if (size > _reportTextLimit) return null;
  final context = <String, Object?>{};
  if (fortune) {
    final value = input['context'];
    if (value is! Map ||
        !validArchiveId(value['snapshotId']) ||
        !validArchiveId(value['reportId']) ||
        !validArchiveId(value['calculationRunId']) ||
        !const ['day', 'week', 'month', 'year'].contains(value['periodType']) ||
        !validText(value['displayTimezone']) ||
        !validTimeZone(value['displayTimezone'] as String) ||
        !_safeInteger(value['windowStart']) ||
        !_safeInteger(value['windowEnd']) ||
        (value['windowEnd'] as num) <= (value['windowStart'] as num))
      return null;
    for (final key in [
      'snapshotId',
      'reportId',
      'calculationRunId',
      'periodType',
      'displayTimezone',
      'windowStart',
      'windowEnd',
    ]) {
      context[key] = value[key];
    }
  }
  return {
    'version': 1,
    'kind': input['kind'],
    'title': input['title'],
    'contextKey': input['contextKey'],
    'calculatedAt': input['calculatedAt'],
    'sections': sections,
    'context': context,
  };
}

Map<String, Object?>? parseDestinyArchive(
  Object? input, {
  bool storedLegacy = false,
}) {
  const oldSectionCount = 4;
  const overviewWithLegacy =
      _reportTextLimit +
      oldSectionCount * (240 + 3 + 3 * (_sectionLimit + 2) + 2);
  final limit = storedLegacy ? overviewWithLegacy : _reportTextLimit;
  if (input is! Map<String, Object?> ||
      input['version'] != 1 ||
      !archiveTimestamp(input['calculatedAt']) ||
      (input['calculatedAt'] as String).length != 24 ||
      input['timeKnown'] is! bool ||
      !const ['local', 'hybrid', 'deepseek'].contains(input['mode']) ||
      !validText(input['overview'], limit))
    return null;
  final overview = [input['overview'] as String];
  if (input.containsKey('sections')) {
    final sections = input['sections'];
    if (sections is! List || sections.length > oldSectionCount) return null;
    for (final item in sections) {
      if (item is! Map ||
          !validText(item['title'], 240) ||
          !validText(item['angle'], reportDetailLimit) ||
          item['uncertain'] is! bool)
        return null;
      final paragraphs = item['paragraphs'];
      final evidence = item['evidence'];
      if (paragraphs is! List ||
          paragraphs.length != 3 ||
          !paragraphs.every((value) => validText(value, _sectionLimit)) ||
          evidence is! List ||
          evidence.length > 3 ||
          !evidence.every((value) => validText(value, reportDetailLimit)))
        return null;
      overview.addAll(['## ${item['title']}', ...paragraphs.cast<String>()]);
    }
  }
  final body = overview.join('\n\n');
  if (body.length > limit) return null;
  final rawCharts = input['charts'];
  if (rawCharts is! List || rawCharts.length != chartMethods.length)
    return null;
  final charts = <Map<String, Object?>>[];
  for (final (index, chart) in rawCharts.indexed) {
    if (chart is! Map ||
        chart['method'] != chartMethods[index] ||
        !validText(chart['engine']) ||
        (chart.containsKey('note') &&
            !validText(chart['note'], reportDetailLimit)))
      return null;
    final rawRows = chart['rows'];
    if (rawRows is! List || rawRows.length > 64) return null;
    final rows = <Map<String, Object?>>[];
    for (final row in rawRows) {
      if (row is! Map ||
          !validText(row['label'], 240) ||
          !validText(row['value'], reportDetailLimit))
        return null;
      rows.add({'label': row['label'], 'value': row['value']});
    }
    charts.add({
      'method': chart['method'],
      'engine': chart['engine'],
      if (chart.containsKey('note')) 'note': chart['note'],
      'rows': rows,
    });
  }
  final timeKnown = input['timeKnown'] as bool;
  final snapshot = parseChartSnapshot(input['chartSnapshot'], timeKnown);
  if (input.containsKey('chartSnapshot') && snapshot == null) return null;
  return {
    'version': 1,
    'calculatedAt': input['calculatedAt'],
    'timeKnown': timeKnown,
    'mode': input['mode'],
    'overview': body,
    'charts': charts,
    if (snapshot != null) 'chartSnapshot': snapshot,
  };
}

String archiveJson(Object? value) => legacyJson(value);
