import 'package:jovian_fortune_model/jovian_fortune_model.dart';

import '../calendar.dart';
import '../preview.dart';
import 'bazi_basis.dart';
import 'bazi_luck.dart';

const _dayClock = 'beijing-civil-23-v1';

int? _adjacentStep(int offset, int size) => switch (offset % size) {
  1 => 1,
  final value when value == size - 1 => -1,
  _ => null,
};

FortuneJson baZiMonthDayPattern(String month, String day) => {
  'profile': 'lu-first-degree-twist-v1',
  'dayClock': _dayClock,
  ..._twist(month, day),
};

FortuneJson _twist(String first, String second) {
  final stems = baZiStems.indexOf(second[0]) - baZiStems.indexOf(first[0]);
  final branches =
      baZiBranches.indexOf(second[1]) - baZiBranches.indexOf(first[1]);
  final stemStep = _adjacentStep(stems, 10);
  final branchStep = _adjacentStep(branches, 12);
  return {
    'first': first,
    'second': second,
    if (stemStep != null) 'stemStep': stemStep,
    if (branchStep != null) 'branchStep': branchStep,
    'firstDegree': stemStep != null && branchStep == -stemStep,
    'stemWrap': stems.abs() == 9,
    'branchWrap': branches.abs() == 11,
  };
}

typedef BaZiFlow = ({String layer, String pillar, String? boundary});

FortuneJson baZiSourceLayer(
  Map<String, String> natal,
  bool timeKnown,
  List<BaZiPillar> natalPillars,
  List<BaZiFlow> flows,
) {
  final master = natal['day']![0];
  final payload = <String, Object?>{
    'policyVersion': baZiSourcePolicy,
    'calendarPolicy': _dayClock,
    'timeKnown': timeKnown,
    'dayMaster': master,
    'natalYear': natal['year'],
    'natalMonth': natal['month'],
    'natalDay': natal['day'],
    if (timeKnown) 'natalHour': natal['hour'],
    'natalMonthStem': natal['month']![0],
    'natalBranches': [for (final row in natalPillars) row.pillar[1]],
  };
  final relations = <String>[];
  final twists = <String>[];
  for (final flow in flows) {
    final layer = flow.layer;
    final detail = describeFortuneBaZiPillar(flow.pillar, master);
    final qi = baZiHiddenStems(detail).first;
    payload.addAll({
      layer: flow.pillar,
      '${layer}Available': true,
      '${layer}Stem': detail['stem'],
      '${layer}Branch': detail['branch'],
      '${layer}TenGod': detail['tenGod'],
      '${layer}Element': detail['stemElement'],
      '${layer}MainQiTenGod': qi['tenGod'],
      '${layer}StemMainQiSameElement': detail['stemElement'] == qi['element'],
    });
    final compared = baZiRelations([
      ...natalPillars,
      (id: 'flow', pillar: flow.pillar),
    ]);
    for (final pair in compared.pairs.where(
      (pair) => pair.members.contains('flow'),
    )) {
      final target = pair.members.firstWhere((id) => id != 'flow');
      relations.add('$layer:$target:${pair.kind}');
    }
    for (final row in natalPillars) {
      if (_twist(row.pillar, flow.pillar)['firstDegree'] == true) {
        twists.add('$layer:${row.id}');
      }
    }
  }
  if (payload.containsKey('year')) {
    if (payload.containsKey('month')) {
      payload['yearMonthSameStemElement'] =
          payload['yearElement'] == payload['monthElement'];
    }
    if (payload.containsKey('day')) {
      payload['yearDaySameStemElement'] =
          payload['yearElement'] == payload['dayElement'];
    }
  }
  return {...payload, 'relations': relations, 'firstDegreeTwists': twists};
}

bool baZiBirthClockReady({
  required Map<String, String> natal,
  required bool timeKnown,
  required int? born,
  FortuneJson? context,
  int Function(int)? birthWallClock,
}) {
  if (born == null) return false;
  final beijing = lunarAtBeijing(born);
  if (natal['year'] != beijing.getYearInGanZhiExact() ||
      natal['month'] != beijing.getMonthInGanZhiExact())
    return false;
  if (context == null) {
    return natal['day'] == beijing.getDayInGanZhiExact() &&
        (!timeKnown || natal['hour'] == beijing.getTimeInGanZhi());
  }
  if (!timeKnown ||
      context['precision'] != 'minute' ||
      context['clockVersion'] != 'gregory-iana-intl-v1' ||
      archivedBaZiInstant(context['birthInstant']) != born ||
      birthWallClock == null) {
    return false;
  }
  final local = lunarAtCivilClock(birthWallClock(born));
  return natal['day'] == local.getDayInGanZhiExact() &&
      natal['hour'] == local.getTimeInGanZhi();
}

typedef BaZiJieMonth = ({int start, int end, String annual, String monthly});

BaZiJieMonth baZiJieMonth(int instant) {
  final start = beijingSolarInstant(
    lunarAtBeijing(instant).getPrevJie().getSolar(),
  );
  final end = nextSolarBoundary(instant).time;
  final representative = lunarAtBeijing(start + (end - start) ~/ 2);
  return (
    start: start,
    end: end,
    annual: representative.getYearInGanZhiExact(),
    monthly: representative.getMonthInGanZhiExact(),
  );
}

FortuneJson baZiLuckConditions(
  String pillar,
  String dayMaster,
  Map<String, String> natal,
  bool timeKnown,
  FortuneJson structure,
  List<FortuneJson> stems,
  String year,
) {
  final detail = describeFortuneBaZiPillar(pillar, dayMaster);
  final native = [
    for (final layer in baZiLayers)
      if (layer != 'hour' || timeKnown) (id: layer, pillar: natal[layer]!),
  ];
  final moving = baZiRelations([...native, (id: 'moving', pillar: pillar)]);
  List<BaZiPair> movingPairs(List<BaZiPair> pairs) =>
      pairs.where((pair) => pair.members.contains('moving')).toList();
  List<String> positions(List<BaZiPair> pairs, String kind) => [
    for (final row in pairs)
      if (row.kind == kind)
        row.members.firstWhere((member) => member != 'moving'),
  ];
  final pairs = movingPairs(moving.pairs);
  final clashed = positions(pairs, '六冲');
  final yearly = movingPairs(
    baZiRelations([...native, (id: 'moving', pillar: year)]).pairs,
  );
  final branch = detail['branch'] as String;
  final stem = detail['stem'] as String;
  final hidden = baZiHiddenStems(detail);
  final root = stems.singleWhere((entry) => entry['stem'] == stem)['rooted'];
  final reveals =
      stem != dayMaster &&
      (structure['hiddenStems'] as List).contains(stem) &&
      !(structure['exposedStems'] as List).contains(stem);
  return {
    'stem': stem,
    'branch': branch,
    'tenGod': detail['tenGod'],
    'hiddenTenGods': hidden.map((row) => row['tenGod']).toList(),
    'mainQiTenGod': hidden.first['tenGod'],
    'stemRootedInLuckBranch': hidden.any(
      (row) => row['element'] == detail['stemElement'],
    ),
    if (root != null) 'stemRootedInNatal': root,
    if (reveals || timeKnown) 'revealsNatalHiddenStem': reveals,
    'stemCombinesNatalPositions': positions(pairs, '天干五合'),
    'clashedNatalPositions': clashed,
    'annualJointClashPositions': positions(
      yearly,
      '六冲',
    ).where(clashed.contains).toList(),
    'branchInteractionKinds': {
      for (final pair in pairs)
        if (pair.kind != '天干五合' && pair.kind != '天干四冲') pair.kind,
      for (final group in moving.groups)
        if (group.byBranch.expand((row) => row).contains('moving')) group.kind,
    }.toList(),
    'branchDirection': const [
      '寅卯辰',
      '巳午未',
      '申酉戌',
      '亥子丑',
    ].indexWhere((group) => group.contains(branch)),
    'rootPolicy': baZiRootPolicy,
  };
}
