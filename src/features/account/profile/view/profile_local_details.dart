import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../auth/control/account_controller.dart';
import '../model/profile_details.dart';
import '../model/profile_details_store.dart';

enum ProfileDetailsTab { signature, tags }

class ProfileLocalDetails extends StatefulWidget {
  const ProfileLocalDetails({
    super.key,
    required this.account,
    required this.scope,
    required this.builder,
  });

  final AccountController account;
  final String? scope;
  final Widget Function(
    BuildContext context,
    LocalProfileDetails? details,
    ValueChanged<ProfileDetailsTab>? edit,
  )
  builder;

  @override
  State<ProfileLocalDetails> createState() => _ProfileLocalDetailsState();
}

class _ProfileLocalDetailsState extends State<ProfileLocalDetails> {
  late Future<LocalProfileDetails>? _details = _read();
  bool _editing = false;

  Future<LocalProfileDetails>? _read() {
    final scope = widget.scope;
    return scope == null ? null : const LocalProfileDetailsStore().read(scope);
  }

  @override
  void didUpdateWidget(covariant ProfileLocalDetails oldWidget) {
    super.didUpdateWidget(oldWidget);
    if ((widget.account, widget.scope) !=
        (oldWidget.account, oldWidget.scope)) {
      _details = _read();
    }
  }

  Future<void> _edit(
    String scope,
    LocalProfileDetails details,
    ProfileDetailsTab tab,
  ) async {
    final account = widget.account;
    if (_editing || !_ownsScope(account, scope)) return;
    _editing = true;
    try {
      final updated = await showDialog<LocalProfileDetails>(
        context: context,
        barrierDismissible: false,
        builder: (_) => _DetailsEditor(
          account: account,
          scope: scope,
          initial: details,
          tab: tab,
        ),
      );
      if (!mounted || updated == null || !_ownsScope(account, scope)) return;
      setState(() {
        _details = Future.value(updated);
      });
    } finally {
      _editing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final scope = widget.scope;
    final current = scope != null && _ownsScope(widget.account, scope);
    return FutureBuilder<LocalProfileDetails>(
      future: current ? _details : null,
      builder: (context, snapshot) {
        final details = current ? snapshot.data : null;
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            widget.builder(
              context,
              details,
              details == null || scope == null
                  ? null
                  : (tab) => _edit(scope, details, tab),
            ),
            if (current && snapshot.hasError)
              Align(
                alignment: AlignmentDirectional.centerStart,
                child: TextButton(
                  onPressed: () => setState(() {
                    _details = _read();
                  }),
                  child: const Text('无法读取本机签名和标签，点击重试'),
                ),
              ),
          ],
        );
      },
    );
  }
}

bool _ownsScope(AccountController account, String scope) =>
    !account.sessionChanging && account.authorizedSession?.scope == scope;

class _DetailsEditor extends StatefulWidget {
  const _DetailsEditor({
    required this.account,
    required this.scope,
    required this.initial,
    required this.tab,
  });

  final AccountController account;
  final String scope;
  final LocalProfileDetails initial;
  final ProfileDetailsTab tab;

  @override
  State<_DetailsEditor> createState() => _DetailsEditorState();
}

class _DetailsEditorState extends State<_DetailsEditor> {
  late final _signature = TextEditingController(text: widget.initial.signature);
  late final _tags = {
    for (final tag in ProfileTag.values)
      tag: TextEditingController(text: widget.initial.tags[tag]),
  };
  bool _saving = false;
  bool _invalidated = false;
  bool _failed = false;

  bool get _isSignature => widget.tab == ProfileDetailsTab.signature;
  bool get _current =>
      mounted && !_invalidated && _ownsScope(widget.account, widget.scope);

  @override
  void initState() {
    super.initState();
    widget.account.addListener(_checkScope);
  }

  @override
  void dispose() {
    widget.account.removeListener(_checkScope);
    _signature.dispose();
    for (final field in _tags.values) {
      field.dispose();
    }
    super.dispose();
  }

  void _checkScope() {
    if (_invalidated || _ownsScope(widget.account, widget.scope)) return;
    setState(() => _invalidated = true);
    FocusManager.instance.primaryFocus?.unfocus();
  }

  Future<void> _save() async {
    if (!_current || _saving) return;
    setState(() {
      _saving = true;
      _failed = false;
    });
    try {
      final saved = await const LocalProfileDetailsStore().save(
        widget.scope,
        isCurrent: () => _current,
        signature: _isSignature ? _signature.text : null,
        tags: _isSignature
            ? null
            : {for (final entry in _tags.entries) entry.key: entry.value.text},
      );
      if (_current && saved != null) Navigator.pop(context, saved);
    } catch (_) {
      if (_current) _failed = true;
    } finally {
      if (_current) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_current) {
      return AlertDialog(
        title: const UiText('当前会话已变更'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const UiText('关闭'),
          ),
        ],
      );
    }
    return PopScope(
      canPop: !_saving,
      child: AlertDialog(
        title: Text(_isSignature ? '编辑个性签名' : '我的标签'),
        scrollable: true,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          spacing: 8,
          children: [
            if (_isSignature)
              _field(_signature, '个性签名', profileSignatureLimit, multiline: true)
            else
              for (final tag in ProfileTag.values)
                _field(_tags[tag]!, tag.label, profileTagLimit),
            Text(
              _isSignature ? '个性签名仅保存在当前设备。' : '标签仅保存在当前设备。',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            if (_failed)
              Semantics(
                liveRegion: true,
                child: UiText(
                  '无法保存本机资料，请重试。',
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: _saving ? null : () => Navigator.pop(context),
            child: const UiText('取消'),
          ),
          FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? '正在保存…' : '保存'),
          ),
        ],
      ),
    );
  }

  Widget _field(
    TextEditingController controller,
    String label,
    int limit, {
    bool multiline = false,
  }) => TextField(
    controller: controller,
    enabled: !_saving,
    maxLength: limit,
    maxLengthEnforcement: MaxLengthEnforcement.truncateAfterCompositionEnds,
    minLines: multiline ? 3 : 1,
    maxLines: multiline ? 4 : 1,
    decoration: InputDecoration(labelText: label),
  );
}
