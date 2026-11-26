import 'package:jovian_fortune_model/jovian_fortune_model.dart';

const _natalReasons = {
  'bazi': '取已确认的本命日干五行作象征搭配主题，不等同喜用判断。',
  'western': '取本命太阳所在的热带黄道星座作搭配主题，不代表本期吉凶。',
  'ziwei': '取已确认命宫的首颗主星作象征主题，不据此推断佩戴效果。',
};

FortuneJson? buildFortuneSelectedAdvice(
  String optionId,
  List<FortuneJson> matches,
) => matches.isEmpty
    ? null
    : {
        'version': 1,
        'optionId': optionId,
        'groups': _groups(matches, natal: false),
      };

FortuneJson buildFortuneNatalAdvice({
  required String calculationRunId,
  required String snapshotId,
  required String periodType,
  required Map<String, String> themes,
  required List<FortuneJson> Function(String, String) matchTheme,
}) {
  final matches = [
    if (periodType != 'week')
      for (final field in ['element', 'sign', 'lifeStar'])
        if (themes[field] case final value? when value.isNotEmpty)
          ...matchTheme(field, value),
  ];
  return {
    'version': 1,
    'calculationRunId': calculationRunId,
    'snapshotId': snapshotId,
    'periodType': periodType,
    'groups': _groups(matches, natal: true),
  };
}

List<FortuneJson> _groups(List<FortuneJson> matches, {required bool natal}) {
  final groups = {
    for (final kind in ['数字', '饰品', '颜色']) kind: <FortuneJson>[],
  };
  for (final match in matches) {
    final method = match['method'] as String;
    final theme = match['theme'] as String;
    final entry = match['entry'] as FortuneJson;
    final interpretation = entry['interpretation'] as FortuneJson;
    final advice = interpretation['advice'] as FortuneJson;
    final source = entry['source'] as FortuneJson;
    final conditions = entry['conditions'] as FortuneJson;
    groups[advice['kind']]!.add({
      'method': method,
      'theme': natal && method == 'western' ? '${theme}座' : theme,
      'reason': natal ? _natalReasons[method] : '根据你选择的资料来源和主题，用作象征搭配参考。',
      'options': advice['options'],
      'knowledgeId': entry['id'],
      'source':
          "${source['book']} · ${source['section'] ?? source['passage_id']}",
      'limitations': [
        ...interpretation['limitations'] as List,
        ...conditions['uncertain'] as List,
      ],
    });
  }
  return [
    for (final MapEntry(key: kind, value: items) in groups.entries)
      {'kind': kind, 'items': items},
  ];
}
