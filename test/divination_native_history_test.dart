import 'dart:convert';
import 'dart:io';

import 'package:flutter/services.dart';
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

GuideHistoryEntry _entry(String id, OnlineReading reading) => GuideHistoryEntry(
  id: id,
  updatedAt: DateTime.utc(2026, 11, 27),
  reading: reading,
);

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
            'title': '原生混合记录',
            'messages': [
              {'id': 7, 'kind': 'user', 'text': '原生旧问题'},
              {'id': 8, 'kind': 'guidance', 'text': '原生旧助手回复'},
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
          {
            'id': 'plain-thread',
            'title': '仅文字澄清',
            'updatedAt': 1700000000001,
            'messages': [
              {'id': 1, 'kind': 'user', 'text': '普通文字也保留'},
              {'id': 2, 'kind': 'guidance', 'text': '请进一步说明'},
            ],
          },
        ],
      });
      await legacy.writeAsString(contents);
      await pending.writeAsString('{');
      final theirs = jsonEncode({
        'activeId': 'their-thread',
        'threads': [
          {
            'id': 'their-thread',
            'title': '其他会员的旧记录',
            'updatedAt': 1700000000002,
            'messages': [
              {'id': 1, 'kind': 'user', 'text': '隔离文字'},
            ],
          },
        ],
      });
      await theirFile.writeAsString(theirs);
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
              as LegacyGuideArchiveStore;
      final anonymous = createReadingRecovery(
        _base,
        legacyDirectory: legacyDirectory,
      );
      expect(await history.readHistory(), isEmpty);
      final legacyConversations = await archives.readLegacyConversations();
      expect(legacyConversations.map((item) => item.title), [
        '原生混合记录',
        '仅文字澄清',
      ]);
      final messages = legacyConversations.first.messages;
      expect(messages.map((entry) => entry.id), [7, 8, 1, 2]);
      expect(messages[2].reading?.id, 'rn-existing-chat-1');
      expect(messages[2].reading?.reading.toJson(), reading.toJson());
      expect(messages[3].archive?.report?.answer, '保留旧报告正文');
      expect(legacyConversations.last.messages.last.text, '请进一步说明');
      expect(await history.read(), isNull);
      expect(await history.readThread('rn-existing-chat-1'), isNull);
      expect((await other.readLegacyConversations()).single.title, '其他会员的旧记录');
      expect(anonymous, isNot(isA<LegacyGuideArchiveStore>()));

      await history.writeHistory(_entry('rn-existing-chat-1', reading));
      expect(
        (await history.readHistory()).single.updatedAt.toUtc(),
        DateTime.utc(2026, 11, 27),
      );
      await history.write(GuideRecovery('t' * 43, null, 'rn-existing-chat-1'));
      final service = DivinationServiceFixture();
      final guide = service.connect(history);
      addTearDown(guide.dispose);
      await guide.restore();
      expect(guide.history, isEmpty);
      expect(guide.legacyConversations, hasLength(2));
      expect(guide.reading, isNull);
      expect(service.calls, isEmpty);
      expect(await legacy.readAsString(), contents);
      expect(await pending.readAsString(), '{');

      await clearMemberReadingData(owner, legacyDirectory: legacyDirectory);
      await clearMemberReadingData(owner, legacyDirectory: legacyDirectory);
      expect(await legacy.exists(), isFalse);
      expect(await pending.exists(), isFalse);
      expect(await theirFile.readAsString(), theirs);
      expect(await guestFile.readAsString(), contents);
      expect(await history.readHistory(), isEmpty);
      expect(await archives.readLegacyConversations(), isEmpty);
      expect((await other.readLegacyConversations()).single.title, '其他会员的旧记录');
    },
  );

  test(
    'native upgrade resumes the selected ritual and clears its owner',
    () async {
      final directory = await Directory.systemTemp.createTemp(
        'jovian-rn-ritual-',
      );
      addTearDown(() => directory.delete(recursive: true));
      Future<Directory> legacyDirectory() async => directory;

      const owner = 'owner';
      const member = 'member.6f_77_6e_65_72';
      const other = 'member.6f_74_68_65_72';
      const guest = 'guest.6f_77_6e_65_72';
      const chat = 'before-upgrade';
      final service = DivinationServiceFixture();
      final originalStore = DivinationRecoveryFixture();
      final original = service.connect(originalStore);
      await original.start(divinationFixtureDetails, automatic: false);
      await original.toss();
      final firstToss = original.reading!.toJson();
      final token = originalStore.state!.token;
      original.dispose();
      final originalToken = 'b' * 43;
      final savedNextToken = 'c' * 43;
      String recovery(String value) => jsonEncode({
        'latest': 2,
        'tokens': {'2': value},
      });
      final records = {
        (member, chat): {
          'recovery': recovery(token),
          'pending': jsonEncode({
            'token': token,
            'action': {
              'toss': {
                'actionId': 'af63f9bf-0e9c-4b08-a525-01b5677b4e32',
                'step': 1,
              },
            },
          }),
        },
        (member, 'original'): {'recovery': recovery(originalToken)},
        (member, 'pending-file'): {'recovery': recovery(savedNextToken)},
        (other, chat): {'recovery': recovery('d' * 43)},
        (guest, chat): {'recovery': recovery('e' * 43)},
      };
      const channel = MethodChannel('jovian/legacy_reading');
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      final calls = <(String, String, String)>[];
      var failClear = true;
      messenger.setMockMethodCallHandler(channel, (call) async {
        final owner = call.arguments['owner'] as String;
        final chat = call.arguments['chatId'] as String;
        calls.add((call.method, owner, chat));
        if (call.method == 'read')
          return records[(owner, chat)] ?? <String, String>{};
        expect(call.method, 'clear');
        if (chat == 'pending-file' && failClear) {
          throw PlatformException(code: 'legacy_reading_cleanup_failed');
        }
        records.remove((owner, chat));
        return null;
      });
      addTearDown(() => messenger.setMockMethodCallHandler(channel, null));

      final history = File.fromUri(
        directory.uri.resolve('jovian.divination.history.v2.$member.json'),
      );
      final pending = File.fromUri(
        directory.uri.resolve('jovian.divination.history.v2.$member.tmp'),
      );
      await history.writeAsString(
        jsonEncode({
          'activeId': chat,
          'threads': [
            {
              'id': chat,
              'updatedAt': 1700000000000,
              'messages': [
                {'id': 2, 'kind': 'readingSession', 'snapshot': firstToss},
              ],
            },
          ],
        }),
      );
      // An interrupted RN file move can leave a different active chat in .tmp.
      await pending.writeAsString(
        jsonEncode({
          'activeId': 'pending-file',
          'threads': [
            {'id': '../outside-owner'},
          ],
        }),
      );

      final store = createReadingRecovery(
        _base,
        ownerScope: 'member:$owner',
        legacyDirectory: legacyDirectory,
      );
      final guide = service.connect(store);
      addTearDown(guide.dispose);
      await guide.restore();
      final conversation = guide.legacyConversations.single;
      service.calls.clear();
      expect(
        await guide.resumeLegacyReading(
          conversation,
          conversation.messages.single,
        ),
        isNull,
      );
      expect(calls, [('read', member, chat)]);
      expect(guide.reading!.snapshot.tosses.length, 2);
      expect(service.calls, [
        'GET /reading',
        'POST /reading/toss',
        'GET /reading',
      ]);
      expect((await store.read())!.threadId, 'import-rn-$chat-2');

      calls.clear();
      expect(
        await memberReadingTokens(owner, legacyDirectory: legacyDirectory),
        unorderedEquals([token, originalToken, savedNextToken]),
      );
      expect(calls, [
        ('read', member, 'original'),
        ('read', member, chat),
        ('read', member, 'pending-file'),
      ]);

      await expectLater(
        clearMemberReadingData(owner, legacyDirectory: legacyDirectory),
        throwsA(isA<PlatformException>()),
      );
      expect(await history.exists(), isTrue);
      expect(await pending.exists(), isTrue);
      failClear = false;
      await clearMemberReadingData(owner, legacyDirectory: legacyDirectory);
      expect(await history.exists(), isFalse);
      expect(await pending.exists(), isFalse);
      expect(await store.read(), isNull);
      expect(records.keys, unorderedEquals([(other, chat), (guest, chat)]));
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
        attachmentNames: ['$id.txt'],
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
