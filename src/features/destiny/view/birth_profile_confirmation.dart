import 'package:material_ui/material_ui.dart';

import '../../../ui/interface_language.dart';

import '../../account/account.dart';
import 'birth_display_labels.dart';

class BirthProfileConfirmation extends StatelessWidget {
  const BirthProfileConfirmation({
    super.key,
    required this.entered,
    required this.member,
    required this.saving,
    required this.confirm,
    this.latest,
    this.message,
    this.useLatest,
  });

  final AccountBirthFields entered;
  final bool member;
  final bool saving;
  final AccountBirthFields? latest;
  final String? message;
  final VoidCallback confirm;
  final VoidCallback? useLatest;

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !saving,
    child: AlertDialog(
      title: UiText(latest == null ? '核对出生资料' : '账户出生资料已更新'),
      scrollable: true,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (latest != null) ...[
            const UiText('账户资料在另一处有更新，请选择用于本次测算的资料。'),
            const SizedBox(height: 12),
            _heading(context, '本次填写'),
          ],
          _BirthDetails(entered),
          if (latest case final profile?) ...[
            const SizedBox(height: 12),
            _heading(context, '账户最新资料'),
            _BirthDetails(profile),
          ],
          if (member) ...[
            const SizedBox(height: 12),
            const UiText('同步沿用个人中心已设置的资料可见性。'),
          ],
          if (saving) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          if (message case final error?)
            Semantics(
              liveRegion: true,
              child: UiText(
                error,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: saving ? null : () => Navigator.pop(context),
          child: const UiText('返回修改'),
        ),
        if (useLatest case final action?)
          TextButton(
            onPressed: saving ? null : action,
            child: const UiText('使用账户最新资料'),
          ),
        FilledButton(
          onPressed: saving ? null : confirm,
          child: UiText(
            saving
                ? '同步中…'
                : latest != null
                ? '同步本次填写并测算'
                : member
                ? '确认并同步测算'
                : '确认测算',
          ),
        ),
      ],
    ),
  );

  Widget _heading(BuildContext context, String text) => Semantics(
    header: true,
    child: Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: UiText(text, style: Theme.of(context).textTheme.titleSmall),
    ),
  );
}

class _BirthDetails extends StatelessWidget {
  const _BirthDetails(this.profile);

  final AccountBirthFields profile;

  @override
  Widget build(BuildContext context) {
    final gender = birthGenderLabel(context, profile.gender);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      spacing: 6,
      children: [
        for (final (label, value) in [
          ('出生日期', profile.birthDate),
          ('出生时间', storedBirthTimeLabel(context, profile.birthTime)),
          ('出生地点', profile.birthPlace),
          ('性别', gender),
        ])
          Text(
            '${context.uiLabel(label)} · ${value.isEmpty ? context.uiLabel('未填写') : value}',
          ),
      ],
    );
  }
}
