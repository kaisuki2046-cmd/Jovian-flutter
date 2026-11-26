import 'package:flutter/services.dart';
import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

class BirthProfileEditor extends StatefulWidget {
  const BirthProfileEditor({
    super.key,
    required this.loadPlaces,
    required this.submitLabel,
    required this.onSubmit,
    this.busy = false,
    this.requireKnownTime = false,
    this.initialProfile,
  });

  final Future<List<BirthPlace>> Function() loadPlaces;
  final String submitLabel;
  final ValueChanged<BirthProfile> onSubmit;
  final bool busy;
  final bool requireKnownTime;
  final BirthProfile? initialProfile;

  @override
  State<BirthProfileEditor> createState() => _BirthProfileEditorState();
}

class _BirthProfileEditorState extends State<BirthProfileEditor> {
  late final _date = TextEditingController(
    text: widget.initialProfile?.date.utcMidnight.toIso8601String().substring(
      0,
      10,
    ),
  );
  late final _hour = TextEditingController(
    text: widget.initialProfile?.time.hour?.toString(),
  );
  late final _minute = TextEditingController(
    text: widget.initialProfile?.time.minute?.toString(),
  );
  late Future<List<BirthPlace>> _places = widget.loadPlaces();
  late BirthPlace? _place = widget.initialProfile?.place;
  late BirthGender? _gender = widget.initialProfile?.gender;
  String? _error;

  @override
  void dispose() {
    _date.dispose();
    _hour.dispose();
    _minute.dispose();
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
        decoration: const InputDecoration(
          labelText: '出生日期',
          hintText: 'YYYY-MM-DD',
        ),
      ),
      const SizedBox(height: 12),
      Row(
        children: [
          Expanded(child: _timeField(_hour, '出生小时')),
          const SizedBox(width: 12),
          Expanded(child: _timeField(_minute, '出生分钟')),
        ],
      ),
      const SizedBox(height: 12),
      FutureBuilder<List<BirthPlace>>(
        future: _places,
        builder: (context, snapshot) {
          if (snapshot.hasError) {
            return TextButton(
              onPressed: () => setState(() => _places = widget.loadPlaces()),
              child: const Text('出生地目录加载失败，点击重试'),
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
              label: Text(label),
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
          child: Text(
            error,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ),
        const SizedBox(height: 8),
      ],
      FilledButton(
        onPressed: widget.busy ? null : _submit,
        child: Text(widget.submitLabel),
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
      labelText: widget.requireKnownTime ? label : '$label（可留空）',
      counterText: '',
    ),
  );

  Widget _placeField(List<BirthPlace> places) => Autocomplete<BirthPlace>(
    initialValue: TextEditingValue(
      text: widget.initialProfile?.place.name ?? '',
    ),
    displayStringForOption: (place) => place.name,
    fieldViewBuilder: (context, field, focus, submit) => TextField(
      enabled: !widget.busy,
      controller: field,
      focusNode: focus,
      onSubmitted: (_) => submit(),
      onChanged: (query) {
        if (query != _place?.name) _place = null;
      },
      decoration: const InputDecoration(
        labelText: '出生地',
        hintText: '输入城市或区县并选择',
      ),
    ),
    optionsBuilder: (value) {
      final query = value.text.trim().toLowerCase();
      if (query.isEmpty) return const [];
      return places
          .where((place) {
            return place.name.toLowerCase().contains(query) ||
                place.adminCode == query;
          })
          .take(25);
    },
    onSelected: (place) => _place = place,
  );

  void _submit() {
    final input = _date.text.trim();
    final parsed = DateTime.tryParse(input);
    final date =
        parsed != null &&
            RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(input) &&
            parsed.toIso8601String().startsWith('${input}T')
        ? BirthDate(parsed.year, parsed.month, parsed.day)
        : null;
    final time = BirthTime(
      hour: int.tryParse(_hour.text),
      minute: int.tryParse(_minute.text),
    );
    final place = _place;
    final gender = _gender;
    if (date == null ||
        !date.isValid() ||
        !time.isValid ||
        place == null ||
        gender == null) {
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
