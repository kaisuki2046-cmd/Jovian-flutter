import '../../../../shared/http/json_client.dart';
import '../../auth/requests/account_api.dart';
import '../model/account_birth_fields.dart';
import '../model/account_reading_profile.dart';

class AccountBirthApi {
  const AccountBirthApi(this._account);

  final AccountApi _account;
  static const _path = ['reading-profile', 'birth-profile'];
  static const _readingPath = ['reading-profile'];

  Future<AccountReadingProfile> readWithVisibility(
    String owner, {
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async {
    final result = await _account.request(
      _readingPath,
      authenticated: true,
      isCurrent: isCurrent,
      cancel: cancel,
    );
    // The legacy read response has no owner ID. Check the live session before
    // returning any data to a page opened under a specific account.
    final session = await _account.request(
      ['session'],
      authenticated: true,
      isCurrent: isCurrent,
      cancel: cancel,
    );
    if (session['user'] case {'id': final String id} when id == owner) {
      return AccountReadingProfile.fromResponse(result);
    }
    throw const JsonRequestError('account_changed', status: 401);
  }

  Future<AccountReadingProfile> saveWithVisibility(
    String owner,
    AccountReadingProfile expected,
    AccountReadingProfile profile, {
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async => AccountReadingProfile.fromResponse(
    await _account.request(
      _readingPath,
      method: 'PATCH',
      authenticated: true,
      isCurrent: isCurrent,
      cancel: cancel,
      body: {
        ...profile.toJson(),
        'expectedOwnerId': owner,
        'expectedReading': expected.toJson(),
      },
    ),
  );

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
