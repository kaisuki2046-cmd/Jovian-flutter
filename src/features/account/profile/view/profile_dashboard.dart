import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../../social/social.dart';
import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';
import '../../history/view/archived_charts_page.dart';
import '../../history/view/reports_page.dart';
import '../../model/account_section.dart';
import '../../view/account_section_links.dart';
import '../model/profile_details.dart';
import 'profile_avatar.dart';
import 'profile_editor_page.dart';
import 'profile_local_details.dart';

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
      final scope = owner?.scope;
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
      void open(AccountSection section, Widget Function() page) =>
          AccountSectionLinks.openPage(context, section, page);
      final editProfile = member == null
          ? null
          : () => open(
              AccountSection.profile,
              () => ProfileEditorPage(account: account, member: member),
            );
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
                      tooltip: context.uiLabel('设置'),
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
                  ProfileLocalDetails(
                    key: ValueKey((account, scope)),
                    account: account,
                    scope: scope,
                    builder: (context, details, edit) => Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      spacing: 13,
                      children: [
                        _Identity(
                          avatar: ProfileAvatar(account: account, scope: scope),
                          name: guest
                              ? context.uiLabel('访客')
                              : owner?.displayName ??
                                    context.uiLabel(
                                      waiting || auth != null
                                          ? '账号与隐私'
                                          : '个人中心',
                                    ),
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
                          signature: details?.signature,
                          editSignature: edit == null
                              ? null
                              : () => edit(ProfileDetailsTab.signature),
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
                        if (details != null && edit != null)
                          _ProfileTags(
                            details: details,
                            onEdit: () => edit(ProfileDetailsTab.tags),
                          ),
                      ],
                    ),
                  ),
                  if (owner != null)
                    IntrinsicHeight(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: 7,
                        children: [
                          Expanded(
                            child: _Shortcut(
                              icon: Icons.description_outlined,
                              label: '我的报告',
                              onTap: () => open(
                                AccountSection.reports,
                                () => ReportsPage(account: account),
                              ),
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
                    ),
                  if (needsAgreement)
                    FilledButton.tonal(
                      onPressed: openSettings,
                      child: const UiText('前往设置确认协议'),
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
                    child: UiText(
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
                            title: const UiText('基础个人资料'),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: editProfile,
                          ),
                          const Divider(height: 1, indent: 16, endIndent: 16),
                        ],
                        ListTile(
                          leading: const Icon(Icons.auto_awesome_outlined),
                          title: const UiText('命理档案'),
                          subtitle: const UiText('查看已保存的命盘数据'),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => open(
                            AccountSection.charts,
                            () => ArchivedChartsPage(account: account),
                          ),
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
    required this.avatar,
    this.uid,
    this.status,
    this.signature,
    this.editSignature,
    this.openAccount,
  });

  final String name;
  final Widget avatar;
  final String? uid;
  final String? status;
  final String? signature;
  final VoidCallback? editSignature;
  final VoidCallback? openAccount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    final publicUid = uid;
    final localSignature = signature;
    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 112),
      child: Row(
        spacing: 12,
        children: [
          avatar,
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              spacing: 5,
              children: [
                Semantics(
                  header: true,
                  child: Text(
                    name.isEmpty ? context.uiLabel('木星环用户') : name,
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
                  UiText(
                    text,
                    style: theme.textTheme.bodySmall?.copyWith(
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                if (localSignature != null && editSignature != null)
                  Tooltip(
                    message: context.uiLabel('编辑个性签名'),
                    child: InkWell(
                      onTap: editSignature,
                      borderRadius: BorderRadius.circular(6),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Text(
                          localSignature.isEmpty
                              ? context.uiLabel('添加个性签名')
                              : localSignature,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: theme.textTheme.bodySmall?.copyWith(
                            color: localSignature.isEmpty
                                ? colors.onSurfaceVariant
                                : colors.onSurface,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
          if (openAccount != null)
            Tooltip(
              message: context.uiLabel('登录或注册账号'),
              child: TextButton(
                onPressed: openAccount,
                style: TextButton.styleFrom(
                  minimumSize: const Size(44, 38),
                  padding: const EdgeInsets.symmetric(horizontal: 11),
                  backgroundColor: colors.primaryContainer,
                  foregroundColor: colors.onSurface,
                ),
                child: const UiText('登录'),
              ),
            ),
        ],
      ),
    );
  }
}

class _ProfileTags extends StatelessWidget {
  const _ProfileTags({required this.details, required this.onEdit});

  final LocalProfileDetails details;
  final VoidCallback onEdit;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final ink = theme.brightness == Brightness.dark
        ? const Color(0xffa6d9bd)
        : const Color(0xff285d45);
    final tags = ProfileTag.values.where(
      (tag) => details.tags[tag]?.isNotEmpty == true,
    );
    final style = TextButton.styleFrom(
      padding: const EdgeInsets.symmetric(horizontal: 11, vertical: 4),
      minimumSize: const Size(44, 32),
      backgroundColor: theme.colorScheme.primaryContainer,
      foregroundColor: ink,
      textStyle: theme.textTheme.bodySmall,
      shape: const StadiumBorder(),
    );
    return Wrap(
      spacing: 7,
      runSpacing: 5,
      children: [
        if (tags.isEmpty)
          TextButton.icon(
            onPressed: onEdit,
            style: style,
            icon: const Icon(Icons.add, size: 14),
            label: const UiText('添加标签'),
          ),
        for (final tag in tags)
          Tooltip(
            message: context
                .uiLabel('编辑{tag}标签')
                .replaceFirst('{tag}', context.uiLabel(tag.label)),
            child: TextButton(
              onPressed: onEdit,
              style: style,
              child: Text(
                details.tags[tag]!,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
      ],
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
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: UiText(notice)));
  }

  @override
  Widget build(BuildContext context) => Align(
    alignment: Alignment.centerLeft,
    child: MergeSemantics(
      child: Semantics(
        button: true,
        label: context.uiLabel('复制 UID {uid}').replaceFirst('{uid}', uid),
        child: Tooltip(
          excludeFromSemantics: true,
          message: context.uiLabel('复制 UID'),
          child: InkWell(
            onTap: () => _copy(context),
            onLongPress: () => _copy(context),
            borderRadius: BorderRadius.circular(8),
            child: ExcludeSemantics(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Wrap(
                  spacing: 6,
                  runSpacing: 2,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    Text(
                      'UID $uid',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const Icon(Icons.copy_outlined, size: 14),
                  ],
                ),
              ),
            ),
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
              UiText(
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
            child: Text('${context.uiLabel(title)} ${count ?? '—'}'),
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
    await AccountSectionLinks.openPage(
      context,
      direction == SocialList.following
          ? AccountSection.following
          : AccountSection.followers,
      () =>
          SocialConnectionsPage(account: widget.account, direction: direction),
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
                const UiText('暂时无法读取关注与粉丝数量。'),
                TextButton(onPressed: _refresh, child: const UiText('重试')),
              ],
            ),
        ],
      );
    },
  );
}
