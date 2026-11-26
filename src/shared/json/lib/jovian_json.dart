import 'dart:convert';

/// Encodes JSON with the property enumeration and number notation used by Node.
String legacyJson(Object? value) {
  if (value is num) {
    if (!value.isFinite) return 'null';
    if (value == 0) return '0';
    if (value is int && value.abs() <= 9007199254740991) return value.toString();
    final decimal = value.toDouble();
    final parts = decimal.toString().split('e');
    final mantissa = parts.first.replaceFirst(RegExp(r'\.0$'), '');
    if (parts.length == 1) return mantissa;
    final exponent = int.parse(parts[1]);
    if (decimal.abs() >= 1e21 || decimal.abs() < 1e-6) {
      return '${mantissa}e${exponent >= 0 ? '+' : ''}$exponent';
    }
    final sign = mantissa.startsWith('-') ? '-' : '';
    final digits = mantissa.replaceAll(RegExp(r'[-.]'), '');
    final point = exponent + 1;
    if (point <= 0) return '${sign}0.${'0' * -point}$digits';
    if (point >= digits.length) return '$sign$digits${'0' * (point - digits.length)}';
    return '$sign${digits.substring(0, point)}.${digits.substring(point)}';
  }
  if (value is List) return '[${value.map(legacyJson).join(',')}]';
  if (value is Map<String, Object?>) {
    final numeric = <int, String>{};
    final ordinary = <String>[];
    for (final key in value.keys) {
      final index = int.tryParse(key);
      if (index != null && index >= 0 && index < 4294967295 && index.toString() == key) {
        numeric[index] = key;
      } else {
        ordinary.add(key);
      }
    }
    final keys = [
      for (final index in (numeric.keys.toList()..sort())) numeric[index]!,
      ...ordinary,
    ];
    return '{${keys.map((key) => '${jsonEncode(key)}:${legacyJson(value[key])}').join(',')}}';
  }
  return jsonEncode(value);
}
