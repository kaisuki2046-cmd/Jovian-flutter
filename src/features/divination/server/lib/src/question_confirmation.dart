import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:jovian_divination/jovian_divination.dart';

import 'account_permission.dart';
import 'model_config.dart';
import 'question_model.dart';
import 'stored_guide_sessions.dart' show GuideWire;
import 'structured_model.dart';

typedef ReadAccess = Future<ReadingAccess> Function();
typedef GuideQuestion = ({String question, String? previousQuestion});
final _proofPattern = RegExp(r'^(\d{1,16})\.([a-f0-9]{64})$');
const _proofLifetime = Duration(minutes: 10);

class ReadingQuestions {
  ReadingQuestions(this._model, this._now) : _proof = _createProofSigner();

  final StructuredModelClient? _model;
  final DateTime Function() _now;
  final Hmac _proof;

  Future<GuideWire> understand(GuideWire input, ReadAccess access) async {
    final model = _model;
    if (input['requireModel'] == true) {
      final (:question, :previousQuestion) = guideQuestion(input);
      if (model != null) await (await access()).requirePermission();
      if (model != null &&
          model.provider == ModelProvider.deepseek &&
          model.model == guideQuestionModel) {
        try {
          final answer = await understandWithModel(
            question,
            model,
            guide: true,
            previousQuestion: previousQuestion,
          );
          if (answer.clarification.isNotEmpty) return answer.toJson();
          final expires = _now().add(_proofLifetime).millisecondsSinceEpoch;
          return {
            ...answer.toJson(),
            'proof':
                '$expires.${_digest(question, answer.focus, expires, previousQuestion)}',
          };
        } catch (_) {
          throw const GuideRitualError(503, 'question_model_unavailable');
        }
      }
      throw const GuideRitualError(503, 'question_model_unavailable');
    }
    final question = readingText(input['question']);
    if (!canReadLocalQuestion(question)) {
      throw const GuideRitualError(400, 'invalid_question');
    }
    final local = understandLocally(question);
    if (local['clarification']!.isNotEmpty) return local;
    if (model != null && (await access()).allowed) {
      try {
        return (await understandWithModel(question, model)).toJson();
      } catch (_) {
        return local;
      }
    }
    return local;
  }

  void verify(GuideQuestion input, String focus, Object? proof) {
    const needsProof = GuideRitualError(
      400,
      'question_needs_model_confirmation',
    );
    final match = proof is String ? _proofPattern.firstMatch(proof) : null;
    if (match == null) throw needsProof;
    final expires = int.parse(match.group(1)!);
    if (expires < _now().millisecondsSinceEpoch) throw needsProof;
    final expected = _digest(
      input.question,
      focus,
      expires,
      input.previousQuestion,
    );
    var mismatch = 0;
    final actual = match.group(2)!;
    for (var i = 0; i < expected.length; i++) {
      mismatch |= expected.codeUnitAt(i) ^ actual.codeUnitAt(i);
    }
    if (mismatch != 0) throw needsProof;
  }

  String _digest(
    String question,
    String focus,
    int expires,
    String? previous,
  ) => _proof
      .convert(utf8.encode(jsonEncode([question, focus, expires, previous])))
      .toString();
}

Hmac _createProofSigner() {
  final random = Random.secure();
  return Hmac(sha256, List.generate(32, (_) => random.nextInt(256)));
}

GuideQuestion guideQuestion(GuideWire input) => (
  question: _readGuideText(input['question']),
  previousQuestion: input.containsKey('previousQuestion')
      ? _readGuideText(input['previousQuestion'])
      : null,
);

String readingText(Object? value) => value is String ? value.trim() : '';

String _readGuideText(Object? value) {
  final text = readingText(value);
  if (validateGuideQuestion(text) != null) {
    throw const GuideRitualError(400, 'invalid_question');
  }
  return text;
}
