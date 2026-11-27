import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../model/birth_profile_draft.dart';
import 'birth_place_picker.dart';
import 'birth_time_date_picker.dart';

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
  late BirthDate? _date = widget.initialDraft.date;
  late BirthTime? _time = widget.initialDraft.time;
  late Future<List<BirthPlace>> _places = widget.loadPlaces();
  late BirthPlace? _place = widget.initialDraft.place;
  late BirthGender? _gender = widget.initialDraft.gender;
  String? _error;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      spacing: 12,
      children: [
        Card(
          margin: EdgeInsets.zero,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 16,
              children: [
                _field(
                  '出生日期',
                  _choice(
                    action: '选择出生日期',
                    value: _date == null ? null : _dateLabel(context, _date!),
                    hint: '选择出生年月日',
                    pick: _pickDate,
                  ),
                ),
                _field(
                  '出生时间',
                  _choice(
                    action: '选择出生时间',
                    value: _time == null ? null : _timeLabel(context, _time!),
                    hint: '选择出生时间',
                    pick: _pickTime,
                  ),
                ),
                _field(
                  '出生地点',
                  FutureBuilder<List<BirthPlace>>(
                    future: _places,
                    builder: (context, snapshot) {
                      if (snapshot.hasError) {
                        return TextButton(
                          onPressed: () =>
                              setState(() => _places = widget.loadPlaces()),
                          child: const UiText('出生地目录加载失败，点击重试'),
                        );
                      }
                      final places = snapshot.data;
                      return _choice(
                        action: '选择出生地点',
                        value: _place?.name,
                        hint: '选择出生城市或区县',
                        pick: places == null ? null : () => _pickPlace(places),
                      );
                    },
                  ),
                ),
                _field(
                  '性别',
                  Row(
                    spacing: 8,
                    children: [
                      for (final (gender, label) in const [
                        (BirthGender.female, '女'),
                        (BirthGender.male, '男'),
                      ])
                        Expanded(
                          child: ChoiceChip(
                            label: UiText(label),
                            selected: _gender == gender,
                            onSelected: widget.busy
                                ? null
                                : (_) => _update(() => _gender = gender),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_error case final error?)
          Semantics(
            liveRegion: true,
            child: UiText(
              error,
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ),
        FilledButton(
          onPressed: widget.busy ? null : _submit,
          child: UiText(widget.submitLabel),
        ),
      ],
    );
  }

  Widget _field(String label, Widget child) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    spacing: 6,
    children: [
      UiText(label, style: Theme.of(context).textTheme.labelLarge),
      child,
    ],
  );

  Widget _choice({
    required String action,
    required String hint,
    required String? value,
    required VoidCallback? pick,
  }) => Tooltip(
    message: context.uiLabel(action),
    excludeFromSemantics: true,
    child: Semantics(
      label: context.uiLabel(action),
      child: OutlinedButton(
        key: ValueKey(action),
        onPressed: widget.busy ? null : pick,
        style: OutlinedButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          alignment: AlignmentDirectional.centerStart,
        ),
        child: Row(
          spacing: 4,
          children: [
            Expanded(child: Text(value ?? context.uiLabel(hint))),
            const Icon(Icons.chevron_right, size: 18),
          ],
        ),
      ),
    ),
  );

  String _dateLabel(BuildContext context, BirthDate date) =>
      context.uiLanguage == InterfaceLanguage.chinese
      ? '${date.year} 年 ${date.month} 月 ${date.day} 日'
      : birthDateText(date);

  String _timeLabel(BuildContext context, BirthTime time) => switch ((
    time.hour,
    time.minute,
  )) {
    (null, null) => context.uiLabel('时间未知'),
    (null, final minute?) =>
      '${context.uiLabel('小时未知 · ')}$minute${context.uiLabel(' 分')}',
    (final hour?, null) => '$hour${context.uiLabel(' 时 · 分钟未知')}',
    (final hour?, final minute?) =>
      '${hour.toString().padLeft(2, '0')}:${minute.toString().padLeft(2, '0')}',
  };

  void _update(VoidCallback apply) => setState(() {
    apply();
    _error = null;
  });

  Future<void> _pickDate() async {
    final date = await pickBirthDate(context, _date);
    if (!mounted || date == null || widget.busy) return;
    _update(() => _date = date);
  }

  Future<void> _pickTime() async {
    final time = await pickBirthTime(
      context,
      _time,
      requireKnownTime: widget.requireKnownTime,
    );
    if (!mounted || time == null || widget.busy) return;
    _update(() => _time = time);
  }

  Future<void> _pickPlace(List<BirthPlace> places) async {
    final place = await pickBirthPlace(context, places, _place);
    if (!mounted || place == null || widget.busy) return;
    _update(() => _place = place);
  }

  void _submit() {
    final date = _date;
    final time = _time ?? const BirthTime();
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
    setState(() => _error = null);
    widget.onSubmit(
      BirthProfile(date: date, time: time, place: place, gender: gender),
    );
  }
}
