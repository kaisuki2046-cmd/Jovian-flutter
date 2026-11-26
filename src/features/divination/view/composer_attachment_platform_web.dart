import 'package:web/web.dart' as web;

bool canOpenWithSystem(String path) => false;

Future<bool> openWithSystem(String path, String name, String? mimeType) async =>
    false;

bool canDownload(String path) => path.startsWith('blob:');

void download(String path, String name) {
  if (!canDownload(path)) return;
  final link = web.HTMLAnchorElement()
    ..href = path
    ..download = name;
  web.document.body?.append(link);
  try {
    link.click();
  } finally {
    link.remove();
  }
}

void release(String path) {
  if (canDownload(path)) web.URL.revokeObjectURL(path);
}
