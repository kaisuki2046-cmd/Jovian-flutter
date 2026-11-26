import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../../../ui/theme.dart';
import '../control/account_controller.dart';

class NicknameSetupGate extends StatelessWidget {
  const NicknameSetupGate({
    super.key,
    required this.account,
    required this.child,
  });

  final AccountController account;
  final Widget child;

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: account,
    child: child,
    builder: (context, navigator) {
      final owner = account.nicknameSetupMember?.id;
      return Stack(
        fit: StackFit.expand,
        children: [
          Offstage(
            offstage: owner != null,
            child: TickerMode(
              enabled: owner == null,
              child: ExcludeFocus(excluding: owner != null, child: navigator!),
            ),
          ),
          if (owner != null)
            HeroControllerScope.none(
              child: Navigator(
                key: ValueKey(owner),
                pages: [
                  MaterialPage<void>(
                    child: _NicknamePage(account: account, owner: owner),
                  ),
                ],
                onDidRemovePage: (_) {},
              ),
            ),
        ],
      );
    },
  );
}

class _NicknamePage extends StatefulWidget {
  const _NicknamePage({required this.account, required this.owner});

  final AccountController account;
  final String owner;

  @override
  State<_NicknamePage> createState() => _NicknamePageState();
}

class _NicknamePageState extends State<_NicknamePage> {
  final _nickname = TextEditingController();
  bool _showNotice = true;

  @override
  void dispose() {
    _nickname.dispose();
    super.dispose();
  }

  bool get _canSave =>
      !widget.account.busy &&
      _nickname.text.trim().isNotEmpty &&
      _nickname.text.trim().runes.length <= 40;

  Future<void> _save() async {
    if (!_canSave) return;
    FocusScope.of(context).unfocus();
    setState(() => _showNotice = true);
    await widget.account.completeNickname(widget.owner, _nickname.text);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: SingleChildScrollView(
              padding: jovianPagePadding,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Semantics(
                    header: true,
                    child: UiText(
                      '设置昵称',
                      style: theme.textTheme.headlineMedium,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const UiText('设置一个专属昵称后开始使用木星环。'),
                  const SizedBox(height: 18),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        spacing: 12,
                        children: [
                          Semantics(
                            container: true,
                            child: TextField(
                              controller: _nickname,
                              enabled: !widget.account.busy,
                              maxLength: 40,
                              textInputAction: TextInputAction.done,
                              autofillHints: const [AutofillHints.nickname],
                              onChanged: (_) =>
                                  setState(() => _showNotice = false),
                              onSubmitted: (_) => _save(),
                              decoration: InputDecoration(
                                labelText: '昵称',
                                errorText:
                                    _nickname.text.trim().runes.length > 40
                                    ? '昵称最多 40 个字符。'
                                    : null,
                              ),
                            ),
                          ),
                          if (_showNotice && widget.account.notice != null)
                            Semantics(
                              container: true,
                              liveRegion: true,
                              child: Text(
                                widget.account.notice!,
                                style: TextStyle(
                                  color: theme.colorScheme.error,
                                ),
                              ),
                            ),
                          FilledButton(
                            onPressed: _canSave ? _save : null,
                            child: Text(
                              widget.account.busy ? '处理中…' : '保存昵称并继续',
                            ),
                          ),
                          OutlinedButton(
                            onPressed: widget.account.busy
                                ? null
                                : () {
                                    setState(() => _showNotice = true);
                                    widget.account.signOut();
                                  },
                            child: const UiText('退出登录'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
