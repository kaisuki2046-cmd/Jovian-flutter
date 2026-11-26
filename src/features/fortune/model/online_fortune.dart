import 'package:jovian_fortune/jovian_fortune.dart';

final _id = RegExp(r'^[a-f0-9]{64}$');
bool isFortuneRecordId(Object? value) => value is String && _id.hasMatch(value);

const fortuneSectionTitles = {
  'overall': '综合运势',
  'wealth': '财运',
  'romance': '桃花运',
};

class FortuneWindowKey {
  const FortuneWindowKey(this.snapshotId, this.period, this.zone, this.start);

  final String snapshotId;
  final FortunePeriod period;
  final String zone;
  final int start;

  static FortuneWindowKey? fromArchive(Map<String, Object?> context) {
    if (context case {
      'snapshotId': final String snapshotId,
      'periodType': final String period,
      'displayTimezone': final String zone,
      'windowStart': final int start,
    } when isFortuneRecordId(snapshotId) && zone.isNotEmpty) {
      for (final value in FortunePeriod.values) {
        if (period == value.name)
          return FortuneWindowKey(snapshotId, value, zone, start);
      }
    }
    return null;
  }
}

class PreparedFortunePeriod {
  const PreparedFortunePeriod(
    this.contextKey,
    this.start,
    this.target,
    this.firstDate,
    this.lastDate,
    this.returnAt,
  );

  final String contextKey;
  final int start;
  final Map<String, Object?> target;
  final String firstDate;
  final String lastDate;
  final int? returnAt;

  factory PreparedFortunePeriod.fromJson(Map<String, Object?> value) {
    if (value case {
      'key': final String key,
      'window': {'start': final int start},
      'targetPeriod': final Map<String, Object?> target,
      'localDate': final String first,
      'lastDate': final String last,
    })
      return PreparedFortunePeriod(
        key,
        start,
        target,
        first,
        last,
        value['returnAt'] as int?,
      );
    throw const FormatException('Invalid fortune window.');
  }
}

class PublishedFortune {
  const PublishedFortune(
    this.id,
    this.runId,
    this.snapshotId,
    this.period,
    this.sections,
  );

  final String id;
  final String runId;
  final String snapshotId;
  final FortunePeriod period;
  final Map<String, String> sections;

  factory PublishedFortune.fromJson(
    Map<String, Object?> value,
    String snapshotId,
    FortunePeriod period, {
    String? runId,
  }) {
    if (value
        case {
          'reportId': final String id,
          'calculationRunId': final String calculated,
          'natalChartSnapshotId': final String snapshot,
          'periodType': final String periodType,
          'sections': final List raw,
        }
        when isFortuneRecordId(id) &&
            isFortuneRecordId(calculated) &&
            (runId == null || runId == calculated) &&
            snapshot == snapshotId &&
            periodType == period.name &&
            raw.length == fortuneSectionTitles.length) {
      final sections = <String, String>{};
      for (final (index, key) in fortuneSectionTitles.keys.indexed) {
        if (raw[index] case {
          'sectionId': final String section,
          'summary': final String text,
        } when section == key && text.trim().isNotEmpty) {
          sections[key] = text;
        } else {
          throw const FormatException('Invalid fortune section.');
        }
      }
      return PublishedFortune(id, calculated, snapshot, period, sections);
    }
    throw const FormatException('Invalid fortune report.');
  }

  Map<String, Object?> toJson() => {
    'reportId': id,
    'calculationRunId': runId,
    'natalChartSnapshotId': snapshotId,
    'periodType': period.name,
    'sections': [
      for (final MapEntry(:key, :value) in sections.entries)
        {'sectionId': key, 'summary': value},
    ],
  };
}

typedef FortuneAdviceItem = ({
  String method,
  String theme,
  String reason,
  String source,
  List<String> options,
  List<String> limitations,
});
typedef FortuneAdviceGroup = ({String kind, List<FortuneAdviceItem> items});

List<FortuneAdviceGroup> parseFortuneAdvice(
  Map<String, Object?> value,
  String runId,
  String snapshotId,
) {
  const kinds = ['数字', '饰品', '颜色'];
  if (value case {
    'version': 1,
    'calculationRunId': final String run,
    'snapshotId': final String snapshot,
    'groups': final List raw,
  } when run == runId && snapshot == snapshotId && raw.length == 3) {
    return [
      for (final (index, kind) in kinds.indexed) _adviceGroup(raw[index], kind),
    ];
  }
  throw const FormatException('Invalid fortune advice.');
}

FortuneAdviceGroup _adviceGroup(Object? value, String kind) {
  if (value case {
    'kind': final String group,
    'items': final List items,
  } when group == kind) {
    return (kind: kind, items: items.map(_adviceItem).toList());
  }
  throw const FormatException('Invalid fortune advice group.');
}

FortuneAdviceItem _adviceItem(Object? value) {
  if (value
      case {
        'method': final String method,
        'theme': final String theme,
        'reason': final String reason,
        'source': final String source,
        'options': final List options,
        'limitations': final List limitations,
      }
      when const {'bazi', 'western', 'ziwei'}.contains(method) &&
          options.isNotEmpty &&
          options.every((item) => item is String) &&
          limitations.every((item) => item is String)) {
    return (
      method: method,
      theme: theme,
      reason: reason,
      source: source,
      options: options.cast<String>(),
      limitations: limitations.cast<String>(),
    );
  }
  throw const FormatException('Invalid fortune advice item.');
}
