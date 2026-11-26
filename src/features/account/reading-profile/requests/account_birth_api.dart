import '../../auth/requests/account_api.dart';
import '../model/account_birth_fields.dart';

class AccountBirthApi {
  const AccountBirthApi(this._account);

  final AccountApi _account;
  static const _path = ['reading-profile', 'birth-profile'];

  Future<AccountBirthFields> read(
    String owner, {
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async => AccountBirthFields.fromJson(
    await _account.request(
      _path,
      authenticated: true,
      isCurrent: isCurrent,
      cancel: cancel,
      query: {
        'expectedOwnerId': owner,
        'fields': AccountBirthFields.keys.join(','),
      },
    ),
  );

  Future<AccountBirthFields> confirm(
    String owner,
    AccountBirthFields expected,
    AccountBirthFields profile, {
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async => AccountBirthFields.fromJson(
    await _account.request(
      _path,
      method: 'PATCH',
      authenticated: true,
      isCurrent: isCurrent,
      cancel: cancel,
      body: {
        'expectedOwnerId': owner,
        'expected': expected.toJson(),
        'profile': profile.toJson(),
      },
    ),
  );
}
