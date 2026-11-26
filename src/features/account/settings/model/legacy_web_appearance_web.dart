import 'dart:convert';

import 'package:web/web.dart' as web;

String? readLegacyWebAppearance() {
  final stored = web.window.localStorage.getItem('jovian.preferences.v1');
  if (stored == null) return null;
  try {
    return switch (jsonDecode(stored)) {
      {'appearance': final String appearance}
          when const ['light', 'dark', 'system'].contains(appearance) =>
        appearance,
      _ => null,
    };
  } on FormatException {
    return null;
  }
}
