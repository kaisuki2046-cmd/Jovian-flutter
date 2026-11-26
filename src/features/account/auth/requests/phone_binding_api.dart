import '../model/phone_binding.dart';
import '../model/session.dart';
import 'account_api.dart';

class PhoneBindingApi {
  const PhoneBindingApi(this._account, this._owner, this._isCurrent);

  final AccountApi _account;
  final String _owner;
  final bool Function() _isCurrent;

  Future<String?> bound({required Future<void> cancel}) async => _phone(
    await _account.readAsMember(
      ['auth', 'phone'],
      _owner,
      isCurrent: _isCurrent,
      cancel: cancel,
    ),
  );

  Future<BindingChallenge> issue(
    BindingCodeTarget target,
    String phone, {
    required Future<void> cancel,
  }) async {
    final response = await _account.writeAsMember(
      ['auth', 'phone', target.path, 'code'],
      _owner,
      body: {'phone': phone},
      isCurrent: _isCurrent,
      cancel: cancel,
    );
    if (response case {'challengeId': final String id} when id.isNotEmpty) {
      return (
        id: id,
        phone: phone,
        localInbox: response['delivery'] == 'local-inbox',
      );
    }
    throw const FormatException('Invalid binding challenge.');
  }

  Future<String> bind(
    BindingChallenge challenge,
    String code, {
    String? password,
    BindingChallenge? current,
    String? currentCode,
    required Future<void> cancel,
  }) async {
    final response = await _account.writeAsMember(
      ['auth', 'phone', 'bind'],
      _owner,
      body: {
        'phone': challenge.phone,
        'challengeId': challenge.id,
        'code': code,
        if (current == null)
          'password': password
        else ...{
          'currentChallengeId': current.id,
          'currentCode': currentCode,
        },
      },
      isCurrent: _isCurrent,
      cancel: cancel,
    );
    final bound = _phone(response);
    if (bound == null || bound != challenge.phone)
      throw const FormatException('Unexpected bound phone.');
    return bound;
  }

  String? _phone(Map<String, Object?> response) {
    if (response case {'phone': null}) return null;
    if (response case {'phone': final String value}) {
      final identifier = AccountIdentifier.parse(value);
      if (identifier?.isPhone == true) return identifier!.value;
    }
    throw const FormatException('Invalid bound phone.');
  }
}
