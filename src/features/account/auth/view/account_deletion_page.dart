import 'dart:async';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../shared/http/json_client.dart';
import '../../../../ui/theme.dart';
import '../control/account_controller.dart';
import '../model/account_deletion.dart';
import '../model/password.dart';

class AccountDeletionPage extends StatefulWidget {
  const AccountDeletionPage({
    super.key,
    required this.account,
    required this.owner,
  });

  final AccountController account;
  final String owner;

  @override
  State<AccountDeletionPage> createState() => _AccountDeletionPageState();
}

class _AccountDeletionPageState extends State<AccountDeletionPage> {
  final _password = TextEditingController();
  final _code = TextEditingController();
  DeletionSetup? _setup;
  PasswordSmsChallenge? _challenge;
  String? _error;
  bool _confirmed = false;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _password.dispose();
    _code.dispose();
    super.dispose();
  }

  Future<void> _load() => _run(() async {
    final setup = await widget.account.prepareDeletion(widget.owner);
    if (mounted) setState(() => _setup = setup);
  }, '暂时无法准备注销，请重试。');

  Future<void> _sendCode() => _run(() async {
    final challenge = await widget.account.issueDeletionCode(widget.owner);
    if (!mounted) return;
    _code.clear();
    setState(() => _challenge = challenge);
  }, '无法发送注销验证码，请稍后再试。');

  Map<String, Object?>? get _proof => switch (_setup?.method) {
    DeletionMethod.password
        when _password.text.isNotEmpty &&
            _password.text.runes.length <= maximumPasswordLength =>
      {'password': _password.text},
    DeletionMethod.phone
        when _challenge != null && RegExp(r'^\d{6}$').hasMatch(_code.text) =>
      {'challengeId': _challenge!.id, 'code': _code.text},
    DeletionMethod.localSocial => {'simulateSocial': true},
    _ => null,
  };

  Future<void> _submit() async {
    final setup = _setup;
    final proof = _proof;
    if (!_confirmed || _busy || setup == null || proof == null) return;
    FocusScope.of(context).unfocus();
    await _run(() async {
      await widget.account.deleteAccount(widget.owner, setup, proof);
      if (!mounted) return;
      _password.clear();
      _code.clear();
      Navigator.of(context).popUntil((route) => route.isFirst);
    }, '注销结果暂时无法确认。请重试，或在登录页查看注销状态。');
  }

  Future<void> _run(Future<void> Function() action, String fallback) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } catch (failure) {
      if (!mounted) return;
      final status = failure is JsonRequestError ? failure.status : null;
      if (status == 410) {
        _challenge = null;
        _code.clear();
      }
      _error = switch (status) {
        401 => '登录状态已变更，请重新登录后重试。',
        410 => '验证码已失效，请重新获取。',
        422 => '身份验证失败，请核对密码或验证码。',
        429 => '操作太频繁，请稍后重试。',
        503 => '身份验证服务暂不可用。',
        _ => fallback,
      };
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _readNotice() => showDialog<void>(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('账号注销与数据删除说明'),
      scrollable: true,
      content: const Text(
        '请在申请前核对账号、命理档案、API 报告、算事记录、第三方登录关联及剩余权益。\n\n'
        '注销会撤销该账号的所有会话，并处理账号资料、已归档报告、命理档案、社交关系和当前设备上的记录。第三方平台账号及其记录按对应平台规则处理。\n\n'
        '提交后可在登录页查看处理状态。关联记录仍在清理时，可刷新查询。',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('关闭'),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final method = _setup?.method;
    final supported = method != null && method != DeletionMethod.unsupported;
    final changed = !_busy && widget.account.memberId != widget.owner;
    return PopScope(
      canPop: !_busy,
      child: Scaffold(
        appBar: AppBar(title: const Text('注销账号')),
        body: SafeArea(
          top: false,
          child: ListView(
            padding: jovianPagePadding,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [
              const Text('注销会结束该账号在所有设备上的登录。注销完成后无法恢复。'),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton(
                  onPressed: _readNotice,
                  child: const Text('阅读《账号注销与数据删除说明》'),
                ),
              ),
              if (_busy) const LinearProgressIndicator(),
              if (changed)
                const Text('登录状态已变更，请重新登录后重试。')
              else ...[
                if (method == DeletionMethod.password)
                  TextField(
                    controller: _password,
                    enabled: !_busy,
                    obscureText: true,
                    autocorrect: false,
                    enableSuggestions: false,
                    autofillHints: const [AutofillHints.password],
                    onChanged: (_) => setState(() {}),
                    decoration: const InputDecoration(labelText: '当前密码'),
                  ),
                if (method == DeletionMethod.phone) ...[
                  OutlinedButton(
                    onPressed: _busy ? null : _sendCode,
                    child: const Text('向绑定手机号发送验证码'),
                  ),
                  if (_challenge case final challenge?) ...[
                    Text(
                      challenge.localInbox ? '请在本机虚拟服务商收件箱查看验证码。' : '验证码已发送。',
                    ),
                    TextField(
                      controller: _code,
                      enabled: !_busy,
                      autofillHints: const [AutofillHints.oneTimeCode],
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                      onChanged: (_) => setState(() {}),
                      decoration: const InputDecoration(
                        labelText: '注销验证码',
                        counterText: '',
                      ),
                    ),
                  ],
                ],
                if (method == DeletionMethod.localSocial)
                  const Text('本机第三方登录演示将在提交时再次验证身份。'),
                if (method == DeletionMethod.unsupported)
                  const Text('此登录方式的注销身份验证暂不可用。'),
                if (supported) ...[
                  CheckboxListTile(
                    value: _confirmed,
                    controlAffinity: ListTileControlAffinity.leading,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('我了解注销影响并确认申请'),
                    onChanged: _busy
                        ? null
                        : (checked) =>
                              setState(() => _confirmed = checked == true),
                  ),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      backgroundColor: colors.error,
                      foregroundColor: colors.onError,
                    ),
                    onPressed: !_busy && _confirmed && _proof != null
                        ? _submit
                        : null,
                    child: const Text('确认注销账号'),
                  ),
                ],
                if (_setup == null && !_busy)
                  TextButton(onPressed: _load, child: const Text('重新加载')),
                if (_error case final error?)
                  Semantics(
                    liveRegion: true,
                    child: Text(error, style: TextStyle(color: colors.error)),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
