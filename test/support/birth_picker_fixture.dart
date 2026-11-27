import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_destiny/jovian_destiny.dart' show firstBirthYear;
import 'package:material_ui/material_ui.dart';

import '../../src/features/destiny/view/birth_profile_editor.dart';
import '../../src/ui/interface_language.dart';

Future<void> openBirthPicker(WidgetTester tester, String action) async {
  final button = find.byKey(ValueKey(action));
  await tester.ensureVisible(button);
  await tester.pumpAndSettle();
  await tester.tap(button);
  await tester.pumpAndSettle();
}

Future<void> confirmBirthPicker(WidgetTester tester) async {
  final editor = tester.element(find.byType(BirthProfileEditor));
  final button = find.widgetWithText(FilledButton, editor.uiLabel('确认'));
  await tester.ensureVisible(button);
  await tester.pumpAndSettle();
  await tester.tap(button);
  await tester.pumpAndSettle();
}

Future<void> selectBirthDate(WidgetTester tester, String isoDate) async {
  final date = DateTime.parse(isoDate);
  await openBirthPicker(tester, '选择出生日期');
  await scrollBirthWheel(tester, 0, date.year - firstBirthYear);
  await scrollBirthWheel(tester, 1, date.month - 1);
  await scrollBirthWheel(tester, 2, date.day - 1);
  await confirmBirthPicker(tester);
}

Future<void> selectBirthTime(WidgetTester tester, int hour, int minute) async {
  await openBirthPicker(tester, '选择出生时间');
  await scrollBirthWheel(tester, 0, hour);
  await scrollBirthWheel(tester, 1, minute);
  await confirmBirthPicker(tester);
}

Future<void> scrollBirthWheel(WidgetTester tester, int wheel, int index) async {
  final picker = find.byType(BottomSheet);
  final wheels = find.descendant(
    of: picker,
    matching: find.byType(ListWheelScrollView),
  );
  final controller =
      tester.widget<ListWheelScrollView>(wheels.at(wheel)).controller!
          as FixedExtentScrollController;
  controller.jumpToItem(index);
  await tester.pumpAndSettle();
}
