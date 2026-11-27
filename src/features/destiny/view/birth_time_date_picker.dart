import 'dart:math' as math;

import 'package:jovian_destiny/jovian_destiny.dart'
    show BirthDate, BirthTime, firstBirthYear;
import 'package:material_ui/material_ui.dart';

import '../../../ui/choice_wheel.dart';
import '../../../ui/interface_language.dart';
import '../../../ui/theme.dart';

Future<BirthDate?> pickBirthDate(BuildContext context, BirthDate? current) {
  final today = DateTime.now();
  return _pick<BirthDate>(
    context,
    title: '选择出生日期',
    initial: current?.isValid(today: today) == true
        ? current!
        : const BirthDate(2000, 1, 1),
    wheels: (context, date, select) {
      final lastMonth = date.year == today.year ? today.month : 12;

      int lastDay(int year, int month) =>
          year == today.year && month == today.month
          ? today.day
          : DateTime.utc(year, month + 1, 0).day;

      void change(int year, int month) {
        final safeMonth = year == today.year
            ? math.min(month, today.month)
            : month;
        select(
          BirthDate(
            year,
            safeMonth,
            math.min(date.day, lastDay(year, safeMonth)),
          ),
        );
      }

      return [
        _numberWheel(
          context,
          '年',
          firstBirthYear,
          today.year,
          date.year,
          (year) => change(year!, date.month),
        ),
        _numberWheel(
          context,
          '月',
          1,
          lastMonth,
          date.month,
          (month) => change(date.year, month!),
          key: ValueKey(('month', lastMonth)),
        ),
        _numberWheel(
          context,
          '日',
          1,
          lastDay(date.year, date.month),
          date.day,
          (day) => select(BirthDate(date.year, date.month, day!)),
          key: ValueKey(('day', lastDay(date.year, date.month))),
        ),
      ];
    },
  );
}

Future<BirthTime?> pickBirthTime(
  BuildContext context,
  BirthTime? current, {
  required bool requireKnownTime,
}) => _pick<BirthTime>(
  context,
  title: '选择出生时间',
  initial: requireKnownTime
      ? BirthTime(hour: current?.hour ?? 12, minute: current?.minute ?? 0)
      : current ?? const BirthTime(),
  note: requireKnownTime && current?.timeKnown != true
      ? '请核对实际出生的小时和分钟，再确认。'
      : null,
  wheels: (context, time, select) => [
    _numberWheel(
      context,
      '小时',
      0,
      23,
      time.hour,
      (hour) => select(BirthTime(hour: hour, minute: time.minute)),
      unknown: !requireKnownTime,
    ),
    _numberWheel(
      context,
      '分钟',
      0,
      59,
      time.minute,
      (minute) => select(BirthTime(hour: time.hour, minute: minute)),
      unknown: !requireKnownTime,
    ),
  ],
);

Widget _numberWheel(
  BuildContext context,
  String label,
  int first,
  int last,
  int? value,
  ValueChanged<int?> onSelected, {
  Key? key,
  bool unknown = false,
}) {
  final labels = switch (label) {
    '小时' => '时',
    '分钟' => '分',
    _ => label,
  };
  final chinese = context.uiLanguage == InterfaceLanguage.chinese;
  return ChoiceWheel(
    key: key,
    label: context.uiLabel(label),
    visibleRows: 3,
    values: [
      for (var number = first; number <= last; number++)
        chinese ? '$number$labels' : '$number',
      if (unknown) context.uiLabel('未知'),
    ],
    selected: (value ?? last + 1) - first,
    onSelected: (index) {
      final number = first + index;
      onSelected(number > last ? null : number);
    },
  );
}

Future<T?> _pick<T extends Object>(
  BuildContext context, {
  required String title,
  required T initial,
  required List<Widget> Function(BuildContext, T, ValueChanged<T>) wheels,
  String? note,
}) {
  var draft = initial;
  return showModalBottomSheet<T>(
    context: context,
    constraints: const BoxConstraints(maxWidth: jovianPageWidth),
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: Theme.of(context).colorScheme.surfaceContainerLow,
    barrierLabel: context.uiLabel('关闭选择面板'),
    sheetAnimationStyle: MediaQuery.disableAnimationsOf(context)
        ? AnimationStyle.noAnimation
        : null,
    builder: (context) => StatefulBuilder(
      builder: (context, setState) => SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(18, 16, 18, 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            spacing: 12,
            children: [
              Semantics(
                header: true,
                child: UiText(
                  title,
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                spacing: 8,
                children: [
                  for (final wheel in wheels(
                    context,
                    draft,
                    (value) => setState(() => draft = value),
                  ))
                    Expanded(key: wheel.key, child: wheel),
                ],
              ),
              if (note != null) UiText(note),
              Wrap(
                alignment: WrapAlignment.end,
                spacing: 8,
                children: [
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const UiText('取消'),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.pop(context, draft),
                    child: const UiText('确认'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    ),
  );
}
