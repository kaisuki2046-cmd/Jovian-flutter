import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/destiny/view/destiny_page.dart';
import '../src/features/destiny/view/destiny_star_visual.dart';

void main() {
  testWidgets('the Destiny motion toggle respects the system and lifecycle', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 680);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    tester.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);

    Widget app({bool reduced = false}) => MaterialApp(
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: reduced),
        child: child!,
      ),
      home: DestinyPage(
        loadPlaces: () async => [],
        calculateReading: (_, _, _) async => fail('Unexpected calculation'),
      ),
    );

    await tester.pumpWidget(app());
    await tester.pump();
    expect(find.byType(DestinyStarVisual), findsOneWidget);
    expect(tester.binding.transientCallbackCount, greaterThan(0));

    await tester.tap(find.byTooltip('关闭动效'));
    await tester.pumpAndSettle();
    expect(find.byTooltip('开启动效'), findsOneWidget);
    expect(tester.binding.transientCallbackCount, 0);

    await tester.tap(find.byTooltip('开启动效'));
    await tester.pump();
    expect(find.byTooltip('关闭动效'), findsOneWidget);
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
    final system = tester.widget<IconButton>(
      find.byWidgetPredicate(
        (widget) => widget is IconButton && widget.tooltip == '系统已减少动态效果',
      ),
    );
    expect(system.onPressed, isNull);
    expect(tester.binding.transientCallbackCount, 0);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
