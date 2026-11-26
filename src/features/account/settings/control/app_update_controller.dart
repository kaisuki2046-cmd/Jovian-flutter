import 'package:flutter/foundation.dart';

import '../model/android_release.dart';

enum UpdateStatus { idle, checking, available, current, unpublished, failed }

class AppUpdateController extends ChangeNotifier {
  AppUpdateController({
    required Future<AndroidAppVersion> Function() readInstalled,
    required Future<bool> Function(Uri) openDownload,
    Future<AndroidRelease?> Function()? readLatest,
    DateTime Function()? now,
    VoidCallback? close,
  }) : _readInstalled = readInstalled,
       _openDownload = openDownload,
       _readLatest = readLatest,
       _now = now ?? DateTime.now,
       _close = close;

  final Future<AndroidAppVersion> Function() _readInstalled;
  final Future<bool> Function(Uri) _openDownload;
  final Future<AndroidRelease?> Function()? _readLatest;
  final DateTime Function() _now;
  final VoidCallback? _close;
  final _offered = <int>{};
  DateTime? _lastAutomaticCheck;
  Future<AndroidRelease?>? _pending;
  bool _disposed = false;

  AndroidAppVersion? installed;
  AndroidRelease? offer;
  UpdateStatus manualStatus = UpdateStatus.idle;

  bool get canCheck => installed != null && _readLatest != null;

  Future<void> initialize() async {
    try {
      final value = await _readInstalled();
      if (_disposed) return;
      installed = value;
      notifyListeners();
    } catch (_) {
      // Fall back to the display version when platform metadata is unavailable.
    }
  }

  Future<void> check({required bool manual}) async {
    final current = installed;
    final readLatest = _readLatest;
    if (_disposed ||
        current == null ||
        readLatest == null ||
        (manual && manualStatus == UpdateStatus.checking))
      return;
    if (!manual) {
      final now = _now();
      final last = _lastAutomaticCheck;
      if (last != null && now.difference(last) < const Duration(minutes: 15))
        return;
      _lastAutomaticCheck = now;
    } else {
      manualStatus = UpdateStatus.checking;
      notifyListeners();
    }

    UpdateStatus status;
    try {
      final latest = await (_pending ??= Future<AndroidRelease?>.sync(
        readLatest,
      ).whenComplete(() => _pending = null));
      if (_disposed) return;
      if (latest == null ||
          latest.version.applicationId != current.applicationId) {
        status = UpdateStatus.unpublished;
      } else if (latest.version.versionCode <= current.versionCode) {
        status = UpdateStatus.current;
      } else {
        final firstOffer = _offered.add(latest.version.versionCode);
        if (manual || firstOffer) offer = latest;
        status = UpdateStatus.available;
      }
    } catch (_) {
      if (_disposed) return;
      status = UpdateStatus.failed;
    }
    if (manual) manualStatus = status;
    notifyListeners();
  }

  void dismiss(AndroidRelease shown) {
    if (!identical(shown, offer)) return;
    offer = null;
    notifyListeners();
  }

  Future<bool> open(AndroidRelease release) async {
    try {
      return await _openDownload(release.downloadUrl);
    } catch (_) {
      return false;
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _close?.call();
    super.dispose();
  }
}
