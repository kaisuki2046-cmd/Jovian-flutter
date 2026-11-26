import 'calendar.dart';
import 'knowledge.dart';

enum FortuneMethod { bazi, ziwei, western, almanac }

enum FortuneFactScope {
  natal,
  decadal,
  minor,
  yearly,
  monthly,
  daily,
  transit,
  progressed,
  almanac,
}

enum FortuneFactPrecision { second, minute, day, range }

enum FortuneCompleteness { complete, partial, unavailable }

enum FortuneMethodStatus {
  completed,
  completedWithWarnings,
  partial,
  unavailable,
  failed,
  notSupported;

  String get wireName => switch (this) {
    completedWithWarnings => 'completed_with_warnings',
    notSupported => 'not_supported',
    _ => name,
  };
}

typedef FortuneFactPolicy = ({
  String engine,
  String version,
  String rules,
  String timeZone,
});

class FortuneChartReference {
  const FortuneChartReference({
    required this.snapshotId,
    this.profileId,
    this.profileVersion,
    this.createdAt,
    this.chart,
  });

  final String snapshotId;
  final String? profileId;
  final String? profileVersion;
  final String? createdAt;
  final FortuneJson? chart;
}

class FortuneMethodResult {
  const FortuneMethodResult(
    this.status, {
    this.warnings = const [],
    this.nativeWindow,
  });

  final FortuneMethodStatus status;
  final List<String> warnings;
  final FortuneJson? nativeWindow;

  FortuneJson toJson() => {
    'status': status.wireName,
    'warnings': warnings,
    if (nativeWindow != null) 'nativeWindow': nativeWindow,
  };
}

class FortuneRawFact {
  const FortuneRawFact(this.id, this.method, this.payload);

  final String id;
  final FortuneMethod method;
  final FortuneJson payload;

  FortuneJson toJson() => {
    'rawFactId': id,
    'method': method.name,
    'payload': payload,
  };
}

class FortuneFact {
  const FortuneFact({
    required this.id,
    required this.runId,
    required this.period,
    required this.method,
    required this.policy,
    required this.type,
    required this.scope,
    required this.subjects,
    required this.start,
    required this.end,
    required this.payload,
    required this.sources,
    this.profileId,
    this.snapshotId,
    this.precision = FortuneFactPrecision.range,
    this.completeness = FortuneCompleteness.complete,
    this.exactAt,
    this.parentSignalId,
    this.warnings = const [],
  });

  final String id;
  final String runId;
  final FortunePeriod period;
  final FortuneMethod method;
  final FortuneFactPolicy policy;
  final String type;
  final FortuneFactScope scope;
  final List<String> subjects;
  final int start;
  final int end;
  final FortuneJson payload;
  final List<String> sources;
  final String? profileId;
  final String? snapshotId;
  final FortuneFactPrecision precision;
  final FortuneCompleteness completeness;
  final int? exactAt;
  final String? parentSignalId;
  final List<String> warnings;

  FortuneJson toJson() => {
    'factId': id,
    'calculationRunId': runId,
    if (profileId != null) 'profileId': profileId,
    if (snapshotId != null) 'natalChartSnapshotId': snapshotId,
    'periodType': period.name,
    'method': method.name,
    'activeFrom': fortuneIsoUtc(start),
    'activeTo': fortuneIsoUtc(end),
    'timePrecision': precision.name,
    'timeZone': policy.timeZone,
    'sourceEngine': policy.engine,
    'engineVersion': policy.version,
    'rulesetVersion': policy.rules,
    'completeness': completeness.name,
    'warnings': warnings,
    'scope': scope.name,
    'factType': type,
    'subjectIds': subjects,
    if (exactAt case final at?) 'exactInstant': fortuneIsoUtc(at),
    if (parentSignalId != null) 'parentSignalId': parentSignalId,
    'normalizedPayload': payload,
    'sourceFactIds': sources,
  };
}

String fortuneIsoUtc(int instant) =>
    DateTime.fromMillisecondsSinceEpoch(instant, isUtc: true).toIso8601String();
