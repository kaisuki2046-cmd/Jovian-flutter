import 'package:web/web.dart' as web;

Future<String?> readMessageSettings(String key) async =>
    web.window.localStorage.getItem(key);

Future<void> writeMessageSettings(String key, String data) async {
  web.window.localStorage.setItem(key, data);
}
