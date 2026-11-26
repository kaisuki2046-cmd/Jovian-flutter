import 'account_failure.dart';

class AccountLimits {
  final _entries = <String, ({int count, int expires})>{};
  int _sweepAfter = 0;

  void hit(String key, int max, int now) {
    if (now >= _sweepAfter) {
      _entries.removeWhere((_, value) => value.expires <= now);
      _sweepAfter = now + const Duration(minutes: 1).inMilliseconds;
    }
    final previous = _entries[key];
    if (previous == null || previous.expires <= now) {
      if (_entries.length >= 10000 && previous == null) failAccount(429);
      _entries[key] = (
        count: 1,
        expires: now + const Duration(minutes: 15).inMilliseconds,
      );
      return;
    }
    if (previous.count >= max) failAccount(429);
    _entries[key] = (count: previous.count + 1, expires: previous.expires);
  }
}
