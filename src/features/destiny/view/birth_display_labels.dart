import 'package:jovian_destiny/jovian_destiny.dart' show BirthTime;
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

String birthTimeLabel(BuildContext context, BirthTime time) => switch ((
  time.hour,
  time.minute,
)) {
  (null, null) => context.uiLabel('时间未知'),
  (null, final minute?) =>
    '${context.uiLabel('小时未知 · ')}$minute${context.uiLabel(' 分')}',
  (final hour?, null) => '$hour${context.uiLabel(' 时 · 分钟未知')}',
  (final hour?, final minute?) =>
    '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}',
};

String storedBirthTimeLabel(BuildContext context, String time) {
  final match = RegExp(
    r'^([01]\d|2[0-3]|\?\?):([0-5]\d|\?\?)$',
  ).firstMatch(time);
  if (match == null) return time;
  return birthTimeLabel(
    context,
    BirthTime(hour: int.tryParse(match[1]!), minute: int.tryParse(match[2]!)),
  );
}

String birthGenderLabel(BuildContext context, String value) => switch (value) {
  'female' => context.uiLabel('女'),
  'male' => context.uiLabel('男'),
  'other' => context.uiLabel('其他'),
  _ => value,
};
