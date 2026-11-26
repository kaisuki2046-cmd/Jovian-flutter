import 'dart:convert';

import 'package:web/web.dart' as web;

String? readLegacyWebAppearance() => switch (_readLegacyPreferences()) {
  {'appearance': final String value}
      when const ['light', 'dark', 'system'].contains(value) =>
    value,
  _ => null,
};

String? readLegacyWebLanguage() => switch (_readLegacyPreferences()) {
  {'language': final String value} when const ['zh', 'en'].contains(value) =>
    value,
  _ => null,
};

Object? _readLegacyPreferences() {
  final stored = web.window.localStorage.getItem('jovian.preferences.v1');
  if (stored == null) return null;
  try {
    return jsonDecode(stored);
  } on FormatException {
    return null;
  }
}
