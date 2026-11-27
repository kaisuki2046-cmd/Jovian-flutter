import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../../../ui/theme.dart';
import '../../../compliance/agreements.dart';
import '../../auth/control/account_controller.dart';
import '../model/agreements.dart';
import 'agreement_confirmation_dialog.dart';

class AccountAgreementsPage extends StatelessWidget {
  const AccountAgreementsPage({super.key, required this.account});

  final AccountController account;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const UiText('协议与政策')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) {
          final catalog = account.catalog;
          final scope = account.sessionChanging ? null : account.session?.scope;
          final state = scope == null ? null : account.agreementState;
          return ListView(
            padding: jovianPagePadding,
            children: [
              if (account.busy) const LinearProgressIndicator(),
              if (account.notice case final message?)
                Semantics(liveRegion: true, child: Text(message)),
              if (catalog == null && !account.busy)
                TextButton(
                  onPressed: account.initialize,
                  child: const Text('重新加载协议'),
                ),
              if (catalog != null && scope != null && state != null)
                Card(
                  child: ListTile(
                    title: Text(
                      state.requiredAccepted ? '已确认当前登录协议' : '尚未确认当前登录协议',
                    ),
                    subtitle: state.requiredAccepted
                        ? null
                        : Align(
                            alignment: Alignment.centerLeft,
                            child: TextButton(
                              onPressed: account.busy
                                  ? null
                                  : () => _confirm(context, catalog, scope),
                              child: const Text('确认新版登录协议'),
                            ),
                          ),
                  ),
                ),
              if (scope != null &&
                  state != null &&
                  state.confirmations.isNotEmpty)
                Card(
                  child: ExpansionTile(
                    title: const Text('协议确认记录'),
                    children: [
                      for (final confirmation in state.confirmations)
                        ListTile(
                          title: Text(
                            _agreementTitle(confirmation.id, catalog),
                          ),
                          subtitle: Text(
                            _confirmationLabel(context, confirmation),
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.of(context).push<void>(
                            MaterialPageRoute(
                              builder: (_) => _ConfirmedAgreementReader(
                                account: account,
                                scope: scope,
                                confirmation: confirmation,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              AgreementDirectory(catalog: catalog),
            ],
          );
        },
      ),
    ),
  );

  Future<void> _confirm(
    BuildContext context,
    AgreementCatalog catalog,
    String scope,
  ) async {
    final confirmed = await confirmAccountAgreements(context, catalog);
    if (confirmed &&
        context.mounted &&
        account.session?.scope == scope &&
        !account.sessionChanging) {
      await account.acceptRequired(catalog);
    }
  }
}

String _agreementTitle(String id, AgreementCatalog? catalog) => id == 'privacy'
    ? catalog?.privacy.title ?? '隐私政策'
    : catalog?.terms.title ?? '用户服务协议';

String _confirmationLabel(BuildContext context, AgreementConfirmation record) {
  final date = MaterialLocalizations.of(
    context,
  ).formatMediumDate(record.decidedAt.toLocal());
  return '版本 ${record.version} · $date';
}

class AgreementDirectory extends StatelessWidget {
  const AgreementDirectory({super.key, required this.catalog});

  final AgreementCatalog? catalog;

  @override
  Widget build(BuildContext context) {
    final documents = {
      if (catalog case final current?) ...{
        'terms': current.terms,
        'privacy': current.privacy,
        'ai': current.ai,
      },
    };
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: [
          for (final id in agreementDirectoryOrder)
            if (documents[id] case final document?)
              _DirectoryLink(reader: AgreementDocumentPage.versioned(document))
            else if (bundledAgreementDrafts[id] case final draft?)
              _DirectoryLink(reader: AgreementDocumentPage.bundled(draft)),
        ],
      ),
    );
  }
}

class _DirectoryLink extends StatelessWidget {
  const _DirectoryLink({required this.reader});

  final AgreementDocumentPage reader;

  @override
  Widget build(BuildContext context) {
    final version = reader.version;
    return ListTile(
      title: Text('《${reader.title}》'),
      subtitle: Text(
        [
          if (reader.preview) '内测草案',
          if (version != null) '版本 $version',
        ].join(' · '),
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => Navigator.of(
        context,
      ).push<void>(MaterialPageRoute(builder: (_) => reader)),
    );
  }
}

class _ConfirmedAgreementReader extends StatefulWidget {
  const _ConfirmedAgreementReader({
    required this.account,
    required this.scope,
    required this.confirmation,
  });

  final AccountController account;
  final String scope;
  final AgreementConfirmation confirmation;

  @override
  State<_ConfirmedAgreementReader> createState() =>
      _ConfirmedAgreementReaderState();
}

class _ConfirmedAgreementReaderState extends State<_ConfirmedAgreementReader> {
  final _cancel = Completer<void>();
  late Future<AgreementDocument> _document = _read();

  Future<AgreementDocument> _read() => widget.account.readConfirmedAgreement(
    widget.scope,
    widget.confirmation,
    cancel: _cancel.future,
  );

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: widget.account,
    builder: (context, _) {
      final account = widget.account;
      if (account.sessionChanging || account.session?.scope != widget.scope) {
        return _status(const Text('会话已变化，请返回后重新读取。'));
      }
      return FutureBuilder<AgreementDocument>(
        future: _document,
        builder: (context, snapshot) {
          if (snapshot.connectionState != ConnectionState.done) {
            return _status(const CircularProgressIndicator());
          }
          if (snapshot.data case final document?) {
            return AgreementDocumentPage.versioned(document);
          }
          return _status(
            Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text('暂时无法打开此协议版本。'),
                TextButton(
                  onPressed: () {
                    final document = _read();
                    setState(() {
                      _document = document;
                    });
                  },
                  child: const UiText('重试读取'),
                ),
              ],
            ),
          );
        },
      );
    },
  );

  Widget _status(Widget child) => Scaffold(
    appBar: AppBar(title: const Text('协议确认记录')),
    body: Center(child: child),
  );

  @override
  void dispose() {
    _cancel.complete();
    super.dispose();
  }
}
