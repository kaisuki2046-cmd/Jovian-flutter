import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:jovian_destiny/jovian_destiny.dart';

import '../../../shared/http/json_client.dart';
import '../../account/account.dart';
import '../requests/synastry_summary_api.dart';

typedef SynastryChartReader =
    Future<Map<String, Object?>> Function(
      BirthProfile profile,
      Future<void> cancel,
    );
typedef SynastryComparisonReader =
    Future<Map<String, Object?>> Function(
      Map<String, Object?> a,
      Map<String, Object?> b,
      Future<void> cancel,
    );
typedef SynastrySummaryReader =
    Future<Map<String, String>> Function(
      Map<String, Object?> request,
      bool Function() isCurrent,
      Future<void> cancel,
    );

final _snapshotId = RegExp(r'^[a-f0-9]{64}$');

enum SynastrySide { a, b }

enum OwnSynastryChartStatus {
  idle,
  loading,
  available,
  noArchive,
  missingSnapshot,
  unknownTime,
  failed,
}

class SynastryPageController extends ChangeNotifier {
  SynastryPageController({
    this.account,
    this.calculate,
    this.compare,
    this.summarize,
  });

  final AccountController? account;
  final SynastryChartReader? calculate;
  final SynastryComparisonReader? compare;
  final SynastrySummaryReader? summarize;
  var _work = Completer<void>();
  Completer<void>? _latestRestore;
  var _disposed = false;

  bool allowed = false;
  bool busy = false;
  bool latestRestoreFailed = false;
  bool get restoringLatest => _latestRestore != null;
  String? message;
  Map<String, Object?>? a;
  Map<String, Object?>? b;
  final _manualProfiles = <SynastrySide, BirthProfile>{};
  BirthProfile? manualProfile(SynastrySide side) => _manualProfiles[side];
  OwnSynastryChartStatus ownChartStatus = OwnSynastryChartStatus.idle;
  bool aFromArchive = false;
  Map<String, Object?>? result;
  String? report;
  DateTime? savedAt;
  bool reportFromArchive = false;
  ReportHistoryController? _history;
  String? _historyScope;

  ReportHistoryController? get history {
    final scope = _historyScope;
    return scope != null && _scope(scope) ? _history : null;
  }

  Map<String, Object?>? _draft;
  bool get needsSave => _draft != null;

  bool get canCompare =>
      allowed && a != null && b != null && compare != null && !busy;
  bool get member => account?.socialMemberId != null;
  bool get hasSession => account?.authorizedSession != null;
  bool get canCalculate => calculate != null && compare != null;
  bool get summaryConfigured => summarize != null;
  bool get needsPermission => hasSession && !_canShare;
  bool get _canShare =>
      account?.agreementState?.permissions['synastry.cloud_interpretation'] ==
      true;

  void _invalidate() {
    _work.complete();
    _work = Completer<void>();
    busy = false;
    _clearResult();
    if (ownChartStatus == OwnSynastryChartStatus.loading) {
      ownChartStatus = aFromArchive
          ? OwnSynastryChartStatus.available
          : OwnSynastryChartStatus.idle;
    }
    message = null;
  }

  void _clearResult() {
    _cancelLatestRestore();
    result = null;
    report = null;
    savedAt = null;
    reportFromArchive = false;
    _draft = null;
  }

  void confirmConsent(bool confirmed) {
    allowed = confirmed;
    if (!confirmed) {
      _invalidate();
      b = null;
      _manualProfiles.remove(SynastrySide.b);
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _cancelLatestRestore();
    _history?.dispose();
    _work.complete();
    _disposed = true;
    super.dispose();
  }

  bool _current(Completer<void> job) => !_disposed && identical(job, _work);
  bool _scope(String scope) =>
      account?.sessionChanging == false &&
      account?.authorizedSession?.scope == scope;

  Future<bool> setManual(SynastrySide side, BirthProfile profile) async {
    final read = calculate;
    if (read == null || busy || (side == SynastrySide.b && !allowed))
      return false;
    final job = _start();
    try {
      final chart = await read(profile, job.future);
      if (!_current(job)) return false;
      if (_unknownTime(chart)) {
        message = '本期合盘需要双方的出生时间，请核对后重新排盘。';
        return false;
      }
      _clearResult();
      _manualProfiles[side] = profile;
      if (side == SynastrySide.a) {
        a = chart;
        aFromArchive = false;
        ownChartStatus = OwnSynastryChartStatus.idle;
      } else {
        b = chart;
      }
      return true;
    } catch (_) {
      if (_current(job)) message = '排盘失败，请核对出生资料后重试。';
      return false;
    } finally {
      _finish(job);
    }
  }

  void cancelManualCalculation() {
    if (_disposed || !busy) return;
    _work.complete();
    _work = Completer<void>();
    busy = false;
    notifyListeners();
  }

  Future<void> readOwnChart() async {
    final session = account?.authorizedSession;
    if (session == null || !member || busy) return;
    _cancelLatestRestore();
    final previousStatus = aFromArchive
        ? OwnSynastryChartStatus.idle
        : ownChartStatus;
    _unavailableOwnChart(OwnSynastryChartStatus.loading);
    final job = _start();
    try {
      final value = await account!.reports.latestSynastrySnapshot(session.id);
      if (!_current(job) || !_scope(session.scope)) return;
      switch (value) {
        case {
              'status': 'available',
              'snapshot': final Map<String, Object?> chart,
            }
            when _isOwnedChartSnapshot(chart):
          if (_unknownTime(chart)) {
            _unavailableOwnChart(OwnSynastryChartStatus.unknownTime);
          } else {
            _clearResult();
            a = chart;
            aFromArchive = true;
            _manualProfiles.remove(SynastrySide.a);
            ownChartStatus = OwnSynastryChartStatus.available;
          }
        case {'status': 'missing_snapshot'}:
          _unavailableOwnChart(OwnSynastryChartStatus.missingSnapshot);
        case {'status': 'no_archive'}:
          _unavailableOwnChart(OwnSynastryChartStatus.noArchive);
        default:
          throw const FormatException('Invalid chart snapshot.');
      }
    } catch (_) {
      if (_current(job) && _scope(session.scope)) {
        ownChartStatus = OwnSynastryChartStatus.failed;
      }
    } finally {
      if (_current(job) && ownChartStatus == OwnSynastryChartStatus.loading) {
        ownChartStatus = previousStatus;
      }
      _finish(job);
    }
  }

  void _unavailableOwnChart(OwnSynastryChartStatus status) {
    ownChartStatus = status;
    if (aFromArchive) {
      a = null;
      aFromArchive = false;
      _clearResult();
    }
  }

  Future<void> restoreLatest() async {
    final client = account;
    final session = client?.authorizedSession;
    if (client == null ||
        session == null ||
        _disposed ||
        !_scope(session.scope) ||
        restoringLatest ||
        busy) {
      return;
    }
    latestRestoreFailed = false;
    final restore = _latestRestore = Completer<void>();
    bool isCurrent() =>
        identical(_latestRestore, restore) && _scope(session.scope);

    notifyListeners();
    try {
      final archive = await client.reports.latest(
        session.id,
        ReportKind.synastry,
        cancel: restore.future,
      );
      if (isCurrent() && archive != null) _showSaved(archive);
    } catch (_) {
      if (isCurrent()) latestRestoreFailed = true;
    } finally {
      if (identical(_latestRestore, restore)) {
        _latestRestore = null;
        notifyListeners();
      }
    }
  }

  void _cancelLatestRestore() {
    _latestRestore?.complete();
    _latestRestore = null;
    latestRestoreFailed = false;
  }

  void openHistory() {
    final client = account;
    final session = client?.authorizedSession;
    if (_disposed ||
        client == null ||
        session == null ||
        !_scope(session.scope) ||
        history != null) {
      return;
    }
    _history?.dispose();
    _history = ReportHistoryController(
      client.reports,
      session.id,
      ReportKind.synastry,
      client.initialize,
    );
    _historyScope = session.scope;
    notifyListeners();
  }

  Future<void> openSaved(String id) async {
    final session = account?.authorizedSession;
    if (session == null || busy || !_scope(session.scope)) return;
    _cancelLatestRestore();
    final job = _start();
    try {
      final archive = await account!.reports.detail(
        session.id,
        ReportKind.synastry,
        id,
      );
      if (_current(job) && _scope(session.scope)) _showSaved(archive);
    } catch (_) {
      if (_current(job) && _scope(session.scope)) {
        message = '暂时无法读取这次合盘存档，请重试。';
      }
    } finally {
      _finish(job);
    }
  }

  Future<void> compareCharts() async {
    if (!canCompare) return;
    _invalidate();
    final job = _start();
    try {
      final calculated = await compare!(
        {'mode': aFromArchive ? 'account_owner' : 'manual_subject', 'chart': a},
        {'mode': 'manual_subject', 'chart': b},
        job.future,
      );
      if (_current(job)) result = calculated;
    } catch (_) {
      if (_current(job)) message = '盘面比较失败，请核对双方资料。';
    } finally {
      _finish(job);
    }
  }

  String? get _comparisonContext {
    final from = a?['calculatedAt'];
    final to = b?['calculatedAt'];
    if (from is! String ||
        to is! String ||
        DateTime.tryParse(from) == null ||
        DateTime.tryParse(to) == null) {
      return null;
    }
    return jsonEncode([from, to]);
  }

  Future<void> restoreComparedReport() async {
    final client = account;
    final session = client?.authorizedSession;
    final context = _comparisonContext;
    if (client == null ||
        session == null ||
        !_scope(session.scope) ||
        busy ||
        !allowed ||
        result == null) {
      return;
    }
    if (context == null) {
      message = '暂时无法确认双方盘面版本，请重新排盘。';
      notifyListeners();
      return;
    }
    final job = _start();
    bool isCurrent() => _current(job) && _scope(session.scope);
    try {
      final saved = await client.reports.latest(
        session.id,
        ReportKind.synastry,
        contextKey: context,
      );
      if (!isCurrent()) return;
      if (saved == null) {
        message = '这组盘面还没有已存解读。';
        return;
      }
      _showSaved(saved);
    } catch (_) {
      if (isCurrent()) message = '暂时无法读取已存合盘，请重试。';
    } finally {
      _finish(job);
    }
  }

  Future<void> generateSummary() async {
    final client = account;
    final scope = client?.authorizedSession;
    final request = result?['summaryRequest'];
    if (busy ||
        !allowed ||
        request is! Map<String, Object?> ||
        summarize == null)
      return;
    if (client == null || scope == null || !_scope(scope.scope)) {
      message = '请先登录或进入游客体验，再生成在线解读。';
      notifyListeners();
      return;
    }
    if (!_canShare) {
      message = '请在个人中心开启合盘在线解读授权。';
      notifyListeners();
      return;
    }
    final context = _comparisonContext;
    if (context == null) {
      message = '暂时无法确认双方盘面版本，请重新排盘。';
      notifyListeners();
      return;
    }
    final job = _start();
    final stopped = Completer<void>();
    bool isCurrent() =>
        !stopped.isCompleted &&
        _current(job) &&
        _scope(scope.scope) &&
        allowed &&
        _canShare;
    void stopIfStale() {
      if (!isCurrent() && !stopped.isCompleted) stopped.complete();
    }

    client.addListener(stopIfStale);
    try {
      final saved = await client.reports.latest(
        scope.id,
        ReportKind.synastry,
        contextKey: context,
      );
      if (!isCurrent()) return;
      if (saved != null) {
        _showSaved(saved);
        return;
      }
      final values = await summarize!(
        request,
        isCurrent,
        Future.any([job.future, stopped.future]),
      );
      if (!isCurrent()) return;
      final sections = [
        for (final MapEntry(:key, :value) in synastrySummarySections.entries)
          if (values[key] case final body? when body.isNotEmpty)
            {'id': key, 'title': value, 'body': body},
      ];
      if (sections.isEmpty) throw const FormatException('Missing report.');
      report = sections
          .map((row) => "## ${row['title']}\n\n${row['body']}")
          .join('\n\n');
      reportFromArchive = false;
      if (sections.length != synastrySummarySections.length) {
        message = '在线解读尚未包含全部四种关系，暂时无法存档。';
        return;
      }
      _draft = {
        'version': 1,
        'kind': 'synastry',
        'title': '双人合盘 · 四种关系',
        'contextKey': context,
        'calculatedAt': DateTime.fromMillisecondsSinceEpoch(
          DateTime.now().millisecondsSinceEpoch,
          isUtc: true,
        ).toIso8601String(),
        'context': <String, Object?>{},
        'sections': sections,
      };
      await _save(scope.id, isCurrent);
    } on JsonRequestError catch (error) {
      if (isCurrent()) {
        message = switch (error.status) {
          401 => '当前会话已失效，请重新登录或进入游客体验。',
          428 => '请在个人中心开启合盘在线解读授权。',
          _ => '合盘解读请求失败，请重试。',
        };
      }
    } catch (_) {
      if (isCurrent()) message = '合盘解读请求失败，请重试。';
    } finally {
      client.removeListener(stopIfStale);
      _finish(job);
    }
  }

  Future<void> retrySave() async {
    final scope = account?.authorizedSession;
    if (_draft == null ||
        scope == null ||
        !_scope(scope.scope) ||
        busy ||
        !allowed)
      return;
    final job = _start();
    try {
      await _save(
        scope.id,
        () => _current(job) && _scope(scope.scope) && allowed,
      );
    } finally {
      _finish(job);
    }
  }

  Future<void> _save(String owner, bool Function() current) async {
    final draft = _draft!;
    try {
      final receipt = await account!.reports.save(
        owner,
        ReportKind.synastry,
        draft,
      );
      if (current()) {
        _draft = null;
        savedAt = receipt.savedAt;
        if (history case final currentHistory?) {
          unawaited(currentHistory.refresh());
        }
      }
    } catch (_) {
      if (current()) message = '解读已生成，暂时无法存档。';
    }
  }

  void _showSaved(ArchivedReport archive) {
    report = archive.body;
    savedAt = archive.entry.savedAt;
    reportFromArchive = true;
    _draft = null;
  }

  Completer<void> _start() {
    busy = true;
    message = null;
    notifyListeners();
    return _work;
  }

  void _finish(Completer<void> job) {
    if (!_current(job)) return;
    busy = false;
    notifyListeners();
  }

  bool _isOwnedChartSnapshot(Map<String, Object?> chart) => switch (chart) {
    {
      'schemaVersion': 1,
      'archiveId': final String archiveId,
      'snapshotId': final String snapshotId,
      'calculatedAt': final String calculatedAt,
      'timeKnown': bool _,
      'bazi': Map _,
      'ziwei': Map _,
      'western': Map _,
    } =>
      archiveId == snapshotId &&
          _snapshotId.hasMatch(snapshotId) &&
          DateTime.tryParse(calculatedAt) != null,
    _ => false,
  };

  bool _unknownTime(Map<String, Object?> chart) =>
      chart['timeKnown'] == false ||
      [
        chart['bazi'],
        chart['western'],
      ].whereType<Map>().any((method) => method['status'] == 'partial') ||
      [chart['bazi'], chart['ziwei'], chart['western']].whereType<Map>().any(
        (method) =>
            method['status'] == 'unavailable' &&
            method['reason'] == 'ambiguous_time',
      );
}
