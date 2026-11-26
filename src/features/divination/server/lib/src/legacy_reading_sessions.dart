import 'dart:math';

import 'package:jovian_divination/jovian_divination.dart';

import 'follow_up_model.dart' show GuideEvidence;
import 'legacy_reading_report.dart';
import 'question_model.dart';
import 'reading_evidence.dart';
import 'reading_store.dart';
import 'stored_guide_sessions.dart' show GuideWire, guideFollowUpLimit;

const _versions = {
  'tarot': 'rws-three-card-v1',
  'liuyao': 'three-coin-v1',
  'meihua': 'three-number-v1',
  'combined': 'tarot-liuyao-meihua-v1',
};
const _combinedRules = {
  'tarot': 'rws-three-card-v1',
  'liuyao': 'three-coin-v1',
  'meihua': 'first-three-liuyao-lines-v1',
};

class LegacyReadingSessions {
  LegacyReadingSessions(
    this._store, {
    required DateTime Function() now,
    double Function()? random,
  }) : _now = now,
       _random = random ?? Random.secure().nextDouble;

  final ReadingSessionStore _store;
  final DateTime Function() _now;
  final double Function() _random;

  ({String token, GuideWire task}) start({
    required String method,
    required String question,
    required String focus,
    required ReadingOwner owner,
  }) {
    if (!canReadLocalQuestion(question)) {
      throw const GuideRitualError(400, 'invalid_question');
    }
    if (understandLocally(question)['clarification']!.isNotEmpty) {
      throw const GuideRitualError(400, 'needs_clarification');
    }
    final version = _versions[method];
    if (version == null) throw const GuideRitualError(400, 'invalid_method');
    if (focus.isEmpty || focus.length > guideQuestionMaxLength) {
      throw const GuideRitualError(400, 'invalid_focus');
    }
    final task = <String, Object?>{
      'method': method,
      'ruleVersion': version,
      'question': question,
      'focus': focus,
      'createdAt': _timestamp(),
      'stage': switch (method) {
        'liuyao' => 'cast',
        'meihua' => 'numbers',
        _ => 'shuffle',
      },
      'followUps': <Object>[],
      if (method == 'liuyao' || method == 'combined') 'tosses': <List<int>>[],
      if (method == 'combined') 'calculationRules': _combinedRules,
    };
    return (token: _store.create(task, owner), task: _wire(task));
  }

  GuideWire get(String token, ReadingOwner owner) =>
      _wire(_upgrade(_store.get(token, owner)));

  GuideWire shuffle(String token, ReadingOwner owner) =>
      _change(token, owner, (task) {
        _requireMethod(task, 'tarot', combined: true);
        if (task['stage'] != 'shuffle') return false;
        task['deck'] = shuffleTarotDeck(random: _random);
        task['stage'] = 'cut';
        return true;
      });

  GuideWire cut(String token, ReadingOwner owner, int point) {
    if (!tarotCutPoints.contains(point))
      throw const GuideRitualError(400, 'invalid_cut');
    return _change(token, owner, (task) {
      _requireMethod(task, 'tarot', combined: true);
      if (task['cut'] == point) return false;
      if (task['stage'] != 'cut')
        throw const GuideRitualError(409, 'cut_out_of_order');
      task
        ..['picking'] = cutTarotDeck(
          (task['deck'] as List).cast<String>(),
          point,
          task['question'] as String,
          random: _random,
        ).toJson()
        ..['cut'] = point
        ..['stage'] = 'draw';
      return true;
    });
  }

  GuideWire pick(String token, ReadingOwner owner, int step, int slot) {
    if (step < 0 || step > 2)
      throw const GuideRitualError(400, 'invalid_selection');
    return _change(token, owner, (task) {
      _requireMethod(task, 'tarot', combined: true);
      final raw = task['picking'];
      if (raw is! Map)
        throw const GuideRitualError(409, 'selection_out_of_order');
      final draft = TarotPicking.fromJson(raw.cast());
      if (slot < 0 || slot >= draft.slots.length) {
        throw const GuideRitualError(400, 'invalid_slot');
      }
      final selected = draft.selectedSlots;
      if (step < selected.length && selected[step] == slot) return false;
      if (task['stage'] != 'draw' ||
          step != selected.length ||
          selected.contains(slot)) {
        throw const GuideRitualError(409, 'selection_out_of_order');
      }
      switch (selectTarotSlot(draft, slot, now: _now)) {
        case TarotPicking picking:
          task['picking'] = picking.toJson();
        case CompletedTarotSelection result:
          final draw = result.draw.toJson();
          final documents = tarotDocuments(result.draw);
          raw['selectedSlots'] = result.selectedSlots;
          task
            ..['draw'] = draw
            ..['documents'] = documents;
          if (task['method'] == 'combined') {
            task['stage'] = 'cast';
          } else {
            task
              ..['resolvedAt'] = draw['drawnAt']
              ..['stage'] = 'reading'
              ..['evidence'] = tarotEvidence(
                documents,
              ).map((item) => item.toSavedJson()).toList();
          }
      }
      return true;
    });
  }

  GuideWire toss(String token, ReadingOwner owner, int step) {
    if (step < 0 || step >= 6)
      throw const GuideRitualError(400, 'invalid_toss');
    return _change(token, owner, (task) {
      _requireMethod(task, 'liuyao', combined: true);
      final rawTosses = task['tosses'] as List;
      if (step < rawTosses.length) return false;
      if (task['stage'] != 'cast' || step != rawTosses.length) {
        throw const GuideRitualError(409, 'toss_out_of_order');
      }
      rawTosses.add(rollLiuYaoLine(random: _random));
      if (rawTosses.length == 6) {
        final liuyao = readLiuYao([
          for (final toss in rawTosses) (toss as List).cast<int>(),
        ]);
        if (task['method'] == 'combined') {
          final meihua = readMeihua(
            liuyao.lines.take(3).map((line) => line.value).toList(),
          );
          task['results'] = {
            'liuyao': liuyao.toJson(),
            'meihua': meihua.toJson(),
            'meihuaInputSource': 'liuyao-first-three-lines',
          };
          _resolve(task, [
            ...tarotEvidence((task['documents'] as List).cast<Map>()),
            ...liuyaoEvidence(liuyao),
            ...meihuaEvidence(meihua),
          ]);
        } else {
          task['result'] = liuyao.toJson();
          _resolve(task, liuyaoEvidence(liuyao));
        }
      }
      return true;
    });
  }

  GuideWire numbers(String token, ReadingOwner owner, List<int> inputs) {
    if (!validMeihuaNumbers(inputs))
      throw const GuideRitualError(400, 'invalid_numbers');
    return _change(token, owner, (task) {
      _requireMethod(task, 'meihua');
      final result = task['result'];
      if (result is Map &&
          (result['inputs'] as List).join(',') == inputs.join(','))
        return false;
      if (task['stage'] != 'numbers') {
        throw const GuideRitualError(409, 'numbers_already_recorded');
      }
      final reading = readMeihuaNumbers(inputs);
      task['result'] = reading.toJson();
      _resolve(task, meihuaEvidence(reading));
      return true;
    });
  }

  GuideWire report(String token, ReadingOwner owner) =>
      _change(token, owner, (task) {
        if (task['stage'] != 'reading')
          throw const GuideRitualError(409, 'report_not_ready');
        if (task['report'] != null) return false;
        task['report'] = composeLegacyReading(task);
        return true;
      });

  GuideWire followUp(
    String token,
    ReadingOwner owner,
    int step,
    String question,
  ) {
    if (step < 0 ||
        step >= guideFollowUpLimit ||
        validateGuideQuestion(question) != null) {
      throw const GuideRitualError(400, 'invalid_follow_up');
    }
    return _change(token, owner, (task) {
      final followUps = task['followUps'] as List;
      if (step < followUps.length &&
          (followUps[step] as Map)['question'] == question)
        return false;
      if (task['report'] == null || step != followUps.length) {
        throw const GuideRitualError(409, 'follow_up_out_of_order');
      }
      followUps.add({
        'question': question,
        'report': composeLegacyReading(task, followUp: question),
      });
      return true;
    });
  }

  GuideWire _change(
    String token,
    ReadingOwner owner,
    bool Function(GuideWire) edit,
  ) => _store.change(token, owner, (task) {
    _upgrade(task);
    final changed = edit(task);
    return (result: _wire(task), changed: changed);
  });

  String _timestamp() => DateTime.fromMillisecondsSinceEpoch(
    _now().millisecondsSinceEpoch,
    isUtc: true,
  ).toIso8601String();

  void _resolve(GuideWire task, List<GuideEvidence> evidence) {
    task
      ..['evidence'] = evidence.map((item) => item.toSavedJson()).toList()
      ..['resolvedAt'] = _timestamp()
      ..['stage'] = 'reading';
  }
}

void _requireMethod(GuideWire task, String method, {bool combined = false}) {
  if (task['method'] != method && !(combined && task['method'] == 'combined')) {
    throw const GuideRitualError(409, 'wrong_reading_method');
  }
}

GuideWire _upgrade(GuideWire task) {
  if (task['method'] != null) return task;
  task['method'] = 'tarot';
  task['ruleVersion'] = _versions['tarot']!;
  final draw = task['draw'];
  if (draw is Map) {
    task['resolvedAt'] = draw['drawnAt'];
    final documents = (task['evidence'] as List).cast<Map>();
    task['documents'] = documents;
    task['evidence'] = tarotEvidence(
      documents,
    ).map((item) => item.toSavedJson()).toList();
    if (task['report'] != null) task['report'] = composeLegacyReading(task);
    final followUps = <Object>[];
    final previous = (task['followUps'] as List).cast<Map>();
    task['followUps'] = followUps;
    for (final item in previous) {
      final question = item['question'] as String;
      followUps.add({
        'question': question,
        'report': composeLegacyReading(task, followUp: question),
      });
    }
  }
  return task;
}

GuideWire _wire(GuideWire task) {
  final method = task['method'];
  final picking = task['picking'] as Map?;
  return {
    for (final key in [
      'method',
      'ruleVersion',
      'resolvedAt',
      'question',
      'focus',
      'stage',
      'report',
      'followUps',
    ])
      if (task[key] != null) key: task[key],
    'evidence': task['evidence'] ?? [],
    if (method == 'tarot' || method == 'combined') ...{
      if (task['cut'] != null) 'cut': task['cut'],
      'slotCount': (picking?['slots'] as List?)?.length ?? 0,
      'selectedSlots': picking?['selectedSlots'] ?? [],
      if (task['draw'] != null) 'draw': task['draw'],
    },
    if (method == 'combined') ...{
      'calculationRules': task['calculationRules'],
      'tosses': task['tosses'],
      if (task['results'] != null) 'results': task['results'],
    },
    if (method == 'liuyao') 'tosses': task['tosses'],
    if (task['result'] != null) 'result': task['result'],
  };
}
