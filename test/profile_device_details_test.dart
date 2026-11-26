import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';

import '../src/features/account/profile/model/profile_details.dart';
import '../src/features/account/profile/model/profile_details_store.dart';
import '../src/features/account/profile/model/profile_device_scope.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  const store = LocalProfileDetailsStore();
  const device = FlutterSecureStorage();
  const member = 'member:1';
  const guest = 'guest:1';
  const originalKey = 'jovian.profile-details.v1.6d-65-6d-62-65-72-3a-31';

  test(
    'reads the original JSON and applies its Unicode field limits',
    () async {
      expect(profileDeviceKey(member, 'profile-details'), originalKey);
      FlutterSecureStorage.setMockInitialValues({
        originalKey: jsonEncode({
          'signature': '  ${'🌙' * 101}  ',
          'tags': {
            'zodiac': '  ${'星' * 31}  ',
            'personality': 12,
            'interests': '  登山  ',
          },
        }),
      });
      final restored = await store.read(member);
      expect(restored.signature, '🌙' * 100);
      expect(restored.tags, {
        ProfileTag.zodiac: '星' * 30,
        ProfileTag.personality: '',
        ProfileTag.interests: '登山',
      });
      expect((await store.read(guest)).signature, isEmpty);
    },
  );

  test(
    'separate edits merge and deletion clears only the current member key',
    () async {
      FlutterSecureStorage.setMockInitialValues({});
      await Future.wait([
        store.save(member, isCurrent: () => true, signature: '夜行者'),
        store.save(
          member,
          isCurrent: () => true,
          tags: {ProfileTag.interests: '听雨'},
        ),
        store.save(guest, isCurrent: () => true, signature: '游客用语'),
      ]);
      expect(jsonDecode((await device.read(key: originalKey))!), {
        'signature': '夜行者',
        'tags': {'zodiac': '', 'personality': '', 'interests': '听雨'},
      });
      var stillCurrent = true;
      final started = store.save(
        member,
        isCurrent: () => stillCurrent,
        signature: '待写入',
      );
      final clear = clearMemberProfileDetails('1');
      final queued = store.save(
        member,
        isCurrent: () => stillCurrent,
        signature: '失效会话的改动',
      );
      stillCurrent = false;
      await started;
      await clear;
      expect(await queued, isNull);
      await clearMemberProfileDetails('1');
      expect(await device.read(key: originalKey), isNull);
      expect((await store.read(guest)).signature, '游客用语');
    },
  );
}
