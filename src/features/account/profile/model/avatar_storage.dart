import 'dart:typed_data';

import 'avatar_storage_stub.dart'
    if (dart.library.io) 'avatar_storage_native.dart'
    if (dart.library.js_interop) 'avatar_storage_web.dart';
import 'profile_device_scope.dart';

class ProfileAvatarStore {
  const ProfileAvatarStore();

  Future<Uint8List?> read(String scope) => readAvatarDevice(_avatarKey(scope));

  Future<bool> save(
    String scope,
    Uint8List? bytes,
    bool Function() isCurrent,
  ) async {
    var saved = false;
    await serializeProfileDeviceWrite(_avatarKey(scope), (key) async {
      if (!isCurrent()) return;
      await writeAvatarDevice(key, bytes);
      saved = isCurrent();
    });
    return saved;
  }
}

Future<void> clearMemberProfileAvatar(String owner) =>
    serializeProfileDeviceWrite(
      _avatarKey('member:$owner'),
      (key) => writeAvatarDevice(key, null),
    );

String _avatarKey(String scope) => profileDeviceKey(scope, 'avatar');
