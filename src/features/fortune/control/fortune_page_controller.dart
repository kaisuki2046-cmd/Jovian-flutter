import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:jovian_fortune/jovian_fortune.dart';

import '../../../shared/http/json_client.dart';
import '../../account/account.dart';
import '../model/online_fortune.dart';
import 'fortune_local.dart';
import 'fortune_online.dart';

typedef FortuneDisplay = ({String zone, int Function(int) clock});

class FortunePageController extends ChangeNotifier {
  FortunePageController({
    required this.loadDisplay,
    required this.readServerTime,
    required this.account,
    required this.ownerId,
    required this.archiveId,
    FortunePeriod? initialPeriod,
    this.local = const FortuneLocal(),
    this.online,
    this.now = DateTime.now,
  }) : period = initialPeriod ?? FortunePeriod.day,
       _resumeLatest = initialPeriod == null;

  final Future<FortuneDisplay> Function() loadDisplay;
  final Future<DateTime> Function()? readServerTime;
  final AccountController? account;
  final String? ownerId;
  final String? archiveId;
  final FortuneLocal local;
  final FortuneOnline? online;
  final DateTime Function() now;

  FortunePeriod period;
  FortuneDisplay? display;
  FortunePreview? preview;
  AlmanacDay? almanac;
  DateTime? referenceTime;
  ArchivedDestinyCharts? archive;
  ArchivedReport? savedReport;
  bool syncingTime = true;
  bool loadingPreview = false;
  bool usingFallbackTime = false;
  bool loadingArchive = false;
  bool loadingReport = false;
  String? clockError;
  String? previewError;
  String? archiveError;
  bool selectedArchiveMissing = false;
  String? reportError;
  String? generationError;
  bool _authorizationRequired = false;
  bool returnLocationRejected = false;
  String? adviceError;
  PublishedFortune? published;
  PreparedFortunePeriod? prepared;
  PreparedFortunePeriod? archivedWindow;
  List<FortuneAdviceGroup>? advice;
  bool generating = false;
  bool loadingAdvice = false;
  bool saving = false;
  bool reportSaved = false;
  Map<String, Object?>? _draft;
  String? _calculation;
  String? _archivedZone;
  bool _resumeLatest;
  var _work = Completer<void>();
  Completer<void>? _previewWork;
  bool _closed = false;
  int _timeRevision = 0;
  int _archiveRevision = 0;
  int _reportRevision = 0;
  String? _reportKey;

  FortunePeriod get displayedPeriod => published?.period ?? period;
  String? get displayedZone => _archivedZone ?? display?.zone;
  PreparedFortunePeriod? get displayedWindow => archivedWindow ?? prepared;
  bool get canGenerate =>
      !syncingTime &&
      preview != null &&
      clockError == null &&
      prepared != null &&
      hasChart &&
      !busy;
  bool get needsAiAuthorization => _authorizationRequired && !_canUseAi;
  bool get _canUseAi =>
      account?.agreementState?.permissions['fortune.cloud_interpretation'] ==
      true;
  bool get hasChart => archive?.snapshot != null;
  bool get busy => loadingReport || generating || loadingAdvice || saving;
  bool get needsSave => _draft != null && !reportSaved;

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
      await _refreshPreview();
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
    final canResume =
        _resumeLatest && archiveId == null && ownerId != null && online != null;
    if (next == period && archivedWindow == null && !canResume) return;
    _resumeLatest = false;
    period = next;
    _clearReport();
    unawaited(_refreshPreview());
    _emit();
  }

  Future<void> readArchive() async {
    final owner = ownerId;
    final accounts = account;
    if (owner == null || accounts == null) return;
    final revision = ++_archiveRevision;
    loadingArchive = true;
    archiveError = null;
    selectedArchiveMissing = false;
    archive = null;
    _cancelPreview();
    preview = null;
    almanac = null;
    _clearReport();
    _emit();
    try {
      final chosen = archiveId;
      if (chosen != null && !RegExp(r'^[0-9a-f]{64}$').hasMatch(chosen)) {
        _missingSelectedArchive();
        return;
      }
      final saved = await accounts.reports.latestDestinyCharts(
        owner,
        archiveId: chosen,
      );
      if (_closed || revision != _archiveRevision) return;
      if (chosen != null &&
          (saved == null || (online != null && saved.snapshot == null))) {
        _missingSelectedArchive();
        return;
      }
      archive = saved;
      if (saved == null) {
        archiveError = '还没有命理档案。';
      } else if (online != null && saved.snapshot == null) {
        archiveError = '这份档案缺少解读所需的盘面。可以在命理页重新测算。';
      }
    } catch (error) {
      if (_closed || revision != _archiveRevision) return;
      if (archiveId != null &&
          error is JsonRequestError &&
          (error.status == 403 || error.status == 404)) {
        _missingSelectedArchive();
      } else {
        archiveError = '暂时无法读取命理档案。';
        _recoverIdentity(error);
      }
    } finally {
      if (!_closed && revision == _archiveRevision) {
        loadingArchive = false;
        _emit();
        unawaited(_refreshPreview());
      }
    }
  }

  void _missingSelectedArchive() {
    selectedArchiveMissing = true;
    archiveError = '这张命盘不可用，请返回命理重新打开。';
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
    final job = _work;
    _reportKey = key;
    loadingReport = true;
    _emit();
    try {
      if (online != null && active.snapshot != null) {
        await _readPublished(online!, accounts, owner, active, zone, job);
      } else {
        final saved = await accounts.reports.latest(
          owner,
          ReportKind.fortune,
          contextKey: key,
        );
        if (_current(job)) savedReport = saved;
      }
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

  Future<void> _readPublished(
    FortuneOnline service,
    AccountController accounts,
    String owner,
    ArchivedDestinyCharts active,
    String zone,
    Completer<void> job,
  ) async {
    final at = referenceTime!.millisecondsSinceEpoch;
    final input = _periodInput(period, zone);
    final plan = await service.prepare(input, at, {
      'snapshotId': active.entry.id,
      'chart': active.snapshot,
    }, job.future);
    if (!_current(job)) return;
    prepared = plan;
    final key = FortuneWindowKey(active.entry.id, period, zone, plan.start);
    if (_resumeLatest && archiveId == null) {
      final last = await accounts.reports.latest(owner, ReportKind.fortune);
      if (!_current(job)) return;
      final prior = last == null
          ? null
          : FortuneWindowKey.fromArchive(last.context);
      if (prior != null &&
          (prior.start != key.start ||
              prior.snapshotId != key.snapshotId ||
              prior.zone != key.zone ||
              prior.period != key.period)) {
        PublishedFortune? verified;
        try {
          verified = await service.api.latest(owner, prior, job.future);
        } on JsonRequestError {
          // A historical snapshot may be unavailable. Use the current one.
        }
        if (!_current(job)) return;
        if (verified != null && verified.id == last!.context['reportId']) {
          final restored = await service.prepare(
            _periodInput(prior.period, prior.zone),
            prior.start,
            {'snapshotId': prior.snapshotId},
            job.future,
          );
          if (!_current(job)) return;
          published = verified;
          archivedWindow = restored;
          _archivedZone = prior.zone;
          reportSaved = true;
          _resumeLatest = false;
          return;
        }
      }
      _resumeLatest = false;
    }
    final serverReport = await service.api.latest(owner, key, job.future);
    if (!_current(job) || serverReport == null) return;
    published = serverReport;
    final mirrored = await accounts.reports.latest(
      owner,
      ReportKind.fortune,
      contextKey: plan.contextKey,
    );
    if (!_current(job)) return;
    if (mirrored?.context['reportId'] == serverReport.id) {
      reportSaved = true;
    } else {
      await _mirrorReport(service, serverReport, input, at, job);
    }
  }

  Future<void> generate({Map<String, Object?>? returnLocation}) async {
    final service = online;
    final accounts = account;
    if (service == null ||
        accounts == null ||
        !canGenerate ||
        !_sessionMatches ||
        needsAiAuthorization) {
      return;
    }
    final job = _work;
    final at = referenceTime!.millisecondsSinceEpoch;
    final snapshot = archive!.entry.id;
    final input = _periodInput(period, display!.zone, prepared!.target);
    generating = true;
    generationError = null;
    _authorizationRequired = false;
    returnLocationRejected = false;

    // The service can return a cached or no-match report without using AI.
    var hadPermission = _canUseAi;
    final stopped = Completer<void>();
    bool isCurrent() =>
        _current(job) && _sessionMatches && !stopped.isCompleted;
    void stopIfStale() {
      if (stopped.isCompleted) return;
      if (!_current(job) || !_sessionMatches) {
        stopped.complete();
      } else if (hadPermission && !_canUseAi) {
        _authorizationRequired = true;
        stopped.complete();
      }
      hadPermission = hadPermission || _canUseAi;
    }

    final cancel = Future.any([job.future, stopped.future]);
    _emit();
    try {
      accounts.addListener(stopIfStale);
      final PublishedFortune report;
      try {
        stopIfStale();
        if (!isCurrent()) return;
        final run = returnLocation == null && _calculation != null
            ? _calculation!
            : await service.calculate(
                input,
                ownerId!,
                snapshot,
                archive!.snapshot!,
                cancel,
                returnLocation: returnLocation,
              );
        if (!isCurrent()) return;
        if (returnLocation == null) _calculation = run;
        report = await service.api.interpret(
          ownerId!,
          snapshot,
          period,
          run,
          cancel,
        );
      } finally {
        accounts.removeListener(stopIfStale);
      }
      if (!isCurrent()) return;
      published = report;
      archivedWindow = null;
      _archivedZone = null;
      advice = null;
      adviceError = null;
      reportSaved = false;
      await _mirrorReport(service, report, input, at, job);
    } catch (error) {
      if (isCurrent()) {
        if (error is JsonRequestError && error.status == 428) {
          _authorizationRequired = true;
          await accounts.initialize();
          if (isCurrent() && !needsAiAuthorization) {
            generationError = '暂时无法确认运势在线解读授权，请重试。';
          }
        } else {
          returnLocationRejected = error is FortuneReturnLocationUnavailable;
          generationError = returnLocationRejected
              ? '这个地点无法确定可靠的回归上升。可以调整经纬度，或清空后生成常规解读。'
              : '暂时无法生成运势解读，请重试。';
          _recoverIdentity(error);
        }
      }
    } finally {
      if (_current(job)) {
        generating = false;
        _emit();
      }
    }
  }

  Future<void> getAdvice() async {
    final service = online;
    final current = published;
    if (service == null ||
        busy ||
        !_sessionMatches ||
        displayedPeriod != FortunePeriod.day ||
        (current == null && !canGenerate))
      return;
    final job = _work;
    final snapshot = current?.snapshotId ?? archive!.entry.id;
    loadingAdvice = true;
    adviceError = null;
    _emit();
    try {
      final run =
          current?.runId ??
          _calculation ??
          await service.calculate(
            _periodInput(period, display!.zone, prepared!.target),
            ownerId!,
            snapshot,
            archive!.snapshot!,
            job.future,
          );
      if (!_current(job) || !_sessionMatches) return;
      if (current == null) _calculation = run;
      final groups = await service.api.advice(
        ownerId!,
        snapshot,
        run,
        job.future,
      );
      if (_current(job) && _sessionMatches) advice = groups;
    } catch (error) {
      if (_current(job)) {
        adviceError = '暂时无法获取建议。';
        _recoverIdentity(error);
      }
    } finally {
      if (_current(job)) {
        loadingAdvice = false;
        _emit();
      }
    }
  }

  bool canReadArchivedAdvice(ArchivedReport report) =>
      !_closed &&
      _sessionMatches &&
      online != null &&
      FortuneWindowKey.fromArchive(report.context)?.period ==
          FortunePeriod.day &&
      isFortuneRecordId(report.context['calculationRunId']);

  Future<List<FortuneAdviceGroup>> readArchivedAdvice(
    ArchivedReport report,
    Future<void> cancel,
  ) async {
    if (!canReadArchivedAdvice(report)) {
      throw StateError('Archived fortune advice is unavailable.');
    }
    final key = FortuneWindowKey.fromArchive(report.context)!;
    try {
      return await online!.api.advice(
        ownerId!,
        key.snapshotId,
        report.context['calculationRunId'] as String,
        cancel,
      );
    } catch (error) {
      if (!_closed && _sessionMatches) _recoverIdentity(error);
      rethrow;
    }
  }

  Future<({DateTime first, DateTime last, String zone})?> archivedDates(
    ArchivedReport report,
  ) async {
    final key = FortuneWindowKey.fromArchive(report.context);
    final end = report.context['windowEnd'];
    if (key == null || end is! int || end <= key.start) return null;
    try {
      final clock = display?.zone == key.zone
          ? display!.clock
          : await fortuneDisplayClock(key.zone);
      return (
        first: DateTime.fromMillisecondsSinceEpoch(
          clock(key.start),
          isUtc: true,
        ),
        last: DateTime.fromMillisecondsSinceEpoch(clock(end - 1), isUtc: true),
        zone: key.zone,
      );
    } on FormatException {
      return null;
    } on RangeError {
      return null;
    }
  }

  Future<void> _mirrorReport(
    FortuneOnline service,
    PublishedFortune report,
    Map<String, Object?> input,
    int at,
    Completer<void> job,
  ) async {
    final draft = await service.archive(report, input, at, job.future);
    if (!_current(job) || !_sessionMatches) return;
    _draft = draft;
    await _save(job);
  }

  Future<void> retrySave() => _save(_work);

  Future<void> _save(Completer<void> job) async {
    final draft = _draft;
    if (saving || draft == null || !_sessionMatches) return;
    saving = true;
    _emit();
    try {
      await account!.reports.save(ownerId!, ReportKind.fortune, draft);
      if (_current(job) && _sessionMatches) {
        _draft = null;
        reportSaved = true;
      }
    } catch (error) {
      if (_current(job)) _recoverIdentity(error);
    } finally {
      if (_current(job)) {
        saving = false;
        _emit();
      }
    }
  }

  bool _current(Completer<void> job) => !_closed && identical(_work, job);
  bool get _sessionMatches =>
      account?.sessionChanging == false &&
      account?.authorizedSession?.id == ownerId;

  Map<String, Object?> _periodInput(
    FortunePeriod period,
    String zone, [
    Map<String, Object?>? target,
  ]) => {
    'periodType': period.name,
    'displayTimezone': zone,
    if (target != null) 'targetPeriod': target,
  };

  void _recoverIdentity(Object error) {
    if (error is JsonRequestError &&
        (error.status == 401 || error.status == 403)) {
      archive = null;
      _clearReport();
      archiveError = '账号会话已失效，请重新连接。';
      _emit();
      unawaited(_refreshPreview());
      unawaited(account?.initialize());
    }
  }

  void _clearReport() {
    _work.complete();
    _work = Completer<void>();
    _reportRevision++;
    _reportKey = null;
    savedReport = null;
    loadingReport = false;
    reportError = null;
    published = null;
    prepared = null;
    archivedWindow = null;
    _archivedZone = null;
    generationError = null;
    _authorizationRequired = false;
    returnLocationRejected = false;
    adviceError = null;
    advice = null;
    generating = false;
    loadingAdvice = false;
    saving = false;
    reportSaved = false;
    _draft = null;
    _calculation = null;
  }

  Future<void> _refreshPreview() async {
    final instant = referenceTime?.millisecondsSinceEpoch;
    final zone = display?.zone;
    if (instant == null || zone == null) return;
    _cancelPreview();
    final work = _previewWork = Completer<void>();
    preview = null;
    almanac = null;
    previewError = null;
    loadingPreview = true;
    _emit();
    try {
      final result = await local.preview(
        instant,
        period,
        zone,
        archive,
        work.future,
      );
      if (_previewWork != work) return;
      preview = result.preview;
      almanac = result.almanac;
      unawaited(readReport());
    } catch (_) {
      if (_previewWork != work) return;
      previewError = '暂时无法计算当前运势日期，请重试。';
    } finally {
      if (_previewWork == work) {
        _previewWork = null;
        loadingPreview = false;
        _emit();
      }
    }
  }

  void _cancelPreview() {
    _previewWork?.complete();
    _previewWork = null;
    loadingPreview = false;
  }

  void _emit() {
    if (!_closed) notifyListeners();
  }

  @override
  void dispose() {
    _closed = true;
    _cancelPreview();
    _work.complete();
    online?.api.close();
    super.dispose();
  }
}
