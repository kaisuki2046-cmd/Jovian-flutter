import 'package:material_ui/material_ui.dart';

import '../../account/account.dart';

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
      title: Text(latest == null ? '核对出生资料' : '账户出生资料已更新'),
      scrollable: true,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (latest != null) ...[
            const Text('账户资料在另一处有更新，请选择用于本次测算的资料。'),
            const SizedBox(height: 12),
            const Text('本次填写'),
          ],
          Text(_summary(entered)),
          if (latest case final profile?) ...[
            const SizedBox(height: 12),
            const Text('账户最新资料'),
            Text(_summary(profile)),
          ],
          if (member) ...[
            const SizedBox(height: 12),
            const Text('同步沿用个人中心已设置的资料可见性。'),
          ],
          if (saving) ...[
            const SizedBox(height: 8),
            const LinearProgressIndicator(),
          ],
          if (message case final error?)
            Semantics(
              liveRegion: true,
              child: Text(
                error,
                style: TextStyle(color: Theme.of(context).colorScheme.error),
              ),
            ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: saving ? null : () => Navigator.pop(context),
          child: const Text('返回修改'),
        ),
        if (useLatest case final action?)
          TextButton(
            onPressed: saving ? null : action,
            child: const Text('使用账户最新资料'),
          ),
        FilledButton(
          onPressed: saving ? null : confirm,
          child: Text(
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

  static String _summary(AccountBirthFields profile) {
    final date = profile.birthDate.isEmpty ? '日期未填写' : profile.birthDate;
    final time = profile.birthTime.isEmpty ? '时刻未填写' : profile.birthTime;
    final place = profile.birthPlace.isEmpty ? '地点未填写' : profile.birthPlace;
    final gender = switch (profile.gender) {
      'female' => '女',
      'male' => '男',
      'other' => '其他',
      _ => '性别未填写',
    };
    return '$date · $time\n$place · $gender';
  }
}
