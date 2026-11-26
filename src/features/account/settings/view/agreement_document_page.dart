import 'package:material_ui/material_ui.dart';

import '../model/agreements.dart';

class AgreementLink extends StatelessWidget {
  const AgreementLink({
    super.key,
    required this.document,
    this.compact = false,
  });

  final AgreementDocument document;
  final bool compact;

  @override
  Widget build(BuildContext context) => TextButton(
    style: compact
        ? TextButton.styleFrom(
            minimumSize: const Size(0, 36),
            padding: const EdgeInsets.symmetric(horizontal: 2),
            textStyle: Theme.of(context).textTheme.bodySmall,
          )
        : null,
    onPressed: () => Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => Scaffold(
          appBar: AppBar(title: Text(document.title)),
          body: SafeArea(
            top: false,
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                Text(
                  '${document.preview ? '预览 · ' : ''}版本 ${document.version}',
                ),
                for (final section in document.sections) ...[
                  const SizedBox(height: 16),
                  Text(
                    section.title,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 8),
                  SelectableText(section.text),
                ],
              ],
            ),
          ),
        ),
      ),
    ),
    child: Text('《${document.title}》'),
  );
}

Future<bool> confirmAccountAgreements(
  BuildContext context,
  AgreementCatalog catalog,
) async =>
    await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('请确认登录协议'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('请阅读并同意以下协议后继续。'),
              AgreementLink(document: catalog.terms),
              AgreementLink(document: catalog.privacy),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('同意并继续'),
          ),
        ],
      ),
    ) ==
    true;
