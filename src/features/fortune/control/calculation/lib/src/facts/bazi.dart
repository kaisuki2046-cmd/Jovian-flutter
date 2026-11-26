import 'dart:convert';
import 'dart:math' as math;

import 'package:jovian_fortune_model/jovian_fortune_model.dart';
import 'package:lunar/lunar.dart';

import '../calendar.dart';
import '../fact_time_context.dart';
import 'bazi_basis.dart';
import 'bazi_luck.dart';
import 'bazi_source.dart';
import 'context.dart';

const _scopes = {
  'year': FortuneFactScope.yearly,
  'month': FortuneFactScope.monthly,
  'day': FortuneFactScope.daily,
};
const _relationTypes = {
  '天干五合': 'stem_combine',
  '天干四冲': 'stem_clash',
  '六合': 'branch_combine',
  '六冲': 'branch_clash',
  '相刑': 'branch_punishment',
  '三刑': 'branch_punishment',
  '六害': 'branch_harm',
  '六破': 'branch_break',
  '三合': 'three_combinations',
  '三会': 'three_meetings',
  '同柱': 'same_pillar',
};

FortuneMethodResult writeBaZiFacts(
  FortuneFactWriter writer,
  FortuneFactTime time, {
  int Function(int)? birthWallClock,
}) {
  final chart = writer.reference?.chart;
  final archive = chart?['bazi'] as FortuneJson?;
  final raw = archive?['rawResult'] as List? ?? [];
  final compatible =
      archive?['rulesetVersion'] == 'utc8-jie-local-civil-late-zi-next-v1' &&
      (archive?['engineName'] == 'lunar-javascript' &&
              archive?['engineVersion'] == '1.7.8' ||
          archive?['engineName'] == fortuneBaZiPolicy.engine &&
              archive?['engineVersion'] == fortuneBaZiPolicy.version);
  final timeKnown = chart?['timeKnown'] == true;
  final birthContext = chart?['birthContext'] as FortuneJson?;
  final window = time.window;
  final timelines = baZiTimelines(window);
  final layers = switch (time.period) {
    FortunePeriod.year => const ['year'],
    FortunePeriod.month => const ['year', 'month'],
    _ => const ['year', 'month', 'day'],
  };
  final level = layers.last;
  final scope = _scopes[level]!;
  final cuts = {
    window.start,
    window.end,
    for (final layer in layers)
      for (final item in timelines[layer]!) item.start,
  };
  final candidates = <_Natal>[];
  if (compatible) {
    for (final (index, archived) in raw.cast<FortuneJson>().indexed) {
      final pillars = {
        for (final layer in baZiLayers) layer: archived[layer] as String,
      };
      if (!pillars.values.every(LunarUtil.JIA_ZI.contains)) {
        throw const FormatException('Invalid archived BaZi pillar');
      }
      final directions = baZiLuckDirections(
        archived,
        pillars,
        timeKnown && raw.length == 1,
      );
      final rawId = writer.raw({
        'rawChart': archived,
        'startDirections': directions.map(baZiLuckJson).toList(),
      });
      final born = archivedBaZiInstant(archived['utc']);
      final candidate = _Natal(
        pillars: pillars,
        born: born,
        timeKnown: timeKnown,
        subject: 'bazi:candidate:$index',
        source: rawId,
        directions: directions,
        clockReady: baZiBirthClockReady(
          natal: pillars,
          timeKnown: timeKnown,
          born: born,
          context: birthContext,
          birthWallClock: birthWallClock,
        ),
      );
      candidates.add(candidate);
      cuts.addAll(
        directions
            .expand((row) => row.stages)
            .map((row) => row.start)
            .where((instant) => window.start < instant && instant < window.end),
      );
    }
  }
  for (final natal in candidates) {
    _writeNatal(writer, window, natal);
  }

  final segments = <FortuneJson>[];
  final ongoing = <String, DisplayWindow>{};
  final boundaries = cuts.toList()..sort();
  final months = <String, BaZiJieMonth>{};
  for (var index = 1; index < boundaries.length; index++) {
    final range = DisplayWindow(boundaries[index - 1], boundaries[index]);
    final flows = <BaZiFlow>[];
    for (final layer in layers) {
      final interval = timelines[layer]!.firstWhere(
        (row) => row.start <= range.start && range.start < row.end,
      );
      flows.add((
        layer: layer,
        pillar: interval.pillar,
        boundary: interval.start == range.start ? interval.boundary : null,
      ));
    }
    final segment = {
      ...fortuneUtcRange(range.start, range.end),
      'flows': [
        for (final flow in flows)
          {
            'layer': flow.layer,
            'pillar': flow.pillar,
            if (flow.boundary != null) 'boundary': flow.boundary,
          },
      ],
      'baziTimezone': fortuneBaZiPolicy.timeZone,
      'displayTimezone': time.timeZone,
      'boundary': flows
          .map((flow) => flow.boundary)
          .whereType<String>()
          .toList(),
      'policyVersion': fortuneBaZiPolicy.rules,
    };
    final segmentSource = writer.raw(segment);
    segments.add(segment);
    writer.add(
      range,
      type: 'time_segment',
      scope: scope,
      subjects: layers,
      payload: segment,
      sources: [segmentSource],
    );
    if (level == 'day') {
      writer.add(
        range,
        type: 'calendar_pattern',
        scope: FortuneFactScope.daily,
        subjects: ['flow:month', 'flow:day'],
        payload: baZiMonthDayPattern(flows[1].pillar, flows[2].pillar),
        sources: [segmentSource],
      );
    }
    final jieMonth = level == 'month'
        ? months.putIfAbsent(flows.last.pillar, () => baZiJieMonth(range.start))
        : null;
    for (final natal in candidates) {
      _writeFlow(
        writer,
        scope,
        range,
        natal,
        flows,
        segmentSource,
        ongoing,
        jieMonth,
      );
    }
  }
  return FortuneMethodResult(
    !compatible && raw.isNotEmpty
        ? FortuneMethodStatus.notSupported
        : FortuneMethodStatus.partial,
    nativeWindow: {'segments': segments},
    warnings: [
      if (candidates.isEmpty) '缺少兼容本命盘，已保留流柱区间',
      if (candidates.isNotEmpty) ...[
        '身强弱、取用及合化救应条件待确认',
        if (!candidates.every(
          (natal) => natal.directions.any((row) => row.confirmed),
        ))
          '正式起运方案未与上游大运表核验一致',
        if (!timeKnown) '出生时刻未确认',
        '部分流年、流月和流日的来源专用条件仍在迁移',
      ],
    ],
  );
}

class _Natal {
  _Natal({
    required this.pillars,
    required this.born,
    required this.timeKnown,
    required this.subject,
    required this.source,
    required this.directions,
    required this.clockReady,
  }) : details = describeFortuneBaZiNatal(pillars, timeKnown);

  final Map<String, String> pillars;
  final int? born;
  final bool timeKnown;
  final String subject;
  final String source;
  final List<BaZiLuckDirection> directions;
  final bool clockReady;
  final ({
    FortuneJson conditions,
    List<FortuneJson> stemConditions,
    FortuneJson structure,
  })
  details;
  String get master => pillars['day']![0];
}

void _writeNatal(FortuneFactWriter writer, DisplayWindow window, _Natal natal) {
  for (final transition in baZiLuckTransitions(window, natal.directions)) {
    final at = transition['at'] as int;
    final confirmed = transition['confirmed'] == true;
    writer.add(
      DisplayWindow(at, math.min(window.end, at + 1000)),
      type: 'luck_transition',
      scope: FortuneFactScope.decadal,
      subjects: [natal.subject, 'decadal'],
      exactAt: at,
      precision: FortuneFactPrecision.second,
      completeness: confirmed
          ? FortuneCompleteness.complete
          : FortuneCompleteness.partial,
      warnings: confirmed ? [] : ['正式起运方案未核验，交运仅为候选'],
      payload: transition,
      sources: [natal.source],
    );
  }
  writer.add(
    window,
    type: 'natal_conditions',
    scope: FortuneFactScope.natal,
    subjects: [natal.subject],
    payload: natal.details.conditions,
    sources: [natal.source],
  );
  for (final conditions in natal.details.stemConditions) {
    writer.add(
      window,
      type: 'stem_condition',
      scope: FortuneFactScope.natal,
      subjects: [natal.subject, "stem:${conditions['stem']}"],
      payload: conditions,
      sources: [natal.source],
    );
  }
  writer.add(
    window,
    type: 'natal_structure',
    scope: FortuneFactScope.natal,
    subjects: [natal.subject],
    payload: natal.details.structure,
    sources: [natal.source],
  );
}

void _writeFlow(
  FortuneFactWriter writer,
  FortuneFactScope scope,
  DisplayWindow range,
  _Natal natal,
  List<BaZiFlow> flows,
  String segment,
  Map<String, DisplayWindow> ongoing,
  BaZiJieMonth? jieMonth,
) {
  final sources = [segment, natal.source];
  final native = [
    for (final layer in baZiLayers)
      if (layer != 'hour' || natal.timeKnown)
        (id: 'natal:$layer', pillar: natal.pillars[layer]!),
  ];
  final shared = [
    ...native,
    for (final flow in flows) (id: 'flow:${flow.layer}', pillar: flow.pillar),
  ];
  final interactions = baZiRelations(shared);
  final last = flows.last;
  final moving = 'flow:${last.layer}';
  final detail = describeFortuneBaZiPillar(last.pillar, natal.master);
  for (final flow in flows) {
    writer.add(
      range,
      type: 'layer_pillar',
      scope: _scopes[flow.layer]!,
      subjects: [natal.subject, 'flow:${flow.layer}'],
      payload: {
        'layer': flow.layer,
        ...describeFortuneBaZiPillar(flow.pillar, natal.master),
        'natalPillars': native.map(baZiPillarJson).toList(),
        'calendarPolicy': fortuneBaZiPolicy.rules,
      },
      sources: sources,
    );
  }
  writer.add(
    range,
    type: 'source_layer_context',
    scope: scope,
    subjects: [natal.subject],
    payload: baZiSourceLayer(natal.pillars, natal.timeKnown, native, flows),
    sources: sources,
  );
  final born = natal.born;
  if (natal.clockReady && born != null && jieMonth != null) {
    final start = math.max(born, range.start);
    if (jieMonth.monthly == last.pillar &&
        jieMonth.annual == flows.first.pillar &&
        jieMonth.start <= start &&
        start < range.end &&
        range.end <= jieMonth.end) {
      writer.add(
        DisplayWindow(start, range.end),
        type: 'bazi_jie_month_context',
        scope: FortuneFactScope.monthly,
        subjects: [
          natal.subject,
          'flow:year',
          'flow:month',
          'natal:year',
          'natal:day',
        ],
        payload: {
          'monthPillar': last.pillar,
          'annualPillar': flows.first.pillar,
          'jieStartDate': fortuneReferenceFields(jieMonth.start).date,
          'dayMaster': natal.master,
          'monthTenGod': detail['tenGod'],
          'natalDayBranch': natal.pillars['day']![1],
          'natalYearBranch': natal.pillars['year']![1],
          'clashedNatalPositions': [
            for (final row in interactions.pairs)
              if (row.kind == '六冲' && row.members.contains('flow:month'))
                for (final id in row.members)
                  if (id == 'natal:day' || id == 'natal:year') id,
          ],
        },
        sources: sources,
      );
    }
  }
  for (final pair in interactions.pairs) {
    writer.add(
      range,
      type: 'pillar_relation',
      scope: scope,
      subjects: [natal.subject, ...pair.members],
      payload: {
        ...baZiPairJson(pair),
        'pillars': _selectedPillars(shared, pair.members),
      },
      sources: sources,
    );
  }
  writer.add(
    range,
    type: 'ten_god',
    scope: scope,
    subjects: [natal.subject, 'natal:day', moving],
    payload: {
      'dayMaster': natal.master,
      'stem': detail['stem'],
      'tenGod': detail['tenGod'],
    },
    sources: sources,
  );
  for (final hidden in baZiHiddenStems(detail)) {
    writer.add(
      range,
      type: 'hidden_stem_ten_god',
      scope: scope,
      subjects: [natal.subject, 'natal:day', moving],
      payload: {
        'dayMaster': natal.master,
        'branch': detail['branch'],
        ...hidden,
      },
      sources: sources,
    );
  }
  _writeRelations(
    writer,
    range,
    scope,
    natal.subject,
    moving,
    shared,
    interactions,
    ongoing,
    sources,
  );
  final earliestYear =
      DateTime.fromMillisecondsSinceEpoch(range.start, isUtc: true).year - 1;
  final latestYear =
      DateTime.fromMillisecondsSinceEpoch(range.end, isUtc: true).year + 1;
  final confirmed = natal.directions
      .where((direction) => direction.confirmed)
      .toList();
  for (final direction in confirmed.isEmpty ? natal.directions : confirmed) {
    final stage = direction.stages
        .where((stage) => stage.start <= range.start && range.start < stage.end)
        .firstOrNull;
    if (stage?.pillar == null) continue;
    final currentStage = stage!;
    final stagePillar = currentStage.pillar!;
    final pillar = stagePillar['pillar'] as String;
    final completeness = direction.confirmed
        ? FortuneCompleteness.complete
        : FortuneCompleteness.partial;
    final timing = {
      'selectionPolicy': baZiLuckSelection,
      'stageStart': fortuneIsoUtc(currentStage.start),
      'stageEnd': fortuneIsoUtc(currentStage.end),
    };
    writer.add(
      range,
      type: 'luck_conditions',
      scope: FortuneFactScope.decadal,
      subjects: [natal.subject, 'decadal'],
      completeness: completeness,
      warnings: direction.confirmed ? [] : ['上游大运表未与唯一重算方案一致'],
      sources: sources,
      payload: {
        ...baZiLuckConditions(
          pillar,
          natal.master,
          natal.pillars,
          natal.timeKnown,
          natal.details.conditions,
          natal.details.stemConditions,
          flows.first.pillar,
        ),
        'confirmed': direction.confirmed,
        'pillar': pillar,
        ...timing,
      },
    );
    writer.add(
      range,
      type: 'luck_pillar',
      scope: FortuneFactScope.decadal,
      subjects: [natal.subject, 'decadal'],
      completeness: completeness,
      warnings: direction.confirmed ? [] : ['出生性别与起运口径未从上游确认，分别保留顺逆方案'],
      sources: sources,
      payload: {
        ...stagePillar,
        'genderBasis': direction.genderBasis,
        'direction': direction.direction,
        'confirmed': direction.confirmed,
        ...timing,
        'startAge': currentStage.startAge,
        'endAge': currentStage.endAge,
        'minorYears': [
          for (final row in currentStage.years)
            if ((row['year'] as int) >= earliestYear &&
                (row['year'] as int) <= latestYear)
              {'year': row['year'], 'pillar': row['minor']},
        ],
      },
    );
    final withLuck = [...shared, (id: 'decadal', pillar: pillar)];
    _writeRelations(
      writer,
      range,
      scope,
      natal.subject,
      moving,
      withLuck,
      baZiRelations(withLuck),
      ongoing,
      sources,
      direction,
    );
  }
}

List<FortuneJson> _selectedPillars(
  List<BaZiPillar> pillars,
  List<String> ids,
) => [
  for (final row in pillars)
    if (ids.contains(row.id)) baZiPillarJson(row),
];

void _writeRelations(
  FortuneFactWriter writer,
  DisplayWindow range,
  FortuneFactScope scope,
  String subject,
  String moving,
  List<BaZiPillar> pillars,
  ({
    List<BaZiPair> pairs,
    List<BaZiGroup> groups,
    List<BaZiElementRelation> elemental,
  })
  relations,
  Map<String, DisplayWindow> ongoing,
  List<String> sources, [
  BaZiLuckDirection? luck,
]) {
  void emit(String type, List<String> ids, FortuneJson payload) {
    if (!ids.contains(moving) || (luck != null && !ids.contains('decadal')))
      return;
    final selected = _selectedPillars(pillars, ids);
    final key = jsonEncode([subject, type, selected, luck?.genderBasis]);
    final previous = ongoing[key];
    final start = previous != null && previous.end == range.start
        ? previous.start
        : range.start;
    ongoing[key] = DisplayWindow(start, range.end);
    final provisional = luck != null && !luck.confirmed;
    writer.add(
      range,
      type: type,
      scope: scope,
      subjects: [subject, ...ids],
      parentSignalId: 'bazi:$key:$start',
      completeness: provisional
          ? FortuneCompleteness.partial
          : FortuneCompleteness.complete,
      warnings: provisional ? ['大运为条件推算，尚未确认正式起运口径'] : [],
      payload: {
        ...payload,
        'pillars': selected,
        'ruleId': 'fortune-bazi-$type-v1',
        'conditionsMet': ['干支模式匹配'],
        'unresolvedConditions': ['合化条件未计算'],
        if (luck != null)
          'luck': {
            'genderBasis': luck.genderBasis,
            'direction': luck.direction,
            'confirmed': luck.confirmed,
          },
      },
      sources: sources,
    );
  }

  for (final pair in relations.pairs) {
    emit(_relationTypes[pair.kind]!, pair.members, baZiPairJson(pair));
  }
  for (final group in relations.groups) {
    emit(
      _relationTypes[group.kind]!,
      group.byBranch.expand((ids) => ids).toList(),
      {'kind': group.kind, 'values': group.values, 'byBranch': group.byBranch},
    );
  }
  for (final link in relations.elemental) {
    if (link.kind == '同五行') continue;
    emit(
      link.kind.contains('克') ? 'controlling' : 'generating',
      [link.from, link.to],
      {
        'part': link.part,
        'from': link.from,
        'to': link.to,
        'elements': link.elements,
        'kind': link.kind,
      },
    );
  }
}
