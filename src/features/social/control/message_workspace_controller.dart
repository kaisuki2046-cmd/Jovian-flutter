import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;

import '../model/message_experience.dart';
import '../model/social.dart';
import 'message_settings_storage.dart'
    if (dart.library.js_interop) 'message_settings_storage_web.dart';
import 'social_controller.dart';

const messageOrbitVideo = MessageAttachment(
  kind: MessageMediaKind.video,
  name: '星轨片段.mp4',
  type: 'video/mp4',
  size: 16827,
);

class MessageWorkspaceController extends ChangeNotifier
    implements MessageHistory {
  MessageWorkspaceController(String scope)
    : _storageKey = 'jovian.messages.v1.${Uri.encodeComponent(scope)}' {
    final now = DateTime.now();
    _addChat('demo-cen', '岑宁', unread: 2, members: const ['岑宁']);
    _addChat(
      'demo-sky',
      '晚风观星组',
      group: true,
      unread: 1,
      members: const ['岑宁', '安澄', '乔槐'],
    );
    _addChat('demo-an', '安澄', members: const ['安澄']);
    _addChat('demo-qiao', '乔槐', members: const ['乔槐']);
    _addChat('demo-studio', '星窗工作室', members: const ['星窗工作室']);
    _addMessage(
      'demo-cen',
      '岑宁',
      '今天傍晚的云像一层薄薄的纸。',
      now.subtract(const Duration(hours: 3)),
    );
    _addMessage(
      'demo-cen',
      null,
      '正好适合拿望远镜看月亮。',
      now.subtract(const Duration(hours: 2)),
    );
    _addMessage(
      'demo-cen',
      '岑宁',
      '',
      now.subtract(const Duration(minutes: 26)),
      media: messageOrbitVideo,
    );
    _orbitMessage = _sequence;
    _addMessage(
      'demo-cen',
      '岑宁',
      '我把昨晚的星轨剪成了一小段。',
      now.subtract(const Duration(minutes: 23)),
    );
    _addMessage(
      'demo-sky',
      '安澄',
      '📍 北岸天台',
      now.subtract(const Duration(hours: 2, minutes: 15)),
    );
    _addMessage(
      'demo-sky',
      '乔槐',
      '周五八点集合，我带热茶。',
      now.subtract(const Duration(hours: 2, minutes: 10)),
    );
    _addMessage(
      'demo-an',
      null,
      '《冬夜手记》我已经看完啦。',
      now.subtract(const Duration(hours: 5)),
    );
    _addMessage(
      'demo-an',
      '安澄',
      '🌙',
      now.subtract(const Duration(hours: 4, minutes: 15)),
    );
    _addMessage(
      'demo-qiao',
      '乔槐',
      '心愿清单写好之后，我发你一份。',
      now.subtract(const Duration(days: 1, hours: 2)),
    );
    _addMessage(
      'demo-studio',
      '星窗工作室',
      '你预约的线上观星活动已确认。',
      now.subtract(const Duration(days: 2)),
    );
    _streaks.addAll({'demo-cen': 12, 'demo-an': 5});
    _stories.addAll([
      MessageStory(
        id: 'dawn',
        author: '岑宁',
        contact: 'demo-cen',
        tone: 0,
        createdAt: now.subtract(const Duration(minutes: 32)),
        text: '天快亮的时候，天台上的风反倒慢了下来。',
        place: '北岸天台',
      ),
      MessageStory(
        id: 'tea',
        author: '安澄',
        contact: 'demo-an',
        tone: 1,
        createdAt: now.subtract(const Duration(hours: 2)),
        text: '今天的计划只有一件事：把茶喝慢一点。',
      ),
      MessageStory(
        id: 'street',
        author: '乔槐',
        contact: 'demo-qiao',
        tone: 2,
        createdAt: now.subtract(const Duration(hours: 4)),
        text: '街角那家旧书铺，点亮了冬天第一盏灯。',
        place: '松径书屋',
      ),
      MessageStory(
        id: 'guide',
        author: '星窗工作室',
        contact: 'demo-studio',
        tone: 3,
        createdAt: now.subtract(const Duration(hours: 6)),
        text: '十一月的星图，已经放在观星小组里。',
      ),
    ]);
    unawaited(_restore());
  }

  final String _storageKey;
  final _conversations = <String, MessageConversation>{};
  final _messages = <String, List<ConversationMessage>>{};
  final _people = <String, List<String>>{};
  final _attachments = <int, OutgoingMessageAttachment>{};
  final _sent = <(String, String), ConversationMessage>{};
  final _looks = <String, ChatAppearance>{};
  final _stories = <MessageStory>[];
  final _seenStories = <String>{};
  final _reactions = <String, String>{};
  final _favorites = <String>{};
  final _groupMarks = <String, Map<GroupMessageMark, Set<int>>>{};
  final _friends = {'demo-cen', 'demo-an'};
  final _streaks = <String, int>{};
  final _streakDays = <String, String>{};
  final _claimed = <String, String>{};
  final _openedNotices = <MessageNoticeChannel>{};
  final _collections = <MessageCollection, Set<String>>{};
  final _ledger = <String>[];
  final _coupons = {'气泡试用券', '星伴换装券'};
  final _customStickers = <MessageSticker>[];
  final _temporaryFiles = <Future<void> Function()>[];
  Future<void> _writes = Future.value();
  int _points = 120;
  int _sequence = 0;
  late final int _orbitMessage;
  bool _disposed = false;
  int _revision = 0;
  Uint8List? _avatar;
  String _companion = '月芽';

  @override
  String get memberId => 'demo-self';
  @override
  bool get isCurrentMember => !_disposed;

  int get points => _points;
  Uint8List? get avatar => _avatar;
  String get companion => _companion;
  List<String> get ledger => List.unmodifiable(_ledger);
  List<String> get coupons => _coupons.toList();
  List<MessageStory> get stories => _stories
      .where(
        (story) =>
            DateTime.now().difference(story.createdAt) <
            const Duration(hours: 24),
      )
      .toList();
  List<MessageSticker> get stickers => [...messageStickers, ..._customStickers];

  @override
  void dispose() {
    _disposed = true;
    for (final release in _temporaryFiles) {
      unawaited(release());
    }
    super.dispose();
  }

  void retainTemporaryFile(Future<void> Function() release) {
    if (_disposed) {
      unawaited(release());
    } else {
      _temporaryFiles.add(release);
    }
  }

  bool isDemo(String id) => _conversations.containsKey(id);
  bool isFriend(String id) => _friends.contains(id);
  void addFriend(String id) {
    if (_friends.add(id)) _changed(save: true);
  }

  MessageConversation? conversation(String id) => _conversations[id];
  ChatAppearance appearance(String id) =>
      _looks[id] ?? _looks['default'] ?? const ChatAppearance();
  void setAppearance(String id, ChatAppearance look) {
    _looks[id] = look;
    _changed(save: true);
  }

  void setAvatar(Uint8List? image) {
    _avatar = image;
    _changed(save: true);
  }

  bool isFavorite(String id) => _favorites.contains(id);
  void favorite(String id) {
    if (!_favorites.remove(id)) _favorites.add(id);
    _changed(save: true);
  }

  Set<int> groupMessageIds(String thread, GroupMessageMark mark) =>
      Set.unmodifiable(_groupMarks[thread]?[mark] ?? const <int>{});

  void toggleGroupMessage(String thread, int id, GroupMessageMark mark) {
    final marks = _groupMarks.putIfAbsent(thread, () => {});
    final ids = marks.putIfAbsent(mark, () => {});
    if (!ids.remove(id)) {
      ids.add(id);
    } else if (ids.isEmpty) {
      marks.remove(mark);
      if (marks.isEmpty) _groupMarks.remove(thread);
    }
    _changed(save: !isDemo(thread));
  }

  void addSticker(OutgoingMessageAttachment attachment) {
    if (_customStickers.length >= 6)
      throw const SocialInputError('最多保存 6 张自定义贴纸。');
    _customStickers.add(
      MessageSticker(newMessageNonce(), attachment: attachment),
    );
    _changed(save: true);
  }

  int streak(String thread) => _streaks[thread] ?? 0;

  void connect(String thread) {
    if (streak(thread) > 0) return;
    _streaks[thread] = 1;
    _streakDays[thread] = _today;
    _changed(save: true);
  }

  void registerExchange(String thread) {
    if (streak(thread) == 0 || _streakDays[thread] == _today) return;
    _streaks[thread] = streak(thread) + 1;
    _streakDays[thread] = _today;
    _changed(save: true);
  }

  String get _today => DateTime.now().toIso8601String().substring(0, 10);
  bool claimed(String thread) => _claimed[thread] == _today;

  bool collect(String thread) {
    if (streak(thread) == 0 || claimed(thread)) return false;
    _claimed[thread] = _today;
    _points += 10;
    _ledger.insert(0, '星伴奖励 +10');
    _changed(save: true);
    return true;
  }

  void dress(String name) {
    _companion = name;
    _changed(save: true);
  }

  bool usePoints(int amount, String label) {
    if (amount <= 0 || amount > _points) return false;
    _points -= amount;
    _ledger.insert(0, '$label −$amount');
    _changed(save: true);
    return true;
  }

  bool redeem(String coupon) {
    if (!_coupons.remove(coupon)) return false;
    _points += 8;
    _ledger.insert(0, '$coupon +8');
    _changed(save: true);
    return true;
  }

  void openStory(String id) {
    if (_seenStories.add(id)) _changed();
  }

  bool sawStory(String id) => _seenStories.contains(id);
  String? reaction(String id) => _reactions[id];

  void react(String id, String symbol) {
    if (_reactions[id] == symbol) {
      _reactions.remove(id);
    } else {
      _reactions[id] = symbol;
    }
    _changed();
  }

  MessageStory? get ownStory =>
      stories.where((story) => story.contact == null).firstOrNull;

  void publishStory(String text, {String? place, Uint8List? image}) {
    _stories.removeWhere((story) => story.contact == null);
    _stories.insert(
      0,
      MessageStory(
        id: newMessageNonce(),
        author: '我的动态',
        text: text,
        createdAt: DateTime.now(),
        tone: 0,
        place: place,
        image: image,
      ),
    );
    _changed(save: true);
  }

  void removeOwnStory() {
    _stories.removeWhere((story) => story.contact == null);
    _changed(save: true);
  }

  List<MessageConversation> conversations({bool unreadOnly = false}) {
    return _conversations.values
        .where((thread) => !unreadOnly || thread.unread > 0)
        .toList()
      ..sort(
        (a, b) => a.pinned == b.pinned
            ? b.updatedAt.compareTo(a.updatedAt)
            : a.pinned
            ? -1
            : 1,
      );
  }

  List<MessageConversation> search(String term) {
    final query = term.trim().toLowerCase();
    if (query.isEmpty) return conversations();
    return [
      for (final thread in conversations())
        if (thread.title?.toLowerCase().contains(query) == true)
          thread
        else if (_messages[thread.id]
                ?.where((message) => message.body.toLowerCase().contains(query))
                .firstOrNull
            case final match?)
          MessageConversation(
            id: thread.id,
            kind: thread.kind,
            title: thread.title,
            updatedAt: thread.updatedAt,
            preview: thread.preview,
            previewKind: thread.previewKind,
            unread: thread.unread,
            pinned: thread.pinned,
            matchText: match.body,
            matchId: match.id,
          ),
    ];
  }

  MessageConversation join(MessageExperienceGroup group) {
    final id = 'demo-${group.id}';
    if (_conversations[id] case final existing?) return existing;
    _addChat(id, group.name, group: true, members: const ['岑宁', '安澄']);
    _addMessage(id, '安澄', '欢迎来${group.name}！', DateTime.now());
    _changed();
    return _conversations[id]!;
  }

  MessageConversation createGroup(String title, List<String> members) {
    final id = 'demo-group-${newMessageNonce()}';
    _addChat(id, title.trim(), group: true, members: members);
    _addMessage(id, null, '群聊已创建', DateTime.now());
    _changed();
    return _conversations[id]!;
  }

  List<MessageNotice> notices(
    MessageNoticeChannel channel,
  ) => switch (channel) {
    MessageNoticeChannel.activity => const [
      MessageNotice('岑宁给你的动态点了赞', '刚才发布的星空手记', '刚刚', conversation: 'demo-cen'),
      MessageNotice('安澄分享了一段星轨', '打开会话查看分享', '今天', conversation: 'demo-an'),
      MessageNotice('晚风观星组提到了你', '周五天台观星集合提醒', '今天', conversation: 'demo-sky'),
    ],
    MessageNoticeChannel.orders => const [
      MessageNotice('观星手记 · 演示订单', '可在券包查看附赠的主题试用券', '今天'),
      MessageNotice('散步地图 · 电子版', '演示订单已归档', '昨天'),
    ],
    MessageNoticeChannel.events => const [
      MessageNotice('夜空练习课', '线上观星活动预约已确认', '今天', conversation: 'demo-studio'),
      MessageNotice('周末散步提案', '查看本周的集合安排', '昨天', conversation: 'demo-qiao'),
    ],
  };

  bool hasNotice(MessageNoticeChannel channel) =>
      !_openedNotices.contains(channel);
  void readNotices(MessageNoticeChannel channel) {
    if (_openedNotices.add(channel)) _changed();
  }

  Set<String> collection(MessageCollection kind) =>
      Set.unmodifiable(_collections[kind] ?? const <String>{});
  void toggleCollection(MessageCollection kind, String title) {
    final items = _collections.putIfAbsent(kind, () => {});
    if (!items.remove(title)) items.add(title);
    _changed(save: true);
  }

  void addHistory(String title) {
    final items = _collections.putIfAbsent(MessageCollection.history, () => {});
    items.remove(title);
    items.add(title);
    _changed(save: true);
  }

  @override
  Future<SocialResultPage<ConversationMessage>> messages(
    String thread, {
    String? before,
  }) async {
    final list = _messages[thread] ?? const [];
    final cursor = int.tryParse(before ?? '');
    final rows = list
        .where((row) => cursor == null || row.id < cursor)
        .take(31)
        .toList();
    return SocialResultPage(
      rows.take(30).toList(),
      rows.length > 30 ? rows[29].id.toString() : null,
    );
  }

  @override
  Future<ConversationMessage> sendMessage(
    String thread, {
    required String body,
    required String nonce,
    int? replyTo,
    OutgoingMessageAttachment? attachment,
  }) async {
    final key = (thread, nonce);
    if (_sent[key] case final saved?) return saved;
    final previous = _messages[thread]
        ?.where((row) => row.id == replyTo)
        .firstOrNull;
    final row = _addMessage(
      thread,
      null,
      body.trim(),
      DateTime.now(),
      media: attachment?.details,
      reply: previous == null
          ? null
          : MessageQuote(
              previous.senderName,
              previous.body,
              previous.attachment?.kind,
            ),
    );
    if (attachment != null) _attachments[row.id] = attachment;
    _sent[key] = row;
    registerExchange(thread);
    _changed();
    return row;
  }

  @override
  Future<void> markConversationRead(String thread, int through) async {
    if (_conversations[thread]?.unread == 0) return;
    _updateConversation(thread, unread: 0);
    _changed();
  }

  @override
  Future<void> pinConversation(String thread, bool pinned) async {
    _updateConversation(thread, pinned: pinned);
    _changed();
  }

  @override
  Future<List<ConversationMember>> conversationMembers(String thread) async => [
    const ConversationMember('demo-self', '我'),
    for (final name in _people[thread] ?? const <String>[])
      ConversationMember(name, name),
  ];

  @override
  Future<Uint8List> loadMessageAttachment(
    String thread,
    ConversationMessage message,
  ) async {
    if (message.id == _orbitMessage) return loadOrbitVideo();
    final cached = _attachments[message.id];
    if (cached != null) return cached.bytes;
    throw const FormatException('Missing demo attachment');
  }

  void _addChat(
    String id,
    String name, {
    bool group = false,
    int unread = 0,
    required List<String> members,
  }) {
    _conversations[id] = MessageConversation(
      id: id,
      kind: group ? ConversationKind.group : ConversationKind.direct,
      title: name,
      updatedAt: DateTime.now(),
      preview: null,
      previewKind: null,
      unread: unread,
      pinned: false,
      matchText: null,
      matchId: null,
    );
    _people[id] = members;
    _messages[id] = [];
  }

  ConversationMessage _addMessage(
    String id,
    String? sender,
    String body,
    DateTime when, {
    MessageAttachment? media,
    MessageQuote? reply,
  }) {
    final message = ConversationMessage(
      id: ++_sequence,
      senderId: sender ?? memberId,
      senderName: sender ?? '我',
      sentAt: when,
      body: body,
      attachment: media,
      reply: reply,
    );
    _messages[id]!.insert(0, message);
    _updateConversation(id, last: message);
    return message;
  }

  void _updateConversation(
    String id, {
    int? unread,
    bool? pinned,
    ConversationMessage? last,
  }) {
    final old = _conversations[id]!;
    _conversations[id] = MessageConversation(
      id: id,
      kind: old.kind,
      title: old.title,
      updatedAt: last?.sentAt ?? old.updatedAt,
      preview: last?.body ?? old.preview,
      previewKind: last == null ? old.previewKind : last.attachment?.kind,
      unread: unread ?? old.unread,
      pinned: pinned ?? old.pinned,
      matchText: null,
      matchId: null,
    );
  }

  void _changed({bool save = false}) {
    if (_disposed) return;
    if (save) {
      _revision++;
      final data = jsonEncode({
        'points': _points,
        'ledger': _ledger.take(36).toList(),
        'coupons': coupons,
        'companion': _companion,
        'avatar': _avatar == null ? null : base64Encode(_avatar!),
        'looks': _looks.map(
          (key, look) => MapEntry(key, {
            'theme': look.theme.name,
            'bubble': look.bubble.name,
            if (look.wallpaper case final image?)
              'wallpaper': base64Encode(image),
          }),
        ),
        'favorite': _favorites.toList(),
        'groupMarks': {
          for (final MapEntry(:key, :value) in _groupMarks.entries)
            if (!isDemo(key))
              key: value.map((mark, ids) => MapEntry(mark.name, ids.toList())),
        },
        if (ownStory case final story?)
          'story': {
            'id': story.id,
            'text': story.text,
            'place': story.place,
            'at': story.createdAt.millisecondsSinceEpoch,
            if (story.image case final image?) 'image': base64Encode(image),
          },
        'friends': _friends.toList(),
        'stickers': [
          for (final s in _customStickers)
            {'id': s.id, 'data': base64Encode(s.attachment!.bytes)},
        ],
        'streaks': _streaks,
        'days': _streakDays,
        'claimed': _claimed,
        'collections': _collections.map(
          (key, value) => MapEntry(key.name, value.toList()),
        ),
      });
      _writes = _writes
          .then((_) => writeMessageSettings(_storageKey, data))
          .catchError((Object _) {});
    }
    notifyListeners();
  }

  Future<void> _restore() async {
    try {
      final stored = await readMessageSettings(_storageKey);
      if (stored == null || _disposed || _revision != 0) return;
      final json = jsonDecode(stored) as Map<String, dynamic>;
      _points = json['points'] as int? ?? _points;
      _companion = json['companion'] as String? ?? _companion;
      if (json['avatar'] case final String data) _avatar = base64Decode(data);
      _ledger.addAll((json['ledger'] as List? ?? []).whereType<String>());
      if (json['coupons'] case final List coupons) {
        _coupons
          ..clear()
          ..addAll(coupons.whereType<String>());
      }
      _favorites.addAll((json['favorite'] as List? ?? []).whereType<String>());
      if (json['groupMarks'] case final Map<String, dynamic> groups) {
        for (final MapEntry(:key, :value) in groups.entries) {
          if (value is! Map || isDemo(key)) continue;
          final marks = <GroupMessageMark, Set<int>>{
            for (final mark in GroupMessageMark.values)
              if (value[mark.name] case final List ids)
                mark: ids.whereType<int>().where((id) => id > 0).toSet(),
          };
          marks.removeWhere((_, ids) => ids.isEmpty);
          if (marks.isNotEmpty) _groupMarks[key] = marks;
        }
      }
      if (json['story'] case {
        'id': final String id,
        'text': final String text,
        'at': final int time,
      }) {
        final date = DateTime.fromMillisecondsSinceEpoch(time);
        if (DateTime.now().difference(date) < const Duration(hours: 24)) {
          final row = json['story'] as Map;
          _stories.insert(
            0,
            MessageStory(
              id: id,
              author: '我的动态',
              text: text,
              createdAt: date,
              tone: 0,
              place: row['place'] as String?,
              image: row['image'] is String
                  ? base64Decode(row['image'] as String)
                  : null,
            ),
          );
        }
      }
      _friends.addAll((json['friends'] as List? ?? []).whereType<String>());
      _streaks.addAll((json['streaks'] as Map? ?? {}).cast<String, int>());
      _streakDays.addAll((json['days'] as Map? ?? {}).cast<String, String>());
      _claimed.addAll((json['claimed'] as Map? ?? {}).cast<String, String>());
      for (final MapEntry(:key, :value)
          in (json['looks'] as Map? ?? {}).entries) {
        _looks[key as String] = ChatAppearance(
          theme: MessageTheme.values.byName(value['theme'] as String),
          bubble: MessageBubbleStyle.values.byName(value['bubble'] as String),
          wallpaper: value['wallpaper'] is String
              ? base64Decode(value['wallpaper'] as String)
              : null,
        );
      }
      for (final row in (json['stickers'] as List? ?? []).take(6)) {
        final bytes = base64Decode(row['data'] as String);
        _customStickers.add(
          MessageSticker(
            row['id'] as String,
            attachment: OutgoingMessageAttachment(
              MessageAttachment(
                kind: MessageMediaKind.image,
                name: 'sticker.jpg',
                type: 'image/jpeg',
                size: bytes.length,
              ),
              bytes,
            ),
          ),
        );
      }
      for (final category in MessageCollection.values) {
        _collections[category] =
            ((json['collections'] as Map?)?[category.name] as List? ?? [])
                .whereType<String>()
                .toSet();
      }
      _changed();
    } catch (_) {
      // The workspace is still usable with its defaults if local settings are unavailable.
    }
  }
}

Future<Uint8List> loadOrbitVideo() async {
  final bytes = await rootBundle.load('src/features/social/assets/orbit.mp4');
  return bytes.buffer.asUint8List(bytes.offsetInBytes, bytes.lengthInBytes);
}
