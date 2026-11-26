import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

const _preview = MethodChannel('jovian/attachment_preview');

bool canOpenWithSystem(String path) =>
    path.isNotEmpty &&
    (defaultTargetPlatform == TargetPlatform.android ||
        defaultTargetPlatform == TargetPlatform.iOS);

Future<bool> openWithSystem(String path, String name, String? mimeType) async {
  if (!canOpenWithSystem(path)) return false;
  try {
    return await _preview.invokeMethod<Object?>('open', {
          'path': path,
          'name': name,
          'mimeType': mimeType,
        }) ==
        true;
  } on PlatformException {
    return false;
  } on MissingPluginException {
    return false;
  }
}

bool canDownload(String path) => false;

void download(String path, String name) {}

void release(String path) {}
