import '../../../../shared/http/json_client.dart';
import '../../auth/requests/account_api.dart';
import '../model/agreements.dart';

class AgreementsApi {
  const AgreementsApi(this._account);

  final AccountApi _account;

  Future<AgreementCatalog> catalog() async => AgreementCatalog.fromJson(
    await _account.request(['agreements', 'catalog']),
  );

  Future<AgreementState> state() async => AgreementState.fromJson(
    await _account.request(['agreements'], authenticated: true),
  );

  Future<AgreementState> acceptRequired(AgreementCatalog catalog) async =>
      AgreementState.fromJson(
        await _account.request(
          ['agreements', 'confirmation'],
          body: {'agreements': catalog.requiredProof, 'source': 'sign-in'},
          authenticated: true,
        ),
      );

  Future<AgreementState> choose(
    AgreementDocument document,
    String purpose,
    bool agreed, {
    String source = 'settings',
  }) async => AgreementState.fromJson(
    await _account.request(
      ['agreements', 'permission'],
      body: {
        'version': document.version,
        'hash': document.hash,
        'purpose': purpose,
        'agreed': agreed,
        'source': source,
      },
      authenticated: true,
    ),
  );

  Future<AgreementState> grantAll(
    AgreementDocument document, {
    required String source,
  }) async {
    Future<void> grant(String purpose) async {
      try {
        await choose(document, purpose, true, source: source);
      } on JsonRequestError {
        // A stale document or failed write is reflected in the final state.
      }
    }

    await Future.wait(aiPurposes.keys.map(grant));
    return state();
  }
}
