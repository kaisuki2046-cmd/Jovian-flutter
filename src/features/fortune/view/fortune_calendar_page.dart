import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:material_ui/material_ui.dart';

import '../../../ui/theme.dart';

class FortuneCalendarPage extends StatefulWidget {
  const FortuneCalendarPage({super.key, required this.reference});
  final FortuneReference reference;

  @override
  State<FortuneCalendarPage> createState() => _FortuneCalendarPageState();
}

class _FortuneCalendarPageState extends State<FortuneCalendarPage> {
  late final _date = TextEditingController(text: widget.reference.date);
  late final _time = TextEditingController(text: widget.reference.time);
  FortuneCalendar? _result;
  bool _invalid = false;

  @override
  void dispose() {
    _date.dispose();
    _time.dispose();
    super.dispose();
  }

  void _query() {
    FocusManager.instance.primaryFocus?.unfocus();
    final result = calculateFortuneCalendar(
      FortuneReference(_date.text.trim(), _time.text.trim()),
    );
    setState(() {
      _result = result;
      _invalid = result == null;
    });
  }

  void _clearFeedback() {
    if (_result == null && !_invalid) return;
    setState(() {
      _invalid = false;
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
      helpText: '选择北京日期',
      cancelText: '取消',
      confirmText: '确定',
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
      helpText: '选择北京时间',
      cancelText: '取消',
      confirmText: '确定',
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
    appBar: AppBar(title: const Text('历法查询')),
    body: SafeArea(
      top: false,
      child: ListView(
        padding: jovianPagePadding,
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          const Text('以北京时间查询周期窗口与干支。'),
          const SizedBox(height: 10),
          _CalendarCard(
            children: [
              TextField(
                controller: _date,
                keyboardType: TextInputType.datetime,
                textInputAction: TextInputAction.next,
                onChanged: (_) => _clearFeedback(),
                decoration: InputDecoration(
                  labelText: '北京日期',
                  hintText: 'YYYY-MM-DD',
                  suffixIcon: IconButton(
                    tooltip: '选择北京日期',
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
                  labelText: '北京时间',
                  hintText: 'HH:mm',
                  suffixIcon: IconButton(
                    tooltip: '选择北京时间',
                    onPressed: _pickTime,
                    icon: const Icon(Icons.schedule),
                  ),
                ),
              ),
              if (_invalid)
                Semantics(
                  liveRegion: true,
                  child: Text(
                    '请输入 1900 至 2099 年间的有效日期和 24 小时时间。',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.error,
                    ),
                  ),
                ),
              FilledButton(onPressed: _query, child: const Text('查询历法')),
            ],
          ),
          if (_result case final result?) ...[
            const SizedBox(height: 12),
            _CalendarCard(
              title: '历法参考',
              children: [
                _pillars('查询时刻四柱', result.referencePillars),
                _pillars('下一整点四柱', result.actionPillars),
              ],
            ),
            const SizedBox(height: 12),
            Semantics(
              header: true,
              child: Text(
                '查询窗口',
                style: Theme.of(context).textTheme.titleMedium,
              ),
            ),
            const Text('周一为每周起点，窗口结束时刻不计入。'),
            for (final window in result.windows)
              _CalendarCard(
                title: _periodLabels[window.period]!,
                children: [
                  if (window.periodStart != window.start)
                    Text('周期起点 ${_beijingLabel(window.periodStart)}'),
                  Text('查询起点 ${_beijingLabel(window.start)}'),
                  Text('截止时刻 ${_beijingLabel(window.end)}'),
                ],
              ),
          ],
        ],
      ),
    ),
  );

  Widget _pillars(String title, Map<String, String> values) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(title),
      Text(
        '${values['year']}年 · ${values['month']}月 · ${values['day']}日 · ${values['hour']}时',
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
              child: Text(
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

String _beijingLabel(int value) {
  final fields = fortuneReferenceFields(value);
  return '${fields.date} ${fields.time}';
}
