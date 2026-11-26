part of 'stored_guide_sessions.dart';

const _reportDeadline = Duration(minutes: 3);
const guideFollowUpLimit = 8;

extension StoredGuideReports on StoredGuideSessions {
  Future<GuideWire> report(
    String token,
    ReadingOwner owner, {
    required Future<void> Function() requirePermission,
    required StructuredModelClient? model,
  }) async {
    final initial = _store.get(token, owner);
    final snapshot = _restore(initial).snapshot;
    if (snapshot.stage != GuideStage.reading) {
      throw const GuideRitualError(409, 'report_not_ready');
    }
    if (_savedReport(initial) != null) return _wire(initial, snapshot);
    await requirePermission();
    // Recheck ownership before joining work already started by another request.
    _store.get(token, owner);
    if (_runningReports[token] case final running?) return running;
    final operation = _generateReport(token, owner, model);
    _runningReports[token] = operation;
    try {
      return await operation;
    } finally {
      _runningReports.remove(token);
    }
  }

  Future<GuideWire> _generateReport(
    String token,
    ReadingOwner owner,
    StructuredModelClient? model,
  ) async {
    final reservation = _store
        .change<
          ({GuideWire payload, GuideRitualSnapshot snapshot, int? started})
        >(token, owner, (payload) {
          final snapshot = _restore(payload).snapshot;
          if (snapshot.stage != GuideStage.reading) {
            throw const GuideRitualError(409, 'comparison_not_ready');
          }
          if (_savedReport(payload) != null) {
            return (
              result: (payload: payload, snapshot: snapshot, started: null),
              changed: false,
            );
          }
          if (model == null ||
              model.provider != ModelProvider.deepseek ||
              model.model != guideQuestionModel) {
            throw const GuideRitualError(503, 'pro_model_unavailable');
          }
          final now = _now().millisecondsSinceEpoch;
          final previous = payload['proStartedAt'];
          if (previous is int &&
              now - previous < _reportDeadline.inMilliseconds) {
            throw const GuideRitualError(409, 'comparison_in_progress');
          }
          payload['proStartedAt'] = now;
          return (
            result: (payload: payload, snapshot: snapshot, started: now),
            changed: true,
          );
        });
    final started = reservation.started;
    if (started == null)
      return _wire(reservation.payload, reservation.snapshot);

    final ProReport report;
    try {
      report = await generateProReport(
        reservation.snapshot,
        model!,
        previousQuestion: reservation.payload['previousQuestion'] as String?,
        timeout: _reportDeadline,
      );
    } catch (error) {
      _store.change(token, owner, (payload) {
        final owned = payload['proStartedAt'] == started;
        if (owned) payload.remove('proStartedAt');
        return (result: null, changed: owned);
      });
      throw switch (error) {
        TimeoutException() => const GuideRitualError(504, 'pro_model_timeout'),
        ModelOutputError() => const GuideRitualError(
          502,
          'pro_model_invalid_output',
        ),
        _ => const GuideRitualError(503, 'pro_model_unavailable'),
      };
    }

    return _store.change(token, owner, (payload) {
      final ownsReservation = payload['proStartedAt'] == started;
      if (ownsReservation) {
        payload['proReport'] = report.toJson();
        payload['proReportVersion'] = proPromptVersion;
        payload.remove('proStartedAt');
      }
      return (
        result: _wire(payload, _restore(payload).snapshot),
        changed: ownsReservation,
      );
    });
  }

  Future<GuideWire> followUp(
    String token,
    ReadingOwner owner, {
    required int step,
    required String question,
    required Future<void> Function() requirePermission,
    required StructuredModelClient? model,
  }) async {
    question = question.trim();
    if (step < 0 ||
        step >= guideFollowUpLimit ||
        validateGuideQuestion(question) != null) {
      throw const GuideRitualError(400, 'invalid_follow_up');
    }
    final beforePermission = _store.get(token, owner);
    _requireGuide(beforePermission);
    if (_isRepeatedFollowUp(beforePermission, step, question)) {
      return _wire(beforePermission, _restore(beforePermission).snapshot);
    }
    _checkFollowUp(beforePermission, step);
    if (model == null ||
        model.provider != ModelProvider.deepseek ||
        model.model != guideQuestionModel) {
      throw const GuideRitualError(503, 'report_model_unavailable');
    }
    await requirePermission();
    final current = _store.get(token, owner);
    final snapshot = _restore(current).snapshot;
    if (_isRepeatedFollowUp(current, step, question))
      return _wire(current, snapshot);
    _checkFollowUp(current, step);
    final followUps = current['followUps'] as List;
    final last = followUps.isEmpty
        ? null
        : (_map(followUps.last)['report'] as Map)['answer'];
    final GuideFollowUpReport response;
    try {
      response = await generateGuideFollowUp(
        snapshot,
        question,
        model,
        originalReport: _map(current['proReport']),
        evidence: [
          for (final raw in current['evidence'] as List)
            GuideEvidence(
              id: raw['id'] as String,
              label: raw['label'] as String,
              plain: raw['plain'] as String,
              catalogVersion: raw['catalogVersion'] as int,
            ),
        ],
        previousQuestion: current['previousQuestion'] as String?,
        lastFollowUpAnswer: last as String?,
        timeout: _reportDeadline,
      );
    } catch (_) {
      throw const GuideRitualError(503, 'report_model_unavailable');
    }
    return _store.change(token, owner, (payload) {
      final latest = _restore(payload).snapshot;
      if (_isRepeatedFollowUp(payload, step, question)) {
        return (result: _wire(payload, latest), changed: false);
      }
      _checkFollowUp(payload, step);
      if (latest.chart?.chartHash != snapshot.chart?.chartHash) {
        throw const GuideRitualError(409, 'follow_up_out_of_order');
      }
      (payload['followUps'] as List).add({
        'question': question,
        'report': response.toJson(),
      });
      return (result: _wire(payload, latest), changed: true);
    });
  }
}

bool _isRepeatedFollowUp(GuideWire payload, int step, String question) {
  final followUps = payload['followUps'] as List;
  return step < followUps.length &&
      _map(followUps[step])['question'] == question;
}

void _checkFollowUp(GuideWire payload, int step) {
  if (_savedReport(payload) == null ||
      step != (payload['followUps'] as List).length) {
    throw const GuideRitualError(409, 'follow_up_out_of_order');
  }
}
