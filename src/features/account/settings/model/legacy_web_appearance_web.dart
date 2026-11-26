import 'package:web/web.dart' as web;

Future<String?> readLegacyPreferenceRecord() async =>
    web.window.localStorage.getItem('jovian.preferences.v1');
