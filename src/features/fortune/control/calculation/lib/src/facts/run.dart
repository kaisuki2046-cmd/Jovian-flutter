import 'dart:convert';
import 'dart:math' as math;

import 'package:jovian_fortune_model/jovian_fortune_model.dart';

import '../almanac.dart';
import '../display_window.dart';
import '../fact_time_context.dart';
import 'bazi.dart';
import 'context.dart';

const fortuneFactLayerVersion = 'fortune-dart-calculation-fact-layer-v1';

class FortuneFactRun {
  const FortuneFactRun({
    required this.runId,
    required this.time,
    required this.methods,
    required this.facts,
    required this.rawFacts,
    this.reference,
  });

  final String runId;
  final FortuneFactTime time;
  final Map<FortuneMethod, FortuneMethodResult> methods;
  final List<FortuneFact> facts;
  final List<FortuneRawFact> rawFacts;
  final FortuneChartReference? reference;

  FortuneJson toJson() => {
    'version': fortuneFactLayerVersion,
    'calculationRunId': runId,
    'time': time.toJson(),
    'methods': {
      for (final row in methods.entries) row.key.name: row.value.toJson(),
    },
    'facts': facts.map((fact) => fact.toJson()).toList(),
    'rawFacts': rawFacts.map((fact) => fact.toJson()).toList(),
    'factGroups': {
      for (final method in FortuneMethod.values)
        method.name: {
          'factIds': [
            for (final fact in facts)
              if (fact.method == method) fact.id,
          ],
          'rawFactIds': [
            for (final fact in rawFacts)
              if (fact.method == method) fact.id,
          ],
        },
    },
    if (reference case final chart?) ...{
      'natalChartSnapshotId': chart.snapshotId,
      if (chart.profileId != null) 'profileId': chart.profileId,
      if (chart.profileVersion != null)
        'birthProfileVersion': chart.profileVersion,
      if (chart.createdAt != null) 'archivedAt': chart.createdAt,
    },
    'engines': {
      for (final MapEntry(key: method, value: policy)
          in fortuneFactPolicies.entries)
        method.name: {
          'engine': policy.engine,
          'version': policy.version,
          'rules': policy.rules,
          'timeZone': policy.timeZone,
        },
    },
  };
}

/// Calculates one run from the chart the account layer authorized for this use.
Future<FortuneFactRun> calculateFortuneFacts({
  required FortuneFactTime time,
  required String runId,
  FortuneChartReference? reference,
  Future<int Function(int)> Function(String) loadBirthClock =
      fortuneDisplayClock,
}) async {
  if (runId.isEmpty ||
      time.referenceAt < time.window.start ||
      time.referenceAt >= time.window.end) {
    throw const FormatException('Invalid fortune fact run');
  }
  final methods = <FortuneMethod, FortuneMethodResult>{};
  final facts = <FortuneFact>[];
  final rawFacts = <FortuneRawFact>[];
  for (final method in FortuneMethod.values) {
    if (!fortuneMethodEnabled(time.period, method)) {
      methods[method] = const FortuneMethodResult(
        FortuneMethodStatus.notSupported,
      );
      continue;
    }
    if (!fortuneFactPolicies.containsKey(method)) {
      methods[method] = const FortuneMethodResult(
        FortuneMethodStatus.unavailable,
        warnings: ['本方法的盘面事实仍在迁移'],
      );
      continue;
    }
    final writer = FortuneFactWriter(method, time.period, runId, reference);
    try {
      final methodResult = switch (method) {
        FortuneMethod.bazi => writeBaZiFacts(
          writer,
          time,
          birthWallClock: await _readBirthClock(reference, loadBirthClock),
        ),
        FortuneMethod.almanac => _writeAlmanac(writer, time),
        _ => throw StateError('No fortune fact writer for ${method.name}'),
      };
      validateFortuneFacts(time.window, writer.facts, writer.rawFacts);
      facts.addAll(writer.facts);
      rawFacts.addAll(writer.rawFacts);
      methods[method] = methodResult;
    } on Object {
      methods[method] = const FortuneMethodResult(
        FortuneMethodStatus.failed,
        warnings: ['术数计算或事实校验失败'],
      );
    }
  }
  return FortuneFactRun(
    runId: runId,
    time: time,
    reference: reference,
    methods: Map.unmodifiable(methods),
    facts: List.unmodifiable(facts),
    rawFacts: List.unmodifiable(rawFacts),
  );
}

Future<int Function(int)?> _readBirthClock(
  FortuneChartReference? reference,
  Future<int Function(int)> Function(String) load,
) async {
  final chart = reference?.chart;
  final context = chart?['birthContext'];
  if (chart?['timeKnown'] != true ||
      context is! FortuneJson ||
      context['timeZone'] is! String)
    return null;
  try {
    return await load(context['timeZone'] as String);
  } on Exception {
    // Unresolved civil clocks do not establish a verified birth instant.
    return null;
  }
}

FortuneMethodResult _writeAlmanac(
  FortuneFactWriter writer,
  FortuneFactTime time,
) {
  if (time.period != FortunePeriod.day) {
    return const FortuneMethodResult(
      FortuneMethodStatus.unavailable,
      warnings: ['通用黄历按天提供'],
    );
  }
  var complete = true;
  for (var start = time.window.start; start < time.window.end;) {
    final day = buildAlmanacDay(start);
    final midnight = DateTime.parse(
      '${day.date}T00:00:00+08:00',
    ).millisecondsSinceEpoch;
    final end = math.min(
      time.window.end,
      midnight + Duration.millisecondsPerDay,
    );
    final payload = day.toJson();
    writer.add(
      DisplayWindow(start, end),
      type: 'general_almanac',
      scope: FortuneFactScope.almanac,
      subjects: [day.date],
      payload: payload,
      sources: [writer.raw(payload)],
      completeness: day.complete
          ? FortuneCompleteness.complete
          : FortuneCompleteness.partial,
    );
    complete = complete && day.complete;
    start = end;
  }
  return FortuneMethodResult(
    complete ? FortuneMethodStatus.completed : FortuneMethodStatus.partial,
  );
}

typedef FortuneFactEligibility = ({
  List<FortuneFact> compatible,
  Set<FortuneMethod> incompatible,
  Map<FortuneMethod, Set<String>> subjects,
  List<List<FortuneFact>> agreedTenGods,
});

FortuneFactEligibility eligibleFortuneFacts(FortuneFactRun run) {
  final window = run.time.window;
  validateFortuneFacts(window, run.facts, run.rawFacts);
  final reference = run.reference;
  final subjects = <FortuneMethod, Set<String>>{};
  final inWindow = <FortuneFact>[];
  final incompatible = <FortuneMethod>{};
  for (final fact in run.facts) {
    final method = fact.method;
    if (method == FortuneMethod.almanac ||
        !fortuneMethodEnabled(run.time.period, method))
      continue;
    final candidates = subjects.putIfAbsent(method, () => {});
    final candidate = _candidateSubject(fact);
    if (candidate != null) candidates.add(candidate);
    final status = run.methods[method];
    if (reference == null ||
        fact.completeness == FortuneCompleteness.unavailable ||
        !const [
          FortuneMethodStatus.completed,
          FortuneMethodStatus.completedWithWarnings,
          FortuneMethodStatus.partial,
        ].contains(status?.status))
      continue;
    if (fact.runId != run.runId ||
        fact.profileId != reference.profileId ||
        fact.snapshotId != reference.snapshotId ||
        fact.period != run.time.period ||
        fact.policy != fortuneFactPolicies[method]) {
      incompatible.add(method);
      continue;
    }
    if (candidate != null &&
        method == FortuneMethod.ziwei &&
        status!.warnings.contains('候选盘分别保留'))
      continue;
    inWindow.add(fact);
  }
  final compatible = <FortuneFact>[];
  final tenGods = <String, List<FortuneFact>>{};
  for (final fact in inWindow) {
    if (incompatible.contains(fact.method)) continue;
    if (_candidateSubject(fact) == null || subjects[fact.method]!.length <= 1) {
      compatible.add(fact);
    } else if (fact.method == FortuneMethod.bazi &&
        fact.type == 'ten_god' &&
        fact.completeness == FortuneCompleteness.complete) {
      final fields = [
        for (final key in ['dayMaster', 'stem', 'tenGod']) fact.payload[key],
      ];
      if (!fields.every((value) => value is String && value.isNotEmpty))
        continue;
      final key = jsonEncode([
        fact.scope.name,
        fact.start,
        fact.end,
        ...fields,
      ]);
      (tenGods[key] ??= []).add(fact);
    }
  }
  return (
    compatible: compatible,
    incompatible: incompatible,
    subjects: subjects,
    agreedTenGods: [
      for (final group in tenGods.values)
        if (group.map(_candidateSubject).toSet().length ==
            subjects[FortuneMethod.bazi]?.length)
          group,
    ],
  );
}

String? _candidateSubject(FortuneFact fact) {
  final prefix = '${fact.method.name}:candidate:';
  return fact.subjects.where((id) => id.startsWith(prefix)).firstOrNull;
}
