import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

String fortuneDateLabel(BuildContext context, DateTime date) =>
    context.uiLanguage == InterfaceLanguage.english
    ? MaterialLocalizations.of(context).formatShortDate(date)
    : '${date.year}年${date.month}月${date.day}日';

String fortuneDateRange(BuildContext context, String first, String last) =>
    first == last ? first : '$first${context.uiLabel(' 至 ')}$last';

String fortunePillarLabels(
  BuildContext context,
  String year,
  String month,
  String day, {
  String? hour,
}) {
  if (context.uiLanguage == InterfaceLanguage.chinese) {
    return [
      '${year}年',
      '${month}月',
      '${day}日',
      if (hour != null) '${hour}时',
    ].join(' · ');
  }
  return [
    '${context.uiLabel('年柱')} $year',
    '${context.uiLabel('月柱')} $month',
    '${context.uiLabel('日柱')} $day',
    if (hour != null) '${context.uiLabel('时柱')} $hour',
  ].join(' · ');
}
