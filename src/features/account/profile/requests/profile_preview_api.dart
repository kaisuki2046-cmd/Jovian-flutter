import '../../auth/requests/account_api.dart';
import '../model/profile_preview.dart';

class ProfilePreviewApi {
  const ProfilePreviewApi(this._account);
  final AccountApi _account;

  Future<ProfilePreview> preview(
    String member, {
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async => ProfilePreview.fromResponse(
    await _account.readAsMember(
      ['profile', 'preview'],
      member,
      isCurrent: isCurrent,
      cancel: cancel,
    ),
  );

  Future<VisitorProfile> visitor(
    String member,
    String target, {
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async => VisitorProfile.fromResponse(
    await _account.readAsMember(
      ['profile', 'visible', target],
      member,
      isCurrent: isCurrent,
      cancel: cancel,
    ),
  );
}
