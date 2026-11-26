import 'dart:convert';
import 'dart:io';

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
    'native upgrade reads the exact RN owner file and isolates deletion',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'jovian-rn-history-',
      );
      addTearDown(() => directory.delete(recursive: true));
      Future<Directory> legacyDirectory() async => directory;

      final reading = await _reading();
      const owner = 'a星🙂';
      const encoded = '61_661f_1f642';
      const historyKey = 'jovian.divination.history.v2.';
      File legacyFile(String name) =>
          File.fromUri(directory.uri.resolve('$historyKey$name'));
      final legacy = legacyFile('member.$encoded.json');
      final pending = legacyFile('member.$encoded.tmp');
      final theirFile = legacyFile('member.6f_74_68_65_72.json');
      final guestFile = legacyFile('guest.$encoded.json');
      final contents = jsonEncode({
        'activeId': 'existing-chat',
        'threads': [
          {
            'id': 'existing-chat',
            'updatedAt': 1700000000000,
            'messages': [
              {'id': 1, 'kind': 'readingSession', 'snapshot': reading.toJson()},
              {
                'id': 2,
                'kind': 'readingSession',
                'snapshot': {
                  'method': 'combined',
                  'ruleVersion': 'tarot-liuyao-meihua-v1',
                  'stage': 'reading',
                  'question': '旧原生问题',
                  'focus': '原来的关注点',
                  'report': {
                    'schemaVersion': 1,
                    'source': 'model',
                    'answer': '保留旧报告正文',
                  },
                },
              },
            ],
          },
        ],
      });
      await legacy.writeAsString(contents);
      await pending.writeAsString('{');
      await theirFile.writeAsString('{}');
      await guestFile.writeAsString(contents);

      final store = createReadingRecovery(
        _base,
        ownerScope: 'member:$owner',
        legacyDirectory: legacyDirectory,
      );
      final history = store as GuideHistoryStore;
      final archives = store as LegacyGuideArchiveStore;
      final other =
          createReadingRecovery(
                _base,
                ownerScope: 'member:other',
                legacyDirectory: legacyDirectory,
              )
              as GuideHistoryStore;
      final anonymous = createReadingRecovery(
        _base,
        legacyDirectory: legacyDirectory,
      );
      expect((await history.readHistory()).single.id, 'rn-existing-chat-1');
      expect(
        (await history.readHistory()).single.reading.toJson(),
        reading.toJson(),
      );
      expect(
        (await archives.readLegacyArchives()).single.report?.answer,
        '保留旧报告正文',
      );
      expect(await history.read(), isNull);
      expect(await history.readThread('rn-existing-chat-1'), isNull);
      expect(await other.readHistory(), isEmpty);
      expect(anonymous, isNot(isA<LegacyGuideArchiveStore>()));

      await history.writeHistory(_entry('rn-existing-chat-1', reading));
      expect(
        (await history.readHistory()).single.updatedAt.toUtc(),
        DateTime.utc(2026, 11, 27),
      );
      expect(await legacy.readAsString(), contents);
      expect(await pending.readAsString(), '{');

      await clearMemberReadingData(owner, legacyDirectory: legacyDirectory);
      await clearMemberReadingData(owner, legacyDirectory: legacyDirectory);
      expect(await legacy.exists(), isFalse);
      expect(await pending.exists(), isFalse);
      expect(await theirFile.readAsString(), '{}');
      expect(await guestFile.readAsString(), contents);
      expect(await history.readHistory(), isEmpty);
      expect(await archives.readLegacyArchives(), isEmpty);
    },
  );

  test(
    'native transcript data follows the account and endpoint scope',
    () async {
      GuideTranscriptStore store(String scope, {Uri? base}) =>
          createReadingRecovery(base ?? _base, ownerScope: scope)
              as GuideTranscriptStore;
      GuideTranscriptTurn turn(String id, String question) => (
        id: id,
        conversationId: 'conversation-one',
        sentAt: DateTime.utc(2026, 11, 27),
        question: question,
        reply: '请补充问题。',
        clarificationQuestion: question,
        previousQuestion: null,
        readingId: null,
      );
      const position = (
        id: 'conversation-one',
        previousQuestion: '上一次的问题',
        composing: true,
      );
      final owner = store('member:owner');
      final other = store('member:other');
      final guest = store('guest:owner');
      final otherEndpoint = store(
        'member:owner',
        base: Uri.https('other.invalid'),
      );
      await Future.wait([
        owner.writeTranscriptTurn(turn('first', '第一个问题')),
        store('member:owner').writeTranscriptTurn(turn('second', '第二个问题')),
        other.writeTranscriptTurn(turn('other', '其他会员的问题')),
        guest.writeTranscriptTurn(turn('guest', '游客的问题')),
        otherEndpoint.writeTranscriptTurn(turn('endpoint', '其他服务的问题')),
      ]);
      await owner.writeTranscriptPosition(position);
      expect(
        (await store(
          'member:owner',
        ).readTranscriptTurns()).map((turn) => turn.id),
        unorderedEquals(['first', 'second']),
      );
      expect(await store('member:owner').readTranscriptPosition(), position);
      expect(await other.readTranscriptPosition(), isNull);
      expect(await memberReadingTokens('owner'), isEmpty);

      await clearMemberReadingData('owner');
      expect(await owner.readTranscriptTurns(), isEmpty);
      expect(await owner.readTranscriptPosition(), isNull);
      expect(await otherEndpoint.readTranscriptTurns(), isEmpty);
      expect((await other.readTranscriptTurns()).single.id, 'other');
      expect((await guest.readTranscriptTurns()).single.id, 'guest');
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
