import 'package:flutter/services.dart';

Future<bool> openReadingReference(Uri uri) async {
  const channel = MethodChannel('jovian/reading_reference');
  try {
    return await channel.invokeMethod<bool>('open', uri.toString()) ?? false;
  } on PlatformException {
    return false;
  } on MissingPluginException {
    return false;
  }
}
