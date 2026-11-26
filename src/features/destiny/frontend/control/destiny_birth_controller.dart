import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:jovian_destiny/jovian_destiny.dart';

import '../../../../shared/http/json_client.dart';
import '../../../account/account.dart';
import '../../model/birth_profile_draft.dart';
import 'destiny_device_birth_profile.dart';

typedef SavedBirthDraft = ({
  AccountBirthFields fields,
  BirthProfileDraft draft,
});

class DestinyBirthController extends ChangeNotifier {
  DestinyBirthController(this._account, this._loadPlaces)
    : owner = _account?.memberId;

  final AccountController? _account;
  final Future<List<BirthPlace>> Function() _loadPlaces;
  final String? owner;
  SavedBirthDraft? current;
  SavedBirthDraft? conflict;
  BirthProfile? localProfile;
  Completer<void>? _read;
  Completer<void>? _save;
  bool _disposed = false;
  String? readError;
  String? saveError;
  String? localNotice;
  bool localReading = false;
  bool localWriting = false;
  bool _localReady = false;

  bool get member => owner != null;
  bool get isCurrent => !_disposed && _account?.memberId == owner;
  bool get loading => _read != null;
  bool get saving => _save != null;
  bool get canStoreLocally => member && !kIsWeb;

  Future<SavedBirthDraft> _draft(AccountBirthFields fields) async => (
    fields: fields,
    draft: fields.hasData
        ? BirthProfileDraft.fromAccount(fields, await _loadPlaces())
        : const BirthProfileDraft(),
  );

  Future<void> refresh() async {
    final id = owner;
    if (id == null || !isCurrent || loading || saving) return;
    if (canStoreLocally && !_localReady && !localReading && !localWriting) {
      unawaited(_restoreLocal(id));
    }
    final request = _read = Completer<void>();
    readError = null;
    notifyListeners();
    try {
      final fields = await _account!.readBirthFields(
        id,
        cancel: request.future,
      );
      final next = await _draft(fields);
      if (isCurrent && identical(_read, request)) current = next;
    } catch (_) {
      if (isCurrent && identical(_read, request)) readError = '暂时无法读取账户出生资料。';
    } finally {
      if (identical(_read, request)) {
        _read = null;
        if (isCurrent) notifyListeners();
      }
    }
  }

  Future<void> _restoreLocal(String id) async {
    localReading = true;
    try {
      final profile = await readLocalDestinyBirthProfile(id, _loadPlaces);
      if (isCurrent) localProfile = profile;
    } catch (_) {
      if (isCurrent) localNotice = '暂时无法读取本机出生资料。';
    } finally {
      localReading = false;
      _localReady = true;
      if (isCurrent) notifyListeners();
    }
  }

  Future<void> storeLocal(BirthProfile? profile) async {
    final id = owner;
    if (id == null ||
        !canStoreLocally ||
        !isCurrent ||
        localReading ||
        localWriting)
      return;
    localWriting = true;
    localNotice = null;
    notifyListeners();
    try {
      if (profile == null) {
        await clearLocalDestinyBirthProfile(id);
      } else {
        await saveLocalDestinyBirthProfile(id, profile, () => isCurrent);
      }
      if (!isCurrent) return;
      localProfile = profile;
      localNotice = profile == null ? '已删除本机出生档案。' : '出生资料已保存到本机。';
    } catch (_) {
      if (isCurrent)
        localNotice = profile == null ? '删除本机出生资料失败，请重试。' : '保存出生资料到本机失败，请重试。';
    } finally {
      localWriting = false;
      if (isCurrent) notifyListeners();
    }
  }

  Future<bool> confirm(
    BirthProfile profile,
    AccountBirthFields expected,
  ) async {
    final id = owner;
    if (id == null || !isCurrent || saving) return false;
    _read?.complete();
    _read = null;
    final request = _save = Completer<void>();
    saveError = null;
    notifyListeners();
    try {
      final fields = await _account!.confirmBirthFields(
        id,
        expected,
        accountFieldsFor(profile),
        cancel: request.future,
      );
      if (!isCurrent || request.isCompleted) return false;
      current = (fields: fields, draft: BirthProfileDraft.fromProfile(profile));
      conflict = null;
      return true;
    } on JsonRequestError catch (error) {
      if (!isCurrent || request.isCompleted) return false;
      if (error.status == 409) {
        await _recoverConflict(id, request);
      } else {
        saveError = error.status == 401 || error.status == 403
            ? '账户会话已变化，请重新登录后核对资料。'
            : '暂时无法同步出生资料，请重试。';
      }
    } catch (_) {
      if (isCurrent && !request.isCompleted) saveError = '暂时无法同步出生资料，请重试。';
    } finally {
      _save = null;
      if (isCurrent) notifyListeners();
    }
    return false;
  }

  Future<void> _recoverConflict(String id, Completer<void> request) async {
    try {
      final fields = await _account!.readBirthFields(
        id,
        cancel: request.future,
      );
      final next = await _draft(fields);
      if (isCurrent && !request.isCompleted) current = conflict = next;
    } catch (_) {
      if (isCurrent && !request.isCompleted)
        saveError = '账户资料有更新，暂时无法读取最新内容，请重试。';
    }
  }

  void clearConfirmation() {
    conflict = null;
    saveError = null;
  }

  @override
  void dispose() {
    _disposed = true;
    _read?.complete();
    _save?.complete();
    super.dispose();
  }
}
