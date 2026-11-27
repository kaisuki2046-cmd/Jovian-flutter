typedef AgreementSection = ({String title, String text});

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
  final List<AgreementSection> sections;
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

  static AgreementSection _section(Object? value) {
    if (value case {'title': final String title, 'text': final String text}) {
      return (title: title, text: text);
    }
    throw const FormatException('Invalid agreement section.');
  }
}
