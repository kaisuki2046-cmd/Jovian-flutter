part of 'guide_ritual.dart';

/// Reads the public HTTP snapshot. Hidden cards are never needed by the client.
GuideRitualSnapshot parseGuideSnapshot(Map<String, Object?> value) {
  const invalid = FormatException('Invalid reading snapshot.');
  if (value['method'] != 'combined' || value['ruleVersion'] != guideVersion)
    throw invalid;
  try {
    final stage = GuideStage.values.byName(value['stage'] as String);
    final automatic = value['automatic'] == true;
    final slotCount = value['slotCount'] as int;
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
        !_consistentSelections(automatic, events, selected) ||
        selected.toSet().length != selected.length ||
        selected.any((slot) => slot < 0 || slot >= slotCount) ||
        (automatic &&
            (stage != GuideStage.reading || value.containsKey('cardEvents')))) {
      throw invalid;
    }
    JingfangReading? cast;
    GuideChart? chart;
    if (stage == GuideStage.cast) {
      if (tosses.length >= lineCount || slotCount != 0 || selected.isNotEmpty)
        throw invalid;
    } else {
      if (tosses.length != lineCount ||
          slotCount != tarotDeck.length ||
          started == null)
        throw invalid;
      cast = readJingfang(tosses, castCalendar(started));
      if (stage == GuideStage.reading) {
        if (selected.length != TarotPosition.values.length) throw invalid;
        final draw = TarotDraw.fromJson(_savedMap(value['draw']));
        if (draw.spread != TarotSpread.situationInfluenceTrend ||
            !draw.cards.indexed.every(
              (entry) => entry.$2.slot == selected[entry.$1],
            )) {
          throw invalid;
        }
        final results = _savedMap(value['results']);
        final source = automatic
            ? MeihuaInputSource.automaticNumbers
            : MeihuaInputSource.tarotClick;
        final meihua = automatic
            ? readMeihuaNumbers(
                (_savedMap(results['meihua'])['inputs'] as List).cast<int>(),
              )
            : readMeihuaClicks(events.map((event) => event.epochMs).toList());
        chart = GuideChart._(
          tarot: draw,
          liuyao: cast,
          meihua: meihua,
          meihuaInputSource: source,
          castStartedAt: started,
          cardEvents: events,
          resolvedAt: DateTime.parse(value['resolvedAt'] as String),
        );
      } else if (selected.length >= TarotPosition.values.length ||
          value['draw'] != null) {
        throw invalid;
      }
    }
    final snapshot = GuideRitualSnapshot._(
      question: value['question'] as String,
      focus: value['focus'] as String,
      automatic: automatic,
      stage: stage,
      tosses: tosses,
      slotCount: slotCount,
      selectedSlots: selected,
      cardEvents: events,
      castStartedAt: started,
      castResult: cast,
      chart: chart,
    );
    final computed = snapshot.toChartSnapshotJson();
    for (final field in [
      'calculationRules',
      'castResult',
      'results',
      'chartHash',
    ]) {
      if (!_sameJson(computed[field], value[field])) throw invalid;
    }
    return snapshot;
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
