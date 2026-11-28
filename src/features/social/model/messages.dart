part of 'social.dart';

const maxMessageLength = 1500;
const maxMessageAttachmentBytes = 5 * 1024 * 1024;

enum ConversationKind { direct, group }

enum MessageMediaKind { image, audio, video, file }

abstract interface class MessageHistory {
  String get memberId;
  bool get isCurrentMember;

  Future<SocialResultPage<ConversationMessage>> messages(
    String thread, {
    String? before,
  });
  Future<ConversationMessage> sendMessage(
    String thread, {
    required String body,
    required String nonce,
    int? replyTo,
    OutgoingMessageAttachment? attachment,
  });
  Future<void> markConversationRead(String thread, int through);
  Future<void> pinConversation(String thread, bool pinned);
  Future<List<ConversationMember>> conversationMembers(String thread);
  Future<Uint8List> loadMessageAttachment(
    String thread,
    ConversationMessage message,
  );
}

class MessageConversation {
  const MessageConversation({
    required this.id,
    required this.kind,
    required this.title,
    required this.updatedAt,
    required this.preview,
    required this.previewKind,
    required this.unread,
    required this.pinned,
    required this.matchText,
    required this.matchId,
  });

  factory MessageConversation.fromJson(Object? value) {
    final json = _object(value);
    final pinned = json['pinned'];
    if (pinned is! bool) throw const FormatException('Invalid pin state');
    return MessageConversation(
      id: _id(json['id']),
      kind: _enumValue(json['kind'], ConversationKind.values),
      title: _nullableText(json['title']),
      updatedAt: _date(json['updatedAt']),
      preview: _nullableText(json['preview']),
      previewKind: _mediaKind(json['previewKind']),
      unread: _count(json['unread']),
      pinned: pinned,
      matchText: _nullableText(json['matchText']),
      matchId: json['matchId'] == null ? null : _count(json['matchId']),
    );
  }

  final String id;
  final ConversationKind kind;
  final String? title;
  final DateTime updatedAt;
  final String? preview;
  final MessageMediaKind? previewKind;
  final int unread;
  final bool pinned;
  final String? matchText;
  final int? matchId;
}

class ConversationMessage {
  const ConversationMessage({
    required this.id,
    required this.senderId,
    required this.senderName,
    required this.sentAt,
    required this.body,
    required this.attachment,
    required this.reply,
  });

  factory ConversationMessage.fromJson(Object? value) {
    final json = _object(value);
    final id = _count(json['id']);
    if (id == 0) throw const FormatException('Invalid message identifier');
    final attachment = json['attachment'];
    final reply = json['reply'];
    return ConversationMessage(
      id: id,
      senderId: _id(json['senderId']),
      senderName: _nullableText(json['senderName']),
      sentAt: _date(json['createdAt']),
      body: _string(json['body']),
      attachment: attachment == null
          ? null
          : MessageAttachment.fromJson(attachment),
      reply: reply == null ? null : MessageQuote.fromJson(reply),
    );
  }

  final int id;
  final String senderId;
  final String? senderName;
  final DateTime sentAt;
  final String body;
  final MessageAttachment? attachment;
  final MessageQuote? reply;
}

class MessageAttachment {
  const MessageAttachment({
    required this.kind,
    required this.name,
    required this.type,
    required this.size,
  });

  factory MessageAttachment.fromJson(Object? value) {
    final json = _object(value);
    final size = _count(json['size']);
    if (size == 0 || size > maxMessageAttachmentBytes) {
      throw const FormatException('Invalid attachment size');
    }
    return MessageAttachment(
      kind: _enumValue(json['kind'], MessageMediaKind.values),
      name: _string(json['name']),
      type: _string(json['type']),
      size: size,
    );
  }

  final MessageMediaKind kind;
  final String name;
  final String type;
  final int size;
}

class OutgoingMessageAttachment {
  const OutgoingMessageAttachment(this.details, this.bytes);
  final MessageAttachment details;
  final Uint8List bytes;
}

class MessageQuote {
  const MessageQuote(this.name, this.body, this.kind);

  factory MessageQuote.fromJson(Object? value) {
    final json = _object(value);
    return MessageQuote(
      _nullableText(json['name']),
      _string(json['body']),
      _mediaKind(json['kind']),
    );
  }

  final String? name;
  final String body;
  final MessageMediaKind? kind;
}

class ConversationMember {
  const ConversationMember(this.id, this.name);

  factory ConversationMember.fromJson(Object? value) {
    final json = _object(value);
    return ConversationMember(_id(json['id']), _nullableText(json['name']));
  }

  final String id;
  final String? name;
}

String? _nullableText(Object? value) => value == null ? null : _string(value);

MessageMediaKind? _mediaKind(Object? value) =>
    value == null ? null : _enumValue(value, MessageMediaKind.values);
