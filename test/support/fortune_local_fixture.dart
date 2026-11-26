import 'package:jovian_fortune/jovian_fortune.dart';

import '../../src/features/account/account.dart';
import '../../src/features/fortune/control/fortune_local.dart';

class FortuneLocalFixture extends FortuneLocal {
  const FortuneLocalFixture();

  @override
  Future<LocalFortunePreview> preview(
    int asOf,
    FortunePeriod period,
    String zone,
    ArchivedDestinyCharts? archive,
    Future<void> cancel,
  ) async {
    final local = zone == 'Asia/Shanghai'
        ? const Duration(hours: 8).inMilliseconds
        : 0;
    final preview = buildFortunePreview(
      asOf,
      period,
      (int value) => value + local,
      natal: archive == null ? null : const NatalDay('丁丑', true),
    );
    return (
      preview: preview,
      almanac: period == FortunePeriod.day ? buildAlmanacDay(asOf) : null,
    );
  }

  @override
  Future<FortuneCalendar?> queryCalendar(
    FortuneReference reference,
    Future<void> cancel,
  ) async => calculateFortuneCalendar(reference);
}
