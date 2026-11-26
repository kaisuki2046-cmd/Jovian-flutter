import 'dart:convert';
import 'dart:io';

import 'package:jovian_civil_time/jovian_civil_time.dart';
import 'package:jovian_fortune/jovian_fortune.dart';

const _types = [
  'time_segment',
  'calendar_pattern',
  'general_almanac',
  'natal_conditions',
  'stem_condition',
  'natal_structure',
  'layer_pillar',
  'source_layer_context',
  'bazi_jie_month_context',
  'pillar_relation',
  'ten_god',
  'hidden_stem_ten_god',
  'stem_combine',
  'stem_clash',
  'branch_combine',
  'branch_clash',
  'branch_punishment',
  'branch_harm',
  'branch_break',
  'three_combinations',
  'three_meetings',
  'same_pillar',
  'controlling',
  'generating',
  'luck_transition',
  'luck_conditions',
  'luck_pillar',
];
const _base = '1993-07-12T05:20:00.000Z';
const _zones = ['Asia/Shanghai', 'America/New_York'];

Future<void> main() async {
  await initializeCivilTime();
  final oracle = await _node([
    _fixture('立春年界', 'year', '2026-02-04T02:00:00Z'),
    _fixture('寒露节令月', 'month', '2026-10-15T00:00:00Z'),
    _fixture('北京晚子', 'day', '2026-10-14T15:30:00Z'),
    _fixture('纽约夏令时与黄历换日', 'day', '2026-03-08T16:00:00Z', zone: _zones[1]),
    _fixture('顺运交界', 'year', '2026-11-21T10:00:00Z', transition: true),
    _fixture(
      '逆运交界',
      'year',
      '2026-11-21T10:00:00Z',
      transition: true,
      gender: 0,
    ),
    _fixture(
      '纽约出生地民用时复核',
      'month',
      '2026-10-15T00:00:00Z',
      birthZone: _zones[1],
    ),
    _fixture(
      '出生时钟不一致',
      'month',
      '2026-10-15T00:00:00Z',
      birthZone: _zones[1],
      brokenClock: true,
    ),
    _fixture(
      '两候选十神一致',
      'month',
      '2026-10-15T00:00:00Z',
      births: [_base, '1993-07-12T02:20:00.000Z'],
      timeKnown: false,
    ),
    _fixture(
      '两候选日主不一致',
      'month',
      '2026-10-15T00:00:00Z',
      births: [_base, '1993-07-13T02:20:00.000Z'],
      timeKnown: false,
    ),
    _fixture('无命盘', 'day', '2026-11-21T10:00:00Z', births: []),
    _fixture('旧版不兼容命盘', 'day', '2026-11-21T10:00:00Z', incompatible: true),
    _fixture('原版周运方法限制', 'week', '2026-11-21T10:00:00Z', births: []),
    _fixture('出生前节令区间不参与', 'month', '1993-07-05T12:00:00Z'),
  ]);
  final totals = <String, int>{};
  for (final row in oracle) {
    final name = row['name'] as String;
    final input = row['input'] as FortuneJson;
    final clock = await fortuneDisplayClock(input['displayTimezone'] as String);
    final time = buildFactTimeContext(
      FortunePeriod.values.byName(input['periodType'] as String),
      row['asOf'] as int,
      input['displayTimezone'] as String,
      clock,
      source: FortuneClockSource.server,
      target: input['targetPeriod'] as FortuneJson?,
    );
    final reference = row['reference'] as FortuneJson?;
    final authorized = reference == null
        ? null
        : FortuneChartReference(
            snapshotId: reference['snapshotId'] as String,
            profileId: reference['profileId'] as String,
            profileVersion: reference['profileVersion'] as String,
            createdAt: reference['createdAt'] as String,
            chart: reference['chart'] as FortuneJson,
          );
    final run = await calculateFortuneFacts(
      time: time,
      runId: 'parity',
      reference: authorized,
    );
    final status = row['status'] as FortuneJson;
    final byType = row['facts'] as FortuneJson;
    final eligibleSummary = row['eligible'] as FortuneJson;
    final serialized = run.toJson();
    final eligibility = eligibleFortuneFacts(run);
    _equal(serialized['time'], row['time'], '$name 时间');
    for (final method in [FortuneMethod.bazi, FortuneMethod.almanac]) {
      _equal(
        run.methods[method]!.status.wireName,
        status[method.name],
        '$name ${method.name} 状态',
      );
    }
    for (final type in _types) {
      final selected = run.facts.where((fact) => fact.type == type);
      _equal(selected.map(_fact).toList(), byType[type], '$name $type');
      if (type != 'general_almanac') {
        _equal(
          eligibility.compatible
              .where((fact) => fact.type == type)
              .map(_fact)
              .toList(),
          eligibleSummary[type],
          '$name $type 匹配资格',
        );
      }
      totals.update(
        type,
        (value) => value + selected.length,
        ifAbsent: () => selected.length,
      );
    }
    _equal(
      eligibility.agreedTenGods
          .map((group) => group.map(_fact).toList())
          .toList(),
      row['agreedTenGods'],
      '$name 候选十神一致性',
    );
    final natalSources = run.rawFacts.where(
      (raw) => raw.payload.containsKey('rawChart'),
    );
    _equal(
      natalSources.map((raw) => raw.payload).toList(),
      row['natalSources'],
      '$name 大运原始证据',
    );

    validateFortuneFacts(time.window, run.facts, run.rawFacts);
    if (authorized != null && run.facts.isNotEmpty) _checkBinding(run);
    if (name == '北京晚子') await _checkFailureIsolation(time);
  }
  for (final required in [
    'luck_transition',
    'luck_pillar',
    'bazi_jie_month_context',
    'branch_clash',
    'general_almanac',
  ]) {
    if ((totals[required] ?? 0) == 0)
      throw StateError('$required was not exercised');
  }
  stdout.writeln(
    'Fortune verified ${totals.values.fold(0, (a, b) => a + b)} facts across ${oracle.length} archived scenarios.',
  );
}

FortuneJson _fixture(
  String name,
  String period,
  String at, {
  String zone = 'Asia/Shanghai',
  List<String> births = const [_base],
  bool timeKnown = true,
  int gender = 1,
  String? birthZone,
  bool brokenClock = false,
  bool incompatible = false,
  bool transition = false,
}) => {
  'name': name,
  'period': period,
  'at': at,
  'zone': zone,
  'births': births,
  'timeKnown': timeKnown,
  'gender': gender,
  'birthZone': birthZone,
  'brokenClock': brokenClock,
  'incompatible': incompatible,
  'transition': transition,
};

FortuneJson _fact(FortuneFact fact) {
  final json = fact.toJson()
    ..remove('factId')
    ..remove('sourceFactIds')
    ..remove('sourceEngine')
    ..remove('engineVersion');
  if (fact.type == 'general_almanac') {
    json['normalizedPayload'] = {...fact.payload}..remove('source');
  }
  return json;
}

Object? _canonical(Object? value) => switch (value) {
  Map<String, Object?>() => {
    for (final key in value.keys.toList()..sort()) key: _canonical(value[key]),
  },
  List() => value.map(_canonical).toList(),
  _ => value,
};

void _equal(Object? actual, Object? expected, String label) {
  String serialized(Object? value) => jsonEncode(_canonical(value));
  if (serialized(actual) == serialized(expected)) return;
  if (actual is List && expected is List) {
    if (actual.length != expected.length) {
      throw StateError(
        '$label count differs (${actual.length}/${expected.length})',
      );
    }
    final first = actual.indexed.firstWhere(
      (row) => serialized(row.$2) != serialized(expected[row.$1]),
    );
    throw StateError(
      '$label differs at ${first.$1}.\nDart: ${first.$2}\nNode: ${expected[first.$1]}',
    );
  }
  throw StateError('$label differs.\nDart: $actual\nNode: $expected');
}

void _checkBinding(FortuneFactRun run) {
  final mismatched = FortuneFactRun(
    runId: run.runId,
    time: run.time,
    methods: run.methods,
    facts: run.facts,
    rawFacts: run.rawFacts,
    reference: const FortuneChartReference(snapshotId: 'other-snapshot'),
  );
  final next = eligibleFortuneFacts(mismatched);
  if (next.compatible.isNotEmpty ||
      (run.facts.any((fact) => fact.method == FortuneMethod.bazi) &&
          run.methods[FortuneMethod.bazi]!.status ==
              FortuneMethodStatus.partial &&
          !next.incompatible.contains(FortuneMethod.bazi))) {
    throw StateError('A fact was accepted for an unrelated chart snapshot');
  }
}

Future<void> _checkFailureIsolation(FortuneFactTime time) async {
  final broken = await calculateFortuneFacts(
    time: time,
    runId: 'isolated',
    reference: const FortuneChartReference(
      snapshotId: 's',
      chart: {
        'timeKnown': true,
        'bazi': {
          'engineName': 'lunar-javascript',
          'engineVersion': '1.7.8',
          'rulesetVersion': 'utc8-jie-local-civil-late-zi-next-v1',
          'rawResult': [
            {'year': 'bad'},
          ],
        },
      },
    ),
  );
  if (broken.methods[FortuneMethod.bazi]!.status !=
          FortuneMethodStatus.failed ||
      broken.facts.any((fact) => fact.method == FortuneMethod.bazi) ||
      !broken.facts.any((fact) => fact.type == 'general_almanac')) {
    throw StateError('A rejected BaZi record changed the almanac output');
  }
}

Future<List<FortuneJson>> _node(List<FortuneJson> fixtures) async {
  final process = await Process.start(
    'node',
    ['--input-type=module', '--eval', _legacy],
    workingDirectory: Platform.script
        .resolve('../../../../../../../')
        .toFilePath(),
  );
  final output = utf8.decoder.bind(process.stdout).join();
  final errors = utf8.decoder.bind(process.stderr).join();
  process.stdin.add(
    utf8.encode(jsonEncode({'fixtures': fixtures, 'types': _types})),
  );
  await process.stdin.close();
  if (await process.exitCode != 0) throw StateError(await errors);
  return (jsonDecode(await output) as List).cast<FortuneJson>();
}

const _legacy = r'''
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';
import { resolve } from './src/features/fortune/server/resolve-fortune.mjs';
const legacyRoot = process.env.JOVIAN_LEGACY_NODE_ROOT;
registerHooks({ resolve(specifier, context, next) {
  try { return resolve(specifier, context, next); }
  catch (error) {
    if (!legacyRoot || error.code !== 'ERR_MODULE_NOT_FOUND' ||
        !/^(lunar-javascript|astronomy-engine|iztro)(?:\/|$)/u.test(specifier)) throw error;
    return next(specifier, { ...context, parentURL: pathToFileURL(join(legacyRoot, 'package.json')).href });
  }
}});
const { buildFactTimeContext } = await import('./src/features/fortune/control/fact-time-context.ts');
const { calculateFortuneFacts } = await import('./src/features/fortune/control/fortune-facts.ts');
const { eligibleFacts, requestForFortuneRun } = await import('./src/features/fortune/control/fortune-interpretation.ts');
const { civilClockEpoch } = await import('./src/features/fortune/control/period-window.ts');
const { lunarAtBeijing, lunarAtCivilClock } = await import('./src/features/fortune/control/fortune-calendar.ts');
const { fixtures, types } = JSON.parse(readFileSync(0, 'utf8'));
function read(fact) {
  const { factId, sourceFactIds, sourceEngine, engineVersion, ...result } = fact;
  if (fact.factType === 'general_almanac') {
    const { source, ...payload } = fact.normalizedPayload;
    result.normalizedPayload = payload;
  }
  return result;
}
function group(facts) {
  return Object.fromEntries(types.map(type => [type, facts.filter(row => row.factType === type).map(read)]));
}
function fixture(cfg) {
  const utc = Date.parse(cfg.at);
  const startSolar = (solar) => Date.parse(solar.toYmdHms().replace(' ', 'T') + '+08:00');
  let targetPeriod;
  const rows = cfg.births.map((birth) => {
    const born = Date.parse(birth);
    const lunar = lunarAtBeijing(born);
    const local = cfg.birthZone ? lunarAtCivilClock(civilClockEpoch(born, cfg.birthZone)) : lunar;
    const yun = lunar.getEightChar().getYun(cfg.gender, 2);
    const start = yun.getStartSolar();
    if (cfg.transition) targetPeriod = { year: new Date(startSolar(start.nextYear(30))).getUTCFullYear() };
    const luckPeriods = yun.getDaYun(11).slice(1).map(stage => ({
      ganZhi: stage.getGanZhi(), startAge: stage.getStartAge(), endAge: stage.getEndAge(),
    }));
    return {
      utc: new Date(born).toISOString(),
      year: lunar.getYearInGanZhiExact(), month: lunar.getMonthInGanZhiExact(),
      day: local.getDayInGanZhiExact(), hour: local.getTimeInGanZhi(),
      tenGods: {}, shenSha: {}, luckPeriods,
      luckContext: {
        profile: 'lunar-javascript-beijing-jie-sect2-v1',
        gender: cfg.gender === 1 ? 'male' : 'female', direction: yun.isForward() ? 'forward' : 'backward',
        periods: luckPeriods.map((row, index) => ({
          ...row, start: new Date(startSolar(start.nextYear(index * 10))).toISOString(),
          endExclusive: new Date(startSolar(start.nextYear((index + 1) * 10))).toISOString(),
        })),
      },
    };
  });
  const reference = rows.length ? {
    snapshotId: 'parity-snapshot', profileId: 'profile', profileVersion: '1',
    createdAt: '2026-11-21T13:00:00.000Z',
    chart: {
      timeKnown: cfg.timeKnown,
      bazi: { engineName: 'lunar-javascript', engineVersion: cfg.incompatible ? '0.0.0' : '1.7.8',
        rulesetVersion: 'utc8-jie-local-civil-late-zi-next-v1', rawResult: rows },
      ...(cfg.birthZone ? { birthContext: {
        precision: 'minute', clockVersion: 'gregory-iana-intl-v1',
        timeZone: cfg.birthZone,
        birthInstant: cfg.brokenClock
          ? new Date(Date.parse(rows[0].utc) + 60000).toISOString() : rows[0].utc,
      } } : {}),
      ziwei: { rawResult: [] }, western: { rawResult: [] },
    },
  } : null;
  const input = { periodType: cfg.period, displayTimezone: cfg.zone, targetPeriod };
  const time = buildFactTimeContext(input, utc, 'server');
  const run = calculateFortuneFacts(input, time, 'parity', reference ?? undefined);
  const eligibility = eligibleFacts(run, requestForFortuneRun(run));
  return {
    name: cfg.name, input, reference, time, asOf: utc,
    status: { bazi: run.methods.bazi.status, almanac: run.methods.almanac.status },
    facts: group(run.facts),
    eligible: group(eligibility.compatible),
    agreedTenGods: eligibility.agreedTenGods.map(values => values.map(read)),
    natalSources: run.rawFacts.filter(row => row.payload.rawChart).map(row => row.payload),
  };
}
process.stdout.write(JSON.stringify(fixtures.map(fixture)));
''';
