import 'package:material_ui/material_ui.dart';

import '../control/social_controller.dart';
import '../model/social.dart';
import 'social_profile.dart';

class FollowerAlertsPage extends StatefulWidget {
  const FollowerAlertsPage({super.key, required this.controller});

  final SocialController controller;

  @override
  State<FollowerAlertsPage> createState() => _FollowerAlertsPageState();
}

class _FollowerAlertsPageState extends State<FollowerAlertsPage> {
  late final SocialPaginator<FollowerAlert> _alerts;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _alerts = widget.controller.notifications()..load();
  }

  @override
  void dispose() {
    _alerts.dispose();
    super.dispose();
  }

  Future<void> _update({FollowerAlert? alert, bool openProfile = false}) async {
    if (_busy || _alerts.loading) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (alert == null || alert.readAt == null) {
        await widget.controller.markRead(_alerts, alert?.id);
      }
      final actor = alert?.actor;
      if (openProfile && actor != null && mounted) {
        await Navigator.of(context).push<void>(
          MaterialPageRoute(
            builder: (_) =>
                SocialProfilePage(controller: widget.controller, id: actor.id),
          ),
        );
        if (mounted) await _alerts.load();
      }
    } catch (failure) {
      if (mounted) {
        setState(() => _error = describeSocialError(failure, '提醒未能更新，请刷新后重试。'));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('新增粉丝')),
    body: _PagedList(
      paginator: _alerts,
      empty: '暂无新增粉丝提醒。',
      busy: _busy,
      before: () => [
        if (_error != null) _LiveStatus(_error!),
        TextButton(
          onPressed: _busy || _alerts.loading ? null : () => _update(),
          child: const Text('全部标为已读'),
        ),
      ],
      itemBuilder: (context, alert) {
        final unread = alert.readAt == null;
        final actor = alert.actor;
        return Card(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  '${actor?.displayName ?? '一位木星环用户'}关注了你',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  '${_timestamp(context, alert.createdAt)} · ${unread ? '未读' : '已读'}',
                ),
                if (actor != null || unread)
                  Wrap(
                    spacing: 8,
                    runSpacing: 4,
                    children: [
                      if (actor != null)
                        TextButton(
                          onPressed: _busy || _alerts.loading
                              ? null
                              : () => _update(alert: alert, openProfile: true),
                          child: const Text('查看主页'),
                        ),
                      if (unread)
                        TextButton(
                          onPressed: _busy || _alerts.loading
                              ? null
                              : () => _update(alert: alert),
                          child: const Text('标为已读'),
                        ),
                    ],
                  ),
              ],
            ),
          ),
        );
      },
    ),
  );
}

class SocialReportsPage extends StatefulWidget {
  const SocialReportsPage({
    super.key,
    required this.controller,
    this.moderation = false,
  });

  final SocialController controller;
  final bool moderation;

  @override
  State<SocialReportsPage> createState() => _SocialReportsPageState();
}

class _SocialReportsPageState extends State<SocialReportsPage> {
  late final SocialPaginator<SocialReport> _reports;
  bool _busy = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    _reports = widget.controller.reports(moderation: widget.moderation)..load();
  }

  @override
  void dispose() {
    _reports.dispose();
    super.dispose();
  }

  Future<void> _review(SocialReport item) async {
    final decision =
        await showDialog<({SocialReportStatus status, String conclusion})>(
          context: context,
          useRootNavigator: false,
          builder: (_) => const _ReviewDialog(),
        );
    if (!mounted || decision == null || _busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.controller.review(
        _reports,
        item.id,
        decision.status,
        decision.conclusion,
      );
    } catch (failure) {
      if (mounted) {
        setState(
          () => _error = describeSocialError(failure, '处理结果未保存，请刷新后重试。'),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(widget.moderation ? '举报处理' : '我的举报')),
    body: _PagedList(
      paginator: _reports,
      empty: widget.moderation ? '暂无待处理举报。' : '暂无举报记录。',
      busy: _busy,
      before: () => [if (_error != null) _LiveStatus(_error!)],
      itemBuilder: (context, item) => Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                '${item.reason.label} · ${item.status.label}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text('提交于 ${_timestamp(context, item.createdAt)}'),
              if (item.reviewedAt case final date?)
                Text('处理于 ${_timestamp(context, date)}'),
              if (item.conclusion?.isNotEmpty == true) Text(item.conclusion!),
              if (item.targetId case final id?) Text('被举报账户 $id'),
              if (item.detail?.isNotEmpty == true) Text(item.detail!),
              if (widget.moderation)
                TextButton(
                  onPressed: _busy || _reports.loading
                      ? null
                      : () => _review(item),
                  child: const Text('处理举报'),
                ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _ReviewDialog extends StatefulWidget {
  const _ReviewDialog();

  @override
  State<_ReviewDialog> createState() => _ReviewDialogState();
}

class _ReviewDialogState extends State<_ReviewDialog> {
  String _conclusion = '';

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('处理举报'),
    content: TextField(
      decoration: const InputDecoration(labelText: '处理结论（举报者可见）'),
      maxLength: 400,
      maxLines: 4,
      onChanged: (value) => setState(() => _conclusion = value.trim()),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const Text('取消'),
      ),
      for (final status in [
        SocialReportStatus.dismissed,
        SocialReportStatus.resolved,
      ])
        FilledButton.tonal(
          onPressed: _conclusion.isEmpty
              ? null
              : () => Navigator.pop(context, (
                  status: status,
                  conclusion: _conclusion,
                )),
          child: Text(status.label),
        ),
    ],
  );
}

class SocialConnectionsPanel extends StatefulWidget {
  const SocialConnectionsPanel({
    super.key,
    required this.controller,
    required this.direction,
    this.onBack,
  });

  final SocialController controller;
  final SocialList direction;
  final VoidCallback? onBack;

  @override
  State<SocialConnectionsPanel> createState() => _SocialConnectionsPanelState();
}

class _SocialConnectionsPanelState extends State<SocialConnectionsPanel> {
  late final SocialPaginator<SocialProfile> _people;

  @override
  void initState() {
    super.initState();
    _people = widget.controller.list(widget.direction)..load();
  }

  @override
  void dispose() {
    _people.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final followers = widget.direction == SocialList.followers;
    return Scaffold(
      appBar: AppBar(
        title: Text(followers ? '粉丝' : '关注'),
        leading: widget.onBack == null
            ? null
            : BackButton(onPressed: widget.onBack),
      ),
      body: _PagedList(
        paginator: _people,
        empty: followers ? '暂无粉丝。' : '暂无关注。',
        itemBuilder: (context, person) => SocialProfileTile(
          profile: person,
          onTap: () async {
            await Navigator.of(context).push<void>(
              MaterialPageRoute(
                builder: (_) => SocialProfilePage(
                  controller: widget.controller,
                  id: person.id,
                ),
              ),
            );
            if (mounted) await _people.load();
          },
        ),
      ),
    );
  }
}

class _PagedList<T> extends StatelessWidget {
  const _PagedList({
    required this.paginator,
    required this.empty,
    required this.itemBuilder,
    this.before,
    this.busy = false,
  });

  final SocialPaginator<T> paginator;
  final String empty;
  final Widget Function(BuildContext, T) itemBuilder;
  final List<Widget> Function()? before;
  final bool busy;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: paginator,
    builder: (context, _) {
      final page = paginator.page;
      final disabled = busy || paginator.loading;
      return RefreshIndicator(
        onRefresh: () => disabled ? Future.value() : paginator.load(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            if (page != null && before != null) ...before!(),
            if (paginator.loading) const LinearProgressIndicator(),
            if (paginator.error case final error?) ...[
              _LiveStatus(describeSocialError(error, '加载失败，请重试。')),
              TextButton(
                onPressed: disabled ? null : paginator.load,
                child: const Text('重试'),
              ),
            ],
            if (page != null && page.items.isEmpty) _LiveStatus(empty),
            for (final item in page?.items ?? <T>[])
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: itemBuilder(context, item),
              ),
            if (page?.next != null)
              OutlinedButton(
                onPressed: disabled ? null : () => paginator.load(more: true),
                child: const Text('加载更多'),
              ),
          ],
        ),
      );
    },
  );
}

String _timestamp(BuildContext context, DateTime utc) {
  final date = utc.toLocal();
  final strings = MaterialLocalizations.of(context);
  return '${strings.formatCompactDate(date)} ${strings.formatTimeOfDay(TimeOfDay.fromDateTime(date))}';
}

class _LiveStatus extends StatelessWidget {
  const _LiveStatus(this.message);
  final String message;

  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 8),
    child: Semantics(liveRegion: true, child: Text(message)),
  );
}
