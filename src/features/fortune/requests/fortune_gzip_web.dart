import 'dart:js_interop';
import 'dart:typed_data';

import 'package:web/web.dart' as web;

@JS('CompressionStream')
external JSFunction? get _compressionStream;

Future<Uint8List?> gzipFortuneBody(Uint8List bytes) async {
  if (bytes.length < 256 * 1024 || _compressionStream == null) return null;
  final gzip = web.CompressionStream('gzip');
  final stream = web.Blob(<JSAny>[bytes.toJS].toJS).stream().pipeThrough(
    web.ReadableWritablePair(readable: gzip.readable, writable: gzip.writable),
  );
  return (await web.Response(stream).arrayBuffer().toDart).toDart.asUint8List();
}
