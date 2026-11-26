import 'archive_model.dart';

const pillarPositions = ['year', 'month', 'day', 'hour'];
const westernPlanets = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
];
const _stems = '甲乙丙丁戊己庚辛壬癸';
const _branches = '子丑寅卯辰巳午未申酉戌亥';
const _markers = ['禄', '权', '科', '忌'];
bool _stem(Object? value) =>
    value is String && value.length == 1 && _stems.contains(value);
bool _branch(Object? value) =>
    value is String && value.length == 1 && _branches.contains(value);
bool _number(Object? value) => value is num && value.isFinite;
bool _integer(Object? value, num low, num high) =>
    value is num && value >= low && value <= high && value == value.truncate();
bool _degree(Object? value) => value is num && value >= 0 && value < 360;
bool _timestamp(Object? value) =>
    value is String && value.length == 24 && archiveTimestamp(value);
bool _array(Object? value, int max, bool Function(Object?) item) =>
    value is List && value.length <= max && value.every(item);
bool _unique(Iterable<Object?> values) =>
    values.toSet().length == values.length;

Map<String, Object?>? parseChartSnapshot(Object? input, bool timeKnown) {
  if (input is! Map ||
      input['version'] != 1 ||
      input['timeKnown'] != timeKnown ||
      !validText(input['samplingVersion']) ||
      !_chart(input['bazi'], timeKnown ? 1 : 128, _bazi, 'utc') ||
      !_chart(input['ziwei'], timeKnown ? 1 : 13, _ziwei, 'timeIndex') ||
      !_chart(input['western'], timeKnown ? 1 : 128, _western, 'utc') ||
      !chartMethods.any(
        (method) => (input[method]['rawResult'] as List).isNotEmpty,
      ) ||
      !(input['bazi']['rawResult'] as List).every(
        (row) => _luck(row as Map, timeKnown),
      ) ||
      !_bounded(input))
    return null;
  final birth = input['birthContext'];
  Map<String, Object?>? context;
  if (input.containsKey('birthContext')) {
    if (!timeKnown ||
        birth is! Map ||
        birth['precision'] != 'minute' ||
        !_timestamp(birth['birthInstant']) ||
        // New Dart calculations identify their time-zone data source.
        !const [
          'gregory-iana-intl-v1',
          'gregory-iana-tzdb-v1',
        ].contains(birth['clockVersion']) ||
        !_number(birth['latitude']) ||
        (birth['latitude'] as num).abs() > 90 ||
        !_number(birth['longitude']) ||
        (birth['longitude'] as num).abs() > 180 ||
        !validText(birth['timeZone']))
      return null;
    final zone = birth['timeZone'] as String;
    if (zone.startsWith('+') ||
        zone.startsWith('-') ||
        !validTimeZone(zone) ||
        !const ['bazi', 'western'].every(
          (method) => (input[method]['rawResult'] as List).every(
            (row) => row['utc'] == birth['birthInstant'],
          ),
        ))
      return null;
    context = {
      for (final key in [
        'precision',
        'birthInstant',
        'latitude',
        'longitude',
        'timeZone',
        'clockVersion',
      ])
        key: birth[key],
    };
  }
  return {
    'version': 1,
    'timeKnown': timeKnown,
    'samplingVersion': input['samplingVersion'],
    for (final method in chartMethods) method: input[method],
    if (context != null) 'birthContext': context,
  };
}

bool _chart(
  Object? value,
  int limit,
  bool Function(Object?) validator,
  String key,
) {
  if (value is! Map ||
      !validText(value['engineName']) ||
      !validText(value['engineVersion']) ||
      !validText(value['rulesetVersion']) ||
      (value.containsKey('warning') &&
          !validText(value['warning'], reportDetailLimit)) ||
      !_array(value['rawResult'], limit, validator))
    return false;
  final rows = value['rawResult'] as List;
  return (rows.isNotEmpty || value.containsKey('warning')) &&
      _unique(rows.map((row) => row[key]));
}

bool _bounded(Object? value, [int depth = 0]) {
  if (depth > 32) return false;
  if (value is Map)
    return value.values.every((item) => _bounded(item, depth + 1));
  if (value is List) return value.every((item) => _bounded(item, depth + 1));
  return value == null || value is String || value is bool || _number(value);
}

bool _bazi(Object? value) {
  if (value is! Map ||
      !_timestamp(value['utc']) ||
      !validText(value['shenShaRulesetVersion']) ||
      value['tenGods'] is! Map ||
      value['shenSha'] is! Map)
    return false;
  return pillarPositions.every((position) {
    final pillar = value[position];
    final gods = (value['tenGods'] as Map)[position];
    final hits = (value['shenSha'] as Map)[position];
    if (pillar is! String ||
        pillar.length != 2 ||
        !_stem(pillar[0]) ||
        !_branch(pillar[1]) ||
        _stems.indexOf(pillar[0]).isEven !=
            _branches.indexOf(pillar[1]).isEven ||
        gods is! Map ||
        !validText(gods['heavenlyStem']) ||
        !_array(
          gods['hiddenStems'],
          3,
          (item) =>
              item is Map && _stem(item['stem']) && validText(item['tenGod']),
        ) ||
        (gods['hiddenStems'] as List).isEmpty ||
        !_array(hits, 32, (hit) {
          if (hit is! Map ||
              !validText(hit['name']) ||
              !_array(hit['sourcePillars'], 4, pillarPositions.contains))
            return false;
          final sources = hit['sourcePillars'] as List;
          return sources.isNotEmpty && _unique(sources);
        }))
      return false;
    return _unique((hits as List).map((hit) => hit['name']));
  });
}

bool _luck(Map candidate, bool timeKnown) {
  if (!candidate.containsKey('luckContext')) return true;
  final context = candidate['luckContext'];
  final original = candidate['luckPeriods'];
  if (!timeKnown ||
      context is! Map ||
      context['profile'] != 'lunar-javascript-beijing-jie-sect2-v1' ||
      !const ['female', 'male'].contains(context['gender']) ||
      !const ['forward', 'backward'].contains(context['direction']) ||
      original is! List ||
      original.length != 10)
    return false;
  final periods = context['periods'];
  if (periods is! List || periods.length != 10) return false;
  for (final (index, period) in periods.indexed) {
    final legacy = original[index];
    if (period is! Map || legacy is! Map) return false;
    final pillar = period['ganZhi'];
    final age = period['startAge'];
    final start = period['start'];
    final end = period['endExclusive'];
    if (pillar is! String ||
        pillar.length != 2 ||
        !_stem(pillar[0]) ||
        !_branch(pillar[1]) ||
        age is! num ||
        !age.isFinite ||
        age < 0 ||
        age != age.truncate() ||
        period['endAge'] != age + 9 ||
        !const [
          'ganZhi',
          'startAge',
          'endAge',
        ].every((field) => period[field] == legacy[field]) ||
        !_timestamp(start) ||
        !_timestamp(end) ||
        (end as String).compareTo(start as String) <= 0)
      return false;
    if (index == 0
        ? start.compareTo(candidate['utc'] as String) < 0
        : start != periods[index - 1]['endExclusive'])
      return false;
  }
  return true;
}

bool _star(Object? item) =>
    item is Map &&
    validText(item['name']) &&
    (!item.containsKey('mutagen') ||
        (item['mutagen'] is String &&
            (item['mutagen'] as String).length <= 120)) &&
    (!item.containsKey('brightnessProfile') ||
        (validText(item['brightnessProfile']) &&
            validText(item['brightness']))) &&
    (!item.containsKey('mutagenOrigin') ||
        (item['mutagenOrigin'] == 'birth_year' &&
            _markers.contains(item['mutagen'])));

bool _ziwei(Object? value) {
  const kinds = ['majorStars', 'minorStars', 'adjectiveStars'];
  if (value is! Map ||
      !_integer(value['timeIndex'], 0, 12) ||
      !_array(
        value['palaces'],
        12,
        (palace) =>
            palace is Map &&
            validText(palace['name']) &&
            _branch(palace['earthlyBranch']) &&
            palace['isBodyPalace'] is bool &&
            kinds.every((kind) => _array(palace[kind], 64, _star)),
      ))
    return false;
  final palaces = (value['palaces'] as List).cast<Map>();
  if (palaces.length != 12 ||
      !_unique(palaces.map((palace) => palace['earthlyBranch'])) ||
      palaces.where((palace) => palace['name'] == '命宫').length != 1 ||
      palaces.where((palace) => palace['isBodyPalace'] == true).length != 1)
    return false;
  final placements = <Object?, int>{};
  for (final palace in palaces) {
    final distinct = {
      for (final kind in kinds)
        for (final star in palace[kind] as List) star['name'],
    };
    for (final name in distinct) {
      placements[name] = (placements[name] ?? 0) + 1;
    }
  }
  return palaces.every((palace) {
    if (!palace.containsKey('stemTransformations')) return true;
    final items = palace['stemTransformations'];
    return _stem(palace['heavenlyStem']) &&
        _array(
          items,
          4,
          (item) =>
              item is Map &&
              _markers.contains(item['marker']) &&
              validText(item['star']) &&
              placements[item['star']] == 1,
        ) &&
        (items as List).length == 4 &&
        _unique(items.map((item) => item['marker']));
  });
}

bool _western(Object? value) {
  if (value is! Map ||
      !_timestamp(value['utc']) ||
      !_number(value['julianDay']) ||
      !_degree(value['ascendant']) ||
      !_degree(value['midheaven']) ||
      !_array(
        value['positions'],
        10,
        (item) =>
            item is Map &&
            westernPlanets.contains(item['planet']) &&
            _degree(item['longitude']) &&
            _number(item['latitude']) &&
            (item['latitude'] as num).abs() <= 90 &&
            _integer(item['house'], 1, 12),
      ) ||
      !_array(value['houses'], 12, _degree) ||
      (value['houses'] as List).length != 12 ||
      !_array(
        value['aspects'],
        90,
        (item) =>
            item is Map &&
            westernPlanets.contains(item['first']) &&
            westernPlanets.contains(item['second']) &&
            validText(item['name']) &&
            _number(item['orb']) &&
            (item['orb'] as num) >= 0,
      ))
    return false;
  final positions = value['positions'] as List;
  return positions.length == westernPlanets.length &&
      _unique(positions.map((item) => item['planet']));
}
