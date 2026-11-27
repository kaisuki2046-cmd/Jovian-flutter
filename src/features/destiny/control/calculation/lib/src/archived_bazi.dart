import 'package:jovian_destiny_model/jovian_destiny_model.dart';

import 'bazi.dart';

const baziPillarLabels = {
  Pillar.year: '年柱',
  Pillar.month: '月柱',
  Pillar.day: '日柱',
  Pillar.hour: '时柱',
};

typedef ArchivedChartRow = ({String label, String value});
typedef RestoredBaZiRow = ({String label, String value, List<String> details});

List<RestoredBaZiRow> restoreArchivedBaZiRows(List<ArchivedChartRow> rows) {
  final labels = {
    for (final entry in baziPillarLabels.entries) entry.value: entry.key,
  };
  final values = [
    for (final row in rows)
      (
        label: row.label,
        lines: row.value.split('\n').map((line) => line.trim()).toList(),
        position: labels[row.label],
      ),
  ];
  final pillars = <Pillar, String>{
    for (final row in values)
      if (row.position != null && isBaZiPillar(row.lines.first))
        row.position!: row.lines.first,
  };
  return [
    for (final row in values)
      (
        label: row.label,
        value: row.lines.first,
        details: _restoreDetails(
          pillars,
          row.position,
          row.lines.skip(1).where((line) => line.isNotEmpty).toList(),
        ),
      ),
  ];
}

List<String> _restoreDetails(
  FourPillars pillars,
  Pillar? position,
  List<String> saved,
) {
  if (saved.isNotEmpty || position == null) return saved;
  const unknown = '归档资料不足';
  final details = detailsFromKnownBaZiPillars(pillars, position);
  final gods = details['tenGods'] as Map?;
  final hits = details['shenSha'] as List?;
  final hidden = gods == null
      ? unknown
      : (gods['hiddenStems'] as List)
            .map((item) => '${item['stem']} ${item['tenGod']}')
            .join('、');
  final shenSha = hits == null
      ? unknown
      : hits.map((item) => item['name']).join('、');
  return [
    '天干十神 ${gods?['heavenlyStem'] ?? unknown}',
    '藏干十神 $hidden',
    '神煞 ${shenSha.isEmpty ? '无命中' : shenSha}',
  ];
}
