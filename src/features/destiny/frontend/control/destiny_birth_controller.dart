import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:jovian_destiny/jovian_destiny.dart';

import '../../../../shared/http/json_client.dart';
import '../../../account/account.dart';
import '../../model/birth_profile_draft.dart';

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
  Completer<void>? _read;
  Completer<void>? _save;
  bool _disposed = false;
  String? readError;
  String? saveError;

  bool get member => owner != null;
  bool get isCurrent => !_disposed && _account?.memberId == owner;
  bool get loading => _read != null;
  bool get saving => _save != null;

  Future<SavedBirthDraft> _draft(AccountBirthFields fields) async => (
    fields: fields,
    draft: fields.hasData
        ? BirthProfileDraft.fromAccount(fields, await _loadPlaces())
        : const BirthProfileDraft(),
  );

  Future<void> refresh() async {
    final id = owner;
    if (id == null || !isCurrent || loading || saving) return;
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
