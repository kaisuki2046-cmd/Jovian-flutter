import 'dart:convert';
import 'dart:io';

import 'package:jovian_compliance_server/jovian_compliance_server.dart';

Future<void> main() async {
  final root = Platform.script.resolve('../../../../../').toFilePath();
  final legacy = await Process.run(
    'node',
    [
      '--input-type=module',
      '--eval',
      '''
import { createAgreementCatalog } from './src/features/compliance/server-entry.mjs';
process.stdout.write(JSON.stringify(createAgreementCatalog()));
''',
    ],
    workingDirectory: root,
    stdoutEncoding: utf8,
    stderrEncoding: utf8,
  );
  if (legacy.exitCode != 0)
    throw StateError('Legacy catalog failed: ${legacy.stderr}');
  final catalog = createAgreementCatalog();
  if (jsonEncode(catalog.map((entry) => entry.toJson()).toList()) !=
      legacy.stdout) {
    throw StateError(
      'Agreement preview or digest differs from the legacy catalog.',
    );
  }
  final published = {
    for (final entry in catalog)
      entry.id: {
        'version': '1.0.0',
        'title': entry.title,
        'sections': [
          {'title': '测试用协议条目', 'text': '只用于接口对照。'},
        ],
      },
  };
  if (!createAgreementCatalog(
    published: published,
  ).every((entry) => entry.published)) {
    throw StateError('A valid versioned fixture was not accepted.');
  }
  for (final invalid in [
    {
      ...published,
      'privacy': {...published['privacy']!, 'version': '1.0-draft'},
    },
    {
      ...published,
      'terms': {...published['terms']!, 'title': '【待填公司名称】'},
    },
    {
      ...published,
      'ai': {...published['ai']!, 'sections': []},
    },
  ]) {
    try {
      createAgreementCatalog(published: invalid);
      throw StateError('An incomplete published agreement was accepted.');
    } on FormatException {
      continue;
    }
  }
  stdout.writeln(
    'All three preview agreements match Node documents and SHA-256 digests.',
  );
}
