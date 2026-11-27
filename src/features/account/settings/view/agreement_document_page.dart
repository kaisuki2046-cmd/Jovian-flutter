import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

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
        builder: (_) => AgreementDocumentPage.versioned(document),
      ),
    ),
    child: Text('《${document.title}》'),
  );
}

class AgreementDocumentPage extends StatelessWidget {
  const AgreementDocumentPage({
    super.key,
    required this.title,
    required this.sections,
    required this.preview,
    this.version,
  });

  factory AgreementDocumentPage.versioned(AgreementDocument document) =>
      AgreementDocumentPage(
        title: document.title,
        sections: document.sections,
        version: document.version,
        preview: document.preview,
      );

  final String title;
  final List<({String title, String text})> sections;
  final bool preview;
  final String? version;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SafeArea(
        top: false,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: SelectionArea(
              child: ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  if (version case final current?)
                    Text('版本 $current', style: theme.textTheme.bodySmall),
                  if (preview)
                    UiText('内测草案，未发布生效。', style: theme.textTheme.bodySmall),
                  if (sections.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 16),
                      child: Text('暂无正文。'),
                    ),
                  for (final section in sections) ...[
                    const SizedBox(height: 16),
                    Semantics(
                      header: true,
                      child: Text(
                        section.title,
                        style: theme.textTheme.titleMedium,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(section.text),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
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
