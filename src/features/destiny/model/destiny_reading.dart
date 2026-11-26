class DestinyReading {
  const DestinyReading._(this.archive, this.reportRequest, this.charts);

  final Map<String, Object?> archive;
  final Map<String, Object?> reportRequest;
  final DestinyCharts charts;

  factory DestinyReading.fromLegacy(Map<String, Object?> output) {
    if (output case {
      'archive': final Map<String, Object?> archive,
      'reportRequest': final Map<String, Object?> report,
    } when archive['charts'] is List) {
      return DestinyReading._(
        archive,
        report,
        DestinyCharts.fromArchive(
          archive,
          presentation: output['presentation'] as Map<String, Object?>?,
        ),
      );
    }
    throw const FormatException('盘面格式无法读取，请重新排盘。');
  }
}

enum DestinyChartMethod {
  bazi('八字'),
  ziwei('紫微斗数'),
  western('西方星盘');

  const DestinyChartMethod(this.label);
  final String label;
}

typedef ChartRow = ({String label, String value});

ChartRow chartRow(Object? input) {
  if (input case {'label': final String label, 'value': final String value}) {
    return (label: label, value: value);
  }
  throw const FormatException('盘面条目格式无法读取。');
}

class DestinyCharts {
  const DestinyCharts._(this.previews, this.timeKnown, this.presentation);

  final Map<DestinyChartMethod, DestinyChartPreview> previews;
  final bool timeKnown;
  final Map<String, Object?>? presentation;

  static DestinyCharts? tryArchive(Map<String, Object?> report) {
    try {
      return DestinyCharts.fromArchive(report);
    } on FormatException {
      return null;
    }
  }

  factory DestinyCharts.fromArchive(
    Map<String, Object?> archive, {
    Map<String, Object?>? presentation,
  }) {
    if (archive case {
      'charts': final List charts,
      'timeKnown': final bool timeKnown,
    }) {
      final previews = charts.map(DestinyChartPreview.fromJson);
      return DestinyCharts._(
        {for (final preview in previews) preview.method: preview},
        timeKnown,
        presentation,
      );
    }
    throw const FormatException('盘面格式无法读取。');
  }
}

class DestinyChartPreview {
  const DestinyChartPreview(this.method, this.note, this.rows);

  final DestinyChartMethod method;
  final String? note;
  final List<ChartRow> rows;

  factory DestinyChartPreview.fromJson(Object? input) {
    if (input case {'method': final String method, 'rows': final List rows}) {
      final name = DestinyChartMethod.values
          .where((item) => item.name == method)
          .firstOrNull;
      if (name == null) throw const FormatException('无法识别的命盘体系。');
      final note = (input as Map)['note'];
      return DestinyChartPreview(
        name,
        note is String ? note : null,
        rows.map(chartRow).toList(),
      );
    }
    throw const FormatException('盘面格式无法读取。');
  }
}
