import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/theme.dart';
import '../../auth/control/account_controller.dart';
import '../../auth/model/session.dart';

class ProfileEditorPage extends StatefulWidget {
  const ProfileEditorPage({
    super.key,
    required this.account,
    required this.member,
  });

  final AccountController account;
  final AccountSession member;

  @override
  State<ProfileEditorPage> createState() => _ProfileEditorPageState();
}

class _ProfileEditorPageState extends State<ProfileEditorPage> {
  late final _name = TextEditingController(text: widget.member.displayName);
  late final _bio = TextEditingController(text: widget.member.bio);
  late bool _namePublic = widget.member.namePublic;
  late bool _bioPublic = widget.member.bioPublic;
  bool _saving = false;
  String? _feedback;

  @override
  void dispose() {
    _name.dispose();
    _bio.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_saving || widget.account.socialMemberId != widget.member.id) return;
    final name = _name.text.trim();
    if (name.isEmpty) {
      setState(() => _feedback = '请输入昵称。');
      return;
    }
    FocusManager.instance.primaryFocus?.unfocus();
    setState(() {
      _saving = true;
      _feedback = null;
    });
    final success = await widget.account.updateProfile(widget.member.id, {
      'displayName': name,
      'bio': _bio.text.trim(),
      'visibility': {'displayName': _namePublic, 'bio': _bioPublic},
    });
    if (!mounted) return;
    setState(() {
      _saving = false;
      _feedback = success
          ? '个人资料已保存。'
          : widget.account.notice ?? '暂时无法保存个人资料，请重试。';
    });
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('基础个人资料')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: widget.account,
        builder: (context, _) {
          if (widget.account.socialMemberId != widget.member.id) {
            return const Padding(
              padding: jovianPagePadding,
              child: Text('当前会话已变更。'),
            );
          }
          return ListView(
            padding: jovianPagePadding,
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            children: [
              TextField(
                controller: _name,
                enabled: !_saving,
                maxLength: 40,
                maxLengthEnforcement: MaxLengthEnforcement.enforced,
                decoration: const InputDecoration(labelText: '昵称'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: _bio,
                enabled: !_saving,
                maxLength: 160,
                minLines: 3,
                maxLines: 5,
                maxLengthEnforcement: MaxLengthEnforcement.enforced,
                decoration: const InputDecoration(labelText: '个人简介'),
              ),
              Card(
                child: Column(
                  children: [
                    SwitchListTile(
                      title: const Text('公开昵称'),
                      value: _namePublic,
                      onChanged: _saving
                          ? null
                          : (value) => setState(() => _namePublic = value),
                    ),
                    const Divider(height: 1, indent: 16, endIndent: 16),
                    SwitchListTile(
                      title: const Text('公开个人简介'),
                      value: _bioPublic,
                      onChanged: _saving
                          ? null
                          : (value) => setState(() => _bioPublic = value),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              if (_feedback case final message?)
                Semantics(liveRegion: true, child: Text(message)),
              FilledButton(
                onPressed: _saving ? null : _save,
                child: Text(_saving ? '正在保存…' : '保存资料'),
              ),
            ],
          );
        },
      ),
    ),
  );
}
