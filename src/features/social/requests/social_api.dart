import '../../account/account.dart';
import '../model/social.dart';

class SocialApi {
  const SocialApi(this._account, this.memberId);

  final AccountController _account;
  final String memberId;

  Future<Map<String, Object?>> _request(
    List<String> path, {
    Map<String, Object?>? body,
    Map<String, String>? query,
  }) => _account.requestSocial(memberId, path, body: body, query: query);

  Future<SocialInboxSummary> inbox() async =>
      SocialInboxSummary.fromJson(await _request(['notifications', 'summary']));

  Future<SocialCounts> counts() async =>
      decodeSocialCounts(await _request(['me']));

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

  Future<SocialRelation> follow(String id, bool active) async =>
      SocialRelation.fromJson(
        await _request(['follows'], body: {'id': id, 'active': active}),
      );

  Future<void> block(String id) async {
    final response = await _request(
      ['blocks'],
      body: {'id': id, 'active': true},
    );
    if (response['blocked'] != true)
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
