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
    );

enum SynastrySide { a, b }

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
  var _disposed = false;

  bool allowed = false;
  bool busy = false;
  String? message;
  Map<String, Object?>? a;
  Map<String, Object?>? b;
  bool aFromArchive = false;
  Map<String, Object?>? result;
  String? report;
  DateTime? savedAt;
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
    result = null;
    report = null;
    savedAt = null;
    _draft = null;
    message = null;
  }

  void confirmConsent(bool confirmed) {
    allowed = confirmed;
    if (!confirmed) {
      _invalidate();
      b = null;
    }
    notifyListeners();
  }

  @override
  void dispose() {
    _work.complete();
    _disposed = true;
    super.dispose();
  }

  bool _current(Completer<void> job) => !_disposed && identical(job, _work);
  bool _scope(String scope) =>
      account?.sessionChanging == false &&
      account?.authorizedSession?.scope == scope;

  Future<void> setManual(SynastrySide side, BirthProfile profile) async {
    final read = calculate;
    if (read == null || busy || (side == SynastrySide.b && !allowed)) return;
    _invalidate();
    if (side == SynastrySide.a) {
      a = null;
      aFromArchive = false;
    } else {
      b = null;
    }
    final job = _start();
    try {
      final chart = await read(profile, job.future);
      if (!_current(job)) return;
      if (_unknownTime(chart)) {
        message = '本期合盘需要双方的出生时间，请核对后重新排盘。';
      } else if (side == SynastrySide.a) {
        a = chart;
      } else if (allowed) {
        b = chart;
      }
    } catch (_) {
      if (_current(job)) message = '排盘失败，请核对出生资料后重试。';
    } finally {
      _finish(job);
    }
  }

  Future<void> readOwnChart() async {
    final session = account?.authorizedSession;
    if (session == null || !member || busy) return;
    _invalidate();
    a = null;
    aFromArchive = false;
    final job = _start();
    try {
      final value = await account!.reports.latestSynastrySnapshot(session.id);
      if (!_current(job) || !_scope(session.scope)) return;
      switch (value) {
        case {
          'status': 'available',
          'snapshot': final Map<String, Object?> chart,
        }:
          if (_unknownTime(chart)) {
            message = '最近的命理档案缺少出生时间，请在命理页补齐。';
          } else {
            a = chart;
            aFromArchive = true;
          }
        case {'status': 'missing_snapshot'}:
          message = '最近的归档没有结构化盘面，请在命理页重新测算。';
        case {'status': 'no_archive'}:
          message = '还没有命理档案，可以手动填写。';
        default:
          throw const FormatException('Invalid chart snapshot.');
      }
    } catch (_) {
      if (_current(job)) message = '暂时无法读取本人盘面，请重试。';
    } finally {
      _finish(job);
    }
  }

  Future<void> restoreLatest() async {
    final session = account?.authorizedSession;
    if (session == null || busy) return;
    final job = _start();
    try {
      final archive = await account!.reports.latest(
        session.id,
        ReportKind.synastry,
      );
      if (_current(job) && _scope(session.scope) && archive != null) {
        _showSaved(archive);
      }
    } catch (_) {
      if (_current(job)) message = '暂时无法读取已存合盘。';
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
    final job = _start();
    bool isCurrent() =>
        _current(job) && _scope(scope.scope) && allowed && _canShare;
    try {
      final context = jsonEncode([a?['calculatedAt'], b?['calculatedAt']]);
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
      final values = await summarize!(request, isCurrent);
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
      }
    } catch (_) {
      if (current()) message = '解读已生成，暂时无法存档。';
    }
  }

  void _showSaved(ArchivedReport archive) {
    report = archive.body;
    savedAt = archive.entry.savedAt;
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
