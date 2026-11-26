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
    final slotCount = value['slotCount'] as int;
    final rawCut = value['tarotCutIndex'];
    if (value.containsKey('tarotCutIndex') &&
        (rawCut is! int ||
            stage == GuideStage.cast ||
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
        !_consistentSelections(automatic, events, selected) ||
        selected.toSet().length != selected.length ||
        selected.any((slot) => slot < 0 || slot >= slotCount) ||
        (automatic &&
            (stage != GuideStage.reading || value.containsKey('cardEvents')))) {
      throw invalid;
    }
    if (!_sameJson(
      automatic ? _automaticGuideRules : _guideRules,
      value['calculationRules'],
    )) {
      throw invalid;
    }
    if (stage != GuideStage.reading &&
        ['draw', 'results', 'chartHash', 'resolvedAt'].any(value.containsKey)) {
      throw invalid;
    }
    JingfangReading? cast;
    Map<String, Object?>? publishedCast;
    GuideChart? chart;
    if (stage == GuideStage.cast) {
      if (tosses.length >= lineCount ||
          slotCount != 0 ||
          selected.isNotEmpty ||
          value.containsKey('castResult')) {
        throw invalid;
      }
    } else {
      if (tosses.length != lineCount ||
          slotCount != tarotDeck.length ||
          started == null)
        throw invalid;
      final castPayload = Map<String, Object?>.unmodifiable(
        _savedMap(value['castResult']),
      );
      publishedCast = castPayload;
      cast = JingfangReading.fromJson(castPayload);
      if (!_sameJson(cast.base.tosses, tosses)) throw invalid;
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
        final meihua = Map<String, Object?>.unmodifiable(
          _savedMap(results['meihua']),
        );
        final chartHash = value['chartHash'] as String;
        if (results['meihuaInputSource'] != source.id ||
            !_sameJson(castPayload, results['liuyao']) ||
            !_publishedChartHash.hasMatch(chartHash) ||
            (!automatic &&
                !_sameJson(
                  events.map((event) => event.epochMs).toList(),
                  meihua['timestamps'],
                ))) {
          throw invalid;
        }
        chart = GuideChart._fromService(
          tarot: draw,
          liuyao: cast,
          meihua: MeihuaReading.fromJson(meihua),
          meihuaInputSource: source,
          castStartedAt: started,
          resolvedAt: DateTime.parse(value['resolvedAt'] as String),
          chartHash: chartHash,
          publishedResults: {
            'liuyao': castPayload,
            'meihua': meihua,
            'meihuaInputSource': source.id,
          },
        );
      } else if (selected.length >= TarotPosition.values.length) {
        throw invalid;
      }
    }
    return GuideRitualSnapshot._(
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
