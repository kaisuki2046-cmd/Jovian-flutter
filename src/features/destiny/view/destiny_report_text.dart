import 'package:material_ui/material_ui.dart';

import '../../../ui/report_body.dart';

class DestinyReportText extends StatelessWidget {
  const DestinyReportText(this.body, {super.key});

  final String body;

  static const _titles = {
    '综合': '综合',
    '整体': '综合',
    '事业': '事业',
    '爱情': '爱情',
    '感情': '爱情',
    '学业': '学业',
    '财富': '财富',
    '财运': '财富',
  };
  static final _heading = RegExp(
    r'^(?:#{1,6}\s*)?(?:[一二三四五1-5][、.．)）]\s*)?'
    r'(?:\*\*|__|【|\[)?(综合|整体|事业|爱情|感情|学业|财富|财运)(?:解读)?'
    r'(?:\*\*|__|】|\])?\s*(?:[：:]\s*(.*?))?(?:\s+#+)?$',
  );

  static ({String title, String text})? _topic(String line) {
    final match = _heading.firstMatch(line);
    return match == null
        ? null
        : (title: _titles[match[1]]!, text: match[2] ?? '');
  }

  @override
  Widget build(BuildContext context) => ReportBody(body, topicHeading: _topic);
}
