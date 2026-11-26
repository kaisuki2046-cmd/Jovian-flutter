import 'package:jovian_fortune/jovian_fortune.dart';
import 'package:material_ui/material_ui.dart';

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
      FortuneReference(_date.text, _time.text),
    );
    setState(() {
      _result = result;
      _invalid = result == null;
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('历法查询')),
    body: SafeArea(
      top: false,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          TextField(
            controller: _date,
            keyboardType: TextInputType.datetime,
            decoration: const InputDecoration(
              labelText: '北京日期',
              hintText: 'YYYY-MM-DD',
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _time,
            keyboardType: TextInputType.datetime,
            decoration: const InputDecoration(
              labelText: '北京时间',
              hintText: 'HH:mm',
            ),
          ),
          if (_invalid)
            const Padding(
              padding: EdgeInsets.only(top: 12),
              child: Text('请输入 1900 至 2099 年间的有效日期和 24 小时时间。'),
            ),
          const SizedBox(height: 12),
          FilledButton(onPressed: _query, child: const Text('查询历法')),
          if (_result case final result?) ...[
            const SizedBox(height: 12),
            _pillars('查询时刻四柱', result.referencePillars),
            _pillars('行动时刻四柱', result.actionPillars),
            for (final window in result.windows)
              ListTile(
                title: Text(_periodLabels[window.period]!),
                subtitle: Text(
                  [
                    if (window.periodStart != window.start)
                      '周期起点 ${_beijingLabel(window.periodStart)}',
                    '查询起点 ${_beijingLabel(window.start)}',
                    '截止时刻 ${_beijingLabel(window.end)}',
                  ].join('\n'),
                ),
              ),
          ],
        ],
      ),
    ),
  );

  Widget _pillars(String title, Map<String, String> values) => ListTile(
    title: Text(title),
    subtitle: Text(
      [
        for (final key in ['year', 'month', 'day', 'hour']) values[key],
      ].join(' · '),
    ),
  );
}

const _periodLabels = {
  'year': '年运',
  'month': '月运',
  'week': '周运',
  'day': '日运',
  'hour': '小时运',
};

String _beijingLabel(int value) {
  final fields = fortuneReferenceFields(value);
  return '${fields.date} ${fields.time}';
}
