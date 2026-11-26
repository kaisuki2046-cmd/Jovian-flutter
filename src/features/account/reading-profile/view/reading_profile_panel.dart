import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../auth/control/account_controller.dart';
import '../control/reading_profile_controller.dart';
import '../model/account_reading_profile.dart';
import 'birth_selection.dart';

class ReadingProfilePanel extends StatefulWidget {
  const ReadingProfilePanel({
    super.key,
    required this.account,
    required this.owner,
    this.privacy = false,
  });

  final AccountController account;
  final String owner;
  final bool privacy;

  @override
  State<ReadingProfilePanel> createState() => _ReadingProfilePanelState();
}

class _ReadingProfilePanelState extends State<ReadingProfilePanel>
    with AutomaticKeepAliveClientMixin {
  late final _profile = ReadingProfileController(widget.account, widget.owner);
  DialogRoute<String>? _selection;
  bool _confirmingLeave = false;

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    unawaited(_profile.load());
  }

  @override
  void dispose() {
    if (_selection case final route?) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (route.isActive) route.navigator?.removeRoute(route);
      });
    }
    _profile.dispose();
    super.dispose();
  }

  Future<void> _select(ReadingField field, String initial) async {
    if (_selection != null || !_profile.current) return;
    final navigator = Navigator.of(context, rootNavigator: true);
    final route = DialogRoute<String>(
      context: context,
      builder: (_) =>
          BirthSelection(field: field, initial: initial, choose: navigator.pop),
    );
    _selection = route;
    final value = await navigator.push(route);
    _selection = null;
    if (mounted && value != null) _profile.setValue(field, value);
  }

  Future<void> _confirmLeave() async {
    if (_confirmingLeave ||
        !_profile.current ||
        !_profile.dirty ||
        _profile.saving)
      return;
    _confirmingLeave = true;
    final navigator = Navigator.of(context);
    final shouldSave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const UiText('尚未保存修改'),
        content: const Text('本次出生资料或可见性修改还未保存。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const UiText('继续编辑'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const UiText('放弃修改'),
          ),
          if (!_profile.conflict)
            FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const UiText('保存并离开'),
            ),
        ],
      ),
    );
    _confirmingLeave = false;
    if (!mounted || shouldSave == null) return;
    if (shouldSave) await _profile.save();
    if (mounted && (!shouldSave || !_profile.dirty)) navigator.pop();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return ListenableBuilder(
      listenable: _profile,
      builder: (context, _) {
        if (!_profile.current) return const SizedBox.shrink();
        final draft = _profile.draft;
        final busy = _profile.loading || _profile.saving;
        return PopScope(
          canPop: !_profile.dirty && !_profile.saving,
          onPopInvokedWithResult: (didPop, _) {
            if (!didPop) unawaited(_confirmLeave());
          },
          child: Card(
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      widget.privacy ? '出生资料可见性' : '出生资料',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  const SizedBox(height: 8),
                  if (widget.privacy)
                    const Padding(
                      padding: EdgeInsets.only(bottom: 4),
                      child: Text('资料默认保密。公开并保存后，其他已登录用户可查看对应资料。'),
                    ),
                  if (draft != null) ...[
                    if (widget.privacy)
                      for (final field in ReadingField.values)
                        SwitchListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text('公开${field.label}'),
                          value: draft.isVisible(field),
                          onChanged: busy
                              ? null
                              : (value) => _profile.setVisibility(field, value),
                        )
                    else ...[
                      for (final field in ReadingField.values.take(3))
                        _field(field, draft.value(field), busy),
                      Text(
                        ReadingField.gender.label,
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 4),
                      Wrap(
                        spacing: 8,
                        children: [
                          for (final (value, label) in const [
                            ('', '不填写'),
                            ('female', '女'),
                            ('male', '男'),
                            ('other', '其他'),
                          ])
                            ChoiceChip(
                              label: Text(label),
                              selected: draft.fields.gender == value,
                              onSelected: busy
                                  ? null
                                  : (_) => _profile.setValue(
                                      ReadingField.gender,
                                      value,
                                    ),
                            ),
                        ],
                      ),
                    ],
                  ],
                  if (busy) const LinearProgressIndicator(),
                  if (_profile.notice case final message?)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      child: Semantics(liveRegion: true, child: Text(message)),
                    ),
                  if (_profile.conflict)
                    OutlinedButton(
                      onPressed: busy
                          ? null
                          : () => _profile.load(discard: true),
                      child: const UiText('放弃本次修改并加载最新资料'),
                    )
                  else if (_profile.failed)
                    OutlinedButton(
                      onPressed: busy ? null : () => _profile.load(),
                      child: const UiText('重新加载出生资料'),
                    )
                  else if (draft != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: FilledButton(
                        onPressed: busy || !_profile.dirty
                            ? null
                            : _profile.save,
                        child: Text(
                          _profile.saving
                              ? '保存中…'
                              : widget.privacy
                              ? '保存出生资料可见性'
                              : '保存出生资料',
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _field(ReadingField field, String value, bool disabled) => ListTile(
    contentPadding: EdgeInsets.zero,
    title: Text(field.label),
    subtitle: Text(value.isEmpty ? '未填写' : field.display(value)),
    trailing: const Icon(Icons.chevron_right),
    onTap: disabled ? null : () => _select(field, value),
  );
}
