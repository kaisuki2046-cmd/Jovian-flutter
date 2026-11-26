import 'package:material_ui/material_ui.dart';

import 'interface_language.dart';

List<DateTime?> chatTimeLabels(Iterable<DateTime?> sentTimes) {
  DateTime? previous;
  return sentTimes.map((sentAt) {
    if (sentAt == null) return null;
    final current = sentAt.toLocal();
    final last = previous;
    previous = current;
    final show =
        last == null ||
        !DateUtils.isSameDay(current, last) ||
        current.difference(last) >= const Duration(minutes: 5);
    return show ? current : null;
  }).toList();
}

String formatChatTime(
  DateTime sentAt,
  DateTime now,
  InterfaceLanguage language,
) {
  final local = sentAt.toLocal();
  final today = now.toLocal();
  final hours = local.hour.toString().padLeft(2, '0');
  final minutes = local.minute.toString().padLeft(2, '0');
  final time = '$hours:$minutes';
  final daysAgo = _calendarDay(today).difference(_calendarDay(local)).inDays;
  if (daysAgo == 0) return time;
  if (daysAgo == 1) return "${language.label('昨天')} $time";

  final monthDay = '${local.month}/${local.day}';
  if (local.year == today.year) return '$monthDay $time';
  return switch (language) {
    InterfaceLanguage.chinese => '${local.year}/$monthDay $time',
    InterfaceLanguage.english => '$monthDay/${local.year} $time',
  };
}

DateTime _calendarDay(DateTime date) =>
    DateTime.utc(date.year, date.month, date.day);

class ChatTimeLabel extends StatelessWidget {
  const ChatTimeLabel({super.key, required this.sentAt});

  final DateTime sentAt;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.only(top: 6, bottom: 10),
      child: Center(
        child: Text(
          formatChatTime(sentAt, DateTime.now(), context.uiLanguage),
          textAlign: TextAlign.center,
          style: theme.textTheme.bodySmall?.copyWith(
            color: theme.colorScheme.onSurfaceVariant,
            letterSpacing: 0,
          ),
        ),
      ),
    );
  }
}
