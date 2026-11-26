part of 'guide_ritual.dart';

/// The fields owned by the ritual in the existing SQLite payload.
/// Callers retain report, evidence, action replay, and other service fields.
extension GuideRitualPersistence on GuideRitual {
  Map<String, Object> toPersistedRitualFields() =>
      snapshot.toChartSnapshotJson()
        ..remove('slotCount')
        ..remove('selectedSlots')
        ..addAll({
          'profile': _guideProfile,
          if (_picking case final picking?)
            'picking': {...picking.toJson(), 'selectedSlots': _selectedSlots},
          if (automatic) 'cardEvents': const [],
        });
}

/// Restores the original shuffled deck and draw without consuming randomness.
/// Request replays are restored by the server from their saved wire snapshots.
GuideRitual restoreGuideRitual(
  Map<String, Object?> payload, {
  DateTime Function()? now,
  double Function()? random,
}) {
  const invalid = FormatException('Invalid saved guide state.');
  if (payload['method'] != 'combined' ||
      payload['ruleVersion'] != guideVersion) {
    throw invalid;
  }
  try {
    final ritual = GuideRitual._(
      payload['question'] as String,
      payload['focus'] as String,
      payload['automatic'] == true,
      now,
      random,
    );
    ritual._stage = GuideStage.values.byName(payload['stage'] as String);
    ritual._tosses = List.unmodifiable(
      (payload['tosses'] as List).map((raw) {
        final coins = List<int>.unmodifiable((raw as List).cast<int>());
        coinTossValue(coins);
        return coins;
      }),
    );
    final rawStart = payload['castStartedAt'] as String?;
    ritual._castStartedAt = rawStart == null ? null : DateTime.parse(rawStart);
    if ((ritual._castStartedAt == null) != ritual._tosses.isEmpty)
      throw invalid;

    if (ritual._stage == GuideStage.cast) {
      if (ritual._tosses.length >= 6 || ritual.automatic) throw invalid;
      return ritual;
    }
    final picking = TarotPicking.fromJson(_savedMap(payload['picking']));
    if (picking.slots.length != tarotDeck.length ||
        picking.question != ritual.question) {
      throw invalid;
    }
    ritual._picking = picking;
    ritual._selectedSlots = picking.selectedSlots;
    ritual._cardEvents = List.unmodifiable(
      (payload['cardEvents'] as List).map(_savedCardEvent),
    );
    if (!_consistentSelections(
      ritual.automatic,
      ritual._cardEvents,
      ritual._selectedSlots,
    )) {
      throw invalid;
    }
    final savedCalendar = _savedMap(
      _savedMap(payload['castResult'])['calendar'],
    );
    final liuyao = readJingfang(
      ritual._tosses,
      CastCalendar(
        timezone: savedCalendar['timezone'] as String,
        year: savedCalendar['year'] as String,
        month: savedCalendar['month'] as String,
        day: savedCalendar['day'] as String,
      ),
    );
    ritual._castResult = liuyao;
    if (ritual._stage == GuideStage.draw) {
      if (ritual.automatic ||
          ritual._selectedSlots.length >= TarotPosition.values.length) {
        throw invalid;
      }
      return ritual;
    }
    final draw = TarotDraw.fromJson(_savedMap(payload['draw']));
    if (draw.spread != TarotSpread.situationInfluenceTrend ||
        draw.cards.length != ritual._selectedSlots.length)
      throw invalid;
    for (final (index, card) in draw.cards.indexed) {
      final slot = ritual._selectedSlots[index];
      final face = picking.slots[slot];
      if (card.slot != slot ||
          card.face.card.id != face.card.id ||
          card.face.orientation != face.orientation)
        throw invalid;
    }
    final results = _savedMap(payload['results']);
    final source = ritual.automatic
        ? MeihuaInputSource.automaticNumbers
        : MeihuaInputSource.tarotClick;
    if (results['meihuaInputSource'] != source.id) throw invalid;
    final meihua = ritual.automatic
        ? readMeihuaNumbers(
            (_savedMap(results['meihua'])['inputs'] as List).cast<int>(),
          )
        : readMeihuaClicks(
            ritual._cardEvents.map((event) => event.epochMs).toList(),
          );
    final chart = GuideChart._(
      tarot: draw,
      liuyao: liuyao,
      meihua: meihua,
      meihuaInputSource: source,
      castStartedAt: ritual._castStartedAt!,
      cardEvents: ritual._cardEvents,
      resolvedAt: DateTime.parse(payload['resolvedAt'] as String),
    );
    if (chart.chartHash != payload['chartHash']) throw invalid;
    ritual._chart = chart;
    return ritual;
  } on TypeError {
    throw invalid;
  } on ArgumentError {
    throw invalid;
  } on StateError {
    throw invalid;
  }
}

Map<String, Object?> _savedMap(Object? value) =>
    (value as Map).cast<String, Object?>();

GuideCardEvent _savedCardEvent(Object? value) {
  final data = _savedMap(value);
  return GuideCardEvent(
    actionId: data['actionId'] as String,
    step: data['step'] as int,
    slot: data['slot'] as int,
    epochMs: data['epochMs'] as String,
    monotonicMs: data['monotonicMs'] as num,
    clockSessionId: data['clockSessionId'] as String,
  );
}

bool _consistentSelections(
  bool automatic,
  List<GuideCardEvent> events,
  List<int> selected,
) {
  if (automatic) return events.isEmpty && selected.join(',') == '0,1,2';
  if (events.length != selected.length) return false;
  return events.indexed.every((entry) {
    final (index, event) = entry;
    return event.step == index &&
        event.slot == selected[index] &&
        validMeihuaClickTime(event.epochMs) &&
        event.monotonicMs.isFinite &&
        event.monotonicMs >= 0 &&
        _eventId.hasMatch(event.actionId) &&
        _eventId.hasMatch(event.clockSessionId);
  });
}
