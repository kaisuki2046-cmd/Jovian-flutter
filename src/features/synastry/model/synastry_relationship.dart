enum SynastryRelationship {
  family('亲情'),
  friendship('友情'),
  romance('爱情'),
  collaboration('合作');

  const SynastryRelationship(this.label);

  final String label;
}

enum SynastryEdition {
  lover('恋人', SynastryRelationship.romance),
  partner('伴侣', SynastryRelationship.romance),
  ex('前任', SynastryRelationship.romance),
  crush('暧昧对象', SynastryRelationship.romance),
  special('特殊关系', SynastryRelationship.romance),
  parents('父母', SynastryRelationship.family),
  children('子女', SynastryRelationship.family),
  family('家人', SynastryRelationship.family),
  relatives('亲戚', SynastryRelationship.family),
  friend('朋友', SynastryRelationship.friendship),
  classmate('同学', SynastryRelationship.friendship),
  teacher('老师', SynastryRelationship.collaboration),
  student('学生', SynastryRelationship.collaboration),
  colleague('同事', SynastryRelationship.collaboration),
  manager('领导', SynastryRelationship.collaboration),
  subordinate('下属', SynastryRelationship.collaboration),
  client('客户', SynastryRelationship.collaboration),
  publicFigure('名人', SynastryRelationship.friendship),
  other('其他', SynastryRelationship.friendship),
  siblings('兄弟姐妹', SynastryRelationship.family),
  buddies('好兄弟', SynastryRelationship.friendship),
  bestFriend('闺蜜', SynastryRelationship.friendship);

  const SynastryEdition(this.label, this.relationship);

  final String label;
  final SynastryRelationship relationship;

  String get archiveTitle => '合盘 · $label';

  String archiveTitleForPair(String a, String b) =>
      '$archiveTitle · ${_archiveName(a, 'A 方')} & ${_archiveName(b, 'B 方')}';

  String? pairFromArchiveTitle(String title) {
    final prefix = '$archiveTitle · ';
    if (!title.startsWith(prefix)) return null;
    final pair = title.substring(prefix.length).trim();
    return pair.isEmpty ? null : pair;
  }

  static SynastryEdition? matchArchiveTitle(String title) => values
      .where(
        (edition) =>
            edition.archiveTitle == title ||
            edition.pairFromArchiveTitle(title) != null,
      )
      .firstOrNull;

  static SynastryEdition fromArchiveTitle(String title) =>
      matchArchiveTitle(title) ?? family;

  static String _archiveName(String supplied, String fallback) {
    final name = supplied.replaceAll(RegExp(r'\s+'), ' ').trim();
    return name.isEmpty ? fallback : String.fromCharCodes(name.runes.take(48));
  }
}
