import 'dart:convert';
import 'dart:io';

import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:jovian_fortune_knowledge/jovian_fortune_knowledge.dart';

import '../lib/fortune_time.dart';

const _origin = 'http://localhost:8081';
const _options = '/fortune/advice/options';
const _optionIds = ['hetu-water', 'ling-colours-ziwei', 'houlding-capricorn'];
const _themes = {'element': '水', 'sign': '摩羯', 'lifeStar': '紫微'};

Future<void> main() async {
  final temporary = Directory.systemTemp.createTempSync(
    'jovian-fortune-advice-',
  );
  try {
    final manifest = File.fromUri(
      Platform.script.resolve('../../model/knowledge/fortune_knowledge.json'),
    );
    final path = ensureFortuneKnowledgeDatabase(
      manifest: manifest,
      directory: temporary,
    );
    final legacy = await _legacyResults(path);
    final catalog = openFortuneKnowledgeDatabase(path);
    final server = await serveFortuneTime(
      port: 0,
      webOrigin: _origin,
      knowledge: catalog,
    );
    final client = HttpClient();
    try {
      Future<Object?> request(
        String method,
        String route,
        int expectedStatus, {
        String? origin = _origin,
      }) async {
        final request = await client.openUrl(
          method,
          Uri.parse('http://127.0.0.1:${server.port}$route'),
        );
        if (origin != null) request.headers.set('origin', origin);
        final response = await request.close();
        final body = await utf8.decoder.bind(response).join();
        if (response.statusCode != expectedStatus ||
            response.headers.value('cache-control') != 'no-store') {
          throw StateError(
            '$method $route returned ${response.statusCode} $body',
          );
        }
        if (origin == _origin &&
            (response.headers.value('access-control-allow-origin') != _origin ||
                response.headers.value('access-control-allow-credentials') !=
                    'true')) {
          throw StateError('$method $route lost CORS headers');
        }
        if (method == 'OPTIONS' &&
            response.headers.value('access-control-allow-methods') != 'GET') {
          throw StateError('Unexpected preflight methods');
        }
        return body.isEmpty ? null : jsonDecode(body);
      }

      _equal(await request('GET', _options, 200), legacy['options'], 'options');
      _equal(
        [
          for (final id in _optionIds)
            await request('GET', '$_options/$id', 200, origin: null),
        ],
        legacy['selected'],
        'selected reports',
      );
      _equal(await request('GET', '$_options/unknown', 404), {
        'error': 'fortune_interpretation_failed',
      }, 'missing option');
      await request('GET', '$_options?unexpected=1', 400);
      await request('POST', _options, 405);
      await request('OPTIONS', _options, 204);
      await request('GET', _options, 403, origin: 'https://other.example');
      _equal(
        [
          for (final period in ['year', 'week'])
            buildFortuneNatalAdvice(
              calculationRunId: 'fixture-run',
              snapshotId: 'fixture-snapshot',
              periodType: period,
              themes: _themes,
              matchTheme: catalog.matchNatalAdvice,
            ),
        ],
        legacy['natal'],
        'natal advice and weekly restriction',
      );
    } finally {
      client.close(force: true);
      await server.close(force: true);
      catalog.close();
    }
  } finally {
    for (final file in temporary.listSync().whereType<File>()) {
      file.deleteSync();
    }
    temporary.deleteSync();
  }
  stdout.writeln(
    'Fortune advice HTTP routes, CORS, and report bodies match the legacy contract.',
  );
}

void _equal(Object? actual, Object? expected, String label) {
  if (jsonEncode(actual) != jsonEncode(expected))
    throw StateError('$label differs');
}

Future<FortuneJson> _legacyResults(String path) async {
  final root = Directory.fromUri(Platform.script.resolve('../../../../../'));
  final process = await Process.start('node', [
    '--input-type=module',
    '--eval',
    _legacyScript,
  ], workingDirectory: root.path);
  final output = utf8.decoder.bind(process.stdout).join();
  final errors = utf8.decoder.bind(process.stderr).join();
  process.stdin.add(
    utf8.encode(
      jsonEncode({'path': path, 'optionIds': _optionIds, 'themes': _themes}),
    ),
  );
  await process.stdin.close();
  if (await process.exitCode != 0) throw StateError(await errors);
  return jsonDecode(await output) as FortuneJson;
}

const _legacyScript = r'''
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { openFortuneKnowledgeDatabase } from './src/features/fortune/storage/knowledge/database.mjs';
const input = JSON.parse(readFileSync(0, 'utf8'));
registerHooks({ resolve(specifier, context, next) {
  return next(specifier === './knowledge/catalog' ? specifier + '.ts' : specifier, context);
}});
const { installFortuneKnowledgeReader, listFortuneAdviceOptions } =
  await import('./src/features/fortune/control/knowledge/catalog.ts');
const { buildFortuneAdvice, buildFortuneSelectedAdvice } =
  await import('./src/features/fortune/control/fortune-advice.ts');
const catalog = openFortuneKnowledgeDatabase(input.path);
try {
  installFortuneKnowledgeReader(catalog);
  process.stdout.write(JSON.stringify({
    options: listFortuneAdviceOptions(),
    selected: input.optionIds.map(buildFortuneSelectedAdvice),
    natal: ['year', 'week'].map(period => buildFortuneAdvice(
      'fixture-run', 'fixture-snapshot', period, input.themes,
    )),
  }));
} finally {
  catalog.close();
}
''';
