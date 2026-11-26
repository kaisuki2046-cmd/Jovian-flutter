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

  Future<AgreementDocument> readVersion(
    AgreementConfirmation confirmation, {
    required bool Function() isCurrent,
    Future<void>? cancel,
  }) async {
    final document = AgreementDocument.fromJson(
      await _account.request(
        ['agreements', confirmation.id, confirmation.version],
        authenticated: true,
        isCurrent: isCurrent,
        cancel: cancel,
      ),
    );
    if (document.id != confirmation.id ||
        document.version != confirmation.version) {
      throw const FormatException('Unexpected agreement version.');
    }
    return document;
  }

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
    Future<JsonRequestError?> grant(String purpose) async {
      try {
        await choose(document, purpose, true, source: source);
      } on JsonRequestError catch (error) {
        if (error.status == 409 || error.status == 403) return error;
        // Other partial failures are reflected in the stored state.
      }
      return null;
    }

    final conflicts = await Future.wait(aiPurposes.keys.map(grant));
    if (conflicts.whereType<JsonRequestError>().firstOrNull case final error?) {
      throw error;
    }
    return state();
  }
}
