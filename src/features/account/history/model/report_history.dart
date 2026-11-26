enum ReportKind {
  destiny('命理'),
  fortune('运势'),
  synastry('合盘');

  const ReportKind(this.label);
  final String label;
}

final _archiveId = RegExp(r'^[0-9a-f]{64}$');

class ReportEntry {
  const ReportEntry(this.id, this.title, this.calculatedAt, this.savedAt);

  final String id;
  final String title;
  final DateTime calculatedAt;
  final DateTime savedAt;

  factory ReportEntry.fromJson(Object? value, ReportKind kind) {
    if (value
        case {
          'id': final String id,
          'title': final String title,
          'calculatedAt': final String calculated,
          'savedAt': final int saved,
        }
        when _archiveId.hasMatch(id) &&
            (kind == ReportKind.destiny ||
                (value as Map)['kind'] == kind.name)) {
      return ReportEntry(
        id,
        kind == ReportKind.destiny && title == '命盘记录' ? '命理解读' : title,
        DateTime.parse(calculated),
        DateTime.fromMillisecondsSinceEpoch(saved, isUtc: true),
      );
    }
    throw const FormatException('Invalid report entry.');
  }
}

class ReportHistoryPage {
  const ReportHistoryPage(this.entries, this.nextCursor);
  final List<ReportEntry> entries;
  final String? nextCursor;

  factory ReportHistoryPage.fromJson(
    Map<String, Object?> value,
    ReportKind kind,
  ) {
    final entries = value['entries'];
    final cursor = value['nextCursor'];
    if (entries is! List ||
        (cursor != null &&
            (cursor is! String || !_archiveId.hasMatch(cursor)))) {
      throw const FormatException('Invalid report history.');
    }
    return ReportHistoryPage(
      entries.map((entry) => ReportEntry.fromJson(entry, kind)).toList(),
      cursor as String?,
    );
  }
}

class ArchivedReport {
  const ArchivedReport(this.entry, this.body, {this.context = const {}});
  final ReportEntry entry;
  final String body;
  final Map<String, Object?> context;

  factory ArchivedReport.fromJson(Map<String, Object?> value, ReportKind kind) {
    final entry = ReportEntry.fromJson(value, kind);
    final details = value['report'];
    if (details is Map && details['version'] == 1) {
      if (kind == ReportKind.destiny) {
        final body = details['overview'];
        if (body is String && body.trim().isNotEmpty)
          return ArchivedReport(entry, body);
      } else if (details['kind'] == kind.name && details['sections'] is List) {
        final paragraphs = <String>[];
        for (final item in details['sections'] as List) {
          if (item case {
            'title': final String title,
            'body': final String body,
          }) {
            paragraphs.add('## $title\n\n$body');
          } else {
            throw const FormatException('Invalid report section.');
          }
        }
        if (paragraphs.isNotEmpty) {
          final context = details['context'];
          return ArchivedReport(
            entry,
            paragraphs.join('\n\n'),
            context: context is Map<String, Object?> ? context : const {},
          );
        }
      }
    }
    throw const FormatException('Invalid archived report.');
  }
}
