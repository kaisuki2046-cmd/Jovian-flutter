import 'package:web/web.dart' as web;

Future<bool> openReadingReference(Uri uri) async {
  final body = web.document.body;
  if (body == null) return false;
  final link = web.HTMLAnchorElement()
    ..href = uri.toString()
    ..target = '_blank'
    ..rel = 'noopener noreferrer';
  body.append(link);
  try {
    link.click();
    return true;
  } finally {
    link.remove();
  }
}
