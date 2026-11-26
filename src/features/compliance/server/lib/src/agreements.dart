import 'dart:convert';

import 'package:crypto/crypto.dart';

import 'preview_documents.dart';

const aiConsentPurposes = [
  'destiny.cloud_interpretation',
  'fortune.cloud_interpretation',
  'synastry.cloud_interpretation',
  'divination.cloud_assistance',
];
const _ids = ['terms', 'privacy', 'ai'];
final _versionPattern = RegExp(r'^[a-zA-Z0-9.-]{1,50}$');
final _draftPattern = RegExp('preview|draft', caseSensitive: false);

class AgreementDocument {
  const AgreementDocument._({
    required this.id,
    required this.version,
    required this.hash,
    required this.title,
    required this.sections,
    required this.published,
  });

  final String id;
  final String version;
  final String hash;
  final String title;
  final List<({String title, String text})> sections;
  final bool published;

  Map<String, Object?> toJson() => {
    'id': id,
    'version': version,
    'hash': hash,
    'title': title,
    'sections': _wireSections(sections),
    'state': published ? 'published' : 'preview',
  };
}

List<AgreementDocument> createAgreementCatalog({
  Map<String, Object?>? published,
}) => List.unmodifiable(
  _ids.map(
    (id) => _readDocument(
      id,
      published == null ? previewDocuments[id] : published[id],
      published: published != null,
    ),
  ),
);

AgreementDocument _readDocument(
  String id,
  Object? value, {
  required bool published,
}) {
  if (value is! Map<String, Object?>) {
    throw FormatException('Invalid agreement catalog entry: $id');
  }
  final version = published ? value['version'] : '0.1.2-preview';
  final title = value['title'];
  final rawSections = value['sections'];
  if (version is! String ||
      !_versionPattern.hasMatch(version) ||
      title is! String ||
      title.trim().isEmpty ||
      rawSections is! List<Object?> ||
      rawSections.isEmpty) {
    throw FormatException('Invalid agreement catalog entry: $id');
  }
  final sections = [
    for (final section in rawSections)
      if (section case {
        'title': final String title,
        'text': final String text,
      } when title.trim().isNotEmpty && text.trim().isNotEmpty)
        (title: title, text: text)
      else
        throw FormatException('Invalid agreement catalog entry: $id'),
  ];
  if (published &&
      (_draftPattern.hasMatch(version) ||
          title.contains('【待填') ||
          sections.any(
            (item) => item.title.contains('【待填') || item.text.contains('【待填'),
          ))) {
    throw FormatException('Replace preview content before publishing $id');
  }
  final content = {'title': title, 'sections': _wireSections(sections)};
  final hash = sha256.convert(utf8.encode(jsonEncode(content))).toString();
  return AgreementDocument._(
    id: id,
    version: version,
    hash: hash,
    title: title,
    sections: List.unmodifiable(sections),
    published: published,
  );
}

List<Map<String, String>> _wireSections(
  List<({String title, String text})> sections,
) => [
  for (final section in sections)
    {'title': section.title, 'text': section.text},
];
