import 'package:flutter/foundation.dart';

import '../../../../shared/http/json_client.dart';
import '../../history/requests/report_history_api.dart';
import '../../profile/model/profile_preview.dart';
import '../../profile/requests/profile_preview_api.dart';
import '../../reading-profile/model/account_birth_fields.dart';
import '../../reading-profile/model/account_reading_profile.dart';
import '../../reading-profile/requests/account_birth_api.dart';
import '../../settings/model/agreements.dart';
import '../../settings/requests/agreements_api.dart';
import '../../settings/requests/privacy_requests_api.dart';
import '../model/account_deletion.dart';
import '../model/password.dart';
import '../model/session.dart';
import '../requests/account_api.dart';
import '../requests/account_deletion_api.dart';
import '../requests/phone_binding_api.dart';
import 'account_deletion_service.dart';
import 'password_recovery_controller.dart';

class AccountController extends ChangeNotifier {
  AccountController(
    this._account,
    this._agreements, {
    AccountDeletionDevice? deletionDevice,
  }) : deletion = deletionDevice == null
           ? null
           : AccountDeletionService(
               AccountDeletionApi(_account),
               deletionDevice,
             );

  final AccountApi _account;
  final AgreementsApi _agreements;
  final AccountDeletionService? deletion;
  late final reports = ReportHistoryApi(_account);
  late final _birth = AccountBirthApi(_account);
  late final _profilePreview = ProfilePreviewApi(_account);

  AccountSession? _session;
  AgreementCatalog? _catalog;
  AgreementState? _agreementState;
  AuthCapabilities? _capabilities;
  bool _restored = false;
  bool _busy = false;
  bool _sessionChanging = false;
  bool _closed = false;
  String? _notice;

  AccountSession? get session => _session;
  AccountSession? get nicknameSetupMember =>
      _session?.nicknameRequired == true ? _session : null;
  AccountSession? get authorizedSession =>
      _agreementState?.requiredAccepted == true && nicknameSetupMember == null
      ? _session
      : null;
  AgreementCatalog? get catalog => _catalog;
  AgreementState? get agreementState => _agreementState;
  AuthCapabilities? get capabilities => _capabilities;
  bool get restored => _restored;
  bool get busy => _busy;
  bool get sessionChanging => _sessionChanging;
  String? get notice => _notice;

  Future<String?> readNativeSession() => _account.readNativeSession();

  PrivacyRequestsApi privacyRequests(String owner) =>
      PrivacyRequestsApi(_account, owner, () => memberId == owner);

  PhoneBindingApi phoneBinding(String owner) =>
      PhoneBindingApi(_account, owner, () => memberId == owner);

  PasswordRecoveryController passwordRecovery(String phone) =>
      PasswordRecoveryController(
        _account,
        phone,
        keepGuest: session?.kind == AccountKind.guest,
      );

  Future<DeletionSetup> prepareDeletion(String owner) =>
      deletion!.api.prepare(owner, () => memberId == owner);

  Future<PasswordSmsChallenge> issueDeletionCode(String owner) =>
      deletion!.api.issueCode(owner, () => memberId == owner);

  Future<void> deleteAccount(
    String owner,
    DeletionSetup setup,
    Map<String, Object?> proof,
  ) async {
    final service = deletion;
    if (service == null || memberId != owner || _busy) {
      throw const JsonRequestError('account_changed', status: 401);
    }
    _busy = true;
    _sessionChanging = true;
    _notice = null;
    notifyListeners();
    try {
      final request = SavedDeletion(receipt: setup.receipt, owner: owner);
      await service.submit(
        request,
        proof,
        () => !_closed && _session?.scope == 'member:$owner',
      );
      _session = null;
      _agreementState = null;
      try {
        await _account.clearNativeSession();
      } catch (_) {
        _notice = '账号会话已失效，本机登录信息清理暂未完成。';
      }
      await service.clearDevice(request);
    } finally {
      _sessionChanging = false;
      _busy = false;
      if (!_closed) notifyListeners();
    }
  }

  Future<void> probeIdentityVerification(
    String memberId, {
    bool submit = false,
  }) => _account.probeIdentityVerification(
    submit: submit,
    isCurrent: () => socialMemberId == memberId,
  );

  Future<PasswordSmsChallenge> issuePasswordSetup(String owner) =>
      _account.issuePasswordSetup(owner, isCurrent: () => memberId == owner);

  Future<void> changePassword(String owner, String current, String next) =>
      _account.changePassword(
        owner,
        current,
        next,
        isCurrent: () => memberId == owner,
      );

  Future<void> setupPassword(
    String owner,
    PasswordSmsChallenge challenge,
    String code,
    String next,
  ) async {
    final updated = await _account.setupPassword(
      owner,
      challenge.id,
      code,
      next,
      isCurrent: () => memberId == owner,
    );
    if (memberId != owner) return;
    _session = updated;
    notifyListeners();
  }

  Future<bool> updateProfile(
    String memberId,
    Map<String, Object?> profile,
  ) async {
    var saved = false;
    await _run(() async {
      try {
        final member = await _account.updateProfile(
          memberId,
          profile,
          isCurrent: () => socialMemberId == memberId,
        );
        if (member.id == memberId && socialMemberId == memberId) {
          _session = member;
          saved = true;
        }
      } on JsonRequestError catch (error) {
        if (error.status != 409) rethrow;
        _notice = '这个昵称已被使用，请换一个。';
      }
    }, failure: '暂时无法保存个人资料，请重试。');
    return saved;
  }

  Future<void> completeNickname(String owner, String draft) async {
    final member = nicknameSetupMember;
    final name = draft.trim();
    if (member == null ||
        member.id != owner ||
        name.isEmpty ||
        name.runes.length > 40)
      return;
    await _run(() async {
      bool isCurrent() => !_closed && nicknameSetupMember?.id == owner;
      try {
        final updated = await _account.updateProfile(owner, {
          'displayName': name,
          'bio': member.bio,
        }, isCurrent: isCurrent);
        if (!isCurrent()) return;
        if (updated.id != owner || updated.nicknameRequired) {
          _notice = '暂时无法保存昵称，请刷新后重试。';
          return;
        }
        _session = updated;
      } on JsonRequestError catch (error) {
        if (error.status == 409) {
          _notice = '这个昵称已被使用，请换一个。';
        } else if (error.status == 401 || error.status == 403) {
          await _restore();
          if (isCurrent()) _notice = '登录状态已变更，请刷新后重试。';
        } else {
          rethrow;
        }
      }
    }, failure: '暂时无法保存昵称，请重试。');
  }

  String? get memberId {
    final session = authorizedSession;
    return !_closed && !_sessionChanging && session?.kind == AccountKind.member
        ? session!.id
        : null;
  }

  String? get socialMemberId => memberId;

  Future<ProfilePreview> readProfilePreview(
    String owner, {
    Future<void>? cancel,
  }) => _profilePreview.preview(
    owner,
    isCurrent: () => memberId == owner,
    cancel: cancel,
  );

  Future<VisitorProfile> readVisitorProfile(
    String viewer,
    String target, {
    Future<void>? cancel,
  }) => _profilePreview.visitor(
    viewer,
    target,
    isCurrent: () => memberId == viewer,
    cancel: cancel,
  );

  Future<AccountReadingProfile> readBirthSettings(
    String owner, {
    Future<void>? cancel,
  }) => _birth.readWithVisibility(
    owner,
    isCurrent: () => memberId == owner,
    cancel: cancel,
  );

  Future<AccountReadingProfile> saveBirthSettings(
    String owner,
    AccountReadingProfile expected,
    AccountReadingProfile profile, {
    Future<void>? cancel,
  }) => _birth.saveWithVisibility(
    owner,
    expected,
    profile,
    isCurrent: () => memberId == owner,
    cancel: cancel,
  );

  Future<AccountBirthFields> readBirthFields(
    String owner, {
    Future<void>? cancel,
  }) => _birth.read(owner, isCurrent: () => memberId == owner, cancel: cancel);

  Future<AccountBirthFields> confirmBirthFields(
    String owner,
    AccountBirthFields expected,
    AccountBirthFields profile, {
    Future<void>? cancel,
  }) => _birth.confirm(
    owner,
    expected,
    profile,
    isCurrent: () => memberId == owner,
    cancel: cancel,
  );

  Future<Map<String, Object?>> requestSocial(
    String memberId,
    List<String> path, {
    Map<String, Object?>? body,
    Map<String, String>? query,
  }) => _account.requestSocial(
    path,
    isCurrent: () => socialMemberId == memberId,
    body: body,
    query: query,
  );

  Future<void> initialize() => _run(_restore);

  Future<void> _restore() async {
    final previousScope = _session?.scope;
    _session = await _account.restore();
    _restored = true;
    if (previousScope != _session?.scope) _agreementState = null;
    await Future.wait([
      _account.capabilities().then((value) => _capabilities = value),
      _agreements.catalog().then((value) => _catalog = value),
      if (_session != null)
        _agreements.state().then((value) => _agreementState = value),
    ]);
  }

  Future<String?> sendCode(AccountIdentifier identifier) async {
    String? challenge;
    await _run(() async {
      challenge = await _account.sendCode(identifier);
      _notice = '验证码已发送，请查收。';
    }, failure: '发送验证码失败，请重试。');
    return challenge;
  }

  Future<bool> signIn(
    AuthMethod method,
    Map<String, Object?> input,
    AgreementCatalog accepted, {
    bool grantAi = false,
  }) async {
    var signedIn = false;
    await _run(
      () async {
        final session = await _account.signIn(method, input, accepted);
        _session = session;
        _agreementState = null;
        signedIn = true;
        _agreementState = grantAi
            ? await _agreements.grantAll(accepted.ai, source: 'first-use')
            : await _agreements.state();
        if (grantAi && _agreementState?.allAiGranted != true) {
          _notice = '部分 AI 授权未保存，可在隐私设置中查看或重试。';
        }
      },
      failure: '登录或注册失败，请重试。',
      changesSession: true,
    );
    return signedIn;
  }

  Future<void> acceptRequired(AgreementCatalog accepted) => _run(() async {
    _agreementState = await _agreements.acceptRequired(accepted);
  }, failure: '保存协议确认失败，请重试。');

  Future<void> choose(
    AgreementDocument document,
    String purpose,
    bool agreed,
  ) => _run(() async {
    _agreementState = await _agreements.choose(document, purpose, agreed);
  }, failure: '保存授权失败，请重试。');

  Future<void> grantAll(AgreementDocument document) => _run(() async {
    _agreementState = await _agreements.grantAll(document, source: 'settings');
    if (_agreementState?.allAiGranted != true) {
      _notice = '部分 AI 授权未保存，可在隐私设置中查看或重试。';
    }
  }, failure: '保存授权失败，请重试。');

  Future<void> signOut() => _run(
    () async {
      await _account.signOut();
      _session = null;
      _agreementState = null;
    },
    failure: '退出登录失败，请重试。',
    changesSession: true,
  );

  Future<void> _run(
    Future<void> Function() work, {
    String failure = '暂时无法连接账号服务，请重试。',
    bool changesSession = false,
  }) async {
    if (_busy || _closed) return;
    _busy = true;
    _sessionChanging = changesSession;
    _notice = null;
    notifyListeners();
    try {
      await work();
    } on JsonRequestError catch (error) {
      _notice = switch (error.status) {
        401 => '账号、密码或验证码有误，或者会话已过期。',
        409 => '资料已被使用或状态已变化，请检查后重试。',
        412 || 428 => '协议已更新，请刷新并阅读后重新确认。',
        410 || 422 => '验证码已过期或不正确，请重新核对。',
        429 => '操作太频繁，请稍后重试。',
        503 => '账号服务暂不可用，请稍后重试。',
        _ => failure,
      };
    } catch (_) {
      _notice = failure;
    } finally {
      _busy = false;
      _sessionChanging = false;
      if (!_closed) notifyListeners();
    }
  }

  @override
  void dispose() {
    _closed = true;
    _account.close();
    super.dispose();
  }
}
