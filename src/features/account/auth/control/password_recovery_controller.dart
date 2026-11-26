import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../../shared/http/json_client.dart';
import '../model/password.dart';
import '../requests/account_api.dart';

class PasswordRecoveryController extends ChangeNotifier {
  PasswordRecoveryController(this._api, this.phone, {required bool keepGuest})
    : _keepGuest = keepGuest;

  final AccountApi _api;
  final String phone;
  final bool _keepGuest;
  final _cancel = Completer<void>();
  PasswordSmsChallenge? challenge;
  String? _resetToken;
  String? error;
  bool busy = false;

  bool get verified => _resetToken != null;

  Future<bool> issue() => _run(() async {
    challenge = await _api.issuePasswordRecovery(phone, cancel: _cancel.future);
  });

  Future<bool> verify(String code) async {
    final proof = challenge;
    if (proof == null || !RegExp(r'^\d{6}$').hasMatch(code)) {
      return _reject('请输入六位验证码。');
    }
    return _run(() async {
      _resetToken = await _api.verifyPasswordRecovery(
        phone,
        proof.id,
        code,
        cancel: _cancel.future,
      );
    });
  }

  Future<bool> complete(String password, String confirmation) async {
    final token = _resetToken;
    if (token == null) return false;
    final length = password.runes.length;
    if (length < minimumPasswordLength || length > maximumPasswordLength) {
      return _reject(
        '密码需要 $minimumPasswordLength 至 $maximumPasswordLength 个字符。',
      );
    }
    if (password != confirmation) return _reject('两次输入的新密码不一致。');
    return _run(
      () => _api.completePasswordRecovery(
        phone,
        token,
        password,
        keepGuest: _keepGuest,
        cancel: _cancel.future,
      ),
    );
  }

  bool _reject(String message) {
    error = message;
    notifyListeners();
    return false;
  }

  Future<bool> _run(Future<void> Function() action) async {
    if (busy || _cancel.isCompleted) return false;
    busy = true;
    error = null;
    notifyListeners();
    try {
      await action();
      return !_cancel.isCompleted;
    } catch (failure) {
      final status = failure is JsonRequestError ? failure.status : null;
      if (status == 410) {
        challenge = null;
        _resetToken = null;
      }
      error = switch (status) {
        410 => '验证已过期，请重新获取验证码。',
        422 => '无法通过该验证码验证，请核对后重试。',
        429 => '操作太频繁，请稍后重试。',
        503 => '短信验证码服务暂不可用。',
        _ => '暂时无法重置密码，请重试。',
      };
      return false;
    } finally {
      busy = false;
      if (!_cancel.isCompleted) notifyListeners();
    }
  }

  @override
  void dispose() {
    _cancel.complete();
    super.dispose();
  }
}
