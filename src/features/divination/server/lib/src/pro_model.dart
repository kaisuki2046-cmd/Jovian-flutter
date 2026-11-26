import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:jovian_divination/jovian_divination.dart';

import 'structured_model.dart';

part 'pro_prompt.dart';

const proModel = 'deepseek-v4-pro';
final proPromptVersion = sha256
    .convert(utf8.encode(_proInstructions))
    .toString();

Map<String, Object> _hexagram(Hexagram hexagram) => {
  'name': hexagram.name,
  'upper': hexagram.upper.name,
  'lower': hexagram.lower.name,
  'yangLines': hexagram.yangLines,
};

Map<String, String> _trigram(Trigram trigram) => {
  'name': trigram.name,
  'element': trigram.element,
};

Map<String, Object> rawChartInput(
  GuideRitualSnapshot task, {
  String? previousQuestion,
}) {
  final chart = task.chart;
  if (chart == null) throw const GuideRitualError(409, 'comparison_not_ready');
  final liuyao = chart.liuyao;
  final base = liuyao.base;
  final meihua = chart.meihua;
  final draw = chart.tarot;
  final click = meihua is MeihuaClickReading ? meihua : null;
  final clickFields = click?.toJson();
  return {
    'question': task.question,
    if (previousQuestion != null) 'previousQuestion': previousQuestion,
    'calculationRules': task.calculationRules,
    'liuyao': {
      'castStartedAt': DateTime.fromMillisecondsSinceEpoch(
        chart.castStartedAt.millisecondsSinceEpoch,
        isUtc: true,
      ).toIso8601String(),
      'calendar': liuyao.calendar.toJson(),
      'tosses': base.tosses,
      'palace': base.palace.name,
      'palaceElement': base.palace.element,
      'shi': base.shi,
      'ying': base.ying,
      'moving': base.moving,
      'voidBranches': liuyao.voidBranches,
      'primary': _hexagram(base.primary),
      'changed': _hexagram(base.changed),
      'originalLines': [
        for (final (index, line) in liuyao.originalLines.indexed)
          {
            ...line.toJson(),
            'value': base.lines[index].value,
            'yang': base.lines[index].yang,
          },
      ],
      'changedLines': liuyao.changedLines.map((line) => line.toJson()).toList(),
      'hiddenSpirits': [
        for (final hidden in liuyao.hiddenSpirits)
          {
            ...hidden.toJson(),
            'flyingStem': liuyao.originalLines[hidden.position - 1].stem,
            'flyingBranch': liuyao.originalLines[hidden.position - 1].branch,
          },
      ],
    },
    'meihua': {
      if (click != null) ...{
        'timestamps': click.timestamps,
        'upperNumber': click.upperNumber,
        'lowerNumber': click.lowerNumber,
      } else ...{
        'inputs': meihua.inputs,
        'inputSource': chart.meihuaInputSource.id,
      },
      'moving': meihua.moving,
      'primary': _hexagram(meihua.primary),
      'changed': _hexagram(meihua.changed),
      'nuclear': _hexagram(meihua.nuclear),
      if (click != null) ...{
        'mathematicalNuclear': _hexagram(click.mathematicalNuclear),
        'nuclearSource': click.nuclearSource,
        'bodySide': clickFields!['bodySide']!,
        'useSide': clickFields['useSide']!,
      },
      'body': _trigram(meihua.body),
      'use': _trigram(meihua.use),
      'changedUse': _trigram(meihua.changedUse),
      'relation': meihua.relation,
      'changedRelation': meihua.changedRelation,
      if (clickFields != null) ...{
        'nuclearLowerRelation': clickFields['nuclearLowerRelation']!,
        'nuclearUpperRelation': clickFields['nuclearUpperRelation']!,
      },
    },
    'tarot': {
      'deck': 'rider-waite-smith',
      'spread': draw.spread.id,
      'cards': [
        for (final (index, card) in draw.cards.indexed)
          {
            'position': const ['现状', '关键影响', '趋势'][index],
            'name': card.face.card.name,
            'orientation': card.face.orientation.name,
          },
      ],
    },
  };
}

Future<ProReport> generateProReport(
  GuideRitualSnapshot task,
  StructuredModelClient client, {
  String? previousQuestion,
  Duration timeout = const Duration(minutes: 3),
}) async {
  if (client.provider != ModelProvider.deepseek) {
    throw const ModelOutputError('Pro reports require DeepSeek');
  }
  final output = await client.request(
    rawChartInput(task, previousQuestion: previousQuestion),
    modelOverride: proModel,
    chat: true,
    temperature: 0.4,
    maxOutputTokens: 8192,
    instructions: _proInstructions,
    timeout: timeout,
  );
  try {
    return parseProReport(output, allowLegacy: false);
  } on FormatException catch (error) {
    throw ModelOutputError(error.message);
  }
}
