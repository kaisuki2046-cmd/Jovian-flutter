import 'dart:typed_data';

import 'avatar_storage_stub.dart'
    if (dart.library.io) 'avatar_storage_native.dart'
    if (dart.library.js_interop) 'avatar_storage_web.dart';

class ProfileAvatarStore {
  const ProfileAvatarStore();

  Future<Uint8List?> read(String scope) => readAvatarDevice(_avatarKey(scope));

  Future<bool> save(
    String scope,
    Uint8List? bytes,
    bool Function() isCurrent,
  ) async {
    var saved = false;
    await _serialize(_avatarKey(scope), (key) async {
      if (!isCurrent()) return;
      await writeAvatarDevice(key, bytes);
      saved = isCurrent();
    });
    return saved;
  }
}

Future<void> clearMemberProfileAvatar(String owner) => _serialize(
  _avatarKey('member:$owner'),
  (key) => writeAvatarDevice(key, null),
);

String _avatarKey(String scope) =>
    'jovian.avatar.v1.${scope.runes.map((value) => value.toRadixString(16)).join('-')}';

final _deviceWrites = <String, Future<void>>{};

Future<void> _serialize(String key, Future<void> Function(String) write) async {
  final previous = _deviceWrites[key];
  final pending = previous == null
      ? write(key)
      : previous.then((_) => write(key), onError: (Object _) => write(key));
  _deviceWrites[key] = pending;
  try {
    await pending;
  } finally {
    if (identical(_deviceWrites[key], pending)) _deviceWrites.remove(key);
  }
}
