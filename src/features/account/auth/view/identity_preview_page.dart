import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../model/account_section.dart';
import '../../view/account_section_links.dart';

import '../../../../shared/http/json_client.dart';
import '../../../../ui/theme.dart';
import '../../../compliance/agreements.dart';
import '../control/account_controller.dart';
import 'account_deletion_page.dart';
import 'password_security_page.dart';
import 'phone_security_page.dart';

class IdentityPreviewPage extends StatefulWidget {
  const IdentityPreviewPage({
    super.key,
    required this.account,
    required this.memberId,
  });

  final AccountController account;
  final String memberId;

  @override
  State<IdentityPreviewPage> createState() => _IdentityPreviewPageState();
}

class _IdentityPreviewPageState extends State<IdentityPreviewPage> {
  final _name = TextEditingController();
  final _number = TextEditingController();
  bool _agreed = false;
  bool _busy = false;
  String? _feedback;

  bool get _ready =>
      !_busy &&
      _agreed &&
      _name.text.trim().isNotEmpty &&
      RegExp(r'^\d{17}[\dXx]$').hasMatch(_number.text);

  @override
  void initState() {
    super.initState();
    widget.account.addListener(_accountChanged);
  }

  void _accountChanged() {
    if (widget.account.socialMemberId == widget.memberId) return;
    _name.clear();
    _number.clear();
    _agreed = false;
  }

  @override
  void dispose() {
    widget.account.removeListener(_accountChanged);
    _name.dispose();
    _number.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_ready || widget.account.socialMemberId != widget.memberId) return;
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _busy = true;
      _feedback = null;
    });
    var unavailable = true;
    try {
      await widget.account.probeIdentityVerification(
        widget.memberId,
        submit: true,
      );
    } on JsonRequestError catch (error) {
      unavailable = error.status == 503 || error.status == 404;
    } catch (_) {
      unavailable = false;
    }
    if (!mounted) return;
    _name.clear();
    _number.clear();
    setState(() {
      _busy = false;
      _feedback = unavailable ? '实名认证服务暂未接入。' : '暂时无法提交实名认证，请重试。';
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const UiText('实名认证')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: widget.account,
        builder: (context, _) {
          if (widget.account.socialMemberId != widget.memberId) {
            return const Padding(
              padding: jovianPagePadding,
              child: UiText('请登录后继续。'),
            );
          }
          return Padding(
            padding: jovianPagePadding,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(
                  child: ListView(
                    keyboardDismissBehavior:
                        ScrollViewKeyboardDismissBehavior.onDrag,
                    children: [
                      UiText(
                        '请输入真实姓名及身份证号码',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 10),
                      UiText(
                        '内测预览，输入内容不会上传或保存。',
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _name,
                        enabled: !_busy,
                        maxLength: 80,
                        autocorrect: false,
                        enableSuggestions: false,
                        onChanged: (_) => setState(() => _feedback = null),
                        decoration: InputDecoration(
                          labelText: context.uiLabel('真实姓名'),
                          counterText: '',
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _number,
                        enabled: !_busy,
                        maxLength: 18,
                        autocorrect: false,
                        enableSuggestions: false,
                        textCapitalization: TextCapitalization.characters,
                        inputFormatters: [
                          FilteringTextInputFormatter.allow(RegExp(r'[0-9Xx]')),
                        ],
                        onChanged: (_) => setState(() => _feedback = null),
                        decoration: InputDecoration(
                          labelText: context.uiLabel('身份证号码'),
                          hintText: context.uiLabel('18 位，末位可为 X'),
                          counterText: '',
                        ),
                      ),
                    ],
                  ),
                ),
                if (_feedback case final notice?)
                  Semantics(liveRegion: true, child: UiText(notice)),
                Row(
                  children: [
                    Checkbox(
                      shape: const CircleBorder(),
                      value: _agreed,
                      semanticLabel: context.uiLabel('我已知悉并同意'),
                      onChanged: _busy
                          ? null
                          : (value) => setState(() => _agreed = value == true),
                    ),
                    Expanded(
                      child: Wrap(
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          UiText(
                            '我已知悉并同意',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          AgreementLink.bundled(
                            draft: bundledAgreementDrafts['identity']!,
                            compact: true,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                FilledButton(
                  onPressed: _ready ? _submit : null,
                  child: UiText(_busy ? '提交中…' : '提交'),
                ),
              ],
            ),
          );
        },
      ),
    ),
  );
}

class AccountSecurityPage extends StatelessWidget {
  const AccountSecurityPage({super.key, required this.account});

  final AccountController account;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const UiText('账户与安全')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) {
          final memberId = account.memberId;
          final member = account.session;
          return ListView(
            padding: jovianPagePadding,
            children: [
              if (memberId == null || member == null)
                const Text('登录并确认协议后可管理账户安全。')
              else ...[
                if (member.socialProvider case final provider?)
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Text(
                      provider == 'wechat' ? '当前使用微信登录。' : '当前使用 QQ 登录。',
                    ),
                  )
                else ...[
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.phone_android_outlined),
                      title: const UiText('手机号'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => AccountSectionLinks.openPage(
                        context,
                        AccountSection.phone,
                        () => PhoneSecurityPage(
                          account: account,
                          owner: memberId,
                        ),
                      ),
                    ),
                  ),
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.lock_outline),
                      title: Text(member.hasPassword ? '修改密码' : '设置密码'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => AccountSectionLinks.openPage(
                        context,
                        AccountSection.password,
                        () => PasswordSecurityPage(
                          account: account,
                          owner: memberId,
                        ),
                      ),
                    ),
                  ),
                ],
                Card(
                  child: ListTile(
                    leading: const Icon(Icons.badge_outlined),
                    title: const UiText('实名认证'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => AccountSectionLinks.openPage(
                      context,
                      AccountSection.identity,
                      () => IdentityPreviewPage(
                        account: account,
                        memberId: memberId,
                      ),
                    ),
                  ),
                ),
                if (account.deletion != null)
                  Card(
                    child: ListTile(
                      leading: const Icon(Icons.person_remove_outlined),
                      title: const UiText('注销账号'),
                      subtitle: const Text('查看数据处理范围并申请注销'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => AccountSectionLinks.openPage(
                        context,
                        AccountSection.deletion,
                        () => AccountDeletionPage(
                          account: account,
                          owner: memberId,
                        ),
                      ),
                    ),
                  ),
              ],
            ],
          );
        },
      ),
    ),
  );
}
