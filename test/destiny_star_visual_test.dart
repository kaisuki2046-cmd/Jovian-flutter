import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/destiny/view/destiny_page.dart';
import '../src/features/destiny/view/destiny_dashboard.dart';
import '../src/features/destiny/view/destiny_star_visual.dart';
import '../src/ui/theme.dart';

void main() {
  testWidgets('Destiny keeps motion in the calculation progress view', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 680);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);

    await tester.pumpWidget(
      MaterialApp(
        home: DestinyPage(
          loadPlaces: () async => [],
          calculateReading: (_, _, _) async => fail('Unexpected calculation'),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('本命命盘'), findsOneWidget);
    expect(find.byType(DestinyStarVisual), findsNothing);
    expect(find.byType(Image), findsNothing);

    Widget app({bool reduced = false, bool motion = true}) => MaterialApp(
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: reduced),
        child: child!,
      ),
      home: Scaffold(body: DestinyStarVisual(motion: motion, step: 2)),
    );

    await tester.pumpWidget(app());
    await tester.pump();
    expect(find.byType(DestinyStarVisual), findsOneWidget);
    expect(tester.binding.transientCallbackCount, greaterThan(0));

    await tester.pumpWidget(app(motion: false));
    await tester.pumpAndSettle();
    expect(tester.binding.transientCallbackCount, 0);

    await tester.pumpWidget(app());
    await tester.pump();
    expect(tester.binding.transientCallbackCount, greaterThan(0));

    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.inactive);
    await tester.pumpAndSettle();
    expect(tester.binding.transientCallbackCount, 0);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await tester.pump();
    expect(tester.binding.transientCallbackCount, greaterThan(0));

    await tester.pumpWidget(app(reduced: true));
    await tester.pumpAndSettle();
    expect(find.byType(DestinyStarVisual), findsOneWidget);
    expect(tester.binding.transientCallbackCount, 0);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('Destiny card actions fit enlarged text on a narrow screen', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 680);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    var opened = false;

    await tester.pumpWidget(
      MaterialApp(
        theme: jovianTheme(Brightness.dark),
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: const TextScaler.linear(1.3)),
          child: child!,
        ),
        home: Scaffold(
          body: ListView(
            padding: jovianPagePadding,
            children: [
              DestinyDashboard(
                motion: false,
                chartAction: '查看命盘',
                onOpenChart: () {},
                hasBirthDetails: true,
                onEditBirthDetails: () => opened = true,
                onOpenFortune: null,
                onOpenPeriod: (_) {},
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('切换命盘卡片'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, '核对出生资料'));
    expect(opened, isTrue);
    expect(tester.takeException(), isNull);
  });
}
