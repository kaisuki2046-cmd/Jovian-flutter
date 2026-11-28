import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import '../../../ui/theme.dart';
import '../../social/social.dart';
import '../auth/control/account_controller.dart';
import '../auth/view/account_deletion_page.dart';
import '../auth/view/identity_preview_page.dart';
import '../auth/view/password_security_page.dart';
import '../auth/view/phone_security_page.dart';
import '../history/view/archived_charts_page.dart';
import '../history/view/personal_report_page.dart';
import '../model/account_section.dart';
import '../profile/view/profile_editor_page.dart';
import '../profile/view/profile_preview_page.dart';
import '../settings/view/account_settings_page.dart';
import '../settings/view/agreements_page.dart';
import '../settings/view/appearance_page.dart';
import '../settings/view/language_page.dart';
import '../settings/view/privacy_rights_page.dart';

class AccountSectionPage extends StatelessWidget {
  const AccountSectionPage({
    super.key,
    required this.account,
    required this.target,
    required this.themeMode,
    required this.onThemeModeChanged,
    required this.openAccount,
    this.onFollowerAlertRead,
  });

  final AccountController? account;
  final AccountDestination target;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode> onThemeModeChanged;
  final VoidCallback openAccount;
  final VoidCallback? onFollowerAlertRead;

  @override
  Widget build(BuildContext context) {
    final current = account;
    if (current == null) {
      return _unavailable(
        '账号服务暂不可用。',
        title: target.section == AccountSection.newFollowers ? '新增粉丝' : '个人中心',
      );
    }
    return ListenableBuilder(
      listenable: current,
      builder: (context, _) => KeyedSubtree(
        key: ValueKey(current.authorizedSession?.scope),
        child: _section(current),
      ),
    );
  }

  Widget _section(AccountController account) {
    switch (target.section) {
      case AccountSection.settings:
        return AccountSettingsPage(
          account: account,
          themeMode: themeMode,
          onThemeModeChanged: onThemeModeChanged,
        );
      case AccountSection.security:
        return account.memberId == null
            ? _unavailable('登录后可管理账户安全。', signIn: openAccount)
            : AccountSecurityPage(account: account);
      case AccountSection.privacy:
        return AccountPrivacyPage(account: account);
      case AccountSection.aiPermissions:
        return AccountPrivacyPage(account: account, onlyAiPermissions: true);
      case AccountSection.agreements:
        return AccountAgreementsPage(account: account);
      case AccountSection.appearance:
        return AppearancePage(
          initialMode: themeMode,
          onChanged: onThemeModeChanged,
        );
      case AccountSection.language:
        return const LanguagePage();
      case AccountSection.about:
        return AccountAboutPage(account: account);
      case AccountSection.charts:
        return ArchivedChartsPage(account: account);
      case AccountSection.reports:
        return PersonalReportPage(account: account);
      default:
        final owner = account.memberId;
        if (owner == null) {
          final (title, message) = switch (target.section) {
            AccountSection.findUser => ('找用户', '登录后可按 UID 或昵称找用户。'),
            AccountSection.newFollowers => ('新增粉丝', '登录后查看当前账户的消息'),
            AccountSection.socialReports => ('我的举报', '登录后查看当前账户的消息'),
            AccountSection.socialModeration => ('举报处理', '登录后查看当前账户的消息'),
            _ => ('个人中心', '登录后可查看此页面。'),
          };
          return _unavailable(message, title: title, signIn: openAccount);
        }
        return _memberSection(account, owner);
    }
  }

  Widget _memberSection(AccountController account, String owner) =>
      switch (target.section) {
        AccountSection.phone => PhoneSecurityPage(
          account: account,
          owner: owner,
        ),
        AccountSection.password => PasswordSecurityPage(
          account: account,
          owner: owner,
        ),
        AccountSection.identity => IdentityPreviewPage(
          account: account,
          memberId: owner,
        ),
        AccountSection.deletion =>
          account.deletion == null
              ? _unavailable('账号注销服务暂不可用。')
              : AccountDeletionPage(account: account, owner: owner),
        AccountSection.profile => ProfileEditorPage(
          account: account,
          member: account.authorizedSession!,
        ),
        AccountSection.privacyRights => PrivacyRightsPage(
          account: account,
          owner: owner,
        ),
        AccountSection.profilePreview => ProfilePreviewPage(
          account: account,
          owner: owner,
        ),
        AccountSection.socialPrivacy => SocialPrivacyPage(
          controller: SocialController.forMember(account, owner),
        ),
        AccountSection.following ||
        AccountSection.followers => SocialConnectionsPage(
          account: account,
          direction: target.section == AccountSection.following
              ? SocialList.following
              : SocialList.followers,
        ),
        AccountSection.findUser => SocialSearchPage(
          controller: SocialController.forMember(account, owner),
        ),
        AccountSection.newFollowers => FollowerAlertsPage(
          controller: SocialController.forMember(account, owner),
          onRead: onFollowerAlertRead,
        ),
        AccountSection.socialReports ||
        AccountSection.socialModeration => SocialReportsPage(
          controller: SocialController.forMember(account, owner),
          moderation: target.section == AccountSection.socialModeration,
        ),
        AccountSection.socialProfile =>
          target.profileId == null
              ? _unavailable('找不到该用户。')
              : SocialProfilePage(
                  controller: SocialController.forMember(account, owner),
                  id: target.profileId!,
                ),
        _ => throw StateError(
          'Account section already resolved: ${target.section.slug}',
        ),
      };

  Widget _unavailable(
    String message, {
    VoidCallback? signIn,
    String title = '个人中心',
  }) => Scaffold(
    appBar: AppBar(title: UiText(title)),
    body: ListView(
      padding: jovianPagePadding,
      children: [
        UiText(message),
        if (signIn != null)
          TextButton(onPressed: signIn, child: const UiText('前往登录')),
      ],
    ),
  );
}
