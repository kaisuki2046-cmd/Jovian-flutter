import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../auth/control/account_controller.dart';
import '../model/agreements.dart';
import '../../../compliance/agreements.dart';
import 'agreement_confirmation_dialog.dart';

class AccountPermissions extends StatelessWidget {
  const AccountPermissions({super.key, required this.account});

  final AccountController account;

  @override
  Widget build(BuildContext context) {
    final catalog = account.catalog;
    final state = account.agreementState;
    if (catalog == null || state == null) return const SizedBox.shrink();
    final scope = account.session?.scope;
    bool isCurrent() =>
        context.mounted &&
        scope != null &&
        !account.sessionChanging &&
        account.session?.scope == scope &&
        identical(account.catalog, catalog);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        UiText('隐私与授权', style: Theme.of(context).textTheme.titleMedium),
        Wrap(
          children: [
            AgreementLink(document: catalog.terms),
            AgreementLink(document: catalog.privacy),
            AgreementLink(document: catalog.ai),
          ],
        ),
        if (!state.requiredAccepted)
          TextButton(
            onPressed: account.busy
                ? null
                : () async {
                    if (await confirmAccountAgreements(context, catalog) &&
                        isCurrent()) {
                      await account.acceptRequired(catalog);
                    }
                  },
            child: const UiText('确认新版登录协议'),
          ),
        if (state.requiredAccepted && !state.allAiGranted)
          TextButton(
            onPressed: account.busy
                ? null
                : () async {
                    if (await _confirmAi(context, catalog.ai, '全部 AI 在线解读') &&
                        isCurrent()) {
                      await account.grantAll(catalog.ai);
                    }
                  },
            child: const UiText('查看告知并授权全部'),
          ),
        for (final MapEntry(:key, :value) in aiPurposes.entries)
          SwitchListTile(
            title: UiText(value),
            contentPadding: EdgeInsets.zero,
            value: state.permissions[key] == true,
            onChanged:
                account.busy ||
                    (!state.requiredAccepted && state.permissions[key] != true)
                ? null
                : (agreed) async {
                    if (agreed &&
                        !await _confirmAi(context, catalog.ai, value)) {
                      return;
                    }
                    if (isCurrent())
                      await account.choose(catalog.ai, key, agreed);
                  },
          ),
      ],
    );
  }

  Future<bool> _confirmAi(
    BuildContext context,
    AgreementDocument document,
    String purpose,
  ) async {
    final purposeLabel = context.uiLabel(purpose);
    return await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            scrollable: true,
            title: const UiText('确认 AI 授权'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  context.uiLanguage == InterfaceLanguage.english
                      ? 'Allow $purposeLabel to process the required data. You can revoke this permission at any time.'
                      : '开启后，可为「$purpose」处理所需资料。授权可随时撤回。',
                ),
                AgreementLink(document: document),
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const UiText('取消'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const UiText('同意授权'),
              ),
            ],
          ),
        ) ==
        true;
  }
}
