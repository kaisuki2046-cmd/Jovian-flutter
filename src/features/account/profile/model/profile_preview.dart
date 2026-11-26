import '../../reading-profile/model/account_reading_profile.dart';

class VisitorProfile {
  VisitorProfile._(
    this.displayName,
    this.bio,
    Map<ReadingField, String> reading,
  ) : reading = Map.unmodifiable(reading);

  final String? displayName;
  final String? bio;
  final Map<ReadingField, String> reading;

  bool get hasData => displayName != null || bio != null || reading.isNotEmpty;

  factory VisitorProfile.fromResponse(Map<String, Object?> value) {
    if (value case {
      'profile': final Map<String, Object?> profile,
    } when profile['reading'] is Map) {
      final reading = profile['reading'] as Map;
      return VisitorProfile._(
        _visibleText(profile['displayName']),
        _visibleText(profile['bio']),
        {
          for (final field in ReadingField.values)
            if (_visibleText(reading[field.name]) case final data?) field: data,
        },
      );
    }
    throw const FormatException('公开资料格式无法读取。');
  }

  static String? _visibleText(Object? value) {
    if (value == null || value == '') return null;
    if (value is String) return value;
    throw const FormatException('公开资料格式无法读取。');
  }
}

class ProfilePreview {
  ProfilePreview._(this.profile, Map<String, bool> visibility)
    : visibility = Map.unmodifiable(visibility);

  final VisitorProfile profile;
  final Map<String, bool> visibility;

  factory ProfilePreview.fromResponse(Map<String, Object?> value) {
    const personal = ['displayName', 'bio'];
    final keys = [
      ...personal,
      ...ReadingField.values.map((field) => field.name),
    ];
    final visibility = value['visibility'];
    if (visibility is! Map || keys.any((key) => visibility[key] is! bool)) {
      throw const FormatException('资料可见性格式无法读取。');
    }
    final profile = VisitorProfile.fromResponse(value);
    return ProfilePreview._(
      VisitorProfile._(
        visibility['displayName'] == true ? profile.displayName : null,
        visibility['bio'] == true ? profile.bio : null,
        {
          for (final entry in profile.reading.entries)
            if (visibility[entry.key.name] == true) entry.key: entry.value,
        },
      ),
      {for (final key in keys) key: visibility[key] as bool},
    );
  }
}
