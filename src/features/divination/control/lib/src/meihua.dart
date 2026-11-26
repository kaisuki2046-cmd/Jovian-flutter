import 'package:jovian_divination_model/iching.dart';

const _relationLabels = ['体用比和', '体生用', '体克用', '用克体', '用生体'];
const _relationThemes = [
  '自身与外部条件的节奏接近，可以从容易达成共识的地方开始。',
  '推动事情需要投入自身的时间、精力或资源，先算清能承担多少。',
  '自身对事情有一定主动空间，可以从可控的一步开始。',
  '外部条件可能限制行动，先核实最容易卡住的一项要求。',
  '可以留意外部支持，把已经明确的帮助转化为实际安排。',
];

class MeihuaReading {
  MeihuaReading._({
    required List<int> inputs,
    required this.primary,
    required this.nuclear,
    required this.changed,
    required this.moving,
    required this.body,
    required this.use,
    required this.changedUse,
    required this.relation,
    required this.changedRelation,
    required this.direction,
    required this.interpretation,
  }) : inputs = List.unmodifiable(inputs);

  /// Decodes the original service's chart facts for display.
  factory MeihuaReading.fromJson(Map<String, Object?> data) {
    final inputs = (data['inputs'] as List).cast<int>();
    final moving = data['moving'] as int;
    if (!validMeihuaNumbers(inputs) || moving < 1 || moving > lineCount) {
      throw const FormatException('Invalid published Meihua inputs.');
    }
    Hexagram hexagram(String key) =>
        Hexagram.fromJson(data[key] as Map<String, Object?>);
    Trigram trigram(String key) =>
        Trigram.fromJson(data[key] as Map<String, Object?>);
    return MeihuaReading._(
      inputs: inputs,
      primary: hexagram('primary'),
      nuclear: hexagram('nuclear'),
      changed: hexagram('changed'),
      moving: moving,
      body: trigram('body'),
      use: trigram('use'),
      changedUse: trigram('changedUse'),
      relation: data['relation'] as String,
      changedRelation: data['changedRelation'] as String,
      direction: ReadingDirection.values.byName(data['direction'] as String),
      interpretation: data['interpretation'] as String,
    );
  }

  final List<int> inputs;
  final Hexagram primary;
  final Hexagram nuclear;
  final Hexagram changed;
  final int moving;
  final Trigram body;
  final Trigram use;
  final Trigram changedUse;
  final String relation;
  final String changedRelation;
  final ReadingDirection direction;
  final String interpretation;

  Map<String, Object> toJson() => {
    'inputs': inputs,
    'primary': primary.toJson(),
    'nuclear': nuclear.toJson(),
    'changed': changed.toJson(),
    'moving': moving,
    'body': body.toJson(),
    'use': use.toJson(),
    'changedUse': changedUse.toJson(),
    'relation': relation,
    'changedRelation': changedRelation,
    'direction': direction.name,
    'interpretation': interpretation,
  };
}

class MeihuaClickReading extends MeihuaReading {
  MeihuaClickReading._(
    MeihuaReading reading,
    List<String> timestamps,
    this.upperNumber,
    this.lowerNumber,
  ) : timestamps = List.unmodifiable(timestamps),
      mathematicalNuclear = lookupHexagram(
        _nuclearPatternOf(reading.primary.pattern),
      ),
      nuclearSource = _usesChangedNuclear(reading.primary.pattern)
          ? 'changed'
          : 'base',
      super._(
        inputs: reading.inputs,
        primary: reading.primary,
        nuclear: reading.nuclear,
        changed: reading.changed,
        moving: reading.moving,
        body: reading.body,
        use: reading.use,
        changedUse: reading.changedUse,
        relation: reading.relation,
        changedRelation: reading.changedRelation,
        direction: reading.direction,
        interpretation: reading.interpretation,
      );

  final List<String> timestamps;
  final int upperNumber;
  final int lowerNumber;
  final Hexagram mathematicalNuclear;
  final String nuclearSource;

  @override
  Map<String, Object> toJson() => {
    ...super.toJson(),
    'timestamps': timestamps,
    'upperNumber': upperNumber,
    'lowerNumber': lowerNumber,
    'mathematicalNuclear': mathematicalNuclear.toJson(),
    'nuclearSource': nuclearSource,
    'bodySide': moving <= 3 ? 'upper' : 'lower',
    'useSide': moving <= 3 ? 'lower' : 'upper',
    'nuclearLowerRelation':
        _relationLabels[elementRelation(
          body.element,
          nuclear.lower.element,
        ).index],
    'nuclearUpperRelation':
        _relationLabels[elementRelation(
          body.element,
          nuclear.upper.element,
        ).index],
  };
}

MeihuaReading readMeihua(List<int> inputs) {
  if (inputs.length != 3 || inputs.any((value) => value < 6 || value > 9)) {
    throw ArgumentError.value(
      inputs,
      'inputs',
      'Expected three Liu Yao line values from 6 to 9.',
    );
  }
  return readMeihuaNumbers(inputs);
}

bool validMeihuaNumbers(List<int> inputs) =>
    inputs.length == 3 && inputs.every((value) => value >= 1 && value <= 999);

MeihuaReading readMeihuaNumbers(List<int> inputs) {
  if (!validMeihuaNumbers(inputs)) {
    throw ArgumentError.value(
      inputs,
      'inputs',
      'Expected three integers from 1 to 999.',
    );
  }
  final [first, second, third] = inputs;
  return _compose(
    inputs,
    (first - 1) % 8 + 1,
    (second - 1) % 8 + 1,
    (first + second + third - 1) % lineCount + 1,
  );
}

final _clickTimestamp = RegExp(r'^[1-9][0-9]{0,15}$');

bool validMeihuaClickTime(String value) => _clickTimestamp.hasMatch(value);

MeihuaClickReading readMeihuaClicks(List<String> timestamps) {
  if (timestamps.length != 3 ||
      timestamps.any((value) => !validMeihuaClickTime(value))) {
    throw ArgumentError.value(
      timestamps,
      'timestamps',
      'Expected three positive millisecond strings of up to 16 digits.',
    );
  }
  final [first, second, third] = timestamps
      .map(BigInt.parse)
      .toList(growable: false);
  final upper = _clickRemainder(first, 8);
  final lower = _clickRemainder(second, 8);
  final moving = _clickRemainder(first + second + third, lineCount);
  return MeihuaClickReading._(
    _compose([upper, lower, moving], upper, lower, moving),
    timestamps,
    upper,
    lower,
  );
}

int _clickRemainder(BigInt value, int divisor) {
  final base = BigInt.from(divisor);
  return ((value - BigInt.one) % base).toInt() + 1;
}

bool _usesChangedNuclear(int pattern) => pattern == 0 || pattern == 63;

int _nuclearPatternOf(int pattern) =>
    ((pattern >> 1) & trigramMask) | (((pattern >> 2) & trigramMask) << 3);

MeihuaReading _compose(
  List<int> inputs,
  int upperNumber,
  int lowerNumber,
  int moving,
) {
  final upper = trigrams[upperNumber - 1];
  final lower = trigrams[lowerNumber - 1];
  final pattern = lower.pattern | (upper.pattern << 3);
  final changedPattern = pattern ^ (1 << (moving - 1));
  final primary = lookupHexagram(pattern);
  final changed = lookupHexagram(changedPattern);
  final nuclearPattern = _nuclearPatternOf(
    _usesChangedNuclear(pattern) ? changedPattern : pattern,
  );

  final lowerMoves = moving <= 3;
  final body = lowerMoves ? upper : lower;
  final use = lowerMoves ? lower : upper;
  final changedUse = lowerMoves ? changed.lower : changed.upper;
  final originalRelation = elementRelation(body.element, use.element);
  final resultingRelation = elementRelation(body.element, changedUse.element);
  final relation = _relationLabels[originalRelation.index];
  final changedRelation = _relationLabels[resultingRelation.index];
  final relations = [originalRelation, resultingRelation];
  final direction = relations.contains(ElementRelation.controlled)
      ? ReadingDirection.verify
      : relations.contains(ElementRelation.gives)
      ? ReadingDirection.adjust
      : ReadingDirection.advance;
  final theme = _relationThemes[originalRelation.index];
  final interpretation = originalRelation == resultingRelation
      ? theme
      : '${theme}变卦转为$changedRelation，后续可参考「${changed.theme}」。';
  return MeihuaReading._(
    inputs: inputs,
    primary: primary,
    nuclear: lookupHexagram(nuclearPattern),
    changed: changed,
    moving: moving,
    body: body,
    use: use,
    changedUse: changedUse,
    relation: relation,
    changedRelation: changedRelation,
    direction: direction,
    interpretation: interpretation,
  );
}
