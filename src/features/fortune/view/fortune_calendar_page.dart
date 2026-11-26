import 'dart:async';

import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';
import '../../../ui/theme.dart';
import '../control/fortune_local.dart';
import 'fortune_display_labels.dart';

class FortuneCalendarPage extends StatefulWidget {
  const FortuneCalendarPage({
    super.key,
    required this.reference,
    this.local = const FortuneLocal(),
  });
  final FortuneReference reference;
  final FortuneLocal local;

  @override
  State<FortuneCalendarPage> createState() => _FortuneCalendarPageState();
}

class _FortuneCalendarPageState extends State<FortuneCalendarPage> {
  late final _date = TextEditingController(text: widget.reference.date);
  late final _time = TextEditingController(text: widget.reference.time);
  FortuneCalendar? _result;
  String? _error;
  Completer<void>? _work;

  @override
  void dispose() {
    _cancelQuery();
    _date.dispose();
    _time.dispose();
    super.dispose();
  }

  Future<void> _query() async {
    if (_work != null) return;
    FocusManager.instance.primaryFocus?.unfocus();
    final work = Completer<void>();
    setState(() {
      _work = work;
      _result = null;
      _error = null;
    });
    try {
      final result = await widget.local.queryCalendar(
        FortuneReference(_date.text.trim(), _time.text.trim()),
        work.future,
      );
      if (_work != work) return;
      setState(() {
        _work = null;
        _result = result;
        if (result == null) _error = '请输入 1900 至 2099 年间的有效日期和 24 小时时间。';
      });
    } catch (_) {
      if (_work != work) return;
      setState(() {
        _work = null;
        _error = '历法查询暂不可用，请重试。';
      });
    }
  }

  void _cancelQuery() {
    _work?.complete();
    _work = null;
  }

  void _clearFeedback() {
    if (_result == null && _error == null && _work == null) return;
    setState(() {
      _cancelQuery();
      _error = null;
      _result = null;
    });
  }

  Future<void> _pickDate() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final first = DateTime(1900);
    final last = DateTime(2099, 12, 31);
    final reference = DateTime.tryParse(widget.reference.date);
    final input = DateTime.tryParse(_date.text.trim()) ?? reference ?? first;
    final date = await showDatePicker(
      context: context,
      initialDate: input.isBefore(first)
          ? first
          : input.isAfter(last)
          ? last
          : input,
      firstDate: first,
      lastDate: last,
      currentDate: reference,
      helpText: context.uiLabel('选择北京日期'),
      cancelText: context.uiLabel('取消'),
      confirmText: context.uiLabel('确定'),
    );
    if (date == null || !mounted) return;
    _date.text = '${date.year}-${_two(date.month)}-${_two(date.day)}';
    _clearFeedback();
  }

  Future<void> _pickTime() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final time = await showTimePicker(
      context: context,
      initialTime:
          _timeOfDay(_time.text.trim()) ??
          _timeOfDay(widget.reference.time) ??
          const TimeOfDay(hour: 0, minute: 0),
      helpText: context.uiLabel('选择北京时间'),
      cancelText: context.uiLabel('取消'),
      confirmText: context.uiLabel('确定'),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(context).copyWith(alwaysUse24HourFormat: true),
        child: child!,
      ),
    );
    if (time == null || !mounted) return;
    _time.text = '${_two(time.hour)}:${_two(time.minute)}';
    _clearFeedback();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const UiText('历法查询')),
    body: SafeArea(
      top: false,
      child: ListView(
        padding: jovianPagePadding,
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          const UiText('以北京时间查询周期窗口与干支。'),
          const SizedBox(height: 10),
          _CalendarCard(
            children: [
              TextField(
                controller: _date,
                keyboardType: TextInputType.datetime,
                textInputAction: TextInputAction.next,
                onChanged: (_) => _clearFeedback(),
                decoration: InputDecoration(
                  labelText: context.uiLabel('北京日期'),
                  hintText: 'YYYY-MM-DD',
                  suffixIcon: IconButton(
                    tooltip: context.uiLabel('选择北京日期'),
                    onPressed: _pickDate,
                    icon: const Icon(Icons.calendar_today_outlined),
                  ),
                ),
              ),
              TextField(
                controller: _time,
                keyboardType: TextInputType.datetime,
                textInputAction: TextInputAction.search,
                onSubmitted: (_) => _query(),
                onChanged: (_) => _clearFeedback(),
                decoration: InputDecoration(
                  labelText: context.uiLabel('北京时间'),
                  hintText: 'HH:mm',
                  suffixIcon: IconButton(
                    tooltip: context.uiLabel('选择北京时间'),
                    onPressed: _pickTime,
                    icon: const Icon(Icons.schedule),
                  ),
                ),
              ),
              if (_error case final error?)
                Semantics(
                  liveRegion: true,
                  child: UiText(
                    error,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              if (_work != null) const LinearProgressIndicator(),
              FilledButton(
                onPressed: _work == null ? _query : null,
                child: const UiText('查询历法'),
              ),
            ],
          ),
          if (_result case final result?) ...[
            const SizedBox(height: 12),
            _CalendarCard(
              title: '历法参考',
              children: [
                _pillars(context, '查询时刻四柱', result.referencePillars),
                _pillars(context, '下一整点四柱', result.actionPillars),
              ],
            ),
            const SizedBox(height: 12),
            Semantics(
              header: true,
              child: UiText(
                '查询窗口',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            const UiText('周一为每周起点，窗口结束时刻不计入。'),
            for (final window in result.windows)
              _CalendarCard(
                title: _periodLabels[window.period]!,
                children: [
                  if (window.periodStart != window.start)
                    _windowTime(context, '周期起点', window.periodStart),
                  _windowTime(context, '查询起点', window.start),
                  _windowTime(context, '截止时刻', window.end),
                ],
              ),
          ],
        ],
      ),
    ),
  );

  Widget _pillars(
    BuildContext context,
    String title,
    Map<String, String> values,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      UiText(title),
      Text(
        fortunePillarLabels(
          context,
          values['year']!,
          values['month']!,
          values['day']!,
          hour: values['hour']!,
        ),
      ),
    ],
  );
}

class _CalendarCard extends StatelessWidget {
  const _CalendarCard({required this.children, this.title});

  final List<Widget> children;
  final String? title;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        spacing: 10,
        children: [
          if (title case final label?)
            Semantics(
              header: true,
              child: UiText(
                label,
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
          ...children,
        ],
      ),
    ),
  );
}

const _periodLabels = {
  'year': '年运',
  'month': '月运',
  'week': '周运',
  'day': '日运',
  'hour': '下一完整小时',
};

String _two(int value) => value.toString().padLeft(2, '0');

TimeOfDay? _timeOfDay(String value) {
  final parts = RegExp(r'^([01]\d|2[0-3]):([0-5]\d)$').firstMatch(value);
  if (parts == null) return null;
  return TimeOfDay(hour: int.parse(parts[1]!), minute: int.parse(parts[2]!));
}

Widget _windowTime(BuildContext context, String label, int value) {
  final fields = fortuneReferenceFields(value);
  return Text('${context.uiLabel(label)} ${fields.date} ${fields.time}');
}
