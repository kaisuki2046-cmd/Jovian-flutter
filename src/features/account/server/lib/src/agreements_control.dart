import 'package:jovian_compliance_server/jovian_compliance_server.dart';

import 'account_failure.dart';
import 'account_limits.dart';
import 'storage/account_agreement_store.dart';
import 'storage/account_auth_store.dart';

class AgreementControl {
  AgreementControl(
    this._store,
    this._limits,
    this._now,
    List<AgreementDocument> documents,
  ) : _documents = {for (final document in documents) document.id: document} {
    _store.agreements.seed(documents);
  }

  final AccountAuthStore _store;
  final AccountLimits _limits;
  final int Function() _now;
  final Map<String, AgreementDocument> _documents;
  static const _required = ['privacy', 'terms'];

  Map<String, Object?> get catalog => {
    'documents': [for (final document in _documents.values) document.toJson()],
  };

  List<ConsentDecision> signInAcceptance(Object? acceptance) {
    if (acceptance is! Map<String, Object?> || acceptance['agreed'] != true) {
      failAccount(428);
    }
    return _confirmations(acceptance['agreements'], 412);
  }

  void recordSignIn(String? session, List<ConsentDecision> decisions) {
    final owner = _owner(session);
    _write(owner, session, decisions, 'sign-in');
  }

  Map<String, Object?> state(String? session) => _state(_owner(session));

  Map<String, Object?> permission(String? session, String? purpose) {
    if (!aiConsentPurposes.contains(purpose)) failAccount(400);
    final owner = _owner(session);
    return {
      'allowed':
          _allRequired(owner) &&
          _store.agreements.accepted(owner, _documents['ai']!, purpose!),
      'identity': {'kind': owner.kind.name, 'id': owner.id},
    };
  }

  Map<String, Object?> version(String? session, String id, String version) {
    final owner = _owner(session);
    if (!_store.agreements
        .history(owner)
        .any((row) => row['agreementId'] == id && row['version'] == version)) {
      failAccount(404);
    }
    return _store.agreements.version(id, version) ?? failAccount(404);
  }

  Map<String, Object?> confirmRequired(
    String? session,
    Map<String, Object?> input,
  ) {
    final owner = _owner(session);
    _limits.hit('required-agreements:${owner.id}', 40, _now());
    final source = input['source'];
    if (source is! String ||
        !const ['first-use', 'settings', 'sign-in'].contains(source))
      failAccount(400);
    final decisions = _confirmations(input['agreements'], 409);
    _write(owner, session, decisions, source);
    return _state(owner);
  }

  Map<String, Object?> choosePermission(
    String? session,
    Map<String, Object?> input,
  ) {
    final owner = _owner(session);
    _limits.hit('purpose-agreement:${owner.id}', 60, _now());
    final purpose = input['purpose'];
    final agreed = input['agreed'];
    final source = input['source'];
    if (purpose is! String ||
        !aiConsentPurposes.contains(purpose) ||
        agreed is! bool ||
        source is! String ||
        !const ['first-use', 'settings', 'feature'].contains(source)) {
      failAccount(400);
    }
    final document = _documents['ai']!;
    if (!_matches(input, document)) failAccount(409);
    _write(
      owner,
      session,
      [(document: document, purpose: purpose, agreed: agreed)],
      source,
      requireConfirmed: agreed,
    );
    return _state(owner);
  }

  AccountOwner _owner(String? session) =>
      _store.ownerBySession(session, _now()) ?? failAccount(401);

  bool _allRequired(AccountOwner owner) => _required.every(
    (id) => _store.agreements.accepted(owner, _documents[id]!, ''),
  );

  Map<String, Object?> _state(AccountOwner owner) => {
    'requiredAccepted': _allRequired(owner),
    'permissions': {
      for (final purpose in aiConsentPurposes)
        purpose: _store.agreements.accepted(owner, _documents['ai']!, purpose),
    },
    'decisions': _store.agreements.history(owner).toList(),
  };

  List<ConsentDecision> _confirmations(Object? proofs, int conflict) {
    if (proofs is! List || proofs.length != _required.length) failAccount(400);
    return _required.map((id) {
      final document = _documents[id]!;
      if (!proofs.whereType<Map>().any(
        (item) => item['id'] == id && _matches(item, document),
      ))
        failAccount(conflict);
      return (document: document, purpose: '', agreed: true);
    }).toList();
  }

  bool _matches(Map proof, AgreementDocument document) =>
      proof['version'] == document.version && proof['hash'] == document.hash;

  void _write(
    AccountOwner owner,
    String? session,
    List<ConsentDecision> decisions,
    String source, {
    bool requireConfirmed = false,
  }) {
    final saved = _store.agreements.save(
      owner: owner,
      decisions: decisions,
      now: _now(),
      source: source,
      stillAuthorized: () {
        if (_store.ownerBySession(session, _now()) != owner) return false;
        if (requireConfirmed && !_allRequired(owner)) failAccount(403);
        return true;
      },
    );
    if (!saved) failAccount(401);
  }
}
