import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

const _channel = MethodChannel('jovian/legacy_preferences');

Future<String?> readLegacyPreferenceRecord() async {
  if (defaultTargetPlatform != TargetPlatform.android) return null;
  try {
    return await _channel.invokeMethod<String>('read');
  } on MissingPluginException {
    return null;
  } on PlatformException {
    return null;
  }
}
