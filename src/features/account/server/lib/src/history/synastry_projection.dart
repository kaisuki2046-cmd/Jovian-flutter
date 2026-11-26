import 'archive_model.dart';
import 'chart_snapshot.dart';

Map<String, Object?> projectSynastry(
  Map<String, Object?>? record,
  bool calculationContext,
) {
  if (record == null) return {'status': 'no_archive'};
  final snapshot = (record['report'] as Map)['chartSnapshot'];
  final id = record['id'];
  if (snapshot == null)
    return {
      'status': 'missing_snapshot',
      'archiveId': id,
      'calculatedAt': record['calculatedAt'],
    };
  final known = snapshot['timeKnown'] == true;
  return {
    'status': 'available',
    'snapshot': {
      'archiveId': id,
      'snapshotId': id,
      'calculatedAt': record['calculatedAt'],
      'schemaVersion': snapshot['version'],
      'timeKnown': known,
      'samplingVersion': snapshot['samplingVersion'],
      if (known && calculationContext && snapshot['birthContext'] != null)
        'birthContext': snapshot['birthContext'],
      'bazi': _bazi(snapshot['bazi'] as Map, known, calculationContext),
      'ziwei': _ziwei(snapshot['ziwei'] as Map),
      'western': _western(snapshot['western'] as Map, known),
    },
  };
}

T? _shared<T>(Iterable<T> values) {
  final first = values.first;
  final serialized = archiveJson(first);
  return values.every((value) => archiveJson(value) == serialized)
      ? first
      : null;
}

Map<String, Object?> _version(Map chart) => {
  for (final name in ['engineName', 'engineVersion', 'rulesetVersion'])
    name: chart[name],
};

Map<String, Object?> _unavailable(
  Map chart, [
  String reason = 'not_calculated',
]) => {..._version(chart), 'status': 'unavailable', 'reason': reason};

Map<String, Object?> _bazi(Map chart, bool known, bool calculationContext) {
  final rows = (chart['rawResult'] as List).cast<Map>();
  if (rows.isEmpty) return _unavailable(chart);
  final pillars = <Map<String, Object?>>[];
  for (final position in pillarPositions) {
    final hits = rows
        .map(
          (row) => (row['shenSha'][position] as List)
              .map(
                (hit) => {
                  'name': hit['name'],
                  'sourcePillars': pillarPositions
                      .where(
                        (source) =>
                            (hit['sourcePillars'] as List).contains(source),
                      )
                      .toList(),
                },
              )
              .toList(),
        )
        .toList();
    final common = hits.first
        .where(
          (hit) => hits.every(
            (list) => list.any((item) => archiveJson(item) == archiveJson(hit)),
          ),
        )
        .toList();
    pillars.add({
      'position': position,
      'stem': _shared(rows.map((row) => (row[position] as String)[0])),
      'branch': _shared(rows.map((row) => (row[position] as String)[1])),
      'hiddenStems': _shared(
        rows.map(
          (row) => (row['tenGods'][position]['hiddenStems'] as List)
              .map((item) => item['stem'])
              .toList(),
        ),
      ),
      'shenSha': common,
      'shenShaComplete': hits.every((items) => items.length == common.length),
    });
  }
  if (!pillars.any(
    (p) =>
        p['stem'] != null ||
        p['branch'] != null ||
        p['hiddenStems'] != null ||
        (p['shenSha'] as List).isNotEmpty,
  )) {
    return _unavailable(chart, 'ambiguous_time');
  }
  final luck = known && calculationContext ? rows.first['luckContext'] : null;
  return {
    ..._version(chart),
    'status': known ? 'complete' : 'partial',
    'pillars': pillars,
    if (luck != null)
      'luckContext': {
        for (final key in ['profile', 'gender', 'direction']) key: luck[key],
        'periods': [
          for (final row in luck['periods'] as List)
            {
              for (final key in [
                'ganZhi',
                'startAge',
                'endAge',
                'start',
                'endExclusive',
              ])
                key: row[key],
            },
        ],
      },
  };
}

Map<String, Object?> _ziwei(Map chart) {
  final rows = chart['rawResult'] as List;
  if (rows.isEmpty) return _unavailable(chart);
  Map<String, Object?> projectStar(Map star) => {
    'name': star['name'],
    if (_present(star['mutagen'])) 'mutagen': star['mutagen'],
    if (_present(star['mutagen']) && _present(star['mutagenOrigin']))
      'mutagenOrigin': star['mutagenOrigin'],
    if (_present(star['brightness']) &&
        _present(star['brightnessProfile'])) ...{
      'brightness': star['brightness'],
      'brightnessProfile': star['brightnessProfile'],
    },
  };
  final stable = _shared(
    rows.map(
      (row) => [
        for (final palace in row['palaces'] as List)
          <String, Object?>{
            'name': palace['name'],
            'earthlyBranch': palace['earthlyBranch'],
            'isBodyPalace': palace['isBodyPalace'],
            if (palace['stemTransformations'] != null) ...{
              'heavenlyStem': palace['heavenlyStem'],
              'stemTransformations': [
                for (final item in palace['stemTransformations'] as List)
                  {'marker': item['marker'], 'star': item['star']},
              ],
            },
            for (final key in ['majorStars', 'minorStars', 'adjectiveStars'])
              key: (palace[key] as List).cast<Map>().map(projectStar).toList(),
          },
      ],
    ),
  );
  if (stable == null) return _unavailable(chart, 'ambiguous_time');
  final body = stable.firstWhere(
    (p) => p['isBodyPalace'] == true,
  )['earthlyBranch'];
  return {
    ..._version(chart),
    'status': 'complete',
    'lifePalaceBranch': stable.firstWhere(
      (p) => p['name'] == '命宫',
    )['earthlyBranch'],
    'bodyPalaceBranch': body,
    'palaces': [
      for (final palace in stable) ({...palace}..remove('isBodyPalace')),
    ],
  };
}

bool _present(Object? value) =>
    value != null && value != false && value != 0 && value != '';

Map<String, Object?> _western(Map chart, bool known) {
  final rows = chart['rawResult'] as List;
  if (rows.isEmpty) return _unavailable(chart);
  if (chart['rulesetVersion'] != 'tropical-whole-sign-v1')
    return _unavailable(chart, 'unsupported_ruleset');
  final version = {
    ..._version(chart),
    'zodiac': 'tropical',
    'houseSystem': 'whole-sign',
  };
  if (known) {
    final first = rows.first;
    return {
      ...version,
      'status': 'complete',
      for (final key in ['ascendant', 'midheaven', 'houses']) key: first[key],
      'positions': [
        for (final item in first['positions'] as List)
          {'planet': item['planet'], 'longitude': item['longitude']},
      ],
    };
  }
  final positions = <Map<String, Object?>>[];
  for (final planet in westernPlanets) {
    final index = _shared(
      rows.map(
        (row) =>
            ((row['positions'] as List).firstWhere(
                  (item) => item['planet'] == planet,
                )['longitude']
                as num) ~/
            30,
      ),
    );
    if (index != null) positions.add({'planet': planet, 'signIndex': index});
  }
  return positions.isEmpty
      ? _unavailable(chart, 'ambiguous_time')
      : {...version, 'status': 'partial', 'positions': positions};
}
