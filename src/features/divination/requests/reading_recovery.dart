import 'package:jovian_divination/jovian_divination.dart';

GuideRecoveryStore createReadingRecovery(Uri base, {String? ownerScope}) =>
    MemoryGuideRecovery();

class MemoryGuideRecovery implements GuideRecoveryStore {
  GuideRecovery? _value;

  @override
  Future<GuideRecovery?> read() async => _value;

  @override
  Future<void> write(GuideRecovery? recovery) async => _value = recovery;
}
