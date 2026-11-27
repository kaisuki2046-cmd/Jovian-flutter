import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import '../../account/account.dart';
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
    appBar: AppBar(title: const UiText('新增粉丝')),
    body: _PagedList(
      paginator: _alerts,
      empty: '暂无新增粉丝提醒。',
      busy: _busy,
      before: () => [
        if (_error != null) _LiveStatus(_error!),
        TextButton(
          onPressed: _busy || _alerts.loading ? null : () => _update(),
          child: const UiText('全部标为已读'),
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
                  context
                      .uiLabel('{name}关注了你')
                      .replaceFirst(
                        '{name}',
                        actor?.displayName ?? context.uiLabel('一位木星环用户'),
                      ),
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 6),
                Text(
                  '${_timestamp(context, alert.createdAt)} · ${context.uiLabel(unread ? '未读' : '已读')}',
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
                          child: const UiText('查看主页'),
                        ),
                      if (unread)
                        TextButton(
                          onPressed: _busy || _alerts.loading
                              ? null
                              : () => _update(alert: alert),
                          child: const UiText('标为已读'),
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
    appBar: AppBar(title: UiText(widget.moderation ? '举报处理' : '我的举报')),
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
                '${context.uiLabel(item.reason.label)} · ${context.uiLabel(item.status.label)}',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                context
                    .uiLabel('提交于 {date}')
                    .replaceFirst(
                      '{date}',
                      _timestamp(context, item.createdAt),
                    ),
              ),
              if (item.reviewedAt case final date?)
                Text(
                  context
                      .uiLabel('处理于 {date}')
                      .replaceFirst('{date}', _timestamp(context, date)),
                ),
              if (item.conclusion?.isNotEmpty == true) Text(item.conclusion!),
              if (item.targetId case final id?)
                Text('${context.uiLabel('被举报账户')} $id'),
              if (item.detail?.isNotEmpty == true) Text(item.detail!),
              if (widget.moderation)
                TextButton(
                  onPressed: _busy || _reports.loading
                      ? null
                      : () => _review(item),
                  child: const UiText('处理举报'),
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
    title: const UiText('处理举报'),
    content: TextField(
      decoration: InputDecoration(labelText: context.uiLabel('处理结论（举报者可见）')),
      maxLength: 400,
      maxLines: 4,
      onChanged: (value) => setState(() => _conclusion = value.trim()),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: const UiText('取消'),
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
          child: UiText(status.label),
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
  bool _updatingFollow = false;
  bool _openingProfile = false;
  String? _notice;

  bool get _busy => _updatingFollow || _openingProfile || _people.loading;

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

  Future<void> _open(SocialProfile person) async {
    if (_busy || !widget.controller.isCurrentMember) return;
    setState(() => _openingProfile = true);
    try {
      await AccountSectionLinks.openPage(
        context,
        AccountSection.socialProfile,
        () => SocialProfilePage(controller: widget.controller, id: person.id),
        profileId: person.id,
      );
      if (mounted && widget.controller.isCurrentMember) await _reload();
    } finally {
      if (mounted) setState(() => _openingProfile = false);
    }
  }

  Future<void> _toggle(SocialProfile person) async {
    if (_busy || !widget.controller.isCurrentMember) return;
    setState(() {
      _updatingFollow = true;
      _notice = null;
    });
    try {
      final updated = await widget.controller.toggleFollow(person);
      if (!mounted || !widget.controller.isCurrentMember) return;
      final remove =
          widget.direction == SocialList.following && !updated.relation.follows;
      _people.updateItems(
        (items) => [
          for (final item in items)
            if (item.id != updated.id) item else if (!remove) updated,
        ],
      );
    } catch (error) {
      if (mounted && widget.controller.isCurrentMember) {
        setState(
          () => _notice = describeSocialError(
            error,
            '关注状态更新失败，请重试。',
            missing: '此用户当前不可操作。',
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _updatingFollow = false);
    }
  }

  Future<void> _reload() {
    if (_notice != null) setState(() => _notice = null);
    return _people.load();
  }

  @override
  Widget build(BuildContext context) {
    final followers = widget.direction == SocialList.followers;
    return Scaffold(
      appBar: AppBar(
        title: UiText(followers ? '粉丝' : '关注'),
        leading: widget.onBack == null
            ? null
            : BackButton(onPressed: widget.onBack),
        actions: [
          ListenableBuilder(
            listenable: _people,
            builder: (context, _) => IconButton(
              tooltip: context.uiLabel('刷新'),
              onPressed: _busy ? null : _reload,
              icon: const Icon(Icons.refresh),
            ),
          ),
        ],
      ),
      body: _PagedList(
        paginator: _people,
        empty: followers ? '暂无粉丝。' : '暂无关注。',
        busy: _updatingFollow || _openingProfile,
        onRefresh: _reload,
        before: () => [if (_notice case final message?) _LiveStatus(message)],
        itemBuilder: (context, person) => SocialProfileTile(
          profile: person,
          onTap: _busy ? null : () => _open(person),
          followAction: SocialFollowButton(
            relation: person.relation,
            onPressed: _busy ? null : () => _toggle(person),
          ),
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
    this.onRefresh,
    this.busy = false,
  });

  final SocialPaginator<T> paginator;
  final String empty;
  final Widget Function(BuildContext, T) itemBuilder;
  final List<Widget> Function()? before;
  final Future<void> Function()? onRefresh;
  final bool busy;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: paginator,
    builder: (context, _) {
      final page = paginator.page;
      final disabled = busy || paginator.loading;
      return RefreshIndicator(
        onRefresh: () =>
            disabled ? Future.value() : (onRefresh ?? paginator.load)(),
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(20),
          children: [
            if (page != null && before != null) ...before!(),
            if (paginator.loading) const LinearProgressIndicator(),
            if (paginator.error case final error?) ...[
              _LiveStatus(describeSocialError(error, '加载失败，请重试。')),
              TextButton(
                onPressed: disabled ? null : (onRefresh ?? paginator.load),
                child: const UiText('重试'),
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
                child: const UiText('加载更多'),
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
    child: Semantics(liveRegion: true, child: UiText(message)),
  );
}
