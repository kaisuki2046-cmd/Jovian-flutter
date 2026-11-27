part of 'guide_ritual.dart';

final _publishedChartHash = RegExp(r'^[a-f0-9]{64}$');

/// Reads the computed chart from the public HTTP snapshot.
GuideRitualSnapshot parseGuideSnapshot(Map<String, Object?> value) {
  const invalid = FormatException('Invalid reading snapshot.');
  if (value['method'] != 'combined' || value['ruleVersion'] != guideVersion)
    throw invalid;
  try {
    final stage = GuideStage.values.byName(value['stage'] as String);
    final automatic = value['automatic'] == true;
    final tarotFirst = (value['tarotFirst'] as bool?) ?? false;
    final choosing = stage == GuideStage.draw;
    final complete = stage == GuideStage.reading;
    final hasDeck = tarotFirst || stage != GuideStage.cast;
    final hasDraw = complete || (tarotFirst && !choosing);
    final hasCast = complete || (!tarotFirst && choosing);
    final slotCount = value['slotCount'] as int;
    final rawCut = value['tarotCutIndex'];
    if (value.containsKey('tarotCutIndex') &&
        (rawCut is! int ||
            !hasDeck ||
            rawCut < (tarotDeck.length * 0.45).ceil() ||
            rawCut > (tarotDeck.length * 0.55).floor())) {
      throw invalid;
    }
    final selected = List<int>.unmodifiable(
      (value['selectedSlots'] as List).cast<int>(),
    );
    final events = automatic
        ? const <GuideCardEvent>[]
        : List<GuideCardEvent>.unmodifiable(
            (value['cardEvents'] as List).map(_savedCardEvent),
          );
    final tosses = List<List<int>>.unmodifiable(
      (value['tosses'] as List).map((raw) {
        final coins = List<int>.unmodifiable((raw as List).cast<int>());
        coinTossValue(coins);
        return coins;
      }),
    );
    final rawTime = value['castStartedAt'] as String?;
    final started = rawTime == null ? null : DateTime.parse(rawTime);
    if (tosses.isEmpty != (started == null) ||
        slotCount != (hasDeck ? tarotDeck.length : 0) ||
        !_consistentSelections(automatic, events, selected) ||
        selected.toSet().length != selected.length ||
        selected.any((slot) => slot < 0 || slot >= slotCount) ||
        (automatic &&
            (tarotFirst || !complete || value.containsKey('cardEvents')))) {
      throw invalid;
    }
    if (!_sameJson(
      automatic ? _automaticGuideRules : _guideRules,
      value['calculationRules'],
    )) {
      throw invalid;
    }
    if (!complete &&
        ['results', 'chartHash', 'resolvedAt'].any(value.containsKey)) {
      throw invalid;
    }
    final selectionCount = TarotPosition.values.length;
    if (hasDraw
        ? selected.length != selectionCount
        : choosing
        ? selected.length >= selectionCount
        : selected.isNotEmpty) {
      throw invalid;
    }
    if (hasCast
        ? tosses.length != lineCount
        : choosing
        ? tosses.isNotEmpty
        : tosses.length >= lineCount) {
      throw invalid;
    }
    if (hasCast != value.containsKey('castResult') ||
        hasDraw != value.containsKey('draw')) {
      throw invalid;
    }
    TarotDraw? draw;
    if (hasDraw) {
      draw = TarotDraw.fromJson(_savedMap(value['draw']));
      if (draw.spread != TarotSpread.situationInfluenceTrend ||
          draw.cards.length != selectionCount ||
          !draw.cards.indexed.every(
            (entry) => entry.$2.slot == selected[entry.$1],
          )) {
        throw invalid;
      }
    }
    JingfangReading? cast;
    Map<String, Object?>? publishedCast;
    if (hasCast) {
      final castPayload = Map<String, Object?>.unmodifiable(
        _savedMap(value['castResult']),
      );
      publishedCast = castPayload;
      cast = JingfangReading.fromJson(castPayload);
      if (!_sameJson(cast.base.tosses, tosses)) throw invalid;
    }
    GuideChart? chart;
    if (complete) {
      final results = _savedMap(value['results']);
      final source = automatic
          ? MeihuaInputSource.automaticNumbers
          : MeihuaInputSource.tarotClick;
      final meihua = Map<String, Object?>.unmodifiable(
        _savedMap(results['meihua']),
      );
      final chartHash = value['chartHash'] as String;
      if (results['meihuaInputSource'] != source.id ||
          !_sameJson(publishedCast, results['liuyao']) ||
          !_publishedChartHash.hasMatch(chartHash) ||
          (!automatic &&
              !_sameJson(
                events.map((event) => event.epochMs).toList(),
                meihua['timestamps'],
              ))) {
        throw invalid;
      }
      chart = GuideChart._fromService(
        tarot: draw!,
        liuyao: cast!,
        meihua: MeihuaReading.fromJson(meihua),
        meihuaInputSource: source,
        castStartedAt: started!,
        resolvedAt: DateTime.parse(value['resolvedAt'] as String),
        chartHash: chartHash,
        publishedResults: {
          'liuyao': publishedCast!,
          'meihua': meihua,
          'meihuaInputSource': source.id,
        },
      );
    }
    return GuideRitualSnapshot._(
      question: value['question'] as String,
      focus: value['focus'] as String,
      automatic: automatic,
      tarotFirst: tarotFirst,
      stage: stage,
      tosses: tosses,
      slotCount: slotCount,
      selectedSlots: selected,
      cardEvents: events,
      castStartedAt: started,
      castResult: cast,
      chart: chart,
      earlyDraw: complete ? null : draw,
      tarotCutIndex: rawCut as int?,
      publishedCast: publishedCast,
    );
  } on TypeError {
    throw invalid;
  } on ArgumentError {
    throw invalid;
  } on StateError {
    throw invalid;
  }
}

bool _sameJson(Object? left, Object? right) {
  if (left is Map && right is Map) {
    return left.length == right.length &&
        left.keys.every(
          (key) => right.containsKey(key) && _sameJson(left[key], right[key]),
        );
  }
  if (left is List && right is List) {
    return left.length == right.length &&
        left.indexed.every((entry) => _sameJson(entry.$2, right[entry.$1]));
  }
  return left == right;
}
