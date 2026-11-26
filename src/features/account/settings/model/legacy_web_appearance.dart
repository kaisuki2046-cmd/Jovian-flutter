import 'dart:convert';

import 'legacy_web_appearance_native.dart'
    if (dart.library.js_interop) 'legacy_web_appearance_web.dart'
    as platform;

typedef LegacyDevicePreferences = ({String? appearance, String? language});

Future<LegacyDevicePreferences?> readLegacyDevicePreferences() async {
  try {
    final stored = await platform.readLegacyPreferenceRecord();
    if (stored == null) return null;
    final data = jsonDecode(stored);
    if (data is! Map) return null;
    final appearance = data['appearance'];
    final language = data['language'];
    return (
      appearance: switch (appearance) {
        'light' || 'dark' || 'system' => appearance as String,
        _ => null,
      },
      language: switch (language) {
        'zh' || 'en' => language as String,
        _ => null,
      },
    );
  } on FormatException {
    return null;
  }
}
