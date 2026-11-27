import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:path_provider/path_provider.dart';

import 'legacy_reading_archive_codec.dart';
import 'reading_history_codec.dart';
import 'reading_transcript_codec.dart';

const _historyPrefix = 'jovian.divination.flutter.v1.';
const _storage = FlutterSecureStorage();
const _legacyReading = MethodChannel('jovian/legacy_reading');
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

Future<List<String>> memberReadingTokens(
  String owner, {
  Future<Directory?> Function() legacyDirectory = _nativeLegacyDirectory,
}) => _withStorage(() async {
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
  final legacyOwner = legacyGuideOwner('member:$owner');
  if (legacyOwner != null) {
    final directory = await legacyDirectory();
    if (directory != null) {
      final files = _legacyFiles(directory, legacyOwner);
      for (final chat in await _legacyChatIds(files)) {
        final fields = await _legacyReadingCall('read', legacyOwner, chat);
        tokens.addAll(decodeLegacyGuideTokens(fields?['recovery']));
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
        suffix == guideTranscriptPositionSuffix ||
        isGuideTranscriptKey(suffix) ||
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
  final files = _legacyFiles(directory, legacyOwner);
  // Keep the chat index until every credential has been cleared so a retry
  // after a storage error still has all the original chat IDs.
  for (final chat in await _legacyChatIds(files)) {
    await _legacyReadingCall('clear', legacyOwner, chat);
  }
  for (final file in files) {
    try {
      await file.delete();
    } on PathNotFoundException {
      // Already deleted, or this device never ran the React Native app.
    }
  }
}

Future<Set<String>> _legacyChatIds(List<File> files) async {
  // RN can write recovery for the default chat before saving a transcript.
  final chats = {'original'};
  for (final file in files) {
    try {
      final raw = utf8.decode(await file.readAsBytes(), allowMalformed: true);
      chats.addAll(decodeLegacyGuideChatIds(raw));
    } on PathNotFoundException {
      // This account may only have one of the two history files.
    }
  }
  return chats;
}

Future<Map<String, String>?> _legacyReadingCall(
  String method,
  String owner,
  String chatId,
) async {
  try {
    return await _legacyReading.invokeMapMethod<String, String>(method, {
      'owner': owner,
      'chatId': chatId,
    });
  } on MissingPluginException {
    // Only Android and iOS have the original app's native SecureStore.
    return null;
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

List<File> _legacyFiles(Directory directory, String owner) => [
  _legacyFile(directory, owner, 'json'),
  _legacyFile(directory, owner, 'tmp'),
];

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
    implements
        GuideHistoryStore,
        LegacyGuideArchiveStore,
        LegacyGuideRecoveryStore,
        GuideTranscriptStore {
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
    return history.values.toList();
  });

  @override
  Future<List<LegacyGuideConversation>> readLegacyConversations() =>
      _withStorage(
        () async =>
            decodeLegacyGuideConversations(await _readLegacyHistory()).toList(),
      );

  @override
  Future<GuideRecovery?> readLegacyRecovery(String chatId, int messageId) =>
      _withStorage(() async {
        final owner = _legacyOwner;
        if (owner == null || !isGuideThreadId(chatId)) return null;
        try {
          final fields = await _legacyReadingCall('read', owner, chatId);
          return decodeLegacyGuideRecovery(
            fields?['recovery'],
            fields?['pending'],
            messageId,
          );
        } on PlatformException {
          return null;
        }
      });

  @override
  Future<void> writeHistory(GuideHistoryEntry entry) => _write(
    'history.${entry.id}',
    encodeGuideHistory(entry),
    keepOnError: false,
  );

  @override
  Future<List<GuideTranscriptTurn>> readTranscriptTurns() =>
      _withStorage(() async {
        final prefix = '$_prefix$guideTranscriptTurnPrefix';
        final turns = <GuideTranscriptTurn>[];
        try {
          for (final item in (await _storage.readAll()).entries) {
            if (!item.key.startsWith(prefix)) continue;
            final turn = decodeGuideTranscriptTurn(item.value);
            if (turn != null && item.key == '$prefix${turn.id}') {
              turns.add(turn);
            }
          }
        } catch (_) {
          // Keep the active conversation available in memory.
        }
        return turns;
      });

  @override
  Future<void> writeTranscriptTurn(GuideTranscriptTurn turn) => _write(
    '$guideTranscriptTurnPrefix${turn.id}',
    encodeGuideTranscriptTurn(turn),
    keepOnError: false,
  );

  @override
  Future<GuideTranscriptPosition?> readTranscriptPosition() async =>
      decodeGuideTranscriptPosition(await _read(guideTranscriptPositionSuffix));

  @override
  Future<void> writeTranscriptPosition(GuideTranscriptPosition? position) =>
      _write(
        guideTranscriptPositionSuffix,
        position == null ? null : encodeGuideTranscriptPosition(position),
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
