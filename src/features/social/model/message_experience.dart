import 'dart:typed_data';

import 'social.dart';

enum MessageTheme { paper, lilac, moss }

enum MessageBubbleStyle { rounded, outlined, note }

class ChatAppearance {
  const ChatAppearance({
    this.theme = MessageTheme.paper,
    this.bubble = MessageBubbleStyle.rounded,
    this.wallpaper,
  });

  final MessageTheme theme;
  final MessageBubbleStyle bubble;
  final Uint8List? wallpaper;
}

class MessageStory {
  const MessageStory({
    required this.id,
    required this.author,
    required this.text,
    required this.createdAt,
    required this.tone,
    this.contact,
    this.place,
    this.image,
  });

  final String id;
  final String author;
  final String text;
  final DateTime createdAt;
  final int tone;
  final String? contact;
  final String? place;
  final Uint8List? image;
}

class MessageExperienceGroup {
  const MessageExperienceGroup(
    this.id,
    this.name,
    this.description,
    this.members,
    this.tone,
  );

  final String id;
  final String name;
  final String description;
  final int members;
  final int tone;
}

class MessageNotice {
  const MessageNotice(this.title, this.detail, this.time, {this.conversation});

  final String title;
  final String detail;
  final String time;
  final String? conversation;
}

enum MessageNoticeChannel { activity, orders, events }

enum MessageCollection { history, saved, later }

enum GroupMessageMark { pinned, saved }

enum MessageActivity { watch, play, sing, duet, exchange }

class MessageSticker {
  const MessageSticker(this.id, {this.symbol, this.attachment});

  final String id;
  final String? symbol;
  final OutgoingMessageAttachment? attachment;
}

const messageStickers = [
  MessageSticker('moon', symbol: '🌙'),
  MessageSticker('shy', symbol: '😳'),
  MessageSticker('wave', symbol: '👋'),
  MessageSticker('star', symbol: '💫'),
  MessageSticker('spark', symbol: '✨'),
  MessageSticker('heart', symbol: '🫶'),
  MessageSticker('tea', symbol: '🍵'),
  MessageSticker('yes', symbol: '👍'),
  MessageSticker('rose', symbol: '🌹'),
  MessageSticker('laugh', symbol: '😄'),
  MessageSticker('orange', symbol: '🍊'),
  MessageSticker('comet', symbol: '☄️'),
  MessageSticker('sprout', symbol: '🌱'),
  MessageSticker('telescope', symbol: '🔭'),
  MessageSticker('ring', symbol: '🪐'),
  MessageSticker('cloud', symbol: '☁️'),
  MessageSticker('party', symbol: '🎉'),
  MessageSticker('bow', symbol: '💝'),
  MessageSticker('rain', symbol: '🌧️'),
  MessageSticker('cake', symbol: '🍰'),
  MessageSticker('books', symbol: '📚'),
  MessageSticker('cat', symbol: '🐈'),
  MessageSticker('lantern', symbol: '🏮'),
  MessageSticker('satellite', symbol: '🛰️'),
];

const messageRecommendedGroups = [
  MessageExperienceGroup('sky-study', '星图练习室', '一起辨认每月夜空中的星座', 28, 1),
  MessageExperienceGroup('slow-walk', '慢走俱乐部', '交换下班后半小时的散步路线', 16, 2),
  MessageExperienceGroup('book-lines', '一页交换所', '每天分享一句读到的话', 34, 0),
  MessageExperienceGroup('night-radio', '晚安电台', '睡前一起听现场录音', 12, 3),
];
