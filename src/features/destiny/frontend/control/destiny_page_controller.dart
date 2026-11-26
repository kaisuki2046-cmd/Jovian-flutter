import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:jovian_destiny/jovian_destiny.dart';

import '../../../../shared/http/json_client.dart';
import '../../../account/account.dart';
import '../../model/destiny_reading.dart';

class DestinyPageController extends ChangeNotifier {
  DestinyPageController({
    required this.calculateReading,
    this.requestReport,
    this.account,
  });

  final Future<DestinyReading> Function(
    BirthProfile,
    Future<void>,
    void Function(String),
  )
  calculateReading;
  final Future<String> Function(Map<String, Object?>, Future<void>)?
  requestReport;
  final AccountController? account;
  final _disposed = Completer<void>();
  Completer<void>? _task;
  var _revision = 0;

  bool calculating = false;
  bool generating = false;
  bool saving = false;
  bool archiveLoading = false;
  bool archiveError = false;
  String? calculationError;
  String? reportError;
  String? stage;
  DestinyReading? reading;
  String? report;
  DestinyCharts? archivedCharts;
  String? fortuneArchiveId;
  bool summarySaved = false;
  ReportEntry? archiveEntry;
  ({String owner, String scope, Map<String, Object?> report})? _pendingSave;

  bool get busy => calculating || generating || saving;
  bool get needsSave => _pendingSave != null;

  @override
  void dispose() {
    _disposed.complete();
    _task?.complete();
    super.dispose();
  }

  bool _current(String scope) =>
      !_disposed.isCompleted &&
      account?.sessionChanging == false &&
      account?.authorizedSession?.scope == scope;

  bool get _allowed =>
      account?.agreementState?.permissions['destiny.cloud_interpretation'] ==
      true;

  void _refresh() {
    if (!_disposed.isCompleted) notifyListeners();
  }

  Future<void> submit(BirthProfile profile) async {
    if (busy) return;
    _revision++;
    calculating = true;
    calculationError = null;
    reading = null;
    report = null;
    archivedCharts = null;
    fortuneArchiveId = null;
    archiveEntry = null;
    summarySaved = false;
    reportError = null;
    archiveError = false;
    _pendingSave = null;
    final task = _task = Completer<void>();
    stage = 'validating';
    _refresh();
    try {
      final result = await calculateReading(profile, task.future, (value) {
        if (task.isCompleted) return;
        stage = value;
        _refresh();
      });
      if (!task.isCompleted) reading = result;
    } on FormatException catch (error) {
      if (!task.isCompleted) calculationError = error.message;
    } catch (_) {
      if (!task.isCompleted) calculationError = '暂时无法排盘，请重试。';
    } finally {
      if (identical(_task, task)) {
        _task = null;
        calculating = false;
        stage = null;
        _refresh();
      }
    }
    if (!task.isCompleted && reading != null && requestReport != null)
      await generateReport();
  }

  void cancelTask() {
    if (saving) return;
    _task?.complete();
    _task = null;
    calculating = false;
    generating = false;
    stage = null;
    _refresh();
  }

  Future<void> returnToArchive() async {
    if (busy) return;
    _revision++;
    reading = null;
    report = null;
    archivedCharts = null;
    fortuneArchiveId = null;
    archiveEntry = null;
    summarySaved = false;
    reportError = null;
    calculationError = null;
    _pendingSave = null;
    _refresh();
    await restoreReport();
  }

  Future<void> restoreReport() async {
    final client = account;
    final session = client?.authorizedSession;
    if (client == null || session == null || archiveLoading) return;
    final revision = _revision;
    archiveLoading = true;
    archiveError = false;
    _refresh();
    try {
      final result = await client.reports.latest(
        session.id,
        ReportKind.destiny,
      );
      if (_current(session.scope) && revision == _revision) {
        report = result?.body;
        archiveEntry = result?.entry;
        archivedCharts = result == null
            ? null
            : DestinyCharts.tryArchive(result.destiny);
        fortuneArchiveId = result?.destiny['chartSnapshot'] is Map
            ? result!.entry.id
            : null;
      }
    } catch (_) {
      if (_current(session.scope) && revision == _revision) archiveError = true;
    } finally {
      archiveLoading = false;
      _refresh();
    }
  }

  Future<void> generateReport() async {
    final session = account?.authorizedSession;
    final currentReading = reading;
    final request = requestReport;
    if (busy || currentReading == null || request == null) return;
    if (session == null || !_current(session.scope)) {
      reportError = '请先在个人中心登录或进入游客体验。';
      _refresh();
      return;
    }
    generating = true;
    reportError = null;
    stage = 'expressing';
    final task = _task = Completer<void>();
    _refresh();
    try {
      final result = await request(currentReading.reportRequest, task.future);
      if (task.isCompleted || !_current(session.scope) || !_allowed) return;
      report = result;
      _pendingSave = (
        owner: session.id,
        scope: session.scope,
        report: {...currentReading.archive, 'overview': result},
      );
      await saveReport();
    } on JsonRequestError catch (error) {
      if (!task.isCompleted && _current(session.scope)) {
        reportError = switch (error.status) {
          401 => '当前会话已失效，请重新登录或进入游客体验。',
          428 => '请在个人中心开启命理在线解读授权。',
          _ => '暂时无法连接解读服务，请重试。',
        };
      }
    } on FormatException catch (error) {
      if (!task.isCompleted && _current(session.scope))
        reportError = error.message;
    } catch (_) {
      if (!task.isCompleted && _current(session.scope))
        reportError = '暂时无法连接解读服务，请重试。';
    } finally {
      if (identical(_task, task)) {
        _task = null;
        generating = false;
        stage = null;
        _refresh();
      }
    }
  }

  Future<void> saveReport() async {
    final client = account;
    final pending = _pendingSave;
    if (client == null || pending == null || !_current(pending.scope) || saving)
      return;
    saving = true;
    reportError = null;
    _refresh();
    try {
      final entry = await _saveArchive(
        client,
        pending.owner,
        pending.scope,
        pending.report,
      );
      if (_current(pending.scope)) {
        _pendingSave = null;
        archiveEntry = entry;
        fortuneArchiveId = entry.chartSnapshotSaved ? entry.id : null;
        summarySaved = !entry.chartSnapshotSaved;
      }
    } on JsonRequestError catch (error) {
      if (_current(pending.scope)) {
        reportError = switch (error.status) {
          400 || 413 || 422 => '报告已生成，当前归档服务无法保存此内容，可重试归档。',
          _ => '报告已生成，暂时无法存档。',
        };
      }
    } catch (_) {
      if (_current(pending.scope)) reportError = '报告已生成，暂时无法存档。';
    } finally {
      saving = false;
      _refresh();
    }
  }

  Future<ReportEntry> _saveArchive(
    AccountController client,
    String owner,
    String scope,
    Map<String, Object?> record,
  ) async {
    try {
      return await client.reports.save(owner, ReportKind.destiny, record);
    } on JsonRequestError catch (error) {
      if (error.status != 413 ||
          !_current(scope) ||
          !record.containsKey('chartSnapshot'))
        rethrow;
      final basics = {...record}..remove('chartSnapshot');
      return client.reports.save(owner, ReportKind.destiny, basics);
    }
  }
}
