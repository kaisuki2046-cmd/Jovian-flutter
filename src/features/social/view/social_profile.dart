import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

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

  Future<void> _search() async {
    if (_loading) return;
    final input = _input.text;
    setState(() {
      _loading = true;
      _error = null;
      _results = null;
    });
    try {
      final results = await widget.controller.search(_mode, input);
      if (mounted) setState(() => _results = results);
    } catch (failure) {
      if (mounted) {
        setState(() => _error = describeSocialError(failure, '搜索暂时不可用，请重试。'));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
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
                onSelected: _loading || _mode == mode
                    ? null
                    : (_) => setState(() {
                        _mode = mode;
                        _input.clear();
                        _results = null;
                        _error = null;
                      }),
              ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _input,
          enabled: !_loading,
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
          onChanged: (_) => setState(() {
            _results = null;
            _error = null;
          }),
          onSubmitted: (_) {
            if (_input.text.trim().isNotEmpty) _search();
          },
        ),
        const SizedBox(height: 12),
        FilledButton(
          onPressed: _loading || _input.text.trim().isEmpty ? null : _search,
          child: Text(_loading ? '正在搜索…' : '搜索'),
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
              onTap: () async {
                await Navigator.of(context).push<void>(
                  MaterialPageRoute(
                    builder: (_) => SocialProfilePage(
                      controller: widget.controller,
                      id: profile.id,
                    ),
                  ),
                );
                if (mounted) await _search();
              },
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
  final VoidCallback onTap;

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
    body: FutureBuilder<SocialProfile>(
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
            if (_notice != null)
              Padding(
                padding: const EdgeInsets.only(top: 12),
                child: Semantics(liveRegion: true, child: Text(_notice!)),
              ),
          ],
        );
      },
    ),
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
