import 'dart:async';

import 'package:flutter/foundation.dart';

import '../../../../shared/http/json_client.dart';
import '../model/password.dart';
import '../model/phone_binding.dart';
import '../model/session.dart';
import '../requests/phone_binding_api.dart';

class PhoneBindingController extends ChangeNotifier {
  PhoneBindingController(
    this._api, {
    required this.usesEmail,
    required this.hasPassword,
  }) {
    unawaited(load());
  }

  final PhoneBindingApi _api;
  final bool usesEmail;
  final bool hasPassword;
  final _cancel = Completer<void>();
  static final _sixDigits = RegExp(r'^\d{6}$');

  String? phone;
  BindingChallenge? currentChallenge;
  BindingChallenge? nextChallenge;
  bool loaded = false;
  bool busy = false;
  String? notice;
  String? error;

  bool get requiresCurrent => !usesEmail && phone != null;
  bool get canBind => loaded && (requiresCurrent || hasPassword);

  Future<void> load() => _run(() async {
    final result = await _api.bound(cancel: _cancel.future);
    if (_cancel.isCompleted) return;
    phone = result;
    loaded = true;
  }, fallback: '暂时无法读取手机号，请重试。');

  void clearProofs() {
    currentChallenge = null;
    nextChallenge = null;
    notice = null;
    error = null;
    notifyListeners();
  }

  void invalidateNext() {
    if (nextChallenge == null && error == null) return;
    nextChallenge = null;
    error = null;
    notifyListeners();
  }

  Future<bool> send(BindingCodeTarget target, String input) async {
    if (busy || !canBind) return false;
    final old = target == BindingCodeTarget.current;
    if (old && !requiresCurrent) return false;
    final entered = AccountIdentifier.parse(input);
    final number = old
        ? phone
        : entered?.isPhone == true
        ? entered!.value
        : null;
    if (number == null) return _reject('请输入有效的手机号。');
    if (!old && number == phone) return _reject('请输入与当前绑定不同的手机号。');
    return _run(() async {
      final challenge = await _api.issue(
        target,
        number,
        cancel: _cancel.future,
      );
      if (_cancel.isCompleted) return;
      if (old) {
        currentChallenge = challenge;
      } else {
        nextChallenge = challenge;
      }
    }, fallback: '暂时无法发送验证码，请重试。');
  }

  Future<bool> confirm(
    String input,
    String code,
    String originalCode,
    String password,
  ) async {
    if (busy || !canBind) return false;
    final challenge = nextChallenge;
    final current = currentChallenge;
    if (challenge == null ||
        AccountIdentifier.parse(input)?.value != challenge.phone ||
        !_sixDigits.hasMatch(code)) {
      return _reject('请核对待绑定手机号和六位验证码。');
    }
    if (requiresCurrent &&
        (current == null || !_sixDigits.hasMatch(originalCode))) {
      return _reject('请输入原手机号收到的六位验证码。');
    }
    if (!requiresCurrent &&
        (password.isEmpty || password.runes.length > maximumPasswordLength)) {
      return _reject('请输入有效的账户密码。');
    }
    return _run(
      () async {
        final saved = await _api.bind(
          challenge,
          code,
          password: requiresCurrent ? null : password,
          current: requiresCurrent ? current : null,
          currentCode: requiresCurrent ? originalCode : null,
          cancel: _cancel.future,
        );
        if (_cancel.isCompleted) return;
        phone = saved;
        currentChallenge = null;
        nextChallenge = null;
        notice = '绑定手机号已更新。';
      },
      fallback: '暂时无法更新手机号，请重试。',
      updating: true,
    );
  }

  bool _reject(String message) {
    error = message;
    notifyListeners();
    return false;
  }

  Future<bool> _run(
    Future<void> Function() operation, {
    required String fallback,
    bool updating = false,
  }) async {
    if (busy || _cancel.isCompleted) return false;
    busy = true;
    notice = null;
    error = null;
    notifyListeners();
    try {
      await operation();
      return !_cancel.isCompleted;
    } catch (failure) {
      if (!_cancel.isCompleted) {
        final status = failure is JsonRequestError ? failure.status : null;
        if (status == 401) {
          loaded = false;
          phone = null;
        }
        if (status == 401 || status == 410 || (status == 409 && updating)) {
          currentChallenge = null;
          nextChallenge = null;
        }
        error = switch (status) {
          401 => '登录状态已变更，请重新登录后重试。',
          403 => '当前账号无法绑定手机号。',
          409 => '此手机号已绑定到其他账户。',
          410 => '验证码已失效，请重新获取。',
          412 => '账户密码不正确。',
          422 => '验证码不正确，请核对后重试。',
          429 => '操作太频繁，请稍后重试。',
          503 => '短信验证码服务暂不可用。',
          _ => fallback,
        };
      }
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
