import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

final deletionReceiptPattern = RegExp(r'^[A-Za-z0-9_-]{43}$');

enum DeletionMethod { password, phone, localSocial, unsupported }

typedef DeletionSetup = ({String receipt, DeletionMethod method});

class SavedDeletion {
  const SavedDeletion({
    required this.receipt,
    required this.owner,
    this.deviceCleared = false,
  });

  final String receipt;
  final String owner;
  final bool deviceCleared;

  SavedDeletion get cleared =>
      SavedDeletion(receipt: receipt, owner: owner, deviceCleared: true);
}

typedef DeletionProgress = ({bool completed, bool deviceCleared});

abstract interface class DeletionReceiptStorage {
  Future<SavedDeletion?> read();
  Future<void> write(SavedDeletion? receipt);
}

class SecureDeletionReceiptStorage implements DeletionReceiptStorage {
  const SecureDeletionReceiptStorage(this._key);

  static const _storage = FlutterSecureStorage();
  final String _key;

  @override
  Future<SavedDeletion?> read() async {
    final raw = await _storage.read(key: _key);
    if (raw == null) return null;
    if (jsonDecode(raw) case {
      'receipt': final String receipt,
      'owner': final String owner,
      'deviceCleared': final bool cleared,
    } when deletionReceiptPattern.hasMatch(receipt) && owner.isNotEmpty) {
      return SavedDeletion(
        receipt: receipt,
        owner: owner,
        deviceCleared: cleared,
      );
    }
    throw const FormatException('Invalid saved account deletion receipt.');
  }

  @override
  Future<void> write(SavedDeletion? receipt) => receipt == null
      ? _storage.delete(key: _key)
      : _storage.write(
          key: _key,
          value: jsonEncode({
            'receipt': receipt.receipt,
            'owner': receipt.owner,
            'deviceCleared': receipt.deviceCleared,
          }),
        );
}

class AccountDeletionDevice {
  const AccountDeletionDevice({
    required this.receipts,
    required this.legacyReadingTokens,
    required this.clearMemberData,
  });

  final DeletionReceiptStorage receipts;
  final Future<List<String>> Function(String owner) legacyReadingTokens;
  final Future<void> Function(String owner) clearMemberData;
}
