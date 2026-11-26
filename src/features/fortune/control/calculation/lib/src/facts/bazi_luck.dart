import 'package:jovian_fortune_model/jovian_fortune_model.dart';
import 'package:lunar/lunar.dart';

import '../calendar.dart';
import 'bazi_basis.dart';

const baZiLuckSelection = 'archived-table-recomputed-sect2-v1';
const _transitionProfile =
    'smth-forward-corners-same-season-and-gui-jia-separate-v2';
const baZiSourcePolicy = 'fortune-bazi-source-context-v1';

typedef BaZiLuckStage = ({
  int index,
  FortuneJson? pillar,
  int start,
  int end,
  int startAge,
  int endAge,
  int engineStartYear,
  int engineEndYear,
  List<FortuneJson> years,
});

typedef BaZiLuckDirection = ({
  int start,
  String genderBasis,
  String direction,
  bool confirmed,
  FortuneJson offset,
  List<BaZiLuckStage> stages,
});

int beijingSolarInstant(Solar solar) =>
    DateTime.utc(
      solar.getYear(),
      solar.getMonth(),
      solar.getDay(),
      solar.getHour(),
      solar.getMinute(),
      solar.getSecond(),
    ).millisecondsSinceEpoch -
    beijingOffset;

int? archivedBaZiInstant(Object? utc) =>
    utc is String ? DateTime.tryParse(utc)?.millisecondsSinceEpoch : null;

List<BaZiLuckDirection> baZiLuckDirections(
  FortuneJson natal,
  Map<String, String> pillars,
  bool canConfirm,
) {
  final born = archivedBaZiInstant(natal['utc']);
  if (born == null) return [];
  final lunar = lunarAtBeijing(born);
  if (lunar.getYearInGanZhiExact() != pillars['year'] ||
      lunar.getMonthInGanZhiExact() != pillars['month'])
    return [];
  final hourIndex = LunarUtil.getJiaZiIndex(pillars['hour']!);
  final dayStem = pillars['day']![0];
  final directions = <BaZiLuckDirection>[];
  for (final gender in [0, 1]) {
    final yun = lunar.getEightChar().getYun(gender, 2);
    final forward = yun.isForward();
    final date = yun.getStartSolar();
    final stages = <BaZiLuckStage>[];
    for (final stage in yun.getDaYunBy(13)) {
      final index = stage.getIndex();
      final pillar = stage.getGanZhi();
      final years = <FortuneJson>[];
      for (final year in stage.getLiuNian()) {
        final age = year.getAge();
        final minor = (hourIndex + (forward ? age : -age)) % 60;
        years.add({
          'year': year.getYear(),
          'age': age,
          'pillar': year.getGanZhi(),
          'minor': LunarUtil.JIA_ZI[minor],
          'months': year.getLiuYue().map((row) => row.getGanZhi()).toList(),
        });
      }
      stages.add((
        index: index,
        pillar: pillar.isEmpty
            ? null
            : describeFortuneBaZiPillar(pillar, dayStem),
        start: index == 0
            ? born
            : beijingSolarInstant(date.nextYear((index - 1) * 10)),
        end: beijingSolarInstant(date.nextYear(index * 10)),
        engineStartYear: stage.getStartYear(),
        engineEndYear: stage.getEndYear(),
        startAge: stage.getStartAge(),
        endAge: stage.getEndAge(),
        years: years,
      ));
    }
    directions.add((
      genderBasis: gender == 1 ? '男' : '女',
      direction: forward ? 'forward' : 'backward',
      start: beijingSolarInstant(date),
      offset: {
        'years': yun.getStartYear(),
        'months': yun.getStartMonth(),
        'days': yun.getStartDay(),
        'hours': yun.getStartHour(),
      },
      stages: stages,
      confirmed: false,
    ));
  }
  final archived = natal['luckPeriods'];
  final stated = natal['luckContext'];
  final confirmed = canConfirm && archived is List && archived.length == 10
      ? directions
            .where((direction) => _agrees(direction, archived, stated))
            .toList()
      : <BaZiLuckDirection>[];
  return [
    for (final direction in directions)
      (
        genderBasis: direction.genderBasis,
        direction: direction.direction,
        start: direction.start,
        offset: direction.offset,
        stages: direction.stages,
        confirmed:
            confirmed.length == 1 &&
            identical(confirmed.single.stages, direction.stages),
      ),
  ];
}

bool _agrees(
  BaZiLuckDirection direction,
  List<dynamic> archive,
  Object? stated,
) {
  List? disclosed;
  if (stated != null) {
    if (stated is! FortuneJson ||
        stated['profile'] != 'lunar-javascript-beijing-jie-sect2-v1' ||
        stated['gender'] !=
            (direction.genderBasis == '男' ? 'male' : 'female') ||
        stated['direction'] != direction.direction ||
        stated['periods'] is! List)
      return false;
    disclosed = stated['periods'] as List;
    if (disclosed.length != archive.length) return false;
  }
  return archive.indexed.every((row) {
    final (index, item) = row;
    final stage = direction.stages[index + 1];
    if (item is! FortuneJson ||
        item['ganZhi'] != stage.pillar?['pillar'] ||
        item['startAge'] != stage.startAge ||
        item['endAge'] != stage.endAge)
      return false;
    if (disclosed == null) return true;
    final entry = disclosed[index];
    return entry is FortuneJson &&
        entry['ganZhi'] == item['ganZhi'] &&
        entry['startAge'] == item['startAge'] &&
        entry['endAge'] == item['endAge'] &&
        archivedBaZiInstant(entry['start']) == stage.start &&
        archivedBaZiInstant(entry['endExclusive']) == stage.end;
  });
}

FortuneJson baZiLuckJson(BaZiLuckDirection direction) => {
  'genderBasis': direction.genderBasis,
  'direction': direction.direction,
  'start': direction.start,
  'offset': direction.offset,
  'stages': [
    for (final stage in direction.stages)
      {
        'index': stage.index,
        'pillar': stage.pillar,
        'start': stage.start,
        'end': stage.end,
        'engineStartYear': stage.engineStartYear,
        'engineEndYear': stage.engineEndYear,
        'startAge': stage.startAge,
        'endAge': stage.endAge,
        'years': stage.years,
      },
  ],
  'confirmed': direction.confirmed,
  'selectionPolicy': baZiLuckSelection,
};

Iterable<FortuneJson> baZiLuckTransitions(
  DisplayWindow window,
  List<BaZiLuckDirection> directions,
) sync* {
  final verified = directions
      .where((direction) => direction.confirmed)
      .toList();
  for (final direction in verified.length == 1 ? verified : directions) {
    final stages = direction.stages;
    for (var index = 1; index < stages.length; index++) {
      final previous = stages[index - 1];
      final next = stages[index];
      final from = previous.pillar?['pillar'] as String?;
      final to = next.pillar?['pillar'] as String?;
      if (from == null ||
          to == null ||
          previous.index + 1 != next.index ||
          previous.end != next.start ||
          previous.start >= previous.end ||
          next.start >= next.end ||
          next.start < window.start ||
          next.start >= window.end)
        continue;
      final step = direction.direction == 'forward' ? 1 : -1;
      if (baZiStems[(baZiStems.indexOf(from[0]) + step) % 10] != to[0] ||
          baZiBranches[(baZiBranches.indexOf(from[1]) + step) % 12] != to[1])
        continue;
      final pair = from[1] + to[1];
      final fromSeason = _season(from[1]), toSeason = _season(to[1]);
      yield {
        'at': next.start,
        'fromPillar': from,
        'toPillar': to,
        'forwardCorner': const ['丑寅', '辰巳', '未申', '戌亥'].contains(pair),
        'reverseCorner': const ['寅丑', '巳辰', '申未', '亥戌'].contains(pair),
        'fromSeason': fromSeason,
        'toSeason': toSeason,
        'sameSeason': fromSeason == toSeason,
        'transitionProfile': _transitionProfile,
        'stemWrap': from[0] == '癸' && to[0] == '甲',
        'confirmed': verified.length == 1 && direction.confirmed,
        'direction': direction.direction,
        'policyVersion': baZiSourcePolicy,
      };
    }
  }
}

String _season(String branch) {
  const seasons = {'寅卯辰': '东', '巳午未': '南', '申酉戌': '西', '亥子丑': '北'};
  return seasons.entries.firstWhere((row) => row.key.contains(branch)).value;
}
