import 'dart:typed_data';

Future<Uint8List?> readAvatarDevice(String key) async => null;

Future<void> writeAvatarDevice(String key, Uint8List? bytes) async {
  if (bytes != null)
    throw UnsupportedError('Device photo storage unavailable.');
}
