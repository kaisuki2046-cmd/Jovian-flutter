import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class CoinFeedback {
  void unlock() {}
  void play({required bool reducedMotion}) {}
  void stop() {}
  void dispose() {}

  void pulse() {
    if (defaultTargetPlatform != TargetPlatform.android &&
        defaultTargetPlatform != TargetPlatform.iOS)
      return;
    unawaited(HapticFeedback.selectionClick().catchError((Object _) {}));
  }
}
