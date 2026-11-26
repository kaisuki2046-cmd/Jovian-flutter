import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../social/social.dart';
import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';
import '../../history/view/archived_charts_page.dart';
import '../../history/view/reports_page.dart';

class ProfileDashboard extends StatelessWidget {
  const ProfileDashboard({
    super.key,
    required this.account,
    required this.openSettings,
    this.onUpgrade,
    this.active = true,
  });

  final AccountController account;
  final VoidCallback openSettings;
  final VoidCallback? onUpgrade;
  final bool active;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: account,
    builder: (context, _) {
      final owner = account.sessionChanging ? null : account.authorizedSession;
      final auth = account.session;
      final waiting =
          account.sessionChanging || (!account.restored && account.busy);
      final needsAgreement =
          !waiting &&
          auth != null &&
          account.agreementState?.requiredAccepted == false;
      final guest = owner?.kind == AccountKind.guest;
      final memberId = account.socialMemberId;
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ProfileCard(
            name:
                owner?.displayName ??
                (waiting || auth != null ? '账号与隐私' : '个人中心'),
            uid: owner?.uid,
            openSettings: openSettings,
            status: waiting
                ? '正在确认当前账号…'
                : needsAgreement
                ? '请先确认最新协议。'
                : owner == null && auth != null
                ? '暂时无法确认账号与协议。'
                : owner == null
                ? '登录后可查看个人资料。'
                : guest
                ? '当前为游客会话'
                : owner.uid == null
                ? 'UID 暂不可用'
                : null,
            openAccount: guest ? onUpgrade : null,
          ),
          if (memberId != null) ...[
            const SizedBox(height: 12),
            _Relationships(
              key: ValueKey((account, memberId)),
              account: account,
              memberId: memberId,
              active: active,
            ),
          ],
          if (owner != null) ...[
            const SizedBox(height: 12),
            Card(
              margin: EdgeInsets.zero,
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.article_outlined),
                    title: const Text('我的报告'),
                    subtitle: const Text('查看已保存的解读'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push<void>(
                      MaterialPageRoute(
                        builder: (_) => ReportsPage(account: account),
                      ),
                    ),
                  ),
                  const Divider(height: 1, indent: 16, endIndent: 16),
                  ListTile(
                    leading: const Icon(Icons.folder_outlined),
                    title: const Text('命理档案'),
                    subtitle: const Text('查看已保存的命盘数据'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).push<void>(
                      MaterialPageRoute(
                        builder: (_) => ArchivedChartsPage(account: account),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (needsAgreement) ...[
            const SizedBox(height: 12),
            FilledButton.tonal(
              onPressed: openSettings,
              child: const Text('前往设置确认协议'),
            ),
          ],
        ],
      );
    },
  );
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({
    required this.name,
    required this.openSettings,
    this.uid,
    this.status,
    this.openAccount,
  });

  final String name;
  final String? uid;
  final String? status;
  final VoidCallback openSettings;
  final VoidCallback? openAccount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final publicUid = uid;
    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(18, 16, 12, 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 28,
                  backgroundColor: colors.primaryContainer,
                  foregroundColor: colors.onPrimaryContainer,
                  child: const Icon(Icons.person_outline_rounded, size: 30),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Semantics(
                        header: true,
                        child: Text(
                          name.isEmpty ? '木星环用户' : name,
                          style: theme.textTheme.titleLarge,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                      if (publicUid != null) _CopyUid(uid: publicUid),
                      if (status case final text?)
                        Text(
                          text,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: colors.onSurfaceVariant,
                          ),
                        ),
                    ],
                  ),
                ),
                IconButton(
                  tooltip: '设置',
                  onPressed: openSettings,
                  icon: const Icon(Icons.settings_outlined),
                ),
              ],
            ),
            if (openAccount != null) ...[
              const SizedBox(height: 12),
              FilledButton.tonal(
                onPressed: openAccount,
                child: const Text('登录或注册账号'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _CopyUid extends StatelessWidget {
  const _CopyUid({required this.uid});

  final String uid;

  Future<void> _copy(BuildContext context) async {
    var notice = 'UID 已复制';
    try {
      await Clipboard.setData(ClipboardData(text: uid));
    } on PlatformException {
      notice = '暂时无法复制 UID，请重试。';
    }
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(notice)));
  }

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: Tooltip(
      message: '复制 UID',
      child: InkWell(
        onTap: () => _copy(context),
        onLongPress: () => _copy(context),
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Wrap(
            spacing: 6,
            runSpacing: 2,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text('UID $uid', style: Theme.of(context).textTheme.bodySmall),
              const Icon(Icons.copy_outlined, size: 14),
            ],
          ),
        ),
      ),
    ),
  );
}

class _Relationships extends StatefulWidget {
  const _Relationships({
    super.key,
    required this.account,
    required this.memberId,
    required this.active,
  });

  final AccountController account;
  final String memberId;
  final bool active;

  @override
  State<_Relationships> createState() => _RelationshipsState();
}

class _RelationshipsState extends State<_Relationships> {
  late Future<SocialCounts> _counts = _load();

  Future<SocialCounts> _load() =>
      SocialController.forMember(widget.account, widget.memberId).counts();

  void _refresh() {
    final counts = _load();
    setState(() {
      _counts = counts;
    });
  }

  @override
  void didUpdateWidget(covariant _Relationships oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.active && widget.active) _counts = _load();
  }

  Future<void> _open(SocialList direction) async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => SocialConnectionsPage(
          account: widget.account,
          direction: direction,
        ),
      ),
    );
    if (mounted && widget.account.socialMemberId == widget.memberId) _refresh();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<SocialCounts>(
    future: _counts,
    builder: (context, snapshot) {
      final counts = snapshot.hasError ? null : snapshot.data;
      return Card(
        margin: EdgeInsets.zero,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 10),
              child: Row(
                children: [
                  Expanded(
                    child: TextButton.icon(
                      onPressed: () => _open(SocialList.following),
                      icon: const Icon(Icons.person_add_alt_outlined),
                      label: Text('关注 ${counts?.following ?? '—'}'),
                    ),
                  ),
                  const SizedBox(height: 28, child: VerticalDivider(width: 1)),
                  Expanded(
                    child: TextButton.icon(
                      onPressed: () => _open(SocialList.followers),
                      icon: const Icon(Icons.group_outlined),
                      label: Text('粉丝 ${counts?.followers ?? '—'}'),
                    ),
                  ),
                ],
              ),
            ),
            if (snapshot.connectionState == ConnectionState.waiting &&
                counts == null)
              const LinearProgressIndicator(),
            if (snapshot.hasError)
              ListTile(
                title: const Text('暂时无法读取关注与粉丝数量。'),
                trailing: TextButton(
                  onPressed: _refresh,
                  child: const Text('重试'),
                ),
              ),
          ],
        ),
      );
    },
  );
}
