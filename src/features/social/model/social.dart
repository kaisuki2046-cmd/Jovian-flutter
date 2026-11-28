import 'dart:typed_data';

part 'messages.dart';

final _userId = RegExp(r'^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$');
final socialUid = RegExp(r'^[1-9]\d{7}$');

enum SocialList { following, followers }

typedef SocialCounts = ({int following, int followers});

class BlockedMember {
  const BlockedMember(this.id, this.uid);
  final String id;
  final String? uid;

  factory BlockedMember.fromJson(Object? value) {
    final json = _object(value);
    final uid = _optionalString(json, 'uid');
    return BlockedMember(
      _id(json['id']),
      uid != null && socialUid.hasMatch(uid) ? uid : null,
    );
  }
}

SocialCounts decodeSocialCounts(Map<String, Object?> json) => (
  following: _count(json['following']),
  followers: _count(json['followers']),
);

enum SocialSearchMode { uid, nickname }

enum SocialReportReason {
  harassment('骚扰'),
  impersonation('冒充他人'),
  spam('垃圾信息'),
  other('其他');

  const SocialReportReason(this.label);
  final String label;
}

enum SocialReportStatus {
  pending('待处理'),
  resolved('已处理'),
  dismissed('未发现违规');

  const SocialReportStatus(this.label);
  final String label;
}

class SocialRelation {
  const SocialRelation({
    required this.following,
    required this.followers,
    required this.follows,
    required this.followedBy,
  });

  factory SocialRelation.fromJson(Map<String, Object?> json) {
    final follows = json['follows'];
    final followedBy = json['followedBy'];
    if (follows is! bool || followedBy is! bool) {
      throw const FormatException('Invalid social relation');
    }
    final counts = decodeSocialCounts(json);
    return SocialRelation(
      following: counts.following,
      followers: counts.followers,
      follows: follows,
      followedBy: followedBy,
    );
  }

  final int following;
  final int followers;
  final bool follows;
  final bool followedBy;

  String get followLabel =>
      follows ? (followedBy ? '互相关注' : '已关注') : (followedBy ? '回关' : '关注');
}

class SocialProfile {
  const SocialProfile({
    required this.id,
    required this.relation,
    this.uid,
    this.displayName,
    this.bio,
  });

  factory SocialProfile.fromJson(Object? value) {
    final json = _object(value);
    final uid = json['uid'];
    return SocialProfile(
      id: _id(json['id']),
      uid: uid is String && socialUid.hasMatch(uid) ? uid : null,
      displayName: _optionalString(json, 'displayName'),
      bio: _optionalString(json, 'bio'),
      relation: SocialRelation.fromJson(json),
    );
  }

  final String id;
  final String? uid;
  final String? displayName;
  final String? bio;
  final SocialRelation relation;

  String get name => displayName?.isNotEmpty == true ? displayName! : '木星环用户';

  SocialProfile withRelation(SocialRelation value) => SocialProfile(
    id: id,
    uid: uid,
    displayName: displayName,
    bio: bio,
    relation: value,
  );
}

class SocialResultPage<T> {
  const SocialResultPage(this.items, this.next);

  factory SocialResultPage.fromJson(
    Map<String, Object?> json,
    T Function(Object?) decode,
  ) => SocialResultPage(
    decodeSocialItems(json, decode),
    _optionalString(json, 'next'),
  );

  final List<T> items;
  final String? next;
}

List<T> decodeSocialItems<T>(
  Map<String, Object?> json,
  T Function(Object?) decode,
) {
  final items = json['items'];
  if (items is! List) throw const FormatException('Invalid social result list');
  return items.map(decode).toList(growable: false);
}

class FollowerAlert {
  const FollowerAlert({
    required this.id,
    required this.createdAt,
    required this.readAt,
    this.actor,
  });

  factory FollowerAlert.fromJson(Object? value) {
    final json = _object(value);
    return FollowerAlert(
      id: _id(json['id']),
      createdAt: _date(json['createdAt']),
      readAt: json['readAt'] == null ? null : _date(json['readAt']),
      actor: json.containsKey('actor')
          ? SocialProfile.fromJson(json['actor'])
          : null,
    );
  }

  final String id;
  final DateTime createdAt;
  final DateTime? readAt;
  final SocialProfile? actor;

  FollowerAlert markRead(DateTime now) => FollowerAlert(
    id: id,
    createdAt: createdAt,
    readAt: readAt ?? now,
    actor: actor,
  );
}

class SocialInboxSummary {
  const SocialInboxSummary(
    this.unread,
    this.canModerate, {
    this.conversationsEnabled = false,
  });

  factory SocialInboxSummary.fromJson(Map<String, Object?> json) =>
      SocialInboxSummary(
        decodeUnread(json),
        json['canModerate'] == true,
        conversationsEnabled: json['conversations'] == true,
      );

  final int unread;
  final bool canModerate;
  final bool conversationsEnabled;
}

int decodeUnread(Map<String, Object?> json) => _count(json['unread']);

class SocialReport {
  const SocialReport({
    required this.id,
    required this.reason,
    required this.status,
    required this.createdAt,
    required this.reviewedAt,
    this.conclusion,
    this.targetId,
    this.detail,
  });

  factory SocialReport.fromJson(Object? value, {bool moderation = false}) {
    final json = _object(value);
    if (moderation) _id(json['reporterId']);
    return SocialReport(
      id: _id(json['id']),
      reason: _enumValue(json['reason'], SocialReportReason.values),
      status: _enumValue(json['status'], SocialReportStatus.values),
      createdAt: _date(json['createdAt']),
      reviewedAt: json['reviewedAt'] == null ? null : _date(json['reviewedAt']),
      conclusion: json['conclusion'] == null
          ? null
          : _string(json['conclusion']),
      targetId: moderation ? _id(json['targetId']) : null,
      detail: moderation ? _string(json['detail']) : null,
    );
  }

  final String id;
  final SocialReportReason reason;
  final SocialReportStatus status;
  final DateTime createdAt;
  final DateTime? reviewedAt;
  final String? conclusion;
  final String? targetId;
  final String? detail;
}

Map<String, Object?> _object(Object? value) {
  if (value is Map<String, Object?>) return value;
  throw const FormatException('Invalid social object');
}

String _string(Object? value) {
  if (value is String) return value;
  throw const FormatException('Invalid social text');
}

String? _optionalString(Map<String, Object?> json, String field) =>
    json.containsKey(field) ? _string(json[field]) : null;

int _count(Object? value) {
  if (value is int && value >= 0 && value <= 9007199254740991) return value;
  throw const FormatException('Invalid social count');
}

DateTime _date(Object? value) {
  if (value is int && value >= -8640000000000000 && value <= 8640000000000000) {
    return DateTime.fromMillisecondsSinceEpoch(value, isUtc: true);
  }
  throw const FormatException('Invalid social timestamp');
}

String _id(Object? value) {
  if (value is String && _userId.hasMatch(value)) return value;
  throw const FormatException('Invalid social identifier');
}

T _enumValue<T extends Enum>(Object? value, List<T> values) =>
    values.firstWhere(
      (candidate) => candidate.name == value,
      orElse: () => throw const FormatException('Invalid social report value'),
    );
