import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/app/main.dart';

void main() {
  testWidgets(
    'validates numeric fields and displays the calculated hexagrams',
    (tester) async {
      await tester.pumpWidget(const JovianApp());
      await tester.tap(find.text('用这三个数起卦'));
      await tester.pump();
      expect(find.text('请输入 1 到 999 的整数'), findsNWidgets(3));
      expect(find.text('梅花易数结果'), findsNothing);

      for (var index = 0; index < 3; index++) {
        await tester.enterText(find.byType(TextFormField).at(index), '1');
      }
      await tester.ensureVisible(find.text('用这三个数起卦'));
      await tester.tap(find.text('用这三个数起卦'));
      await tester.pumpAndSettle();
      expect(find.text('梅花易数结果'), findsOneWidget);
      expect(find.text('本卦 · 乾为天'), findsOneWidget);
      expect(find.text('互卦 · 风火家人'), findsOneWidget);
      expect(find.text('取数 1、1、1 · 第 3 爻动'), findsOneWidget);
    },
  );
}
