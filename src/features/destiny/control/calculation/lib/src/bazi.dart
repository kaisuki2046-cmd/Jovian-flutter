import 'package:jovian_destiny_model/jovian_destiny_model.dart';
import 'package:lunar/lunar.dart';

const baziRulesetVersion = 'utc8-jie-local-civil-late-zi-next-v1';
const shenShaRulesetVersion = 'natal-shensha-v1';
const _stems = '甲乙丙丁戊己庚辛壬癸';
const _branches = '子丑寅卯辰巳午未申酉戌亥';
const _nobleman = ['丑未', '子申', '亥酉', '亥酉', '丑未', '子申', '丑未', '寅午', '巳卯', '巳卯'];
const _wenChang = '巳午申酉申酉亥子寅卯';
const _lu = '寅卯巳午巳午申酉亥子';
const _groups = [
  (branches: '申子辰', horse: '寅', general: '子', canopy: '辰', peach: '酉'),
  (branches: '寅午戌', horse: '申', general: '午', canopy: '戌', peach: '卯'),
  (branches: '巳酉丑', horse: '亥', general: '酉', canopy: '丑', peach: '午'),
  (branches: '亥卯未', horse: '巳', general: '卯', canopy: '未', peach: '子'),
];

String baziNoblemanBranches(String stem) {
  final index = _stems.indexOf(stem);
  return stem.length == 1 && index >= 0 ? _nobleman[index] : '';
}

bool isBaZiPillar(String value) {
  if (value.length != 2) return false;
  final stem = _stems.indexOf(value[0]);
  final branch = _branches.indexOf(value[1]);
  return stem >= 0 && branch >= 0 && stem.isEven == branch.isEven;
}

List<Map<String, Object?>> _shenSha(
  FourPillars pillars,
  Pillar target,
  String branch,
  Map<Pillar, String> knownBranches,
) {
  final matches = <String, List<String>>{};
  void match(String name, Pillar source, String candidates) {
    if (candidates.contains(branch)) {
      (matches[name] ??= []).add(source.name);
    }
  }

  for (final source in [Pillar.year, Pillar.day]) {
    final value = pillars[source];
    final sourceBranch = value?[1] ?? knownBranches[source];
    if (value != null) {
      final stem = value[0];
      match('天乙贵人', source, baziNoblemanBranches(stem));
      match('文昌贵人', source, _wenChang[_stems.indexOf(stem)]);
    }
    if (source == target) continue;
    if (value != null) match('空亡', source, LunarUtil.getXunKong(value));
    if (sourceBranch == null) continue;
    final group = _groups.firstWhere(
      (group) => group.branches.contains(sourceBranch),
    );
    match('驿马', source, group.horse);
    match('将星', source, group.general);
    match('华盖', source, group.canopy);
    match('桃花', source, group.peach);
  }
  if (pillars[Pillar.day] case final day?) {
    match('禄神', Pillar.day, _lu[_stems.indexOf(day[0])]);
  }
  return [
    for (final MapEntry(:key, :value) in matches.entries)
      {'name': key, 'sourcePillars': value},
  ];
}

Map<String, Object?> _tenGods(String dayStem, Pillar position, String value) =>
    {
      'heavenlyStem': position == Pillar.day
          ? '日主'
          : LunarUtil.SHI_SHEN[dayStem + value[0]],
      'hiddenStems': [
        for (final hidden in LunarUtil.ZHI_HIDE_GAN[value[1]]!)
          {'stem': hidden, 'tenGod': LunarUtil.SHI_SHEN[dayStem + hidden]},
      ],
    };

Map<String, Object?> detailsFromKnownBaZiPillars(
  FourPillars pillars,
  Pillar position,
) {
  final year = pillars[Pillar.year];
  final day = pillars[Pillar.day];
  final value = pillars[position];
  return {
    if (day != null && value != null)
      'tenGods': _tenGods(day[0], position, value),
    if (year != null && day != null && value != null)
      'shenSha': _shenSha(pillars, position, value[1], const {}),
  };
}

List<Map<String, Object?>>? shenShaFromKnownBaZiPillars(
  FourPillars pillars,
  Pillar position, {
  Map<Pillar, String> knownBranches = const {},
}) {
  final target = pillars[position]?[1] ?? knownBranches[position];
  if (target == null ||
      ![Pillar.year, Pillar.day].any(
        (source) =>
            pillars.containsKey(source) || knownBranches.containsKey(source),
      ) ||
      !pillars.values.every(isBaZiPillar) ||
      knownBranches.entries.any((entry) {
        final value = pillars[entry.key];
        return entry.value.length != 1 ||
            !_branches.contains(entry.value) ||
            (value != null && value[1] != entry.value);
      })) {
    return null;
  }
  return _shenSha(pillars, position, target, knownBranches);
}

Map<String, Object?> describeBaZiPillars(FourPillars pillars) {
  final dayStem = pillars[Pillar.day]![0];
  return {
    for (final position in Pillar.values) position.name: pillars[position]!,
    'tenGods': {
      for (final position in Pillar.values)
        position.name: _tenGods(dayStem, position, pillars[position]!),
    },
    'shenSha': {
      for (final position in Pillar.values)
        position.name: _shenSha(
          pillars,
          position,
          pillars[position]![1],
          const {},
        ),
    },
    'shenShaRulesetVersion': shenShaRulesetVersion,
  };
}

Map<String, Object?> calculateBaZi(
  int instant,
  int wallTime, [
  BirthGender? gender,
]) {
  const utc8 = 8 * Duration.millisecondsPerHour;
  final termTime = instant + utc8;
  final terms = _lunarAt(termTime);
  final local = _lunarAt(wallTime);
  final elapsedDays =
      (termTime -
          _solarAsUtc(terms.getPrevJie().getSolar()).millisecondsSinceEpoch) /
      Duration.millisecondsPerDay;
  final fetalMonth = _lunarAt(
    termTime - 300 * Duration.millisecondsPerDay,
  ).getMonthInGanZhiExact();
  final yun = switch (gender) {
    BirthGender.male => terms.getEightChar().getYun(1, 2),
    BirthGender.female => terms.getEightChar().getYun(0, 2),
    _ => null,
  };
  final periods = [
    for (final period in yun?.getDaYunBy(11).skip(1) ?? const <DaYun>[])
      {
        'ganZhi': period.getGanZhi(),
        'startAge': period.getStartAge(),
        'endAge': period.getEndAge(),
      },
  ];
  final start = yun?.getStartSolar();
  String boundary(Solar solar, int years) => _solarAsUtc(
    solar.nextYear(years),
  ).subtract(const Duration(hours: 8)).toIso8601String();

  return {
    ...describeBaZiPillars({
      Pillar.year: terms.getYearInGanZhiExact(),
      Pillar.month: terms.getMonthInGanZhiExact(),
      Pillar.day: local.getDayInGanZhiExact(),
      Pillar.hour: local.getTimeInGanZhi(),
    }),
    'solarMonthXun': elapsedDays >= 0 && elapsedDays < 10 ? 'early' : null,
    'previousQi': terms.getPrevQi().getName(),
    'fetalMonthPillar': fetalMonth,
    'luckPeriods': periods,
    if (yun != null && start != null)
      'luckContext': {
        'profile': 'lunar-javascript-beijing-jie-sect2-v1',
        'gender': gender!.name,
        'direction': yun.isForward() ? 'forward' : 'backward',
        'periods': [
          for (final (index, period) in periods.indexed)
            {
              ...period,
              'start': boundary(start, index * 10),
              'endExclusive': boundary(start, (index + 1) * 10),
            },
        ],
      },
  };
}

Lunar _lunarAt(int milliseconds) {
  final time = DateTime.fromMillisecondsSinceEpoch(milliseconds, isUtc: true);
  return Solar.fromYmdHms(
    time.year,
    time.month,
    time.day,
    time.hour,
    time.minute,
    time.second,
  ).getLunar();
}

DateTime _solarAsUtc(Solar solar) => DateTime.utc(
  solar.getYear(),
  solar.getMonth(),
  solar.getDay(),
  solar.getHour(),
  solar.getMinute(),
  solar.getSecond(),
);
