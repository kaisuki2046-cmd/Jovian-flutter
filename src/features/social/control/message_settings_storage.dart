import 'dart:io';

import 'package:path_provider/path_provider.dart';

Future<File> _settings(String key) async {
  final directory = await getApplicationSupportDirectory();
  return File('${directory.path}/$key.json');
}

Future<String?> readMessageSettings(String key) async {
  final file = await _settings(key);
  return await file.exists() ? file.readAsString() : null;
}

Future<void> writeMessageSettings(String key, String data) async {
  final file = await _settings(key);
  await file.parent.create(recursive: true);
  final staged = await File(
    '${file.path}.tmp',
  ).writeAsString(data, flush: true);
  await staged.rename(file.path);
}
