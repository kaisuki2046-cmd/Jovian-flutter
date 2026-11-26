import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

const _channel = MethodChannel('jovian/legacy_preferences');

Future<String?> readLegacyAndroidProfile(String key) async {
  if (defaultTargetPlatform != TargetPlatform.android) return null;
  try {
    return await _channel.invokeMethod<String>('readProfile', key);
  } on MissingPluginException {
    return null;
  }
}

Future<void> clearLegacyAndroidProfile(String key) async {
  if (defaultTargetPlatform != TargetPlatform.android) return;
  try {
    if (await _channel.invokeMethod<bool>('clearProfile', key) != true) {
      throw StateError('The legacy profile could not be cleared.');
    }
  } on MissingPluginException {
    // The host does not expose legacy Android data.
  }
}
