import 'package:flutter_test/flutter_test.dart';

import '../src/ui/chat_time_label.dart';
import '../src/ui/interface_language.dart';

void main() {
  test('groups from each previous dated message, skipping missing times', () {
    final start = DateTime(2026, 11, 20, 11);
    DateTime at(int minute) => start.add(Duration(minutes: minute));

    expect(chatTimeLabels([null, start, at(2), null, at(6), at(11)]), [
      null,
      start,
      null,
      null,
      null,
      at(11),
    ]);
  });

  test('starts a group across local midnight before a five-minute gap', () {
    final late = DateTime(2026, 11, 20, 23, 58);
    final early = DateTime(2026, 11, 21, 0, 1);
    expect(chatTimeLabels([late.toUtc(), null, early]), [late, null, early]);
  });

  test('formats the local clock and date in the selected app language', () {
    final now = DateTime(2026, 1, 1, 0, 1);
    final yesterday = DateTime(2025, 12, 31, 23, 5);

    expect(formatChatTime(now, now, InterfaceLanguage.english), '00:01');
    expect(
      formatChatTime(yesterday, now, InterfaceLanguage.chinese),
      '昨天 23:05',
    );
    expect(
      formatChatTime(yesterday, now, InterfaceLanguage.english),
      'Yesterday 23:05',
    );
    expect(
      formatChatTime(
        DateTime(2025, 12, 28, 8, 4),
        now,
        InterfaceLanguage.chinese,
      ),
      '2025/12/28 08:04',
    );
    expect(
      formatChatTime(
        DateTime(2025, 12, 28, 8, 4),
        now,
        InterfaceLanguage.english,
      ),
      '12/28/2025 08:04',
    );
    expect(
      formatChatTime(
        DateTime(2026, 1, 1, 8, 4),
        DateTime(2026, 7, 18),
        InterfaceLanguage.chinese,
      ),
      '1/1 08:04',
    );
  });
}
