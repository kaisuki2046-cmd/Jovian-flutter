import 'dart:math';

import 'package:jovian_divination_model/iching.dart';

import 'reading_guidance.dart';

part 'tarot_data.dart';

enum TarotPosition {
  situation('situation', '现状', '放在「现状」位，可以用它回看最近发生的一件具体的事。'),
  focus('focus', '需要留意', '放在「需要留意」位，可以问问自己这一点会怎样影响判断。'),
  nextStep('next-step', '下一步', '放在「下一步」位，可以从中选一个近期能尝试的动作。');

  const TarotPosition(this.id, this.label, this._hint);
  final String id;
  final String label;
  final String _hint;
}

enum TarotOrientation { upright, reversed }

enum TarotSpread {
  situationFocusNextStep('situation-focus-next-step'),
  situationInfluenceTrend('situation-influence-trend-v1');

  const TarotSpread(this.id);
  final String id;
}

class TarotCard {
  const TarotCard._(this.id, this.name);

  final String id;
  final String name;

  Map<String, String> toJson() => {'id': id, 'name': name};
}

class TarotFace {
  const TarotFace._(this.card, this.orientation);

  final TarotCard card;
  final TarotOrientation orientation;

  _TarotMeaning get _meaning {
    final (upright, reversed) = _tarotMeanings[card.id]!;
    return orientation == TarotOrientation.upright ? upright : reversed;
  }

  String get traditionalMeaning => _meaning.$1;
  String get plainMeaning => _meaning.$2;
  ReadingDirection get meaningDirection => _meaning.$3;

  Map<String, Object> toJson() => {
    'card': card.toJson(),
    'orientation': orientation.name,
  };
}

class TarotDrawnCard {
  const TarotDrawnCard._(this.face, this.position, this.slot);

  final TarotFace face;
  final TarotPosition position;
  final int slot;

  Map<String, Object> toJson() => {
    ...face.toJson(),
    'position': position.id,
    'slot': slot,
  };
}

class TarotDraw {
  TarotDraw._(this.spread, this.drawnAt, Iterable<TarotDrawnCard> cards)
    : cards = List.unmodifiable(cards);

  factory TarotDraw.fromJson(Map<String, Object?> value) {
    final spread = TarotSpread.values.firstWhere(
      (spread) => spread.id == value['spread'],
    );
    final cards = value['cards'] as List;
    if (value['deck'] != 'rider-waite-smith' ||
        value['deckVersion'] != 1 ||
        cards.length != TarotPosition.values.length) {
      throw const FormatException('Invalid saved Tarot drawing.');
    }
    return TarotDraw._(spread, DateTime.parse(value['drawnAt'] as String), [
      for (final (index, raw) in cards.indexed)
        _readDrawnCard(raw as Map, TarotPosition.values[index]),
    ]);
  }

  final TarotSpread spread;
  final DateTime drawnAt;
  final List<TarotDrawnCard> cards;

  Map<String, Object> toJson() => {
    'deck': 'rider-waite-smith',
    'deckVersion': 1,
    'spread': spread.id,
    'drawnAt': DateTime.fromMillisecondsSinceEpoch(
      drawnAt.millisecondsSinceEpoch,
      isUtc: true,
    ).toIso8601String(),
    'cards': cards.map((card) => card.toJson()).toList(),
  };
}

TarotDrawnCard _readDrawnCard(Map raw, TarotPosition position) {
  if (raw['position'] != position.id) {
    throw const FormatException('Invalid saved Tarot position.');
  }
  return TarotDrawnCard._(_readFace(raw), position, raw['slot'] as int);
}

TarotFace _readFace(Map raw) {
  final card = raw['card'] as Map;
  final known = _cardsById[card['id']];
  if (known == null || known.name != card['name']) {
    throw const FormatException('Unknown saved Tarot card.');
  }
  final orientation = TarotOrientation.values.byName(
    raw['orientation'] as String,
  );
  return TarotFace._(known, orientation);
}

sealed class TarotSelection {
  const TarotSelection();
}

class TarotPicking extends TarotSelection {
  const TarotPicking._(this.id, this.question, this.slots, this.selectedSlots);

  factory TarotPicking.fromJson(Map<String, Object?> value) {
    final slots = (value['slots'] as List)
        .map((slot) => _readFace(slot as Map))
        .toList();
    final selected = (value['selectedSlots'] as List).cast<int>();
    if (slots.map((slot) => slot.card.id).toSet().length != slots.length ||
        selected.length > TarotPosition.values.length ||
        selected.toSet().length != selected.length ||
        selected.any((slot) => slot < 0 || slot >= slots.length)) {
      throw const FormatException('Invalid saved Tarot selection.');
    }
    return TarotPicking._(
      value['id'] as int,
      value['question'] as String,
      List.unmodifiable(slots),
      List.unmodifiable(selected),
    );
  }

  final int id;
  final String question;
  final List<TarotFace> slots;
  final List<int> selectedSlots;

  Map<String, Object> toJson() => {
    'id': id,
    'kind': 'tarotPicking',
    'question': question,
    'slots': slots.map((face) => face.toJson()).toList(),
    'selectedSlots': selectedSlots,
  };
}

class CompletedTarotSelection extends TarotSelection {
  const CompletedTarotSelection._(this.draw, this.selectedSlots);

  final TarotDraw draw;
  final List<int> selectedSlots;

  Map<String, Object> toJson() => {
    'kind': 'completed',
    'draw': draw.toJson(),
    'selectedSlots': selectedSlots,
  };
}

typedef _TarotMeaning = (
  String traditional,
  String plain,
  ReadingDirection direction,
);

typedef TarotInterpretation = ({
  TarotPosition position,
  String cardName,
  TarotOrientation orientation,
  String traditional,
  String explanation,
});

class TarotReading {
  TarotReading._(
    this.summary,
    this.nextStep,
    this.direction,
    Iterable<TarotInterpretation> readings,
  ) : readings = List.unmodifiable(readings);

  final String summary;
  final String nextStep;
  final ReadingDirection direction;
  final List<TarotInterpretation> readings;

  Map<String, Object> toJson() => {
    'overview': {
      'summary': summary,
      'nextStep': nextStep,
      'direction': direction.name,
    },
    'readings': [
      for (final item in readings)
        {
          'position': item.position.id,
          'cardName': item.cardName,
          'orientation': item.orientation.name,
          'traditional': item.traditional,
          'explanation': item.explanation,
        },
    ],
  };
}

const tarotCutPoints = [19, 39, 59];
const _slotCount = 9;
final _defaultRandom = Random();
final _cardsById = {for (final card in tarotDeck) card.id: card};

TarotFace _orient(TarotCard card, double Function() random) => TarotFace._(
  card,
  random() < 0.5 ? TarotOrientation.upright : TarotOrientation.reversed,
);

TarotPicking openTarotSelection({
  required int id,
  required String question,
  double Function()? random,
}) {
  final next = random ?? _defaultRandom.nextDouble;
  final remaining = [...tarotDeck];
  final slots = List.generate(_slotCount, (_) {
    final index = (next() * remaining.length).floor();
    return _orient(remaining.removeAt(index), next);
  });
  return TarotPicking._(id, question, List.unmodifiable(slots), const []);
}

List<String> shuffleTarotDeck({double Function()? random}) {
  final next = random ?? _defaultRandom.nextDouble;
  final deck = [...tarotDeck];
  for (var index = deck.length - 1; index > 0; index--) {
    final other = (next() * (index + 1)).floor();
    final card = deck[index];
    deck[index] = deck[other];
    deck[other] = card;
  }
  return deck.map((card) => card.id).toList(growable: false);
}

TarotPicking cutTarotDeck(
  List<String> deck,
  int cut,
  String question, {
  double Function()? random,
}) {
  final next = random ?? _defaultRandom.nextDouble;
  final slots = [...deck.skip(cut), ...deck.take(cut)].take(_slotCount).map((
    id,
  ) {
    final card = _cardsById[id];
    if (card == null)
      throw ArgumentError.value(id, 'deck', 'Unknown tarot card.');
    return _orient(card, next);
  });
  return TarotPicking._(0, question, List.unmodifiable(slots), const []);
}

TarotPicking prepareFullTarotDeck(
  String question, {
  double Function()? random,
}) {
  final next = random ?? _defaultRandom.nextDouble;
  final slots = shuffleTarotDeck(
    random: next,
  ).map((id) => _orient(_cardsById[id]!, next));
  return TarotPicking._(0, question, List.unmodifiable(slots), const []);
}

TarotSelection selectTarotSlot(
  TarotPicking task,
  int slot, {
  DateTime Function()? now,
  TarotSpread spread = TarotSpread.situationFocusNextStep,
}) {
  final positions = TarotPosition.values;
  if (slot < 0 ||
      slot >= task.slots.length ||
      task.selectedSlots.contains(slot) ||
      task.selectedSlots.length >= positions.length) {
    return task;
  }
  final selected = List<int>.unmodifiable([...task.selectedSlots, slot]);
  if (selected.length < positions.length) {
    return TarotPicking._(task.id, task.question, task.slots, selected);
  }
  final draw = TarotDraw._(spread, (now ?? DateTime.now)(), [
    for (final position in positions)
      TarotDrawnCard._(
        task.slots[selected[position.index]],
        position,
        selected[position.index],
      ),
  ]);
  return CompletedTarotSelection._(draw, selected);
}

TarotReading readTarot(String question, TarotDraw draw) {
  final [situation, focus, action] = [
    for (final card in draw.cards) card.face._meaning.$3,
  ];
  final firstStep = focus == ReadingDirection.advance ? action : focus;
  final context = isJobChangeQuestion(question) ? '就要不要换工作而言，' : '';
  final opening = situation == focus && focus == action
      ? '三张牌给出的方向一致。'
      : _situationSummary[situation.index];
  return TarotReading._(
    context + opening + _pairedSummary[focus.index][action.index],
    getReadingAction(question, firstStep),
    firstStep,
    draw.cards.map((entry) {
      final (traditional, plain, _) = entry.face._meaning;
      return (
        position: entry.position,
        cardName: entry.face.card.name,
        orientation: entry.face.orientation,
        traditional: traditional,
        explanation: plain + entry.position._hint,
      );
    }),
  );
}

const _situationSummary = [
  '现状里已经有想试一试的动力。',
  '眼下还有会影响判断的信息需要弄清。',
  '眼下的做法或负担已经影响了进展。',
];

const _pairedSummary = [
  [
    '可以把行动放在首位，选一个做完就能得到反馈的小尝试，再决定投入多少。',
    '可以保留行动的打算，先把它会遇到的现实条件问清楚。拿到答案后，才好判断值得推进多少。',
    '想前进的意愿可以用来改善眼下的做法。先处理最拖慢进展的一环，再看调整后还有多少空间。',
  ],
  [
    '这组牌支持尝试，前提是先核实最可能改变你判断的条件。条件成立后，就可以试一个可回头的小动作。',
    '重点是把决定建立在能核实的信息上。先确定哪个答案会改变你的选择，再去找这一条证据。',
    '先找出问题的具体来源，再调整做法。把调整后的结果与之前对照，才能知道改动有没有用。',
  ],
  [
    '推进的机会取决于能否先卸下一项旧负担。腾出时间或精力后，再试一个成本有限的选项。',
    '先把手头最消耗你的部分稳住，再核对选项。等压力缓下来，你会更容易看清哪条信息真的重要。',
    '适合先把资源、节奏或分工重新安排好。等影响最大的阻力减轻，再决定下一步投入多少。',
  ],
];
