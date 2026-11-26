import 'package:web/web.dart' as web;

Future<String?> readProfileDetailsDevice(String key) async =>
    web.window.localStorage.getItem(key);

Future<void> writeProfileDetailsDevice(String key, String? value) async {
  final storage = web.window.localStorage;
  if (value == null) {
    storage.removeItem(key);
  } else {
    storage.setItem(key, value);
  }
}
