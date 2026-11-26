import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_destiny/jovian_destiny.dart'
    show BirthPlace, BirthProfile;
import 'package:material_ui/material_ui.dart';

import '../src/features/destiny/view/birth_place_picker.dart';
import '../src/features/destiny/view/birth_profile_editor.dart';
import '../src/ui/theme.dart';

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

    await tester.tap(find.byTooltip('选择出生日期'));
    await tester.pumpAndSettle();
    expect(find.byType(DatePickerDialog), findsOneWidget);
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('选择出生时间'));
    await tester.pumpAndSettle();
    expect(find.byType(TimePickerDialog), findsOneWidget);
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();

    await tester.tap(find.byTooltip('选择出生地点'));
    await tester.pumpAndSettle();
    for (final label in ['中国', '浙江省', '杭州市', '拱墅区']) {
      await tester.tap(find.text(label).last);
      await tester.pumpAndSettle();
    }
    await tester.tap(find.widgetWithText(FilledButton, '确认'));
    await tester.pumpAndSettle();

    // Searching for a normalized location and cancelling leaves the saved choice.
    await tester.tap(find.byTooltip('选择出生地点'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, '搜索城市或区县'),
      '杭州市 · 拱墅',
    );
    await tester.pumpAndSettle();
    expect(find.widgetWithText(ListTile, _district.name), findsOneWidget);
    await tester.tap(find.text('取消'));
    await tester.pumpAndSettle();

    expect(
      tester
          .widget<TextField>(find.widgetWithText(TextField, '出生地'))
          .controller
          ?.text,
      _district.name,
    );
    await tester.tap(find.text('女'));
    await tester.tap(find.widgetWithText(FilledButton, '核对出生资料'));
    await tester.pumpAndSettle();
    expect(profile?.date.year, 2000);
    expect(profile?.date.month, 1);
    expect(profile?.date.day, 1);
    expect(profile?.time.hour, 12);
    expect(profile?.time.minute, 0);
    expect(profile?.place.id, _district.id);
    expect(tester.takeException(), isNull);
  });
}
