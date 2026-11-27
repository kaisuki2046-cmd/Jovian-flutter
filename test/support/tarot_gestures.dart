import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

Future<Finder> openTarotCard(
  WidgetTester tester,
  int position, {
  bool english = false,
}) async {
  final card = find.bySemanticsLabel(
    english ? 'Choose card $position' : '选取第 $position 张牌',
  );
  final label = english ? 'Spread the deck' : '推开牌堆';
  final pile = find.byWidgetPredicate(
    (widget) =>
        widget is Semantics &&
        widget.properties.label == label &&
        widget.properties.onTap != null,
  );
  for (var push = 0; push < 40 && card.evaluate().isEmpty; push++) {
    tester.widget<Semantics>(pile).properties.onTap!();
    await tester.pump();
  }
  expect(card, findsOneWidget);
  return card;
}

Future<void> confirmTarotCard(WidgetTester tester, Finder card) async {
  tester.widget<Semantics>(card).properties.onTap!();
  await tester.pump();
  tester.widget<Semantics>(card).properties.onTap!();
  await tester.pump();
}
