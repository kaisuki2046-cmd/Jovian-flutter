import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_destiny/jovian_destiny.dart'
    show BirthDate, BirthPlace, BirthProfile;
import 'package:material_ui/material_ui.dart';

import '../src/features/destiny/view/birth_place_picker.dart';
import '../src/features/destiny/view/birth_profile_editor.dart';
import '../src/features/destiny/view/birth_time_date_picker.dart';
import '../src/ui/theme.dart';
import 'support/birth_picker_fixture.dart';

const _district = BirthPlace(
  id: 'test-gongshu',
  name: '浙江省 杭州市 拱墅区',
  countryCode: 'CN',
  country: '中国',
  region: '浙江省',
  city: '杭州市',
  district: '拱墅区',
  latitude: 30.319,
  longitude: 120.142,
  timeZone: 'Asia/Shanghai',
);

void main() {
  final themes = ValueVariant<Brightness>(Brightness.values.toSet());
  testWidgets(
    'landscape birth-place search remains usable at 200 percent text',
    variant: themes,
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(640, 320);
      addTearDown(tester.view.resetDevicePixelRatio);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetViewInsets);
      tester.platformDispatcher.textScaleFactorTestValue = 2;
      addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
      BirthPlace? selected;
      await tester.pumpWidget(
        MaterialApp(
          theme: jovianTheme(themes.currentValue!),
          home: Builder(
            builder: (context) => Scaffold(
              body: FilledButton(
                onPressed: () async =>
                    selected = await pickBirthPlace(context, [_district], null),
                child: const Text('打开出生地点'),
              ),
            ),
          ),
        ),
      );
      await tester.tap(find.text('打开出生地点'));
      await tester.pumpAndSettle();
      final search = find.widgetWithText(TextField, '搜索城市或区县');
      await tester.tap(search);
      tester.view.viewInsets = const FakeViewPadding(bottom: 180);
      await tester.enterText(search, '拱墅');
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      final result = find.widgetWithText(ListTile, _district.name);
      final pickerScroll = find
          .descendant(
            of: find.byType(Dialog),
            matching: find.byType(Scrollable),
          )
          .first;
      await tester.scrollUntilVisible(result, 45, scrollable: pickerScroll);
      await Scrollable.ensureVisible(tester.element(result), alignment: .5);
      await tester.pumpAndSettle();
      await tester.tap(result);
      await tester.pumpAndSettle();
      final confirm = find.widgetWithText(FilledButton, '确认');
      await tester.scrollUntilVisible(confirm, 45, scrollable: pickerScroll);
      await Scrollable.ensureVisible(tester.element(confirm), alignment: .5);
      await tester.pumpAndSettle();
      expect(tester.widget<FilledButton>(confirm).onPressed, isNotNull);
      await tester.tap(confirm);
      await tester.pumpAndSettle();
      expect(selected?.id, _district.id);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets('the date wheel clamps leap days and supports the keyboard', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: FilledButton(
              onPressed: () async {
                final result = await pickBirthDate(
                  context,
                  const BirthDate(2000, 1, 31),
                );
                expect(result?.year, 2000);
                expect(result?.month, 2);
                expect(result?.day, 29);
              },
              child: const Text('打开日期'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('打开日期'));
    await tester.pumpAndSettle();

    // First focus goes to year, then month. Down selects the next month.
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pumpAndSettle();
    expect(
      tester
          .widget<ListWheelScrollView>(find.byType(ListWheelScrollView).at(2))
          .childDelegate
          .estimatedChildCount,
      29,
    );
    await tester.tap(find.widgetWithText(FilledButton, '确认'));
    await tester.pumpAndSettle();
    expect(find.byType(BottomSheet), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('narrow birth form offers date, time and directory pickers', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(320, 700);
    addTearDown(tester.view.resetDevicePixelRatio);
    addTearDown(tester.view.resetPhysicalSize);
    tester.platformDispatcher.textScaleFactorTestValue = 1.2;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);
    BirthProfile? profile;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: ListView(
            padding: const EdgeInsets.all(12),
            children: [
              BirthProfileEditor(
                loadPlaces: () async => [_district],
                requireKnownTime: true,
                submitLabel: '核对出生资料',
                onSubmit: (result) => profile = result,
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await openBirthPicker(tester, '选择出生日期');
    expect(find.byType(ListWheelScrollView), findsNWidgets(3));
    await tester.tap(find.text('2日'));
    await tester.pumpAndSettle();
    await confirmBirthPicker(tester);
    expect(find.text('2000 年 1 月 2 日'), findsOneWidget);

    await openBirthPicker(tester, '选择出生时间');
    expect(find.byType(ListWheelScrollView), findsNWidgets(2));
    expect(find.text('请核对实际出生的小时和分钟，再确认。'), findsOneWidget);
    await tester.tap(find.text('1分'));
    await tester.pumpAndSettle();
    await confirmBirthPicker(tester);
    expect(find.text('12:01'), findsOneWidget);

    await openBirthPicker(tester, '选择出生地点');
    for (final label in ['中国', '浙江省', '杭州市', '拱墅区']) {
      await tester.tap(find.text(label).last);
      await tester.pumpAndSettle();
    }
    await tester.tap(find.widgetWithText(FilledButton, '确认'));
    await tester.pumpAndSettle();

    // Searching for a normalized location and cancelling leaves the saved choice.
    await openBirthPicker(tester, '选择出生地点');
    await tester.enterText(
      find.widgetWithText(TextField, '搜索城市或区县'),
      '杭州市 · 拱墅',
    );
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ListTile, _district.name), findsOneWidget);
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();

    expect(find.widgetWithText(OutlinedButton, _district.name), findsOneWidget);
    await tester.tap(find.text('女'));
    await tester.tap(find.widgetWithText(FilledButton, '核对出生资料'));
    await tester.pumpAndSettle();
    expect(profile?.date.year, 2000);
    expect(profile?.date.month, 1);
    expect(profile?.date.day, 2);
    expect(profile?.time.hour, 12);
    expect(profile?.time.minute, 1);
    expect(profile?.place.id, _district.id);
    expect(tester.takeException(), isNull);
  });
}
