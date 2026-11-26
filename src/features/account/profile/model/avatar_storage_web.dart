import 'dart:typed_data';

import 'package:web/web.dart' as web;

Future<Uint8List?> readAvatarDevice(String key) async {
  final value = web.window.localStorage.getItem(key);
  if (value == null || value.length > 768 * 1024) return null;
  try {
    final data = UriData.parse(value);
    if (!data.isBase64 ||
        !const {
          'image/jpeg',
          'image/png',
          'image/webp',
        }.contains(data.mimeType))
      return null;
    return data.contentAsBytes();
  } on FormatException {
    return null;
  }
}

Future<void> writeAvatarDevice(String key, Uint8List? bytes) async {
  final storage = web.window.localStorage;
  if (bytes == null) {
    storage.removeItem(key);
  } else {
    storage.setItem(
      key,
      UriData.fromBytes(bytes, mimeType: 'image/png').toString(),
    );
  }
}
