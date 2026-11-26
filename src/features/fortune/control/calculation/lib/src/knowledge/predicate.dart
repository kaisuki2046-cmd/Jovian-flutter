import 'package:jovian_fortune_model/jovian_fortune_model.dart';

/// Returns null when the fact cannot establish whether the condition holds.
/// Fact type and scope are checked by the caller.
bool? evaluateFortunePredicate(FortuneJson fact, FortuneJson query) {
  if (fact['completeness'] != 'complete') return null;
  if (query['minimumDurationHours'] case final num minimum) {
    final from = fact['activeFrom'];
    final to = fact['activeTo'];
    final start = from is String ? DateTime.tryParse(from) : null;
    final end = to is String ? DateTime.tryParse(to) : null;
    if (start == null || end == null) return null;
    if (end.difference(start).inMilliseconds / Duration.millisecondsPerHour <
        minimum) {
      return false;
    }
  }
  final payload = fact['normalizedPayload'] as FortuneJson?;
  final base = _satisfiesFields(payload, query['where'] as FortuneJson);
  final alternatives = query['anyOf'] as List?;
  if (base == false || alternatives == null) return base;
  var unknown = false;
  for (final branch in alternatives.cast<FortuneJson>()) {
    final outcome = _satisfiesFields(payload, branch);
    if (outcome == true) return base;
    if (outcome == null) unknown = true;
  }
  return unknown ? null : false;
}

bool? _satisfiesFields(FortuneJson? payload, FortuneJson where) {
  var unknown = false;
  for (final MapEntry(:key, :value) in where.entries) {
    final actual = payload?[key];
    if (actual == null) {
      unknown = true;
    } else if (!_satisfiesValue(actual, value)) {
      return false;
    }
  }
  return unknown ? null : true;
}

bool _satisfiesValue(Object actual, Object? expected) {
  if (expected is! FortuneJson) return actual == expected;
  return switch (expected.entries.single) {
    MapEntry(key: 'includes', :final value) =>
      actual is List && actual.contains(value),
    MapEntry(key: 'includesAll', value: final List values) =>
      actual is List && values.every(actual.contains),
    MapEntry(key: 'includesAny', value: final List values) =>
      actual is List && values.any(actual.contains),
    MapEntry(key: 'oneOf', value: final List values) => values.contains(actual),
    MapEntry(key: 'gte', value: final num minimum) =>
      actual is num && actual >= minimum,
    _ => false,
  };
}
