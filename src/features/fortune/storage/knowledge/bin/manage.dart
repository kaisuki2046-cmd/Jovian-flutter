import 'dart:convert';
import 'dart:io';

import 'package:jovian_fortune_knowledge/jovian_fortune_knowledge.dart';

void main(List<String> arguments) {
  if (arguments.length > 2) {
    stderr.writeln(
      'Usage: dart run bin/manage.dart [manifest.json] [cache-directory]',
    );
    exitCode = 64;
    return;
  }
  final manifest = arguments.isEmpty
      ? File.fromUri(
          Platform.script.resolve(
            '../../../model/knowledge/fortune_knowledge.json',
          ),
        )
      : File(arguments.first);
  final directory = arguments.length < 2
      ? Directory.fromUri(Platform.script.resolve('../.local/'))
      : Directory(arguments[1]);
  final path = ensureFortuneKnowledgeDatabase(
    manifest: manifest,
    directory: directory,
  );
  final catalog = openFortuneKnowledgeDatabase(path);
  try {
    stdout.writeln(
      const JsonEncoder.withIndent('  ').convert({
        'database': path,
        'catalog': catalog.status(),
        'advice': catalog.adviceCoverage(),
      }),
    );
  } finally {
    catalog.close();
  }
}
