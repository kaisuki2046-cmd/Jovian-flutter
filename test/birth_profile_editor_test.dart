import 'package:flutter_test/flutter_test.dart';
import 'package:jovian_destiny/jovian_destiny.dart'
    show BirthPlace, BirthProfile;
import 'package:material_ui/material_ui.dart';

import '../src/features/destiny/view/birth_profile_editor.dart';

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
