import '../../auth/requests/account_api.dart';
import '../model/archived_charts.dart';
import '../model/report_history.dart';

class ReportHistoryApi {
  const ReportHistoryApi(this._account);
  final AccountApi _account;

  Future<ArchivedDestinyCharts?> latestDestinyCharts(
    String owner, {
    String? archiveId,
  }) async {
    final record = await _account.requestNullable(
      ['destiny-history', archiveId ?? 'latest'],
      authenticated: true,
      query: {'expectedOwnerId': owner},
    );
    return record == null ? null : ArchivedDestinyCharts.fromJson(record);
  }

  Future<Map<String, Object?>> latestSynastrySnapshot(String owner) =>
      _account.request(
        ['synastry-chart-snapshots', 'latest'],
        authenticated: true,
        query: {'expectedOwnerId': owner},
      );

  String _history(ReportKind kind) =>
      kind == ReportKind.destiny ? 'destiny-history' : 'reading-history';
  Map<String, String> _owner(String owner, ReportKind kind) => {
    'expectedOwnerId': owner,
    if (kind != ReportKind.destiny) 'kind': kind.name,
  };

  Future<ReportHistoryPage> list(
    String owner,
    ReportKind kind, {
    String? before,
  }) async {
    final page = await _account.request(
      [_history(kind)],
      authenticated: true,
      query: {..._owner(owner, kind), if (before != null) 'before': before},
    );
    return ReportHistoryPage.fromJson(page, kind);
  }

  Future<ArchivedReport> detail(
    String owner,
    ReportKind kind,
    String id,
  ) async {
    final record = await _account.request(
      [_history(kind), id],
      authenticated: true,
      query: _owner(owner, kind),
    );
    final report = ArchivedReport.fromJson(record, kind);
    if (report.entry.id != id)
      throw const FormatException('Unexpected report.');
    return report;
  }

  Future<ArchivedReport?> latest(
    String owner,
    ReportKind kind, {
    String? contextKey,
  }) async {
    final record = await _account.requestNullable(
      [_history(kind), 'latest'],
      authenticated: true,
      query: {
        ..._owner(owner, kind),
        if (contextKey != null) 'contextKey': contextKey,
      },
    );
    return record == null ? null : ArchivedReport.fromJson(record, kind);
  }

  Future<ReportEntry> save(
    String owner,
    ReportKind kind,
    Map<String, Object?> report,
  ) async {
    final record = await _account.request(
      [_history(kind)],
      authenticated: true,
      body: {'expectedOwnerId': owner, 'report': report},
    );
    return ReportEntry.fromJson(record, kind);
  }
}
