import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../../../ui/theme.dart';
import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';
import '../../model/account_section.dart';
import '../../profile/view/profile_editor_page.dart';
import '../../view/account_section_links.dart';
import '../control/privacy_requests_controller.dart';
import '../model/privacy_request.dart';

class PrivacyRightsPage extends StatelessWidget {
  const PrivacyRightsPage({
    super.key,
    required this.account,
    required this.owner,
  });

  final AccountController account;
  final String owner;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const UiText('个人信息权利')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) {
          final member = account.session;
          if (account.memberId != owner || member == null) {
            return const Padding(
              padding: jovianPagePadding,
              child: Text('登录并确认协议后可查看或提交申请。'),
            );
          }
          return _PrivacyRightsPanel(
            key: ValueKey(owner),
            account: account,
            member: member,
          );
        },
      ),
    ),
  );
}

class _PrivacyRightsPanel extends StatefulWidget {
  const _PrivacyRightsPanel({
    super.key,
    required this.account,
    required this.member,
  });

  final AccountController account;
  final AccountSession member;

  @override
  State<_PrivacyRightsPanel> createState() => _PrivacyRightsPanelState();
}

class _PrivacyRightsPanelState extends State<_PrivacyRightsPanel> {
  late final _controller = PrivacyRequestsController(
    widget.account.privacyRequests(widget.member.id),
  );
  final _detail = TextEditingController();
  PrivacyRequestKind? _applying;
  PrivacyReceipt? _reviewing;
  String? _copyNotice;

  @override
  void dispose() {
    _controller.dispose();
    _detail.dispose();
    super.dispose();
  }

  void _select({PrivacyRequestKind? kind, PrivacyReceipt? receipt}) {
    _detail.clear();
    setState(() {
      _applying = kind;
      _reviewing = receipt;
      _copyNotice = null;
    });
  }

  Future<void> _showQueue(bool value) async {
    _select();
    await _controller.showQueue(value);
  }

  Future<void> _submit() async {
    final kind = _applying;
    final reviewing = _reviewing;
    FocusManager.instance.primaryFocus?.unfocus();
    final saved = reviewing != null
        ? await _controller.review(reviewing, _detail.text)
        : kind != null && await _controller.submit(kind, _detail.text);
    if (mounted && saved) _select();
  }

  Future<void> _copy() async {
    final member = widget.member;
    if (widget.account.memberId != member.id) return;
    var message = '基础资料已复制。';
    try {
      await Clipboard.setData(
        ClipboardData(
          text: const JsonEncoder.withIndent('  ').convert({
            'UID': member.uid,
            '昵称': member.displayName,
            '个人简介': member.bio,
            '邮箱': member.email,
          }),
        ),
      );
    } on PlatformException {
      message = '暂时无法使用剪贴板。';
    }
    if (mounted) setState(() => _copyNotice = message);
  }

  Widget _form(String label, String submit) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      TextField(
        controller: _detail,
        enabled: !_controller.busy,
        maxLength: privacyRequestLimit,
        minLines: 3,
        maxLines: 5,
        decoration: InputDecoration(labelText: label),
      ),
      const Text('请勿填写密码、验证码或完整身份证号码。'),
      const SizedBox(height: 12),
      FilledButton(
        onPressed: _controller.busy ? null : _submit,
        child: Text(_controller.saving ? '正在保存…' : submit),
      ),
      TextButton(
        onPressed: _controller.saving ? null : _select,
        child: const UiText('取消'),
      ),
    ],
  );

  Widget _receipt(PrivacyReceipt receipt) {
    final theme = Theme.of(context);
    final date = receipt.createdAt.toLocal();
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              '${receipt.kind.label} · ${receipt.reviewed ? '已处理' : '待处理'}',
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: 4),
            Text(
              '${date.year}年${date.month}月${date.day}日',
              style: theme.textTheme.bodySmall,
            ),
            if (receipt.ownerId case final id?)
              Text('申请账户 $id', style: theme.textTheme.bodySmall),
            if (receipt.detail.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(receipt.detail),
            ],
            if (receipt.conclusion case final conclusion?) ...[
              const SizedBox(height: 8),
              Text('处理结论', style: theme.textTheme.labelLarge),
              Text(conclusion),
            ],
            if (_controller.queue && receipt.ownerId != widget.member.id) ...[
              const SizedBox(height: 8),
              if (_reviewing?.id == receipt.id)
                _form('处理说明（申请人可见）', '确认处理')
              else
                OutlinedButton(
                  onPressed: _controller.busy || _reviewing != null
                      ? null
                      : () => _select(receipt: receipt),
                  child: const Text('处理申请'),
                ),
            ],
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _controller,
    builder: (context, _) {
      final theme = Theme.of(context);
      return ListView(
        padding: jovianPagePadding,
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          if (_controller.queue)
            TextButton(
              onPressed: _controller.busy ? null : () => _showQueue(false),
              child: const Text('返回我的申请'),
            )
          else ...[
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: ListTile(
                leading: const Icon(Icons.person_outline),
                title: const Text('查看或更正基础资料'),
                subtitle: const Text('昵称、简介和出生资料'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => AccountSectionLinks.openPage(
                  context,
                  AccountSection.profile,
                  () => ProfileEditorPage(
                    account: widget.account,
                    member: widget.member,
                  ),
                ),
              ),
            ),
            Card(
              margin: const EdgeInsets.only(bottom: 12),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    OutlinedButton(
                      onPressed: _copy,
                      child: const Text('复制基础资料'),
                    ),
                    for (final kind in PrivacyRequestKind.values) ...[
                      const SizedBox(height: 6),
                      OutlinedButton(
                        onPressed: _controller.busy
                            ? null
                            : () => _select(kind: kind),
                        child: Text(kind.label),
                      ),
                    ],
                    if (_applying case final kind?) ...[
                      const SizedBox(height: 10),
                      _form(
                        kind == PrivacyRequestKind.correction
                            ? '说明需要更正的资料'
                            : '说明需要查阅或复制的资料（选填）',
                        '提交申请',
                      ),
                    ],
                  ],
                ),
              ),
            ),
            if (_controller.canReview)
              OutlinedButton(
                onPressed: _controller.busy ? null : () => _showQueue(true),
                child: const Text('处理用户申请'),
              ),
          ],
          const SizedBox(height: 12),
          Semantics(
            header: true,
            child: Text(
              _controller.queue ? '待处理申请' : '我的申请',
              style: theme.textTheme.titleMedium,
            ),
          ),
          const SizedBox(height: 8),
          if (_controller.loading) const LinearProgressIndicator(),
          if (_controller.receipts case final receipts?)
            if (receipts.isEmpty)
              const Text('暂无记录。')
            else
              for (final receipt in receipts) _receipt(receipt),
          if (_copyNotice ?? _controller.notice case final notice?)
            Semantics(liveRegion: true, child: Text(notice)),
          if (_controller.error case final error?)
            Semantics(
              liveRegion: true,
              child: Text(
                error,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
          if (_controller.next != null)
            OutlinedButton(
              onPressed: _controller.busy ? null : _controller.more,
              child: const UiText('加载更多'),
            ),
          TextButton(
            onPressed: _controller.busy ? null : _controller.refresh,
            child: const Text('刷新'),
          ),
        ],
      );
    },
  );
}
