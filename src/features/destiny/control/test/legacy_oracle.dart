import 'dart:convert';
import 'dart:io';

Future<List<Object?>> runLegacyOracle(String program, Object input) async {
  final root = Platform.script.resolve('../../../../../backend/');
  final process = await Process.start('node', [
    '--input-type=module',
    '--eval',
    program,
  ], workingDirectory: root.toFilePath());
  final output = utf8.decoder.bind(process.stdout).join();
  final errors = utf8.decoder.bind(process.stderr).join();
  process.stdin.encoding = utf8;
  process.stdin.write(jsonEncode(input));
  await process.stdin.close();
  final code = await process.exitCode;
  if (code != 0)
    throw StateError('Legacy oracle failed ($code): ${await errors}');
  return jsonDecode(await output) as List<Object?>;
}
