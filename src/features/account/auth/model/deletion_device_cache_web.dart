import 'package:web/web.dart' as web;

void clearLegacyAccountDeviceCache(String owner) {
  final storage = web.window.localStorage;
  final legacyOwner = 'member:$owner'.runes
      .map((rune) => rune.toRadixString(16))
      .join('-');
  storage.removeItem('jovian.cover.v1.$legacyOwner');
  storage.removeItem('jovian.social.demo.v1.member-$owner');
}
