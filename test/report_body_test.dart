import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/destiny/destiny.dart' show DestinyReportText;
import '../src/ui/report_body.dart';
import '../src/ui/theme.dart';

void main() {
  testWidgets(
    'old RN markup keeps its text and formats titles, items and emphasis',
    (tester) async {
      const text =
          '开场正文。\r\n\r\n### 综合\r\n'
          '第一段有 **重点** 和 C# 资料。\r\n继续解释。\r\n\r\n'
          '---\r\n**事业**\r\n- 具体步骤一\r\n2. 具体步骤二\r\n\r\n收束正文。';
      await _show(tester, const ReportBody(text));

      expect(find.text('### 综合'), findsNothing);
      expect(find.text('**事业**'), findsNothing);
      expect(
        tester
            .widgetList<ReportHeading>(find.byType(ReportHeading))
            .map((heading) => heading.title),
        ['综合', '事业'],
      );
      expect(find.text('开场正文。'), findsOneWidget);
      expect(find.text('收束正文。'), findsOneWidget);
      expect(find.text('•'), findsOneWidget);
      expect(find.text('具体步骤一'), findsOneWidget);
      expect(find.text('2.'), findsOneWidget);
      expect(find.text('具体步骤二'), findsOneWidget);
      expect(find.byType(Divider), findsOneWidget);
      final paragraph = tester.widget<Text>(
        find.text('第一段有 重点 和 C# 资料。\n继续解释。'),
      );
      final spans = (paragraph.textSpan! as TextSpan).children!
          .cast<TextSpan>();
      expect(
        spans.firstWhere((span) => span.text == '重点').style!.fontWeight,
        FontWeight.w600,
      );
      expect(find.byType(SelectionArea), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'destiny topics keep archive aliases and text on the heading line',
    (tester) async {
      const text =
          '这段引言原样保留。\n'
          '### 二、【财运】：保留同一行正文。\n普通换行仍然保留。\n'
          '[感情]\n- 从合适的沟通方式入手。';
      await _show(tester, const DestinyReportText(text));

      expect(
        tester
            .widgetList<ReportHeading>(find.byType(ReportHeading))
            .map((heading) => heading.title),
        ['财富', '爱情'],
      );
      expect(find.text('保留同一行正文。\n普通换行仍然保留。'), findsOneWidget);
      expect(find.text('这段引言原样保留。'), findsOneWidget);
      expect(find.text('从合适的沟通方式入手。'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}

Future<void> _show(WidgetTester tester, Widget report) async {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = const Size(320, 600);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(
    MaterialApp(
      theme: jovianTheme(Brightness.dark),
      home: Scaffold(
        body: MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(2)),
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: report,
          ),
        ),
      ),
    ),
  );
}
