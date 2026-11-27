import 'dart:convert';

import 'package:jovian_divination/jovian_divination.dart';
import 'package:web/web.dart' as web;

import 'legacy_reading_archive_codec.dart';
import 'reading_history_codec.dart';
import 'reading_transcript_codec.dart';

const _activePrefix = 'jovian.divination.active.v2.';
const _historyPrefix = 'jovian.divination.flutter-history.v1.';
const _legacyRecoveryPrefix = 'jovian.divination.recovery.v2.';
const _legacyPendingPrefix = 'jovian.divination.pending-ritual.v2.';
const _loopbackHosts = {'localhost', '127.0.0.1', '::1'};

Uri _historyEndpoint(Uri base) => _loopbackHosts.contains(base.host)
    ? base.replace(port: base.scheme == 'https' ? 443 : 80)
    : base;

List<String> _storageKeys(web.Storage storage) => [
  for (var index = 0; index < storage.length; index++)
    if (storage.key(index) case final key?) key,
];

bool _isActiveKey(String key, String owner) {
  final suffix = memberReadingKeySuffix(key, _activePrefix, owner);
  return suffix != null && (suffix.isEmpty || isGuideThreadId(suffix));
}

Future<List<String>> memberReadingTokens(String owner) async {
  final legacyOwner = legacyGuideOwner('member:$owner');
  final recoveries = web.window.sessionStorage;
  final result = <String>{};
  for (final key in _storageKeys(recoveries)) {
    if (_isActiveKey(key, owner)) {
      if (decodeGuideRecovery(recoveries.getItem(key)) case final recovery?) {
        result.add(recovery.token);
      }
    } else if (legacyOwner != null &&
        key.startsWith('$_legacyRecoveryPrefix$legacyOwner.')) {
      result.addAll(decodeLegacyGuideTokens(recoveries.getItem(key)));
    }
  }
  return result.toList();
}

Future<void> clearMemberReadingData(String owner) async {
  final legacyOwner = legacyGuideOwner('member:$owner');
  final history = web.window.localStorage;
  final recoveries = web.window.sessionStorage;
  for (final key in _storageKeys(history)) {
    final suffix = memberReadingKeySuffix(key, _historyPrefix, owner);
    if ((suffix != null && isGuideThreadId(suffix)) ||
        isGuideTranscriptKey(suffix) ||
        (legacyOwner != null &&
            key == '$legacyGuideHistoryPrefix$legacyOwner')) {
      history.removeItem(key);
    }
  }
  for (final key in _storageKeys(recoveries)) {
    if (_isActiveKey(key, owner) ||
        memberReadingKeySuffix(key, _activePrefix, owner) ==
            guideTranscriptPositionSuffix ||
        (legacyOwner != null &&
            (key.startsWith('$_legacyRecoveryPrefix$legacyOwner.') ||
                key.startsWith('$_legacyPendingPrefix$legacyOwner.')))) {
      recoveries.removeItem(key);
    }
  }
}

GuideRecoveryStore createReadingRecovery(Uri base, {String? ownerScope}) =>
    _BrowserReadingRecovery(base, ownerScope);

class _BrowserReadingRecovery
    implements
        GuideHistoryStore,
        LegacyGuideArchiveStore,
        LegacyGuideRecoveryStore,
        GuideTranscriptStore {
  _BrowserReadingRecovery(Uri base, String? ownerScope)
    : _ownerScope = ownerScope,
      _key = ownerScope == null
          ? 'jovian.divination.active.v1.$base'
          : '$_activePrefix$base.$ownerScope',
      _historyBase = _historyEndpoint(base),
      _legacyOwner = legacyGuideOwner(ownerScope);

  final String? _ownerScope;
  final String _key;
  final Uri _historyBase;
  final String? _legacyOwner;
  GuideRecovery? _memory;
  GuideTranscriptPosition? _memoryPosition;
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

  String get _historyKey => '$_historyPrefix$_historyBase.$_ownerScope.';

  String? _historySuffix(String key) {
    if (key.startsWith(_historyKey)) return key.substring(_historyKey.length);
    if (!_loopbackHosts.contains(_historyBase.host) ||
        !key.startsWith(_historyPrefix)) {
      return null;
    }
    // Existing local history included the dynamically allocated service port.
    final ownerMarker = '.$_ownerScope.';
    final ownerIndex = key.lastIndexOf(ownerMarker);
    if (ownerIndex < _historyPrefix.length) return null;
    final previous = Uri.tryParse(
      key.substring(_historyPrefix.length, ownerIndex),
    );
    if (previous == null || _historyEndpoint(previous) != _historyBase) {
      return null;
    }
    return key.substring(ownerIndex + ownerMarker.length);
  }

  @override
  Future<List<GuideHistoryEntry>> readHistory() async {
    if (_ownerScope == null) return const [];
    final entries = <String, GuideHistoryEntry>{};
    try {
      final storage = web.window.localStorage;
      for (final key in _storageKeys(storage)) {
        final id = _historySuffix(key);
        if (id == null || !isGuideThreadId(id)) continue;
        final entry = decodeGuideHistory(storage.getItem(key));
        if (entry == null || entry.id != id) continue;
        final current = entries[id];
        if (current == null ||
            entry.updatedAt.isAfter(current.updatedAt) ||
            (entry.updatedAt == current.updatedAt &&
                key.startsWith(_historyKey))) {
          entries[id] = entry;
        }
      }
    } catch (_) {
      // The current controller still has the conversations it has seen.
    }
    return entries.values.toList();
  }

  @override
  Future<List<LegacyGuideConversation>> readLegacyConversations() async {
    final owner = _legacyOwner;
    if (owner == null) return const [];
    try {
      final stored = web.window.localStorage.getItem(
        '$legacyGuideHistoryPrefix$owner',
      );
      return decodeLegacyGuideConversations(stored).toList();
    } catch (_) {
      // Archived records are optional when browser storage is unavailable.
      return const [];
    }
  }

  @override
  Future<GuideRecovery?> readLegacyRecovery(
    String chatId,
    int messageId,
  ) async {
    final owner = _legacyOwner;
    if (owner == null || !isGuideThreadId(chatId)) return null;
    try {
      final storage = web.window.sessionStorage;
      return decodeLegacyGuideRecovery(
        storage.getItem('$_legacyRecoveryPrefix$owner.$chatId'),
        storage.getItem('$_legacyPendingPrefix$owner.$chatId'),
        messageId,
      );
    } catch (_) {
      return null;
    }
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
  Future<List<GuideTranscriptTurn>> readTranscriptTurns() async {
    if (_ownerScope == null) return const [];
    final turns = <String, GuideTranscriptTurn>{};
    try {
      final storage = web.window.localStorage;
      for (final key in _storageKeys(storage)) {
        final suffix = _historySuffix(key);
        if (!isGuideTranscriptKey(suffix)) continue;
        final turn = decodeGuideTranscriptTurn(storage.getItem(key));
        if (turn == null || suffix != '$guideTranscriptTurnPrefix${turn.id}') {
          continue;
        }
        if (key.startsWith(_historyKey)) {
          turns[turn.id] = turn;
        } else {
          turns.putIfAbsent(turn.id, () => turn);
        }
      }
    } catch (_) {
      // Keep the active conversation available in memory.
    }
    return turns.values.toList();
  }

  @override
  Future<void> writeTranscriptTurn(GuideTranscriptTurn turn) async {
    if (_ownerScope == null) return;
    try {
      web.window.localStorage.setItem(
        '$_historyKey$guideTranscriptTurnPrefix${turn.id}',
        encodeGuideTranscriptTurn(turn),
      );
    } catch (_) {
      // The controller retains the accepted turn for this session.
    }
  }

  String get _positionKey => '$_key.$guideTranscriptPositionSuffix';

  @override
  Future<GuideTranscriptPosition?> readTranscriptPosition() async {
    if (_ownerScope == null) return _memoryPosition;
    try {
      return decodeGuideTranscriptPosition(
        web.window.sessionStorage.getItem(_positionKey),
      );
    } catch (_) {
      return _memoryPosition;
    }
  }

  @override
  Future<void> writeTranscriptPosition(
    GuideTranscriptPosition? position,
  ) async {
    _memoryPosition = position;
    if (_ownerScope == null) return;
    try {
      final storage = web.window.sessionStorage;
      if (position == null) {
        storage.removeItem(_positionKey);
      } else {
        storage.setItem(_positionKey, encodeGuideTranscriptPosition(position));
      }
    } catch (_) {
      // Keep the current conversation in memory when this tab cannot save it.
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
