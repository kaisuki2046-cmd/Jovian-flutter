import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_divination/jovian_divination.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/requests/reading_history_codec.dart';
import '../src/features/divination/view/guide_form.dart';
import '../src/features/divination/view/ritual/tarot_ritual.dart';
import 'support/divination_service_fixture.dart';

const _selected = [4, 17, 31];
const _resume = '继续本次仪式';

void main() {
  testWidgets('one revealed card resumes in the same draw after reopening', (
    tester,
  ) async {
    final service = DivinationServiceFixture()..failReport = false;
    final store = DivinationRecoveryFixture();
    final first = await _cast(service, store);
    final draw = first.reading!.snapshot.chart!;
    expect((await store.readHistory()).single.revealedTarotSlots, isEmpty);

    await _open(tester, first);
    await _tap(tester, _resume);
    final firstCard = find.bySemanticsLabel('翻开现状牌');
    tester.widget<Semantics>(firstCard).properties.onTap!();
    await tester.pumpAndSettle();
    expect((await store.readHistory()).single.revealedTarotSlots, {
      _selected.first,
    });

    await _close(tester, first);
    service.calls.clear();
    final restored = service.connect(store);
    await _open(tester, restored);
    expect(find.text('塔罗对照报告。'), findsNothing);
    expect(restored.reading!.snapshot.chart!.chartHash, draw.chartHash);
    expect(service.calls, ['GET /reading']);
    await _tap(tester, _resume);
    final panel = tester.widget<TarotRitualPanel>(
      find.byType(TarotRitualPanel),
    );
    expect(panel.revealed, {_selected.first});
    expect(panel.selectedSlots, _selected);
    expect(find.bySemanticsLabel('翻开现状牌'), findsNothing);
    expect(find.bySemanticsLabel('翻开关键影响牌'), findsOneWidget);
    expect(find.bySemanticsLabel('翻开趋势牌'), findsOneWidget);

    await _tap(tester, '一键翻牌');
    expect(
      (await store.readHistory()).single.revealedTarotSlots,
      _selected.toSet(),
    );
    await _close(tester, restored);

    final completed = service.connect(store);
    await _open(tester, completed);
    expect(find.text('塔罗对照报告。'), findsOneWidget);
    expect(find.text(_resume), findsNothing);
    expect(service.calls, ['GET /reading', 'GET /reading']);
    expect(tester.takeException(), isNull);
    await _close(tester, completed);
  });

  testWidgets('an expired unfinished reveal leaves its saved report readable', (
    tester,
  ) async {
    final service = DivinationServiceFixture()..failReport = false;
    final store = DivinationRecoveryFixture();
    final first = await _cast(service, store);
    await first.revealTarotSlots({_selected.first});
    first.dispose();
    service.expired = true;

    final restored = service.connect(store);
    await _open(tester, restored);
    expect(store.state, isNull);
    expect(restored.canContinue, isFalse);
    expect((await store.readHistory()).single.revealedTarotSlots, {
      _selected.first,
    });
    expect(find.text('塔罗对照报告。'), findsOneWidget);
    expect(find.text(_resume), findsNothing);
    expect(tester.takeException(), isNull);
    await _close(tester, restored);
  });

  testWidgets(
    'history without recognized reveal data directly opens its report',
    (tester) async {
      final service = DivinationServiceFixture()..failReport = false;
      final store = DivinationRecoveryFixture();
      final first = await _cast(service, store);
      final newEntry = (await store.readHistory()).single;
      final json = jsonDecode(encodeGuideHistory(newEntry)) as Map;
      expect(
        (json['reading'] as Map).containsKey('revealedTarotSlots'),
        isFalse,
      );
      final previousEntry = decodeGuideHistory(
        jsonEncode({...json}..remove('revealedTarotSlots')),
      )!;
      expect(previousEntry.revealedTarotSlots, isNull);
      final malformed = decodeGuideHistory(
        jsonEncode({
          ...json,
          'revealedTarotSlots': [-1],
        }),
      )!;
      expect(malformed.revealedTarotSlots, isNull);
      expect(malformed.reading.report, isNotNull);
      await store.writeHistory(previousEntry);
      first.dispose();

      final restored = service.connect(store);
      await _open(tester, restored);
      expect(find.text('塔罗对照报告。'), findsOneWidget);
      expect(find.text(_resume), findsNothing);
      expect(tester.takeException(), isNull);
      await _close(tester, restored);
    },
  );
}

Future<OnlineGuideController> _cast(
  DivinationServiceFixture service,
  DivinationRecoveryFixture store,
) async {
  final online = service.connect(store);
  await online.start(divinationFixtureDetails, automatic: false);
  for (var step = 0; step < 6; step++) {
    await online.toss();
  }
  for (final slot in _selected) {
    await online.pick(slot);
  }
  return online;
}

Future<void> _open(WidgetTester tester, OnlineGuideController online) async {
  await tester.pumpWidget(
    MaterialApp(
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(disableAnimations: true),
        child: child!,
      ),
      home: GuideForm(online: online),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> _close(WidgetTester tester, OnlineGuideController online) async {
  await tester.pumpWidget(const SizedBox.shrink());
  await tester.pumpAndSettle();
  online.dispose();
}

Future<void> _tap(WidgetTester tester, String label) async {
  final action = find.text(label);
  await tester.ensureVisible(action);
  await tester.tap(action);
  await tester.pumpAndSettle();
}
