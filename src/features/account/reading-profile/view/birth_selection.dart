import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/choice_wheel.dart';
import '../../../../ui/interface_language.dart';

import '../model/account_reading_profile.dart';

class BirthSelection extends StatelessWidget {
  const BirthSelection({
    super.key,
    required this.field,
    required this.initial,
    required this.choose,
  });

  final ReadingField field;
  final String initial;
  final ValueChanged<String> choose;

  @override
  Widget build(BuildContext context) {
    return Dialog(
      alignment: Alignment.bottomCenter,
      insetPadding: const EdgeInsets.fromLTRB(12, 16, 12, 12),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Semantics(
                      header: true,
                      child: Text(
                        '选择${field.label}',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                  ),
                  TextButton(
                    onPressed: () => Navigator.pop(context),
                    child: const UiText('取消'),
                  ),
                ],
              ),
              switch (field) {
                ReadingField.birthDate => _DateSelection(initial, choose),
                ReadingField.birthTime => _TimeSelection(initial, choose),
                ReadingField.birthPlace => _PlaceSelection(initial, choose),
                ReadingField.gender => const SizedBox.shrink(),
              },
              if (initial.isNotEmpty)
                TextButton(
                  onPressed: () => choose(''),
                  child: Text('清空${field.label}'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DateSelection extends StatefulWidget {
  const _DateSelection(this.initial, this.choose);
  final String initial;
  final ValueChanged<String> choose;
  @override
  State<_DateSelection> createState() => _DateSelectionState();
}

class _DateSelectionState extends State<_DateSelection> {
  late final _default =
      DateTime.tryParse(widget.initial) ?? DateTime(2000, 1, 1);
  late int _year = _default.year;
  late int _month = _default.month;
  late int _day = _default.day;
  late final _years = [
    if (_default.year < 1900) _default.year,
    for (var year = 1900; year <= DateTime.now().year; year++) year,
    if (_default.year > DateTime.now().year) _default.year,
  ];

  int get _days => DateTime.utc(_year, _month + 1, 0).day;

  void _changeDate({int? year, int? month}) => setState(() {
    _year = year ?? _year;
    _month = month ?? _month;
    _day = math.min(_day, _days);
  });

  @override
  Widget build(BuildContext context) => _SelectionArea(
    wheels: [
      ChoiceWheel(
        label: '年',
        values: [for (final year in _years) '$year年'],
        selected: _years.indexOf(_year),
        onSelected: (index) => _changeDate(year: _years[index]),
      ),
      ChoiceWheel(
        label: '月',
        values: [for (var month = 1; month <= 12; month++) '$month月'],
        selected: _month - 1,
        onSelected: (index) => _changeDate(month: index + 1),
      ),
      ChoiceWheel(
        key: ValueKey(_days),
        label: '日',
        values: [for (var day = 1; day <= _days; day++) '$day日'],
        selected: _day - 1,
        onSelected: (index) => setState(() => _day = index + 1),
      ),
    ],
    submit: '确认日期',
    onSubmit: () => widget.choose(
      DateTime.utc(_year, _month, _day).toIso8601String().substring(0, 10),
    ),
  );
}

class _TimeSelection extends StatefulWidget {
  const _TimeSelection(this.initial, this.choose);
  final String initial;
  final ValueChanged<String> choose;
  @override
  State<_TimeSelection> createState() => _TimeSelectionState();
}

class _TimeSelectionState extends State<_TimeSelection> {
  late final _initial = RegExp(
    r'^([01]\d|2[0-3]|\?\?):([0-5]\d|\?\?)$',
  ).firstMatch(widget.initial);
  late int _hour = int.tryParse(_initial?[1] ?? '') ?? 24;
  late int _minute = int.tryParse(_initial?[2] ?? '') ?? 60;

  void _confirm() {
    String part(int value, int unknown) =>
        value == unknown ? '??' : value.toString().padLeft(2, '0');
    widget.choose(
      _hour == 24 && _minute == 60
          ? ''
          : '${part(_hour, 24)}:${part(_minute, 60)}',
    );
  }

  @override
  Widget build(BuildContext context) => _SelectionArea(
    wheels: [
      ChoiceWheel(
        label: '时',
        values: [for (var value = 0; value < 24; value++) '$value时', '未知'],
        selected: _hour,
        onSelected: (index) => setState(() => _hour = index),
      ),
      ChoiceWheel(
        label: '分',
        values: [for (var value = 0; value < 60; value++) '$value分', '未知'],
        selected: _minute,
        onSelected: (index) => setState(() => _minute = index),
      ),
    ],
    submit: '确认时间',
    onSubmit: _confirm,
  );
}

typedef _Divisions = Map<String, Map<String, List<String>>>;
typedef _Location = ({String province, String city, String district});

class _PlaceSelection extends StatefulWidget {
  const _PlaceSelection(this.initial, this.choose);
  final String initial;
  final ValueChanged<String> choose;
  @override
  State<_PlaceSelection> createState() => _PlaceSelectionState();
}

class _PlaceSelectionState extends State<_PlaceSelection> {
  static const _asset =
      'src/features/account/reading-profile/assets/china.json';
  static const _groups = ['市辖区', '县', '省直辖县级行政区划', '自治区直辖县级行政区划'];
  late final _custom = TextEditingController(text: widget.initial);
  _Divisions? _divisions;
  _Location? _place;
  bool _manual = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _custom.dispose();
    super.dispose();
  }

  static String _format(_Location location) => [
    location.province,
    if (!_groups.contains(location.city)) location.city,
    if (location.district.isNotEmpty) location.district,
  ].join(' ');

  Future<void> _load() async {
    try {
      final decoded =
          jsonDecode(await rootBundle.loadString(_asset))
              as Map<String, Object?>;
      final divisions = decoded.map(
        (province, cities) => MapEntry(
          province,
          (cities as Map<String, Object?>).map(
            (city, districts) =>
                MapEntry(city, (districts as List).cast<String>()),
          ),
        ),
      );
      final saved = _find(divisions);
      if (!mounted) return;
      setState(() {
        _divisions = divisions;
        _place =
            saved ??
            (
              province: divisions.keys.first,
              city: divisions.values.first.keys.first,
              district: '',
            );
        _manual = widget.initial.isNotEmpty && saved == null;
        _failed = false;
      });
    } catch (_) {
      if (mounted)
        setState(() {
          _manual = true;
          _failed = true;
        });
    }
  }

  _Location? _find(_Divisions divisions) {
    final terms = widget.initial.split(' ');
    final province = terms.first;
    final cities = divisions[province];
    if (cities == null) return null;
    for (final city in cities.keys) {
      final districtIndex = _groups.contains(city) ? 1 : 2;
      final district = terms.elementAtOrNull(districtIndex) ?? '';
      final place = (province: province, city: city, district: district);
      if (_format(place) == widget.initial &&
          (district.isEmpty || cities[city]!.contains(district)))
        return place;
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    if (_manual)
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          TextField(
            controller: _custom,
            maxLength: 100,
            decoration: const InputDecoration(
              labelText: '手动填写出生地点',
              hintText: '可填写境外城市或历史地名',
            ),
            onChanged: (_) => setState(() {}),
          ),
          if (_divisions != null)
            TextButton(
              onPressed: () => setState(() => _manual = false),
              child: const UiText('切换到省市区选择'),
            ),
          if (_failed)
            TextButton(onPressed: _load, child: const Text('重新加载省市区目录')),
          FilledButton(
            onPressed: _custom.text.trim().isEmpty
                ? null
                : () => widget.choose(_custom.text.trim()),
            child: const UiText('确认地点'),
          ),
        ],
      );
    if ((_divisions, _place) case (final divisions?, final location?)) {
      final provinces = divisions.keys.toList();
      final cities = divisions[location.province]!.keys.toList();
      final districts = ['', ...divisions[location.province]![location.city]!];
      return _SelectionArea(
        wheels: [
          ChoiceWheel(
            label: '省级地区',
            values: provinces,
            selected: provinces.indexOf(location.province),
            onSelected: (index) => setState(() {
              final province = provinces[index];
              _place = (
                province: province,
                city: divisions[province]!.keys.first,
                district: '',
              );
            }),
          ),
          ChoiceWheel(
            key: ValueKey(location.province),
            label: '市',
            values: cities,
            selected: cities.indexOf(location.city),
            onSelected: (index) => setState(
              () => _place = (
                province: location.province,
                city: cities[index],
                district: '',
              ),
            ),
          ),
          ChoiceWheel(
            key: ValueKey((location.province, location.city)),
            label: '区县',
            values: ['不填区县', ...districts.skip(1)],
            selected: districts.indexOf(location.district),
            onSelected: (index) => setState(
              () => _place = (
                province: location.province,
                city: location.city,
                district: districts[index],
              ),
            ),
          ),
        ],
        submit: '确认地点',
        onSubmit: () => widget.choose(_format(location)),
        extra: TextButton(
          onPressed: () => setState(() => _manual = true),
          child: const UiText('手动填写地点'),
        ),
      );
    }
    return const LinearProgressIndicator();
  }
}

class _SelectionArea extends StatelessWidget {
  const _SelectionArea({
    required this.wheels,
    required this.submit,
    required this.onSubmit,
    this.extra,
  });
  final List<Widget> wheels;
  final String submit;
  final VoidCallback onSubmit;
  final Widget? extra;

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Row(
        children: [
          for (final wheel in wheels)
            Expanded(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                child: wheel,
              ),
            ),
        ],
      ),
      if (extra case final button?) button,
      const SizedBox(height: 8),
      FilledButton(onPressed: onSubmit, child: Text(submit)),
    ],
  );
}
