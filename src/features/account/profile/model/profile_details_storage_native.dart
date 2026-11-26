import 'package:flutter_secure_storage/flutter_secure_storage.dart';

const _storage = FlutterSecureStorage();

Future<String?> readProfileDetailsDevice(String key) => _storage.read(key: key);

Future<void> writeProfileDetailsDevice(String key, String? value) =>
    value == null
    ? _storage.delete(key: key)
    : _storage.write(key: key, value: value);
