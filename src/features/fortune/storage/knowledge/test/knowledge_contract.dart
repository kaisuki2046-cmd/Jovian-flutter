import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:jovian_fortune_knowledge/jovian_fortune_knowledge.dart';
import 'package:jovian_json/jovian_json.dart';
import 'package:path/path.dart' as p;
import 'package:sqlite3/sqlite3.dart';

const _schoolId = 'bazi-fortune-v1-year-study-smth-v3-school-p008-001';
const _printedId =
    'bazi-fortune-v1-year-general-zpqz-1936-interpretation-p009-001';
const _natalFixtures = {
  'element': ['水', '木', '金', '火', '土', 'unknown'],
  'lifeStar': ['紫微', '天机', '太阳', '破军', 'unknown'],
  'sign': ['摩羯', '白羊', '双鱼', 'unknown'],
};

void main() async {
  final root = Platform.script.resolve('../../../../../../backend/');
  final legacyManifest = File.fromUri(
    root.resolve('src/features/fortune/model/knowledge/fortune_knowledge.json'),
  );
  final manifest = File.fromUri(
    Platform.script.resolve('../../../model/knowledge/fortune_knowledge.json'),
  );
  _check(
    sha256.convert(manifest.readAsBytesSync()) ==
        sha256.convert(legacyManifest.readAsBytesSync()),
    'The copied knowledge source differs from the original',
  );
  final temporary = Directory.systemTemp.createTempSync(
    'jovian-fortune-contract-',
  );
  final dartDirectory = Directory(p.join(temporary.path, 'dart'));
  final nodeDirectory = Directory(p.join(temporary.path, 'node'));
  final invalidDirectory = Directory(p.join(temporary.path, 'invalid'));
  final staleManifest = File(p.join(temporary.path, 'stale.json'));
  try {
    final dartPath = ensureFortuneKnowledgeDatabase(
      manifest: manifest,
      directory: dartDirectory,
    );
    final fixtures = _ruleFixtures();
    final fromNode = await _runLegacy(root, {
      'dartPath': dartPath,
      'nodeDirectory': nodeDirectory.path,
      'fixtures': fixtures,
      'natalFixtures': _natalFixtures,
      'printedId': _printedId,
    });
    final nodePath = fromNode['path'] as String;
    _check(p.basename(dartPath) == p.basename(nodePath), 'Cache keys differ');
    _equal(
      fromNode['node'],
      fromNode['dart'],
      'Node reads both artifacts identically',
    );
    for (final path in [dartPath, nodePath]) {
      final catalog = openFortuneKnowledgeDatabase(path);
      try {
        _equal(_snapshot(catalog, fixtures), fromNode['node'], path);
        _checkKnownVerdicts(catalog, fixtures);
        await _checkArchivedChartMatch(catalog);
      } finally {
        catalog.close();
      }
    }
    _checkPredicates();

    final raw = jsonDecode(manifest.readAsStringSync()) as FortuneJson;
    final school = (raw['year'] as List).cast<FortuneJson>().singleWhere(
      (entry) => entry['legacyId'] == _schoolId,
    );
    final conditions = school['matchConditions'] as FortuneJson;
    final formatted = conditions['formatted'] as FortuneJson;
    (formatted['review'] as FortuneJson)['sourceHash'] = 'stale';
    staleManifest.writeAsStringSync(jsonEncode(raw));
    var rejected = false;
    try {
      ensureFortuneKnowledgeDatabase(
        manifest: staleManifest,
        directory: invalidDirectory,
      );
    } on FormatException catch (error) {
      rejected = error.message.contains('source review is stale');
    }
    _check(
      rejected && invalidDirectory.listSync().isEmpty,
      'Stale review was published',
    );

    final database = sqlite3.open(dartPath);
    try {
      database.execute(
        "UPDATE metadata SET value = 'invalid' WHERE key = 'source_hash'",
      );
    } finally {
      database.close();
    }
    var detected = false;
    try {
      ensureFortuneKnowledgeDatabase(
        manifest: manifest,
        directory: dartDirectory,
      );
    } on StateError {
      detected = true;
    }
    _check(detected, 'Invalid cache was not detected');
    stdout.writeln(
      'Fortune knowledge passed source checks, independent SQLite builds, '
      'two-way reads, rule verdicts, advice coverage, and failed-build recovery.',
    );
  } finally {
    if (staleManifest.existsSync()) staleManifest.deleteSync();
    for (final directory in [dartDirectory, nodeDirectory, invalidDirectory]) {
      if (!directory.existsSync()) continue;
      for (final file in directory.listSync().whereType<File>()) {
        file.deleteSync();
      }
      directory.deleteSync();
    }
    temporary.deleteSync();
  }
}

void _check(bool passed, String label) {
  if (!passed) throw StateError(label);
}

void _equal(Object? actual, Object? expected, String label) {
  if (legacyJson(actual) != legacyJson(expected)) {
    if (actual is FortuneJson && expected is FortuneJson) {
      final mismatched = actual.keys.where(
        (key) => legacyJson(actual[key]) != legacyJson(expected[key]),
      );
      throw StateError('$label differs in ${mismatched.join(', ')}');
    }
    throw StateError('$label differs');
  }
}

String _digest(Object? value) =>
    sha256.convert(utf8.encode(legacyJson(value))).toString();

FortuneJson _snapshot(
  FortuneKnowledgeCatalog catalog,
  List<FortuneJson> fixtures,
) {
  final groups = catalog.adviceOptions();
  final optionIds = groups
      .expand((group) => group['options'] as List)
      .cast<FortuneJson>()
      .map((option) => option['id'] as String);
  return {
    'status': catalog.status(),
    'adviceCoverage': catalog.adviceCoverage(),
    'adviceHash': catalog.adviceHash(),
    'library': {
      for (final method in knowledgeMethods)
        method: _digest(catalog.library(method)),
    },
    'fullExport': {
      for (final method in knowledgeMethods)
        method: _digest(catalog.exportEntries(method)),
    },
    'advice': {
      for (final method in knowledgeMethods)
        method: _digest(catalog.advice(method)),
    },
    'groups': _digest(groups),
    'selected': _digest([
      for (final id in [...optionIds, 'unknown'])
        catalog.matchSelectedAdvice(id),
    ]),
    'natal': _digest([
      for (final MapEntry(:key, :value) in _natalFixtures.entries)
        for (final natal in value) catalog.matchNatalAdvice(key, natal),
    ]),
    'sources': _digest(catalog.interpretationSources()),
    'entry': _digest(catalog.entry(_schoolId)),
    'canonical': _digest(catalog.canonicalEntry(82)),
    'printed': _digest(catalog.printedLuck(_printedId)),
    'evaluations': [
      for (final fixture in fixtures)
        _digest(
          catalog.evaluateRules(
            fixture['method'] as String,
            fixture['period'] as String,
            (fixture['facts'] as List).cast<FortuneJson>(),
            hourBasis: fixture['basis'] as String?,
          ),
        ),
    ],
  };
}

List<FortuneJson> _ruleFixtures() {
  const school = {
    'profile': 'smth-school-exact-entry-five-seven-age-comparisons-v2',
    'confirmed': true,
    'sourceLuckAtDayStart': true,
    'sourceSchoolAbsenceCandidate': true,
    'sourceLuckSchoolClashOrBreak': false,
    'sourceLuckSchoolSelfPunishment': false,
    'hasNamedNobleSchool': false,
    'civilYears': 7,
    'schoolEntryAgreement': true,
  };
  final facts = [
    _fact('school-hit', 'school_entry_context', 'decadal', school),
    _fact('school-excluded', 'school_entry_context', 'decadal', {
      ...school,
      'sourceLuckSchoolClashOrBreak': true,
      'schoolEntryAgreement': false,
    }),
    _fact(
      'school-unknown',
      'school_entry_context',
      'decadal',
      school,
      partial: true,
    ),
    _fact('school-other-scope', 'school_entry_context', 'yearly', school),
  ];
  return [
    {'method': 'bazi', 'period': 'year', 'facts': facts},
    {'method': 'bazi', 'period': 'day', 'facts': facts},
    {'method': 'bazi', 'period': 'hour', 'basis': 'shichen', 'facts': facts},
    {
      'method': 'ziwei',
      'period': 'year',
      'facts': [
        _fact('ziwei', 'quanshu_limit_chapter', 'yearly', {
          'profile': 'quanshu-limit-chapter-atomic-v1',
          'starPlacementProof':
              'quanshu-nanyangtang-limit-chapter-star-layers-v1',
          'natalBladePlacementProof':
              'quanshu-natal-yang-tuo-and-lucun-auxiliary-layer-v1',
          'limitPlacementProof': 'quanshu-bureau-and-source-minor-v1',
          'ready': true,
          'quanshuFixedFireBellProfile':
              'quanshu-nanyangtang-fixed-firebell-v1',
          'cleanSeatMingFixedCandidate': true,
        }),
      ],
    },
    {
      'method': 'western',
      'period': 'year',
      'facts': [
        _fact('western', 'lilly_return_context', 'yearly', {
          'profile': 'lilly-return-source-pairs-v3-radical-place',
          'pair': 'saturn-self',
          'returnEpochBasis': 'natal-sun-ephemeris',
          'radicalPlaceCandidate': true,
          'returnLocalFrame': 'lilly-revolution-local-regiomontanus-v1',
          'returnHouse': 10,
          'saturnMidheavenState': 'tenth-house',
        }),
      ],
    },
    {'method': 'western', 'period': 'month', 'facts': <FortuneJson>[]},
  ];
}

FortuneJson _fact(
  String id,
  String type,
  String scope,
  FortuneJson payload, {
  bool partial = false,
}) => {
  'factId': id,
  'factType': type,
  'scope': scope,
  'normalizedPayload': payload,
  'completeness': partial ? 'partial' : 'complete',
  'activeFrom': '2026-01-01T00:00:00.000Z',
  'activeTo': '2026-01-02T00:00:00.000Z',
};

void _checkKnownVerdicts(
  FortuneKnowledgeCatalog catalog,
  List<FortuneJson> fixtures,
) {
  final matches = catalog.evaluateRules(
    'bazi',
    'year',
    (fixtures.first['facts'] as List).cast<FortuneJson>(),
  );
  final rule = matches.singleWhere((row) => row['knowledgeId'] == _schoolId);
  final required = (rule['required'] as List<FortuneJson>).single;
  final exclusion = (rule['exclusions'] as List<FortuneJson>).single;
  final confirmation = (rule['confirmations'] as List<FortuneJson>).single;
  List<Object?> ids(FortuneJson row, String key) => (row[key] as List)
      .cast<FortuneJson>()
      .map((fact) => fact['factId'])
      .toList();
  _equal(ids(required, 'hits'), [
    'school-hit',
    'school-excluded',
  ], 'Required candidates');
  _equal(ids(exclusion, 'hits'), ['school-excluded'], 'Exclusion hits');
  _equal(ids(exclusion, 'uncertainFacts'), [
    'school-unknown',
  ], 'Unavailable facts');
  _equal(ids(exclusion, 'nonExcludingFacts'), [
    'school-hit',
  ], 'False exclusions');
  _equal(ids(confirmation, 'hits'), ['school-hit'], 'Confirmation anchor');
  final eligible = {
    ...(fixtures.first['facts'] as List).first as FortuneJson,
    'method': 'bazi',
  };
  final result = catalog.matchKnowledge(
    period: 'year',
    display: DisplayWindow(
      DateTime.utc(2026).millisecondsSinceEpoch,
      DateTime.utc(2027).millisecondsSinceEpoch,
    ),
    wallClock: (instant) => instant,
    eligibleFacts: [eligible],
  );
  final bazi = (result['byMethod'] as FortuneJson)['bazi'] as List<FortuneJson>;
  final match = bazi.singleWhere((row) => row['knowledgeId'] == _schoolId);
  _equal(match['status'], 'matched', 'Indexed rule yields a confirmed match');
  _equal(match['sourceFactIds'], ['school-hit'], 'Matched evidence');
  _equal(match['windows'], [
    {'start': eligible['activeFrom'], 'endExclusive': eligible['activeTo']},
  ], 'Matched fact interval');
  _check(
    catalog.printedLuck(_printedId).isNotEmpty,
    'Printed source evidence missing',
  );
}

Future<void> _checkArchivedChartMatch(FortuneKnowledgeCatalog catalog) async {
  int shanghai(int instant) => instant + 8 * Duration.millisecondsPerHour;
  final time = buildFactTimeContext(
    FortunePeriod.month,
    DateTime.utc(2026, 10, 15).millisecondsSinceEpoch,
    'Asia/Shanghai',
    shanghai,
  );
  final run = await calculateFortuneFacts(
    time: time,
    runId: 'archived-month',
    reference: const FortuneChartReference(
      snapshotId: 'source-snapshot',
      chart: {
        'timeKnown': true,
        'bazi': {
          'engineName': 'lunar-javascript',
          'engineVersion': '1.7.8',
          'rulesetVersion': 'utc8-jie-local-civil-late-zi-next-v1',
          'rawResult': [
            {
              'utc': '1993-07-12T05:20:00.000Z',
              'year': '癸酉',
              'month': '己未',
              'day': '甲午',
              'hour': '辛未',
            },
          ],
        },
      },
    ),
  );
  final rows = catalog.matchRun(run, shanghai)['byMethod'] as FortuneJson;
  final bazi = rows['bazi'] as List<FortuneJson>;
  final reading = bazi.singleWhere(
    (row) => row['knowledgeId'] == 'fortune-entry-2457',
  );
  final source = run.facts.singleWhere(
    (fact) =>
        fact.type == 'bazi_jie_month_context' &&
        fact.payload['jieStartDate'] == '2026-10-08',
  );
  _equal(reading['status'], 'matched', 'Archived chart matches rule 2457');
  _equal(reading['sourceFactIds'], [
    source.id,
  ], 'Rule 2457 is linked to the calculated fact');
  _equal(reading['windows'], [
    {
      'start': fortuneIsoUtc(source.start),
      'endExclusive': fortuneIsoUtc(source.end),
    },
  ], 'Rule 2457 preserves the true month window');
}

void _checkPredicates() {
  final fact = _fact('predicate', 'sample', 'transit', {
    'names': ['甲', '乙'],
    'score': 4,
    'flags': true,
    'state': 'ready',
  });
  final condition = <String, Object?>{
    'where': {
      'names': {
        'includesAll': ['甲', '乙'],
      },
      'score': {'gte': 3},
      'flags': true,
    },
    'anyOf': [
      {'state': 'skipped'},
      {
        'names': {
          'includesAny': ['丙', '甲'],
        },
      },
    ],
    'minimumDurationHours': 24,
  };
  _check(
    evaluateFortunePredicate(fact, condition) == true,
    'Predicate positive',
  );
  _check(
    evaluateFortunePredicate(fact, {
          ...condition,
          'minimumDurationHours': 25,
        }) ==
        false,
    'Duration predicate',
  );
  _check(
    evaluateFortunePredicate({...fact, 'activeTo': 'invalid'}, condition) ==
        null,
    'Unknown duration',
  );
  _check(
    evaluateFortunePredicate(fact, {
          'where': {'missing': true},
        }) ==
        null,
    'Unknown field',
  );
  _check(
    evaluateFortunePredicate(fact, {
          'where': {'missing': true, 'flags': false},
        }) ==
        false,
    'Negative condition takes precedence over an unknown field',
  );
}

Future<FortuneJson> _runLegacy(Uri root, FortuneJson input) async {
  final process = await Process.start('node', [
    '--input-type=module',
    '--eval',
    _legacyScript,
  ], workingDirectory: Directory.fromUri(root).path);
  final output = utf8.decoder.bind(process.stdout).join();
  final errors = utf8.decoder.bind(process.stderr).join();
  process.stdin.add(utf8.encode(jsonEncode({...input, 'schoolId': _schoolId})));
  await process.stdin.close();
  final code = await process.exitCode;
  if (code != 0) throw StateError('Legacy reader failed: ${await errors}');
  return jsonDecode(await output) as FortuneJson;
}

const _legacyScript = r'''
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { ensureFortuneKnowledgeDatabase, knowledgeMethods, openFortuneKnowledgeDatabase }
  from './src/features/fortune/storage/knowledge/database.mjs';

const input = JSON.parse(readFileSync(0, 'utf8'));
const path = ensureFortuneKnowledgeDatabase({ directory: input.nodeDirectory });
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function snapshot(path) {
  const catalog = openFortuneKnowledgeDatabase(path);
  try {
    const groups = catalog.adviceOptions();
    const options = groups.flatMap(group => group.options.map(option => option.id));
    return {
      status: catalog.status(),
      adviceCoverage: catalog.adviceCoverage(),
      adviceHash: catalog.adviceHash(),
      library: Object.fromEntries(knowledgeMethods.map(method => [method, digest(catalog.library(method))])),
      fullExport: Object.fromEntries(knowledgeMethods.map(method => [method, digest(catalog.exportEntries(method))])),
      advice: Object.fromEntries(knowledgeMethods.map(method => [method, digest(catalog.advice(method))])),
      groups: digest(groups),
      selected: digest([...options, 'unknown'].map(id => catalog.matchSelectedAdvice(id))),
      natal: digest(Object.entries(input.natalFixtures).flatMap(([field, values]) =>
        values.map(value => catalog.matchNatalAdvice(field, value)))),
      sources: digest(Object.fromEntries(catalog.interpretationSources())),
      entry: digest(catalog.entry(input.schoolId)),
      canonical: digest(catalog.canonicalEntry(82)),
      printed: digest(catalog.printedLuck(input.printedId)),
      evaluations: input.fixtures.map(({ method, period, facts, basis }) =>
        digest(catalog.evaluateRules(method, period, facts, basis))),
    };
  } finally {
    catalog.close();
  }
}
process.stdout.write(JSON.stringify({ path, node: snapshot(path), dart: snapshot(input.dartPath) }));
''';
