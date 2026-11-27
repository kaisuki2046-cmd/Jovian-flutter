import 'dart:async';
import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:jovian_divination/jovian_divination.dart';

import 'follow_up_model.dart';
import 'model_config.dart';
import 'pro_model.dart';
import 'reading_evidence.dart';
import 'reading_store.dart';
import 'structured_model.dart';

part 'stored_guide_reports.dart';

typedef GuideWire = Map<String, Object?>;

class StoredGuideSessions {
  StoredGuideSessions(
    this._store, {
    DateTime Function()? now,
    double Function()? random,
  }) : _now = now ?? DateTime.now,
       _random = random;

  final ReadingSessionStore _store;
  final DateTime Function() _now;
  final double Function()? _random;
  final _runningReports = <String, Future<GuideWire>>{};

  /// The caller verifies the account and question proof before starting a guide.
  ({String token, GuideWire task}) start({
    required ReadingOwner owner,
    required String question,
    required String focus,
    String? previousQuestion,
    bool automatic = false,
    bool tarotFirst = false,
  }) {
    previousQuestion = previousQuestion?.trim();
    if (previousQuestion != null &&
        validateGuideQuestion(previousQuestion) != null) {
      throw const GuideRitualError(400, 'invalid_question');
    }
    final created = _now().toUtc();
    final ritual = GuideRitual(
      question: question,
      focus: focus,
      automatic: automatic,
      tarotFirst: tarotFirst,
      random: _random,
      now: _now,
      automaticStartedAt: created,
    );
    final payload = <String, Object?>{
      'createdAt': DateTime.fromMillisecondsSinceEpoch(
        created.millisecondsSinceEpoch,
        isUtc: true,
      ).toIso8601String(),
      'questionHash': sha256
          .convert(
            utf8.encode(
              jsonEncode([ritual.question, ritual.focus, previousQuestion]),
            ),
          )
          .toString(),
      if (previousQuestion != null) 'previousQuestion': previousQuestion,
      'followUps': <Object>[],
      'coinEvents': <Object>[],
      'actions': <String, Object?>{},
      'evidence': <Object>[],
    };
    _persistRitual(payload, ritual);
    final token = _store.create(payload, owner);
    return (token: token, task: _wire(payload, ritual.snapshot));
  }

  GuideWire get(String token, ReadingOwner owner) {
    final payload = _store.get(token, owner);
    return _wire(payload, _restore(payload).snapshot);
  }

  GuideWire toss(String token, ReadingOwner owner, GuideCoinEvent event) {
    event.validate();
    return _apply(
      token,
      owner,
      event.actionId,
      event.toJson(),
      card: false,
      change: (ritual) => ritual.toss(event),
    );
  }

  GuideWire pick(String token, ReadingOwner owner, GuideCardEvent event) {
    event.validate();
    return _apply(
      token,
      owner,
      event.actionId,
      event.toJson(),
      card: true,
      change: (ritual) => ritual.pick(event),
    );
  }

  GuideWire _apply(
    String token,
    ReadingOwner owner,
    String actionId,
    Map<String, Object> event, {
    required bool card,
    required GuideRitualSnapshot Function(GuideRitual) change,
  }) => _store.change(token, owner, (payload) {
    _requireGuide(payload);
    final actions = (payload['actions'] as Map).cast<String, Object?>();
    final digest = jsonEncode([card, event]);
    if (actions[actionId] case final Map recorded) {
      if (recorded['digest'] != digest) {
        throw const GuideRitualError(409, 'action_conflict');
      }
      return (result: _map(recorded['snapshot']), changed: false);
    }
    final ritual = _restore(payload);
    final result = change(ritual);
    if (!card) {
      (payload['coinEvents'] as List).add({
        ...event,
        'coins': result.tosses.last,
      });
    }
    _persistRitual(payload, ritual);
    final wire = _wire(payload, result);
    actions[actionId] = {'digest': digest, 'snapshot': wire};
    return (result: wire, changed: true);
  });

  GuideRitual _restore(GuideWire payload) {
    _requireGuide(payload);
    return restoreGuideRitual(payload, now: _now, random: _random);
  }
}

void _requireGuide(GuideWire payload) {
  if (payload['ruleVersion'] != guideVersion ||
      payload['method'] != 'combined') {
    throw const GuideRitualError(409, 'wrong_reading_method');
  }
}

GuideWire _map(Object? value) => (value as Map).cast<String, Object?>();

void _persistRitual(GuideWire payload, GuideRitual ritual) {
  payload.addAll(ritual.toPersistedRitualFields());
  final chart = ritual.snapshot.chart;
  if (chart != null) {
    payload['documents'] = tarotDocuments(chart.tarot);
    payload['evidence'] = chartEvidence(
      chart,
    ).map((entry) => entry.toSavedJson()).toList();
  }
}

ProReport? _savedReport(GuideWire payload) {
  final value = payload['proReport'];
  if (value == null) return null;
  try {
    return parseSavedProReport(value);
  } on FormatException {
    return null;
  }
}

GuideWire _wire(GuideWire payload, GuideRitualSnapshot snapshot) => {
  ...snapshot.toChartSnapshotJson(),
  'evidence': payload['evidence'] ?? [],
  'followUps': payload['followUps'] ?? [],
  if (_savedReport(payload) case final report?) 'proReport': report.toJson(),
};
