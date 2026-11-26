import 'dart:convert';
import 'dart:isolate';
import 'dart:typed_data';

import 'package:convert/convert.dart';
import 'package:pointycastle/key_derivators/api.dart' show ScryptParameters;
import 'package:pointycastle/key_derivators/scrypt.dart' show Scrypt;

import 'session_secret.dart';

typedef StoredPassword = ({String salt, String hash});

class PasswordsBusy implements Exception {
  const PasswordsBusy();
}

class AccountPasswords {
  final _unusedSalt = secureBytes(16);
  final _unusedHash = secureBytes(64);
  int _active = 0;

  Future<StoredPassword> hash(String password) async {
    final salt = secureBytes(16);
    final secret = await _deriveKey(password, salt);
    return (salt: hex.encode(salt), hash: hex.encode(secret));
  }

  Future<bool> verify(String password, StoredPassword? stored) async {
    final salt = stored == null ? _unusedSalt : hex.decode(stored.salt);
    final expected = stored == null ? _unusedHash : hex.decode(stored.hash);
    final actual = await _deriveKey(password, Uint8List.fromList(salt));
    return _equalDigest(actual, expected) && stored != null;
  }

  Future<Uint8List> _deriveKey(String password, Uint8List salt) async {
    if (_active >= 2) throw const PasswordsBusy();
    _active += 1;
    try {
      return await Isolate.run(() => _scrypt(password, salt));
    } finally {
      _active -= 1;
    }
  }
}

Uint8List _scrypt(String password, Uint8List salt) {
  final scrypt = Scrypt()..init(ScryptParameters(1 << 17, 8, 1, 64, salt));
  final input = Uint8List.fromList(utf8.encode(password));
  final digest = Uint8List(64);
  scrypt.deriveKey(input, 0, digest, 0);
  return digest;
}

bool _equalDigest(Uint8List actual, List<int> expected) {
  if (actual.length != expected.length) return false;
  var difference = 0;
  for (var index = 0; index < actual.length; index++) {
    difference |= actual[index] ^ expected[index];
  }
  return difference == 0;
}
