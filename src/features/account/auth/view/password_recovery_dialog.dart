import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../control/account_controller.dart';
import '../model/password.dart';
import '../model/phone_binding.dart';

class PasswordRecoveryDialog extends StatefulWidget {
  const PasswordRecoveryDialog({
    super.key,
    required this.account,
    required this.phone,
  });

  final AccountController account;
  final String phone;

  @override
  State<PasswordRecoveryDialog> createState() => _PasswordRecoveryDialogState();
}

class _PasswordRecoveryDialogState extends State<PasswordRecoveryDialog> {
  late final _flow = widget.account.passwordRecovery(widget.phone);
  final _code = TextEditingController();
  final _password = TextEditingController();
  final _confirmation = TextEditingController();

  @override
  void dispose() {
    _flow.dispose();
    _code.dispose();
    _password.dispose();
    _confirmation.dispose();
    super.dispose();
  }

  Future<void> _issue() async {
    final sent = await _flow.issue();
    if (mounted && sent) _code.clear();
  }

  Future<void> _verify() async {
    FocusScope.of(context).unfocus();
    final verified = await _flow.verify(_code.text);
    if (mounted && (verified || _flow.challenge == null)) _code.clear();
  }

  Future<void> _submit() async {
    FocusScope.of(context).unfocus();
    final saved = await _flow.complete(_password.text, _confirmation.text);
    if (!mounted) return;
    if (saved) {
      Navigator.of(context).pop(true);
    } else if (!_flow.verified) {
      _password.clear();
      _confirmation.clear();
    }
  }

  Widget _passwordField(TextEditingController field, String label) => TextField(
    controller: field,
    enabled: !_flow.busy,
    obscureText: true,
    autocorrect: false,
    enableSuggestions: false,
    autofillHints: identical(field, _password)
        ? const [AutofillHints.newPassword]
        : null,
    decoration: InputDecoration(labelText: label),
  );

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _flow,
    builder: (context, _) {
      final busy = _flow.busy;
      final challenge = _flow.challenge;
      final verified = _flow.verified;
      final theme = Theme.of(context);
      return PopScope(
        canPop: !busy,
        child: AlertDialog(
          scrollable: true,
          insetPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 24,
          ),
          constraints: const BoxConstraints(minWidth: 280, maxWidth: 440),
          title: Text(verified ? '设置新密码' : '重置登录密码'),
          content: AutofillGroup(
            onDisposeAction: AutofillContextAction.cancel,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              spacing: 12,
              children: [
                Text('验证手机号 ${maskAccountPhone(widget.phone)}'),
                if (verified) ...[
                  _passwordField(_password, '新密码'),
                  _passwordField(_confirmation, '确认新密码'),
                  Text(
                    '密码需要 $minimumPasswordLength 至 $maximumPasswordLength 个字符。',
                    style: theme.textTheme.bodySmall,
                  ),
                ] else ...[
                  OutlinedButton(
                    onPressed: busy ? null : _issue,
                    child: Text(challenge == null ? '获取验证码' : '重新获取验证码'),
                  ),
                  if (challenge != null) ...[
                    Text(
                      challenge.localInbox ? '请在本机虚拟服务商收件箱查看验证码。' : '验证码已发送。',
                    ),
                    TextField(
                      controller: _code,
                      enabled: !busy,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      decoration: const InputDecoration(
                        labelText: '恢复验证码',
                        counterText: '',
                      ),
                    ),
                  ],
                ],
                if (busy) const LinearProgressIndicator(),
                if (_flow.error case final message?)
                  Semantics(
                    liveRegion: true,
                    child: Text(
                      message,
                      style: TextStyle(color: theme.colorScheme.error),
                    ),
                  ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: busy ? null : () => Navigator.of(context).pop(),
              child: const Text('返回登录'),
            ),
            if (verified)
              FilledButton(
                onPressed: busy ? null : _submit,
                child: const Text('确认重置密码'),
              )
            else if (challenge != null)
              FilledButton(
                onPressed: busy ? null : _verify,
                child: const Text('验证并继续'),
              ),
          ],
        ),
      );
    },
  );
}
