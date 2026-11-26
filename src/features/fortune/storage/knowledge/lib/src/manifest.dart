import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:jovian_json/jovian_json.dart';

const knowledgeManifestFile = 'fortune_knowledge.json';
const _topics = ['overall', 'wealth', 'romance'];
const _stems = '甲乙丙丁戊己庚辛壬癸';
const _branches = '子丑寅卯辰巳午未申酉戌亥';
final _pillars = {
  for (var index = 0; index < 60; index++)
    _stems[index % 10] + _branches[index % 12],
};

String knowledgeDigest(List<int> bytes) => sha256.convert(bytes).toString();
String knowledgeJsonDigest(Object? value) =>
    knowledgeDigest(utf8.encode(legacyJson(value)));

bool _nonEmpty(Object? value) => value is String && value.trim().isNotEmpty;
bool _nullableText(Object? value) => value == null || value is String;
bool _string(Object? value) => value is String;
bool _number(Object? value) => value is num && value.isFinite;
bool _scalar(Object? value) => value is String || _number(value);
bool _array(
  Object? value,
  bool Function(Object?) predicate, {
  bool nonEmpty = false,
}) =>
    value is List && (!nonEmpty || value.isNotEmpty) && value.every(predicate);
bool _strings(Object? value) => _array(value, _string);

FortuneJson toRuntimeKnowledgeEntry(FortuneKnowledgeEntry entry) {
  final source = entry.source;
  final legacy = entry.legacy;
  final legacySource = legacy?['source'] as FortuneJson?;
  final advice = entry.advice;
  final original = entry.matchConditions['original'];
  return {
    'id': entry.runtimeId,
    'title': legacy?['title'] ?? source['locator'],
    'category': {
      'kind': entry.kind,
      'topic': knowledgeRuntimeTopic(entry.topic, legacy?['topic'] as String?),
      'tags': legacy?['tags'] ?? [],
    },
    'source': {
      'book': source['book'],
      'author': legacySource?['author'],
      'edition': legacySource?['edition'] ?? '',
      'volume': legacySource?['volume'],
      'chapter': legacySource?['chapter'] ?? '',
      'section': legacySource?['section'],
      'url': source['url'] ?? '',
      'passage_id': legacySource?['passage_id'] ?? source['locator'],
    },
    'evidence': {
      'original_text': entry.data['originalText'] ?? '',
      'context': legacy?['context'] ?? '',
    },
    'conditions': {
      'original': original,
      'normalized': legacy?['normalized'] ?? original,
      'uncertain': legacy?['uncertain'] ?? [],
      'excluded': legacy?['excluded'] ?? [],
    },
    'interpretation': {
      'classical_meaning': entry.data['modernInterpretation'] ?? '',
      'limitations': legacy?['limitations'] ?? [],
      if (advice != null)
        'advice': {
          'kind': advice['kind'],
          'options': advice['options'],
          'basis': advice['basis'],
        },
    },
    'reportTopic': entry.topic,
  };
}

FortuneKnowledgeManifest parseFortuneKnowledgeManifest(List<int> bytes) {
  final raw = jsonDecode(utf8.decode(bytes));
  if (raw is! FortuneJson || raw['adviceGroups'] is! List) _invalidManifest();
  final version = raw['schemaVersion'];
  final source = <Object?>[];
  if (version == 1 && raw.length == 3 && raw['entries'] is List) {
    source.addAll(raw['entries'] as List);
  } else {
    final collections = [...knowledgePeriods, 'advice'];
    if (version != 2 ||
        raw.length != collections.length + 2 ||
        !collections.every((key) => raw[key] is List))
      _invalidManifest();
    for (final key in collections) {
      for (final row in raw[key] as List) {
        final category = row is FortuneJson ? row['category'] : null;
        if (category is! FortuneJson ||
            (key == 'advice'
                ? category['contentType'] != '建议'
                : category['contentType'] != '解读' ||
                      category['period'] != key)) {
          throw FormatException(
            'Invalid fortune knowledge collection: $key / ${row is FortuneJson ? row['id'] : null}',
          );
        }
        source.add(row);
      }
    }
  }
  if (source.isEmpty) _invalidManifest();
  final ids = <int>{};
  final runtimeIds = <String>{};
  final result = <FortuneKnowledgeEntry>[];
  for (final value in source) {
    final entry = _validateEntry(value);
    if (!ids.add(entry.id) || !runtimeIds.add(entry.runtimeId)) {
      throw FormatException(
        'Invalid fortune knowledge entry: duplicate ID ${entry.id}',
      );
    }
    result.add(entry);
  }
  if (version == 2) result.sort((a, b) => a.id.compareTo(b.id));
  final groups = raw['adviceGroups'] as List;
  if (!groups.every((group) => group is FortuneJson)) _invalidManifest();
  return FortuneKnowledgeManifest(
    (version as num).toInt(),
    result,
    groups.cast<FortuneJson>(),
  );
}

Never _invalidManifest() => throw const FormatException(
  'Invalid fortune knowledge source: $knowledgeManifestFile',
);

FortuneKnowledgeEntry _validateEntry(Object? value) {
  if (value is! FortuneJson)
    throw const FormatException('Invalid fortune knowledge entry.');
  final id = value['id'];
  Never invalid(String part) =>
      throw FormatException('Invalid fortune knowledge $part: $id');
  final source = value['source'];
  final category = value['category'];
  final conditions = value['matchConditions'];
  if (id is! num ||
      !id.isFinite ||
      id != id.truncate() ||
      id < 1 ||
      id > 9007199254740991 ||
      (value.containsKey('legacyId') && !_nonEmpty(value['legacyId'])) ||
      source is! FortuneJson ||
      !_nonEmpty(source['book']) ||
      !_nonEmpty(source['locator']) ||
      !source.containsKey('url') ||
      !_nullableText(source['url']) ||
      category is! FortuneJson ||
      !knowledgeMethods.contains(category['method']) ||
      !_topics.contains(category['topic']) ||
      !const ['解读', '建议'].contains(category['contentType']) ||
      !value.containsKey('originalText') ||
      !_nullableText(value['originalText']) ||
      !value.containsKey('modernInterpretation') ||
      !_nullableText(value['modernInterpretation']) ||
      conditions is! FortuneJson ||
      !_strings(conditions['original'])) {
    invalid('entry');
  }
  final period = category['period'];
  if (!(knowledgePeriods.contains(period) ||
          (category['contentType'] == '建议' &&
              category.containsKey('period') &&
              period == null)) ||
      (period == 'hour'
          ? !knowledgeHourBases.contains(category['hourBasis'])
          : category.containsKey('hourBasis'))) {
    invalid('period');
  }
  final legacy = value['legacy'];
  if (value.containsKey('legacy') &&
      (legacy is! FortuneJson ||
          const [
            'title',
            'topic',
            'context',
          ].any((key) => legacy.containsKey(key) && legacy[key] is! String) ||
          const [
            'tags',
            'normalized',
            'uncertain',
            'excluded',
            'limitations',
          ].any((key) => legacy.containsKey(key) && !_strings(legacy[key])) ||
          (legacy.containsKey('source') &&
              (legacy['source'] is! FortuneJson ||
                  !(legacy['source'] as FortuneJson).values.every(
                    _nullableText,
                  ))))) {
    invalid('legacy metadata');
  }
  final advice = value['advice'];
  if (category['contentType'] == '建议'
      ? advice is! FortuneJson ||
            !const ['数字', '饰品', '颜色'].contains(advice['kind']) ||
            !_array(advice['options'], _nonEmpty, nonEmpty: true) ||
            advice['basis'] is! String
      : value.containsKey('advice')) {
    invalid('advice');
  }
  final data = FortuneKnowledgeEntry(value);
  _validateRules(data, invalid);
  return data;
}

void _validateRules(
  FortuneKnowledgeEntry entry,
  Never Function(String) invalid,
) {
  final status = entry.matchConditions['status'];
  final rule = entry.matchConditions['formatted'];
  if (rule is! FortuneJson ||
      rule['queries'] is! List ||
      rule['unless'] is! List ||
      !_strings(rule['unresolved']))
    invalid('rule');
  final mapped = status == 'mapped';
  final queries = rule['queries'] as List;
  if (!mapped && status != 'unmapped' ||
      (mapped && (entry.kind != '解读' || queries.isEmpty)))
    invalid('rule status');
  if (mapped &&
      (!_nonEmpty(entry.data['originalText']) ||
          !(entry.matchConditions['original'] as List).any(_nonEmpty))) {
    throw FormatException(
      'Fortune mapped rule requires original text and conditions: ${entry.id}',
    );
  }
  if (!queries.every(_validQuery) ||
      !(rule['unless'] as List).every(_validQuery))
    invalid('query');
  if (rule.containsKey('sourceConditions') &&
      (!mapped ||
          (rule['unresolved'] as List).isNotEmpty ||
          !_array(rule['sourceConditions'], _nonEmpty, nonEmpty: true))) {
    invalid('source conditions');
  }
  final review = rule['review'];
  if (rule.containsKey('review')) _validateReview(entry, review);
  if (!rule.containsKey('confirmedWhen')) return;
  final branches = knowledgeConfirmations(rule['confirmedWhen']);
  if (entry.kind != '解读' ||
      branches.isEmpty ||
      !branches.every(
        (query) =>
            _validQuery(query) &&
            query is FortuneJson &&
            _array(query['sourceConditions'], _nonEmpty, nonEmpty: true),
      )) {
    invalid('confirmation');
  }
  final confirmations = branches.cast<FortuneJson>();
  if (confirmations.any((query) => query.containsKey('sourceExcerpt'))) {
    final text = entry.data['originalText'] as String?;
    final excerpts = review is FortuneJson
        ? review['additionalSourceExcerpts'] as List?
        : null;
    if (!confirmations.every((query) {
      final excerpt = query['sourceExcerpt'];
      return excerpt is String &&
          _nonEmpty(excerpt) &&
          (text?.contains(excerpt) == true ||
              excerpts?.contains(excerpt) == true);
    }))
      invalid('confirmation excerpt');
  }
}

List<Object?> knowledgeConfirmations(Object? value) => value is List
    ? value.cast<Object?>()
    : value == null
    ? []
    : [value];

bool _validQuery(Object? value) {
  if (value is! FortuneJson ||
      !_nonEmpty(value['factType']) ||
      !_validFilter(value['where']))
    return false;
  final duration = value['minimumDurationHours'];
  return (!value.containsKey('minimumDurationHours') ||
          (duration is num && duration.isFinite && duration > 0)) &&
      (!value.containsKey('scope') ||
          knowledgeScopes.contains(value['scope'])) &&
      (!value.containsKey('scopes') ||
          _array(value['scopes'], knowledgeScopes.contains, nonEmpty: true)) &&
      (!value.containsKey('anyOf') ||
          _array(value['anyOf'], _validFilter, nonEmpty: true));
}

bool _validFilter(Object? value) {
  if (value is! FortuneJson) return false;
  return value.values.every((item) {
    if (_scalar(item) || item is bool) return true;
    if (item is! FortuneJson || item.length != 1) return false;
    final pair = item.entries.single;
    return switch (pair.key) {
      'includes' => _scalar(pair.value),
      'gte' => _number(pair.value),
      'includesAll' ||
      'includesAny' ||
      'oneOf' => _array(pair.value, _scalar, nonEmpty: true),
      _ => false,
    };
  });
}

void _validateReview(FortuneKnowledgeEntry entry, Object? review) {
  final runtime = toRuntimeKnowledgeEntry(entry);
  if (review is! FortuneJson ||
      review['sourcePassageId'] !=
          (runtime['source'] as FortuneJson)['passage_id'] ||
      review['sourceHash'] !=
          knowledgeJsonDigest({
            'evidence': runtime['evidence'],
            'conditions': runtime['conditions'],
          }) ||
      !_array(review['mappedConditions'], _string, nonEmpty: true)) {
    throw FormatException(
      'Fortune rule source review is stale: ${entry.runtimeId}',
    );
  }
  if (review.containsKey('ruleHash')) {
    final conditions = {...entry.formatted}..remove('review');
    if (review['ruleHash'] !=
        knowledgeJsonDigest({
          'category': entry.category,
          'conditions': conditions,
        })) {
      throw FormatException(
        'Fortune reviewed rule conditions changed: ${entry.runtimeId}',
      );
    }
  }
  if (review.containsKey('additionalSourceExcerpts') &&
      (!_nonEmpty(entry.source['url']) ||
          !_array(
            review['additionalSourceExcerpts'],
            _nonEmpty,
            nonEmpty: true,
          ))) {
    throw FormatException(
      'Invalid fortune knowledge additional source excerpts: ${entry.runtimeId}',
    );
  }
  if (review.containsKey('printedLuck') &&
      !_array(review['printedLuck'], _printedLuck, nonEmpty: true)) {
    throw FormatException('Invalid printed luck review: ${entry.runtimeId}');
  }
}

bool _printedLuck(Object? record) {
  if (record is! FortuneJson ||
      !_nonEmpty(record['name']) ||
      !_nonEmpty(record['premise']))
    return false;
  final sequence = record['natalPillarSequence'];
  return sequence is String &&
      sequence.length == 8 &&
      [
        0,
        2,
        4,
        6,
      ].every((i) => _pillars.contains(sequence.substring(i, i + 2))) &&
      _array(
        record['periods'],
        (period) =>
            period is FortuneJson &&
            _nonEmpty(period['assessment']) &&
            _array(period['pillars'], _pillars.contains, nonEmpty: true),
        nonEmpty: true,
      );
}

FortuneJson interpretationRule(FortuneKnowledgeEntry entry) {
  final formatted = entry.formatted;
  final mapped = entry.matchConditions['status'] == 'mapped';
  final unresolved = formatted['unresolved'] as List;
  final legacy = entry.legacy;
  return {
    'knowledgeId': entry.runtimeId,
    'period': entry.period,
    if (entry.hourBasis case final basis?) 'hourBasis': basis,
    'queries': mapped ? formatted['queries'] : [],
    if (mapped && (formatted['unless'] as List).isNotEmpty)
      'unless': formatted['unless'],
    if (mapped && formatted.containsKey('confirmedWhen'))
      'confirmedWhen': formatted['confirmedWhen'],
    if (formatted.containsKey('sourceConditions'))
      'sourceConditions': formatted['sourceConditions'],
    'unresolved': mapped || unresolved.isNotEmpty
        ? unresolved
        : [
            '机器匹配规则尚未接入。',
            if (legacy == null)
              ...(entry.matchConditions['original'] as List)
            else ...[
              ...?legacy['normalized'] as List?,
              ...?legacy['uncertain'] as List?,
            ],
          ],
    if (formatted.containsKey('review')) 'review': formatted['review'],
  };
}
