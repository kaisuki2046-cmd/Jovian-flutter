import 'dart:math' as math;

import 'package:jovian_fortune_model/jovian_fortune_model.dart';
import 'package:lunar/lunar.dart';

import '../calendar.dart';
import '../preview.dart';

const baZiStems = '甲乙丙丁戊己庚辛壬癸';
const baZiBranches = '子丑寅卯辰巳午未申酉戌亥';
const baZiLayers = ['year', 'month', 'day', 'hour'];
const _tenGods = ['比肩', '劫财', '食神', '伤官', '偏财', '正财', '七杀', '正官', '偏印', '正印'];
const baZiRootPolicy = 'same-element-hidden-qi-v1';
const _hour = Duration.millisecondsPerHour;
const _day = Duration.millisecondsPerDay;

typedef BaZiInterval = ({int start, int end, String pillar, String? boundary});

Map<String, List<BaZiInterval>> baZiTimelines(DisplayWindow window) {
  if (window.start >= window.end || window.end - window.start > 368 * _day) {
    throw const FormatException('Invalid BaZi window');
  }
  final timelines = {for (final layer in baZiLayers) layer: <BaZiInterval>[]};
  void append(
    String layer,
    int start,
    int end,
    String pillar, [
    String? boundary,
  ]) {
    final items = timelines[layer]!;
    final last = items.lastOrNull;
    if (last != null && last.pillar == pillar) {
      items[items.length - 1] = (
        start: last.start,
        end: end,
        pillar: pillar,
        boundary: last.boundary,
      );
    } else {
      items.add((start: start, end: end, pillar: pillar, boundary: boundary));
    }
  }

  String? boundary;
  for (var start = window.start; start < window.end;) {
    final next = nextSolarBoundary(start);
    final end = math.min(window.end, next.time);
    final lunar = lunarAtBeijing(start);
    append('year', start, end, lunar.getYearInGanZhiExact(), boundary);
    append('month', start, end, lunar.getMonthInGanZhiExact(), boundary);
    boundary = next.name;
    start = end;
  }
  final local = window.start + beijingOffset + _hour;
  final dayStart = window.start - local % _day;
  for (var at = dayStart; at < window.end; at += _day) {
    final pillar = lunarAtBeijing(at).getDayInGanZhiExact();
    append(
      'day',
      math.max(at, window.start),
      math.min(at + _day, window.end),
      pillar,
      at >= window.start ? '晚子换日' : null,
    );
    final firstStem = baZiStems.indexOf(pillar[0]) % 5 * 2;
    for (var branch = 0; branch < 12; branch++) {
      final start = math.max(window.start, at + branch * 2 * _hour);
      final end = math.min(window.end, at + (branch + 1) * 2 * _hour);
      if (start < end) {
        append(
          'hour',
          start,
          end,
          baZiStems[(firstStem + branch) % 10] + baZiBranches[branch],
        );
      }
    }
  }
  return timelines;
}

FortuneJson describeFortuneBaZiPillar(String pillar, String dayStem) {
  final stem = pillar[0];
  final branch = pillar[1];
  final index = baZiBranches.indexOf(branch);
  final phaseIndex =
      (EightChar.CHANG_SHENG_OFFSET[dayStem]! +
          (baZiStems.indexOf(dayStem).isOdd ? -index : index)) %
      12;
  return {
    'pillar': pillar,
    'stem': stem,
    'stemElement': LunarUtil.WU_XING_GAN[stem]!,
    'tenGod': LunarUtil.SHI_SHEN[dayStem + stem]!,
    'branch': branch,
    'branchElement': LunarUtil.WU_XING_ZHI[branch]!,
    'naYin': LunarUtil.NAYIN[pillar]!,
    'xun': LunarUtil.getXun(pillar),
    'voidBranches': LunarUtil.getXunKong(pillar),
    'phase': EightChar.CHANG_SHENG[phaseIndex],
    'hiddenStems': [
      for (final hidden in LunarUtil.ZHI_HIDE_GAN[branch]!)
        {
          'stem': hidden,
          'element': LunarUtil.WU_XING_GAN[hidden]!,
          'tenGod': LunarUtil.SHI_SHEN[dayStem + hidden]!,
        },
    ],
  };
}

List<FortuneJson> baZiHiddenStems(FortuneJson detail) =>
    (detail['hiddenStems'] as List).cast<FortuneJson>();

({
  FortuneJson conditions,
  List<FortuneJson> stemConditions,
  FortuneJson structure,
})
describeFortuneBaZiNatal(Map<String, String> natal, bool timeKnown) {
  final day = natal['day']!;
  final dayMaster = day[0];
  final pillars = [
    for (final layer in baZiLayers)
      if (layer != 'hour' || timeKnown)
        {
          'layer': layer,
          ...describeFortuneBaZiPillar(natal[layer]!, dayMaster),
        },
  ];
  final exposed = pillars.where((pillar) => pillar['layer'] != 'day').toList();
  final hidden = pillars.expand(baZiHiddenStems).toList();
  List<String> unique(Iterable<FortuneJson> entries, String key) =>
      entries.map((entry) => entry[key] as String).toSet().toList();
  List<String> roots(String stem) => [
    for (final pillar in pillars)
      if (baZiHiddenStems(
        pillar,
      ).any((item) => item['element'] == LunarUtil.WU_XING_GAN[stem]))
        pillar['layer'] as String,
  ];
  final exposedGods = unique(exposed, 'tenGod');
  final hiddenGods = unique(hidden, 'tenGod');
  final gods = {...exposedGods, ...hiddenGods};
  final branches = [for (final pillar in pillars) pillar['branch'] as String];
  final counts = <String, int>{};
  for (final branch in branches) {
    counts.update(branch, (count) => count + 1, ifAbsent: () => 1);
  }
  final monthHidden = baZiHiddenStems(pillars[1]);
  final monthQi = monthHidden.first;
  final stems = <FortuneJson>[];
  for (final stem in baZiStems.split('')) {
    final positions = [
      for (final pillar in exposed)
        if (pillar['stem'] == stem) pillar['layer'] as String,
    ];
    final present = hidden.any((item) => item['stem'] == stem);
    final rootPositions = roots(stem);
    stems.add({
      'stem': stem,
      'tenGod': LunarUtil.SHI_SHEN[dayMaster + stem]!,
      if (positions.isNotEmpty || timeKnown) 'exposed': positions.isNotEmpty,
      if (present || timeKnown) 'hidden': present,
      if (rootPositions.isNotEmpty || timeKnown)
        'rooted': rootPositions.isNotEmpty,
      'exposurePositions': positions,
      'rootPositions': rootPositions,
      'rootPolicy': baZiRootPolicy,
    });
  }
  return (
    conditions: {
      'dayMaster': dayMaster,
      'yearPillar': natal['year'],
      'monthPillar': natal['month'],
      'dayPillar': day,
      if (timeKnown) ...{
        'hourPillar': natal['hour'],
        'hourBranch': natal['hour']![1],
      },
      'yearBranch': natal['year']![1],
      'monthBranch': natal['month']![1],
      'dayBranch': day[1],
      'timeKnown': timeKnown,
      'exposedStems': unique(exposed, 'stem'),
      'hiddenStems': unique(hidden, 'stem'),
      'exposedTenGods': exposedGods,
      'hiddenTenGods': hiddenGods,
      'presentTenGods': gods.toList(),
      if (timeKnown)
        'absentTenGods': _tenGods.where((god) => !gods.contains(god)).toList(),
      'branches': branches,
      'repeatedBranches': counts.keys
          .where((branch) => counts[branch]! > 1)
          .toList(),
      if (timeKnown)
        'singleBranches': counts.keys
            .where((branch) => counts[branch] == 1)
            .toList(),
      'monthMainQi': monthQi['stem'],
      'monthMainQiTenGod': monthQi['tenGod'],
      'monthHiddenTenGods': monthHidden.map((item) => item['tenGod']).toList(),
      'rootPolicy': baZiRootPolicy,
    },
    stemConditions: stems,
    structure: {
      'pillars': pillars,
      'dayMaster': dayMaster,
      'roots': roots(dayMaster),
      'timeKnown': timeKnown,
      'strength': 'undetermined',
      'usefulElements': 'undetermined',
    },
  );
}

typedef BaZiPillar = ({String id, String pillar});
typedef BaZiPair = ({String kind, List<String> members, String values});
typedef BaZiGroup = ({String kind, String values, List<List<String>> byBranch});
typedef BaZiElementRelation = ({
  String part,
  String from,
  String to,
  List<String> elements,
  String kind,
});

const _stemPairs = {
  '天干五合': ['甲己', '乙庚', '丙辛', '丁壬', '戊癸'],
  '天干四冲': ['甲庚', '乙辛', '丙壬', '丁癸'],
};
const _branchPairs = {
  '六合': ['子丑', '寅亥', '卯戌', '辰酉', '巳申', '午未'],
  '六冲': ['子午', '丑未', '寅申', '卯酉', '辰戌', '巳亥'],
  '六害': ['子未', '丑午', '寅巳', '卯辰', '申亥', '酉戌'],
  '六破': ['子酉', '丑辰', '寅亥', '卯午', '巳申', '未戌'],
  '相刑': ['子卯', '寅巳', '巳申', '申寅', '丑戌', '戌未', '未丑', '辰辰', '午午', '酉酉', '亥亥'],
};
const _branchGroups = {
  '三合': ['申子辰', '亥卯未', '寅午戌', '巳酉丑'],
  '三会': ['亥子丑', '寅卯辰', '巳午未', '申酉戌'],
  '三刑': ['寅巳申', '丑戌未'],
};

({
  List<BaZiPair> pairs,
  List<BaZiGroup> groups,
  List<BaZiElementRelation> elemental,
})
baZiRelations(List<BaZiPillar> pillars) {
  final pairs = <BaZiPair>[];
  final elemental = <BaZiElementRelation>[];
  for (final (index, first) in pillars.indexed) {
    for (final second in pillars.skip(index + 1)) {
      final members = [first.id, second.id];
      for (final (part, rules) in [_stemPairs, _branchPairs].indexed) {
        final values = first.pillar[part] + second.pillar[part];
        final reverse = second.pillar[part] + first.pillar[part];
        for (final MapEntry(key: kind, value: combinations) in rules.entries) {
          if (combinations.contains(values) || combinations.contains(reverse)) {
            pairs.add((kind: kind, members: members, values: values));
          }
        }
        final elements = part == 0
            ? LunarUtil.WU_XING_GAN
            : LunarUtil.WU_XING_ZHI;
        final from = elements[values[0]]!;
        final to = elements[values[1]]!;
        const order = '木火土金水';
        const relations = ['同五行', '前生后', '前克后', '后克前', '后生前'];
        elemental.add((
          part: part == 0 ? 'stem' : 'branch',
          from: first.id,
          to: second.id,
          elements: [from, to],
          kind: relations[(order.indexOf(to) - order.indexOf(from)) % 5],
        ));
      }
      if (first.pillar == second.pillar) {
        pairs.add((kind: '同柱', members: members, values: first.pillar));
      }
    }
  }
  final groups = <BaZiGroup>[];
  for (final MapEntry(key: kind, value: sets) in _branchGroups.entries) {
    for (final values in sets) {
      final locations = [
        for (final branch in values.split(''))
          [
            for (final item in pillars)
              if (item.pillar[1] == branch) item.id,
          ],
      ];
      if (locations.every((items) => items.isNotEmpty)) {
        groups.add((kind: kind, values: values, byBranch: locations));
      }
    }
  }
  return (pairs: pairs, groups: groups, elemental: elemental);
}

FortuneJson baZiPillarJson(BaZiPillar pillar) => {
  'id': pillar.id,
  'pillar': pillar.pillar,
};

FortuneJson baZiPairJson(BaZiPair pair) => {
  'kind': pair.kind,
  'members': pair.members,
  'values': pair.values,
};
