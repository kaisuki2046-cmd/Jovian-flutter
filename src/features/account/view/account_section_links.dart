import 'package:material_ui/material_ui.dart';

import '../model/account_section.dart';

typedef AccountLeaveGuard = Future<bool> Function();

class AccountSectionLinks extends InheritedWidget {
  const AccountSectionLinks({
    super.key,
    required this.open,
    this.protectFromHistory,
    required super.child,
  });

  final Future<void> Function(AccountDestination) open;
  final VoidCallback Function(AccountDestination, AccountLeaveGuard)?
  protectFromHistory;

  static VoidCallback? registerLeaveGuard(
    BuildContext context,
    AccountLeaveGuard guard,
  ) {
    final links = context.getInheritedWidgetOfExactType<AccountSectionLinks>();
    final settings = ModalRoute.of(context)?.settings;
    if (settings case Page(
      key: ValueKey<AccountDestination>(value: final target),
    )) {
      return links?.protectFromHistory?.call(target, guard);
    }
    return null;
  }

  static Future<void> openPage(
    BuildContext context,
    AccountSection section,
    Widget Function() build, {
    String? profileId,
  }) {
    final links = context.getInheritedWidgetOfExactType<AccountSectionLinks>();
    if (links != null) {
      return links.open(accountDestination(section, profileId: profileId));
    }
    return Navigator.of(
      context,
    ).push<void>(MaterialPageRoute(builder: (_) => build()));
  }

  @override
  bool updateShouldNotify(AccountSectionLinks oldWidget) => false;
}
