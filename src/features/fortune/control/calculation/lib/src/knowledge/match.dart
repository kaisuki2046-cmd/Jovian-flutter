import 'dart:math' as math;

import 'package:jovian_fortune_model/jovian_fortune_model.dart';

import '../display_window.dart';

const fortuneKnowledgeMatcherVersion = 'fortune-knowledge-matcher-v15';

typedef _Window = ({int start, int end});

/// Resolves indexed rule conditions into windows for one calculation method.
/// The catalog evaluates only the facts the caller has approved for this run.
List<FortuneJson> matchFortuneKnowledgeWindows({
  required String method,
  required String period,
  required DisplayWindow display,
  required int Function(int) wallClock,
  required List<FortuneJson> rules,
}) {
  final limit = (start: display.start, end: display.end);
  return [
    for (final rule in rules)
      _matchRule(method, period, rule, limit, wallClock),
  ];
}

FortuneJson _matchRule(
  String method,
  String period,
  FortuneJson rule,
  _Window limit,
  int Function(int) wallClock,
) {
  final unresolved = rule['unresolved'] as List;
  final base = <String, Object?>{
    'knowledgeId': rule['knowledgeId'],
    'method': method,
    'sectionId': rule['reportTopic'],
    'sourceFactIds': <String>[],
    'windows': <FortuneJson>[],
    'missingConditions': <String>[],
    'unresolvedConditions': unresolved,
  };
  if (rule['period'] != period || (period == 'week' && method != 'western')) {
    return {...base, 'status': 'not_applicable'};
  }
  if (rule['queryCount'] == 0) return {...base, 'status': 'unsupported'};
  final required = (rule['required'] as List).cast<FortuneJson>();
  if (required.length != rule['queryCount']) {
    throw StateError('Incomplete fortune rule index: ${rule['knowledgeId']}');
  }
  final groups = required
      .map((condition) => _facts(condition, 'hits'))
      .toList();
  final missing = required.where((query) => _facts(query, 'hits').isEmpty);
  final missingConditions = missing
      .map((condition) => condition['condition'] as String)
      .toList();
  final daily = period == 'day';
  List<_Window> common(List<List<FortuneJson>> sets) =>
      _commonWindows(sets, limit, daily ? wallClock : null);

  final windows = missingConditions.isEmpty ? common(groups) : <_Window>[];
  final exclusions = (rule['exclusions'] as List).cast<FortuneJson>();
  final counter = exclusions
      .expand((query) => _facts(query, 'hits').map(_factWindow))
      .toList();
  final remaining = _subtract(windows, counter);
  // Only erase windows without their own negative exclusion verdict.
  final unverified = _merge([
    for (final query in exclusions)
      if (query['unknown'] == true && remaining.isNotEmpty) ...[
        ..._subtract(remaining, common([_facts(query, 'nonExcludingFacts')])),
        ...common([_facts(query, 'uncertainFacts')]),
      ],
  ]);
  final verified = _subtract(remaining, unverified);
  final status = switch ((
    missing.any((condition) => condition['unknown'] == false),
    missing.any((condition) => condition['unknown'] == true),
    windows.isEmpty,
    remaining.isEmpty,
    verified.isEmpty,
    unresolved.isNotEmpty,
  )) {
    (true, _, _, _, _, _) => 'not_matched',
    (_, true, _, _, _, _) => 'unknown',
    (_, _, true, _, _, _) => 'not_matched',
    (_, _, _, true, _, _) => 'excluded',
    (_, _, _, _, true, _) => 'unknown',
    (_, _, _, _, _, true) => 'partial',
    _ => 'matched',
  };

  final usable = status == 'partial' || status == 'matched';
  final sourceFacts = groups.expand((group) => group);
  final confirmations = (rule['confirmations'] as List).cast<FortuneJson>();
  if (usable && confirmations.isNotEmpty) {
    final confirmed =
        <
          ({
            Object? conditions,
            List<_Window> windows,
            List<String> sourceFactIds,
            String? excerpt,
          })
        >[];
    for (final branch in confirmations) {
      final ids = _facts(branch, 'hits').map((fact) => fact['factId']).toSet();
      if (ids.isEmpty) continue;
      // Confirmation must refine the exact fact used by the base condition.
      final branchGroups = [
        groups.first.where((fact) => ids.contains(fact['factId'])).toList(),
        ...groups.skip(1),
      ];
      final spans = _subtract(common(branchGroups), [
        ...counter,
        ...unverified,
      ]);
      if (spans.isNotEmpty) {
        confirmed.add((
          conditions: branch['sourceConditions'],
          windows: spans,
          sourceFactIds: _factIds(branchGroups.expand((group) => group), spans),
          excerpt: branch['sourceExcerpt'] as String?,
        ));
      }
    }
    if (confirmed.isNotEmpty) {
      final confirmedWindows = _merge(
        confirmed.expand((branch) => branch.windows),
      );
      final candidateWindows = _subtract(remaining, confirmedWindows);
      final confirmedIds = confirmed
          .expand((branch) => branch.sourceFactIds)
          .toSet();
      final candidates = _factIds(
        sourceFacts,
        remaining,
      ).where((id) => !confirmedIds.contains(id)).toList();
      final excerpts = confirmed
          .map((branch) => branch.excerpt)
          .whereType<String>()
          .toSet();
      return {
        ...base,
        'status': 'matched',
        'windows': _jsonWindows(confirmedWindows),
        'sourceFactIds': confirmedIds.toList(),
        if (candidates.isNotEmpty) 'candidateFactIds': candidates,
        if (confirmed.length == 1)
          'matchedConditions': confirmed.single.conditions
        else
          'confirmedBranches': [
            for (final branch in confirmed)
              {
                'conditions': branch.conditions,
                'windows': _jsonWindows(branch.windows),
                'sourceFactIds': branch.sourceFactIds,
              },
          ],
        if (excerpts.isNotEmpty) 'matchedSourceExcerpt': excerpts.join('\n'),
        if (candidateWindows.isNotEmpty)
          'candidateWindows': _jsonWindows(candidateWindows)
        else
          'unresolvedConditions': <String>[],
      };
    }
    if (status == 'matched') {
      return {
        ...base,
        'status': 'unknown',
        'sourceFactIds': _factIds(sourceFacts, remaining),
        'windows': _jsonWindows(remaining),
      };
    }
  }
  final effective = usable ? verified : remaining;
  final evidenceWindows = usable && unverified.isNotEmpty ? effective : windows;
  return {
    ...base,
    'status': status,
    'sourceFactIds': _factIds(sourceFacts, evidenceWindows),
    'windows': _jsonWindows(effective),
    'missingConditions': missingConditions,
    if (rule['sourceConditions'] case final conditions?
        when status == 'matched')
      'matchedConditions': conditions,
  };
}

List<FortuneJson> _facts(FortuneJson query, String key) =>
    (query[key] as List?)?.cast<FortuneJson>() ?? const [];

int _instant(Object? text) =>
    DateTime.parse(text as String).millisecondsSinceEpoch;

_Window _factWindow(FortuneJson fact) =>
    (start: _instant(fact['activeFrom']), end: _instant(fact['activeTo']));

List<_Window> _commonWindows(
  List<List<FortuneJson>> groups,
  _Window limit,
  int Function(int)? dayClock,
) {
  var windows = [limit];
  for (final group in groups) {
    final active = [for (final fact in group) _withinCivilDay(fact, dayClock)];
    windows = _merge([
      for (final window in windows)
        for (final fact in active)
          if (_intersection(window, fact) case final overlap?) overlap,
    ]);
    if (windows.isEmpty) break;
  }
  return windows;
}

_Window _withinCivilDay(FortuneJson fact, int Function(int)? dayClock) {
  final bounds = _factWindow(fact);
  final instant = fact['exactInstant'];
  if (dayClock == null || instant == null) return bounds;
  final day = buildDisplayWindow(
    _instant(instant),
    FortunePeriod.day,
    dayClock,
  );
  return (
    start: math.max(bounds.start, day.start),
    end: math.min(bounds.end, day.end),
  );
}

_Window? _intersection(_Window first, _Window second) {
  final start = math.max(first.start, second.start);
  final end = math.min(first.end, second.end);
  return start < end ? (start: start, end: end) : null;
}

List<_Window> _merge(Iterable<_Window> spans) {
  final sorted = spans.toList()..sort((a, b) => a.start.compareTo(b.start));
  final result = <_Window>[];
  for (final window in sorted) {
    if (result.isEmpty || window.start > result.last.end) {
      result.add(window);
    } else if (window.end > result.last.end) {
      result[result.length - 1] = (start: result.last.start, end: window.end);
    }
  }
  return result;
}

List<_Window> _subtract(List<_Window> windows, List<_Window> excluded) {
  for (final cut in excluded) {
    windows = [
      for (final window in windows)
        if (_intersection(window, cut) == null)
          window
        else ...[
          if (window.start < cut.start) (start: window.start, end: cut.start),
          if (cut.end < window.end) (start: cut.end, end: window.end),
        ],
    ];
  }
  return windows;
}

List<String> _factIds(Iterable<FortuneJson> facts, List<_Window> windows) => {
  for (final fact in facts)
    if (_touchesAny(fact, windows)) fact['factId'] as String,
}.toList();

bool _touchesAny(FortuneJson fact, List<_Window> windows) {
  final bounds = _factWindow(fact);
  return windows.any((window) => _intersection(window, bounds) != null);
}

List<FortuneJson> _jsonWindows(List<_Window> windows) => [
  for (final window in windows)
    {'start': _iso(window.start), 'endExclusive': _iso(window.end)},
];

String _iso(int instant) =>
    DateTime.fromMillisecondsSinceEpoch(instant, isUtc: true).toIso8601String();
