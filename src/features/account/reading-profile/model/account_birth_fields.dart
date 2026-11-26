class AccountBirthFields {
  const AccountBirthFields({
    required this.birthDate,
    required this.birthTime,
    required this.birthPlace,
    required this.gender,
  });

  static const keys = ['birthDate', 'birthTime', 'birthPlace', 'gender'];

  final String birthDate;
  final String birthTime;
  final String birthPlace;
  final String gender;

  bool get hasData =>
      birthDate.isNotEmpty ||
      birthTime.isNotEmpty ||
      birthPlace.isNotEmpty ||
      gender.isNotEmpty;

  factory AccountBirthFields.fromJson(Map<String, Object?> json) {
    if (json case {
      'birthDate': final String date,
      'birthTime': final String time,
      'birthPlace': final String place,
      'gender': final String gender,
    }) {
      return AccountBirthFields(
        birthDate: date,
        birthTime: time,
        birthPlace: place,
        gender: gender,
      );
    }
    throw const FormatException('账户出生资料格式无法读取。');
  }

  Map<String, Object?> toJson() => {
    'birthDate': birthDate,
    'birthTime': birthTime,
    'birthPlace': birthPlace,
    'gender': gender,
  };
}
