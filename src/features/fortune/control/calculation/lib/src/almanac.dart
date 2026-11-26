import 'package:jovian_fortune_model/jovian_fortune_model.dart';

import 'calendar.dart';

AlmanacDay buildAlmanacDay(int instant) {
  final date = fortuneReferenceFields(instant).date;
  final lunar = lunarAtBeijing(
    DateTime.parse('${date}T12:00:00+08:00').millisecondsSinceEpoch,
  );
  List<String> activities(List<String> items) =>
      items.where((item) => item.isNotEmpty && item != '无').toSet().toList();
  final term = lunar.getJieQi();
  return AlmanacDay(
    date: date,
    lunarDate: lunar.toString(),
    dayPillar: lunar.getDayInGanZhi(),
    solarTerm: term.isEmpty ? null : term,
    officer: lunar.getZhiXing(),
    yi: activities(lunar.getDayYi()),
    ji: activities(lunar.getDayJi()),
  );
}
