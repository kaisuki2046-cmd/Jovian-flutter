import '../../../../shared/http/json_client.dart';
import '../model/account_deletion.dart';
import '../model/password.dart';
import 'account_api.dart';

class AccountDeletionApi {
  const AccountDeletionApi(this._account);

  final AccountApi _account;

  Future<DeletionSetup> prepare(String owner, bool Function() isCurrent) async {
    final response = await _account.readAsMember(
      ['deletion'],
      owner,
      isCurrent: isCurrent,
    );
    if (response case {
      'receipt': final String receipt,
      'method': final method,
    } when deletionReceiptPattern.hasMatch(receipt)) {
      return (
        receipt: receipt,
        method: switch (method) {
          'password' => DeletionMethod.password,
          'phone' => DeletionMethod.phone,
          'local-social' => DeletionMethod.localSocial,
          'wechat' || 'qq' || null => DeletionMethod.unsupported,
          _ => throw const JsonRequestError('invalid_response'),
        },
      );
    }
    throw const JsonRequestError('invalid_response');
  }

  Future<PasswordSmsChallenge> issueCode(
    String owner,
    bool Function() isCurrent,
  ) async {
    final response = await _account.writeAsMember(
      ['deletion', 'code'],
      owner,
      body: const {},
      isCurrent: isCurrent,
    );
    if (response case {'challengeId': final String id} when id.isNotEmpty) {
      return (id: id, localInbox: response['delivery'] == 'local-inbox');
    }
    throw const JsonRequestError('invalid_response');
  }

  Future<bool> submit(
    SavedDeletion request,
    Map<String, Object?> proof,
    List<String> tokens,
    bool Function() isCurrent,
  ) async => _completed(
    await _account.writeAsMember(
      ['deletion'],
      request.owner,
      isCurrent: isCurrent,
      body: {
        ...proof,
        'receipt': request.receipt,
        'confirm': true,
        'legacyReadingTokens': tokens,
      },
    ),
  );

  Future<bool> status(String receipt) async => _completed(
    await _account.request(['deletion', 'status'], body: {'receipt': receipt}),
  );

  bool _completed(Map<String, Object?> result) => switch (result) {
    {'status': 'completed', 'requestedAt': num _, 'completedAt': num _} => true,
    {'status': 'pending', 'requestedAt': num _, 'completedAt': null} => false,
    _ => throw const JsonRequestError('invalid_response'),
  };
}
