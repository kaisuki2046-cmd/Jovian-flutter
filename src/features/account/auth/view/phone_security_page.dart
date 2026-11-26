import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/theme.dart';
import '../control/account_controller.dart';
import '../control/phone_binding_controller.dart';
import '../model/phone_binding.dart';
import '../model/session.dart';

class PhoneSecurityPage extends StatelessWidget {
  const PhoneSecurityPage({
    super.key,
    required this.account,
    required this.owner,
  });

  final AccountController account;
  final String owner;

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('手机号')),
    body: SafeArea(
      top: false,
      child: ListenableBuilder(
        listenable: account,
        builder: (context, _) {
          final member = account.session;
          if (account.memberId != owner ||
              member == null ||
              member.socialProvider != null) {
            return const Padding(
              padding: jovianPagePadding,
              child: Text('请使用原账户登录后管理手机号。'),
            );
          }
          return _PhoneBindingPanel(
            key: ValueKey(owner),
            account: account,
            member: member,
          );
        },
      ),
    ),
  );
}

class _PhoneBindingPanel extends StatefulWidget {
  const _PhoneBindingPanel({
    super.key,
    required this.account,
    required this.member,
  });

  final AccountController account;
  final AccountSession member;

  @override
  State<_PhoneBindingPanel> createState() => _PhoneBindingPanelState();
}

class _PhoneBindingPanelState extends State<_PhoneBindingPanel> {
  late final _controller = PhoneBindingController(
    widget.account.phoneBinding(widget.member.id),
    usesEmail: widget.member.email != null,
    hasPassword: widget.member.hasPassword,
  );
  final _nextNumber = TextEditingController();
  final _nextCode = TextEditingController();
  final _originalCode = TextEditingController();
  final _password = TextEditingController();
  bool _editing = false;
  bool _showNextProof = false;

  Iterable<TextEditingController> get _fields => [
    _nextNumber,
    _nextCode,
    _originalCode,
    _password,
  ];

  @override
  void dispose() {
    _controller.dispose();
    for (final field in _fields) {
      field.dispose();
    }
    super.dispose();
  }

  void _toggleEditing() {
    FocusManager.instance.primaryFocus?.unfocus();
    for (final field in _fields) {
      field.clear();
    }
    _controller.clearProofs();
    setState(() {
      _editing = !_editing;
      _showNextProof = false;
    });
  }

  Future<void> _sendCode(BindingCodeTarget target) async {
    final sent = await _controller.send(target, _nextNumber.text);
    if (!mounted || !sent) return;
    if (target == BindingCodeTarget.current) {
      _originalCode.clear();
    } else {
      _nextCode.clear();
      if (!_showNextProof) setState(() => _showNextProof = true);
    }
  }

  Future<void> _confirm() async {
    FocusManager.instance.primaryFocus?.unfocus();
    final saved = await _controller.confirm(
      _nextNumber.text,
      _nextCode.text,
      _originalCode.text,
      _password.text,
    );
    if (!mounted || !saved) return;
    for (final field in _fields) {
      field.clear();
    }
    setState(() => _editing = false);
  }

  Widget _panel(List<Widget> children) => Card(
    margin: const EdgeInsets.only(bottom: 12),
    child: Padding(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: children,
      ),
    ),
  );

  Widget _challengeField(
    BindingChallenge? challenge,
    TextEditingController field,
    String label, {
    required bool busy,
  }) => Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(switch (challenge?.localInbox) {
        null => '请重新获取新手机号验证码。',
        true => '请在本机虚拟服务商收件箱查看验证码。',
        false => '验证码已发送。',
      }),
      const SizedBox(height: 8),
      TextField(
        controller: field,
        enabled: !busy && challenge != null,
        maxLength: 6,
        keyboardType: TextInputType.number,
        autofillHints: const [AutofillHints.oneTimeCode],
        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
        decoration: InputDecoration(labelText: label, counterText: ''),
      ),
    ],
  );

  Widget _editor(bool busy) {
    final current = _controller.currentChallenge;
    final next = _controller.nextChallenge;
    final verifyCurrent = _controller.requiresCurrent;
    return _panel([
      Text(verifyCurrent ? '请验证原手机号和新手机号。' : '请验证待绑定手机号，并输入账户密码。'),
      if (verifyCurrent) ...[
        const SizedBox(height: 8),
        OutlinedButton(
          onPressed: busy ? null : () => _sendCode(BindingCodeTarget.current),
          child: Text(current == null ? '获取原手机号验证码' : '重新获取原手机号验证码'),
        ),
        if (current != null)
          _challengeField(current, _originalCode, '原手机号验证码', busy: busy),
      ],
      const SizedBox(height: 12),
      TextField(
        controller: _nextNumber,
        enabled: !busy,
        maxLength: 32,
        keyboardType: TextInputType.phone,
        onChanged: (_) {
          if (_controller.nextChallenge != null) _nextCode.clear();
          _controller.invalidateNext();
        },
        decoration: const InputDecoration(
          labelText: '待绑定手机号',
          hintText: '大陆号码或 + 国际区号',
          counterText: '',
        ),
      ),
      const SizedBox(height: 8),
      OutlinedButton(
        onPressed: busy ? null : () => _sendCode(BindingCodeTarget.next),
        child: Text(next == null ? '获取新手机号验证码' : '重新获取新手机号验证码'),
      ),
      if (next != null || _showNextProof) ...[
        _challengeField(next, _nextCode, '新手机号验证码', busy: busy),
        if (!verifyCurrent) ...[
          const SizedBox(height: 12),
          TextField(
            controller: _password,
            enabled: !busy,
            obscureText: true,
            autocorrect: false,
            enableSuggestions: false,
            decoration: const InputDecoration(labelText: '用于确认的账户密码'),
          ),
        ],
        const SizedBox(height: 12),
        FilledButton(
          onPressed: busy || next == null ? null : _confirm,
          child: const Text('确认绑定手机号'),
        ),
      ],
    ]);
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _controller,
    builder: (context, _) {
      final theme = Theme.of(context);
      final phone = _controller.phone;
      final available =
          widget.account.capabilities?.phoneCodesAvailable != false;
      final busy = _controller.busy;
      return ListView(
        padding: jovianPagePadding,
        keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
        children: [
          if (_controller.loaded)
            _panel([
              Text('当前绑定手机号', style: theme.textTheme.titleSmall),
              const SizedBox(height: 6),
              Text(phone == null ? '尚未绑定手机号' : maskAccountPhone(phone)),
              const SizedBox(height: 12),
              if (!available)
                const Text('短信验证码服务暂不可用。')
              else if (_controller.canBind)
                OutlinedButton(
                  onPressed: busy ? null : _toggleEditing,
                  child: Text(
                    _editing
                        ? '取消'
                        : phone == null
                        ? '绑定手机号'
                        : '换绑手机号',
                  ),
                ),
            ])
          else if (!busy)
            OutlinedButton(
              onPressed: _controller.load,
              child: const Text('重新加载手机号'),
            ),
          if (_editing && available && _controller.canBind) _editor(busy),
          if (busy) const LinearProgressIndicator(),
          if (_controller.notice case final notice?)
            Semantics(liveRegion: true, child: Text(notice)),
          if (_controller.error case final error?)
            Semantics(
              liveRegion: true,
              child: Text(
                error,
                style: TextStyle(color: theme.colorScheme.error),
              ),
            ),
        ],
      );
    },
  );
}
