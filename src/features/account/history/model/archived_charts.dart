import 'package:jovian_destiny/jovian_destiny.dart' show ArchivedChartRow;

import 'report_history.dart';

typedef ChartArchiveSelection = ({String id, String scope});

enum ArchivedChartMethod {
  bazi('八字'),
  ziwei('紫微斗数'),
  western('西方星盘');

  const ArchivedChartMethod(this.label);
  final String label;
}

class ArchivedChart {
  const ArchivedChart(this.note, this.rows);

  final String? note;
  final List<ArchivedChartRow> rows;

  factory ArchivedChart.fromJson(Object? value, ArchivedChartMethod method) {
    if (value case {
      'method': final String name,
      'rows': final List rows,
    } when name == method.name) {
      final note = (value as Map)['note'];
      return ArchivedChart(note as String?, [
        for (final row in rows)
          if (row case {
            'label': final String label,
            'value': final String text,
          })
            (label: label, value: text)
          else
            throw const FormatException('Invalid archived chart row.'),
      ]);
    }
    throw const FormatException('Invalid archived chart.');
  }
}

class ArchivedDestinyCharts {
  const ArchivedDestinyCharts(
    this.entry,
    this.timeKnown,
    this.charts, {
    this.natalDays,
    this.snapshot,
  });

  final ReportEntry entry;
  final bool timeKnown;
  final Map<ArchivedChartMethod, ArchivedChart> charts;
  final ({bool timeKnown, List<String?> candidates})? natalDays;
  final Map<String, Object?>? snapshot;

  factory ArchivedDestinyCharts.fromJson(Map<String, Object?> value) {
    final report = value['report'];
    if (report case {
      'version': 1,
      'timeKnown': final bool known,
      'charts': final List charts,
    } when charts.length == ArchivedChartMethod.values.length) {
      final snapshot = report['chartSnapshot'];
      return ArchivedDestinyCharts(
        ReportEntry.fromJson(value, ReportKind.destiny),
        known,
        {
          for (final (index, method) in ArchivedChartMethod.values.indexed)
            method: ArchivedChart.fromJson(charts[index], method),
        },
        natalDays: _natalDays(snapshot),
        snapshot: snapshot is Map<String, Object?> && snapshot['version'] == 1
            ? snapshot
            : null,
      );
    }
    throw const FormatException('Invalid archived destiny charts.');
  }

  static ({bool timeKnown, List<String?> candidates})? _natalDays(
    Object? value,
  ) {
    if (value case {
      'version': 1,
      'timeKnown': final bool known,
      'bazi': {'rawResult': final List candidates},
    }) {
      return (
        timeKnown: known,
        candidates: [
          for (final item in candidates)
            if (item case {'day': final String day}) day else null,
        ],
      );
    }
    return null;
  }
}
