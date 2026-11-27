import '../../../compliance/agreements.dart' show AgreementDocument;

export '../../../compliance/agreements.dart' show AgreementDocument;

const aiPurposes = <String, String>{
  'destiny.cloud_interpretation': '命理在线解读',
  'fortune.cloud_interpretation': '运势在线解读',
  'synastry.cloud_interpretation': '合盘在线解读',
  'divination.cloud_assistance': '算事问题理解与在线解读',
};

class AgreementCatalog {
  const AgreementCatalog(this.privacy, this.terms, this.ai);

  final AgreementDocument privacy;
  final AgreementDocument terms;
  final AgreementDocument ai;

  List<Map<String, String>> get requiredProof => [privacy.proof, terms.proof];

  factory AgreementCatalog.fromJson(Map<String, Object?> response) {
    final values = response['documents'];
    if (values is List<Object?>) {
      final documents = {
        for (final document in values.map(AgreementDocument.fromJson))
          document.id: document,
      };
      final privacy = documents['privacy'];
      final terms = documents['terms'];
      final ai = documents['ai'];
      if (privacy != null && terms != null && ai != null) {
        return AgreementCatalog(privacy, terms, ai);
      }
    }
    throw const FormatException('Incomplete agreement catalog.');
  }
}

typedef AgreementConfirmation = ({
  String id,
  String version,
  DateTime decidedAt,
});

class AgreementState {
  const AgreementState(
    this.requiredAccepted,
    this.permissions, {
    this.confirmations = const [],
  });

  final bool requiredAccepted;
  final Map<String, bool> permissions;
  final List<AgreementConfirmation> confirmations;
  bool get allAiGranted =>
      aiPurposes.keys.every((key) => permissions[key] == true);

  factory AgreementState.fromJson(Map<String, Object?> response) {
    if (response case {
      'requiredAccepted': final bool accepted,
      'permissions': final Map<String, Object?> permissions,
    } when aiPurposes.keys.every((name) => permissions[name] is bool)) {
      final decisions = response['decisions'];
      return AgreementState(
        accepted,
        {for (final name in aiPurposes.keys) name: permissions[name] as bool},
        confirmations: [
          if (decisions is List)
            for (final decision in decisions)
              if (decision case {
                'agreementId': final String id,
                'version': final String version,
                'purpose': '',
                'agreed': true,
                'decidedAt': final int timestamp,
              } when id == 'terms' || id == 'privacy')
                (
                  id: id,
                  version: version,
                  decidedAt: DateTime.fromMillisecondsSinceEpoch(
                    timestamp,
                    isUtc: true,
                  ),
                ),
        ],
      );
    }
    throw const FormatException('Invalid agreement state.');
  }
}
