import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../social/social.dart';
import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';
import '../../history/view/archived_charts_page.dart';
import '../../history/view/reports_page.dart';
import 'profile_editor_page.dart';

class ProfileDashboard extends StatelessWidget {
  const ProfileDashboard({
    super.key,
    required this.account,
    required this.openSettings,
    this.openMessages,
    this.onUpgrade,
    this.active = true,
  });

  final AccountController account;
  final VoidCallback openSettings;
  final VoidCallback? openMessages;
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
      final member = memberId == null ? null : owner;
      final colors = Theme.of(context).colorScheme;
      void open(Widget page) => Navigator.of(
        context,
      ).push<void>(MaterialPageRoute(builder: (_) => page));
      final editProfile = member == null
          ? null
          : () => open(ProfileEditorPage(account: account, member: member));
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  colors.surfaceContainerLow,
                  colors.surfaceContainerLow,
                  colors.surface,
                ],
                stops: const [0, 0.48, 1],
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(22, 14, 22, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                spacing: 13,
                children: [
                  Align(
                    alignment: AlignmentDirectional.centerEnd,
                    child: IconButton.filledTonal(
                      tooltip: '设置',
                      onPressed: openSettings,
                      icon: const Icon(Icons.settings_outlined, size: 21),
                      style: IconButton.styleFrom(
                        fixedSize: const Size.square(44),
                        minimumSize: const Size.square(44),
                        backgroundColor: colors.primaryContainer,
                        foregroundColor: colors.onSurface,
                      ),
                    ),
                  ),
                  _Identity(
                    name:
                        owner?.displayName ??
                        (waiting || auth != null ? '账号与隐私' : '个人中心'),
                    uid: owner?.uid,
                    status: waiting
                        ? '正在确认当前账号…'
                        : needsAgreement
                        ? '请先确认最新协议。'
                        : owner == null && auth != null
                        ? '暂时无法确认账号与协议。'
                        : owner == null
                        ? '登录后可查看个人资料。'
                        : guest
                        ? 'UID · 登录后显示'
                        : owner.uid == null
                        ? 'UID 暂不可用'
                        : null,
                    bio: member?.bio,
                    editProfile: editProfile,
                    openAccount: guest ? onUpgrade : null,
                  ),
                  if (memberId != null)
                    _Relationships(
                      key: ValueKey((account, memberId)),
                      account: account,
                      memberId: memberId,
                      active: active,
                    )
                  else if (guest)
                    const _RelationshipRow(),
                  if (owner != null)
                    Row(
                      spacing: 7,
                      children: [
                        Expanded(
                          child: _Shortcut(
                            icon: Icons.description_outlined,
                            label: '我的报告',
                            onTap: () => open(ReportsPage(account: account)),
                          ),
                        ),
                        if (openMessages != null)
                          Expanded(
                            child: _Shortcut(
                              icon: Icons.people_outline,
                              label: '消息',
                              onTap: openMessages!,
                            ),
                          ),
                      ],
                    ),
                  if (needsAgreement)
                    FilledButton.tonal(
                      onPressed: openSettings,
                      child: const Text('前往设置确认协议'),
                    ),
                ],
              ),
            ),
          ),
          if (owner != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(22, 14, 22, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      '账户与资料',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.onSurfaceVariant,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  _ProfileSurface(
                    radius: 18,
                    child: Column(
                      children: [
                        if (editProfile != null) ...[
                          ListTile(
                            leading: const Icon(Icons.person_outline),
                            title: const Text('基础个人资料'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: editProfile,
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                        ],
                        ListTile(
                          leading: const Icon(Icons.auto_awesome_outlined),
                          title: const Text('命理档案'),
                          subtitle: const Text('查看已保存的命盘数据'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () =>
                              open(ArchivedChartsPage(account: account)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
        ],
      );
    },
  );
}

class _Identity extends StatelessWidget {
  const _Identity({
    required this.name,
    this.uid,
    this.status,
    this.bio,
    this.editProfile,
    this.openAccount,
  });

  final String name;
  final String? uid;
  final String? status;
  final String? bio;
  final VoidCallback? editProfile;
  final VoidCallback? openAccount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final publicUid = uid;
    final signature = bio;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 112),
      child: Row(
        spacing: 12,
        children: [
          Container(
            key: const ValueKey('profile-avatar'),
            width: 104,
            height: 104,
            alignment: Alignment.center,
            decoration: BoxDecoration(
              color: colors.primaryContainer,
              shape: BoxShape.circle,
              border: Border.all(color: colors.outlineVariant),
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  Icons.person_outline_rounded,
                  size: 43,
                  color: colors.primary,
                ),
                PositionedDirectional(
                  end: -4,
                  top: 1,
                  child: Icon(
                    Icons.auto_awesome,
                    size: 14,
                    color: colors.primary,
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 5,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    name.isEmpty ? '木星环用户' : name,
                    style: theme.textTheme.titleLarge?.copyWith(
                      fontSize: 22,
                      height: 28 / 22,
                      fontWeight: FontWeight.w600,
                    ),
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
                if (signature != null && editProfile != null)
                  InkWell(
                    onTap: editProfile,
                    borderRadius: BorderRadius.circular(6),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      child: Text(
                        signature.isEmpty ? '添加个性签名' : signature,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: signature.isEmpty
                              ? colors.onSurfaceVariant
                              : colors.onSurface,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (openAccount != null)
            Tooltip(
              message: '登录或注册账号',
              child: TextButton(
                onPressed: openAccount,
                style: TextButton.styleFrom(
                  minimumSize: const Size(44, 38),
                  padding: const EdgeInsets.symmetric(horizontal: 11),
                  backgroundColor: colors.primaryContainer,
                  foregroundColor: colors.onSurface,
                ),
                child: const Text('登录'),
              ),
            ),
        ],
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
          padding: const EdgeInsets.symmetric(vertical: 4),
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

class _ProfileSurface extends StatelessWidget {
  const _ProfileSurface({required this.radius, required this.child});

  final double radius;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final shape = RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radius),
      side: BorderSide(color: colors.outlineVariant),
    );
    return Material(
      color: Color.alphaBlend(
        colors.surface.withValues(alpha: .60),
        colors.surfaceContainerLow,
      ),
      shape: shape,
      elevation: 1,
      surfaceTintColor: Colors.transparent,
      shadowColor: colors.shadow.withValues(alpha: .20),
      clipBehavior: Clip.antiAlias,
      child: child,
    );
  }
}

class _Shortcut extends StatelessWidget {
  const _Shortcut({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => _ProfileSurface(
    radius: 14,
    child: InkWell(
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minHeight: 54),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 5, horizontal: 4),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            spacing: 3,
            children: [
              Icon(icon, size: 19),
              Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelMedium,
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _RelationshipRow extends StatelessWidget {
  const _RelationshipRow({this.counts, this.open});

  final SocialCounts? counts;
  final ValueChanged<SocialList>? open;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final openList = open;
    final style = TextButton.styleFrom(
      minimumSize: const Size(60, 44),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      backgroundColor: colors.primaryContainer,
      foregroundColor: colors.onSurface,
      disabledBackgroundColor: colors.primaryContainer,
      disabledForegroundColor: colors.onSurfaceVariant,
      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    );
    return Wrap(
      spacing: 12,
      runSpacing: 6,
      children: [
        for (final (direction, title, count) in [
          (SocialList.following, '关注', counts?.following),
          (SocialList.followers, '粉丝', counts?.followers),
        ])
          TextButton(
            style: style,
            onPressed: openList == null ? null : () => openList(direction),
            child: Text('$title ${count ?? '—'}'),
          ),
      ],
    );
  }
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
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _RelationshipRow(counts: counts, open: _open),
          if (snapshot.hasError)
            Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                const Text('暂时无法读取关注与粉丝数量。'),
                TextButton(onPressed: _refresh, child: const Text('重试')),
              ],
            ),
        ],
      );
    },
  );
}
