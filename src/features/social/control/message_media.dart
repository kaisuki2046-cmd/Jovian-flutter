import 'package:file_selector/file_selector.dart';
import 'package:flutter/foundation.dart';
import 'package:image_picker/image_picker.dart';
import 'package:record/record.dart';

import '../model/social.dart';
import 'message_files.dart'
    if (dart.library.js_interop) 'message_files_web.dart'
    as platform;
import 'social_controller.dart';

const voiceDuration = Duration(seconds: 45);

const _imageTypes = <String, String>{
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
};
const _videoTypes = <String, String>{
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
};
const _audioTypes = <String, String>{
  'wav': 'audio/wav',
  'mp3': 'audio/mpeg',
  'm4a': 'audio/mp4',
  'ogg': 'audio/ogg',
};

bool get canCaptureMessagePhoto =>
    kIsWeb ||
    defaultTargetPlatform == TargetPlatform.android ||
    defaultTargetPlatform == TargetPlatform.iOS;

Future<OutgoingMessageAttachment?> pickMessageAttachment({
  bool mediaOnly = false,
}) async {
  final file = await openFile(
    acceptedTypeGroups: mediaOnly
        ? const [
            XTypeGroup(
              label: '图片或视频',
              extensions: [
                'jpg',
                'jpeg',
                'png',
                'gif',
                'webp',
                'mp4',
                'mov',
                'webm',
              ],
              mimeTypes: ['image/*', 'video/*'],
              uniformTypeIdentifiers: ['public.image', 'public.movie'],
            ),
          ]
        : const [],
  );
  return file == null ? null : _readFile(file);
}

Future<OutgoingMessageAttachment?> takeMessagePhoto() async {
  final photo = await ImagePicker().pickImage(
    source: ImageSource.camera,
    maxWidth: 2000,
    imageQuality: 90,
    requestFullMetadata: false,
  );
  return photo == null ? null : _readFile(photo);
}

Future<OutgoingMessageAttachment> _readFile(XFile file) async {
  try {
    final size = await file.length();
    if (size == 0 || size > maxMessageAttachmentBytes) {
      throw const SocialInputError('附件须大于 0 且不超过 5 MB。');
    }
    final filename = file.name
        .replaceAll(RegExp(r'[\x00-\x1f\x7f/\\]'), '_')
        .trim();
    final name = filename.isEmpty || filename == '.' || filename == '..'
        ? 'attachment'
        : String.fromCharCodes(filename.runes.take(120));
    final extension = name.split('.').last.toLowerCase();
    final (kind, type) = switch ((
      _imageTypes[extension],
      _videoTypes[extension],
      _audioTypes[extension],
    )) {
      (final String mime, _, _) => (MessageMediaKind.image, mime),
      (_, final String mime, _) => (MessageMediaKind.video, mime),
      (_, _, final String mime) => (MessageMediaKind.audio, mime),
      _ => (MessageMediaKind.file, 'application/octet-stream'),
    };
    final bytes = await file.readAsBytes();
    if (bytes.isEmpty || bytes.length > maxMessageAttachmentBytes) {
      throw const SocialInputError('附件须大于 0 且不超过 5 MB。');
    }
    return OutgoingMessageAttachment(
      MessageAttachment(kind: kind, name: name, type: type, size: bytes.length),
      bytes,
    );
  } finally {
    platform.releasePickedFile(file.path);
  }
}

class MessageVoiceRecorder {
  final _recorder = AudioRecorder();
  String? _path;
  bool _disposed = false;

  Future<void> start() async {
    if (!await _recorder.hasPermission()) {
      throw const SocialInputError('请允许使用麦克风后再录音。');
    }
    if (_disposed) return;
    final path = await platform.createVoicePath();
    if (_disposed) {
      await platform.removeTemporaryFile(path);
      return;
    }
    _path = path;
    try {
      await _recorder.start(
        const RecordConfig(
          encoder: AudioEncoder.wav,
          numChannels: 1,
          sampleRate: 16000,
        ),
        path: path,
      );
    } catch (_) {
      await _clearFile();
      rethrow;
    }
  }

  Future<OutgoingMessageAttachment?> stop() async {
    try {
      final result = await _recorder.stop();
      if (result == null) return null;
      final audio = XFile(result, name: 'voice.wav', mimeType: 'audio/wav');
      if (await audio.length() <= 44) {
        platform.releasePickedFile(result);
        return null;
      }
      return await _readFile(audio);
    } finally {
      await _clearFile();
    }
  }

  Future<void> discard() async {
    try {
      await _recorder.cancel();
    } finally {
      await _clearFile();
    }
  }

  Future<void> dispose() async {
    _disposed = true;
    try {
      await _recorder.dispose();
    } finally {
      await _clearFile();
    }
  }

  Future<void> _clearFile() async {
    final path = _path;
    _path = null;
    if (path != null) await platform.removeTemporaryFile(path);
  }
}

String messageSize(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).ceil()} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
