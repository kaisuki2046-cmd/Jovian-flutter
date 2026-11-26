import 'dart:io';
import 'dart:typed_data';

import 'package:path_provider/path_provider.dart';

Future<File> _avatarFile(String key) async {
  final support = await getApplicationSupportDirectory();
  final slash = Platform.pathSeparator;
  return File('${support.path}${slash}jovian-profile$slash$key.png');
}

Future<Uint8List?> readAvatarDevice(String key) async {
  final file = await _avatarFile(key);
  try {
    if (await file.length() > 512 * 1024) return null;
    return await file.readAsBytes();
  } on PathNotFoundException {
    return null;
  }
}

Future<void> writeAvatarDevice(String key, Uint8List? bytes) async {
  final file = await _avatarFile(key);
  final temporary = File('${file.path}.new');
  if (bytes == null) {
    await _delete(file);
    await _delete(temporary);
    return;
  }
  await file.parent.create(recursive: true);
  try {
    await temporary.writeAsBytes(bytes, flush: true);
    await temporary.rename(file.path);
  } finally {
    await _delete(temporary);
  }
}

Future<void> _delete(File file) async {
  try {
    await file.delete();
  } on PathNotFoundException {
    // Repeated cleanup is safe even when the avatar directory is absent.
  }
}
