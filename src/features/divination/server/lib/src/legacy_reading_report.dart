import 'package:jovian_divination/jovian_divination.dart';

const _directions = {
  ReadingDirection.verify: '可以先核实最影响你判断的一项，再决定是否推进。',
  ReadingDirection.adjust: '先调整现在最费力的一件事，再看看还需要做多大改变。',
  ReadingDirection.advance: '可以做一次小尝试，用现实反馈决定要不要继续。',
};
const _combinedAnswers = {
  ReadingDirection.verify: '可以继续了解，等关键条件清楚后再做决定。',
  ReadingDirection.adjust: '先做一个能改善现状的调整，再判断是否需要更大的变化。',
  ReadingDirection.advance: '可以先做一次小范围尝试，用实际反馈判断要不要继续。',
};
const _jobChangeAnswers = {
  ReadingDirection.verify: '可以开始看机会，等确认新岗位能改善你最在意的条件，再决定要不要离开。',
  ReadingDirection.adjust: '先找出眼下最想改善的一个问题，再比较换工作和调整现职哪种更合适。',
  ReadingDirection.advance: '可以先接触合适的岗位，通过面谈看看它能否改善你最在意的问题。',
};
const _methodLabels = {'tarot': '塔罗', 'liuyao': '六爻', 'meihua': '梅花易数'};
final _timing = RegExp('多久|什么时候|哪天|几月|期限|时间');
final _reason = RegExp('为什么|原因|依据|怎么看|怎么理解|怎么得出|怎么算');

Map<String, Object> composeLegacyReading(
  Map<String, Object?> task, {
  String? followUp,
}) {
  final method = task['method'] as String;
  final question = task['question'] as String;
  final evidence = (task['evidence'] as List).cast<Map>();
  if (method == 'combined')
    return _composeCombined(task, question, evidence, followUp);
  final tarot = method == 'tarot';
  final ReadingDirection direction;
  if (tarot) {
    final documents = (task['documents'] as List).cast<Map>();
    final focus = documents[1]['direction'];
    direction = ReadingDirection.values.byName(
      (focus == 'advance' ? documents[2]['direction'] : focus) as String,
    );
  } else {
    direction = ReadingDirection.values.byName(
      (task['result'] as Map)['direction'] as String,
    );
  }
  final base = {
    'schemaVersion': 1,
    'method': method,
    'source': 'local',
    'nextSteps': [getReadingAction(question, direction)],
  };
  if (followUp == null) {
    return {
      ...base,
      'answer': _directions[direction]!,
      'explanation': evidence.map((item) => item['plain']).join(' '),
      'evidenceIds': [for (final item in evidence) item['id']],
    };
  }
  final timing = _timing.hasMatch(followUp);
  final reason = _reason.hasMatch(followUp);
  final current =
      evidence[reason
          ? 1
          : tarot
          ? 2
          : 0];
  final previous = _previousStep(task);
  return {
    ...base,
    'evidenceIds': [current['id']],
    'answer': timing
        ? '可以先设一个观察点，用实际反馈判断什么时候适合推进。'
        : reason
        ? '可以从这次记录下来的依据看这一步。'
        : '沿用这次结果，可以把下一步缩小到一件你能亲自核实的事。',
    'explanation':
        '${previous.isEmpty ? '' : '接着刚才的建议：$previous '}${current['plain']}',
  };
}

String _previousStep(Map<String, Object?> task) {
  final prior = task['followUps'] as List;
  final report = prior.isEmpty ? task['report'] : (prior.last as Map)['report'];
  final steps = report is Map ? report['nextSteps'] : null;
  return steps is List && steps.isNotEmpty ? steps.first as String : '';
}

String _evidenceMethod(String id) => id.startsWith('liuyao:')
    ? 'liuyao'
    : id.startsWith('meihua:')
    ? 'meihua'
    : 'tarot';

Map<String, Object> _composeCombined(
  Map<String, Object?> task,
  String question,
  List<Map> evidence,
  String? followUp,
) {
  final tarot = readTarot(
    question,
    TarotDraw.fromJson((task['draw'] as Map).cast<String, Object?>()),
  );
  final results = task['results'] as Map;
  final signals = {
    tarot.direction,
    for (final method in ['liuyao', 'meihua'])
      ReadingDirection.values.byName(
        (results[method] as Map)['direction'] as String,
      ),
  };
  final canTry = signals.contains(ReadingDirection.advance);
  final shouldAdjust = signals.contains(ReadingDirection.adjust);
  final focus = getReadingTopic(question).focus;
  final direction = signals.contains(ReadingDirection.verify)
      ? ReadingDirection.verify
      : shouldAdjust
      ? ReadingDirection.adjust
      : ReadingDirection.advance;
  final summary = switch (direction) {
    ReadingDirection.verify =>
      '先从${focus}中找出会改变你判断的一项，再想想可以从哪里核实。'
          '${shouldAdjust ? '信息明确后，可以先调整最卡住的一项安排。' : ''}'
          '${canTry ? '条件合适时，再做一个成本有限的尝试。' : ''}',
    ReadingDirection.adjust =>
      '把${focus}里最影响你的阻力缩小到一件可改变的事，再观察调整有没有用。'
          '${canTry ? '腾出余地后，可以接着试一个小选项。' : ''}',
    ReadingDirection.advance => '选一个范围小、容易改变的尝试。拿到反馈后，再决定是否继续投入。',
  };
  final answer = (isJobChangeQuestion(question)
      ? _jobChangeAnswers
      : _combinedAnswers)[direction]!;
  final base = {
    'schemaVersion': 1,
    'method': 'combined',
    'source': 'local',
    'nextSteps': [getReadingAction(question, direction)],
  };
  if (followUp == null) {
    String fact(String id) =>
        evidence.firstWhere(
              (item) => (item['id'] as String).startsWith(id),
            )['plain']
            as String;
    return {
      ...base,
      'answer': answer,
      'explanation': [
        '塔罗｜${tarot.summary}',
        '六爻｜${fact('liuyao:v1:shi-ying')}',
        '梅花易数｜${fact('meihua:v1:body-use')}',
        summary,
      ].join('\n\n'),
      'evidenceIds': [for (final item in evidence) item['id']],
    };
  }
  final timing = _timing.hasMatch(followUp);
  final reason = _reason.hasMatch(followUp);
  final matches = _methodLabels.entries
      .where((method) => followUp.contains(method.value))
      .map((method) => method.key)
      .toSet();
  final relevant = matches.isEmpty
      ? evidence
      : evidence.where(
          (item) => matches.contains(_evidenceMethod(item['id'] as String)),
        );
  return {
    ...base,
    'answer': timing
        ? '先设一个观察点，再按实际反馈判断何时推进。'
        : reason
        ? '可以回看这次保存的依据，看看哪些信息支持刚才的建议。'
        : answer,
    'explanation':
        '接着刚才的建议：${_previousStep(task)}\n\n'
        '${reason || matches.isNotEmpty ? relevant.map((item) => item['plain']).join(' ') : summary}',
    'evidenceIds': [for (final item in relevant) item['id']],
  };
}
