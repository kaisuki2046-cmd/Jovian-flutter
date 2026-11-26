import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:jovian_divination_server/jovian_divination_server.dart';

import '../../control/test/parity_support.dart';

const _legacyProgram = r'''
import { readFileSync } from 'node:fs';
import { generateGuideFollowUp } from './src/features/divination/server/combined-report.mjs';
import { understandWithModel } from './src/features/divination/server/question-model.mjs';
import { generateProReport, proPromptVersion, rawChartInput } from './src/features/divination/server/pro-report.mjs';
import { parseSavedProReport, splitProText, splitProInterpretation } from './src/features/divination/model/pro-report.ts';
const input = JSON.parse(readFileSync(0, 'utf8'));

function harness(provider, output) {
  const calls = [];
  return {
    calls,
    options: {
      provider, apiKey: 'fixture-key', model: provider === 'deepseek' ? 'deepseek-flash' : 'gpt-4.1-mini',
      async transport(uri, { method, headers, body }) {
        calls.push({ uri, method, headers, body: JSON.parse(body) });
        const text = JSON.stringify(output);
        if (uri.endsWith('/chat/completions')) return Response.json({choices: [{finish_reason: 'stop', message: {content: text}}]});
        return Response.json({status: 'completed', output: [{type: 'message', role: 'assistant', content: [{type: 'output_text', text}]}]});
      },
    },
  };
}

const asked = [];
for (const [question, guide, provider, previousQuestion, output] of input.questions) {
  const config = harness(provider, output);
  const result = await understandWithModel(question, config.options, guide, previousQuestion ?? undefined);
  asked.push({ result, calls: config.calls });
}
const reports = [];
for (const task of input.tasks) {
  const pro = harness('deepseek', input.proOutput);
  const follow = harness('deepseek', input.followUpOutput);
  reports.push({
    facts: rawChartInput(task),
    pro: await generateProReport(task, pro.options),
    followUp: await generateGuideFollowUp(task, input.followUpQuestion, follow.options),
    calls: [...pro.calls, ...follow.calls],
  });
}
process.stdout.write(JSON.stringify([
  asked, reports, input.archives.map(parseSavedProReport),
  input.markup.map(text => [splitProText(text), splitProInterpretation(text)]), proPromptVersion,
]));
''';

const _initialQuestion = '这次面试后续会怎样？';
const _previousQuestion = '该怎样准备这次面试？';
const _focus = '面试后续';
const _followUpQuestion = '如何判断对方有明确意向？';
const _evidence = GuideEvidence(
  id: 'tarot:v1:sample',
  label: '现实线索',
  plain: '可以留意沟通是否推进。',
);
const _paragraph = {'text': '先确认**反馈时间**。', 'detail': '用已发生的沟通判断后续安排。'};
const _overview = {'text': '小结 · 关注**明确安排**。'};
const _proPayload = {
  'tarot': [_paragraph, _paragraph, _paragraph, _overview],
  'meihua': [_paragraph, _paragraph, _overview],
  'liuyao': [_paragraph, _paragraph, _paragraph, _overview],
};
const _followUpPayload = {
  'schema_version': 'followup.v1',
  'answer': '可以留意对方是否给出了明确的会议安排。',
  'actions': ['约定反馈时间'],
  'evidence_ids': ['tarot:v1:sample'],
};
const _modelOptions = {
  ModelProvider.deepseek: 'deepseek-flash',
  ModelProvider.openai: 'gpt-4.1-mini',
};

({StructuredModelClient client, List<Object> calls}) _harness(
  ModelProvider provider,
  Object output,
) {
  final calls = <Object>[];
  final client = StructuredModelClient(
    provider: provider,
    apiKey: 'fixture-key',
    model: _modelOptions[provider]!,
    transport: (uri, headers, body, _) async {
      calls.add({
        'uri': uri.toString(),
        'method': 'POST',
        'headers': headers,
        'body': jsonDecode(body),
      });
      final text = jsonEncode(output);
      final response = uri.path.endsWith('/chat/completions')
          ? {
              'choices': [
                {
                  'finish_reason': 'stop',
                  'message': {'content': text},
                },
              ],
            }
          : {
              'status': 'completed',
              'output': [
                {
                  'type': 'message',
                  'role': 'assistant',
                  'content': [
                    {'type': 'output_text', 'text': text},
                  ],
                },
              ],
            };
      return (status: 200, body: jsonEncode(response));
    },
  );
  return (client: client, calls: calls);
}

GuideRitualSnapshot _ritual(bool automatic) {
  final task = GuideRitual(
    question: _initialQuestion,
    focus: _focus,
    automatic: automatic,
    now: () => DateTime.utc(2026, 11, 20, 15),
    random: () => 0.3,
  );
  if (!automatic) {
    String id(int number) =>
        '00000000-0000-4000-8000-${number.toString().padLeft(12, '0')}';
    for (var step = 0; step < 6; step++) {
      task.toss(GuideCoinEvent(actionId: id(step), step: step));
    }
    for (var step = 0; step < 3; step++) {
      task.pick(
        GuideCardEvent(
          actionId: id(6 + step),
          step: step,
          slot: [77, 0, 35][step],
          epochMs: ['9007199254740993', '1794528001003', '1794528002008'][step],
          monotonicMs: 100 * step,
          clockSessionId: id(9),
        ),
      );
    }
  }
  return task.snapshot;
}

String _questionHash(GuideRitualSnapshot task, String? previous) => sha256
    .convert(utf8.encode(jsonEncode([task.question, task.focus, previous])))
    .toString();

Future<void> main() async {
  const overview = '盘面显示仍需确认。';
  const legacy = {
    'text': '反馈仍需确认。',
    'technique': '基于已知条件。',
    'interpretation': '先确认约定。',
  };
  const archived = {'text': '可继续沟通。建议先确认反馈时间。', 'highlight': '反馈时间'};
  const archives = [
    _proPayload,
    {'tarot': '塔罗解读。', 'meihua': '梅花易数解读。', 'liuyao': '六爻解读。'},
    {
      'tarot': [
        legacy,
        legacy,
        legacy,
        {'text': overview},
      ],
      'meihua': [legacy, legacy, _overview],
      'liuyao': [legacy, legacy, _overview],
    },
    {
      'opening': '开头',
      'tarot': archived,
      'meihua': archived,
      'liuyao': archived,
      'closing': '结尾',
    },
  ];
  const markup = [
    '**整句解读。**后续可**留意电话**。**建议当面确认**。再等**反馈。',
    '现状 · 星币三正位。对方可能在核实协作经验。',
    '现状 · 星币三正位。对方可能在**核实协作经验**。',
    '星币三正位提示对方在**核实协作经验**。',
    '变卦提示后续仍需确认细节。',
    '建议**🙂🙂🙂**后再确认。',
  ];
  const missing = {
    'intent': 'missing_details',
    'focus': 'general',
    'questions': ['你想问什么事？'],
  };
  const questions = [
    (
      '换工作和搬家是两件事。',
      false,
      ModelProvider.deepseek,
      null,
      {'intent': 'ready', 'focus': 'choice'},
    ),
    (
      '换工作和搬家是两件事。',
      false,
      ModelProvider.openai,
      null,
      {'intent': 'multiple_questions', 'focus': 'choice'},
    ),
    ('什么时候回款？', true, ModelProvider.deepseek, _previousQuestion, missing),
    ('什么时候？', true, ModelProvider.deepseek, null, missing),
    ('算算我今天的underwear的颜色', true, ModelProvider.deepseek, null, missing),
    (
      'What color is my T-shirt?',
      true,
      ModelProvider.deepseek,
      null,
      {'intent': 'chat_only', 'focus': 'general', 'questions': []},
    ),
    (
      '你好。',
      true,
      ModelProvider.deepseek,
      null,
      {'intent': 'chat_only', 'focus': 'general', 'questions': []},
    ),
  ];
  final tasks = [_ritual(false), _ritual(true)];
  final parsedOriginal = parseProReport(_proPayload, allowLegacy: false);
  final expected = await runLegacyOracle(_legacyProgram, {
    'archives': archives,
    'markup': markup,
    'questions': [
      for (final (question, guide, provider, previous, output) in questions)
        [question, guide, provider.name, previous, output],
    ],
    'tasks': [
      for (final (index, task) in tasks.indexed)
        {
          ...task.toChartSnapshotJson(),
          if (index == 0) 'previousQuestion': _previousQuestion,
          'questionHash': _questionHash(
            task,
            index == 0 ? _previousQuestion : null,
          ),
          'evidence': [_evidence.toModelInput()],
          'proReport': parsedOriginal.toJson(),
          'followUps': [
            if (index == 1)
              {
                'report': {'answer': '可再等一次回复。'},
              },
          ],
        },
    ],
    'proOutput': _proPayload,
    'followUpQuestion': _followUpQuestion,
    'followUpOutput': _followUpPayload,
  });

  final asked = <Object>[];
  for (final (question, guide, provider, previous, payload) in questions) {
    final harness = _harness(provider, payload);
    final result = await understandWithModel(
      question,
      harness.client,
      guide: guide,
      previousQuestion: previous,
    );
    asked.add({'result': result.toJson(), 'calls': harness.calls});
  }
  final reports = <Object>[];
  for (final (index, task) in tasks.indexed) {
    final previous = index == 0 ? _previousQuestion : null;
    final pro = _harness(ModelProvider.deepseek, _proPayload);
    final followUp = _harness(ModelProvider.deepseek, _followUpPayload);
    final report = await generateProReport(
      task,
      pro.client,
      previousQuestion: previous,
    );
    final next = await generateGuideFollowUp(
      task,
      _followUpQuestion,
      followUp.client,
      originalReport: parsedOriginal.toJson(),
      evidence: [_evidence],
      previousQuestion: previous,
      lastFollowUpAnswer: index == 1 ? '可再等一次回复。' : null,
    );
    reports.add({
      'facts': rawChartInput(task, previousQuestion: previous),
      'pro': report.toJson(),
      'followUp': next.toJson(),
      'calls': [...pro.calls, ...followUp.calls],
    });
  }
  List<Object> convert(List<ProTextPart> fragments) => [
    for (final fragment in fragments)
      {'text': fragment.text, 'bold': fragment.bold},
  ];
  final actual = [
    asked,
    reports,
    [for (final report in archives) parseSavedProReport(report).toJson()],
    [
      for (final text in markup)
        [convert(splitProText(text)), convert(splitProInterpretation(text))],
    ],
  ];
  final legacyPromptPath = legacyRepositoryRoot.uri.resolve(
    'src/features/divination/docs/DeepSeek-Pro-Prompt.md',
  );
  final legacyPrompt = File.fromUri(legacyPromptPath).readAsStringSync().trim();
  final legacyVersion = sha256.convert(utf8.encode(legacyPrompt)).toString();
  if (expected[4] != legacyVersion)
    throw StateError('Legacy prompt checksum mismatch.');
  final canonical = legacyPrompt.replaceAll('\r\n', '\n');
  if (proPromptVersion != sha256.convert(utf8.encode(canonical)).toString()) {
    throw StateError('Migrated system prompt checksum mismatch.');
  }
  for (var group = 0; group < actual.length; group++) {
    final expectedCanonical = jsonDecode(
      jsonEncode(expected[group]).replaceAll(r'\r\n', r'\n'),
    );
    if (!deepEquals(actual[group], expectedCanonical)) {
      final expectedCases = expectedCanonical as List;
      for (var item = 0; item < actual[group].length; item++) {
        if (!deepEquals(actual[group][item], expectedCases[item])) {
          throw StateError(
            'Model parity mismatch in group $group, item $item.',
          );
        }
      }
      throw StateError(
        'Model parity received an unexpected case count in group $group.',
      );
    }
  }
  await _expectFormatFailure(
    () => understandWithModel(
      _initialQuestion,
      _harness(ModelProvider.deepseek, {
        'intent': 'ready',
        'focus': 'general',
        'questions': [],
        'extra': 'fabricated data',
      }).client,
      guide: true,
    ),
    'Invalid question parser output.',
  );
  try {
    await generateProReport(
      tasks.first,
      _harness(ModelProvider.deepseek, archives[1]).client,
    );
    throw StateError('A newly generated legacy text report was accepted.');
  } on ModelOutputError catch (error) {
    if (error.message != 'Invalid Pro report sections.') rethrow;
  }
  for (final invalid in [
    {'answer': '抽到星币三正位。'},
    {
      'evidence_ids': ['unknown-fact'],
    },
    {
      'evidence_ids': [_evidence.id, _evidence.id],
    },
  ]) {
    await _expectFormatFailure(
      () => generateGuideFollowUp(
        tasks.first,
        _followUpQuestion,
        _harness(ModelProvider.deepseek, {
          ..._followUpPayload,
          ...invalid,
        }).client,
        originalReport: parsedOriginal.toJson(),
        evidence: [_evidence],
      ),
      'Invalid follow-up.',
    );
  }
  stdout.writeln(
    '7 question requests, 2 guide reports and follow-ups, 4 archive formats, and 6 markup fixtures match. Five invalid outputs were rejected.',
  );
}

Future<void> _expectFormatFailure(
  Future<Object?> Function() call,
  String expected,
) async {
  try {
    await call();
  } on FormatException catch (error) {
    if (error.message == expected) return;
    rethrow;
  }
  throw StateError('Expected $expected');
}
