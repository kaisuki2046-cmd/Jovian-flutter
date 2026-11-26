import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:jovian_divination_server/jovian_divination_server.dart';

void _expect(bool value, String message) {
  if (!value) throw StateError(message);
}

Future<void> _expectFailure<E extends Object>(
  Future<Object?> Function() call,
  bool Function(E error) verify,
) async {
  try {
    await call();
  } on E catch (error) {
    if (verify(error)) return;
    throw StateError('Unexpected ${error.runtimeType}: $error');
  }
  throw StateError('The failed operation should have raised $E.');
}

Map<String, Object> _chat(String status, String content) => {
  'choices': [
    {
      'finish_reason': status,
      'message': {'content': content},
    },
  ],
};

Future<void> main() async {
  final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
  final tmp = await Directory.systemTemp.createTemp('jovian-model-contract-');
  final keyFile = File.fromUri(tmp.uri.resolve('key.txt'));
  final captured =
      <({String method, String? authorization, String? mime, Object? data})>[];
  final slowBody = Completer<void>();
  server.listen((request) async {
    final raw = await utf8.decoder.bind(request).join();
    captured.add((
      method: request.method,
      authorization: request.headers.value('Authorization'),
      mime: request.headers.contentType?.mimeType,
      data: jsonDecode(raw),
    ));
    final response = request.response..headers.contentType = ContentType.json;
    if (request.uri.path == '/slow') {
      response.write('{"choices":');
      await response.flush();
      slowBody.complete();
      await Future<void>.delayed(const Duration(milliseconds: 500));
      await response.close();
      return;
    }
    if (request.uri.path == '/rate-limit') {
      response.statusCode = 429;
      response.write('do not print the provider response');
    } else if (request.uri.path == '/bad-envelope') {
      response.write('sensitive text from provider');
    } else {
      final payload = switch (request.uri.path) {
        '/stop' => _chat(
          'stop',
          '{"intent":"ready","focus":"general","questions":[]}',
        ),
        '/incomplete' => _chat('length', '{"foo":'),
        '/empty' => _chat('stop', '  '),
        '/bad-json' => _chat('stop', '{"xxxxxxxxxx'),
        '/refusal' => {
          'status': 'completed',
          'output': [
            {
              'type': 'message',
              'role': 'assistant',
              'content': [
                {'type': 'refusal'},
              ],
            },
          ],
        },
        _ => throw StateError('Unexpected mock endpoint.'),
      };
      response.write(jsonEncode(payload));
    }
    await response.close();
  });

  StructuredModelClient client(
    String path, {
    ModelProvider provider = ModelProvider.deepseek,
  }) => StructuredModelClient(
    provider: provider,
    apiKey: 'local-fixture',
    model: provider == ModelProvider.deepseek
        ? guideQuestionModel
        : 'gpt-4.1-mini',
    transport: (endpoint, headers, body, timeout) {
      final actual = Uri(
        scheme: 'http',
        host: '127.0.0.1',
        port: server.port,
        path: path,
      );
      return sendModelHttp(actual, headers, body, timeout);
    },
  );

  try {
    const question = '这件事接下来怎么推进？';
    const previous = '想先了解现实条件。';
    final reply = await understandWithModel(
      question,
      client('/stop'),
      guide: true,
      previousQuestion: previous,
    );
    _expect(reply.clarification.isEmpty, 'valid response was rejected');
    final input = captured.first;
    _expect(
      input.method == 'POST' &&
          input.authorization == 'Bearer local-fixture' &&
          input.mime == 'application/json',
      'HTTP method or headers differ',
    );
    final messages = (input.data as Map)['messages'] as List;
    final payload =
        jsonDecode((messages[1] as Map)['content'] as String) as Map;
    _expect(
      payload['question'] == question &&
          payload['previousQuestion'] == previous,
      'the UTF-8 model input changed',
    );

    for (final (path, message) in [
      ('/incomplete', 'Output token limit reached'),
      ('/empty', 'Model returned empty content'),
      ('/bad-json', 'Model returned invalid JSON'),
    ]) {
      await _expectFailure<ModelOutputError>(
        () => understandWithModel(question, client(path), guide: true),
        (error) => error.message == message,
      );
    }
    await _expectFailure<ModelOutputError>(
      () => understandWithModel(
        question,
        client('/refusal', provider: ModelProvider.openai),
      ),
      (error) => error.message == 'Model declined.',
    );
    await _expectFailure<FormatException>(
      () => understandWithModel(question, client('/bad-envelope'), guide: true),
      (error) =>
          error.source == null && error.message == 'Invalid provider response.',
    );
    await _expectFailure<ModelHttpError>(
      () => understandWithModel(question, client('/rate-limit'), guide: true),
      (error) => error.status == 429 && error.toString() == 'Provider HTTP 429',
    );
    await _expectFailure<TimeoutException>(
      () => understandWithModel(
        question,
        client('/slow'),
        guide: true,
        timeout: const Duration(milliseconds: 300),
      ),
      (_) => slowBody.isCompleted,
    );

    keyFile.writeAsStringSync('fixture-from-file\n');
    final fromFile = configuredDivinationModel({
      'DEEPSEEK_API_KEY_FILE': keyFile.path,
    });
    _expect(
      fromFile?.provider == ModelProvider.deepseek &&
          fromFile?.model == guideQuestionModel,
      'the existing key-file configuration did not resolve',
    );
    keyFile.writeAsStringSync('one two');
    await _expectFailure<StateError>(
      () async =>
          configuredDivinationModel({'DEEPSEEK_API_KEY_FILE': keyFile.path}),
      (error) => error.message == 'DEEPSEEK_API_KEY_FILE must contain one key.',
    );
    final openai = configuredDivinationModel({
      'DIVINATION_OPENAI_API_KEY': 'openai-fixture',
      'DEEPSEEK_API_KEY_FILE': keyFile.path,
    });
    _expect(
      openai?.provider == ModelProvider.openai &&
          openai?.model == 'gpt-4.1-mini',
      'the existing provider priority changed',
    );
    _expect(
      configuredDivinationModel({}) == null,
      'missing key should disable the model',
    );

    stdout.writeln(
      'Dart model HTTP passed 8 loopback cases and 4 configuration cases.',
    );
  } finally {
    await server.close(force: true);
    if (await keyFile.exists()) await keyFile.delete();
    await tmp.delete();
  }
}
