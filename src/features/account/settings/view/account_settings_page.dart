import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../../social/social.dart';
import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';
import '../../auth/view/identity_preview_page.dart';
import '../../model/account_section.dart';
import '../../profile/view/profile_editor_page.dart';
import '../../profile/view/profile_preview_page.dart';
import '../../reading-profile/view/reading_profile_panel.dart';
import '../../view/account_section_links.dart';
import '../control/app_update_controller.dart';
import 'account_permissions.dart';
import 'agreements_page.dart';
import 'appearance_page.dart';
import 'app_update_host.dart';
import 'language_page.dart';
import 'privacy_rights_page.dart';

class AccountSettingsPage extends StatefulWidget {
  const AccountSettingsPage({
    super.key,
    required this.account,
    this.themeMode = ThemeMode.system,
    this.onThemeModeChanged,
    this.onSignedOut,
    this.appVersion = const String.fromEnvironment('APP_DISPLAY_VERSION'),
  });

  final AccountController account;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode>? onThemeModeChanged;
  final VoidCallback? onSignedOut;
  final String appVersion;

  @override
  State<AccountSettingsPage> createState() => _AccountSettingsPageState();
}

class _AccountSettingsPageState extends State<AccountSettingsPage> {
  late ThemeMode _themeMode = widget.themeMode;

  @override
  void didUpdateWidget(covariant AccountSettingsPage oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.themeMode != widget.themeMode) _themeMode = widget.themeMode;
  }

  void _openAppearance() => _open(
    AccountSection.appearance,
    () => AppearancePage(
      initialMode: _themeMode,
      onChanged: (mode) {
        if (!mounted) return;
        setState(() => _themeMode = mode);
        widget.onThemeModeChanged?.call(mode);
      },
    ),
  );

  Future<void> _exit() async {
    final account = widget.account;
    final session = account.session;
    if (session == null || account.busy) return;
    final guest = session.kind == AccountKind.guest;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: UiText(guest ? '结束游客体验' : '退出登录'),
        content: UiText(
          guest ? '结束后将无法访问本次游客会话中的档案和报告。' : '退出后，可重新登录查看已保存的档案和报告。',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const UiText('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: UiText(guest ? '确认结束' : '确认退出'),
          ),
        ],
      ),
    );
    if (!mounted ||
        accepted != true ||
        account.session?.scope != session.scope ||
        account.busy)
      return;
    await account.signOut();
    if (!mounted || account.session != null) return;
    final onSignedOut = widget.onSignedOut;
    Navigator.of(context).maybePop();
    onSignedOut?.call();
  }

  void _open(AccountSection section, Widget Function() page) =>
      AccountSectionLinks.openPage(context, section, page);

  @override
  Widget build(BuildContext context) {
    final account = widget.account;
    final version =
        AppUpdateScope.of(context)?.installed?.versionName ?? widget.appVersion;
    return Scaffold(
      appBar: AppBar(title: const UiText('设置')),
      body: SafeArea(
        top: false,
        child: ListenableBuilder(
          listenable: account,
          builder: (context, _) {
            final session = account.session;
            final guest = session?.kind == AccountKind.guest;
            return ListView(
              padding: const EdgeInsets.fromLTRB(22, 14, 22, 28),
              children: [
                if (account.authorizedSession case final member?
                    when member.kind == AccountKind.member) ...[
                  _SettingsEntry(
                    title: '基础个人资料',
                    icon: Icons.person_outline,
                    onTap: () => _open(
                      AccountSection.profile,
                      () => ProfileEditorPage(account: account, member: member),
                    ),
                  ),
                  const SizedBox(height: 9),
                ],
                _SettingsEntry(
                  title: '账户与安全',
                  subtitle: '查看登录方式',
                  icon: Icons.shield_outlined,
                  onTap: () => _open(
                    AccountSection.security,
                    () => AccountSecurityPage(account: account),
                  ),
                ),
                const SizedBox(height: 9),
                _SettingsEntry(
                  title: '隐私设置',
                  subtitle: '管理 AI 数据共享授权',
                  icon: Icons.privacy_tip_outlined,
                  onTap: () => _open(
                    AccountSection.privacy,
                    () => AccountPrivacyPage(account: account),
                  ),
                ),
                const SizedBox(height: 9),
                _SettingsEntry(
                  title: '协议与政策',
                  subtitle: '查看现行版本和确认记录',
                  icon: Icons.description_outlined,
                  onTap: () => _open(
                    AccountSection.agreements,
                    () => AccountAgreementsPage(account: account),
                  ),
                ),
                if (widget.onThemeModeChanged != null) ...[
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 0, 4, 6),
                    child: Semantics(
                      header: true,
                      child: UiText(
                        '偏好设置',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ),
                  ),
                  _SettingsEntry(
                    title: '外观模式',
                    subtitle: _modeLabel(_themeMode),
                    icon: Icons.tonality_outlined,
                    onTap: _openAppearance,
                  ),
                  const SizedBox(height: 9),
                  _SettingsEntry(
                    title: '语言',
                    subtitle: context.uiLanguage.displayName,
                    icon: Icons.language_outlined,
                    onTap: () =>
                        _open(AccountSection.language, LanguagePage.new),
                  ),
                ],
                const SizedBox(height: 12),
                _SettingsEntry(
                  title: '关于木星环',
                  subtitle: version.trim().isEmpty
                      ? '查看版本信息'
                      : '${context.uiLabel('版本')} $version',
                  icon: Icons.info_outline,
                  onTap: () => _open(
                    AccountSection.about,
                    () => AccountAboutPage(
                      account: account,
                      fallbackVersion: widget.appVersion,
                    ),
                  ),
                ),
                if (account.notice case final message?) ...[
                  const SizedBox(height: 12),
                  Semantics(liveRegion: true, child: UiText(message)),
                ],
                if (session != null) ...[
                  const SizedBox(height: 20),
                  OutlinedButton(
                    onPressed: account.busy ? null : _exit,
                    child: UiText(guest ? '结束游客体验' : '退出登录'),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }
}

class _SettingsEntry extends StatelessWidget {
  const _SettingsEntry({
    required this.title,
    this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String? subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final colors = theme.colorScheme;
    return Card(
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      child: ListTile(
        minTileHeight: 69,
        leading: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: colors.primaryContainer,
            borderRadius: BorderRadius.circular(13),
          ),
          alignment: Alignment.center,
          child: Icon(icon, color: colors.onSurface, size: 21),
        ),
        title: UiText(title, style: theme.textTheme.titleMedium),
        subtitle: subtitle == null ? null : UiText(subtitle!),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}

String _modeLabel(ThemeMode mode) => switch (mode) {
  ThemeMode.system => '跟随系统',
  ThemeMode.light => '浅色',
  ThemeMode.dark => '深色',
};

class AccountPrivacyPage extends StatelessWidget {
  const AccountPrivacyPage({
    super.key,
    required this.account,
    this.onlyAiPermissions = false,
  });

  final AccountController account;
  final bool onlyAiPermissions;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: UiText(onlyAiPermissions ? 'AI 数据共享授权' : '隐私设置')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) {
          final memberId = account.memberId;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (account.busy) const LinearProgressIndicator(),
              if (account.notice case final message?)
                Semantics(liveRegion: true, child: Text(message)),
              if (!onlyAiPermissions && memberId != null) ...[
                _SettingsEntry(
                  title: '个人信息权利',
                  icon: Icons.assignment_ind_outlined,
                  onTap: () => AccountSectionLinks.openPage(
                    context,
                    AccountSection.privacyRights,
                    () => PrivacyRightsPage(account: account, owner: memberId),
                  ),
                ),
                const SizedBox(height: 9),
                _SettingsEntry(
                  title: '预览他人可见内容',
                  icon: Icons.visibility_outlined,
                  onTap: () => AccountSectionLinks.openPage(
                    context,
                    AccountSection.profilePreview,
                    () => ProfilePreviewPage(account: account, owner: memberId),
                  ),
                ),
                _SettingsEntry(
                  title: '社交隐私',
                  icon: Icons.manage_accounts_outlined,
                  onTap: () => AccountSectionLinks.openPage(
                    context,
                    AccountSection.socialPrivacy,
                    () => SocialPrivacyPage(
                      controller: SocialController.forMember(account, memberId),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              if (account.session == null || account.sessionChanging)
                const Text('登录或进入游客体验后可查看和管理授权。')
              else if (account.catalog != null &&
                  account.agreementState != null)
                Card(
                  margin: EdgeInsets.zero,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: AccountPermissions(account: account),
                  ),
                )
              else if (!account.busy)
                TextButton(
                  onPressed: account.initialize,
                  child: const Text('重新加载授权状态'),
                ),
              if (!onlyAiPermissions && memberId != null) ...[
                const SizedBox(height: 12),
                ReadingProfilePanel(
                  key: ValueKey(memberId),
                  account: account,
                  owner: memberId,
                  privacy: true,
                ),
              ],
            ],
          );
        },
      ),
    ),
  );
}

class AccountAboutPage extends StatelessWidget {
  const AccountAboutPage({
    super.key,
    required this.account,
    this.fallbackVersion = const String.fromEnvironment('APP_DISPLAY_VERSION'),
  });

  final AccountController account;
  final String fallbackVersion;

  @override
  Widget build(BuildContext context) {
    final updates = AppUpdateScope.of(context);
    final version = updates?.installed?.versionName ?? fallbackVersion;
    final message = switch (updates?.manualStatus) {
      UpdateStatus.current => '当前已是最新版。',
      UpdateStatus.unpublished => '暂无适用于当前应用的版本信息。',
      UpdateStatus.failed => '暂时无法检查更新，请重试。',
      UpdateStatus.available => '发现新版，可再次检查并查看下载链接。',
      _ => null,
    };
    return Scaffold(
      appBar: AppBar(title: const UiText('关于木星环')),
      body: SafeArea(
        top: false,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              margin: EdgeInsets.zero,
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  children: [
                    Icon(
                      Icons.auto_awesome_outlined,
                      size: 42,
                      color: Theme.of(context).colorScheme.primary,
                    ),
                    const SizedBox(height: 12),
                    UiText(
                      '木星环',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    if (version.trim().isNotEmpty) Text('版本 $version'),
                    if (updates case final checker? when checker.canCheck) ...[
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: checker.manualStatus == UpdateStatus.checking
                            ? null
                            : () => checker.check(manual: true),
                        child: Text(
                          checker.manualStatus == UpdateStatus.checking
                              ? '正在检查…'
                              : '检查更新',
                        ),
                      ),
                    ],
                    if (message != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Semantics(
                          container: true,
                          liveRegion: true,
                          child: Text(message, textAlign: TextAlign.center),
                        ),
                      ),
                    const SizedBox(height: 8),
                    const UiText(
                      '测算与解读仅供自我探索和参考。',
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 12),
            _SettingsEntry(
              title: '协议与政策',
              icon: Icons.description_outlined,
              onTap: () => AccountSectionLinks.openPage(
                context,
                AccountSection.agreements,
                () => AccountAgreementsPage(account: account),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
