import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';
import '../model/agreement_document.dart';
import '../model/bundled_agreements.dart';

class AgreementLink extends StatelessWidget {
  AgreementLink({
    super.key,
    required AgreementDocument document,
    this.compact = false,
  }) : _reader = AgreementDocumentPage.versioned(document);

  AgreementLink.bundled({
    super.key,
    required BundledAgreementDraft draft,
    this.compact = false,
  }) : _reader = AgreementDocumentPage.bundled(draft);

  final AgreementDocumentPage _reader;
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
    onPressed: () => Navigator.of(
      context,
    ).push<void>(MaterialPageRoute(builder: (_) => _reader)),
    child: Text('《${_reader.title}》'),
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

  factory AgreementDocumentPage.bundled(BundledAgreementDraft draft) =>
      AgreementDocumentPage(
        title: draft.title,
        sections: draft.sections,
        preview: true,
      );

  final String title;
  final List<AgreementSection> sections;
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
                    Text(
                      '${context.uiLabel('版本')} $current',
                      style: theme.textTheme.bodySmall,
                    ),
                  if (preview)
                    UiText('内测草案，未发布生效。', style: theme.textTheme.bodySmall),
                  if (sections.isEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 16),
                      child: UiText('暂无正文。'),
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
