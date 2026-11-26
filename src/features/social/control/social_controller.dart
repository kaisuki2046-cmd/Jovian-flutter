import 'package:flutter/foundation.dart';

import '../../../shared/http/json_client.dart';
import '../../account/account.dart';
import '../model/social.dart';
import '../requests/social_api.dart';

class SocialController {
  const SocialController(this._api);

  SocialController.forMember(AccountController account, String memberId)
    : _api = SocialApi(account, memberId);

  final SocialApi _api;
  String get memberId => _api.memberId;

  Future<SocialInboxSummary> inbox() => _api.inbox();

  Future<SocialCounts> counts() => _api.counts();

  SocialPaginator<FollowerAlert> notifications() =>
      SocialPaginator(_api.notifications, (item) => item.id);

  SocialPaginator<SocialReport> reports({required bool moderation}) =>
      SocialPaginator(
        moderation ? _api.moderation : _api.reports,
        (item) => item.id,
      );

  SocialPaginator<SocialProfile> list(SocialList direction) => SocialPaginator(
    (before) => _api.list(direction, before),
    (item) => item.id,
  );

  Future<void> markRead(
    SocialPaginator<FollowerAlert> notifications,
    String? id,
  ) async {
    await _api.markRead(id);
    final now = DateTime.now();
    notifications.updateItems(
      (items) => [
        for (final item in items)
          if (id == null || item.id == id) item.markRead(now) else item,
      ],
    );
  }

  Future<List<SocialProfile>> search(
    SocialSearchMode mode,
    String input,
  ) async {
    final text = input.trim();
    final query = switch (mode) {
      SocialSearchMode.uid => text.replaceFirst(
        RegExp(r'^UID\s*[·:：]?\s*', caseSensitive: false),
        '',
      ),
      SocialSearchMode.nickname => text,
    };
    if (mode == SocialSearchMode.uid && !socialUid.hasMatch(query)) {
      throw const SocialInputError('请输入完整的 8 位 UID。');
    }
    if (mode == SocialSearchMode.nickname &&
        (query.isEmpty || query.runes.length > 40)) {
      throw const SocialInputError('请输入 1 至 40 个字符的昵称。');
    }
    try {
      return await _api.search(mode, query);
    } on JsonRequestError catch (error) {
      if (error.status == 404) return [];
      rethrow;
    }
  }

  Future<SocialProfile> profile(String id) => _api.profile(id);

  Future<SocialProfile> toggleFollow(SocialProfile profile) async => profile
      .withRelation(await _api.follow(profile.id, !profile.relation.follows));

  Future<void> block(String id) => _api.block(id);

  Future<SocialReport> report(
    String id,
    SocialReportReason reason,
    String detail,
  ) async {
    final description = detail.trim();
    if (description.runes.length > 400) {
      throw const SocialInputError('补充说明最多 400 个字符。');
    }
    return _api.report(id, reason, description);
  }

  Future<void> review(
    SocialPaginator<SocialReport> reports,
    String id,
    SocialReportStatus status,
    String conclusion,
  ) async {
    final contents = conclusion.trim();
    if (contents.isEmpty || contents.runes.length > 400) {
      throw const SocialInputError('请输入 1 至 400 个字符的结论。');
    }
    await _api.review(id, status, contents);
    reports.updateItems(
      (items) => items.where((item) => item.id != id).toList(),
    );
  }
}

class SocialInputError implements Exception {
  const SocialInputError(this.message);
  final String message;
}

String describeSocialError(Object error, String fallback, {String? missing}) =>
    switch (error) {
      SocialInputError(:final message) => message,
      JsonRequestError(status: 401) => '账号已退出或会话已过期，请重新登录。',
      JsonRequestError(status: 403) => '当前账号无权访问此功能。',
      JsonRequestError(status: 404) when missing != null => missing,
      JsonRequestError(status: 428) => '请在个人中心确认最新协议后重试。',
      JsonRequestError(status: 429) => '操作太频繁，请稍后再试。',
      _ => fallback,
    };

class SocialPaginator<T> extends ChangeNotifier {
  SocialPaginator(this._read, this._id);

  final Future<SocialResultPage<T>> Function(String?) _read;
  final String Function(T) _id;
  SocialResultPage<T>? page;
  Object? error;
  bool loading = false;
  bool _disposed = false;

  Future<void> load({bool more = false}) async {
    final before = more ? page?.next : null;
    if (_disposed || loading || (more && before == null)) return;
    loading = true;
    error = null;
    notifyListeners();
    try {
      final result = await _read(before);
      if (_disposed) return;
      if (more && page != null) {
        final previous = page!.items;
        final ids = previous.map(_id).toSet();
        page = SocialResultPage([
          ...previous,
          ...result.items.where((item) => ids.add(_id(item))),
        ], result.next);
      } else {
        page = result;
      }
    } catch (failure) {
      if (_disposed) return;
      if (failure case JsonRequestError(status: 401 || 403 || 428)) {
        page = null;
      }
      error = failure;
    } finally {
      if (!_disposed) {
        loading = false;
        notifyListeners();
      }
    }
  }

  void updateItems(List<T> Function(List<T>) update) {
    final old = page;
    if (_disposed || old == null) return;
    page = SocialResultPage(update(old.items), old.next);
    notifyListeners();
  }

  @override
  void dispose() {
    _disposed = true;
    super.dispose();
  }
}
