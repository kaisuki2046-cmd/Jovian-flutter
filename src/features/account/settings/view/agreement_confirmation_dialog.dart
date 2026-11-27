import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';
import '../../../compliance/agreements.dart';
import '../model/agreements.dart';

Future<bool> confirmAccountAgreements(
  BuildContext context,
  AgreementCatalog catalog,
) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        scrollable: true,
        title: const UiText('请确认登录协议'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const UiText('请阅读并同意以下协议后继续。'),
            AgreementLink(document: catalog.terms),
            AgreementLink(document: catalog.privacy),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const UiText('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const UiText('同意并继续'),
          ),
        ],
      ),
    ) ==
    true;
