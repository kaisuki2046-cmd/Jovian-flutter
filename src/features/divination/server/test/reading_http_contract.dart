import 'dart:convert';
import 'dart:io';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:jovian_divination_server/jovian_divination_server.dart';

import '../../control/test/parity_support.dart';

const _browserOrigin = 'http://localhost:8114';
const _native = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const _other = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const _browser = {'Origin': _browserOrigin, 'Cookie': 'session=primary'};
const _question = '这次面试后续会怎样？';
const _previous = '我该怎么准备这次面试？';
const _firstId = '00000000-0000-4000-8000-000000000001';
const _secondId = '00000000-0000-4000-8000-000000000002';
const _paragraph = {'text': '看对方是否**约定时间**。', 'detail': '判断已有安排和可观察的反馈。'};
const _overview = {'text': '综述 · 先确认反馈时间。'};
const _pro = {
  'tarot': [_paragraph, _paragraph, _paragraph, _overview],
  'meihua': [_paragraph, _paragraph, _overview],
  'liuyao': [_paragraph, _paragraph, _overview],
};
const _legacyOracle = r'''
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { createReadingTaskService } from './src/features/divination/server/reading-tasks.mjs';
registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL?.includes('/divination/') && /^\.\.?\//.test(specifier) && !/\.[a-z]+$/.test(specifier)) {
      return next(specifier + '.ts', context);
    }
    return next(specifier, context);
  },
});
const { parseSnapshot } = await import('./src/features/divination/requests/snapshot.ts');
const { question, time, wires } = JSON.parse(readFileSync(0, 'utf8'));
for (const snapshot of wires) parseSnapshot(snapshot);
const service = createReadingTaskService(':memory:', { now: () => time, random: () => 0.3 });
try {
  const local = await service.understandQuestion({question});
  const snapshots = [];
  for (const method of ['tarot', 'liuyao', 'meihua', 'combined']) {
    const {token, task} = service.start({method, question, focus: local.focus});
    const steps = [task];
    if (method === 'tarot' || method === 'combined') {
      steps.push(service.shuffle(token));
      steps.push(service.cut(token, {point: 39}));
      for (let step = 0; step < 3; step++) steps.push(service.pick(token, {step, slot: [8, 0, 4][step]}));
    }
    if (method === 'liuyao' || method === 'combined') {
      for (let step = 0; step < 6; step++) steps.push(service.toss(token, {step}));
    }
    if (method === 'meihua') steps.push(service.numbers(token, {numbers: [2, 7, 9]}));
    steps.push(await service.report(token));
    steps.push(await service.followUp(token, {step: 0, question: '为什么需要再确认？'}));
    snapshots.push(steps);
  }
  process.stdout.write(JSON.stringify([local, snapshots, wires.length]));
} finally {
  service.close();
}
''';

void _check(bool condition, String message) {
  if (!condition) throw StateError(message);
}

String _id(int suffix) =>
    '10000000-0000-4000-8000-${suffix.toString().padLeft(12, '0')}';

Future<void> main() async {
  final temp = await Directory.systemTemp.createTemp('jovian-http-reading-');
  final path = File.fromUri(temp.uri.resolve('reading.sqlite')).path;
  var clock = DateTime.utc(2026, 11, 20, 15);
  var permit = true;
  var modelCalls = 0;
  var failParser = false;
  final account = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  account.listen((request) async {
    final response = request.response..headers.contentType = ContentType.json;
    _check(
      request.uri.path == '/account/agreements/permission' &&
          request.uri.queryParameters['purpose'] ==
              'divination.cloud_assistance',
      'Incorrect account permission endpoint.',
    );
    final browser = request.headers.value('Cookie');
    final authorization = request.headers.value('Authorization');
    if (browser == 'session=primary' &&
            request.headers.value('Origin') == _browserOrigin ||
        authorization == 'Bearer $_native' ||
        authorization == 'Bearer $_other') {
      response.write(
        jsonEncode({
          'allowed': permit,
          'identity': {
            'kind': 'member',
            'id': authorization == 'Bearer $_other' ? _secondId : _firstId,
          },
        }),
      );
    } else {
      response.statusCode = 401;
    }
    await response.close();
  });

  final accountReader = AccountPermissionReader(
    Uri(scheme: 'http', host: '127.0.0.1', port: account.port),
  );
  final model = StructuredModelClient(
    provider: ModelProvider.deepseek,
    apiKey: 'fixture-key',
    model: guideQuestionModel,
    transport: (uri, _, body, _) async {
      modelCalls++;
      final request = jsonDecode(body) as Map;
      final Object result;
      if (uri.path == '/responses') {
        _check(failParser, 'Unexpected non-guide model request.');
        return (status: 503, body: '');
      }
      final messages = request['messages'] as List;
      final input =
          jsonDecode((messages[1] as Map)['content'] as String) as Map;
      if (request['model'] == proModel) {
        _check(
          input['question'] == _question &&
              input['previousQuestion'] == _previous,
          'Lost confirmed context.',
        );
        result = _pro;
      } else if (input['followup'] != null) {
        result = {
          'schema_version': 'followup.v1',
          'answer': '可以先确认对方是否安排了下一轮沟通。',
          'actions': ['确认沟通时间'],
          'evidence_ids': ['liuyao:v1:shi-ying'],
        };
      } else {
        result = {'intent': 'ready', 'focus': 'general', 'questions': []};
      }
      return (
        status: 200,
        body: jsonEncode({
          'choices': [
            {
              'finish_reason': 'stop',
              'message': {'content': jsonEncode(result)},
            },
          ],
        }),
      );
    },
  );

  ReadingHttpServer? server;
  final client = HttpClient();
  final wires = <GuideWire>[];
  Future<void> start({bool online = true}) async {
    await server?.close();
    server = await serveReading(
      databasePath: path,
      readPermission: accountReader.read,
      allowedOrigins: {_browserOrigin},
      port: 0,
      now: () => clock,
      random: () => 0.3,
      model: online ? model : null,
    );
  }

  Future<GuideWire> call(
    String endpoint, {
    Object? data,
    String? raw,
    String? method,
    String? token,
    int status = 200,
    Map<String, String> headers = _browser,
    String contentType = 'application/json',
    String? error,
  }) async {
    final payload = raw ?? (data == null ? null : jsonEncode(data));
    final request = await client.openUrl(
      method ?? (payload == null ? 'GET' : 'POST'),
      Uri.parse('http://127.0.0.1:${server!.port}$endpoint'),
    );
    headers.forEach(request.headers.set);
    if (token != null) request.headers.set('Authorization', 'Bearer $token');
    if (payload != null) {
      final bytes = utf8.encode(payload);
      request.headers.set('Content-Type', contentType);
      request.contentLength = bytes.length;
      request.add(bytes);
    }
    final response = await request.close();
    final text = await utf8.decoder.bind(response).join();
    _check(
      response.statusCode == status,
      '$endpoint expected HTTP $status, got ${response.statusCode}: $text',
    );
    final cors = response.headers.value('Access-Control-Allow-Origin');
    if (headers['Origin'] == _browserOrigin && headers['Host'] == null) {
      _check(cors == _browserOrigin, '$endpoint missing allowed origin.');
    }
    if (status == 204) {
      _check(
        response.headers
            .value('Access-Control-Allow-Headers')!
            .contains('X-Account-Session'),
        'Preflight lost native session header.',
      );
      return {};
    }
    _check(
      response.headers.value('Cache-Control') == 'no-store',
      'Sensitive response was cacheable.',
    );
    final result = (jsonDecode(text) as Map).cast<String, Object?>();
    if (error != null)
      _check(result['error'] == error, '$endpoint wrong error code.');
    if (result['stage'] != null && status == 200) wires.add(result);
    return result;
  }

  try {
    await start();
    await call('/reading/understand', method: 'OPTIONS', status: 204);
    await call(
      '/reading/understand',
      data: {},
      status: 403,
      headers: {'Origin': 'https://invalid.example'},
      error: 'origin_not_allowed',
    );
    await call(
      '/reading',
      status: 403,
      headers: {'Host': 'invalid.example'},
      error: 'host_not_allowed',
    );
    await call('/reading?x=1', status: 404, error: 'not_found');
    await call('/reading/toss', status: 405, error: 'method_not_allowed');
    await call(
      '/reading/understand',
      raw: '{',
      status: 400,
      error: 'invalid_json',
    );
    await call(
      '/reading/understand',
      raw: '{}',
      contentType: 'text/plain',
      status: 415,
      error: 'expected_json',
    );
    await call(
      '/reading/understand',
      raw: ' ' * (16 * 1024 * 1024 + 1),
      status: 413,
      error: 'body_too_large',
    );
    await call('/reading', status: 401, error: 'invalid_task_token');

    final input = {
      'question': _question,
      'previousQuestion': _previous,
      'requireModel': true,
    };
    permit = false;
    final beforePermission = modelCalls;
    await call(
      '/reading/understand',
      data: input,
      status: 428,
      error: 'ai_permission_required',
    );
    _check(
      modelCalls == beforePermission,
      'Unauthorized question reached model.',
    );
    permit = true;
    final approved = await call(
      '/reading/understand',
      data: input,
      headers: {'X-Account-Session': _native},
    );
    final body = {
      'question': _question,
      'previousQuestion': _previous,
      'focus': approved['focus'],
      'method': 'combined',
      'profile': guideVersion,
      'proof': approved['proof'],
    };
    await call(
      '/reading',
      data: {...body, 'previousQuestion': '临时改了问题背景。'},
      status: 400,
      error: 'question_needs_model_confirmation',
    );
    final opened = await call('/reading', data: body, status: 201);
    final token = opened['token'] as String;
    wires.add((opened['task'] as Map).cast());
    await call(
      '/reading',
      token: token,
      headers: {'X-Account-Session': _other},
      status: 404,
      error: 'task_not_found',
    );
    await call(
      '/reading',
      token: token,
      headers: {},
      status: 401,
      error: 'account_session_required',
    );
    await call(
      '/reading/report',
      token: token,
      data: {},
      status: 409,
      error: 'report_not_ready',
    );
    for (var step = 0; step < 6; step++) {
      await call(
        '/reading/toss',
        token: token,
        data: {'step': step, 'actionId': _id(step)},
      );
    }
    final draft = await call('/reading', token: token);
    final replayedToss = await call(
      '/reading/toss',
      token: token,
      data: {'step': 0, 'actionId': _id(0)},
    );
    _check(
      (replayedToss['tosses'] as List).length == 1,
      'Replay returned the wrong historical snapshot.',
    );
    await call(
      '/reading/toss',
      token: token,
      data: {'step': 1, 'actionId': _id(0)},
      status: 409,
      error: 'action_conflict',
    );
    _check(
      draft['slotCount'] == 78 &&
          draft['picking'] == null &&
          draft['draw'] == null,
      'Hidden card faces leaked.',
    );
    final times = ['9007199254740993', '1794528001003', '1794528002008'];
    GuideWire? finalPick;
    for (var step = 0; step < 3; step++) {
      finalPick = await call(
        '/reading/pick',
        token: token,
        data: {
          'actionId': _id(6 + step),
          'step': step,
          'slot': [77, 0, 35][step],
          'epochMs': times[step],
          'monotonicMs': 100 * step,
          'clockSessionId': _id(9),
        },
      );
    }
    _check(
      finalPick?['stage'] == 'reading' && finalPick?['chartHash'] is String,
      'Manual ritual did not finish.',
    );
    final report = await call('/reading/report', token: token, data: {});
    _check(deepEquals(report['proReport'], _pro), 'Pro report result changed.');
    final acceptedFollow = await call(
      '/reading/follow-up',
      token: token,
      data: {'step': 0, 'question': '怎么确认进度？'},
    );
    _check(
      (acceptedFollow['followUps'] as List).length == 1,
      'Follow-up did not save.',
    );
    clock = clock.add(const Duration(minutes: 11));
    await call(
      '/reading',
      data: body,
      status: 400,
      error: 'question_needs_model_confirmation',
    );
    final latest = await call('/reading/understand', data: input);
    final auto = await call(
      '/reading',
      status: 201,
      data: {...body, 'proof': latest['proof'], 'automatic': true},
    );
    final autoTask = (auto['task'] as Map).cast<String, Object?>();
    wires.add(autoTask);
    _check(
      autoTask['automatic'] == true && autoTask['stage'] == 'reading',
      'Automatic guide did not finish.',
    );

    await start(online: false);
    final resumed = await call('/reading/report', token: token, data: {});
    _check(
      deepEquals(resumed, acceptedFollow),
      'Restart changed the saved report.',
    );
    final local = await call(
      '/reading/understand',
      data: {'question': _question},
    );
    final legacy = <List<GuideWire>>[];
    for (final method in ['tarot', 'liuyao', 'meihua', 'combined']) {
      final started = await call(
        '/reading',
        status: 201,
        data: {
          'method': method,
          'question': _question,
          'focus': local['focus'],
        },
      );
      final session = started['token'] as String;
      final initial = (started['task'] as Map).cast<String, Object?>();
      wires.add(initial);
      final snapshots = [initial];
      if (method == 'tarot' || method == 'combined') {
        snapshots.add(await call('/reading/shuffle', token: session, data: {}));
        snapshots.add(
          await call('/reading/cut', token: session, data: {'point': 39}),
        );
        for (var step = 0; step < 3; step++) {
          snapshots.add(
            await call(
              '/reading/pick',
              token: session,
              data: {
                'step': step,
                'slot': [8, 0, 4][step],
              },
            ),
          );
        }
      }
      if (method == 'liuyao' || method == 'combined') {
        for (var step = 0; step < 6; step++) {
          snapshots.add(
            await call('/reading/toss', token: session, data: {'step': step}),
          );
        }
      }
      if (method == 'meihua') {
        snapshots.add(
          await call(
            '/reading/numbers',
            token: session,
            data: {
              'numbers': [2, 7, 9],
            },
          ),
        );
        await call(
          '/reading/numbers',
          token: session,
          data: {
            'numbers': [1, 7, 9],
          },
          status: 409,
          error: 'numbers_already_recorded',
        );
      }
      snapshots.add(await call('/reading/report', token: session, data: {}));
      snapshots.add(
        await call(
          '/reading/follow-up',
          token: session,
          data: {'step': 0, 'question': '为什么需要再确认？'},
        ),
      );
      legacy.add(snapshots);
      if (method == 'tarot')
        await _checkEarlyTarotArchive(path, clock, session, call);
    }

    final [
      expectedLocal,
      expectedLegacy as List,
      accepted as int,
    ] = await runLegacyOracle(_legacyOracle, {
      'question': _question,
      'time': clock.millisecondsSinceEpoch,
      'wires': wires,
    });
    _check(deepEquals(local, expectedLocal), 'Local understanding differs.');
    for (final (index, snapshots) in legacy.indexed) {
      final expected = expectedLegacy[index] as List;
      for (final (step, snapshot) in snapshots.indexed) {
        _check(
          deepEquals(snapshot, expected[step]),
          'Legacy method $index differs at step $step.',
        );
      }
    }
    await start();
    failParser = true;
    final fallback = await call(
      '/reading/understand',
      data: {'question': _question},
    );
    _check(
      deepEquals(fallback, local),
      'Legacy fallback lost local understanding.',
    );
    for (var index = 1; index < 30; index++) {
      await call('/reading/understand', data: {'question': '帮我算一下'});
    }
    await call(
      '/reading/understand',
      data: {'question': '帮我算一下'},
      status: 429,
      error: 'too_many_requests',
    );
    stdout.writeln(
      'Reading HTTP passed guide and legacy flows, permission and proof checks, restart, and $accepted responses parsed by the original client.',
    );
  } finally {
    client.close(force: true);
    await server?.close();
    await account.close(force: true);
    for (final suffix in ['', '-wal', '-shm', '-journal']) {
      final file = File('$path$suffix');
      if (await file.exists()) await file.delete();
    }
    await temp.delete();
  }
}

Future<void> _checkEarlyTarotArchive(
  String path,
  DateTime clock,
  String token,
  Future<GuideWire> Function(String endpoint, {String? token}) read,
) async {
  const owner = ReadingOwner(ReadingOwnerKind.member, _firstId);
  final database = ReadingSessionStore(path, now: () => clock);
  try {
    final raw = database.get(token, owner);
    const oldReport = {'source': 'model', 'answer': 'unverified legacy text'};
    final imported = database.create({
      for (final field in [
        'question',
        'focus',
        'stage',
        'cut',
        'picking',
        'draw',
      ])
        field: raw[field],
      'evidence': raw['documents'],
      'report': oldReport,
      'followUps': [
        {'question': '下一步做什么？', 'report': oldReport},
      ],
    }, owner);
    final restored = await read('/reading', token: imported);
    _check(
      deepEquals(restored['draw'], raw['draw']),
      'Early archive draw changed.',
    );
    _check(
      (restored['report'] as Map)['source'] == 'local' &&
          ((restored['followUps'] as List).first as Map)['question'] ==
              '下一步做什么？',
      'Early archived report was not restored.',
    );
    _check(
      !jsonEncode(restored).contains('unverified legacy text'),
      'Early archive returned stale model prose.',
    );
  } finally {
    database.close();
  }
}
