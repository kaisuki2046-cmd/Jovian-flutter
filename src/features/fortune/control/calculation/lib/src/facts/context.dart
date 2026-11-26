import 'package:jovian_fortune_model/jovian_fortune_model.dart';

const fortuneBaZiPolicy = (
  engine: 'lunar',
  version: '1.7.9',
  rules: 'fortune-bazi-layers-beijing-sect2-v2',
  timeZone: 'Asia/Shanghai',
);
const fortuneAlmanacPolicy = (
  engine: 'lunar',
  version: '1.7.9',
  rules: 'fortune-almanac-beijing-noon-v1',
  timeZone: 'Asia/Shanghai',
);

const fortuneFactPolicies = {
  FortuneMethod.bazi: fortuneBaZiPolicy,
  FortuneMethod.almanac: fortuneAlmanacPolicy,
};

bool fortuneMethodEnabled(FortunePeriod period, FortuneMethod method) =>
    period != FortunePeriod.week || method == FortuneMethod.western;

FortuneJson fortuneUtcRange(int start, int end) => {
  'startInstant': fortuneIsoUtc(start),
  'endInstantExclusive': fortuneIsoUtc(end),
};

class FortuneFactWriter {
  FortuneFactWriter(this.method, this.period, this.runId, this.reference)
    : policy = fortuneFactPolicies[method]!;

  final FortuneMethod method;
  final FortunePeriod period;
  final FortuneFactPolicy policy;
  final String runId;
  final FortuneChartReference? reference;
  final facts = <FortuneFact>[];
  final rawFacts = <FortuneRawFact>[];

  String raw(FortuneJson payload) {
    final id = '$runId:${method.name}:raw:${rawFacts.length}';
    rawFacts.add(FortuneRawFact(id, method, payload));
    return id;
  }

  void add(
    DisplayWindow interval, {
    required String type,
    required FortuneFactScope scope,
    required List<String> subjects,
    required FortuneJson payload,
    required List<String> sources,
    FortuneFactPrecision precision = FortuneFactPrecision.range,
    FortuneCompleteness completeness = FortuneCompleteness.complete,
    int? exactAt,
    String? parentSignalId,
    List<String> warnings = const [],
  }) {
    final chart = method == FortuneMethod.almanac ? null : reference;
    facts.add(
      FortuneFact(
        id: '$runId:${method.name}:${facts.length}',
        runId: runId,
        period: period,
        method: method,
        policy: policy,
        profileId: chart?.profileId,
        snapshotId: chart?.snapshotId,
        type: type,
        scope: scope,
        subjects: subjects,
        start: interval.start,
        end: interval.end,
        payload: payload,
        sources: sources,
        precision: precision,
        completeness: completeness,
        exactAt: exactAt,
        parentSignalId: parentSignalId,
        warnings: warnings,
      ),
    );
  }
}

void validateFortuneFacts(
  DisplayWindow window,
  List<FortuneFact> facts,
  List<FortuneRawFact> rawFacts,
) {
  final sources = {for (final item in rawFacts) item.id: item.method};
  if (sources.length != rawFacts.length) {
    throw const FormatException('Duplicate raw fact ID');
  }
  final ids = <String>{};
  final signals = <String, FortuneFact>{};
  for (final fact in facts) {
    final policy = fact.policy;
    if (!ids.add(fact.id) ||
        window.start > fact.start ||
        fact.start >= fact.end ||
        fact.end > window.end ||
        fact.subjects.isEmpty ||
        fact.sources.isEmpty ||
        fact.sources.any((id) => sources[id] != fact.method) ||
        policy.engine.isEmpty ||
        policy.version.isEmpty ||
        policy.rules.isEmpty ||
        policy.timeZone.isEmpty) {
      throw const FormatException('Invalid fortune fact');
    }
    if (fact.exactAt case final at? when at < fact.start || at >= fact.end) {
      throw const FormatException('Fortune event outside fact interval');
    }
    if (fact.parentSignalId case final id?) {
      final parent = signals.putIfAbsent(id, () => fact);
      if (parent.method != fact.method ||
          !_sameSubjects(parent.subjects, fact.subjects)) {
        throw const FormatException(
          'Fortune signal combines distinct subjects',
        );
      }
    }
  }
}

bool _sameSubjects(List<String> first, List<String> second) =>
    first.length == second.length &&
    first.indexed.every((item) => item.$2 == second[item.$1]);
