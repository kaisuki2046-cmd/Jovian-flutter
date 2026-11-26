import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:path_provider/path_provider.dart';

import 'legacy_reading_archive_codec.dart';
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

Future<void> clearMemberReadingData(
  String owner, {
  Future<Directory?> Function() legacyDirectory = _nativeLegacyDirectory,
}) => _withStorage(() async {
  await Future.wait([
    _clearFlutterMemberData(owner),
    _clearLegacyMemberData(owner, legacyDirectory),
  ]);
});

Future<void> _clearFlutterMemberData(String owner) async {
  final items = await _storage.readAll();
  final owned = items.keys.where((key) {
    final suffix = memberReadingKeySuffix(key, _historyPrefix, owner);
    return suffix == 'active' ||
        suffix == 'index' ||
        _isReadingKey(suffix, 'session.') ||
        _isReadingKey(suffix, 'history.');
  }).toList();
  await Future.wait(owned.map((key) => _storage.delete(key: key)));
}

Future<void> _clearLegacyMemberData(
  String owner,
  Future<Directory?> Function() legacyDirectory,
) async {
  final legacyOwner = legacyGuideOwner('member:$owner');
  if (legacyOwner == null) return;
  final directory = await legacyDirectory();
  if (directory == null) return;
  for (final extension in ['json', 'tmp']) {
    try {
      await _legacyFile(directory, legacyOwner, extension).delete();
    } on PathNotFoundException {
      // Already deleted, or this device never ran the React Native app.
    }
  }
}

Future<Directory?> _nativeLegacyDirectory() async {
  // Expo used Context.filesDir on Android and Documents on iOS.
  if (Platform.isAndroid) return getApplicationSupportDirectory();
  if (Platform.isIOS) return getApplicationDocumentsDirectory();
  return null;
}

File _legacyFile(Directory directory, String owner, String extension) => File(
  '${directory.path}${Platform.pathSeparator}$legacyGuideHistoryPrefix$owner.$extension',
);

bool _isReadingKey(String? suffix, String kind) =>
    suffix != null &&
    suffix.startsWith(kind) &&
    isGuideThreadId(suffix.substring(kind.length));

GuideRecoveryStore createReadingRecovery(
  Uri base, {
  String? ownerScope,
  Future<Directory?> Function() legacyDirectory = _nativeLegacyDirectory,
}) => ownerScope == null
    ? MemoryGuideRecovery()
    : _NativeReadingHistory(
        '$base.$ownerScope',
        legacyGuideOwner(ownerScope),
        legacyDirectory,
      );

class MemoryGuideRecovery implements GuideRecoveryStore {
  GuideRecovery? _value;

  @override
  Future<GuideRecovery?> read() async => _value;

  @override
  Future<void> write(GuideRecovery? recovery) async => _value = recovery;
}

class _NativeReadingHistory
    implements GuideHistoryStore, LegacyGuideArchiveStore {
  _NativeReadingHistory(
    String namespace,
    this._legacyOwner,
    this._legacyDirectory,
  ) : _prefix = '$_historyPrefix$namespace.';

  final String _prefix;
  final String? _legacyOwner;
  final Future<Directory?> Function() _legacyDirectory;

  Future<String?> _readLegacyHistory() async {
    final owner = _legacyOwner;
    if (owner == null) return null;
    try {
      final directory = await _legacyDirectory();
      return directory == null
          ? null
          : await _legacyFile(directory, owner, 'json').readAsString();
    } catch (_) {
      // Missing or unreadable legacy files leave Flutter history available.
      return null;
    }
  }

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
    final history = <String, GuideHistoryEntry>{};
    try {
      for (final item in (await _storage.readAll()).entries) {
        if (!item.key.startsWith(prefix)) continue;
        final entry = decodeGuideHistory(item.value);
        if (entry != null && item.key == '$prefix${entry.id}') {
          history[entry.id] = entry;
        }
      }
    } catch (_) {
      // Older reports may still be available in the legacy file.
    }
    for (final entry in decodeLegacyGuideHistory(await _readLegacyHistory())) {
      history.putIfAbsent(entry.id, () => entry);
    }
    return history.values.toList();
  });

  @override
  Future<List<LegacyGuideArchive>> readLegacyArchives() => _withStorage(
    () async => decodeLegacyGuideArchives(await _readLegacyHistory()).toList(),
  );

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
