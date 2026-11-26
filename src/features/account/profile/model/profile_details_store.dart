import 'dart:convert';

import 'profile_details.dart';
import 'profile_details_storage_native.dart'
    if (dart.library.js_interop) 'profile_details_storage_web.dart';
import 'profile_device_scope.dart';

class LocalProfileDetailsStore {
  const LocalProfileDetailsStore();

  Future<LocalProfileDetails> read(String scope) => _read(_detailsKey(scope));

  Future<LocalProfileDetails?> save(
    String scope, {
    required bool Function() isCurrent,
    String? signature,
    Map<ProfileTag, String>? tags,
  }) async {
    LocalProfileDetails? saved;
    await serializeProfileDeviceWrite(_detailsKey(scope), (key) async {
      if (!isCurrent()) return;
      final current = await _read(key);
      if (!isCurrent()) return;
      final next = LocalProfileDetails.fromJson(
        LocalProfileDetails(
          signature: signature ?? current.signature,
          tags: tags ?? current.tags,
        ).toJson(),
      );
      await writeProfileDetailsDevice(key, jsonEncode(next.toJson()));
      if (isCurrent()) saved = next;
    });
    return saved;
  }
}

Future<void> clearMemberProfileDetails(String owner) =>
    serializeProfileDeviceWrite(
      _detailsKey('member:$owner'),
      (key) => writeProfileDetailsDevice(key, null),
    );

String _detailsKey(String scope) => profileDeviceKey(scope, 'profile-details');

Future<LocalProfileDetails> _read(String key) async {
  final raw = await readProfileDetailsDevice(key);
  if (raw == null) return const LocalProfileDetails();
  try {
    return LocalProfileDetails.fromJson(jsonDecode(raw));
  } on FormatException {
    return const LocalProfileDetails();
  }
}
