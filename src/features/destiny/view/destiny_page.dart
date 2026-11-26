import 'package:flutter/services.dart';
import 'package:jovian_destiny/jovian_destiny.dart';
import 'package:material_ui/material_ui.dart';

const _pillarLabels = {
  Pillar.year: '年柱',
  Pillar.month: '月柱',
  Pillar.day: '日柱',
  Pillar.hour: '时柱',
};

class DestinyPage extends StatefulWidget {
  const DestinyPage({
    super.key,
    required this.loadPlaces,
    required this.calculate,
    this.openFortune,
  });

  final Future<List<BirthPlace>> Function() loadPlaces;
  final Future<LocalBaZi> Function(BirthProfile) calculate;
  final VoidCallback? openFortune;

  @override
  State<DestinyPage> createState() => _DestinyPageState();
}

class _DestinyPageState extends State<DestinyPage> {
  final _date = TextEditingController();
  final _hour = TextEditingController();
  final _minute = TextEditingController();
  late Future<List<BirthPlace>> _places = widget.loadPlaces();
  BirthPlace? _place;
  BirthGender? _gender;
  bool _busy = false;
  String? _error;
  LocalBaZi? _chart;

  @override
  void dispose() {
    _date.dispose();
    _hour.dispose();
    _minute.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('命理'),
      actions: [
        if (widget.openFortune != null)
          TextButton(onPressed: widget.openFortune, child: const Text('周期运势')),
      ],
    ),
    body: SafeArea(
      top: false,
      child: ListView(
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        padding: const EdgeInsets.all(20),
        children: [
          const Text('出生资料'),
          const SizedBox(height: 12),
          TextField(
            controller: _date,
            enabled: !_busy,
            keyboardType: TextInputType.datetime,
            decoration: const InputDecoration(
              labelText: '出生日期',
              hintText: 'YYYY-MM-DD',
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: _timeField(_hour, '出生小时（可留空）')),
              const SizedBox(width: 12),
              Expanded(child: _timeField(_minute, '出生分钟（可留空）')),
            ],
          ),
          const SizedBox(height: 12),
          FutureBuilder<List<BirthPlace>>(
            future: _places,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return TextButton(
                  onPressed: () =>
                      setState(() => _places = widget.loadPlaces()),
                  child: const Text('出生地目录加载失败，点击重试'),
                );
              }
              final places = snapshot.data;
              if (places == null) return const LinearProgressIndicator();
              return _placeField(places);
            },
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            children: [
              for (final (value, label) in const [
                (BirthGender.female, '女'),
                (BirthGender.male, '男'),
              ])
                ChoiceChip(
                  label: Text(label),
                  selected: _gender == value,
                  onSelected: _busy
                      ? null
                      : (_) => setState(() => _gender = value),
                ),
            ],
          ),
          const SizedBox(height: 12),
          if (_error case final error?)
            Text(
              error,
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
          FilledButton(
            onPressed: _busy ? null : _submit,
            child: Text(_busy ? '正在排盘…' : '计算八字'),
          ),
          if (_chart case final chart?) ...[
            const SizedBox(height: 16),
            _BaZiResult(chart: chart),
          ],
        ],
      ),
    ),
  );

  Widget _timeField(TextEditingController field, String label) => TextField(
    controller: field,
    enabled: !_busy,
    keyboardType: TextInputType.number,
    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
    maxLength: 2,
    decoration: InputDecoration(labelText: label, counterText: ''),
  );

  Widget _placeField(List<BirthPlace> places) => Autocomplete<BirthPlace>(
    displayStringForOption: (place) => place.name,
    fieldViewBuilder: (context, field, focus, submit) => TextField(
      enabled: !_busy,
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

  Future<void> _submit() async {
    final input = _date.text.trim();
    final parsed = DateTime.tryParse(input);
    final place = _place;
    final gender = _gender;
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
    if (date == null ||
        !date.isValid() ||
        !time.isValid ||
        place == null ||
        gender == null) {
      setState(() => _error = '请核对出生日期和时间，并选择出生地和性别。');
      return;
    }
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _busy = true;
      _error = null;
      _chart = null;
    });
    try {
      final chart = await widget.calculate(
        BirthProfile(date: date, time: time, place: place, gender: gender),
      );
      if (mounted) setState(() => _chart = chart);
    } on FormatException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = '暂时无法计算八字，请重试。');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }
}

class _BaZiResult extends StatelessWidget {
  const _BaZiResult({required this.chart});

  final LocalBaZi chart;

  @override
  Widget build(BuildContext context) {
    final exact = chart.exactChart;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('八字四柱', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            if (exact == null) const Text('出生时分不完整，有多个可能值时会同时显示。'),
            for (final position in Pillar.values)
              ListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(_pillarLabels[position]!),
                subtitle: Text(chart.pillars[position]!.join('、')),
              ),
            if (exact?['luckPeriods'] case final List periods
                when periods.isNotEmpty)
              ExpansionTile(
                tilePadding: EdgeInsets.zero,
                title: const Text('大运'),
                children: [
                  for (final Map period in periods)
                    ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(period['ganZhi'] as String),
                      trailing: Text(
                        '${period['startAge']}–${period['endAge']} 岁',
                      ),
                    ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
