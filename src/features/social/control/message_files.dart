import 'dart:io';
import 'dart:math';

import 'package:file_selector/file_selector.dart';
import 'package:flutter/services.dart';
import 'package:path_provider/path_provider.dart';
import 'package:video_player/video_player.dart';

import '../model/social.dart';

bool get canPlayMessageVideo =>
    Platform.isAndroid || Platform.isIOS || Platform.isMacOS;
bool get opensMessageFiles => Platform.isAndroid || Platform.isIOS;

Future<Directory> _mediaDirectory() async {
  final cache = await getTemporaryDirectory();
  final random = Random.secure();
  final values = List.generate(32, (_) => random.nextInt(16).toRadixString(16));
  final hex = values.join();
  // The existing native preview accepts cache/<uuid>/<name>.
  final id =
      '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-'
      '${hex.substring(16, 20)}-${hex.substring(20)}';
  return Directory('${cache.path}/$id').create();
}

String _safeLocalName(String name) {
  final clean = name
      .replaceAll(RegExp(r'[\x00-\x1f\x7f/\\<>:"|?*]'), '_')
      .trim();
  return clean.isEmpty || clean == '.' || clean == '..' ? 'attachment' : clean;
}

Future<File> _stage(MessageAttachment metadata, Uint8List bytes) async {
  final directory = await _mediaDirectory();
  final file = File('${directory.path}/${_safeLocalName(metadata.name)}');
  try {
    return await file.writeAsBytes(bytes, flush: true);
  } catch (_) {
    await _removeStagedFile(file);
    rethrow;
  }
}

Future<({VideoPlayerController player, Future<void> Function() release})>
prepareMessageVideo(MessageAttachment metadata, Uint8List bytes) async {
  final file = await _stage(metadata, bytes);
  return (
    player: VideoPlayerController.file(file),
    release: () => _removeStagedFile(file),
  );
}

Future<Future<void> Function()?> exportMessageAttachment(
  MessageAttachment metadata,
  Uint8List bytes,
) async {
  if (opensMessageFiles) {
    final file = await _stage(metadata, bytes);
    try {
      final opened = await const MethodChannel('jovian/attachment_preview')
          .invokeMethod<bool>('open', {
            'path': file.path,
            'name': metadata.name,
            'mimeType': metadata.type,
          });
      if (opened == true) return () => _removeStagedFile(file);
      throw const FileSystemException('No attachment preview available');
    } catch (_) {
      await _removeStagedFile(file);
      rethrow;
    }
  }
  final location = await getSaveLocation(
    suggestedName: _safeLocalName(metadata.name),
  );
  if (location != null)
    await File(location.path).writeAsBytes(bytes, flush: true);
  return null;
}

Future<String> createVoicePath() async =>
    '${(await _mediaDirectory()).path}/voice.wav';

Future<void> removeTemporaryFile(String path) => _removeStagedFile(File(path));

Future<void> _removeStagedFile(File file) async {
  try {
    if (await file.exists()) await file.delete();
    if (await file.parent.exists()) await file.parent.delete();
  } on FileSystemException {
    // The operating system may already have evicted this cache directory.
  }
}

void releasePickedFile(String _) {}
