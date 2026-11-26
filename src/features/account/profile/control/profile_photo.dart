import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:file_selector/file_selector.dart';

const _maxFileBytes = 12 * 1024 * 1024;
const _maxPixels = 64 * 1024 * 1024;
const _maxDecodedEdge = 2048;
const _avatarSize = 320;
const _photoTypes = XTypeGroup(
  label: '照片',
  extensions: ['png', 'jpg', 'jpeg', 'webp', 'bmp', 'gif', 'heic', 'heif'],
  uniformTypeIdentifiers: ['public.image'],
  mimeTypes: ['image/*'],
);

Future<ui.Image?> selectProfilePhoto() async {
  final file = await openFile(acceptedTypeGroups: const [_photoTypes]);
  if (file == null) return null;
  if (await file.length() > _maxFileBytes)
    throw const FormatException('图片超过 12 MB，请选择较小的图片。');
  return decodeProfilePhoto(await file.readAsBytes());
}

Future<ui.Image> decodeProfilePhoto(Uint8List bytes) async {
  if (bytes.length > _maxFileBytes)
    throw const FormatException('图片超过 12 MB，请选择较小的图片。');
  final buffer = await ui.ImmutableBuffer.fromUint8List(bytes);
  final codec = await ui.instantiateImageCodecWithSize(
    buffer,
    getTargetSize: (width, height) {
      if (width * height > _maxPixels)
        throw const FormatException('图片像素过多，请选择尺寸较小的照片。');
      final edge = math.max(width, height);
      if (edge <= _maxDecodedEdge) return const ui.TargetImageSize();
      return width >= height
          ? const ui.TargetImageSize(width: _maxDecodedEdge)
          : const ui.TargetImageSize(height: _maxDecodedEdge);
    },
  );
  try {
    return (await codec.getNextFrame()).image;
  } finally {
    codec.dispose();
  }
}

ui.Rect profileAvatarCrop(ui.Image image, ui.Offset center, double zoom) {
  final side = math.min(image.width, image.height) / zoom;
  final half = side / 2;
  return ui.Rect.fromCenter(
    center: ui.Offset(
      center.dx.clamp(half, image.width - half),
      center.dy.clamp(half, image.height - half),
    ),
    width: side,
    height: side,
  );
}

Future<Uint8List> renderProfileAvatar(ui.Image image, ui.Rect crop) async {
  final recorder = ui.PictureRecorder();
  ui.Canvas(recorder).drawImageRect(
    image,
    crop,
    ui.Rect.fromLTWH(0, 0, _avatarSize.toDouble(), _avatarSize.toDouble()),
    ui.Paint()..filterQuality = ui.FilterQuality.medium,
  );
  final picture = recorder.endRecording();
  try {
    final avatar = await picture.toImage(_avatarSize, _avatarSize);
    try {
      final bytes = await avatar.toByteData(format: ui.ImageByteFormat.png);
      if (bytes == null) throw const FormatException('无法保存这张照片。');
      return bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes);
    } finally {
      avatar.dispose();
    }
  } finally {
    picture.dispose();
  }
}
