import 'dart:js_interop';
import 'dart:typed_data';

import 'package:video_player/video_player.dart';
import 'package:web/web.dart' as web;

import '../model/social.dart';

bool get canPlayMessageVideo => true;
bool get opensMessageFiles => false;

String _attachmentUrl(MessageAttachment metadata, Uint8List bytes) =>
    web.URL.createObjectURL(
      web.Blob([bytes.toJS].toJS, web.BlobPropertyBag(type: metadata.type)),
    );

Future<({VideoPlayerController player, Future<void> Function() release})>
prepareMessageVideo(MessageAttachment metadata, Uint8List bytes) async {
  final address = _attachmentUrl(metadata, bytes);
  return (
    player: VideoPlayerController.networkUrl(Uri.parse(address)),
    release: () async => web.URL.revokeObjectURL(address),
  );
}

Future<Future<void> Function()?> exportMessageAttachment(
  MessageAttachment metadata,
  Uint8List bytes,
) async {
  final address = _attachmentUrl(metadata, bytes);
  final link = web.HTMLAnchorElement()
    ..href = address
    ..download = metadata.name;
  web.document.body?.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    await Future<void>.delayed(const Duration(milliseconds: 500));
    web.URL.revokeObjectURL(address);
  }
  return null;
}

Future<String> createVoicePath() async => 'voice.wav';

Future<void> removeTemporaryFile(String path) async => releasePickedFile(path);

void releasePickedFile(String path) {
  if (path.startsWith('blob:')) web.URL.revokeObjectURL(path);
}
