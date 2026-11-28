import 'dart:typed_data';

import 'package:flutter/foundation.dart' show compute;
import 'package:image/image.dart' as image;
import 'package:zxing2/qrcode.dart';

import '../model/social.dart';
import 'message_media.dart';
import 'social_controller.dart';

Future<Uint8List?> pickMessageImage(int maxSide, {bool camera = false}) async {
  final picked = camera
      ? await takeMessagePhoto()
      : await pickMessageAttachment(mediaOnly: true);
  if (picked == null) return null;
  if (picked.details.kind != MessageMediaKind.image) {
    throw const SocialInputError('请选择一张图片。');
  }
  return compute(_shrinkImage, (picked.bytes, maxSide));
}

Uint8List _shrinkImage((Uint8List, int) args) {
  final (bytes, maxSide) = args;
  final decoded = image.decodeImage(bytes, frame: 0);
  if (decoded == null) throw const SocialInputError('暂时无法读取这张图片。');
  final oriented = image.bakeOrientation(decoded);
  final resized = oriented.width > maxSide || oriented.height > maxSide
      ? image.copyResize(
          oriented,
          width: oriented.width >= oriented.height ? maxSide : null,
          height: oriented.width < oriented.height ? maxSide : null,
          interpolation: image.Interpolation.average,
        )
      : oriented;
  return image.encodeJpg(resized, quality: 78);
}

Future<String?> readMessageQrCode({bool camera = false}) async {
  final bytes = await pickMessageImage(1400, camera: camera);
  if (bytes == null) return null;
  return compute(_scan, bytes);
}

String _scan(Uint8List bytes) {
  final decoded = image.decodeJpg(bytes);
  if (decoded == null) throw const SocialInputError('暂时无法读取这张图片。');
  final rgba = decoded
      .convert(numChannels: 4)
      .getBytes(order: image.ChannelOrder.rgba);
  final source = RGBLuminanceSource(
    decoded.width,
    decoded.height,
    rgba.buffer.asInt32List(),
  );
  try {
    return QRCodeReader()
        .decode(BinaryBitmap(HybridBinarizer(source)))
        .text
        .trim();
  } on ReaderException {
    throw const SocialInputError('这张图片里没有可识别的二维码。');
  }
}
