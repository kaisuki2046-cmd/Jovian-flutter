import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:jovian_divination_model/iching.dart' show lineCount;

import 'cast_calendar.dart';
import 'liuyao.dart';
import 'meihua.dart';
import 'tarot.dart';

part 'guide_persistence.dart';
part 'guide_snapshot.dart';

const guideVersion = 'three-methods-v1';
const guideQuestionMaxLength = 8000;
const _coreGuideRules = {
  'tarot': 'rws-78-v1',
  'liuyao': 'liuyao-jingfang-najia-v1',
};
const _guideRules = {..._coreGuideRules, 'meihua': 'meihua-click-ms-sum-v1'};
const _automaticGuideRules = {..._coreGuideRules, 'meihua': 'three-number-v1'};
const _guideProfile = {
  'profile_id': guideVersion,
  'liuyao': 'liuyao-jingfang-najia-v1',
  'line_order': 'bottom_to_top',
  'coin_face_values': {'text': 2, 'back': 3},
  'calendar_timezone': 'Asia/Shanghai',
  'calendar_day_boundary': '23:00',
  'calendar_month_boundary': 'exact_jie_instant',
  'relative_reference': 'original_hexagram_palace_element',
  'hidden_spirits': 'missing_relations_from_pure_palace_same_line',
  'tarot_deck': 'rws-78-v1',
  'tarot_spread': 'situation-influence-trend-v1',
  'reversed_probability': '1/2',
  'meihua': 'meihua-click-ms-sum-v1',
  'meihua_nuclear_policy': 'qian_kun_use_changed_once',
  'question_parser_prompt': 'question-parser-v1',
  'reading_prompt': 'concise-reading-v1',
  'knowledge_version': 'local-knowledge-v1',
};

enum GuideStage { cast, draw, reading }

enum MeihuaInputSource {
  tarotClick('tarot-click-epoch-ms'),
  automaticNumbers('automatic-three-numbers');

  const MeihuaInputSource(this.id);
  final String id;
}

class GuideRitualError implements Exception {
  const GuideRitualError(this.status, this.code);

  final int status;
  final String code;

  @override
  String toString() => code;
}

final _eventId = RegExp(r'^[0-9a-f-]{36}$', caseSensitive: false);
final _sensitiveRequest = RegExp(
  '自杀|自残|轻生|想死|不想活|伤害自己|杀[人他她]|伤害他人|什么时候会死|何时会死|死期|会不会死|灾祸|'
  '诊断|是不是得了|患癌|癌症|开药|停药|怎么治|用药|加药|药量|化疗|手术|去医院|胸痛|股票|炒股|投资|基金|'
  '期货|炒币|加杠杆|能赚多少|稳赚|诉讼|判刑|起诉|会判多久|违法|犯法吗|胜诉',
);

String? validateGuideQuestion(String input) {
  final question = input.trim();
  if (question.isEmpty) return '请输入你的问题。';
  if (question.length > guideQuestionMaxLength) {
    return '请把问题控制在 $guideQuestionMaxLength 字以内。';
  }
  if (isSensitiveGuideText(question)) {
    return '这类问题请寻求相应专业支持。如果你或他人正面临紧急危险，请立即联系当地紧急服务。';
  }
  return null;
}

bool isSensitiveGuideText(String text) => _sensitiveRequest.hasMatch(text);

class GuideCoinEvent {
  const GuideCoinEvent({required this.actionId, required this.step});

  final String actionId;
  final int step;

  void validate() {
    if (step < 0 || step >= 6) {
      throw const GuideRitualError(400, 'invalid_toss');
    }
    if (!_eventId.hasMatch(actionId)) {
      throw const GuideRitualError(400, 'invalid_ritual_event');
    }
  }

  Map<String, Object> toJson() => {'actionId': actionId, 'step': step};
}

class GuideCardEvent {
  const GuideCardEvent({
    required this.actionId,
    required this.step,
    required this.slot,
    required this.epochMs,
    required this.monotonicMs,
    required this.clockSessionId,
  });

  final String actionId;
  final int step;
  final int slot;
  final String epochMs;
  final num monotonicMs;
  final String clockSessionId;

  void validate() {
    if (step < 0 || step >= TarotPosition.values.length) {
      throw const GuideRitualError(400, 'invalid_selection');
    }
    if (!_eventId.hasMatch(actionId) ||
        !_eventId.hasMatch(clockSessionId) ||
        !monotonicMs.isFinite ||
        monotonicMs < 0 ||
        !validMeihuaClickTime(epochMs)) {
      throw const GuideRitualError(400, 'invalid_ritual_event');
    }
  }

  Map<String, Object> toJson() => {
    'actionId': actionId,
    'step': step,
    'slot': slot,
    'epochMs': epochMs,
    'monotonicMs': monotonicMs == monotonicMs.toInt()
        ? monotonicMs.toInt()
        : monotonicMs,
    'clockSessionId': clockSessionId,
  };
}

class GuideChart {
  GuideChart._({
    required this.tarot,
    required this.liuyao,
    required this.meihua,
    required this.meihuaInputSource,
    required this.castStartedAt,
    required List<GuideCardEvent> cardEvents,
    required this.resolvedAt,
  }) : _publishedResults = null,
       chartHash = sha256
           .convert(
             utf8.encode(
               jsonEncode([
                 _guideProfile,
                 liuyao.base.tosses,
                 cardEvents.map((event) => event.toJson()).toList(),
                 _wireDate(castStartedAt),
                 tarot.toJson(),
                 _guideResults(liuyao, meihua, meihuaInputSource),
               ]),
             ),
           )
           .toString();

  GuideChart._fromService({
    required this.tarot,
    required this.liuyao,
    required this.meihua,
    required this.meihuaInputSource,
    required this.castStartedAt,
    required this.resolvedAt,
    required this.chartHash,
    required Map<String, Object> publishedResults,
  }) : _publishedResults = Map.unmodifiable(publishedResults);

  final TarotDraw tarot;
  final JingfangReading liuyao;
  final MeihuaReading meihua;
  final MeihuaInputSource meihuaInputSource;
  final DateTime castStartedAt;
  final DateTime resolvedAt;
  final String chartHash;
  final Map<String, Object>? _publishedResults;

  Map<String, Object> resultsToJson() =>
      _publishedResults ?? _guideResults(liuyao, meihua, meihuaInputSource);
}

Map<String, Object> _guideResults(
  JingfangReading liuyao,
  MeihuaReading meihua,
  MeihuaInputSource source,
) => {
  'liuyao': liuyao.toJson(),
  'meihua': meihua.toJson(),
  'meihuaInputSource': source.id,
};

String _wireDate(DateTime time) => DateTime.fromMillisecondsSinceEpoch(
  time.millisecondsSinceEpoch,
  isUtc: true,
).toIso8601String();

class GuideRitualSnapshot {
  const GuideRitualSnapshot._({
    required this.question,
    required this.focus,
    required this.automatic,
    required this.stage,
    required this.tosses,
    required this.slotCount,
    required this.selectedSlots,
    required this.cardEvents,
    required this.castStartedAt,
    required this.castResult,
    required this.chart,
    this.tarotCutIndex,
    Map<String, Object?>? publishedCast,
  }) : _publishedCast = publishedCast;

  final String question;
  final String focus;
  final bool automatic;
  final GuideStage stage;
  final List<List<int>> tosses;
  final int slotCount;
  final List<int> selectedSlots;
  final List<GuideCardEvent> cardEvents;
  final DateTime? castStartedAt;
  final JingfangReading? castResult;
  final GuideChart? chart;
  final int? tarotCutIndex;
  final Map<String, Object?>? _publishedCast;

  Map<String, String> get calculationRules =>
      automatic ? _automaticGuideRules : _guideRules;

  Map<String, Object> toChartSnapshotJson() => {
    'method': 'combined',
    'ruleVersion': guideVersion,
    'question': question,
    'focus': focus,
    'stage': stage.name,
    'calculationRules': calculationRules,
    'tosses': tosses,
    'slotCount': slotCount,
    'selectedSlots': selectedSlots,
    if (tarotCutIndex case final point?) 'tarotCutIndex': point,
    if (castStartedAt case final started?) 'castStartedAt': _wireDate(started),
    if (castResult case final cast?)
      'castResult': _publishedCast ?? cast.toJson(),
    if (automatic)
      'automatic': true
    else
      'cardEvents': cardEvents.map((event) => event.toJson()).toList(),
    if (chart case final chart?) ...{
      'draw': chart.tarot.toJson(),
      'results': chart.resultsToJson(),
      'chartHash': chart.chartHash,
      'resolvedAt': _wireDate(chart.resolvedAt),
    },
  };
}

class GuideRitual {
  factory GuideRitual({
    required String question,
    required String focus,
    bool automatic = false,
    DateTime? automaticStartedAt,
    DateTime Function()? now,
    double Function()? random,
  }) {
    final ritual = GuideRitual._(
      question.trim(),
      focus.trim(),
      automatic,
      now,
      random,
    );
    if (validateGuideQuestion(ritual.question) != null) {
      throw const GuideRitualError(400, 'invalid_question');
    }
    if (ritual.focus.isEmpty || ritual.focus.length > guideQuestionMaxLength) {
      throw const GuideRitualError(400, 'invalid_focus');
    }
    if (automatic) {
      ritual._castStartedAt = automaticStartedAt;
      for (var index = 0; index < 6; index++) {
        ritual._toss();
      }
      for (final slot in [0, 1, 2]) {
        ritual._select(slot);
      }
    }
    return ritual;
  }

  GuideRitual._(
    this.question,
    this.focus,
    this.automatic,
    DateTime Function()? now,
    double Function()? random,
  ) : _now = now ?? DateTime.now,
      _random = random ?? Random.secure().nextDouble;

  final String question;
  final String focus;
  final bool automatic;
  final DateTime Function() _now;
  final double Function() _random;
  final _actions =
      <String, ({String signature, GuideRitualSnapshot snapshot})>{};

  GuideStage _stage = GuideStage.cast;
  List<List<int>> _tosses = const [];
  List<GuideCardEvent> _cardEvents = const [];
  List<int> _selectedSlots = const [];
  DateTime? _castStartedAt;
  JingfangReading? _castResult;
  TarotPicking? _picking;
  GuideChart? _chart;

  GuideRitualSnapshot get snapshot => GuideRitualSnapshot._(
    question: question,
    focus: focus,
    automatic: automatic,
    stage: _stage,
    tosses: _tosses,
    slotCount: _picking?.slots.length ?? 0,
    selectedSlots: _selectedSlots,
    cardEvents: _cardEvents,
    castStartedAt: _castStartedAt,
    castResult: _castResult,
    chart: _chart,
  );

  GuideRitualSnapshot toss(GuideCoinEvent event) {
    event.validate();
    return _apply(event.actionId, event.toJson(), () {
      if (_stage != GuideStage.cast || event.step != _tosses.length) {
        throw const GuideRitualError(409, 'toss_out_of_order');
      }
      _toss();
    });
  }

  GuideRitualSnapshot pick(GuideCardEvent event) {
    event.validate();
    return _apply(event.actionId, event.toJson(), () {
      final picking = _picking;
      if (picking == null) {
        throw const GuideRitualError(409, 'selection_out_of_order');
      }
      if (event.slot < 0 || event.slot >= picking.slots.length) {
        throw const GuideRitualError(400, 'invalid_slot');
      }
      if (_stage != GuideStage.draw ||
          event.step != _selectedSlots.length ||
          _selectedSlots.contains(event.slot)) {
        throw const GuideRitualError(409, 'selection_out_of_order');
      }
      _select(event.slot, event);
    });
  }

  GuideRitualSnapshot _apply(
    String actionId,
    Map<String, Object> event,
    void Function() change,
  ) {
    final signature = jsonEncode(event);
    if (_actions[actionId] case final previous?) {
      if (previous.signature != signature) {
        throw const GuideRitualError(409, 'action_conflict');
      }
      return previous.snapshot;
    }
    change();
    final result = snapshot;
    _actions[actionId] = (signature: signature, snapshot: result);
    return result;
  }

  void _toss() {
    final started = _castStartedAt ?? _now();
    final tosses = List<List<int>>.unmodifiable([
      ..._tosses,
      List<int>.unmodifiable(rollLiuYaoLine(random: _random)),
    ]);
    if (tosses.length == 6) {
      _castResult = readJingfang(tosses, castCalendar(started));
      _picking = prepareFullTarotDeck(question, random: _random);
      _stage = GuideStage.draw;
    }
    _tosses = tosses;
    _castStartedAt = started;
  }

  void _select(int slot, [GuideCardEvent? event]) {
    final events = event == null
        ? _cardEvents
        : List<GuideCardEvent>.unmodifiable([..._cardEvents, event]);
    final selection = selectTarotSlot(
      _picking!,
      slot,
      now: _now,
      spread: TarotSpread.situationInfluenceTrend,
    );
    switch (selection) {
      case TarotPicking():
        _picking = selection;
        _selectedSlots = selection.selectedSlots;
      case CompletedTarotSelection():
        final meihua = automatic
            ? readMeihuaNumbers(
                List.generate(3, (_) => (_random() * 999).floor() + 1),
              )
            : readMeihuaClicks(events.map((event) => event.epochMs).toList());
        _chart = GuideChart._(
          tarot: selection.draw,
          liuyao: _castResult!,
          meihua: meihua,
          meihuaInputSource: automatic
              ? MeihuaInputSource.automaticNumbers
              : MeihuaInputSource.tarotClick,
          castStartedAt: _castStartedAt!,
          cardEvents: events,
          resolvedAt: _now(),
        );
        _selectedSlots = selection.selectedSlots;
        _stage = GuideStage.reading;
    }
    _cardEvents = events;
  }
}
