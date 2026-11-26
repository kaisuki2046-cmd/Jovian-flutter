import 'package:flutter/foundation.dart';

const _loopback = {'localhost', '127.0.0.1', '::1'};

Uri? serviceEndpoint(String value, String setting) {
  final input = value.trim();
  if (input.isEmpty) return null;
  final base = kIsWeb ? Uri.base.resolve(input) : Uri.parse(input);
  if (base.host.isEmpty ||
      base.userInfo.isNotEmpty ||
      base.hasQuery ||
      base.hasFragment ||
      (base.scheme != 'https' && base.scheme != 'http')) {
    throw FormatException('Invalid $setting.');
  }
  if (kIsWeb &&
      _loopback.contains(base.host) &&
      _loopback.contains(Uri.base.host)) {
    return base.replace(host: Uri.base.host);
  }
  return base;
}
