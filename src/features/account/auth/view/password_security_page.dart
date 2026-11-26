import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../shared/http/json_client.dart';
import '../../../../ui/theme.dart';
import '../control/account_controller.dart';
import '../model/password.dart';

class PasswordSecurityPage extends StatelessWidget {
  const PasswordSecurityPage({
    super.key,
    required this.account,
    required this.owner,
  });

  final AccountController account;
  final String owner;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: account,
    builder: (context, _) {
      final member = account.memberId == owner ? account.session : null;
      final available = member != null && member.socialProvider == null;
      final hasPassword = member?.hasPassword == true;
      return Scaffold(
        appBar: AppBar(title: Text(hasPassword ? '修改密码' : '设置密码')),
        body: SafeArea(
          top: false,
          child: ListView(
            padding: jovianPagePadding,
            children: [
              if (available)
                _PasswordForm(
                  account: account,
                  owner: owner,
                  hasPassword: hasPassword,
                )
              else
                const Text('请使用原账户登录后管理密码。'),
            ],
          ),
        ),
      );
    },
  );
}

class _PasswordForm extends StatefulWidget {
  const _PasswordForm({
    required this.account,
    required this.owner,
    required this.hasPassword,
  });

  final AccountController account;
  final String owner;
  final bool hasPassword;

  @override
  State<_PasswordForm> createState() => _PasswordFormState();
}

class _PasswordFormState extends State<_PasswordForm> {
  final _current = TextEditingController();
  final _next = TextEditingController();
  final _confirm = TextEditingController();
  final _code = TextEditingController();
  PasswordSetupChallenge? _challenge;
  bool _pending = false;
  ({String text, bool error})? _notice;

  @override
  void dispose() {
    for (final field in [_current, _next, _confirm, _code]) {
      field.dispose();
    }
    super.dispose();
  }

  void _error(String text) =>
      setState(() => _notice = (text: text, error: true));

  Future<void> _request(
    Future<void> Function() action, {
    required String rejected,
    required String fallback,
  }) async {
    if (_pending || widget.account.busy) return;
    setState(() {
      _pending = true;
      _notice = null;
    });
    try {
      await action();
    } on JsonRequestError catch (error) {
      if (!mounted) return;
      if (error.status == 410) {
        _challenge = null;
        _code.clear();
      }
      _error(switch (error.status) {
        401 => '登录状态已失效，请重新登录。',
        403 => '当前账户无法执行此密码操作。',
        409 => '账户状态已变化，请返回并重新打开此页面。',
        410 => '验证码已失效，请重新获取。',
        422 => rejected,
        429 => '操作太频繁，请稍后重试。',
        _ => fallback,
      });
    } on FormatException {
      if (mounted) _error(fallback);
    } finally {
      if (mounted) setState(() => _pending = false);
    }
  }

  Future<void> _sendCode() => _request(
    () async {
      final challenge = await widget.account.issuePasswordSetup(widget.owner);
      if (!mounted) return;
      _challenge = challenge;
      _code.clear();
    },
    rejected: '发送验证码失败，请重试。',
    fallback: '暂时无法发送验证码，请稍后重试。',
  );

  Future<void> _save() async {
    final next = _next.text;
    final length = next.runes.length;
    if (length < minimumPasswordLength || length > maximumPasswordLength) {
      _error('新密码需要 $minimumPasswordLength 至 $maximumPasswordLength 个字符。');
      return;
    }
    if (next != _confirm.text) {
      _error('两次输入的新密码不一致。');
      return;
    }
    final changing = widget.hasPassword;
    final current = _current.text;
    if (changing &&
        (current.isEmpty ||
            current.runes.length > maximumPasswordLength ||
            current == next)) {
      _error('请输入当前密码，并使用与当前密码不同的新密码。');
      return;
    }
    final challenge = _challenge;
    final code = _code.text;
    if (!changing &&
        (challenge == null || !RegExp(r'^\d{6}$').hasMatch(code))) {
      _error('请输入绑定手机号收到的六位验证码。');
      return;
    }
    FocusScope.of(context).unfocus();
    await _request(
      () async {
        final account = widget.account;
        final owner = widget.owner;
        if (changing) {
          await account.changePassword(owner, current, next);
        } else {
          await account.setupPassword(owner, challenge!, code, next);
        }
        if (!mounted || account.memberId != owner) return;
        for (final field in [_current, _next, _confirm, _code]) {
          field.clear();
        }
        _challenge = null;
        _notice = (
          text: changing ? '密码已更新，其他设备的会话已退出。' : '密码已设置，可以用手机号和密码登录。',
          error: false,
        );
      },
      rejected: changing ? '当前密码不正确。' : '验证码不正确，请核对后重试。',
      fallback: '暂时无法保存密码，请稍后重试。',
    );
  }

  Widget _passwordField(
    TextEditingController controller,
    String label, {
    required bool disabled,
    String? hint,
    String? help,
  }) => TextField(
    controller: controller,
    enabled: !disabled,
    obscureText: true,
    autocorrect: false,
    enableSuggestions: false,
    autofillHints: hint == null ? null : [hint],
    decoration: InputDecoration(labelText: label, helperText: help),
  );

  @override
  Widget build(BuildContext context) {
    final changing = widget.hasPassword;
    final smsAvailable =
        widget.account.capabilities?.phoneCodesAvailable != false;
    final disabled =
        _pending || widget.account.busy || (!changing && !smsAvailable);
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: AutofillGroup(
          onDisposeAction: AutofillContextAction.cancel,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (changing)
                _passwordField(
                  _current,
                  '当前密码',
                  disabled: disabled,
                  hint: AutofillHints.password,
                )
              else ...[
                const Text('验证已绑定的手机号后设置密码。'),
                if (smsAvailable)
                  OutlinedButton(
                    onPressed: disabled ? null : _sendCode,
                    child: Text(_challenge == null ? '获取验证码' : '重新获取验证码'),
                  )
                else
                  const Text('短信验证码服务暂不可用。'),
                if (_challenge case final challenge?) ...[
                  Text(
                    challenge.localInbox
                        ? '请在本机虚拟服务商的收件箱查看验证码。'
                        : '验证码已发送到绑定的手机号。',
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _code,
                    enabled: !disabled,
                    maxLength: 6,
                    inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                    keyboardType: TextInputType.number,
                    autofillHints: const [AutofillHints.oneTimeCode],
                    decoration: const InputDecoration(
                      labelText: '手机号验证码',
                      counterText: '',
                    ),
                  ),
                ],
              ],
              const SizedBox(height: 12),
              _passwordField(
                _next,
                '新密码',
                disabled: disabled,
                hint: AutofillHints.newPassword,
                help: '至少 $minimumPasswordLength 个字符',
              ),
              const SizedBox(height: 12),
              _passwordField(_confirm, '确认新密码', disabled: disabled),
              if (_notice case final notice?) ...[
                const SizedBox(height: 12),
                Semantics(
                  liveRegion: true,
                  child: Text(
                    notice.text,
                    style: TextStyle(
                      color: notice.error
                          ? Theme.of(context).colorScheme.error
                          : null,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              FilledButton(
                onPressed: disabled ? null : _save,
                child: Text(changing ? '更新密码' : '设置密码'),
              ),
              if (_pending) const LinearProgressIndicator(),
            ],
          ),
        ),
      ),
    );
  }
}
