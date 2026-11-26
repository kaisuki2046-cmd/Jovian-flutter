import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../model/account_section.dart';
import '../../view/account_section_links.dart';

import '../../../../shared/http/json_client.dart';
import '../../../../ui/theme.dart';
import '../../settings/model/agreements.dart';
import '../../settings/view/agreement_document_page.dart';
import '../control/account_controller.dart';
import 'account_deletion_page.dart';
import 'password_security_page.dart';
import 'phone_security_page.dart';

const _identityTerms = AgreementDocument(
  id: 'identity',
  version: '内测草案',
  hash: '',
  title: '实名认证服务协议',
  preview: true,
  sections: [
    (
      title: '实名认证用途',
      text:
          '实名功能拟用于本人主动核对姓名与居民身份证号码是否一致。适用场景为【待填：实际接入的实名用途】。具体采集信息为本人姓名和身份证号码。当前内测仅预览表单，提交不发送姓名或证件号。',
    ),
    (
      title: '独立同意与当前预览',
      text:
          '正式核验由你在了解信息接收方和处理方式后主动发起。本次预览中的勾选只用于体验提交流程。输入的姓名和身份证号码在本页暂存，提交或离开页面时清除。',
    ),
    (
      title: '服务商和核验结果',
      text:
          '接收方与处理地区为【待填：核验供应商法定名称、隐私政策地址、处理地区】。核验结果、保存字段和期限为【待填：核验结果口径、保留记录和删除安排】。服务异常或未通过时，应按实际返回结果说明可用的重试或申诉方式。',
    ),
    (
      title: '撤回与联系',
      text: '正式服务的撤回、结果查询、更正或删除由【待填：实际入口、联系方式及回复期限】受理。实名核验相关资料及结果按核定的必要范围保存。',
    ),
  ],
);

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
                      Text(
                        '请输入真实姓名及身份证号码',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        '内测预览，输入内容仅用于本页提交流程。',
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
                        decoration: const InputDecoration(
                          labelText: '真实姓名',
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
                        decoration: const InputDecoration(
                          labelText: '身份证号码',
                          hintText: '18 位，末位可为 X',
                          counterText: '',
                        ),
                      ),
                    ],
                  ),
                ),
                if (_feedback case final notice?)
                  Semantics(liveRegion: true, child: Text(notice)),
                Row(
                  children: [
                    Checkbox(
                      shape: const CircleBorder(),
                      value: _agreed,
                      semanticLabel: '我已知悉并同意',
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
                          const AgreementLink(
                            document: _identityTerms,
                            compact: true,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                FilledButton(
                  onPressed: _ready ? _submit : null,
                  child: Text(_busy ? '提交中…' : '提交'),
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
