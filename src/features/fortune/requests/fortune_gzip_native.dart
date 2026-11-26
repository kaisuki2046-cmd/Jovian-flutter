import 'dart:io';
import 'dart:typed_data';

Future<Uint8List?> gzipFortuneBody(Uint8List bytes) async =>
    bytes.length < 256 * 1024 ? null : Uint8List.fromList(gzip.encode(bytes));
