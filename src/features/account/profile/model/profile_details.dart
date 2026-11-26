const profileSignatureLimit = 100;
const profileTagLimit = 30;

enum ProfileTag {
  zodiac('星座'),
  personality('性格'),
  interests('兴趣');

  const ProfileTag(this.label);
  final String label;
}

class LocalProfileDetails {
  const LocalProfileDetails({this.signature = '', this.tags = const {}});

  final String signature;
  final Map<ProfileTag, String> tags;

  factory LocalProfileDetails.fromJson(Object? raw) {
    final data = raw is Map ? raw : const {};
    final tags = data['tags'];
    return LocalProfileDetails(
      signature: _clean(data['signature'], profileSignatureLimit),
      tags: Map.unmodifiable({
        for (final tag in ProfileTag.values)
          tag: _clean(tags is Map ? tags[tag.name] : null, profileTagLimit),
      }),
    );
  }

  Map<String, Object?> toJson() => {
    'signature': signature,
    'tags': {for (final tag in ProfileTag.values) tag.name: tags[tag] ?? ''},
  };
}

String _clean(Object? input, int limit) =>
    input is String ? String.fromCharCodes(input.trim().runes.take(limit)) : '';
