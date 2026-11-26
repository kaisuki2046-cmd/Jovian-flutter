import 'package:material_ui/material_ui.dart';

import '../model/account_section.dart';

class AccountSectionLinks extends InheritedWidget {
  const AccountSectionLinks({
    super.key,
    required this.open,
    required super.child,
  });

  final Future<void> Function(AccountDestination) open;

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
