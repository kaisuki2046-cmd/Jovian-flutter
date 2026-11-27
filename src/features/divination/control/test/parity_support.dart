import 'dart:convert';
import 'dart:io';

final legacyRepositoryRoot = Directory.fromUri(
  Platform.script.resolve('../../../../../'),
);

Future<List<Object?>> runLegacyOracle(String program, Object input) async {
  final legacy = await Process.start('node', [
    '--input-type=module',
    '-e',
    program,
  ], workingDirectory: legacyRepositoryRoot.path);
  final output = legacy.stdout.transform(utf8.decoder).join();
  final errors = legacy.stderr.transform(utf8.decoder).join();
  legacy.stdin.write(jsonEncode(input));
  await legacy.stdin.close();
  if (await legacy.exitCode != 0) {
    throw StateError('Legacy oracle failed: ${await errors}');
  }
  return (jsonDecode(await output) as List).cast<Object?>();
}

bool deepEquals(Object? left, Object? right) {
  if (left is List && right is List) {
    if (left.length != right.length) return false;
    for (var index = 0; index < left.length; index++) {
      if (!deepEquals(left[index], right[index])) return false;
    }
    return true;
  }
  if (left is Map && right is Map) {
    return left.length == right.length &&
        left.entries.every(
          (entry) =>
              right.containsKey(entry.key) &&
              deepEquals(entry.value, right[entry.key]),
        );
  }
  return left == right;
}

void expectRejected(void Function() read) {
  try {
    read();
  } on ArgumentError {
    return;
  }
  throw StateError('Invalid input was accepted');
}
