import 'dart:io';

import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:jovian_json/jovian_json.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite3/sqlite3.dart';

import 'manifest.dart';
import 'sql.dart';

const fortuneKnowledgeSchemaVersion = 8;

/// Publishes an integrity-checked database keyed by the exact source bytes.
String ensureFortuneKnowledgeDatabase({
  required File manifest,
  required Directory directory,
}) {
  final bytes = manifest.readAsBytesSync();
  final manifestHash = knowledgeDigest(bytes);
  final sourceHash = knowledgeJsonDigest({
    'schemaVersion': fortuneKnowledgeSchemaVersion,
    'manifestHash': manifestHash,
  });
  directory.createSync(recursive: true);
  final path = p.join(directory.path, 'fortune-$sourceHash.sqlite');
  if (!File(path).existsSync()) {
    final scratch = directory.createTempSync('build-');
    final temporary = File(p.join(scratch.path, 'build.sqlite'));
    try {
      _writeDatabase(temporary.path, bytes, manifestHash, sourceHash);
      try {
        temporary.renameSync(path);
      } on FileSystemException {
        if (!File(path).existsSync()) rethrow;
      }
    } finally {
      if (temporary.existsSync()) temporary.deleteSync();
      scratch.deleteSync();
    }
  }
  final database = sqlite3.open(path, mode: OpenMode.readOnly);
  try {
    final metadata = {
      for (final row in database.select('SELECT key, value FROM metadata'))
        row['key']: row['value'],
    };
    if (metadata['source_hash'] != sourceHash ||
        metadata['schema_version'] != '$fortuneKnowledgeSchemaVersion' ||
        !_hasIntegrity(database)) {
      throw StateError('Invalid fortune SQLite catalog');
    }
  } finally {
    database.close();
  }
  return path;
}

bool _hasIntegrity(Database database) =>
    database.select('PRAGMA quick_check').single['quick_check'] == 'ok';

void _writeDatabase(
  String path,
  List<int> bytes,
  String manifestHash,
  String sourceHash,
) {
  final FortuneKnowledgeManifest(:entries, :adviceGroups) =
      parseFortuneKnowledgeManifest(bytes);
  final database = sqlite3.open(path);
  try {
    database.execute(fortuneKnowledgeSchema);
    database.execute('INSERT INTO metadata VALUES (?, ?), (?, ?), (?, ?)', [
      'schema_version',
      '$fortuneKnowledgeSchemaVersion',
      'source_hash',
      sourceHash,
      'advice_hash',
      knowledgeJsonDigest({
        'adviceGroups': adviceGroups,
        'entries': entries
            .where((entry) => entry.kind == '建议')
            .map((entry) => entry.data)
            .toList(),
      }),
    ]);
    database.execute('INSERT INTO source_file VALUES (?, ?)', [
      knowledgeManifestFile,
      manifestHash,
    ]);
    _writeEntries(database, entries);
    _writeAdviceIndex(database, adviceGroups, entries);
    database.execute('COMMIT');
    if (!_hasIntegrity(database) ||
        database.select('PRAGMA foreign_key_check').isNotEmpty) {
      throw StateError('Fortune SQLite integrity check failed');
    }
  } finally {
    database.close();
  }
}

void _writeEntries(Database database, List<FortuneKnowledgeEntry> entries) {
  final writeEntry = database.prepare(
    'INSERT INTO knowledge_entry VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  final writeRule = database.prepare(
    'INSERT INTO match_rule VALUES (?, ?, ?, ?, ?)',
  );
  final writePredicate = database.prepare(
    'INSERT INTO match_predicate(method, fact_type, scope, scopes, payload) '
    'VALUES (?, ?, ?, ?, ?)',
  );
  final writeLink = database.prepare(
    'INSERT INTO rule_predicate VALUES (?, ?, ?, ?)',
  );
  try {
    for (final method in knowledgeMethods) {
      final methodEntries = entries
          .where((entry) => entry.method == method)
          .toList();
      final versionHash = knowledgeJsonDigest(
        methodEntries
            .where((entry) => entry.kind == '解读')
            .map((entry) => entry.data)
            .toList(),
      );
      database.execute('INSERT INTO library VALUES (?, ?)', [
        method,
        'fortune-knowledge-v1-$versionHash',
      ]);
      final predicates = <String, int>{};
      for (final (position, entry) in methodEntries.indexed) {
        writeEntry.execute([
          entry.id,
          entry.runtimeId,
          method,
          entry.kind,
          entry.topic,
          entry.advice?['kind'],
          position,
          legacyJson(entry.data),
        ]);
        if (entry.kind != '解读') continue;
        final rule = interpretationRule(entry);
        writeRule.execute([
          entry.id,
          entry.period,
          entry.hourBasis,
          entry.matchConditions['status'] == 'mapped' ? 1 : 0,
          legacyJson(rule),
        ]);
        final roles = [
          rule['queries'] as List,
          rule['unless'] as List? ?? [],
          knowledgeConfirmations(rule['confirmedWhen']),
        ];
        for (final (role, queries) in roles.indexed) {
          for (final (ordinal, query) in queries.cast<FortuneJson>().indexed) {
            final payload = legacyJson(query);
            final predicateId = predicates.putIfAbsent(payload, () {
              writePredicate.execute([
                method,
                query['factType'],
                query['scope'],
                if (query['scopes'] case final scopes?)
                  legacyJson(scopes)
                else
                  null,
                payload,
              ]);
              return database.lastInsertRowId;
            });
            writeLink.execute([entry.id, role, ordinal, predicateId]);
          }
        }
      }
    }
  } finally {
    writeEntry.close();
    writeRule.close();
    writePredicate.close();
    writeLink.close();
  }
}

final _adviceKey = RegExp(r'^[a-z0-9]+(?:-[a-z0-9]+)*$');
const _natalFields = {
  'bazi': 'element',
  'ziwei': 'lifeStar',
  'western': 'sign',
};

bool _hasText(Object? value) => value is String && value.trim().isNotEmpty;

void _writeAdviceIndex(
  Database database,
  List<FortuneJson> groups,
  List<FortuneKnowledgeEntry> entries,
) {
  final adviceById = {
    for (final entry in entries)
      if (entry.kind == '建议') entry.id: entry,
  };
  final mapped = <num>{};
  for (final (groupOrder, group) in groups.indexed) {
    final id = group['id'];
    final method = group['method'];
    final natalField = group['natalField'];
    final themes = group['themes'];
    if (id is! String ||
        !_adviceKey.hasMatch(id) ||
        !_hasText(group['label']) ||
        !_natalFields.containsKey(method) ||
        (group.containsKey('natalField') &&
            natalField != _natalFields[method]) ||
        themes is! List ||
        themes.isEmpty) {
      throw FormatException('Invalid fortune advice group: $id');
    }
    database.execute('INSERT INTO advice_group VALUES (?, ?, ?, ?, ?)', [
      id,
      group['label'],
      method,
      natalField,
      groupOrder,
    ]);
    for (final (themeOrder, raw) in themes.indexed) {
      final theme = raw is FortuneJson ? raw : const <String, Object?>{};
      final themeId = theme['id'];
      final natalValue = theme['natalValue'];
      final entryIds = theme['entryIds'];
      if (themeId is! String ||
          themeId.length > 72 ||
          !_adviceKey.hasMatch(themeId) ||
          !themeId.startsWith('$id-') ||
          !_hasText(theme['label']) ||
          (theme.containsKey('natalValue') &&
              (natalField == null || !_hasText(natalValue))) ||
          entryIds is! List ||
          entryIds.isEmpty) {
        throw FormatException('Invalid fortune advice theme: $themeId');
      }
      database.execute('INSERT INTO advice_theme VALUES (?, ?, ?, ?, ?)', [
        themeId,
        id,
        theme['label'],
        natalValue,
        themeOrder,
      ]);
      for (final entryId in entryIds) {
        final entry = adviceById[entryId];
        if (entry == null || entry.method != method || !mapped.add(entry.id)) {
          throw FormatException('Invalid fortune advice entry ID: $entryId');
        }
        final legacy = entry.legacy;
        if (legacy != null && legacy.containsKey('adviceSourceHash')) {
          final reviewedEntry = toRuntimeKnowledgeEntry(entry)
            ..remove('reportTopic');
          if (legacy['adviceSourceHash'] !=
              knowledgeJsonDigest(reviewedEntry)) {
            throw FormatException(
              'Fortune advice source review is stale: $entryId',
            );
          }
        }
        database.execute('INSERT INTO advice_theme_entry VALUES (?, ?)', [
          entry.id,
          themeId,
        ]);
      }
    }
  }
}
