import 'dart:async';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';
import '../../../../ui/theme.dart';
import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';
import '../../reading-profile/control/reading_profile_controller.dart';
import '../../reading-profile/view/reading_profile_panel.dart';
import '../../view/account_section_links.dart';

class ProfileEditorPage extends StatefulWidget {
  const ProfileEditorPage({
    super.key,
    required this.account,
    required this.member,
    this.privacy = false,
    this.intro = const [],
    this.status = const [],
  });

  final AccountController account;
  final AccountSession member;
  final bool privacy;
  final List<Widget> intro;
  final List<Widget> status;

  @override
  State<ProfileEditorPage> createState() => _ProfileEditorPageState();
}

enum _LeaveChoice { save, discard }

class _ProfileEditorPageState extends State<ProfileEditorPage> {
  late var _baseline = widget.member;
  late final _name = TextEditingController(text: _baseline.displayName);
  late final _bio = TextEditingController(text: _baseline.bio);
  late bool _namePublic = _baseline.namePublic;
  late bool _bioPublic = _baseline.bioPublic;
  late final _reading = ReadingProfileController(widget.account, _baseline.id);
  late final _changes = Listenable.merge([
    widget.account,
    _name,
    _bio,
    _reading,
  ]);
  DialogRoute<_LeaveChoice>? _leaveDialog;
  VoidCallback? _unregisterHistoryGuard;
  bool _saving = false;
  bool _savingToLeave = false;
  String? _feedback;

  bool get _current => _reading.current;
  bool get _basicDirty =>
      _name.text.trim() != _baseline.displayName.trim() ||
      _bio.text.trim() != _baseline.bio.trim() ||
      _namePublic != _baseline.namePublic ||
      _bioPublic != _baseline.bioPublic;
  bool get _dirty => _basicDirty || _reading.dirty;
  bool get _busy => _saving || _savingToLeave || _reading.saving;

  @override
  void initState() {
    super.initState();
    unawaited(_reading.load());
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _unregisterHistoryGuard?.call();
    _unregisterHistoryGuard = AccountSectionLinks.registerLeaveGuard(
      context,
      _allowLeave,
    );
  }

  @override
  void dispose() {
    _unregisterHistoryGuard?.call();
    if (_leaveDialog case final route?) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (route.isActive) route.navigator?.removeRoute(route);
      });
    }
    _name.dispose();
    _bio.dispose();
    _reading.dispose();
    super.dispose();
  }

  Future<bool> _save() async {
    if (_saving || !_current) return false;
    final current = widget.account.authorizedSession!;
    final name = _name.text.trim() == _baseline.displayName.trim()
        ? current.displayName
        : _name.text.trim();
    if (name.isEmpty) {
      setState(() => _feedback = '请输入昵称。');
      return false;
    }
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _saving = true;
      _feedback = null;
    });
    final success = await widget.account.updateProfile(_baseline.id, {
      'displayName': name,
      'bio': _bio.text.trim() == _baseline.bio.trim()
          ? current.bio
          : _bio.text.trim(),
      'visibility': {
        'displayName': _namePublic == _baseline.namePublic
            ? current.namePublic
            : _namePublic,
        'bio': _bioPublic == _baseline.bioPublic
            ? current.bioPublic
            : _bioPublic,
      },
    });
    if (!mounted) return false;
    final saved = _current && success;
    setState(() {
      _saving = false;
      if (saved) {
        _baseline = widget.account.authorizedSession!;
        _name.text = _baseline.displayName;
        _bio.text = _baseline.bio;
        _namePublic = _baseline.namePublic;
        _bioPublic = _baseline.bioPublic;
      }
      _feedback = saved
          ? '个人资料已保存。'
          : widget.account.notice ?? '暂时无法保存个人资料，请重试。';
    });
    return saved;
  }

  Future<void> _confirmLeave() async {
    final navigator = Navigator.of(context);
    if (await _allowLeave() && mounted && _current) navigator.pop();
  }

  Future<bool> _allowLeave() async {
    if (!mounted || !_current) return true;
    if (_leaveDialog != null || _busy) return false;
    if (!_dirty) return true;
    FocusManager.instance.primaryFocus?.unfocus();
    final dialogNavigator = Navigator.of(context, rootNavigator: true);
    final route = DialogRoute<_LeaveChoice>(
      context: context,
      builder: (context) => AlertDialog(
        title: const UiText('尚未保存修改'),
        actions: [
          TextButton(
            onPressed: dialogNavigator.pop,
            child: const UiText('继续编辑'),
          ),
          TextButton(
            onPressed: () => dialogNavigator.pop(_LeaveChoice.discard),
            child: const UiText('放弃修改'),
          ),
          if (!_reading.conflict)
            FilledButton(
              onPressed: () => dialogNavigator.pop(_LeaveChoice.save),
              child: const UiText('保存并离开'),
            ),
        ],
      ),
    );
    _leaveDialog = route;
    final choice = await dialogNavigator.push(route);
    _leaveDialog = null;
    if (!mounted || !_current) return true;
    if (choice == null) return false;
    if (choice == _LeaveChoice.save) {
      setState(() => _savingToLeave = true);
      try {
        if (_basicDirty && !await _save()) return !mounted || !_current;
        if (!mounted || !_current) return true;
        if (_reading.dirty) await _reading.save();
        return !mounted || !_current || !_dirty;
      } finally {
        if (mounted) setState(() => _savingToLeave = false);
      }
    }
    return true;
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _changes,
    builder: (context, _) => PopScope<void>(
      canPop: !_current || (!_dirty && !_busy),
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) unawaited(_confirmLeave());
      },
      child: Scaffold(
        appBar: AppBar(title: UiText(widget.privacy ? '隐私设置' : '基础个人资料')),
        body: SafeArea(
          top: false,
          child: !_current
              ? const Padding(
                  padding: jovianPagePadding,
                  child: UiText('当前会话已变更。'),
                )
              : Column(
                  children: [
                    ...widget.status,
                    Expanded(
                      child: ListView(
                        padding: widget.privacy
                            ? const EdgeInsets.all(16)
                            : jovianPagePadding,
                        keyboardDismissBehavior:
                            ScrollViewKeyboardDismissBehavior.onDrag,
                        children: [
                          ...widget.intro,
                          if (!widget.privacy) ...[
                            TextField(
                              controller: _name,
                              enabled: !_busy,
                              maxLength: 40,
                              maxLengthEnforcement:
                                  MaxLengthEnforcement.enforced,
                              decoration: const InputDecoration(
                                labelText: '昵称',
                              ),
                            ),
                            const SizedBox(height: 8),
                            TextField(
                              controller: _bio,
                              enabled: !_busy,
                              maxLength: 160,
                              minLines: 3,
                              maxLines: 5,
                              maxLengthEnforcement:
                                  MaxLengthEnforcement.enforced,
                              decoration: const InputDecoration(
                                labelText: '个人简介',
                              ),
                            ),
                          ],
                          Card(
                            child: Column(
                              children: [
                                SwitchListTile(
                                  title: const UiText('公开昵称'),
                                  value: _namePublic,
                                  onChanged: _busy
                                      ? null
                                      : (value) =>
                                            setState(() => _namePublic = value),
                                ),
                                const Divider(
                                  height: 1,
                                  indent: 16,
                                  endIndent: 16,
                                ),
                                SwitchListTile(
                                  title: const UiText('公开个人简介'),
                                  value: _bioPublic,
                                  onChanged: _busy
                                      ? null
                                      : (value) =>
                                            setState(() => _bioPublic = value),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 16),
                          if (_feedback case final message?)
                            Semantics(liveRegion: true, child: UiText(message)),
                          FilledButton(
                            onPressed: _busy ? null : _save,
                            child: UiText(
                              _saving
                                  ? '正在保存…'
                                  : widget.privacy
                                  ? '保存个人资料可见性'
                                  : '保存资料',
                            ),
                          ),
                          const SizedBox(height: 12),
                          ReadingProfilePanel(
                            profile: _reading,
                            privacy: widget.privacy,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
        ),
      ),
    ),
  );
}
