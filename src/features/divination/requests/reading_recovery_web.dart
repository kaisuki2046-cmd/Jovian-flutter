import 'dart:convert';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:web/web.dart' as web;

GuideRecoveryStore createReadingRecovery(Uri base, {String? ownerScope}) =>
    _BrowserReadingRecovery(base, ownerScope);

class _BrowserReadingRecovery implements GuideRecoveryStore {
  _BrowserReadingRecovery(Uri base, String? ownerScope)
    : _key = ownerScope == null
          ? 'jovian.divination.active.v1.$base'
          : 'jovian.divination.active.v2.$base.$ownerScope';

  final String _key;
  GuideRecovery? _memory;

  @override
  Future<GuideRecovery?> read() async {
    try {
      final text = web.window.sessionStorage.getItem(_key);
      if (text == null) return _memory;
      final value = jsonDecode(text);
      if (value is! Map<String, Object?>) throw const FormatException();
      return GuideRecovery.fromJson(value);
    } on FormatException {
      await write(null);
      return null;
    } catch (_) {
      // Browser storage may be disabled; the current tab can still use its session.
      return _memory;
    }
  }

  @override
  Future<void> write(GuideRecovery? recovery) async {
    _memory = recovery;
    try {
      final storage = web.window.sessionStorage;
      if (recovery == null) {
        storage.removeItem(_key);
      } else {
        storage.setItem(_key, jsonEncode(recovery.toJson()));
      }
    } catch (_) {
      // The in-memory copy covers updates when browser storage is unavailable.
    }
  }
}
