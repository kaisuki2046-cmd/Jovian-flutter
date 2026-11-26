import 'account_birth_fields.dart';

enum ReadingField {
  birthDate('出生年月日'),
  birthTime('出生时间'),
  birthPlace('出生地点'),
  gender('性别');

  const ReadingField(this.label);
  final String label;
}

class AccountReadingProfile {
  AccountReadingProfile(this.fields, Map<ReadingField, bool> visibility)
    : visibility = Map.unmodifiable(visibility);

  final AccountBirthFields fields;
  final Map<ReadingField, bool> visibility;

  factory AccountReadingProfile.fromResponse(Map<String, Object?> value) {
    if (value case {
      'reading': final Map<String, Object?> data,
    } when data['visibility'] is Map) {
      final visibility = data['visibility'] as Map;
      if (ReadingField.values.every(
        (field) => visibility[field.name] is bool,
      )) {
        return AccountReadingProfile(AccountBirthFields.fromJson(data), {
          for (final field in ReadingField.values)
            field: visibility[field.name] as bool,
        });
      }
    }
    throw const FormatException('账户出生资料格式无法读取。');
  }

  String value(ReadingField field) => switch (field) {
    ReadingField.birthDate => fields.birthDate,
    ReadingField.birthTime => fields.birthTime,
    ReadingField.birthPlace => fields.birthPlace,
    ReadingField.gender => fields.gender,
  };

  bool isVisible(ReadingField field) => visibility[field] == true;

  AccountReadingProfile withValue(ReadingField field, String value) =>
      AccountReadingProfile(
        AccountBirthFields.fromJson({...fields.toJson(), field.name: value}),
        visibility,
      );

  AccountReadingProfile withVisibility(ReadingField field, bool value) =>
      AccountReadingProfile(fields, {...visibility, field: value});

  bool sameAs(AccountReadingProfile other) => ReadingField.values.every(
    (field) =>
        value(field) == other.value(field) &&
        isVisible(field) == other.isVisible(field),
  );

  Map<String, Object?> toJson() => {
    ...fields.toJson(),
    'visibility': {
      for (final field in ReadingField.values) field.name: isVisible(field),
    },
  };
}
