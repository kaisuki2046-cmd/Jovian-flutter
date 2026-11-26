class DestinyReading {
  const DestinyReading._(this.archive, this.reportRequest, this.charts);

  final Map<String, Object?> archive;
  final Map<String, Object?> reportRequest;
  final List<DestinyChartPreview> charts;

  factory DestinyReading.fromLegacy(Map<String, Object?> output) {
    if (output case {
      'archive': final Map<String, Object?> archive,
      'reportRequest': final Map<String, Object?> report,
    } when archive['charts'] is List) {
      return DestinyReading._(
        archive,
        report,
        (archive['charts'] as List).map(DestinyChartPreview.fromJson).toList(),
      );
    }
    throw const FormatException('盘面格式无法读取，请重新排盘。');
  }
}

class DestinyChartPreview {
  const DestinyChartPreview(this.label, this.note, this.rows);

  final String label;
  final String? note;
  final List<({String label, String value})> rows;

  factory DestinyChartPreview.fromJson(Object? input) {
    if (input case {'method': final String method, 'rows': final List rows}) {
      final label = switch (method) {
        'bazi' => '八字',
        'ziwei' => '紫微斗数',
        'western' => '西方星盘',
        _ => throw const FormatException('无法识别的命盘体系。'),
      };
      return DestinyChartPreview(label, (input as Map)['note'] as String?, [
        for (final row in rows)
          if (row case {
            'label': final String name,
            'value': final String value,
          })
            (label: name, value: value)
          else
            throw const FormatException('盘面条目格式无法读取。'),
      ]);
    }
    throw const FormatException('盘面格式无法读取。');
  }
}
