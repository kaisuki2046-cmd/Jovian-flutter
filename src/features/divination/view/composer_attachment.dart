import 'package:file_selector/file_selector.dart';

import 'composer_attachment_platform.dart'
    if (dart.library.js_interop) 'composer_attachment_platform_web.dart'
    as platform;

enum ComposerAttachmentKind { image, file }

class ComposerAttachment {
  const ComposerAttachment({required this.file, required this.kind, this.size});

  final XFile file;
  final ComposerAttachmentKind kind;
  final int? size;

  String get name => file.name;
  String? get mimeType => file.mimeType;

  bool get canOpenWithSystem =>
      kind == ComposerAttachmentKind.file &&
      platform.canOpenWithSystem(file.path);
  Future<bool> openWithSystem() =>
      platform.openWithSystem(file.path, name, mimeType);

  void release() => platform.release(file.path);
  bool get canDownload => platform.canDownload(file.path);
  void download() => platform.download(file.path, name);
}

typedef ComposerAttachmentPicker =
    Future<List<ComposerAttachment>> Function(ComposerAttachmentKind kind);
final _imageExtension = RegExp(
  r'\.(?:jpe?g|png|gif|webp|bmp|avif|heic|heif)$',
  caseSensitive: false,
);

Future<List<ComposerAttachment>> pickComposerAttachments(
  ComposerAttachmentKind kind,
) async {
  final files = await openFiles(
    acceptedTypeGroups: kind == ComposerAttachmentKind.image
        ? const [
            XTypeGroup(
              label: '图片',
              mimeTypes: ['image/*'],
              extensions: [
                'jpg',
                'jpeg',
                'png',
                'gif',
                'webp',
                'bmp',
                'avif',
                'heic',
                'heif',
              ],
              uniformTypeIdentifiers: ['public.image'],
            ),
          ]
        : const [],
  );
  try {
    return await Future.wait([for (final file in files) _describe(file, kind)]);
  } catch (_) {
    for (final file in files) {
      platform.release(file.path);
    }
    rethrow;
  }
}

Future<ComposerAttachment> _describe(
  XFile file,
  ComposerAttachmentKind selectedKind,
) async {
  final mime = file.mimeType;
  final image =
      selectedKind == ComposerAttachmentKind.image ||
      mime?.startsWith('image/') == true ||
      ((mime == null || mime.isEmpty || mime == 'application/octet-stream') &&
          _imageExtension.hasMatch(file.name));
  return ComposerAttachment(
    file: file,
    kind: image ? ComposerAttachmentKind.image : ComposerAttachmentKind.file,
    size: await file.length(),
  );
}

String formatComposerFileSize(int bytes) {
  const mib = 1024 * 1024;
  if (bytes < 1024) return '$bytes B';
  if (bytes < mib) return '${(bytes / 1024).ceil()} KB';
  return '${(bytes / mib).toStringAsFixed(1)} MB';
}
