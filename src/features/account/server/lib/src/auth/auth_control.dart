import 'package:convert/convert.dart';

import '../account_failure.dart';
import '../account_limits.dart';
import '../storage/account_auth_store.dart';
import 'password.dart';
import 'session_secret.dart';

typedef AuthOutcome = ({
  int status,
  Map<String, Object?>? body,
  String? secret,
});

class AuthControl {
  AuthControl(
    this._store,
    this._limits,
    this._now, {
    required this.localRegistration,
  });

  final AccountAuthStore _store;
  final AccountLimits _limits;
  final int Function() _now;
  final bool localRegistration;
  final _passwords = AccountPasswords();

  Map<String, Object?> get capabilities => {
    'localSocialProviders': [],
    'emailRegistrationCodeRequired': !localRegistration,
    'phoneRegistrationWithoutCode': localRegistration,
    'emailRegistrationAvailable': localRegistration,
    'phoneCodesAvailable': false,
  };

  Map<String, Object?> memberProfile(String? session) {
    final member = _store.memberBySession(session, _now()) ?? failAccount(401);
    return {'user': _store.ownerProfile(member)};
  }

  Map<String, Object?> restoreGuest(String? session) {
    final guest = _store.guestBySession(session, _now()) ?? failAccount(401);
    return _wireGuest(guest);
  }

  AuthOutcome startGuest(String? previous, String ip) {
    final now = _now();
    if (_store.memberBySession(previous, now) != null) failAccount(409);
    final active = _store.guestBySession(previous, now);
    if (active != null)
      return (status: 200, body: _wireGuest(active), secret: null);
    _limits.hit('guest-session-ip:$ip', 30, now);
    final secret = createSessionSecret();
    final guest = _store.createGuest(_newUuid(), sessionHash(secret)!, now);
    return (status: 201, body: _wireGuest(guest), secret: secret);
  }

  Future<AuthOutcome> authenticate({
    required bool registering,
    required String? previous,
    required String ip,
    required Map<String, Object?> input,
  }) async {
    _limits.hit('auth-ip:$ip', 30, _now());
    final password = input['password'];
    if (password is! String) failAccount(400);
    final length = password.runes.length;
    if (length < (registering ? 8 : 1) || length > 128) failAccount(400);
    final inputPhone = input['phone'];
    final inputEmail = input['email'];
    final hasPhone = input.containsKey('phone');
    final phone = hasPhone ? _normalizePhone(inputPhone) : null;
    final email = hasPhone ? null : _normalizeEmail(inputEmail);
    if (hasPhone
        ? phone == null || input.containsKey('email')
        : email == null) {
      failAccount(400);
    }
    final hasProof =
        input.containsKey('challengeId') || input.containsKey('code');
    if (registering && (!localRegistration || hasProof)) {
      failAccount(hasPhone ? 400 : 503);
    }
    _limits.hit(
      hasPhone ? 'auth-phone:$phone' : 'auth-email:$email',
      10,
      _now(),
    );
    final secret = createSessionSecret();
    final session = sessionHash(secret)!;
    final AccountRecord member;
    try {
      if (registering) {
        final name = input['displayName'];
        if (name is! String ||
            name.trim().isEmpty ||
            name.trim().runes.length > 40)
          failAccount(400);
        final credentials = await _passwords.hash(password);
        member =
            _store.register(
              id: _newUuid(),
              email: email,
              phone: phone,
              displayName: name.trim(),
              credentials: credentials,
              session: session,
              now: _now(),
              previousSession: previous,
            ) ??
            failAccount(409);
      } else {
        final existing = hasPhone
            ? _store.byPasswordPhone(phone!)
            : _store.byEmail(email!);
        if (!await _passwords.verify(password, existing?.credentials) ||
            existing == null)
          failAccount(401);
        if (!_store.createMemberSession(
          verified: existing,
          session: session,
          now: _now(),
          phone: phone,
          previousSession: previous,
        )) {
          failAccount(401);
        }
        member = existing;
      }
    } on PasswordsBusy {
      failAccount(429);
    }
    return (
      status: registering ? 201 : 200,
      body: {'user': _store.ownerProfile(member)},
      secret: secret,
    );
  }

  void signOut(String? session) => _store.revoke(session);

  Map<String, Object?> updateProfile(
    String? session,
    Map<String, Object?> input,
  ) {
    final member = _store.memberBySession(session, _now()) ?? failAccount(401);
    if (input.containsKey('expectedOwnerId') &&
        input['expectedOwnerId'] != member.id)
      failAccount(403);
    final name = input['displayName'];
    final bio = input['bio'];
    if (name is! String ||
        name.trim().isEmpty ||
        name.trim().runes.length > 40 ||
        bio is! String ||
        bio.trim().runes.length > 160) {
      failAccount(400);
    }
    Map<String, bool>? visibility;
    if (input.containsKey('visibility')) {
      final fields = input['visibility'];
      if (fields case {'displayName': final bool name, 'bio': final bool bio}) {
        visibility = {'displayName': name, 'bio': bio};
      } else {
        failAccount(400);
      }
    }
    final (updated, taken) = _store.updateProfile(
      owner: member,
      session: session,
      now: _now(),
      update: (
        displayName: name.trim(),
        bio: bio.trim(),
        visibility: visibility,
      ),
    );
    if (taken) failAccount(409);
    return {'user': _store.ownerProfile(updated ?? failAccount(401))};
  }

  Future<void> changePassword(
    String? session,
    Map<String, Object?> input,
  ) async {
    final member = _store.memberBySession(session, _now()) ?? failAccount(401);
    _limits.hit('password:${member.id}', 8, _now());
    final old = input['currentPassword'];
    final next = input['newPassword'];
    if (old is! String ||
        old.isEmpty ||
        old.runes.length > 128 ||
        next is! String ||
        next.runes.length < 8 ||
        next.runes.length > 128 ||
        old == next) {
      failAccount(400);
    }
    final previous = member.credentials ?? failAccount(403);
    try {
      if (!await _passwords.verify(old, previous)) failAccount(422);
      final replacement = await _passwords.hash(next);
      if (!_store.replacePassword(
        owner: member,
        session: session,
        credentials: replacement,
        now: _now(),
      )) {
        failAccount(401);
      }
    } on PasswordsBusy {
      failAccount(429);
    }
  }
}

final _email = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
final _chinaPhone = RegExp(r'^1[3-9]\d{9}$');
final _internationalPhone = RegExp(r'^\+[1-9]\d{7,14}$');
final _phoneSeparators = RegExp(r'[ ()-]');

String? _normalizeEmail(Object? value) {
  if (value is! String) return null;
  final normalized = value.trim().toLowerCase();
  return normalized.length <= 254 && _email.hasMatch(normalized)
      ? normalized
      : null;
}

String? _normalizePhone(Object? value) {
  if (value is! String || value.length > 32) return null;
  final normalized = value.trim().replaceAll(_phoneSeparators, '');
  if (_chinaPhone.hasMatch(normalized)) return '+86$normalized';
  return _internationalPhone.hasMatch(normalized) ? normalized : null;
}

String _newUuid() {
  final bytes = secureBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final digits = hex.encode(bytes);
  return '${digits.substring(0, 8)}-${digits.substring(8, 12)}-'
      '${digits.substring(12, 16)}-${digits.substring(16, 20)}-${digits.substring(20)}';
}

Map<String, Object?> _wireGuest(AccountGuest guest) => {
  'id': guest.id,
  'expiresAt': guest.expiresAt,
};
