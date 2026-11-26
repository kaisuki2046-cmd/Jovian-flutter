import 'dart:convert';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:web/web.dart' as web;

import 'reading_history_codec.dart';

const _activePrefix = 'jovian.divination.active.v2.';
const _historyPrefix = 'jovian.divination.flutter-history.v1.';
const _legacyHistoryPrefix = 'jovian.divination.history.v2.';
const _legacyRecoveryPrefix = 'jovian.divination.recovery.v2.';
const _legacyPendingPrefix = 'jovian.divination.pending-ritual.v2.';

String? _rnOwner(String? scope) {
  if (scope == null) return null;
  final separator = scope.indexOf(':');
  if (separator <= 0 || separator == scope.length - 1) return null;
  final kind = scope.substring(0, separator);
  if (kind != 'member' && kind != 'guest') return null;
  final id = scope.substring(separator + 1);
  return '$kind.${id.runes.map((rune) => rune.toRadixString(16)).join('_')}';
}

List<String> _storageKeys(web.Storage storage) => [
  for (var index = 0; index < storage.length; index++)
    if (storage.key(index) case final key?) key,
];

bool _isActiveKey(String key, String owner) {
  final suffix = memberReadingKeySuffix(key, _activePrefix, owner);
  return suffix != null && (suffix.isEmpty || isGuideThreadId(suffix));
}

Future<List<String>> memberReadingTokens(String owner) async {
  final legacyOwner = _rnOwner('member:$owner');
  final recoveries = web.window.sessionStorage;
  final result = <String>{};
  for (final key in _storageKeys(recoveries)) {
    if (_isActiveKey(key, owner)) {
      if (decodeGuideRecovery(recoveries.getItem(key)) case final recovery?) {
        result.add(recovery.token);
      }
    } else if (legacyOwner != null &&
        key.startsWith('$_legacyRecoveryPrefix$legacyOwner.')) {
      try {
        if (jsonDecode(recoveries.getItem(key) ?? 'null') case {
          'tokens': final Map tokens,
        }) {
          result.addAll(tokens.values.whereType<String>());
        }
      } on FormatException {
        // The deletion still removes an unreadable recovery entry.
      }
    }
  }
  return result.toList();
}

Future<void> clearMemberReadingData(String owner) async {
  final legacyOwner = _rnOwner('member:$owner');
  final history = web.window.localStorage;
  final recoveries = web.window.sessionStorage;
  for (final key in _storageKeys(history)) {
    final suffix = memberReadingKeySuffix(key, _historyPrefix, owner);
    if ((suffix != null && isGuideThreadId(suffix)) ||
        (legacyOwner != null && key == '$_legacyHistoryPrefix$legacyOwner')) {
      history.removeItem(key);
    }
  }
  for (final key in _storageKeys(recoveries)) {
    if (_isActiveKey(key, owner) ||
        (legacyOwner != null &&
            (key.startsWith('$_legacyRecoveryPrefix$legacyOwner.') ||
                key.startsWith('$_legacyPendingPrefix$legacyOwner.')))) {
      recoveries.removeItem(key);
    }
  }
}

GuideRecoveryStore createReadingRecovery(Uri base, {String? ownerScope}) =>
    _BrowserReadingRecovery(base, ownerScope);

class _BrowserReadingRecovery implements GuideHistoryStore {
  _BrowserReadingRecovery(Uri base, String? ownerScope)
    : _ownerScope = ownerScope,
      _key = ownerScope == null
          ? 'jovian.divination.active.v1.$base'
          : '$_activePrefix$base.$ownerScope',
      _historyKey = '$_historyPrefix$base.$ownerScope.',
      _legacyOwner = _rnOwner(ownerScope);

  final String? _ownerScope;
  final String _key;
  final String _historyKey;
  final String? _legacyOwner;
  GuideRecovery? _memory;
  final _threads = <String, GuideRecovery?>{};

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

  @override
  Future<List<GuideHistoryEntry>> readHistory() async {
    if (_ownerScope == null) return const [];
    final entries = <String, GuideHistoryEntry>{};
    try {
      final storage = web.window.localStorage;
      for (var index = 0; index < storage.length; index++) {
        final key = storage.key(index);
        if (key != null && key.startsWith(_historyKey)) {
          final entry = decodeGuideHistory(storage.getItem(key));
          if (entry != null && key == '$_historyKey${entry.id}')
            entries[entry.id] = entry;
        }
      }
      if (_legacyOwner case final owner?) {
        for (final entry in _readRnHistory(
          storage.getItem('$_legacyHistoryPrefix$owner'),
        )) {
          entries.putIfAbsent(entry.id, () => entry);
        }
      }
    } catch (_) {
      // The current controller still has the conversations it has seen.
    }
    return entries.values.toList();
  }

  @override
  Future<void> writeHistory(GuideHistoryEntry entry) async {
    if (_ownerScope == null) return;
    try {
      web.window.localStorage.setItem(
        '$_historyKey${entry.id}',
        encodeGuideHistory(entry),
      );
    } catch (_) {
      // Keep the entry in memory when this origin's storage is unavailable.
    }
  }

  @override
  Future<GuideRecovery?> readThread(String id) async {
    try {
      final text = web.window.sessionStorage.getItem('$_key.$id');
      if (text != null) return decodeGuideRecovery(text);
    } catch (_) {
      // The memory copy applies only to this controller and owner.
    }
    return _threads[id];
  }

  @override
  Future<void> writeThread(String id, GuideRecovery? recovery) async {
    _threads[id] = recovery;
    if (_ownerScope == null) return;
    try {
      if (recovery == null) {
        web.window.sessionStorage.removeItem('$_key.$id');
      } else {
        web.window.sessionStorage.setItem(
          '$_key.$id',
          jsonEncode(recovery.toJson()),
        );
      }
    } catch (_) {
      // Never put a bearer token into persistent browser local storage.
    }
  }
}

Iterable<GuideHistoryEntry> _readRnHistory(String? text) sync* {
  if (text == null) return;
  final value = jsonDecode(text);
  if (value case {'threads': final List threads}) {
    for (final thread in threads) {
      if (thread case {
        'id': final String chatId,
        'updatedAt': final int updatedAt,
        'messages': final List messages,
      } when isGuideThreadId(chatId)) {
        for (final message in messages) {
          if (message case {
            'id': final int messageId,
            'kind': 'readingSession',
            'snapshot': final Map<String, Object?> snapshot,
          } when snapshot['ruleVersion'] == guideVersion) {
            final id = 'rn-$chatId-$messageId';
            final sentAt = message['sentAt'];
            final entry = decodeGuideHistory(
              jsonEncode({
                'id': id,
                'reading': snapshot,
                'updatedAt': sentAt is int ? sentAt : updatedAt,
              }),
            );
            if (entry != null) yield entry;
          }
        }
      }
    }
  }
}
