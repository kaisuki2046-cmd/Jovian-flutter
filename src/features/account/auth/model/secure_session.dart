import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'session.dart';

class SecureNativeSession implements NativeSessionStorage {
  const SecureNativeSession(this._key);

  final String _key;
  static const _storage = FlutterSecureStorage();

  @override
  Future<String?> read() => _storage.read(key: _key);

  @override
  Future<void> write(String? token) => token == null
      ? _storage.delete(key: _key)
      : _storage.write(key: _key, value: token);
}
