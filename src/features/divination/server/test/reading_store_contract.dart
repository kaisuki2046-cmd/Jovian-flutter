import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:jovian_divination_server/jovian_divination_server.dart';
import 'package:sqlite3/sqlite3.dart';

import '../../control/test/parity_support.dart';

const _legacyProgram = r'''
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createReadingTaskService } from './src/features/divination/server/reading-tasks.mjs';
const input = JSON.parse(readFileSync(0, 'utf8'));
const { mode, path, time, owner, coins, cards, token } = input;
const opts = {
  now: () => time,
  random: () => 0.3,
  understand: async () => ({ focus: '面试后续', clarification: '', source: 'model' }),
};
const service = createReadingTaskService(path, opts);
try {
  if (mode === 'read' || mode === 'read-auto') {
    service.checkOwner(token, owner);
    const snapshot = service.get(token);
    const results = [snapshot];
    if (mode === 'read') results.push(service.pick(token, cards[0]));
    process.stdout.write(JSON.stringify(results));
  } else {
    const question = '这次面试后续会怎样？';
    const { proof } = await service.understandQuestion({ question, requireModel: true });
    const args = { question, focus: '面试后续', proof, method: 'combined', profile: 'three-methods-v1' };
    const partial = service.start(args, owner);
    const complete = service.start(args, owner);
    const auto = service.start({ ...args, automatic: true }, owner);
    const unbound = service.start(args);
    for (const task of [partial, complete]) {
      for (const event of coins) service.toss(task.token, event);
      service.pick(task.token, cards[0]);
    }
    for (const event of cards.slice(1)) service.pick(complete.token, event);
    const hash = createHash('sha256').update(auto.token).digest('hex');
    const db = new DatabaseSync(path);
    try {
      const old = JSON.parse(db.prepare('SELECT payload FROM tarot_sessions WHERE token_hash = ?').get(hash).payload);
      old.proReport = { tarot: '旧版塔罗报告。', meihua: '旧版梅花报告。', liuyao: '旧版六爻报告。' };
      old.proReportVersion = 'legacy-version';
      old.externalMetadata = { imported: true };
      db.prepare('UPDATE tarot_sessions SET payload = ? WHERE token_hash = ?').run(JSON.stringify(old), hash);
    } finally {
      db.close();
    }
    process.stdout.write(JSON.stringify([
      partial.token, service.get(partial.token), complete.token, service.get(complete.token),
      auto.token, service.get(auto.token), unbound.token,
    ]));
  }
} finally {
  service.close();
}
''';

const _ownerId = '00000000-0000-4000-8000-000000000001';
const _owner = ReadingOwner(ReadingOwnerKind.member, _ownerId);
const _other = ReadingOwner(
  ReadingOwnerKind.member,
  '00000000-0000-4000-8000-000000000002',
);
const _guest = ReadingOwner(ReadingOwnerKind.guest, _ownerId);
const _question = '这次面试后续会怎样？';
const _focus = '面试后续';
const _paragraph = {'text': '可先确认反馈时间。', 'detail': '依据目前的反馈判断进度。'};
const _overview = {'text': '综述 · 等待明确安排。'};
const _report = {
  'tarot': [_paragraph, _paragraph, _paragraph, _overview],
  'meihua': [_paragraph, _paragraph, _overview],
  'liuyao': [_paragraph, _paragraph, _overview],
};

String _id(int number) =>
    '00000000-0000-4000-8000-${number.toString().padLeft(12, '0')}';
String _hash(String token) => sha256.convert(utf8.encode(token)).toString();

void _same(Object? expected, Object? actual, String description) {
  if (!deepEquals(expected, actual)) throw StateError('$description differs.');
}

Future<void> _fails(
  int status,
  String code,
  FutureOr<Object?> Function() action,
) async {
  try {
    await action();
  } on GuideRitualError catch (error) {
    if (error.status == status && error.code == code) return;
    throw StateError(
      'Expected $status/$code, got ${error.status}/${error.code}.',
    );
  }
  throw StateError('Expected $status/$code but the operation succeeded.');
}

Future<void> main() async {
  final temp = await Directory.systemTemp.createTemp('jovian-reading-store-');
  final path = File.fromUri(temp.uri.resolve('reading.sqlite')).path;
  final coins = [
    for (var step = 0; step < 6; step++)
      GuideCoinEvent(actionId: _id(step), step: step),
  ];
  final cards = [
    for (var step = 0; step < 3; step++)
      GuideCardEvent(
        actionId: _id(step + 6),
        clockSessionId: _id(10),
        step: step,
        slot: [77, 0, 35][step],
        monotonicMs: 50.25 * step,
        epochMs: ['9007199254740993', '1794528001003', '1794528002008'][step],
      ),
  ];
  var now = DateTime.utc(2026, 11, 20, 15);
  final savedTime = now.millisecondsSinceEpoch;
  final oracleInput = {
    'path': path,
    'time': savedTime,
    'owner': {'kind': _owner.kind.name, 'id': _owner.id},
    'coins': [for (final event in coins) event.toJson()],
    'cards': [for (final event in cards) event.toJson()],
  };
  ReadingSessionStore? connection;
  StoredGuideSessions open() {
    connection?.close();
    connection = ReadingSessionStore(path, now: () => now);
    return StoredGuideSessions(connection!, now: () => now, random: () => 0.3);
  }

  try {
    final [
      partial as String,
      expectedPartial,
      complete as String,
      expectedComplete,
      archived as String,
      expectedArchived,
      unowned as String,
    ] = await runLegacyOracle(_legacyProgram, {
      ...oracleInput,
      'mode': 'fixtures',
    });
    var sessions = open();
    _same(
      expectedPartial,
      sessions.get(partial, _owner),
      'Node-written resumable chart',
    );
    _same(expectedArchived, sessions.get(archived, _owner), 'old saved report');
    await _fails(404, 'task_not_found', () => sessions.get(partial, _other));
    await _fails(404, 'task_not_found', () => sessions.get(partial, _guest));
    await _fails(404, 'task_not_found', () => connection!.get(partial, null));
    await _fails(
      401,
      'invalid_task_token',
      () => sessions.get('invalid', _owner),
    );
    _same('cast', connection!.get(unowned, null)['stage'], 'unbound token');

    final secondCard = sessions.pick(partial, _owner, cards[1]);
    _same([77, 0], secondCard['selectedSlots'], 'restored selection');
    sessions = open();
    _same(
      secondCard,
      sessions.pick(partial, _owner, cards[1]),
      'persisted Dart replay',
    );
    await _fails(
      409,
      'action_conflict',
      () => sessions.pick(
        partial,
        _owner,
        GuideCardEvent(
          actionId: cards[1].actionId,
          clockSessionId: cards[1].clockSessionId,
          step: 1,
          slot: 15,
          monotonicMs: 10,
          epochMs: cards[1].epochMs,
        ),
      ),
    );
    final dartCompleted = sessions.pick(partial, _owner, cards[2]);
    _same(
      expectedComplete,
      dartCompleted,
      'Dart completion of an old partial chart',
    );
    _same(
      expectedPartial,
      sessions.pick(partial, _owner, cards[0]),
      'persisted Node replay',
    );

    final dartStarted = sessions.start(
      owner: _owner,
      question: _question,
      focus: _focus,
    );
    for (final event in coins) {
      sessions.toss(dartStarted.token, _owner, event);
    }
    for (final event in cards) {
      sessions.pick(dartStarted.token, _owner, event);
    }
    final cycle = await runLegacyOracle(_legacyProgram, {
      ...oracleInput,
      'mode': 'read',
      'token': dartStarted.token,
    });
    _same(
      [expectedComplete, expectedPartial],
      cycle,
      'Node reads Dart-created rows',
    );
    final dartAuto = sessions.start(
      owner: _owner,
      question: _question,
      focus: _focus,
      automatic: true,
    );
    final autoRead = await runLegacyOracle(_legacyProgram, {
      ...oracleInput,
      'mode': 'read-auto',
      'token': dartAuto.token,
    });
    _same(
      [dartAuto.task],
      autoRead,
      'Node reads a Dart-created automatic chart',
    );
    sessions = open();
    _same(
      dartAuto.task,
      sessions.get(dartAuto.token, _owner),
      'Dart reloads its automatic chart',
    );

    await _fails(
      409,
      'follow_up_out_of_order',
      () => sessions.followUp(
        complete,
        _owner,
        step: 0,
        question: '下一步怎么判断？',
        requirePermission: () async {},
        model: null,
      ),
    );
    var permissions = 0;
    var requests = 0;
    var fail = true;
    final entered = Completer<void>();
    final release = Completer<void>();
    final model = StructuredModelClient(
      provider: ModelProvider.deepseek,
      apiKey: 'test',
      model: guideQuestionModel,
      transport: (_, _, body, _) async {
        requests++;
        final request = jsonDecode(body) as Map;
        final isPro = request['model'] == proModel;
        if (isPro && fail) {
          return (
            status: 200,
            body: '{"choices":[{"finish_reason":"length"}]}',
          );
        }
        if (isPro) {
          entered.complete();
          await release.future;
        }
        final output = isPro
            ? _report
            : {
                'schema_version': 'followup.v1',
                'answer': '可以等待对方给一个明确的安排。',
                'actions': ['约定反馈时间'],
                'evidence_ids': ['liuyao:v1:shi-ying'],
              };
        return (
          status: 200,
          body: jsonEncode({
            'choices': [
              {
                'finish_reason': 'stop',
                'message': {'content': jsonEncode(output)},
              },
            ],
          }),
        );
      },
    );
    Future<void> permit() async {
      permissions++;
    }

    await _fails(
      428,
      'ai_permission_required',
      () => sessions.report(
        partial,
        _owner,
        requirePermission: () async {
          throw const GuideRitualError(428, 'ai_permission_required');
        },
        model: model,
      ),
    );
    _same(0, requests, 'denied permission never calls provider');
    await _fails(
      502,
      'pro_model_invalid_output',
      () => sessions.report(
        partial,
        _owner,
        requirePermission: permit,
        model: model,
      ),
    );
    fail = false;
    final first = sessions.report(
      partial,
      _owner,
      requirePermission: permit,
      model: model,
    );
    await entered.future;
    final second = sessions.report(
      partial,
      _owner,
      requirePermission: permit,
      model: model,
    );
    final competitorStore = ReadingSessionStore(path, now: () => now);
    try {
      final competitor = StoredGuideSessions(competitorStore, now: () => now);
      await _fails(
        409,
        'comparison_in_progress',
        () => competitor.report(
          partial,
          _owner,
          requirePermission: permit,
          model: model,
        ),
      );
    } finally {
      competitorStore.close();
      release.complete();
    }
    final responses = await Future.wait([first, second]);
    _same(responses.first, responses.last, 'concurrent identical report');
    _same(2, requests, 'one provider call for the concurrent retry');
    _same(_report, responses.first['proReport'], 'successful report');
    sessions = open();
    final permissionBeforeCache = permissions;
    final cached = await sessions.report(
      partial,
      _owner,
      requirePermission: permit,
      model: null,
    );
    _same(responses.first, cached, 'report persisted across restart');
    _same(
      permissionBeforeCache,
      permissions,
      'cached reads use no model permission',
    );
    _same(
      'legacy-version',
      connection!.get(archived, _owner)['proReportVersion'],
      'old report version',
    );
    _same(
      {'imported': true},
      connection!.get(archived, _owner)['externalMetadata'],
      'old metadata preserved',
    );

    final withFollowUp = await sessions.followUp(
      partial,
      _owner,
      step: 0,
      question: '怎么确认进度？',
      requirePermission: permit,
      model: model,
    );
    _same(3, requests, 'follow-up provider call');
    _same(
      withFollowUp,
      await sessions.followUp(
        partial,
        _owner,
        step: 0,
        question: '怎么确认进度？',
        requirePermission: permit,
        model: null,
      ),
      'idempotent follow-up with provider offline',
    );
    _same(
      withFollowUp,
      open().get(partial, _owner),
      'follow-up survived restart',
    );

    try {
      connection!.change<void>(partial, _owner, (payload) {
        payload['question'] = 'corrupted';
        throw StateError('abort transaction');
      });
      throw StateError('Test callback should fail.');
    } on StateError catch (error) {
      if (error.message != 'abort transaction') rethrow;
    }
    _same(
      _question,
      connection!.get(partial, _owner)['question'],
      'rolled-back write',
    );
    final protected = connection!.create({'sample': 'other'}, _other);
    final protectedGuest = connection!.create({'sample': 'guest'}, _guest);
    connection!.eraseMember(
      _owner.id,
      legacyHashes: [_hash(unowned), _hash(protected)],
    );
    await _fails(404, 'task_not_found', () => connection!.get(partial, _owner));
    await _fails(404, 'task_not_found', () => connection!.get(unowned, null));
    await _fails(
      401,
      'account_session_required',
      () => connection!.create({'sample': 1}, _owner),
    );
    _same(
      'other',
      connection!.get(protected, _other)['sample'],
      'other member preserved',
    );
    _same(
      'guest',
      connection!.get(protectedGuest, _guest)['sample'],
      'same ID guest preserved',
    );

    now = now.add(readingLifetime);
    await _fails(
      404,
      'task_not_found',
      () => connection!.get(protected, _other),
    );
    connection!.clearExpired();
    final raw = sqlite3.open(path);
    try {
      _same(
        [],
        raw.select('SELECT token_hash FROM reading_session_owners').toList(),
        'cascade cleaned owner rows',
      );
    } finally {
      raw.close();
    }
    stdout.writeln(
      'SQLite contract passed: Node↔Dart resume and replay, ownership, report retry and deduplication, follow-up, rollback, erasure and expiry.',
    );
  } finally {
    connection?.close();
    for (final suffix in ['', '-wal', '-shm', '-journal']) {
      final file = File('$path$suffix');
      if (await file.exists()) await file.delete();
    }
    await temp.delete();
  }
}
