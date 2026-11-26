import 'dart:math';

import 'package:jovian_divination_model/iching.dart';

import 'cast_calendar.dart';

const _branchElements = {
  '子': '水',
  '丑': '土',
  '寅': '木',
  '卯': '木',
  '辰': '土',
  '巳': '火',
  '午': '火',
  '未': '土',
  '申': '金',
  '酉': '金',
  '戌': '土',
  '亥': '水',
};
const _relatives = ['兄弟', '子孙', '妻财', '官鬼', '父母'];
const _lineKinds = ['老阴', '少阳', '少阴', '老阳'];
const _najiaStems = {
  '乾': ('甲', '壬'),
  '兑': ('丁', '丁'),
  '离': ('己', '己'),
  '震': ('庚', '庚'),
  '巽': ('辛', '辛'),
  '坎': ('戊', '戊'),
  '艮': ('丙', '丙'),
  '坤': ('乙', '癸'),
};
const _stems = '甲乙丙丁戊己庚辛壬癸';
const _branches = '子丑寅卯辰巳午未申酉戌亥';
const _spirits = ['青龙', '朱雀', '勾陈', '螣蛇', '白虎', '玄武'];
const _spiritStarts = [0, 0, 1, 1, 2, 3, 4, 4, 5, 5];
final _dayCycle = [
  for (var index = 0; index < 60; index++)
    _stems[index % _stems.length] + _branches[index % _branches.length],
];

class LiuYaoLine {
  const LiuYaoLine._({
    required this.position,
    required this.value,
    required this.branch,
    required this.element,
    required this.relative,
    this.role,
  });

  factory LiuYaoLine._fromJson(Map<String, Object?> data) {
    final value = data['value'] as int;
    if (value < 6 || value > 9)
      throw const FormatException('Invalid published coin value.');
    return LiuYaoLine._(
      position: data['position'] as int,
      value: value,
      branch: data['branch'] as String,
      element: data['element'] as String,
      relative: data['relative'] as String,
      role: data['role'] as String?,
    );
  }

  final int position;
  final int value;
  final String branch;
  final String element;
  final String relative;
  final String? role;

  String get kind => _lineKinds[value - 6];
  bool get yang => value.isOdd;
  bool get moving => value == 6 || value == 9;

  Map<String, Object> toJson() => {
    'position': position,
    'value': value,
    'kind': kind,
    'yang': yang,
    'moving': moving,
    'branch': branch,
    'element': element,
    'relative': relative,
    if (role case final role?) 'role': role,
  };
}

class LiuYaoReading {
  LiuYaoReading._({
    required List<List<int>> tosses,
    required List<LiuYaoLine> lines,
    required this.primary,
    required this.changed,
    required this.palace,
    required this.shi,
    required this.ying,
    required List<int> moving,
    required this.direction,
    required this.interpretation,
  }) : tosses = List.unmodifiable(tosses.map(List<int>.unmodifiable)),
       lines = List.unmodifiable(lines),
       moving = List.unmodifiable(moving);

  final List<List<int>> tosses;
  final List<LiuYaoLine> lines;
  final Hexagram primary;
  final Hexagram changed;
  final Trigram palace;
  final int shi;
  final int ying;
  final List<int> moving;
  final ReadingDirection direction;
  final String interpretation;

  Map<String, Object> toJson() => {
    'tosses': tosses,
    'lines': lines.map((line) => line.toJson()).toList(),
    'primary': primary.toJson(),
    'changed': changed.toJson(),
    'palace': palace.name,
    'shi': shi,
    'ying': ying,
    'moving': moving,
    'direction': direction.name,
    'interpretation': interpretation,
  };
}

class JingfangLine {
  const JingfangLine._({
    required this.position,
    required this.stem,
    required this.branch,
    required this.element,
    required this.relative,
    required this.spirit,
    required this.isVoid,
    required this.monthOpposed,
  });

  factory JingfangLine._fromJson(Map<String, Object?> data) => JingfangLine._(
    position: data['position'] as int,
    stem: data['stem'] as String,
    branch: data['branch'] as String,
    element: data['element'] as String,
    relative: data['relative'] as String,
    spirit: data['spirit'] as String,
    isVoid: data['void'] as bool,
    monthOpposed: data['monthOpposed'] as bool,
  );

  final int position;
  final String stem;
  final String branch;
  final String element;
  final String relative;
  final String spirit;
  final bool isVoid;
  final bool monthOpposed;

  Map<String, Object> toJson() => {
    'position': position,
    'stem': stem,
    'branch': branch,
    'element': element,
    'relative': relative,
    'spirit': spirit,
    'void': isVoid,
    'monthOpposed': monthOpposed,
  };
}

class JingfangReading {
  JingfangReading._({
    required this.base,
    required this.calendar,
    required List<String> voidBranches,
    required List<JingfangLine> originalLines,
    required List<JingfangLine> changedLines,
    required List<JingfangLine> hiddenSpirits,
  }) : voidBranches = List.unmodifiable(voidBranches),
       originalLines = List.unmodifiable(originalLines),
       changedLines = List.unmodifiable(changedLines),
       hiddenSpirits = List.unmodifiable(hiddenSpirits);

  /// Reads the published chart for display without replaying its calculation.
  factory JingfangReading.fromJson(Map<String, Object?> data) {
    final tosses = (data['tosses'] as List)
        .map((toss) => (toss as List).cast<int>())
        .toList();
    final lines = (data['lines'] as List)
        .cast<Map<String, Object?>>()
        .map(LiuYaoLine._fromJson)
        .toList();
    List<JingfangLine> rows(String key) => (data[key] as List)
        .cast<Map<String, Object?>>()
        .map(JingfangLine._fromJson)
        .toList();
    final original = rows('originalLines');
    final changed = rows('changedLines');
    final hidden = rows('hiddenSpirits');
    final shi = data['shi'] as int;
    final ying = data['ying'] as int;
    final moving = (data['moving'] as List).cast<int>();
    bool isPosition(int index) => index >= 1 && index <= lineCount;
    if (tosses.length != lineCount ||
        lines.length != lineCount ||
        original.length != lineCount ||
        changed.length != lineCount ||
        !isPosition(shi) ||
        !isPosition(ying) ||
        !moving.every(isPosition) ||
        hidden.any((line) => !isPosition(line.position)) ||
        lines.indexed.any((entry) => entry.$2.position != entry.$1 + 1) ||
        original.indexed.any((entry) => entry.$2.position != entry.$1 + 1) ||
        changed.indexed.any((entry) => entry.$2.position != entry.$1 + 1)) {
      throw const FormatException('Invalid published Liu Yao chart lines.');
    }
    final calendar = data['calendar'] as Map<String, Object?>;
    return JingfangReading._(
      base: LiuYaoReading._(
        tosses: tosses,
        lines: lines,
        primary: Hexagram.fromJson(data['primary'] as Map<String, Object?>),
        changed: Hexagram.fromJson(data['changed'] as Map<String, Object?>),
        palace: trigrams.firstWhere(
          (trigram) => trigram.name == data['palace'],
        ),
        shi: shi,
        ying: ying,
        moving: moving,
        direction: ReadingDirection.values.byName(data['direction'] as String),
        interpretation: data['interpretation'] as String,
      ),
      calendar: CastCalendar(
        timezone: calendar['timezone'] as String,
        year: calendar['year'] as String,
        month: calendar['month'] as String,
        day: calendar['day'] as String,
      ),
      voidBranches: (data['voidBranches'] as List).cast<String>(),
      originalLines: original,
      changedLines: changed,
      hiddenSpirits: hidden,
    );
  }

  final LiuYaoReading base;
  final CastCalendar calendar;
  final List<String> voidBranches;
  final List<JingfangLine> originalLines;
  final List<JingfangLine> changedLines;
  final List<JingfangLine> hiddenSpirits;

  Map<String, Object> toJson() => {
    ...base.toJson(),
    'calendar': calendar.toJson(),
    'pattern': base.primary.pattern,
    'changedPattern': base.changed.pattern,
    'palaceElement': base.palace.element,
    'voidBranches': voidBranches,
    'hasChange': base.moving.isNotEmpty,
    'originalLines': originalLines.map((line) => line.toJson()).toList(),
    'changedLines': changedLines.map((line) => line.toJson()).toList(),
    'hiddenSpirits': [
      for (final hidden in hiddenSpirits)
        {
          ...hidden.toJson(),
          'flyingStem': originalLines[hidden.position - 1].stem,
          'flyingBranch': originalLines[hidden.position - 1].branch,
        },
    ],
  };
}

final _coinRandom = Random();

List<int> rollLiuYaoLine({double Function()? random}) {
  final next = random ?? _coinRandom.nextDouble;
  return List.generate(3, (_) => next() < 0.5 ? 2 : 3, growable: false);
}

int coinTossValue(List<int> toss) {
  if (toss.length != 3 || toss.any((coin) => coin != 2 && coin != 3)) {
    throw ArgumentError.value(
      toss,
      'toss',
      'Expected three coins valued 2 or 3.',
    );
  }
  return toss.reduce((first, second) => first + second);
}

String _relative(String palaceElement, String element) =>
    _relatives[elementRelation(palaceElement, element).index];

LiuYaoReading readLiuYao(List<List<int>> tosses) {
  if (tosses.length != lineCount) {
    throw ArgumentError.value(
      tosses.length,
      'tosses.length',
      'Expected six tosses.',
    );
  }
  final values = tosses.map(coinTossValue).toList(growable: false);
  var pattern = 0;
  var movingMask = 0;
  final moving = <int>[];
  for (var index = 0; index < values.length; index++) {
    final value = values[index];
    pattern |= (value % 2) << index;
    if (value == 6 || value == 9) {
      moving.add(index + 1);
      movingMask |= 1 << index;
    }
  }

  final (hexagram: primary, :palace, :shi) = lookupHexagramEntry(pattern);
  final changed = lookupHexagram(pattern ^ movingMask);
  final ying = (shi + 2) % lineCount + 1;
  final branches = [...primary.lower.inner, ...primary.upper.outer];
  final lines = List.generate(lineCount, (index) {
    final position = index + 1;
    final branch = branches[index];
    final element = _branchElements[branch]!;
    return LiuYaoLine._(
      position: position,
      value: values[index],
      branch: branch,
      element: element,
      relative: _relative(palace.element, element),
      role: position == shi
          ? '世'
          : position == ying
          ? '应'
          : null,
    );
  }, growable: false);
  final manyChanges = moving.length >= 3;
  final change = moving.isEmpty
      ? '本次六爻皆静，可以从当前条件和现有安排着手。'
      : '动爻转入${changed.name}，可留意「${changed.theme}」。';
  return LiuYaoReading._(
    tosses: tosses,
    lines: lines,
    primary: primary,
    changed: changed,
    palace: palace,
    shi: shi,
    ying: ying,
    moving: moving,
    direction: manyChanges ? ReadingDirection.verify : changed.direction,
    interpretation:
        '本卦${primary.name}提供的观察角度是「${primary.theme}」。'
        '$change${manyChanges ? '动爻较多，先核实哪一处变化会影响你的选择。' : ''}',
  );
}

JingfangReading readJingfang(List<List<int>> tosses, CastCalendar calendar) {
  final base = readLiuYao(tosses);
  final dayIndex = _dayCycle.indexOf(calendar.day);
  final monthIndex = calendar.month.length < 2
      ? -1
      : _branches.indexOf(calendar.month[1]);
  if (dayIndex < 0 || monthIndex < 0) {
    throw ArgumentError.value(
      calendar.toJson(),
      'calendar',
      'Invalid cast calendar.',
    );
  }
  final firstVoid = (dayIndex ~/ 10 * 10 + 10) % _branches.length;
  final voidBranches = [
    _branches[firstVoid],
    _branches[(firstVoid + 1) % _branches.length],
  ];
  final monthOpposition = _branches[(monthIndex + 6) % _branches.length];
  final spiritStart = _spiritStarts[dayIndex % _stems.length];

  List<JingfangLine> chartLines(Trigram lower, Trigram upper) {
    final branches = [...lower.inner, ...upper.outer];
    final innerStem = _najiaStems[lower.name]!.$1;
    final outerStem = _najiaStems[upper.name]!.$2;
    return List.generate(lineCount, (index) {
      final branch = branches[index];
      final element = _branchElements[branch]!;
      return JingfangLine._(
        position: index + 1,
        stem: index < 3 ? innerStem : outerStem,
        branch: branch,
        element: element,
        relative: _relative(base.palace.element, element),
        spirit: _spirits[(spiritStart + index) % lineCount],
        isVoid: voidBranches.contains(branch),
        monthOpposed: branch == monthOpposition,
      );
    }, growable: false);
  }

  final originalLines = chartLines(base.primary.lower, base.primary.upper);
  final visible = originalLines.map((line) => line.relative).toSet();
  final hidden = chartLines(
    base.palace,
    base.palace,
  ).where((line) => !visible.contains(line.relative));
  return JingfangReading._(
    base: base,
    calendar: calendar,
    voidBranches: voidBranches,
    originalLines: originalLines,
    changedLines: chartLines(base.changed.lower, base.changed.upper),
    hiddenSpirits: hidden.toList(growable: false),
  );
}
