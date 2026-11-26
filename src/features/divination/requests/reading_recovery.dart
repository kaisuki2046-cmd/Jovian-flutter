import 'dart:async';
import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jovian_divination/jovian_divination.dart';

import 'reading_history_codec.dart';

const _historyPrefix = 'jovian.divination.flutter.v1.';
const _storage = FlutterSecureStorage();
Future<void>? _storageWork;

Future<T> _withStorage<T>(Future<T> Function() action) async {
  final previous = _storageWork;
  final done = Completer<void>();
  _storageWork = done.future;
  try {
    if (previous != null) await previous;
    return await action();
  } finally {
    if (identical(_storageWork, done.future)) _storageWork = null;
    done.complete();
  }
}

Future<List<String>> memberReadingTokens(String owner) =>
    _withStorage(() async {
      final items = await _storage.readAll();
      final tokens = <String>{};
      for (final entry in items.entries) {
        final suffix = memberReadingKeySuffix(entry.key, _historyPrefix, owner);
        if (suffix == 'active' || _isReadingKey(suffix, 'session.')) {
          if (decodeGuideRecovery(entry.value) case final recovery?) {
            tokens.add(recovery.token);
          }
        }
      }
      return tokens.toList();
    });

Future<void> clearMemberReadingData(String owner) => _withStorage(() async {
  final items = await _storage.readAll();
  final owned = items.keys.where((key) {
    final suffix = memberReadingKeySuffix(key, _historyPrefix, owner);
    return suffix == 'active' ||
        suffix == 'index' ||
        _isReadingKey(suffix, 'session.') ||
        _isReadingKey(suffix, 'history.');
  }).toList();
  await Future.wait(owned.map((key) => _storage.delete(key: key)));
});

bool _isReadingKey(String? suffix, String kind) =>
    suffix != null &&
    suffix.startsWith(kind) &&
    isGuideThreadId(suffix.substring(kind.length));

GuideRecoveryStore createReadingRecovery(Uri base, {String? ownerScope}) =>
    ownerScope == null
    ? MemoryGuideRecovery()
    : _NativeReadingHistory('$base.$ownerScope');

class MemoryGuideRecovery implements GuideRecoveryStore {
  GuideRecovery? _value;

  @override
  Future<GuideRecovery?> read() async => _value;

  @override
  Future<void> write(GuideRecovery? recovery) async => _value = recovery;
}

class _NativeReadingHistory implements GuideHistoryStore {
  _NativeReadingHistory(String namespace)
    : _prefix = '$_historyPrefix$namespace.';

  final String _prefix;
  final _memory = <String, String?>{};

  Future<String?> _read(String suffix) => _withStorage(() async {
    if (_memory.containsKey(suffix)) return _memory[suffix];
    try {
      return await _storage.read(key: '$_prefix$suffix');
    } catch (_) {
      return null;
    }
  });

  Future<void> _write(String suffix, String? data, {bool keepOnError = true}) =>
      _withStorage(() async {
        try {
          final key = '$_prefix$suffix';
          if (data == null) {
            await _storage.delete(key: key);
          } else {
            await _storage.write(key: key, value: data);
          }
          _memory.remove(suffix);
        } catch (_) {
          if (keepOnError) _memory[suffix] = data;
        }
      });

  @override
  Future<GuideRecovery?> read() async =>
      decodeGuideRecovery(await _read('active'));

  @override
  Future<void> write(GuideRecovery? recovery) =>
      _write('active', recovery == null ? null : jsonEncode(recovery.toJson()));

  @override
  Future<List<GuideHistoryEntry>> readHistory() => _withStorage(() async {
    final prefix = '${_prefix}history.';
    final Map<String, String> stored;
    try {
      stored = await _storage.readAll();
    } catch (_) {
      // The current controller can still show its in-memory conversations.
      return [];
    }
    final history = <GuideHistoryEntry>[];
    for (final item in stored.entries) {
      if (!item.key.startsWith(prefix)) continue;
      final entry = decodeGuideHistory(item.value);
      if (entry != null && item.key == '$prefix${entry.id}') {
        history.add(entry);
      }
    }
    return history;
  });

  @override
  Future<void> writeHistory(GuideHistoryEntry entry) => _write(
    'history.${entry.id}',
    encodeGuideHistory(entry),
    keepOnError: false,
  );

  @override
  Future<GuideRecovery?> readThread(String id) async =>
      decodeGuideRecovery(await _read('session.$id'));

  @override
  Future<void> writeThread(String id, GuideRecovery? recovery) => _write(
    'session.$id',
    recovery == null ? null : jsonEncode(recovery.toJson()),
  );
}
