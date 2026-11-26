import 'package:flutter/services.dart';
import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../../../ui/theme.dart';
import '../../model/account_section.dart';
import '../../settings/model/agreements.dart';
import '../../profile/view/profile_dashboard.dart';
import '../../settings/view/account_settings_page.dart';
import '../../settings/view/agreement_document_page.dart';
import '../../view/account_section_links.dart';
import '../control/account_controller.dart';
import '../model/password.dart';
import '../model/session.dart';
import 'deletion_receipt_notice.dart';
import 'password_recovery_dialog.dart';

class AccountPage extends StatefulWidget {
  const AccountPage({
    super.key,
    required this.account,
    this.standalone = false,
    this.active = true,
    this.themeMode = ThemeMode.system,
    this.onThemeModeChanged,
    this.openMessages,
    this.onWelcomeExit,
  });

  final AccountController account;
  final bool standalone;
  final bool active;
  final ThemeMode themeMode;
  final ValueChanged<ThemeMode>? onThemeModeChanged;
  final VoidCallback? openMessages;
  final VoidCallback? onWelcomeExit;

  @override
  State<AccountPage> createState() => _AccountPageState();
}

class _AccountPageState extends State<AccountPage> {
  final _address = TextEditingController();
  final _password = TextEditingController();
  final _confirmation = TextEditingController();
  final _name = TextEditingController();
  final _code = TextEditingController();
  AuthMethod _method = AuthMethod.password;
  AgreementCatalog? _accepted;
  AgreementDocument? _aiAccepted;
  ({String address, SignInCodeChallenge issued})? _challenge;
  bool _upgrade = false;
  bool _passwordVisible = false;
  String? _validation;
  String? _recoveredPhone;

  AccountController get _account => widget.account;

  @override
  void dispose() {
    for (final field in [_address, _password, _confirmation, _name, _code]) {
      field.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
    listenable: _account,
    builder: (context, _) {
      final session = _account.session;
      final showDashboard = !widget.standalone && session != null && !_upgrade;
      final renewAgreement =
          widget.standalone &&
          session != null &&
          _account.agreementState?.requiredAccepted != true;
      final statusPadding = showDashboard
          ? const EdgeInsets.symmetric(horizontal: 16)
          : EdgeInsets.zero;
      return Scaffold(
        appBar: showDashboard || widget.standalone
            ? null
            : AppBar(title: const UiText('个人中心')),
        body: SafeArea(
          top: showDashboard || widget.standalone,
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                maxWidth: widget.standalone ? 480 : double.infinity,
              ),
              child: AutofillGroup(
                child: ListView(
                  padding: showDashboard ? EdgeInsets.zero : jovianPagePadding,
                  keyboardDismissBehavior:
                      ScrollViewKeyboardDismissBehavior.onDrag,
                  children: [
                    if (widget.standalone) const _WelcomeBrand(),
                    if (_account.busy) const LinearProgressIndicator(),
                    if (_account.notice case final message?)
                      Padding(
                        padding: statusPadding,
                        child: Semantics(
                          liveRegion: true,
                          child: UiText(message),
                        ),
                      ),
                    if (_account.deletion case final deletion?
                        when _account.restored && session == null)
                      DeletionReceiptNotice(service: deletion),
                    if ((_account.catalog == null ||
                            _account.capabilities == null ||
                            (session != null &&
                                _account.agreementState == null) ||
                            _account.notice != null) &&
                        !_account.busy)
                      Padding(
                        padding: statusPadding,
                        child: Align(
                          alignment: Alignment.centerLeft,
                          child: TextButton(
                            onPressed: _account.initialize,
                            child: const UiText('刷新账号与协议'),
                          ),
                        ),
                      ),
                    if (renewAgreement)
                      ..._renewAgreementForm(session)
                    else if (showDashboard)
                      ProfileDashboard(
                        account: _account,
                        openSettings: _openSettings,
                        openMessages: widget.openMessages,
                        active: widget.active,
                        onUpgrade: _beginUpgrade,
                      )
                    else
                      ..._form(session != null),
                  ],
                ),
              ),
            ),
          ),
        ),
      );
    },
  );

  void _openSettings() {
    AccountSectionLinks.openPage(
      context,
      AccountSection.settings,
      () => AccountSettingsPage(
        account: _account,
        themeMode: widget.themeMode,
        onThemeModeChanged: widget.onThemeModeChanged,
        onSignedOut: () {
          if (mounted) _clearForm();
        },
      ),
    );
  }

  void _beginUpgrade() => setState(() {
    _accepted = null;
    _aiAccepted = null;
    _upgrade = true;
    _validation = null;
  });

  List<Widget> _renewAgreementForm(AccountSession session) => [
    const UiText('请阅读并确认当前的《用户服务协议》和《隐私政策》后继续。'),
    const SizedBox(height: 12),
    FilledButton(
      onPressed: _account.busy || _account.catalog == null
          ? null
          : () => _reviewRequiredAgreement(session.scope),
      child: const UiText('阅读并确认协议'),
    ),
    TextButton(
      onPressed: _account.busy
          ? null
          : () async {
              await _account.signOut();
              if (mounted && _account.session == null) _clearForm();
            },
      child: const UiText('退出登录'),
    ),
  ];

  Future<void> _reviewRequiredAgreement(String scope) async {
    final catalog = _account.catalog;
    if (catalog != null &&
        await confirmAccountAgreements(context, catalog) &&
        mounted &&
        _account.session?.scope == scope &&
        identical(_account.catalog, catalog)) {
      await _account.acceptRequired(catalog);
    }
  }

  List<Widget> _form(bool upgrading) {
    final catalog = _account.catalog;
    final capabilities = _account.capabilities;
    final registering = _method == AuthMethod.register;
    final phoneCode = _method == AuthMethod.phoneCode;
    final parsed = AccountIdentifier.parse(_address.text);
    final verifyPhone = registering && _phoneRegistrationNeedsCode(parsed);
    final codeDisabled = phoneCode && capabilities?.phoneCodesAvailable != true;
    final needsCode =
        phoneCode ||
        (registering &&
            parsed?.isPhone == false &&
            capabilities?.emailRegistrationAvailable == true &&
            capabilities?.emailRegistrationCodeRequired == true);
    final disabled = _account.busy || !_account.restored;
    final small = Theme.of(context).textTheme.bodySmall;
    return [
      if (upgrading)
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton(
            onPressed: disabled ? null : widget.onWelcomeExit ?? _clearForm,
            child: const UiText('返回游客资料'),
          ),
        ),
      if (!upgrading && !widget.standalone) ...[
        Row(
          children: [
            CircleAvatar(
              radius: 23,
              backgroundColor: Theme.of(context).colorScheme.primaryContainer,
              foregroundColor: Theme.of(context).colorScheme.onPrimaryContainer,
              child: const Icon(Icons.person_outline),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: UiText(
                '登录或注册',
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
      ],
      Wrap(
        spacing: 8,
        children: [
          for (final (method, label) in [
            (AuthMethod.password, '密码登录'),
            (AuthMethod.register, '注册'),
            if (capabilities?.phoneCodesAvailable == true)
              (AuthMethod.phoneCode, '短信验证码登录'),
          ])
            ChoiceChip(
              label: UiText(label),
              selected: _method == method,
              onSelected: disabled ? null : (_) => _selectMethod(method),
            ),
        ],
      ),
      const SizedBox(height: 12),
      TextField(
        controller: _address,
        enabled: !disabled,
        autofillHints: phoneCode
            ? const [AutofillHints.telephoneNumber]
            : const [AutofillHints.username],
        autocorrect: false,
        textInputAction: verifyPhone
            ? TextInputAction.go
            : TextInputAction.next,
        onSubmitted: verifyPhone && !disabled ? (_) => _submit(_method) : null,
        keyboardType: phoneCode
            ? TextInputType.phone
            : TextInputType.emailAddress,
        decoration: InputDecoration(
          labelText: context.uiLabel(phoneCode ? '手机号' : '手机号或邮箱'),
        ),
        onChanged: (_) => setState(() {
          _challenge = null;
          _code.clear();
          _validation = null;
        }),
      ),
      const SizedBox(height: 8),
      if (verifyPhone || phoneCode) ...[
        UiText('未注册的手机号验证后会自动创建账号。', style: small),
        const SizedBox(height: 8),
      ],
      if (registering && !verifyPhone) ...[
        TextField(
          controller: _name,
          enabled: !disabled,
          autofillHints: const [AutofillHints.nickname],
          textInputAction: TextInputAction.next,
          maxLength: 40,
          decoration: InputDecoration(labelText: context.uiLabel('昵称')),
        ),
        const SizedBox(height: 8),
      ],
      if (!phoneCode && !verifyPhone)
        TextField(
          controller: _password,
          enabled: !disabled,
          obscureText: !_passwordVisible,
          autocorrect: false,
          enableSuggestions: false,
          textInputAction: registering
              ? TextInputAction.next
              : TextInputAction.done,
          onSubmitted: !registering && !disabled
              ? (_) => _submit(_method)
              : null,
          autofillHints: [
            registering ? AutofillHints.newPassword : AutofillHints.password,
          ],
          decoration: InputDecoration(
            labelText: context.uiLabel('密码'),
            helperText: registering
                ? context.uiLanguage.minimumCharacters(minimumPasswordLength)
                : null,
            suffixIcon: IconButton(
              tooltip: context.uiLabel(_passwordVisible ? '隐藏密码' : '显示密码'),
              onPressed: disabled
                  ? null
                  : () => setState(() => _passwordVisible = !_passwordVisible),
              icon: Icon(
                _passwordVisible
                    ? Icons.visibility_off_outlined
                    : Icons.visibility_outlined,
              ),
            ),
          ),
        ),
      if (registering && !verifyPhone) ...[
        const SizedBox(height: 8),
        TextField(
          controller: _confirmation,
          enabled: !disabled,
          obscureText: !_passwordVisible,
          autocorrect: false,
          enableSuggestions: false,
          autofillHints: const [AutofillHints.newPassword],
          textInputAction: needsCode
              ? TextInputAction.next
              : TextInputAction.done,
          onSubmitted: !needsCode && !disabled ? (_) => _submit(_method) : null,
          decoration: InputDecoration(labelText: context.uiLabel('确认密码')),
        ),
      ],
      if (needsCode) ...[
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: _code,
                enabled: !disabled && !codeDisabled,
                autofillHints: const [AutofillHints.oneTimeCode],
                keyboardType: TextInputType.number,
                textInputAction: TextInputAction.done,
                onSubmitted: disabled || codeDisabled
                    ? null
                    : (_) => _submit(_method),
                maxLength: 6,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                decoration: InputDecoration(
                  labelText: context.uiLabel('验证码'),
                  counterText: '',
                ),
              ),
            ),
            TextButton(
              onPressed: disabled || codeDisabled ? null : _sendCode,
              child: UiText(_challenge == null ? '发送验证码' : '重新发送'),
            ),
          ],
        ),
        if (_challenge case final challenge?)
          Semantics(
            liveRegion: true,
            child: UiText(
              challenge.issued.localInbox
                  ? '请在本机 virtual-auth-provider/inbox 查找最新 TXT。'
                  : '验证码已发送，请查收。',
              style: small,
            ),
          ),
      ],
      const SizedBox(height: 12),
      if (!registering &&
          !phoneCode &&
          _recoveredPhone == parsed?.value &&
          _recoveredPhone != null) ...[
        Semantics(liveRegion: true, child: const UiText('密码已重置，请使用新密码登录。')),
        const SizedBox(height: 8),
      ],
      if (_validation case final message?) ...[
        Semantics(
          liveRegion: true,
          child: UiText(
            message,
            style: TextStyle(color: Theme.of(context).colorScheme.error),
          ),
        ),
        const SizedBox(height: 8),
      ],
      FilledButton(
        onPressed: disabled || codeDisabled ? null : () => _submit(_method),
        child: UiText(
          verifyPhone
              ? '继续验证手机号'
              : registering
              ? '创建账号'
              : '登录',
        ),
      ),
      if (capabilities != null)
        UiText(
          capabilities.localSocialProviders.isEmpty
              ? '微信和 QQ 登录暂不可用。'
              : '第三方登录使用本机模拟身份。',
          style: small,
          textAlign: TextAlign.center,
        ),
      Wrap(
        alignment: WrapAlignment.center,
        spacing: 8,
        children: [
          TextButton(
            onPressed: disabled ? null : () => _submit(AuthMethod.wechat),
            child: const UiText('微信登录'),
          ),
          TextButton(
            onPressed: disabled ? null : () => _submit(AuthMethod.qq),
            child: const UiText('QQ 登录'),
          ),
          if (!registering && capabilities?.phoneCodesAvailable == true)
            TextButton(
              onPressed: disabled ? null : _openRecovery,
              child: const UiText('找回账号'),
            ),
          if (!upgrading)
            TextButton(
              onPressed: disabled ? null : () => _submit(AuthMethod.guest),
              child: const UiText('游客体验'),
            ),
        ],
      ),
      Row(
        children: [
          Semantics(
            container: true,
            child: Checkbox(
              shape: const CircleBorder(),
              semanticLabel: context.uiLabel('同意登录协议'),
              value: catalog != null && identical(_accepted, catalog),
              onChanged: disabled || catalog == null
                  ? null
                  : (checked) => setState(
                      () => _accepted = checked == true ? catalog : null,
                    ),
            ),
          ),
          Expanded(
            child: Wrap(
              crossAxisAlignment: WrapCrossAlignment.center,
              children: [
                UiText('我已阅读并同意', style: small),
                if (catalog != null) ...[
                  AgreementLink(document: catalog.terms, compact: true),
                  AgreementLink(document: catalog.privacy, compact: true),
                ] else
                  UiText('《用户服务协议》和《隐私政策》', style: small),
              ],
            ),
          ),
        ],
      ),
      if (catalog != null)
        Row(
          children: [
            Semantics(
              container: true,
              child: Checkbox(
                shape: const CircleBorder(),
                semanticLabel: context.uiLabel('同意全部 AI 授权'),
                value: identical(_aiAccepted, catalog.ai),
                onChanged: disabled
                    ? null
                    : (checked) => setState(
                        () => _aiAccepted = checked == true ? catalog.ai : null,
                      ),
              ),
            ),
            Expanded(
              child: Wrap(
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  UiText('同时开启全部 AI 在线解读（可选）', style: small),
                  AgreementLink(document: catalog.ai, compact: true),
                ],
              ),
            ),
          ],
        ),
    ];
  }

  void _selectMethod(AuthMethod method) => setState(() {
    if (_method != method) {
      _password.clear();
      _confirmation.clear();
    }
    _method = method;
    _challenge = null;
    _code.clear();
    _validation = null;
    _passwordVisible = false;
  });

  void _show(String message) => setState(() => _validation = message);

  void _clearForm() => setState(() {
    _address.clear();
    _password.clear();
    _confirmation.clear();
    _name.clear();
    _code.clear();
    _accepted = null;
    _aiAccepted = null;
    _challenge = null;
    _validation = null;
    _recoveredPhone = null;
    _method = AuthMethod.password;
    _upgrade = false;
  });

  Future<void> _sendCode() async {
    final identifier = AccountIdentifier.parse(_address.text);
    if (identifier == null ||
        identifier.isPhone != (_method == AuthMethod.phoneCode)) {
      _show(_method == AuthMethod.phoneCode ? '请输入有效的手机号。' : '请输入有效的邮箱。');
      return;
    }
    final catalog = _account.catalog;
    if (catalog == null) {
      _show('协议暂时无法加载，请刷新后重试。');
      return;
    }
    if (!await _acceptRequired(catalog) || !mounted) return;
    setState(() {
      _validation = null;
      _challenge = null;
      _code.clear();
    });
    final challenge = await _account.sendCode(identifier);
    if (!mounted || challenge == null) return;
    setState(() => _challenge = (address: identifier.value, issued: challenge));
  }

  Future<void> _submit(AuthMethod method) async {
    setState(() => _validation = null);
    final catalog = _account.catalog;
    if (catalog == null) {
      _show('协议暂时无法加载，请刷新后重试。');
      return;
    }
    final capabilities = _account.capabilities;
    if (capabilities == null) {
      _show('账号服务暂时无法连接，请刷新后重试。');
      return;
    }
    final social = method == AuthMethod.wechat || method == AuthMethod.qq;
    if (social && !capabilities.localSocialProviders.contains(method.name)) {
      _show('暂未接入${method == AuthMethod.wechat ? '微信' : 'QQ'}登录服务。');
      return;
    }
    if (!await _acceptRequired(catalog) || !mounted) return;
    final input = <String, Object?>{};
    if (!social && method != AuthMethod.guest) {
      final identifier = AccountIdentifier.parse(_address.text);
      final phoneCode = method == AuthMethod.phoneCode;
      final registering = method == AuthMethod.register;
      if (identifier == null || (phoneCode && !identifier.isPhone)) {
        _show(phoneCode ? '请输入有效的手机号。' : '请输入有效的手机号或邮箱。');
        return;
      }
      if (registering &&
          identifier.isPhone &&
          !capabilities.phoneRegistrationWithoutCode) {
        if (!capabilities.phoneCodesAvailable) {
          _show('当前暂不支持手机号注册，请使用邮箱。');
          return;
        }
        FocusManager.instance.primaryFocus?.unfocus();
        _selectMethod(AuthMethod.phoneCode);
        return;
      }
      if (registering &&
          !identifier.isPhone &&
          !capabilities.emailRegistrationAvailable) {
        _show('当前邮箱注册服务暂不可用。');
        return;
      }
      input[identifier.field] = identifier.value;
      if (!phoneCode) {
        final password = _password.text;
        final length = password.runes.length;
        if (length < (registering ? minimumPasswordLength : 1) ||
            length > maximumPasswordLength) {
          _show(
            registering
                ? '密码需要 $minimumPasswordLength 至 $maximumPasswordLength 个字符。'
                : '请输入有效的密码。',
          );
          return;
        }
        input['password'] = password;
      }
      if (registering) {
        if (_password.text != _confirmation.text) {
          _show('两次输入的密码不一致。');
          return;
        }
        if (_name.text.trim().isEmpty) {
          _show('请输入昵称。');
          return;
        }
        input['displayName'] = _name.text.trim();
      }
      if (phoneCode ||
          (registering &&
              !identifier.isPhone &&
              capabilities.emailRegistrationCodeRequired)) {
        final challenge = _challenge;
        if (challenge == null ||
            challenge.address != identifier.value ||
            _code.text.length != 6) {
          _show('请先向当前手机号或邮箱发送验证码，再输入 6 位验证码。');
          return;
        }
        input['challengeId'] = challenge.issued.id;
        input['code'] = _code.text;
      }
    }
    FocusManager.instance.primaryFocus?.unfocus();
    if (await _account.signIn(
          method,
          input,
          catalog,
          grantAi: identical(_aiAccepted, catalog.ai),
        ) &&
        mounted) {
      _clearForm();
      widget.onWelcomeExit?.call();
    }
  }

  bool _phoneRegistrationNeedsCode(AccountIdentifier? identifier) =>
      identifier?.isPhone == true &&
      _account.capabilities?.phoneCodesAvailable == true &&
      _account.capabilities?.phoneRegistrationWithoutCode == false;

  Future<bool> _acceptRequired(AgreementCatalog catalog) async {
    if (identical(catalog, _accepted)) return true;
    if (!await confirmAccountAgreements(context, catalog) || !mounted)
      return false;
    if (_account.busy || !identical(catalog, _account.catalog)) return false;
    setState(() => _accepted = catalog);
    return true;
  }

  Future<void> _openRecovery() async {
    final identifier = AccountIdentifier.parse(_address.text);
    if (identifier == null || !identifier.isPhone) {
      _show('请输入账号已绑定的手机号。');
      return;
    }
    final catalog = _account.catalog;
    if (catalog == null) {
      _show('协议暂时无法加载，请刷新后重试。');
      return;
    }
    if (!await _acceptRequired(catalog) || !mounted) return;
    FocusScope.of(context).unfocus();
    if (_validation != null) setState(() => _validation = null);
    final phone = identifier.value;
    final saved = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (_) => PasswordRecoveryDialog(account: _account, phone: phone),
    );
    if (saved != true || !mounted) return;
    _password.clear();
    _selectMethod(AuthMethod.password);
    setState(() => _recoveredPhone = phone);
  }
}

class _WelcomeBrand extends StatelessWidget {
  const _WelcomeBrand();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 18),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        spacing: 5,
        children: [
          ExcludeSemantics(
            child: Stack(
              alignment: Alignment.center,
              children: [
                CircleAvatar(
                  radius: 25,
                  backgroundColor: theme.colorScheme.primaryContainer,
                  foregroundColor: theme.colorScheme.onPrimaryContainer,
                  child: const Icon(Icons.public, size: 30),
                ),
                Transform.rotate(
                  angle: -.38,
                  child: Container(
                    width: 78,
                    height: 24,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(50),
                      border: Border.all(
                        color: theme.colorScheme.primary,
                        width: 1.4,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Semantics(
            header: true,
            child: UiText('木星环', style: theme.textTheme.headlineMedium),
          ),
          UiText('在这里，慢慢认识自己', style: theme.textTheme.bodyMedium),
        ],
      ),
    );
  }
}
