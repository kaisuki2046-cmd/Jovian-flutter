import 'package:flutter/services.dart';
import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../model/birth_profile_draft.dart';
import 'birth_place_picker.dart';

class BirthProfileEditor extends StatefulWidget {
  const BirthProfileEditor({
    super.key,
    required this.loadPlaces,
    required this.submitLabel,
    required this.onSubmit,
    this.busy = false,
    this.requireKnownTime = false,
    this.initialDraft = const BirthProfileDraft(),
  });

  final Future<List<BirthPlace>> Function() loadPlaces;
  final String submitLabel;
  final ValueChanged<BirthProfile> onSubmit;
  final bool busy;
  final bool requireKnownTime;
  final BirthProfileDraft initialDraft;

  @override
  State<BirthProfileEditor> createState() => _BirthProfileEditorState();
}

class _BirthProfileEditorState extends State<BirthProfileEditor> {
  late final _date = TextEditingController(
    text: widget.initialDraft.date == null
        ? null
        : birthDateText(widget.initialDraft.date!),
  );
  late final _hour = TextEditingController(
    text: widget.initialDraft.time?.hour?.toString().padLeft(2, '0'),
  );
  late final _minute = TextEditingController(
    text: widget.initialDraft.time?.minute?.toString().padLeft(2, '0'),
  );
  late final _placeText = TextEditingController(
    text: widget.initialDraft.place?.name,
  );
  final _placeFocus = FocusNode();
  late Future<List<BirthPlace>> _places = widget.loadPlaces();
  late BirthPlace? _place = widget.initialDraft.place;
  late BirthGender? _gender = widget.initialDraft.gender;
  String? _error;

  @override
  void dispose() {
    _date.dispose();
    _hour.dispose();
    _minute.dispose();
    _placeText.dispose();
    _placeFocus.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      TextField(
        controller: _date,
        enabled: !widget.busy,
        keyboardType: TextInputType.datetime,
        decoration: InputDecoration(
          labelText: context.uiLabel('出生日期'),
          hintText: 'YYYY-MM-DD',
          suffixIcon: IconButton(
            tooltip: context.uiLabel('选择出生日期'),
            onPressed: widget.busy ? null : _pickDate,
            icon: const Icon(Icons.calendar_month_outlined),
          ),
        ),
      ),
      const SizedBox(height: 12),
      Row(
        children: [
          Expanded(child: _timeField(_hour, '出生小时')),
          const SizedBox(width: 12),
          Expanded(child: _timeField(_minute, '出生分钟')),
          IconButton(
            tooltip: context.uiLabel('选择出生时间'),
            onPressed: widget.busy ? null : _pickTime,
            icon: const Icon(Icons.access_time_outlined),
          ),
        ],
      ),
      const SizedBox(height: 12),
      FutureBuilder<List<BirthPlace>>(
        future: _places,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return TextButton(
              onPressed: () => setState(() => _places = widget.loadPlaces()),
              child: const UiText('出生地目录加载失败，点击重试'),
            );
          }
          final places = snapshot.data;
          if (places == null) return const LinearProgressIndicator();
          return _placeField(places);
        },
      ),
      const SizedBox(height: 12),
      Wrap(
        spacing: 8,
        children: [
          for (final (gender, label) in const [
            (BirthGender.female, '女'),
            (BirthGender.male, '男'),
          ])
            ChoiceChip(
              label: UiText(label),
              selected: _gender == gender,
              onSelected: widget.busy
                  ? null
                  : (_) => setState(() => _gender = gender),
            ),
        ],
      ),
      const SizedBox(height: 12),
      if (_error case final error?) ...[
        Semantics(
          liveRegion: true,
          child: UiText(
            error,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ),
        const SizedBox(height: 8),
      ],
      FilledButton(
        onPressed: widget.busy ? null : _submit,
        child: UiText(widget.submitLabel),
      ),
    ],
  );

  Widget _timeField(TextEditingController field, String label) => TextField(
    controller: field,
    enabled: !widget.busy,
    keyboardType: TextInputType.number,
    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
    maxLength: 2,
    decoration: InputDecoration(
      labelText: context.uiLabel(
        widget.requireKnownTime ? label : '$label（可留空）',
      ),
      counterText: '',
    ),
  );

  Widget _placeField(List<BirthPlace> places) => Autocomplete<BirthPlace>(
    focusNode: _placeFocus,
    textEditingController: _placeText,
    displayStringForOption: (place) => place.name,
    fieldViewBuilder: (context, field, focus, submit) => TextField(
      enabled: !widget.busy,
      controller: field,
      focusNode: focus,
      onSubmitted: (_) => submit(),
      onChanged: (query) {
        if (query != _place?.name) _place = null;
      },
      decoration: InputDecoration(
        labelText: context.uiLabel('出生地'),
        hintText: context.uiLabel('输入城市或区县并选择'),
        suffixIcon: IconButton(
          tooltip: context.uiLabel('选择出生地点'),
          onPressed: widget.busy ? null : () => _pickPlace(places),
          icon: const Icon(Icons.place_outlined),
        ),
      ),
    ),
    optionsBuilder: (value) {
      final query = birthPlaceSearchKey(value.text);
      if (query.isEmpty) return const [];
      return places.where((place) => birthPlaceMatches(place, query)).take(25);
    },
    onSelected: (place) => _place = place,
  );

  BirthDate? _readDate() {
    final input = _date.text.trim();
    final parsed = DateTime.tryParse(input);
    if (parsed == null ||
        !RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(input) ||
        !parsed.toIso8601String().startsWith('${input}T'))
      return null;
    final result = BirthDate(parsed.year, parsed.month, parsed.day);
    return result.isValid() ? result : null;
  }

  BirthTime _readTime() => BirthTime(
    hour: int.tryParse(_hour.text),
    minute: int.tryParse(_minute.text),
  );

  Future<void> _pickDate() async {
    FocusScope.of(context).unfocus();
    final input = _readDate() ?? const BirthDate(2000, 1, 1);
    final date = await showDatePicker(
      context: context,
      helpText: context.uiLabel('选择出生日期'),
      initialDate: DateTime(input.year, input.month, input.day),
      firstDate: DateTime(firstBirthYear),
      lastDate: DateTime.now(),
    );
    if (!mounted || date == null || widget.busy) return;
    _date.text = birthDateText(BirthDate(date.year, date.month, date.day));
    setState(() => _error = null);
  }

  Future<void> _pickTime() async {
    FocusScope.of(context).unfocus();
    final entered = _readTime();
    final time = await showTimePicker(
      context: context,
      helpText: context.uiLabel('选择出生时间'),
      initialTime: entered.isValid
          ? TimeOfDay(hour: entered.hour ?? 12, minute: entered.minute ?? 0)
          : const TimeOfDay(hour: 12, minute: 0),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (!mounted || time == null || widget.busy) return;
    _hour.text = time.hour.toString().padLeft(2, '0');
    _minute.text = time.minute.toString().padLeft(2, '0');
    setState(() => _error = null);
  }

  Future<void> _pickPlace(List<BirthPlace> places) async {
    _placeFocus.unfocus();
    final place = await pickBirthPlace(context, places, _place);
    if (!mounted || place == null || widget.busy) return;
    _placeText.text = place.name;
    setState(() {
      _place = place;
      _error = null;
    });
  }

  void _submit() {
    final date = _readDate();
    final time = _readTime();
    final place = _place;
    final gender = _gender;
    if (date == null || !time.isValid || place == null || gender == null) {
      setState(() => _error = '请核对出生日期和时间，并选择出生地和性别。');
      return;
    }
    if (widget.requireKnownTime && !time.timeKnown) {
      setState(() => _error = '请填写并核对出生小时和分钟。');
      return;
    }
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() => _error = null);
    widget.onSubmit(
      BirthProfile(date: date, time: time, place: place, gender: gender),
    );
  }
}
