import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:jovian_fortune/jovian_fortune.dart';

import '../../../shared/http/json_client.dart';
import '../../account/account.dart';

typedef FortuneDisplay = ({String zone, int Function(int) clock});

class FortunePageController extends ChangeNotifier {
  FortunePageController({
    required this.loadDisplay,
    required this.readServerTime,
    required this.account,
    required this.ownerId,
    required this.archiveId,
    this.now = DateTime.now,
  });

  final Future<FortuneDisplay> Function() loadDisplay;
  final Future<DateTime> Function()? readServerTime;
  final AccountController? account;
  final String? ownerId;
  final String? archiveId;
  final DateTime Function() now;

  FortunePeriod period = FortunePeriod.day;
  FortuneDisplay? display;
  FortunePreview? preview;
  AlmanacDay? almanac;
  DateTime? referenceTime;
  ArchivedDestinyCharts? archive;
  ArchivedReport? savedReport;
  bool syncingTime = true;
  bool usingFallbackTime = false;
  bool loadingArchive = false;
  bool loadingReport = false;
  String? clockError;
  String? archiveError;
  String? reportError;
  bool _closed = false;
  int _timeRevision = 0;
  int _archiveRevision = 0;
  int _reportRevision = 0;
  String? _reportKey;

  void initialize() {
    unawaited(refreshTime());
    if (ownerId != null) unawaited(readArchive());
  }

  Future<void> refreshTime() async {
    final revision = ++_timeRevision;
    syncingTime = true;
    clockError = null;
    _emit();
    try {
      final displayClock = await loadDisplay();
      var instant = now();
      var fallback = false;
      if (readServerTime case final read?) {
        try {
          instant = await read();
        } on Exception {
          instant = now();
          fallback = true;
        }
      }
      if (_closed || revision != _timeRevision) return;
      display = displayClock;
      referenceTime = instant;
      usingFallbackTime = fallback;
      _buildPreview();
      unawaited(readReport());
    } catch (_) {
      if (_closed || revision != _timeRevision) return;
      clockError = '暂时无法计算当前运势日期。';
    } finally {
      if (!_closed && revision == _timeRevision) {
        syncingTime = false;
        _emit();
      }
    }
  }

  void selectPeriod(FortunePeriod next) {
    if (next == period) return;
    period = next;
    _buildPreview();
    unawaited(readReport());
    _emit();
  }

  Future<void> readArchive() async {
    final owner = ownerId;
    final accounts = account;
    if (owner == null || accounts == null) return;
    final revision = ++_archiveRevision;
    loadingArchive = true;
    archiveError = null;
    archive = null;
    _buildPreview();
    _clearReport();
    _emit();
    try {
      final chosen = archiveId;
      if (chosen != null && !RegExp(r'^[0-9a-f]{64}$').hasMatch(chosen)) {
        archiveError = '这张命盘不可用。';
        return;
      }
      final saved = await accounts.reports.latestDestinyCharts(
        owner,
        archiveId: chosen,
      );
      if (_closed || revision != _archiveRevision) return;
      archive = saved;
      if (saved == null) archiveError = '还没有命理档案。';
      _buildPreview();
      unawaited(readReport());
    } catch (error) {
      if (_closed || revision != _archiveRevision) return;
      archiveError = '暂时无法读取命理档案。';
      _recoverIdentity(error);
    } finally {
      if (!_closed && revision == _archiveRevision) {
        loadingArchive = false;
        _emit();
      }
    }
  }

  Future<void> readReport({bool retry = false}) async {
    final active = archive;
    final owner = ownerId;
    final accounts = account;
    final window = preview?.window;
    final zone = display?.zone;
    if (active == null ||
        owner == null ||
        accounts == null ||
        window == null ||
        zone == null) {
      _clearReport();
      return;
    }
    final key = fortuneArchiveKey(active.entry.id, period, zone, window);
    if (!retry && key == _reportKey) return;
    _clearReport();
    final revision = _reportRevision;
    _reportKey = key;
    loadingReport = true;
    _emit();
    try {
      final saved = await accounts.reports.latest(
        owner,
        ReportKind.fortune,
        contextKey: key,
      );
      if (_closed || revision != _reportRevision) return;
      savedReport = saved;
    } catch (error) {
      if (_closed || revision != _reportRevision) return;
      reportError = '暂时无法读取已保存的运势报告。';
      _recoverIdentity(error);
    } finally {
      if (!_closed && revision == _reportRevision) {
        loadingReport = false;
        _emit();
      }
    }
  }

  void _recoverIdentity(Object error) {
    if (error is JsonRequestError &&
        (error.status == 401 || error.status == 403)) {
      archive = null;
      _buildPreview();
      _clearReport();
      archiveError = '账号会话已失效，请重新连接。';
      _emit();
      unawaited(account?.initialize());
    }
  }

  void _clearReport() {
    _reportRevision++;
    _reportKey = null;
    savedReport = null;
    loadingReport = false;
    reportError = null;
  }

  void _buildPreview() {
    final instant = referenceTime?.millisecondsSinceEpoch;
    final wall = display?.clock;
    if (instant == null || wall == null) return;
    final active = archive;
    final snapshot = active?.natalDays;
    final natal = active == null
        ? null
        : readNatalDay(
            timeKnown: active.timeKnown,
            dayRows: active.charts[ArchivedChartMethod.bazi]!.rows
                .where((row) => row.label == '日柱')
                .map((row) => row.value)
                .toList(),
            snapshotPillars: snapshot?.candidates,
            snapshotTimeKnown: snapshot?.timeKnown,
          );
    preview = buildFortunePreview(instant, period, wall, natal: natal);
    almanac = period == FortunePeriod.day ? buildAlmanacDay(instant) : null;
  }

  void _emit() {
    if (!_closed) notifyListeners();
  }

  @override
  void dispose() {
    _closed = true;
    super.dispose();
  }
}
