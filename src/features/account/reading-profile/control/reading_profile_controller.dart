import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../../shared/http/json_client.dart';
import '../../auth/control/account_controller.dart';
import '../model/account_reading_profile.dart';

class ReadingProfileController extends ChangeNotifier {
  ReadingProfileController(this._account, this._owner);

  final AccountController _account;
  final String _owner;
  final _cancel = Completer<void>();
  AccountReadingProfile? _baseline;
  AccountReadingProfile? draft;
  String? notice;
  bool loading = false;
  bool saving = false;
  bool conflict = false;
  bool failed = false;

  bool get current => !_cancel.isCompleted && _account.memberId == _owner;
  bool get dirty => draft != null && !draft!.sameAs(_baseline!);

  Future<void> load({bool discard = false}) async {
    if (!current || loading || saving || (dirty && !discard)) return;
    loading = true;
    failed = false;
    notice = null;
    notifyListeners();
    try {
      final value = await _account.readBirthSettings(
        _owner,
        cancel: _cancel.future,
      );
      if (current) {
        draft = _baseline = value;
        conflict = false;
      }
    } on JsonRequestError catch (error) {
      if (current) {
        failed = true;
        notice = error.status == 401 ? '账户会话已变化，请重新登录。' : '暂时无法读取出生资料，请重试。';
      }
    } catch (_) {
      if (current) {
        failed = true;
        notice = '暂时无法读取出生资料，请重试。';
      }
    } finally {
      loading = false;
      if (current) notifyListeners();
    }
  }

  void setValue(ReadingField field, String value) {
    if (!current || loading || saving || draft == null) return;
    draft = draft!.withValue(field, value);
    if (!conflict) notice = null;
    notifyListeners();
  }

  void setVisibility(ReadingField field, bool value) {
    if (!current || loading || saving || draft == null) return;
    draft = draft!.withVisibility(field, value);
    if (!conflict) notice = null;
    notifyListeners();
  }

  Future<void> save() async {
    if (!current || loading || saving || conflict || !dirty) return;
    saving = true;
    notice = null;
    notifyListeners();
    try {
      final value = await _account.saveBirthSettings(
        _owner,
        _baseline!,
        draft!,
        cancel: _cancel.future,
      );
      if (current) {
        draft = _baseline = value;
        notice = '出生资料和可见性已保存。';
      }
    } on JsonRequestError catch (error) {
      if (current) {
        conflict = error.status == 409;
        notice = switch (error.status) {
          409 => '出生资料已在别处更新。请加载最新资料后重新核对。',
          401 || 403 => '账户会话已变化，请重新登录。',
          _ => '无法保存出生资料，请重试。',
        };
      }
    } catch (_) {
      if (current) notice = '无法保存出生资料，请重试。';
    } finally {
      saving = false;
      if (current) notifyListeners();
    }
  }

  @override
  void dispose() {
    _cancel.complete();
    super.dispose();
  }
}
