import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';

const accountSessionTTL = Duration(days: 7);
final _tokenPattern = RegExp(r'^[A-Za-z0-9_-]{43}$');
final _random = Random.secure();

Uint8List secureBytes(int count) =>
    Uint8List.fromList(List.generate(count, (_) => _random.nextInt(256)));

String createSessionSecret() =>
    base64Url.encode(secureBytes(32)).replaceAll('=', '');

String? sessionHash(String? token) {
  if (token == null || token.length != 43 || !_tokenPattern.hasMatch(token)) {
    return null;
  }
  return sha256.convert(utf8.encode(token)).toString();
}
