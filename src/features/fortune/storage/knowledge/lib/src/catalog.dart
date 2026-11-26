import 'dart:convert';

import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:sqlite3/sqlite3.dart';

import 'manifest.dart';
import 'sql.dart';

FortuneKnowledgeCatalog openFortuneKnowledgeDatabase(String path) =>
    FortuneKnowledgeCatalog._(sqlite3.open(path, mode: OpenMode.readOnly));

/// A read-only catalog that accepts the SQLite artifacts of either runtime.
final class FortuneKnowledgeCatalog {
  FortuneKnowledgeCatalog._(this._database) {
    _database.createFunction(
      functionName: 'fortune_predicate',
      argumentCount: const AllowedArgumentCount(2),
      function: (arguments) {
        final fact = _activeFacts[arguments[0] as int];
        final encoded = arguments[1] as String;
        final query = _predicates.putIfAbsent(
          encoded,
          () => _decodeMap(encoded),
        );
        return switch (evaluateFortunePredicate(fact, query)) {
          true => 1,
          false => 0,
          null => null,
        };
      },
    );
  }

  final Database _database;
  final _predicates = <String, FortuneJson>{};
  List<FortuneJson> _activeFacts = const [];

  String version(String method) {
    final rows = _database.select(
      'SELECT version FROM library WHERE method = ?',
      [method],
    );
    if (rows.isEmpty) throw ArgumentError.value(method, 'method');
    return rows.single['version'] as String;
  }

  FortuneJson library(String method) => {
    'version': version(method),
    'entries': _entries(method, '解读'),
    'rules': _database
        .select(
          '''
      SELECT r.payload FROM match_rule r JOIN knowledge_entry e ON e.id = r.knowledge_id
      WHERE e.method = ? ORDER BY e.source_order
    ''',
          [method],
        )
        .map(_parseRow)
        .toList(),
  };

  List<FortuneJson> advice(String method) => _entries(method, '建议');
  List<FortuneJson> exportEntries(String method) => _entries(method);

  List<FortuneJson> _entries(String method, [String? kind]) {
    final rows = _database.select(
      'SELECT payload FROM knowledge_entry WHERE method = ? '
      '${kind == null ? '' : 'AND kind = ? '}ORDER BY source_order',
      [method, ?kind],
    );
    return rows.map(_readEntry).toList();
  }

  FortuneJson? entry(String id) {
    final rows = _database.select(
      'SELECT payload FROM knowledge_entry WHERE runtime_id = ?',
      [id],
    );
    return rows.isEmpty ? null : _readEntry(rows.single);
  }

  FortuneJson? canonicalEntry(int id) {
    final rows = _database.select(
      'SELECT payload FROM knowledge_entry WHERE id = ?',
      [id],
    );
    return rows.isEmpty ? null : _parseRow(rows.single);
  }

  Map<String, FortuneJson> interpretationSources() => {
    for (final row in _database.select(r'''
      SELECT id, runtime_id, json_extract(payload, '$.source.locator') AS locator
      FROM knowledge_entry WHERE kind = '解读'
    '''))
      row['runtime_id'] as String: {'id': row['id'], 'locator': row['locator']},
  };

  List<Object?> printedLuck(String id) {
    final rows = _database.select(
      r'''
      SELECT json_extract(r.payload, '$.review.printedLuck') AS rows
      FROM match_rule r JOIN knowledge_entry e ON e.id = r.knowledge_id
      WHERE e.runtime_id = ? AND r.mapped = 1
    ''',
      [id],
    );
    final value = rows.isEmpty ? null : rows.single['rows'];
    return value is String ? _decodeList(value) : [];
  }

  List<FortuneJson> evaluateRules(
    String method,
    String period,
    List<FortuneJson> facts, {
    String? hourBasis,
  }) {
    final rules = {
      for (final row in _database.select(_ruleIndex, [method]))
        row['runtime_id'] as String: _ruleSummary(row),
    };
    final factKeys = jsonEncode([
      for (final fact in facts) [fact['factType'], fact['scope']],
    ]);
    // The SQLite call is synchronous. The scalar function only sees positions.
    _activeFacts = facts;
    try {
      final rows = _database.select(fortunePredicateEvaluation, [
        method,
        period,
        hourBasis,
        factKeys,
        method,
      ]);
      for (final row in rows) {
        final rule = rules[row['runtime_id']]!;
        final unknown = row['unknown'] == 1;
        final condition = row['condition'] as String;
        final evaluation = <String, Object?>{
          'condition': condition,
          'hits': _factsAt(facts, row['hits']),
          'unknown': unknown,
        };
        switch (row['role']) {
          case 2:
            final query = _decodeMap(condition);
            evaluation['sourceConditions'] = query['sourceConditions'];
            if (query.containsKey('sourceExcerpt')) {
              evaluation['sourceExcerpt'] = query['sourceExcerpt'];
            }
            (rule['confirmations'] as List<FortuneJson>).add(evaluation);
          case 1:
            if (unknown) {
              evaluation['uncertainFacts'] = _factsAt(
                facts,
                row['uncertain_facts'],
              );
              evaluation['nonExcludingFacts'] = _factsAt(
                facts,
                row['non_excluding_facts'],
              );
            }
            (rule['exclusions'] as List<FortuneJson>).add(evaluation);
          default:
            (rule['required'] as List<FortuneJson>).add(evaluation);
        }
      }
    } finally {
      _activeFacts = const [];
    }
    return rules.values.toList();
  }

  /// Matches facts that have already passed calculation and snapshot validation.
  FortuneJson matchKnowledge({
    required String period,
    required DisplayWindow display,
    required int Function(int) wallClock,
    required List<FortuneJson> eligibleFacts,
    String? hourBasis,
  }) => {
    'version': fortuneKnowledgeMatcherVersion,
    'byMethod': {
      for (final method in knowledgeMethods)
        method: matchFortuneKnowledgeWindows(
          method: method,
          period: period,
          display: display,
          wallClock: wallClock,
          rules: evaluateRules(
            method,
            period,
            eligibleFacts.where((fact) => fact['method'] == method).toList(),
            hourBasis: hourBasis,
          ),
        ),
    },
  };

  FortuneJson matchRun(FortuneFactRun run, int Function(int) wallClock) {
    final eligible = eligibleFortuneFacts(run);
    return matchKnowledge(
      period: run.time.period.name,
      display: run.time.window,
      wallClock: wallClock,
      eligibleFacts: eligible.compatible.map((fact) => fact.toJson()).toList(),
    );
  }

  List<FortuneJson> adviceOptions() {
    final groups = <String, FortuneJson>{};
    for (final row in _database.select('''
      SELECT g.id AS group_id, g.label AS group_label, g.method, t.id, t.label
      FROM advice_group g JOIN advice_theme t ON t.group_id = g.id
      ORDER BY g.source_order, t.source_order
    ''')) {
      final groupId = row['group_id'] as String;
      final group = groups.putIfAbsent(
        groupId,
        () => {
          'id': groupId,
          'label': row['group_label'],
          'method': row['method'],
          'options': <FortuneJson>[],
        },
      );
      (group['options'] as List<FortuneJson>).add({
        'id': row['id'],
        'label': row['label'],
      });
    }
    return groups.values.toList();
  }

  List<FortuneJson> matchSelectedAdvice(String id) => _readAdvice(
    'SELECT g.method, t.label AS theme, e.payload $_adviceRows '
    'WHERE t.id = ? ORDER BY e.source_order',
    [id],
  );

  List<FortuneJson> matchNatalAdvice(String field, String value) => _readAdvice(
    'SELECT g.method, t.natal_value AS theme, e.payload $_adviceRows '
    'WHERE g.natal_field = ? AND t.natal_value = ? ORDER BY e.source_order',
    [field, value],
  );

  List<FortuneJson> _readAdvice(String query, List<String> parameters) => [
    for (final row in _database.select(query, parameters))
      {
        'method': row['method'],
        'theme': row['theme'],
        'entry': _readEntry(row),
      },
  ];

  List<FortuneJson> adviceCoverage() => _database.select('''
    SELECT e.method, count(*) AS entries, count(a.knowledge_id) AS available,
    count(*) - count(a.knowledge_id) AS unsupported
    FROM knowledge_entry e LEFT JOIN advice_theme_entry a ON a.knowledge_id = e.id
    WHERE e.kind = '建议' GROUP BY e.method ORDER BY e.method
  ''').toList();

  String adviceHash() =>
      _database
              .select("SELECT value FROM metadata WHERE key = 'advice_hash'")
              .single['value']
          as String;

  List<FortuneJson> status() => _database.select('''
    SELECT e.method, e.kind, count(*) AS entries,
      sum(CASE WHEN r.mapped = 1 THEN 1 ELSE 0 END) AS registeredRules
    FROM knowledge_entry e LEFT JOIN match_rule r ON r.knowledge_id = e.id
    GROUP BY e.method, e.kind ORDER BY e.method, e.kind
  ''').toList();

  void close() => _database.close();
}

const _ruleIndex = r'''
  SELECT e.runtime_id, e.topic, r.period, r.hour_basis,
    json_extract(e.payload, '$.legacy.topic') AS legacy_topic,
    json_array_length(r.payload, '$.queries') AS query_count,
    json_extract(r.payload, '$.unresolved') AS unresolved,
    json_extract(r.payload, '$.sourceConditions') AS source_conditions
  FROM knowledge_entry e JOIN match_rule r ON r.knowledge_id = e.id
  WHERE e.method = ? ORDER BY e.source_order
''';

const _adviceRows = '''
  FROM advice_theme t JOIN advice_group g ON g.id = t.group_id
  JOIN advice_theme_entry a ON a.theme_id = t.id
  JOIN knowledge_entry e ON e.id = a.knowledge_id
''';

FortuneJson _ruleSummary(Row row) => {
  'knowledgeId': row['runtime_id'],
  'topic': knowledgeRuntimeTopic(
    row['topic'] as String,
    row['legacy_topic'] as String?,
  ),
  'reportTopic': row['topic'],
  'period': row['period'],
  if (row['hour_basis'] case final basis?) 'hourBasis': basis,
  'queryCount': row['query_count'],
  'unresolved': _decodeList(row['unresolved']),
  'required': <FortuneJson>[],
  'exclusions': <FortuneJson>[],
  'confirmations': <FortuneJson>[],
  if (row['source_conditions'] case final conditions?)
    'sourceConditions': _decodeList(conditions),
};

List<FortuneJson> _factsAt(List<FortuneJson> facts, Object? encoded) =>
    _decodeList(encoded).map((index) => facts[index as int]).toList();

FortuneJson _decodeMap(Object? encoded) =>
    jsonDecode(encoded as String) as FortuneJson;
List<Object?> _decodeList(Object? encoded) =>
    jsonDecode(encoded as String) as List;
FortuneJson _parseRow(Row row) => _decodeMap(row['payload']);
FortuneJson _readEntry(Row row) =>
    toRuntimeKnowledgeEntry(FortuneKnowledgeEntry(_parseRow(row)));
