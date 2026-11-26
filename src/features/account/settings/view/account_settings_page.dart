import 'package:material_ui/material_ui.dart';

import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';
import '../../auth/view/identity_preview_page.dart';
import '../../profile/view/profile_editor_page.dart';
import 'account_permissions.dart';
import '../../reading-profile/view/reading_profile_panel.dart';
import 'agreement_document_page.dart';

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

  Future<void> _chooseAppearance() async {
    final selected = await showDialog<ThemeMode>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('外观模式'),
        children: [
          for (final mode in ThemeMode.values)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, mode),
              child: Row(
                children: [
                  Expanded(child: Text(_modeLabel(mode))),
                  if (mode == _themeMode)
                    const Icon(Icons.check_rounded, semanticLabel: '当前选中'),
                ],
              ),
            ),
        ],
      ),
    );
    if (!mounted || selected == null || selected == _themeMode) return;
    widget.onThemeModeChanged?.call(selected);
    if (mounted)
      setState(() {
        _themeMode = selected;
      });
  }

  Future<void> _exit() async {
    final account = widget.account;
    final session = account.session;
    if (session == null || account.busy) return;
    final guest = session.kind == AccountKind.guest;
    final accepted = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(guest ? '结束游客体验' : '退出登录'),
        content: Text(
          guest ? '结束后将无法访问本次游客会话中的档案和报告。' : '退出后，可重新登录查看已保存的档案和报告。',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: Text(guest ? '确认结束' : '确认退出'),
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

  void _open(Widget page) =>
      Navigator.of(context).push<void>(MaterialPageRoute(builder: (_) => page));

  @override
  Widget build(BuildContext context) {
    final account = widget.account;
    return Scaffold(
      appBar: AppBar(title: const Text('设置')),
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
                      ProfileEditorPage(account: account, member: member),
                    ),
                  ),
                  const SizedBox(height: 9),
                ],
                _SettingsEntry(
                  title: '账户与安全',
                  subtitle: '查看登录方式',
                  icon: Icons.shield_outlined,
                  onTap: () => _open(AccountSecurityPage(account: account)),
                ),
                const SizedBox(height: 9),
                _SettingsEntry(
                  title: '隐私设置',
                  subtitle: '管理 AI 数据共享授权',
                  icon: Icons.privacy_tip_outlined,
                  onTap: () => _open(_PrivacyPage(account: account)),
                ),
                const SizedBox(height: 9),
                _SettingsEntry(
                  title: '协议与政策',
                  subtitle: '查看现行版本和确认记录',
                  icon: Icons.description_outlined,
                  onTap: () => _open(_AgreementsPage(account: account)),
                ),
                if (widget.onThemeModeChanged != null) ...[
                  const SizedBox(height: 16),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(4, 0, 4, 6),
                    child: Semantics(
                      header: true,
                      child: Text(
                        '偏好设置',
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ),
                  ),
                  _SettingsEntry(
                    title: '外观模式',
                    subtitle: _modeLabel(_themeMode),
                    icon: Icons.tonality_outlined,
                    onTap: _chooseAppearance,
                  ),
                ],
                const SizedBox(height: 12),
                _SettingsEntry(
                  title: '关于木星环',
                  subtitle: widget.appVersion.trim().isEmpty
                      ? '查看版本信息'
                      : '版本 ${widget.appVersion}',
                  icon: Icons.info_outline,
                  onTap: () => _open(_AboutPage(version: widget.appVersion)),
                ),
                if (account.notice case final message?) ...[
                  const SizedBox(height: 12),
                  Semantics(liveRegion: true, child: Text(message)),
                ],
                if (session != null) ...[
                  const SizedBox(height: 20),
                  OutlinedButton(
                    onPressed: account.busy ? null : _exit,
                    child: Text(guest ? '结束游客体验' : '退出登录'),
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
        title: Text(title, style: theme.textTheme.titleMedium),
        subtitle: subtitle == null ? null : Text(subtitle!),
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

class _PrivacyPage extends StatelessWidget {
  const _PrivacyPage({required this.account});

  final AccountController account;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('隐私设置')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            if (account.busy) const LinearProgressIndicator(),
            if (account.notice case final message?)
              Semantics(liveRegion: true, child: Text(message)),
            if (account.session == null || account.sessionChanging)
              const Text('登录或进入游客体验后可查看和管理授权。')
            else if (account.catalog != null && account.agreementState != null)
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
            if (account.memberId case final memberId?) ...[
              const SizedBox(height: 12),
              ReadingProfilePanel(
                key: ValueKey(memberId),
                account: account,
                owner: memberId,
                privacy: true,
              ),
            ],
          ],
        ),
      ),
    ),
  );
}

class _AgreementsPage extends StatelessWidget {
  const _AgreementsPage({required this.account});

  final AccountController account;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('协议与政策')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) {
          final catalog = account.catalog;
          final scoped = account.sessionChanging ? null : account.session;
          final accepted = scoped == null
              ? null
              : account.agreementState?.requiredAccepted;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              if (account.busy) const LinearProgressIndicator(),
              if (account.notice case final message?)
                Semantics(liveRegion: true, child: Text(message)),
              if (catalog != null)
                Card(
                  margin: EdgeInsets.zero,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        for (final document in [
                          catalog.terms,
                          catalog.privacy,
                          catalog.ai,
                        ])
                          AgreementLink(document: document),
                        if (accepted != null)
                          Padding(
                            padding: const EdgeInsets.all(8),
                            child: Text(accepted ? '已确认当前登录协议' : '尚未确认当前登录协议'),
                          ),
                        if (accepted == false)
                          TextButton(
                            onPressed: account.busy
                                ? null
                                : () async {
                                    final confirmed =
                                        await confirmAccountAgreements(
                                          context,
                                          catalog,
                                        );
                                    if (confirmed &&
                                        context.mounted &&
                                        account.session?.scope ==
                                            scoped!.scope &&
                                        !account.sessionChanging) {
                                      await account.acceptRequired(catalog);
                                    }
                                  },
                            child: const Text('确认新版登录协议'),
                          ),
                      ],
                    ),
                  ),
                )
              else if (!account.busy)
                TextButton(
                  onPressed: account.initialize,
                  child: const Text('重新加载协议'),
                ),
            ],
          );
        },
      ),
    ),
  );
}

class _AboutPage extends StatelessWidget {
  const _AboutPage({required this.version});

  final String version;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('关于木星环')),
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
                  Text('木星环', style: Theme.of(context).textTheme.titleLarge),
                  if (version.trim().isNotEmpty) Text('版本 $version'),
                  const SizedBox(height: 8),
                  const Text('测算与解读仅供自我探索和参考。', textAlign: TextAlign.center),
                ],
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
