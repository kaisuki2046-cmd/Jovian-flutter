import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../../account/account.dart';
import '../model/social.dart';

class SocialApi {
  const SocialApi(this._account, this.memberId);

  final AccountController _account;
  final String memberId;
  Listenable get sessionChanges => _account;
  bool get isCurrentMember => _account.memberId == memberId;

  Future<Map<String, Object?>> _request(
    List<String> path, {
    Map<String, Object?>? body,
    Map<String, String>? query,
  }) => _account.requestSocial(memberId, path, body: body, query: query);

  Future<SocialInboxSummary> inbox() async =>
      SocialInboxSummary.fromJson(await _request(['notifications', 'summary']));

  Future<SocialResultPage<MessageConversation>> conversations({
    String? before,
    String query = '',
    bool unreadOnly = false,
  }) async => SocialResultPage.fromJson(
    await _request(
      ['conversations'],
      query: {
        if (before != null) 'before': before,
        if (query.isNotEmpty) 'q': query,
        if (unreadOnly) 'unread': '1',
      },
    ),
    MessageConversation.fromJson,
  );

  Future<MessageConversation> startChat(Map<String, Object?> details) async =>
      MessageConversation.fromJson(
        (await _request(['conversations'], body: details))['thread'],
      );

  Future<SocialResultPage<ConversationMessage>> messages(
    String id,
    String? before,
  ) async => SocialResultPage.fromJson(
    await _request([
      'conversations',
      id,
      'messages',
    ], query: before == null ? null : {'before': before}),
    ConversationMessage.fromJson,
  );

  Future<ConversationMessage> sendMessage(
    String id, {
    required String body,
    required String nonce,
    int? replyTo,
    OutgoingMessageAttachment? attachment,
  }) async => ConversationMessage.fromJson(
    (await _request(
      ['conversations', id, 'messages'],
      body: {
        'body': body,
        'nonce': nonce,
        if (replyTo != null) 'replyTo': replyTo,
        if (attachment != null)
          'attachment': {
            'kind': attachment.details.kind.name,
            'name': attachment.details.name,
            'type': attachment.details.type,
            'data': base64Encode(attachment.bytes),
          },
      },
    ))['message'],
  );

  Future<void> readConversation(String id, int through) async {
    await _request(['conversations', id, 'read'], body: {'through': through});
  }

  Future<void> pinConversation(String id, bool pinned) async {
    final response = await _request(
      ['conversations', id, 'pin'],
      body: {'pinned': pinned},
    );
    if (response['pinned'] != pinned)
      throw const FormatException('Invalid pin result');
  }

  Future<List<ConversationMember>> conversationMembers(String id) async =>
      decodeSocialItems(
        await _request(['conversations', id, 'members']),
        ConversationMember.fromJson,
      );

  Future<Uint8List> messageAttachment(
    String id,
    ConversationMessage message,
  ) async {
    final meta = message.attachment;
    if (meta == null) throw const FormatException('Missing attachment');
    final response = await _request([
      'conversations',
      id,
      'attachment',
      message.id.toString(),
    ]);
    final data = response['data'];
    if (data is! String || data.length != (meta.size + 2) ~/ 3 * 4) {
      throw const FormatException('Invalid attachment payload');
    }
    final bytes = base64Decode(data);
    if (bytes.length != meta.size)
      throw const FormatException('Invalid attachment length');
    return bytes;
  }

  Future<SocialCounts> counts() async =>
      decodeSocialCounts(await _request(['me']));

  Future<bool> discoverability() async => _discoverable(await _request(['me']));

  Future<bool> setDiscoverability(bool value) async => _discoverable(
    await _request(['discoverability'], body: {'allowed': value}),
  );

  bool _discoverable(Map<String, Object?> data) {
    if (data['discoverable'] case final bool value) return value;
    throw const FormatException('Invalid discoverability setting.');
  }

  Future<List<BlockedMember>> blockedMembers() async =>
      decodeSocialItems(await _request(['blocks']), BlockedMember.fromJson);

  Future<SocialResultPage<FollowerAlert>> notifications(String? before) async {
    final json = await _request([
      'notifications',
    ], query: before == null ? null : {'before': before});
    decodeUnread(json);
    return SocialResultPage.fromJson(json, FollowerAlert.fromJson);
  }

  Future<void> markRead(String? id) async {
    decodeUnread(
      await _request([
        'notifications',
        'read',
      ], body: id == null ? {'all': true} : {'id': id}),
    );
  }

  Future<List<SocialProfile>> search(
    SocialSearchMode mode,
    String query,
  ) async {
    final json = await _request(['search'], query: {mode.name: query});
    return mode == SocialSearchMode.uid
        ? [SocialProfile.fromJson(json)]
        : decodeSocialItems(json, SocialProfile.fromJson);
  }

  Future<SocialProfile> profile(String id) async {
    final profile = SocialProfile.fromJson(await _request(['profiles', id]));
    if (profile.id != id) throw const FormatException('Invalid profile owner');
    return profile;
  }

  Future<VisitorProfile> publicProfile(String id, {Future<void>? cancel}) =>
      _account.readVisitorProfile(memberId, id, cancel: cancel);

  Future<SocialRelation> follow(String id, bool active) async =>
      SocialRelation.fromJson(
        await _request(['follows'], body: {'id': id, 'active': active}),
      );

  Future<void> block(String id, {bool active = true}) async {
    final response = await _request(
      ['blocks'],
      body: {'id': id, 'active': active},
    );
    if (response['blocked'] != active)
      throw const FormatException('Invalid social block status');
  }

  Future<SocialReport> report(
    String id,
    SocialReportReason reason,
    String detail,
  ) async {
    final json = await _request(
      ['reports'],
      body: {'id': id, 'reason': reason.name, 'detail': detail},
    );
    return SocialReport.fromJson(json['report']);
  }

  Future<SocialResultPage<SocialReport>> reports(String? before) async =>
      _reports(before, moderation: false);

  Future<SocialResultPage<SocialReport>> moderation(String? before) async =>
      _reports(before, moderation: true);

  Future<SocialResultPage<SocialReport>> _reports(
    String? before, {
    required bool moderation,
  }) async => SocialResultPage.fromJson(
    await _request([
      if (moderation) 'moderation',
      'reports',
    ], query: before == null ? null : {'before': before}),
    (value) => SocialReport.fromJson(value, moderation: moderation),
  );

  Future<SocialReport> review(
    String id,
    SocialReportStatus status,
    String conclusion,
  ) async {
    final report = SocialReport.fromJson(
      await _request(
        ['moderation', 'reports'],
        body: {'id': id, 'status': status.name, 'conclusion': conclusion},
      ),
    );
    if (report.id != id) throw const FormatException('Invalid reviewed report');
    return report;
  }

  Future<SocialResultPage<SocialProfile>> list(
    SocialList direction,
    String? before,
  ) async => SocialResultPage.fromJson(
    await _request([
      direction.name,
    ], query: before == null ? null : {'before': before}),
    SocialProfile.fromJson,
  );
}
