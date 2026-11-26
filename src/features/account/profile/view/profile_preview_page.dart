import 'dart:async';

import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../../../ui/theme.dart';
import '../../auth/control/account_controller.dart';
import '../../reading-profile/model/account_reading_profile.dart';
import '../model/profile_preview.dart';
import 'public_birth_details.dart';

class ProfilePreviewPage extends StatefulWidget {
  const ProfilePreviewPage({
    super.key,
    required this.account,
    required this.owner,
  });
  final AccountController account;
  final String owner;

  @override
  State<ProfilePreviewPage> createState() => _ProfilePreviewPageState();
}

class _ProfilePreviewPageState extends State<ProfilePreviewPage> {
  final _cancel = Completer<void>();
  late Future<ProfilePreview> _preview = _read();

  Future<ProfilePreview> _read() =>
      widget.account.readProfilePreview(widget.owner, cancel: _cancel.future);

  @override
  void dispose() {
    _cancel.complete();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const UiText('他人视角预览')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: widget.account,
        builder: (context, _) {
          if (widget.account.memberId != widget.owner) {
            return const Padding(
              padding: jovianPagePadding,
              child: UiText('请登录后预览个人资料。'),
            );
          }
          return FutureBuilder<ProfilePreview>(
            future: _preview,
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done)
                return const LinearProgressIndicator();
              final preview = snapshot.data;
              if (preview == null)
                return ListView(
                  padding: jovianPagePadding,
                  children: [
                    const Text('暂时无法加载资料预览。'),
                    TextButton(
                      onPressed: () => setState(() => _preview = _read()),
                      child: const UiText('重新加载预览'),
                    ),
                  ],
                );
              return ListView(
                padding: jovianPagePadding,
                children: [
                  const Text('按已保存的设置显示其他已登录用户能看到的资料。'),
                  const SizedBox(height: 8),
                  _IdentityPreview(preview.profile),
                  PublicBirthDetails(profile: preview.profile),
                  _VisibilityDetails(preview),
                ],
              );
            },
          );
        },
      ),
    ),
  );
}

class _IdentityPreview extends StatelessWidget {
  const _IdentityPreview(this.profile);
  final VisitorProfile profile;

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(20),
      child: Column(
        children: [
          const CircleAvatar(
            radius: 32,
            child: Icon(Icons.person_outline, size: 30),
          ),
          const SizedBox(height: 10),
          Text(
            profile.displayName ?? '木星环用户',
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          if (profile.bio case final bio?)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(bio, textAlign: TextAlign.center),
            ),
          if (!profile.hasData)
            const Padding(
              padding: EdgeInsets.only(top: 6),
              child: UiText('暂无公开资料'),
            ),
        ],
      ),
    ),
  );
}

class _VisibilityDetails extends StatelessWidget {
  const _VisibilityDetails(this.preview);
  final ProfilePreview preview;

  String _status(String key, String? value) {
    if (preview.visibility[key] != true) return '保密';
    return value == null ? '公开 · 尚未填写' : '公开';
  }

  @override
  Widget build(BuildContext context) => Card(
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: UiText(
              '可见性明细',
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ),
          const Text('此处仅本人可见。'),
          ProfileDetailRow(
            '昵称',
            _status('displayName', preview.profile.displayName),
          ),
          ProfileDetailRow('个人简介', _status('bio', preview.profile.bio)),
          for (final field in ReadingField.values)
            ProfileDetailRow(
              field.label,
              _status(field.name, preview.profile.reading[field]),
            ),
          const ProfileDetailRow('登录邮箱和手机号', '始终保密'),
        ],
      ),
    ),
  );
}
