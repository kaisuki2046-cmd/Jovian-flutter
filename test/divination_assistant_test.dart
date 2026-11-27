import 'dart:async';

import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:material_ui/material_ui.dart';

import '../src/features/divination/view/guide_assistant_sprite.dart';
import '../src/features/divination/view/guide_form.dart';
import '../src/ui/interface_language.dart';
import 'support/divination_service_fixture.dart';

void main() {
  final welcome = find.byKey(const ValueKey('guide-assistant-welcome'));
  final response = find.byKey(const ValueKey('guide-assistant-response'));
  final flying = find.byKey(const ValueKey('guide-assistant-flight'));
  final dock = find.byKey(const ValueKey('guide-assistant-composer'));

  testWidgets('touch reacts and carries the portrait to the phone composer', (
    tester,
  ) async {
    _screen(tester, const Size(360, 720));
    final ready = Completer<void>();
    final service = DivinationServiceFixture()..understanding = ready.future;
    final online = service.connect(DivinationRecoveryFixture());
    addTearDown(online.dispose);
    await tester.pumpWidget(MaterialApp(home: GuideForm(online: online)));
    await tester.pump();
    final intro = find.byKey(const ValueKey('guide-assistant-clip-intro'));
    final idle = find.byKey(const ValueKey('guide-assistant-clip-idle'));
    final tapClip = find.byKey(const ValueKey('guide-assistant-clip-tap'));
    final speech = find.byKey(const ValueKey('guide-speech-drift'));
    final gold = find.byKey(const ValueKey('guide-gold-flecks'));
    expect(intro, findsOneWidget);
    final initialSpeech = tester
        .widget<Transform>(speech)
        .transform
        .entry(1, 3);
    final initialGold = tester.widget<CustomPaint>(gold).painter!;
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(
      tester.widget<Transform>(speech).transform.entry(1, 3),
      isNot(initialSpeech),
    );
    expect(
      tester.widget<CustomPaint>(gold).painter!.shouldRepaint(initialGold),
      isTrue,
    );
    await tester.pump(const Duration(milliseconds: 3650));
    expect(idle, findsOneWidget);

    await tester.tap(welcome);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 210));
    expect(
      tester.widget<Transform>(response).transform.entry(0, 0),
      greaterThan(1),
    );
    expect(tapClip, findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1000));
    expect(idle, findsOneWidget);
    expect(tester.widget<Transform>(response).transform.entry(0, 0), 1);

    final origin = tester.getCenter(welcome);
    final actorState = tester.state(find.byType(GuideAssistantSprite));
    await tester.enterText(
      find.byType(TextFormField),
      divinationFixtureQuestion,
    );
    await tester.pump();
    await tester.tap(find.byTooltip('发送消息'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 90));
    expect(flying, findsOneWidget);
    expect(welcome, findsNothing);
    expect(tester.widget<Opacity>(dock).opacity, 0);
    expect(tester.state(find.byType(GuideAssistantSprite)), same(actorState));
    final first =
        tester.getCenter(dock) +
        tester.widget<CompositedTransformFollower>(flying).offset;
    expect((first - origin).distance, lessThan(100));

    await tester.pump(const Duration(milliseconds: 300));
    final terminal = tester.getCenter(dock);
    expect(
      tester.widget<CompositedTransformFollower>(flying).offset.distance,
      lessThan((first - terminal).distance),
    );

    await tester.pump(const Duration(milliseconds: 280));
    await tester.pump();
    expect(flying, findsNothing);
    expect(tester.widget<Opacity>(dock).opacity, .45);
    expect(tester.state(find.byType(GuideAssistantSprite)), same(actorState));

    ready.complete();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(tester.widget<Opacity>(dock).opacity, 1);
    expect(service.understood, [divinationFixtureQuestion]);
    await tester.enterText(find.byType(TextFormField), '补充一下具体情况');
    await tester.pump();
    expect(
      find.byKey(const ValueKey('guide-assistant-clip-listening')),
      findsOneWidget,
    );
    await tester.tap(find.byTooltip('添加附件或快捷提问'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 300));
    expect(find.text('添加图片'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
    'desktop keyboard can activate the assistant and motion is optional',
    (tester) async {
      _screen(tester, const Size(1100, 850));
      final dispatcher = tester.binding.platformDispatcher;
      dispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(accessibleNavigation: true);
      addTearDown(dispatcher.clearAccessibilityFeaturesTestValue);
      final ready = Completer<void>();
      final service = DivinationServiceFixture()..understanding = ready.future;
      final online = service.connect(DivinationRecoveryFixture());
      addTearDown(online.dispose);
      await tester.pumpWidget(
        MaterialApp(
          locale: const Locale('en'),
          localizationsDelegates: const [interfaceStringsDelegate],
          home: GuideForm(online: online),
        ),
      );
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 4200));

      for (var i = 0; i < 3; i++) {
        await tester.sendKeyEvent(LogicalKeyboardKey.tab);
        await tester.pump();
      }
      expect(
        FocusManager.instance.primaryFocus?.context
            ?.findAncestorWidgetOfExactType<InkWell>()
            ?.key,
        const ValueKey('guide-assistant-welcome'),
      );
      await tester.sendKeyEvent(LogicalKeyboardKey.space);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 175));
      expect(
        tester.widget<Transform>(response).transform.entry(0, 0),
        greaterThan(1),
      );

      tester.binding.platformDispatcher.accessibilityFeaturesTestValue =
          const FakeAccessibilityFeatures(disableAnimations: true);
      addTearDown(
        tester.binding.platformDispatcher.clearAccessibilityFeaturesTestValue,
      );
      await tester.pumpAndSettle();
      await tester.tap(welcome);
      await tester.pump(const Duration(milliseconds: 175));
      expect(tester.widget<Transform>(response).transform.entry(0, 0), 1);
      expect(find.byKey(const ValueKey('guide-gold-flecks')), findsNothing);

      const example = 'Will my interview go well?';
      await tester.tap(find.text(example));
      await tester.pumpAndSettle();
      final field = tester.widget<TextFormField>(find.byType(TextFormField));
      expect(field.controller!.text, example);
      expect(
        tester.widget<TextField>(find.byType(TextField)).focusNode!.hasFocus,
        isTrue,
      );
      await tester.tap(find.byTooltip('Send message'));
      await tester.pump();
      expect(flying, findsNothing);
      expect(tester.widget<Opacity>(dock).opacity, .45);

      await tester.tap(find.byTooltip('Stop'));
      await tester.pumpAndSettle();
      ready.complete();
      await tester.pumpAndSettle();
      expect(field.controller!.text, example);
      expect(tester.takeException(), isNull);
    },
  );
}

void _screen(WidgetTester tester, Size size) {
  tester.view.devicePixelRatio = 1;
  tester.view.physicalSize = size;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}
