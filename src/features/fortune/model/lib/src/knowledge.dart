typedef FortuneJson = Map<String, Object?>;

const knowledgeMethods = ['bazi', 'ziwei', 'western'];
const knowledgePeriods = ['year', 'month', 'week', 'day', 'hour'];
const knowledgeHourBases = ['shichen', 'clockHour'];
const knowledgeScopes = [
  'natal',
  'decadal',
  'minor',
  'yearly',
  'monthly',
  'daily',
  'hourly',
  'transit',
  'progressed',
  'almanac',
];

class FortuneKnowledgeManifest {
  const FortuneKnowledgeManifest(
    this.schemaVersion,
    this.entries,
    this.adviceGroups,
  );

  final int schemaVersion;
  final List<FortuneKnowledgeEntry> entries;
  final List<FortuneJson> adviceGroups;
}

class FortuneKnowledgeEntry {
  const FortuneKnowledgeEntry(this.data);

  final FortuneJson data;
  int get id => (data['id'] as num).toInt();
  FortuneJson get source => data['source'] as FortuneJson;
  FortuneJson get category => data['category'] as FortuneJson;
  FortuneJson get matchConditions => data['matchConditions'] as FortuneJson;
  FortuneJson get formatted => matchConditions['formatted'] as FortuneJson;
  FortuneJson? get legacy => data['legacy'] as FortuneJson?;
  FortuneJson? get advice => data['advice'] as FortuneJson?;
  String get runtimeId => data['legacyId'] as String? ?? 'fortune-entry-$id';
  String get method => category['method'] as String;
  String get kind => category['contentType'] as String;
  String get topic => category['topic'] as String;
  String? get period => category['period'] as String?;
  String? get hourBasis => category['hourBasis'] as String?;
}

String knowledgeRuntimeTopic(String topic, String? legacy) =>
    legacy ?? const {'overall': '综合', 'wealth': '财富', 'romance': '爱情'}[topic]!;
