import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'legacy_android_profile.dart';

const _storage = FlutterSecureStorage();

Future<String?> readProfileDetailsDevice(String key) async =>
    await _storage.read(key: key) ?? await readLegacyAndroidProfile(key);

Future<void> writeProfileDetailsDevice(String key, String? value) async {
  if (value == null) {
    await clearLegacyAndroidProfile(key);
    await _storage.delete(key: key);
  } else {
    await _storage.write(key: key, value: value);
  }
}
