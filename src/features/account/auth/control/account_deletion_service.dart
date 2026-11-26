import '../../../../shared/http/json_client.dart';
import '../model/account_deletion.dart';
import '../model/deletion_device_cache.dart'
    if (dart.library.js_interop) '../model/deletion_device_cache_web.dart';
import '../requests/account_deletion_api.dart';

class AccountDeletionService {
  const AccountDeletionService(this.api, this._device);

  final AccountDeletionApi api;
  final AccountDeletionDevice _device;

  Future<void> submit(
    SavedDeletion request,
    Map<String, Object?> proof,
    bool Function() isCurrent,
  ) async {
    final collected = await _device.legacyReadingTokens(request.owner);
    final tokens = collected
        .where(deletionReceiptPattern.hasMatch)
        .toSet()
        .take(100)
        .toList();
    await _device.receipts.write(request);
    try {
      await api.submit(request, proof, tokens, isCurrent);
    } on JsonRequestError catch (error) {
      final status = error.status;
      if (status != null && status < 500 && status != 401 && status != 409)
        rethrow;
      // A response can be lost after the server has revoked this session.
      try {
        await api.status(request.receipt);
      } on JsonRequestError catch (lookup) {
        if (lookup.status == 404) throw error;
        rethrow;
      }
    }
  }

  Future<DeletionProgress?> refresh() async {
    final saved = await _device.receipts.read();
    if (saved == null) return null;
    final bool completed;
    try {
      completed = await api.status(saved.receipt);
    } on JsonRequestError catch (error) {
      if (error.status == 404) return null;
      rethrow;
    }
    return (completed: completed, deviceCleared: await clearDevice(saved));
  }

  Future<bool> clearDevice(SavedDeletion saved) async {
    if (saved.deviceCleared) return true;
    try {
      await _device.clearMemberData(saved.owner);
      clearLegacyAccountDeviceCache(saved.owner);
      await _device.receipts.write(saved.cleared);
      return true;
    } catch (_) {
      return false;
    }
  }

  Future<void> dismiss() => _device.receipts.write(null);
}
