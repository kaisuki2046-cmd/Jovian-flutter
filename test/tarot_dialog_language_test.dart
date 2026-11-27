import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/view/ritual/guide_ritual_dialog.dart';
import '../src/ui/interface_language.dart';
import 'support/divination_service_fixture.dart';
import 'support/tarot_gestures.dart';

void main() {
  testWidgets('the narrow Tarot ritual localizes labels and reveal actions', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 600);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);

    final online = (DivinationServiceFixture()..failReport = false).connect(
      DivinationRecoveryFixture(),
    );
    addTearDown(online.dispose);
    await online.start(divinationFixtureDetails, automatic: false);
    for (var toss = 0; toss < 6; toss++) {
      await online.toss();
    }
    final changes = ValueNotifier(0);
    final subscription = online.changes.listen((_) => changes.value++);
    addTearDown(() async {
      await subscription.cancel();
      changes.dispose();
    });
    final revealed = <Set<int>>[];
    var paused = 0;
    await tester.pumpWidget(
      MaterialApp(
        locale: const Locale('en'),
        localizationsDelegates: const [interfaceStringsDelegate],
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: true,
            textScaler: const TextScaler.linear(1.4),
          ),
          child: child!,
        ),
        home: Scaffold(
          body: Center(
            child: GuideRitualDialog(
              presentation: GuideRitualPresentation(),
              changes: changes,
              snapshot: () => online.reading?.snapshot,
              busy: () => online.busy,
              error: () => online.message,
              retry: () => null,
              toss: () {},
              choose: (slot) => unawaited(online.pick(slot)),
              pause: () => paused++,
              onRevealChanged: revealed.add,
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Step 2 · Tarot selection'), findsOneWidget);
    expect(find.text('Choose three Tarot cards'), findsOneWidget);
    expect(
      find.text('Hold and drag the deck in any direction'),
      findsOneWidget,
    );
    expect(find.bySemanticsLabel('Spread the deck'), findsOneWidget);
    expect(find.byTooltip('Pause ritual').hitTestable(), findsOneWidget);
    expect(find.bySemanticsLabel('78-card deck'), findsOneWidget);
    expect(
      find.bySemanticsLabel('Empty card position · Present situation'),
      findsOneWidget,
    );
    expect(find.text('Selected 0 / 3'), findsOneWidget);

    for (final (index, slot) in [40, 39, 38].indexed) {
      final card = await openTarotCard(tester, slot, english: true);
      await tester.ensureVisible(card);
      await confirmTarotCard(tester, card);
      await tester.pumpAndSettle();
      if (index == 0) {
        expect(
          find.bySemanticsLabel('Card selected · Present situation'),
          findsOneWidget,
        );
        expect(find.text('Selected 1 / 3'), findsOneWidget);
      }
    }
    expect(find.text('Step 2 · Tarot reveal'), findsOneWidget);
    expect(find.text('Reveal three Tarot cards'), findsOneWidget);
    expect(
      find.text('Tap each card to reveal it, or reveal all three'),
      findsOneWidget,
    );
    final first = find.bySemanticsLabel('Reveal Present situation');
    await tester.ensureVisible(first);
    tester.widget<Semantics>(first).properties.onTap!();
    await tester.pumpAndSettle();
    expect(first, findsNothing);
    expect(revealed.single, {39});

    final all = find.text('Reveal all');
    await tester.ensureVisible(all);
    await tester.tap(all);
    await tester.pumpAndSettle();
    expect(revealed, [
      {39},
      {39, 38, 37},
    ]);
    final reading = find.text('View reading');
    await tester.ensureVisible(reading);
    await tester.tap(reading);
    expect(paused, 1);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
