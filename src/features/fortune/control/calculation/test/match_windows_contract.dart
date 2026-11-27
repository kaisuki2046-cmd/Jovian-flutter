import 'dart:convert';
import 'dart:io';

import 'package:jovian_civil_time/jovian_civil_time.dart';
import 'package:jovian_fortune/jovian_fortune.dart';

const _start = '2026-03-07T05:00:00.000Z';
const _springForward = '2026-03-08T05:00:00.000Z';
const _nextDay = '2026-03-09T04:00:00.000Z';
const _end = '2026-03-10T04:00:00.000Z';
const _zone = 'America/New_York';

void main() async {
  final anchor = _fact('anchor', _start, _end, {
    'eligible': true,
    'proof': 'A',
  });
  final second = _fact('second', _nextDay, _end, {
    'eligible': true,
    'proof': 'B',
  });
  final short = _fact('short', _start, _springForward, {
    'eligible': true,
    'proof': 'A',
  });
  final support = _fact('support', _start, _end, {
    'eligible': true,
  }, type: 'support');
  final block = _fact('block', _start, _end, {'blocked': true}, type: 'guard');
  final noBlock = _fact('denied', _start, _springForward, {
    'blocked': false,
  }, type: 'guard');
  final unknownBlock = _fact(
    'uncertain',
    _springForward,
    _end,
    {},
    type: 'guard',
  );
  final noAnchor = _fact('no', _start, _end, {'eligible': false, 'proof': 'A'});
  final wrongProof = _fact('wrong-proof', _start, _end, {
    'eligible': false,
    'proof': 'B',
  });
  final daily = {...anchor, 'exactInstant': '2026-03-08T12:00:00.000Z'};
  final fixtures = [
    _fixture('other period', 'not_applicable', [
      anchor,
    ], rule: _rule(period: 'year')),
    _fixture(
      'weekly method restriction',
      'not_applicable',
      [anchor],
      period: 'week',
      rule: _rule(period: 'week'),
    ),
    _fixture('no mapped rule', 'unsupported', [
      anchor,
    ], rule: _rule(queries: [])),
    _fixture('missing evidence', 'unknown', [], rule: _rule()),
    _fixture('false overrides unknown', 'not_matched', [
      noAnchor,
    ], rule: _rule(queries: [_anchor, _support])),
    _fixture('no intersection', 'not_matched', [
      short,
      {...support, 'activeFrom': _nextDay},
    ], rule: _rule(queries: [_anchor, _support])),
    _fixture('all windows excluded', 'excluded', [
      anchor,
      block,
    ], rule: _rule(unless: [_guard])),
    _fixture('uncertainty in a distinct window', 'matched', [
      anchor,
      noBlock,
      unknownBlock,
    ], rule: _rule(unless: [_guard])),
    _fixture('partial rule', 'partial', [
      anchor,
    ], rule: _rule(unresolved: ['more evidence needed'])),
    _fixture('same fact required for confirmation', 'unknown', [
      anchor,
      wrongProof,
    ], rule: _rule(confirmations: [_proof('B')])),
    _fixture('retain unconfirmed candidate window', 'matched', [
      short,
      second,
    ], rule: _rule(confirmations: [_proof('A')])),
    _fixture('two confirmations and citations', 'matched', [
      short,
      second,
    ], rule: _rule(confirmations: [_proof('A'), _proof('B')])),
    _fixture(
      'limit exact facts to the DST-shortened date',
      'matched',
      [daily],
      period: 'day',
      rule: _rule(period: 'day'),
    ),
    _fixture('conditions for a complete simple rule', 'matched', [
      anchor,
    ], rule: _rule(sourceConditions: ['cited condition'])),
    _fixture('intersect and remove one half-open window', 'matched', [
      anchor,
      support,
      {...block, 'activeFrom': _springForward, 'activeTo': _nextDay},
    ], rule: _rule(queries: [_anchor, _support], unless: [_guard])),
  ];

  final root = Platform.script.resolve('../../../../../../backend/');
  final node = await Process.start('node', [
    '--input-type=module',
    '--eval',
    _legacy,
  ], workingDirectory: Directory.fromUri(root).path);
  final stdoutResult = utf8.decoder.bind(node.stdout).join();
  final stderrResult = utf8.decoder.bind(node.stderr).join();
  node.stdin.add(
    utf8.encode(
      jsonEncode({
        'start': _start,
        'end': _end,
        'zone': _zone,
        'fixtures': fixtures,
      }),
    ),
  );
  await node.stdin.close();
  if (await node.exitCode != 0) throw StateError(await stderrResult);
  final expected = (jsonDecode(await stdoutResult) as List).cast<FortuneJson>();
  final display = DisplayWindow(
    DateTime.parse(_start).millisecondsSinceEpoch,
    DateTime.parse(_end).millisecondsSinceEpoch,
  );
  await initializeCivilTime();
  final clock = await fortuneDisplayClock(_zone);
  for (final (index, fixture) in fixtures.indexed) {
    final rule = fixture['rule'] as FortuneJson;
    final facts = (fixture['facts'] as List).cast<FortuneJson>();
    final actual = matchFortuneKnowledgeWindows(
      method: 'bazi',
      period: fixture['period'] as String,
      display: display,
      wallClock: clock,
      rules: [_evaluate(rule, facts)],
    ).single;
    if (actual['status'] != fixture['expectedStatus'] ||
        jsonEncode(actual) != jsonEncode(expected[index])) {
      throw StateError(
        '${fixture['name']}\nExpected ${expected[index]}\nActual $actual',
      );
    }
  }
  stdout.writeln(
    'Fortune match windows agree with Node for ${fixtures.length} rule scenarios.',
  );
}

const _anchor = {
  'factType': 'anchor',
  'where': {'eligible': true},
};
const _support = {
  'factType': 'support',
  'where': {'eligible': true},
};
const _guard = {
  'factType': 'guard',
  'where': {'blocked': true},
};

FortuneJson _proof(String name) => {
  'factType': 'anchor',
  'where': {'proof': name},
  'sourceConditions': ['Proof $name'],
  'sourceExcerpt': 'Source $name',
};

FortuneJson _rule({
  String period = 'month',
  List<FortuneJson> queries = const [_anchor],
  List<FortuneJson> unless = const [],
  List<FortuneJson> confirmations = const [],
  List<String> unresolved = const [],
  List<String>? sourceConditions,
}) => {
  'knowledgeId': 'fixture',
  'period': period,
  'queries': queries,
  'unless': unless,
  'confirmedWhen': confirmations,
  'unresolved': unresolved,
  if (sourceConditions != null) 'sourceConditions': sourceConditions,
};

FortuneJson _fact(
  String id,
  String from,
  String to,
  FortuneJson fields, {
  String type = 'anchor',
}) => {
  'factId': id,
  'factType': type,
  'method': 'bazi',
  'completeness': 'complete',
  'activeFrom': from,
  'activeTo': to,
  'normalizedPayload': fields,
};

FortuneJson _fixture(
  String name,
  String status,
  List<FortuneJson> facts, {
  String period = 'month',
  required FortuneJson rule,
}) => {
  'name': name,
  'period': period,
  'rule': rule,
  'facts': facts,
  'expectedStatus': status,
};

FortuneJson _evaluate(FortuneJson rule, List<FortuneJson> facts) {
  FortuneJson queryResult(FortuneJson query, {bool exclusion = false}) {
    final records = [
      for (final fact in facts)
        if (fact['factType'] == query['factType'])
          (fact, evaluateFortunePredicate(fact, query)),
    ];
    List<FortuneJson> withVerdict(bool? verdict) => [
      for (final (fact, status) in records)
        if (status == verdict) fact,
    ];
    final unknown =
        records.isEmpty || records.any((record) => record.$2 == null);
    return {
      'condition': jsonEncode(query),
      'hits': withVerdict(true),
      'unknown': unknown,
      if (exclusion && unknown) ...{
        'uncertainFacts': withVerdict(null),
        'nonExcludingFacts': withVerdict(false),
      },
    };
  }

  final required = (rule['queries'] as List).cast<FortuneJson>();
  return {
    ...rule,
    'reportTopic': 'overall',
    'queryCount': required.length,
    'required': required.map(queryResult).toList(),
    'exclusions': [
      for (final query in (rule['unless'] as List).cast<FortuneJson>())
        queryResult(query, exclusion: true),
    ],
    'confirmations': [
      for (final query in (rule['confirmedWhen'] as List).cast<FortuneJson>())
        {
          ...queryResult(query),
          'sourceConditions': query['sourceConditions'],
          'sourceExcerpt': query['sourceExcerpt'],
        },
    ],
  };
}

const _legacy = r'''
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
// This contract starts after snapshot eligibility; isolate the actual range matcher.
const fixtureEligibility = 'data:text/javascript,' + encodeURIComponent(
  'export const eligibleFacts = run => ({ compatible: run.facts }); export const requestForFortuneRun = () => ({})'
);
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '../fortune-interpretation') return next(fixtureEligibility, context);
  if (['./catalog', '../../model/fortune-facts', '../period-window'].includes(specifier)) {
    return next(specifier + '.ts', context);
  }
  return next(specifier, context);
}});
const { matchFortuneKnowledge } = await import('./src/features/fortune/control/knowledge/match.ts');
const { start, end, zone, fixtures } = JSON.parse(readFileSync(0, 'utf8'));
const empty = { entries: [], rules: [] };
process.stdout.write(JSON.stringify(fixtures.map(({ period, facts, rule }) => matchFortuneKnowledge({
  facts, time: { displayWindow: {
    periodType: period, timezone: zone, instantRange: { startInstant: start, endInstantExclusive: end }
  } },
}, {
  bazi: { entries: [{ id: 'fixture', reportTopic: 'overall' }], rules: [rule] },
  western: empty, ziwei: empty,
}).byMethod.bazi[0])));
''';
