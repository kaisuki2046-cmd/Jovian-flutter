const aiPurposes = <String, String>{
  'destiny.cloud_interpretation': '命理在线解读',
  'fortune.cloud_interpretation': '运势在线解读',
  'synastry.cloud_interpretation': '合盘在线解读',
  'divination.cloud_assistance': '算事问题理解与在线解读',
};

class AgreementDocument {
  const AgreementDocument({
    required this.id,
    required this.version,
    required this.hash,
    required this.title,
    required this.sections,
    required this.preview,
  });

  final String id;
  final String version;
  final String hash;
  final String title;
  final List<({String title, String text})> sections;
  final bool preview;

  Map<String, String> get proof => {'id': id, 'version': version, 'hash': hash};

  factory AgreementDocument.fromJson(Object? value) {
    if (value case {
      'id': final String id,
      'version': final String version,
      'hash': final String hash,
      'title': final String title,
      'state': final String state,
      'sections': final List<Object?> sections,
    } when state == 'preview' || state == 'published') {
      return AgreementDocument(
        id: id,
        version: version,
        hash: hash,
        title: title,
        sections: List.unmodifiable(sections.map(_section)),
        preview: state == 'preview',
      );
    }
    throw const FormatException('Invalid agreement document.');
  }

  static ({String title, String text}) _section(Object? value) {
    if (value case {'title': final String title, 'text': final String text}) {
      return (title: title, text: text);
    }
    throw const FormatException('Invalid agreement section.');
  }
}

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

class AgreementState {
  const AgreementState(this.requiredAccepted, this.permissions);

  final bool requiredAccepted;
  final Map<String, bool> permissions;
  bool get allAiGranted =>
      aiPurposes.keys.every((key) => permissions[key] == true);

  factory AgreementState.fromJson(Map<String, Object?> response) {
    if (response case {
      'requiredAccepted': final bool accepted,
      'permissions': final Map<String, Object?> permissions,
    } when aiPurposes.keys.every((name) => permissions[name] is bool)) {
      return AgreementState(accepted, {
        for (final name in aiPurposes.keys) name: permissions[name] as bool,
      });
    }
    throw const FormatException('Invalid agreement state.');
  }
}
