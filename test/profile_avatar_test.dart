import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import '../src/features/account/profile/control/profile_photo.dart';
import '../src/features/account/profile/model/avatar_storage.dart';
import '../src/features/account/profile/model/profile_device_scope.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test(
    'avatar crop is bounded, preserves the chosen region and outputs 320 pixels',
    () async {
      final recorder = ui.PictureRecorder();
      final canvas = ui.Canvas(recorder);
      final color = ui.Paint();
      canvas.drawRect(
        const ui.Rect.fromLTWH(0, 0, 320, 280),
        color..color = const ui.Color(0xffff0000),
      );
      canvas.drawRect(
        const ui.Rect.fromLTWH(320, 0, 320, 280),
        color..color = const ui.Color(0xff0000ff),
      );
      final picture = recorder.endRecording();
      addTearDown(picture.dispose);
      final original = await picture.toImage(640, 280);
      addTearDown(original.dispose);
      final encoded = await original.toByteData(format: ui.ImageByteFormat.png);
      final selected = await decodeProfilePhoto(
        encoded!.buffer.asUint8List(
          encoded.offsetInBytes,
          encoded.lengthInBytes,
        ),
      );
      addTearDown(selected.dispose);
      expect((selected.width, selected.height), (640, 280));
      final crop = profileAvatarCrop(selected, const ui.Offset(900, -900), 2);
      expect(crop, const ui.Rect.fromLTRB(500, 0, 640, 140));
      final avatar = await decodeProfilePhoto(
        await renderProfileAvatar(selected, crop),
      );
      addTearDown(avatar.dispose);
      expect((avatar.width, avatar.height), (320, 320));
      final pixels = (await avatar.toByteData())!.buffer.asUint8List();
      expect(pixels.take(4), [0, 0, 255, 255]);
      await expectLater(
        decodeProfilePhoto(Uint8List(12 * 1024 * 1024 + 1)),
        throwsFormatException,
      );
    },
  );

  test(
    'Android restores only the current avatar and clears it on reset',
    () async {
      final root = await Directory.systemTemp.createTemp('jovian-rn-avatar-');
      final slash = Platform.pathSeparator;
      final legacy = await Directory(
        '${root.path}${slash}jovian-avatars',
      ).create();
      final original = File('${legacy.path}${slash}abc-123.jpg');
      final image = Uint8List.fromList([7, 8, 9]);
      await original.writeAsBytes(image);
      const paths = MethodChannel('plugins.flutter.io/path_provider');
      const channel = MethodChannel('jovian/legacy_preferences');
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      debugDefaultTargetPlatformOverride = TargetPlatform.android;
      addTearDown(() async {
        debugDefaultTargetPlatformOverride = null;
        messenger.setMockMethodCallHandler(paths, null);
        messenger.setMockMethodCallHandler(channel, null);
        await root.delete(recursive: true);
      });
      messenger.setMockMethodCallHandler(paths, (call) async {
        expect(call.method, 'getApplicationSupportDirectory');
        return root.path;
      });
      final ownerKey = profileDeviceKey('member:1', 'avatar');
      var legacyReads = 0;
      messenger.setMockMethodCallHandler(channel, (call) async {
        switch (call.method) {
          case 'readProfile':
            legacyReads++;
            return call.arguments == ownerKey && await original.exists()
                ? 'abc-123.jpg'
                : null;
          case 'clearProfile':
            expect(call.arguments, ownerKey);
            await original.delete();
            return true;
          default:
            fail('Unexpected method ${call.method}');
        }
      });

      const store = ProfileAvatarStore();
      expect(await store.read('member:1'), image);
      expect(await store.read('guest:1'), isNull);
      expect(await store.read('member:2'), isNull);
      final newer = Uint8List.fromList([3, 4, 5]);
      expect(await store.save('member:1', newer, () => true), isTrue);
      expect(await store.read('member:1'), newer);
      expect(legacyReads, 3);
      expect(await original.exists(), isTrue);

      expect(await store.save('member:1', null, () => true), isTrue);
      expect(await store.read('member:1'), isNull);
      expect(await original.exists(), isFalse);
    },
  );

  test(
    'native file storage separates members and guests and serializes deletion cleanup',
    () async {
      final root = await Directory.systemTemp.createTemp(
        'jovian-profile-test-',
      );
      const channel = MethodChannel('plugins.flutter.io/path_provider');
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(channel, (call) async {
        expect(call.method, 'getApplicationSupportDirectory');
        return root.path;
      });
      const store = ProfileAvatarStore();
      const member = 'member:test';
      const guest = 'guest:test';
      const other = 'member:other';
      final profile = Directory(
        '${root.path}${Platform.pathSeparator}jovian-profile',
      );
      addTearDown(() async {
        try {
          await clearMemberProfileAvatar('test');
          await clearMemberProfileAvatar('other');
          await store.save(guest, null, () => true);
          if (await profile.exists()) await profile.delete();
          await root.delete();
        } finally {
          messenger.setMockMethodCallHandler(channel, null);
        }
      });
      final bytes = Uint8List.fromList([1, 3, 5]);
      expect(await store.read(member), isNull);
      expect(await store.save(guest, bytes, () => true), isTrue);
      expect(await store.save(other, bytes, () => true), isTrue);
      expect(await store.save(member, bytes, () => true), isTrue);
      expect(await store.read(member), bytes);
      final written = Uint8List.fromList([2, 4, 6]);
      expect(await store.save(member, written, () => true), isTrue);
      expect(await store.read(member), written);

      var current = true;
      final inFlight = store.save(member, bytes, () => current);
      final cleanup = clearMemberProfileAvatar('test');
      final stale = store.save(member, written, () => current);
      current = false;
      expect(await inFlight, isFalse);
      await cleanup;
      expect(await stale, isFalse);
      expect(await store.read(member), isNull);
      expect(await store.read(guest), bytes);
      expect(await store.read(other), bytes);
      await clearMemberProfileAvatar('test');
    },
  );
}
