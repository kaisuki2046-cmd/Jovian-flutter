import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_divination/jovian_divination.dart';

import '../src/features/divination/requests/reading_history_codec.dart';
import '../src/features/divination/requests/reading_recovery.dart';
import 'support/divination_service_fixture.dart';

final _base = Uri.https('fixture.invalid');
const _storage = FlutterSecureStorage();

GuideHistoryStore _store(String owner, {Uri? base}) =>
    createReadingRecovery(base ?? _base, ownerScope: 'member:$owner')
        as GuideHistoryStore;

Future<OnlineReading> _reading() async {
  final service = DivinationServiceFixture();
  final guide = service.connect(DivinationRecoveryFixture());
  try {
    await guide.start(divinationFixtureDetails, automatic: false);
    return guide.reading!;
  } finally {
    guide.dispose();
  }
}

GuideHistoryEntry _entry(String id, OnlineReading reading) =>
    (id: id, updatedAt: DateTime.utc(2026, 11, 27), reading: reading);

Future<Iterable<String>> _ids(GuideHistoryStore store) async =>
    (await store.readHistory()).map((entry) => entry.id);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() => FlutterSecureStorage.setMockInitialValues({}));
  tearDown(() => FlutterSecureStorage.setMockInitialValues({}));

  test(
    'two native stores preserve independently written reports after restart',
    () async {
      final reading = await _reading();
      await _store('owner').writeHistory(_entry('first', reading));
      final left = _store('owner');
      final right = _store('owner');
      expect(await _ids(left), ['first']);
      expect(await _ids(right), ['first']);

      await Future.wait([
        left.writeHistory(_entry('second', reading)),
        right.writeHistory(_entry('third', reading)),
      ]);
      // A reopened owner session sees both sets of writes.
      expect(
        await _ids(_store('owner')),
        unorderedEquals(['first', 'second', 'third']),
      );
      // A current controller also sees a report written by the other one.
      expect(await _ids(left), unorderedEquals(['first', 'second', 'third']));
    },
  );

  test(
    'native history recovers legacy reports despite an incomplete index',
    () async {
      final reading = await _reading();
      final prefix = 'jovian.divination.flutter.v1.$_base.member:owner';
      await _storage.write(key: '$prefix.index', value: '["first"]');
      await _storage.write(
        key: '$prefix.history.out-of-range',
        value: jsonEncode({
          'id': 'out-of-range',
          'updatedAt': 8640000000000001,
          'reading': reading.toJson(),
        }),
      );
      for (final id in ['first', 'omitted']) {
        await _storage.write(
          key: '$prefix.history.$id',
          value: encodeGuideHistory(_entry(id, reading)),
        );
      }
      await _storage.write(
        key: '$prefix.history.mismatched',
        value: encodeGuideHistory(_entry('first', reading)),
      );
      await _storage.write(key: '$prefix.history.corrupt', value: '{');
      await _store('another-owner').writeHistory(_entry('foreign', reading));
      await _store(
        'owner',
        base: Uri.https('other.invalid'),
      ).writeHistory(_entry('different-endpoint', reading));

      expect(
        await _ids(_store('owner')),
        unorderedEquals(['first', 'omitted']),
      );
      expect(await _ids(_store('another-owner')), ['foreign']);
      expect(await _ids(_store('owner', base: Uri.https('other.invalid'))), [
        'different-endpoint',
      ]);
    },
  );

  test(
    'native history reflects deletion across opened and reopened stores',
    () async {
      final reading = await _reading();
      final owner = _store('owner');
      final other = _store('other');
      await owner.writeHistory(_entry('mine', reading));
      await other.writeHistory(_entry('theirs', reading));
      final ownerRecovery = GuideRecovery('a' * 43, null, 'mine');
      final otherRecovery = GuideRecovery('b' * 43, null, 'theirs');
      await owner.write(ownerRecovery);
      await owner.writeThread('mine', ownerRecovery);
      await other.write(otherRecovery);
      await other.writeThread('theirs', otherRecovery);
      expect(await _ids(owner), ['mine']);
      expect((await owner.read())?.token, ownerRecovery.token);
      expect((await owner.readThread('mine'))?.token, ownerRecovery.token);
      expect(await memberReadingTokens('owner'), [ownerRecovery.token]);
      await clearMemberReadingData('owner');

      expect(await _ids(owner), isEmpty);
      expect(await _ids(_store('owner')), isEmpty);
      expect(await owner.read(), isNull);
      expect(await owner.readThread('mine'), isNull);
      expect(await memberReadingTokens('owner'), isEmpty);
      expect(await _ids(other), ['theirs']);
      expect((await other.read())?.token, otherRecovery.token);
      expect((await other.readThread('theirs'))?.token, otherRecovery.token);
    },
  );
}
