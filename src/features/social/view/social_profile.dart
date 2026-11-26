import 'dart:async';

import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../account/account.dart';
import '../control/social_controller.dart';
import '../model/social.dart';
import 'social_records.dart';

class SocialSearchPage extends StatefulWidget {
  const SocialSearchPage({super.key, required this.controller});

  final SocialController controller;

  @override
  State<SocialSearchPage> createState() => _SocialSearchPageState();
}

class _SocialSearchPageState extends State<SocialSearchPage> {
  final _input = TextEditingController();
  SocialSearchMode _mode = SocialSearchMode.uid;
  List<SocialProfile>? _results;
  String? _error;
  bool _loading = false;
  bool _openingProfile = false;
  int _revision = 0;
  ({SocialSearchMode mode, String input})? _submitted;

  bool _isCurrent(int revision) =>
      mounted && revision == _revision && widget.controller.isCurrentMember;

  void _clearResults() {
    _revision++;
    _submitted = null;
    _results = null;
    _error = null;
    _loading = false;
  }

  Future<void> _search({bool refresh = false}) async {
    if (_loading || !widget.controller.isCurrentMember) return;
    final query = refresh
        ? _submitted
        : (mode: _mode, input: _input.text.trim());
    if (query == null || query.input.isEmpty) return;
    if (!refresh) FocusScope.of(context).unfocus();
    final revision = ++_revision;
    setState(() {
      _submitted = query;
      _loading = true;
      _error = null;
      if (!refresh) _results = null;
    });
    try {
      final results = await widget.controller.search(query.mode, query.input);
      if (_isCurrent(revision)) setState(() => _results = results);
    } catch (failure) {
      if (_isCurrent(revision)) {
        setState(() {
          _results = null;
          _error = describeSocialError(failure, '搜索暂时不可用，请重试。');
        });
      }
    } finally {
      if (_isCurrent(revision)) setState(() => _loading = false);
    }
  }

  Future<void> _open(SocialProfile profile) async {
    if (_loading || _openingProfile || !widget.controller.isCurrentMember)
      return;
    _openingProfile = true;
    FocusScope.of(context).unfocus();
    try {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) =>
              SocialProfilePage(controller: widget.controller, id: profile.id),
        ),
      );
    } finally {
      _openingProfile = false;
    }
    if (mounted) await _search(refresh: true);
  }

  @override
  void dispose() {
    _input.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('找用户')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      children: [
        Wrap(
          spacing: 8,
          children: [
            for (final (mode, title) in const [
              (SocialSearchMode.uid, '按 UID 搜索'),
              (SocialSearchMode.nickname, '按昵称搜索'),
            ])
              ChoiceChip(
                label: Text(title),
                selected: _mode == mode,
                onSelected: _mode == mode
                    ? null
                    : (_) => setState(() {
                        _mode = mode;
                        _input.clear();
                        _clearResults();
                      }),
              ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _input,
          autocorrect: false,
          textInputAction: TextInputAction.search,
          keyboardType: _mode == SocialSearchMode.uid
              ? TextInputType.number
              : TextInputType.text,
          decoration: InputDecoration(
            labelText: _mode == SocialSearchMode.uid ? 'UID' : '昵称',
            helperText: _mode == SocialSearchMode.uid
                ? '输入完整的 8 位 UID'
                : '仅显示公开昵称',
            errorText: _error,
          ),
          onChanged: (_) => setState(_clearResults),
          onSubmitted: (_) => _search(),
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _loading || _input.text.trim().isEmpty ? null : _search,
          child: Text(_loading && _results == null ? '正在搜索…' : '搜索'),
        ),
        if (_loading && _results != null)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Semantics(liveRegion: true, child: const Text('正在核对搜索结果…')),
          ),
        if (_results?.isEmpty == true)
          const Padding(
            padding: EdgeInsets.only(top: 16),
            child: Text('未找到该用户。'),
          ),
        for (final profile in _results ?? const <SocialProfile>[])
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: SocialProfileTile(
              profile: profile,
              onTap: _loading ? null : () => _open(profile),
            ),
          ),
      ],
    ),
  );
}

class SocialProfileTile extends StatelessWidget {
  const SocialProfileTile({
    super.key,
    required this.profile,
    required this.onTap,
  });

  final SocialProfile profile;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      leading: const CircleAvatar(child: Icon(Icons.person_outline)),
      title: Text(profile.name),
      subtitle: profile.uid == null ? null : Text('UID ${profile.uid}'),
      trailing: const Icon(Icons.chevron_right),
      onTap: onTap,
    ),
  );
}

class SocialProfilePage extends StatefulWidget {
  const SocialProfilePage({
    super.key,
    required this.controller,
    required this.id,
  });

  final SocialController controller;
  final String id;

  @override
  State<SocialProfilePage> createState() => _SocialProfilePageState();
}

class _SocialProfilePageState extends State<SocialProfilePage> {
  late Future<SocialProfile> _profile = widget.controller.profile(widget.id);
  bool _busy = false;
  String? _notice;
  bool get _own => widget.controller.memberId == widget.id;

  void _reload() {
    final profile = widget.controller.profile(widget.id);
    setState(() {
      _profile = profile;
    });
  }

  Future<void> _perform(
    Future<void> Function() operation,
    String failure,
  ) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _notice = null;
    });
    try {
      await operation();
    } catch (error) {
      if (mounted) {
        setState(
          () => _notice = describeSocialError(
            error,
            failure,
            missing: '该用户主页不可查看。',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _block() async {
    final accepted = await showDialog<bool>(
      context: context,
      useRootNavigator: false,
      builder: (context) => AlertDialog(
        title: const Text('拉黑该用户'),
        content: const Text('拉黑会解除双方已有的关注，并限制互相查看和关注。'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('取消'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('确认拉黑'),
          ),
        ],
      ),
    );
    if (!mounted || accepted != true) return;
    await _perform(() async {
      await widget.controller.block(widget.id);
      if (mounted) Navigator.of(context).pop();
    }, '拉黑未完成，请重试。');
  }

  Future<void> _report() async {
    final input =
        await showDialog<({SocialReportReason reason, String detail})>(
          context: context,
          useRootNavigator: false,
          builder: (context) => const _ReportDialog(),
        );
    if (!mounted || input == null) return;
    await _perform(() async {
      final receipt = await widget.controller.report(
        widget.id,
        input.reason,
        input.detail,
      );
      if (mounted) setState(() => _notice = '举报已受理 · ${receipt.status.label}');
    }, '举报未提交，请重试。');
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('用户主页')),
    body: ListenableBuilder(
      listenable: widget.controller.sessionChanges,
      builder: (context, _) => widget.controller.isCurrentMember
          ? _profileBody()
          : const Center(child: Text('当前会话已变更。')),
    ),
  );

  Widget _profileBody() => FutureBuilder<SocialProfile>(
    future: _profile,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done) {
        return const LinearProgressIndicator();
      }
      if (snapshot.hasError) {
        return ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              describeSocialError(
                snapshot.error!,
                '暂时无法加载用户资料。',
                missing: '该用户主页不可查看。',
              ),
            ),
            TextButton(onPressed: _reload, child: const Text('重新加载')),
          ],
        );
      }
      final profile = snapshot.data!;
      return ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Card(
            child: Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const CircleAvatar(
                        radius: 24,
                        child: Icon(Icons.person_outline),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          profile.name,
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                      ),
                      if (!_own)
                        PopupMenuButton<String>(
                          enabled: !_busy,
                          tooltip: '更多操作',
                          onSelected: (action) =>
                              action == 'block' ? _block() : _report(),
                          itemBuilder: (context) => const [
                            PopupMenuItem(value: 'block', child: Text('拉黑')),
                            PopupMenuItem(value: 'report', child: Text('举报')),
                          ],
                        ),
                    ],
                  ),
                  if (profile.uid case final uid?)
                    Semantics(
                      button: true,
                      child: GestureDetector(
                        onLongPress: () async {
                          await Clipboard.setData(ClipboardData(text: uid));
                          if (context.mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('UID 已复制')),
                            );
                          }
                        },
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          child: Text('UID $uid · 长按复制'),
                        ),
                      ),
                    ),
                  if (profile.bio?.isNotEmpty == true) Text(profile.bio!),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 16,
                    runSpacing: 6,
                    children: [
                      for (final (direction, label) in [
                        (
                          SocialList.following,
                          '关注 ${profile.relation.following}',
                        ),
                        (
                          SocialList.followers,
                          '粉丝 ${profile.relation.followers}',
                        ),
                      ])
                        if (_own)
                          TextButton(
                            onPressed: () async {
                              await Navigator.of(context).push<void>(
                                MaterialPageRoute(
                                  builder: (_) => SocialConnectionsPanel(
                                    controller: widget.controller,
                                    direction: direction,
                                  ),
                                ),
                              );
                              if (mounted) _reload();
                            },
                            child: Text(label),
                          )
                        else
                          Text(label),
                    ],
                  ),
                  if (!_own) ...[
                    const SizedBox(height: 14),
                    FilledButton.tonal(
                      onPressed: _busy
                          ? null
                          : () => _perform(() async {
                              final updated = await widget.controller
                                  .toggleFollow(profile);
                              if (mounted) {
                                setState(() {
                                  _profile = Future.value(updated);
                                });
                              }
                            }, '关注状态更新失败，请重试。'),
                      child: Text(profile.relation.followLabel),
                    ),
                  ],
                ],
              ),
            ),
          ),
          _PublicBirthPreview(controller: widget.controller, id: profile.id),
          if (_notice != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Semantics(liveRegion: true, child: Text(_notice!)),
            ),
        ],
      );
    },
  );
}

class _PublicBirthPreview extends StatefulWidget {
  const _PublicBirthPreview({required this.controller, required this.id});
  final SocialController controller;
  final String id;

  @override
  State<_PublicBirthPreview> createState() => _PublicBirthPreviewState();
}

class _PublicBirthPreviewState extends State<_PublicBirthPreview> {
  final _cancel = Completer<void>();
  late Future<VisitorProfile> _result = _read();

  Future<VisitorProfile> _read() =>
      widget.controller.publicProfile(widget.id, cancel: _cancel.future);

  @override
  void dispose() {
    _cancel.complete();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => FutureBuilder<VisitorProfile>(
    future: _result,
    builder: (context, snapshot) {
      if (snapshot.connectionState != ConnectionState.done)
        return const LinearProgressIndicator();
      if (snapshot.data case final profile?)
        return PublicBirthDetails(profile: profile);
      return Padding(
        padding: const EdgeInsets.only(top: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              describeSocialError(
                snapshot.error!,
                '暂时无法读取公开出生资料。',
                missing: '该用户公开资料暂不可查看。',
              ),
            ),
            TextButton(
              onPressed: () {
                final request = _read();
                setState(() {
                  _result = request;
                });
              },
              child: const Text('重试读取公开资料'),
            ),
          ],
        ),
      );
    },
  );
}

class _ReportDialog extends StatefulWidget {
  const _ReportDialog();

  @override
  State<_ReportDialog> createState() => _ReportDialogState();
}

class _ReportDialogState extends State<_ReportDialog> {
  SocialReportReason? _reason;
  String _detail = '';

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('举报用户'),
    content: SingleChildScrollView(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          DropdownButtonFormField<SocialReportReason>(
            decoration: const InputDecoration(labelText: '举报原因'),
            items: [
              for (final reason in SocialReportReason.values)
                DropdownMenuItem(value: reason, child: Text(reason.label)),
            ],
            onChanged: (value) => setState(() => _reason = value),
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(labelText: '补充说明（选填）'),
            maxLines: 3,
            maxLength: 400,
            onChanged: (value) => _detail = value,
          ),
        ],
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('取消'),
      ),
      FilledButton(
        onPressed: _reason == null
            ? null
            : () => Navigator.pop(context, (reason: _reason!, detail: _detail)),
        child: const Text('提交举报'),
      ),
    ],
  );
}
